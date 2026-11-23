-- ==============================================================================
-- FCHub — Migration 10: Stock Inventory, Movements & Warehouse Management
-- File: supabase/migrations/20261122000010_stock_inventory.sql
--
-- Sesuai TAHAP 18 & design-fchub.md:
-- - Tabel stock_items untuk katalog stok barang jadi di gudang.
-- - Tabel stock_movements untuk riwayat mutasi stok atomik.
-- - Fungsi adjust_stock() dengan row lock (FOR UPDATE) mencegah race condition.
-- - Fungsi get_stock_summary() untuk kartu ringkasan owner.
-- - View v_stock_items (security_invoker = true) untuk query daftar & filter.
-- - Storage bucket stock-photos (private) & kebijakan akses owner.
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. TABEL: public.stock_items
-- ==============================================================================
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  kode text not null,
  nama text not null,
  kategori text not null default 'Umum',
  project_id uuid references public.projects(id) on delete set null,
  stok_saat_ini integer not null default 0 check (stok_saat_ini >= 0),
  ambang_menipis integer not null default 5 check (ambang_menipis >= 0),
  harga_jual numeric(14, 2),
  lokasi_gudang text,
  catatan text,
  foto jsonb not null default '[]'::jsonb,
  status text not null default 'aktif' check (status in ('aktif', 'diarsipkan')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index dan unique constraint
create unique index if not exists idx_stock_items_kode on public.stock_items (lower(kode));
create index if not exists idx_stock_items_status on public.stock_items (status);
create index if not exists idx_stock_items_project on public.stock_items (project_id);
create index if not exists idx_stock_items_kategori on public.stock_items (kategori);

comment on table public.stock_items is 'Katalog barang jadi dan stok gudang konveksi (Tahap 18).';

-- RLS
alter table public.stock_items enable row level security;

drop policy if exists "Owner full access on stock_items" on public.stock_items;
create policy "Owner full access on stock_items"
  on public.stock_items
  for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- ==============================================================================
-- 2. TABEL: public.stock_movements
-- ==============================================================================
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references public.stock_items(id) on delete cascade,
  jenis text not null check (jenis in ('masuk', 'keluar_penjualan', 'keluar_rusak', 'koreksi')),
  jumlah integer not null, -- Bertanda: positif menambah, negatif mengurangi
  stok_sebelum integer not null check (stok_sebelum >= 0),
  stok_sesudah integer not null check (stok_sesudah >= 0),
  harga_satuan numeric(14, 2),
  total_harga numeric(14, 2),
  pembeli text,
  catatan text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_movements_item on public.stock_movements (stock_item_id, created_at desc);
create index if not exists idx_stock_movements_jenis on public.stock_movements (jenis);

comment on table public.stock_movements is 'Catatan riwayat pergerakan / mutasi stok gudang (Tahap 18).';

-- RLS
alter table public.stock_movements enable row level security;

drop policy if exists "Owner full access on stock_movements" on public.stock_movements;
create policy "Owner full access on stock_movements"
  on public.stock_movements
  for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- ==============================================================================
-- 3. VIEW: public.v_stock_items (Security Invoker = true)
-- ==============================================================================
create or replace view public.v_stock_items
with (security_invoker = true)
as
select
  si.id,
  si.kode,
  si.nama,
  si.kategori,
  si.project_id,
  si.stok_saat_ini,
  si.ambang_menipis,
  si.harga_jual,
  si.lokasi_gudang,
  si.catatan,
  si.foto,
  si.status,
  si.created_at,
  si.updated_at,
  p.nama as nama_proyek,
  p.warna as warna_proyek,
  case
    when si.stok_saat_ini = 0 then 'habis'
    when si.stok_saat_ini <= si.ambang_menipis then 'menipis'
    else 'tersedia'
  end as status_stok,
  case
    when jsonb_array_length(si.foto) > 0 then si.foto->0->>'thumb_path'
    else null
  end as sampul_thumb_path,
  case
    when jsonb_array_length(si.foto) > 0 then si.foto->0->>'full_path'
    else null
  end as sampul_full_path
from public.stock_items si
left join public.projects p on p.id = si.project_id;

comment on view public.v_stock_items is 'Agregasi item stok dengan informasi proyek dan status ketersediaan.';

-- ==============================================================================
-- 4. FUNGSI: public.adjust_stock
-- Mutasi stok atomik dengan baris terkunci (FOR UPDATE) mencegah race condition.
-- ==============================================================================
create or replace function public.adjust_stock(
  p_item_id uuid,
  p_jenis text,
  p_qty integer,
  p_catatan text default null,
  p_harga_satuan numeric default null,
  p_pembeli text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_delta integer;
  v_stok_sebelum integer;
  v_stok_sesudah integer;
  v_total_harga numeric;
  v_movement public.stock_movements;
begin
  -- Keamanan: Hanya Owner yang Login yang Boleh Memanggil
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Akses ditolak: Hanya owner yang dapat mengubah stok gudang.'
      using errcode = '42501';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Jumlah pergerakan stok harus lebih dari 0 pcs.';
  end if;

  if p_jenis not in ('masuk', 'keluar_penjualan', 'keluar_rusak', 'koreksi') then
    raise exception 'Jenis pergerakan stok tidak valid: %', p_jenis;
  end if;

  -- Kunci baris stock_items untuk update atomik
  select id, stok_saat_ini, harga_jual into v_item
  from public.stock_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item stok dengan ID % tidak ditemukan.', p_item_id;
  end if;

  v_stok_sebelum := v_item.stok_saat_ini;

  -- Hitung delta bertanda
  if p_jenis = 'masuk' then
    v_delta := p_qty;
    v_stok_sesudah := v_stok_sebelum + p_qty;
  elsif p_jenis = 'keluar_penjualan' or p_jenis = 'keluar_rusak' then
    if v_stok_sebelum < p_qty then
      raise exception 'Stok tidak mencukupi: stok saat ini % pcs, pengeluaran % pcs.',
        v_stok_sebelum, p_qty;
    end if;
    v_delta := -p_qty;
    v_stok_sesudah := v_stok_sebelum - p_qty;
  elsif p_jenis = 'koreksi' then
    -- Pada koreksi, p_qty dianggap target stok akhir baru
    v_stok_sesudah := p_qty;
    v_delta := v_stok_sesudah - v_stok_sebelum;
  end if;

  if v_stok_sesudah < 0 then
    raise exception 'Stok akhir tidak boleh kurang dari 0 pcs.';
  end if;

  -- Hitung total harga jika ada harga satuan
  if p_harga_satuan is not null and p_harga_satuan > 0 then
    v_total_harga := p_harga_satuan * p_qty;
  else
    v_total_harga := null;
  end if;

  -- Update stok saat ini
  update public.stock_items
  set
    stok_saat_ini = v_stok_sesudah,
    updated_at = now()
  where id = p_item_id;

  -- Catat riwayat pergerakan
  insert into public.stock_movements (
    stock_item_id,
    jenis,
    jumlah,
    stok_sebelum,
    stok_sesudah,
    harga_satuan,
    total_harga,
    pembeli,
    catatan,
    created_by,
    created_at
  )
  values (
    p_item_id,
    p_jenis,
    v_delta,
    v_stok_sebelum,
    v_stok_sesudah,
    p_harga_satuan,
    v_total_harga,
    p_pembeli,
    p_catatan,
    auth.uid(),
    now()
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

revoke all on function public.adjust_stock(uuid, text, integer, text, numeric, text) from public, anon;
grant execute on function public.adjust_stock(uuid, text, integer, text, numeric, text) to authenticated;

-- ==============================================================================
-- 5. FUNGSI: public.get_stock_summary
-- Mengembalikan metrik ringkasan kartu untuk dashboard stok owner.
-- ==============================================================================
create or replace function public.get_stock_summary()
returns table (
  total_jenis bigint,
  total_pcs_tersedia bigint,
  total_menipis bigint,
  total_habis bigint,
  estimasi_nilai_stok numeric
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Akses ditolak: Hanya owner yang dapat melihat ringkasan stok.'
      using errcode = '42501';
  end if;

  return query
  select
    count(*)::bigint as total_jenis,
    coalesce(sum(si.stok_saat_ini), 0)::bigint as total_pcs_tersedia,
    count(*) filter (where si.stok_saat_ini > 0 and si.stok_saat_ini <= si.ambang_menipis)::bigint as total_menipis,
    count(*) filter (where si.stok_saat_ini = 0)::bigint as total_habis,
    coalesce(sum(si.stok_saat_ini * coalesce(si.harga_jual, 0)), 0)::numeric as estimasi_nilai_stok
  from public.stock_items si
  where si.status = 'aktif';
end;
$$;

revoke all on function public.get_stock_summary() from public, anon;
grant execute on function public.get_stock_summary() to authenticated;

-- ==============================================================================
-- 6. STORAGE BUCKET: stock-photos (Private)
-- ==============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stock-photos',
  'stock-photos',
  false,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Storage Policies: Hanya Owner yang Login yang Boleh Kelola Foto Stok
drop policy if exists "Owner can upload stock photos" on storage.objects;
create policy "Owner can upload stock photos"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'stock-photos' and public.is_owner());

drop policy if exists "Owner can view stock photos" on storage.objects;
create policy "Owner can view stock photos"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'stock-photos' and public.is_owner());

drop policy if exists "Owner can update stock photos" on storage.objects;
create policy "Owner can update stock photos"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'stock-photos' and public.is_owner())
  with check (bucket_id = 'stock-photos' and public.is_owner());

drop policy if exists "Owner can delete stock photos" on storage.objects;
create policy "Owner can delete stock photos"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'stock-photos' and public.is_owner());

commit;
