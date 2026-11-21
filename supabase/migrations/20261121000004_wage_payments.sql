-- ==============================================================================
-- FCHub — Migration 04: Wage Payments Tracking (Pencatatan Status Pembayaran Tunai)
-- File: supabase/migrations/20261121000004_wage_payments.sql
--
-- Sesuai AGENTS.md Bagian 1, 5, 6 (Aturan 11-15), dan 9:
-- - Sistem HANYA MENCATAT dan MENGHITUNG status pembayaran tunai Sabtu (bukan memproses transfer/e-wallet).
-- - Tabel wage_payments menyimpan riwayat pembayaran tunai yang tidak boleh di-update/delete langsung.
-- - Pembatalan hanya lewat fungsi cancel_wage_payment dengan alasan wajib.
-- - Snapshot saat dibayar: total_pcs, jumlah (rupiah), dan rincian per proyek (jsonb).
-- - Status pembayaran: 'Belum dibayar', 'Lunas', 'Kurang bayar', 'Lebih bayar', 'Tanpa upah'.
-- - mark_wage_paid mengeksekusi pembayaran sisa secara atomik dengan advisory lock.
-- ==============================================================================

-- ==============================================================================
-- 1. TABEL: public.wage_payments (Riwayat Pembayaran Tunai Mingguan)
-- ==============================================================================
create table if not exists public.wage_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  periode_mulai date not null,
  periode_selesai date not null,
  total_pcs integer not null check (total_pcs >= 0),
  jumlah integer not null check (jumlah >= 0),
  rincian jsonb not null default '[]'::jsonb,
  status text not null default 'dibayar' check (status in ('dibayar', 'dibatalkan')),
  catatan text,
  dibayar_oleh uuid not null references public.users(id) on delete restrict,
  dibayar_pada timestamptz not null default now(),
  dibatalkan_oleh uuid references public.users(id) on delete set null,
  dibatalkan_pada timestamptz,
  alasan_batal text,
  created_at timestamptz not null default now(),
  constraint check_wage_periode check (periode_selesai >= periode_mulai),
  constraint check_batal_reason check (
    status != 'dibatalkan' or (
      dibatalkan_oleh is not null and
      dibatalkan_pada is not null and
      alasan_batal is not null and
      char_length(trim(alasan_batal)) > 0
    )
  )
);

comment on table public.wage_payments is 'Riwayat pencatatan tanda bayar tunai mingguan penjahit (Aturan Bisnis #11, #12).';
comment on column public.wage_payments.rincian is 'Snapshot rincian per proyek (nama, tarif, pcs, subtotal) saat dibayar.';
comment on column public.wage_payments.jumlah is 'Nominal rupiah tunai yang dibayarkan saat transaksi ini dibuat.';
comment on column public.wage_payments.status is 'Status pembayaran: dibayar (aktif) atau dibatalkan.';

-- Indexes untuk query cepat per penjahit & periode
create index if not exists idx_wage_payments_user_periode on public.wage_payments (user_id, periode_mulai, status);
create index if not exists idx_wage_payments_status on public.wage_payments (status);
create index if not exists idx_wage_payments_periode on public.wage_payments (periode_mulai, periode_selesai);

-- ==============================================================================
-- 2. ROW-LEVEL SECURITY (RLS)
-- Hanya ada kebijakan SELECT:
-- - Owner: melihat semua catatan pembayaran.
-- - Penjahit: hanya melihat catatan pembayaran miliknya sendiri.
-- TIDAK ADA kebijakan INSERT, UPDATE, atau DELETE untuk mencegah manipulasi langsung.
-- ==============================================================================
alter table public.wage_payments enable row level security;

drop policy if exists "Owner can view all wage payments" on public.wage_payments;
create policy "Owner can view all wage payments"
  on public.wage_payments
  for select
  using (public.is_owner());

drop policy if exists "Penjahit can view own wage payments" on public.wage_payments;
create policy "Penjahit can view own wage payments"
  on public.wage_payments
  for select
  using (auth.uid() = user_id);

-- ==============================================================================
-- 3. FUNGSI SECURITY DEFINER: mark_wage_paid
-- Menandai upah penjahit pada suatu minggu telah dibayar tunai.
-- Aturan Bisnis #14:
-- - Membayar SISA (upah_saat_ini dikurangi total pembayaran aktif).
-- - Hanya bila sisa > 0.
-- - Menggunakan pg_advisory_xact_lock agar klik ganda/multi-tab tidak membuat catatan ganda.
-- - Menyimpan snapshot total_pcs, jumlah rupiah, dan rincian per proyek (jsonb).
-- ==============================================================================
create or replace function public.mark_wage_paid(
  p_user_id uuid,
  p_periode_mulai date,
  p_catatan text default null
)
returns public.wage_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_periode_mulai date;
  v_periode_selesai date;
  v_upah_saat_ini bigint := 0;
  v_total_pcs bigint := 0;
  v_total_dibayar_aktif bigint := 0;
  v_sisa bigint := 0;
  v_rincian jsonb := '[]'::jsonb;
  v_payment public.wage_payments;
begin
  -- 1. Verifikasi peran: Hanya owner yang boleh menandai pembayaran
  if not public.is_owner() then
    raise exception 'Akses ditolak: Hanya owner yang dapat menandai pembayaran upah.'
      using errcode = '42501';
  end if;

  -- 2. Pastikan periode awal dan akhir minggu selaras dengan fungsi batas minggu terpusat
  -- TODO(owner): Konfirmasi batas minggu upah (Senin-Minggu vs Minggu-Sabtu).
  v_periode_mulai := public.get_week_start(p_periode_mulai);
  v_periode_selesai := public.get_week_end(p_periode_mulai);

  -- 3. Advisory lock atomik transaksi database untuk mencegah klik ganda atau race condition
  perform pg_advisory_xact_lock(hashtext('wage_pay_' || p_user_id::text || '_' || v_periode_mulai::text));

  -- 4. Hitung upah_saat_ini dan total_pcs dari entri disetujui pada periode minggu tersebut
  -- Aturan Bisnis #1: Hanya input berstatus 'disetujui' yang dihitung
  -- Aturan Bisnis #2: Upah = qty_disetujui * tarif_snapshot
  select
    coalesce(sum(pe.qty_disetujui), 0),
    coalesce(sum(pe.qty_disetujui * pe.tarif_snapshot), 0)
  into v_total_pcs, v_upah_saat_ini
  from public.production_entries pe
  where pe.user_id = p_user_id
    and pe.status = 'disetujui'
    and pe.tanggal_kerja >= v_periode_mulai
    and pe.tanggal_kerja <= v_periode_selesai;

  -- 5. Susun rincian per proyek (snapshot jsonb)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'project_id', prj.id,
        'nama_proyek', prj.nama,
        'tarif_snapshot', sub.tarif_snapshot,
        'total_pcs', sub.total_pcs,
        'subtotal', sub.subtotal
      )
    ),
    '[]'::jsonb
  )
  into v_rincian
  from (
    select
      pe.project_id,
      pe.tarif_snapshot,
      sum(pe.qty_disetujui) as total_pcs,
      sum(pe.qty_disetujui * pe.tarif_snapshot) as subtotal
    from public.production_entries pe
    where pe.user_id = p_user_id
      and pe.status = 'disetujui'
      and pe.tanggal_kerja >= v_periode_mulai
      and pe.tanggal_kerja <= v_periode_selesai
    group by pe.project_id, pe.tarif_snapshot
  ) sub
  join public.projects prj on prj.id = sub.project_id;

  -- 6. Hitung total pembayaran aktif yang sudah tercatat sebelumnya untuk minggu ini
  select coalesce(sum(wp.jumlah), 0)
  into v_total_dibayar_aktif
  from public.wage_payments wp
  where wp.user_id = p_user_id
    and wp.periode_mulai = v_periode_mulai
    and wp.status = 'dibayar';

  -- 7. Hitung sisa yang belum dibayar
  v_sisa := v_upah_saat_ini - v_total_dibayar_aktif;

  if v_sisa <= 0 then
    raise exception 'Tidak ada sisa upah yang perlu dibayar untuk penjahit ini pada periode %.', v_periode_mulai
      using errcode = 'P0001';
  end if;

  -- 8. Masukkan riwayat pembayaran tunai
  insert into public.wage_payments (
    user_id,
    periode_mulai,
    periode_selesai,
    total_pcs,
    jumlah,
    rincian,
    status,
    catatan,
    dibayar_oleh,
    dibayar_pada
  ) values (
    p_user_id,
    v_periode_mulai,
    v_periode_selesai,
    v_total_pcs,
    v_sisa,
    v_rincian,
    'dibayar',
    nullif(trim(p_catatan), ''),
    auth.uid(),
    now()
  )
  returning * into v_payment;

  return v_payment;
end;
$$;

comment on function public.mark_wage_paid(uuid, date, text) is
  'Mencatat pembayaran sisa upah mingguan penjahit secara atomik (Aturan Bisnis #14).';

-- ==============================================================================
-- 4. FUNGSI SECURITY DEFINER: cancel_wage_payment
-- Membatalkan catatan pembayaran upah dengan alasan pembatalan wajib.
-- Aturan Bisnis #11:
-- - Tidak boleh di-delete langsung; catatan tetap ada dengan status 'dibatalkan'.
-- ==============================================================================
create or replace function public.cancel_wage_payment(
  p_payment_id uuid,
  p_alasan text
)
returns public.wage_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.wage_payments;
  v_clean_alasan text;
begin
  -- 1. Verifikasi peran: Hanya owner yang boleh membatalkan
  if not public.is_owner() then
    raise exception 'Akses ditolak: Hanya owner yang dapat membatalkan catatan pembayaran upah.'
      using errcode = '42501';
  end if;

  -- 2. Validasi alasan pembatalan wajib diisi
  v_clean_alasan := trim(coalesce(p_alasan, ''));
  if length(v_clean_alasan) = 0 then
    raise exception 'Alasan pembatalan pembayaran wajib diisi.'
      using errcode = 'P0002';
  end if;

  -- 3. Ambil data pembayaran dan kunci baris untuk update
  select * into v_payment
  from public.wage_payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Catatan pembayaran dengan ID % tidak ditemukan.', p_payment_id
      using errcode = 'P0003';
  end if;

  if v_payment.status != 'dibayar' then
    raise exception 'Hanya pembayaran dengan status "dibayar" yang dapat dibatalkan. Status saat ini: %', v_payment.status
      using errcode = 'P0004';
  end if;

  -- 4. Perbarui status menjadi dibatalkan
  update public.wage_payments
  set
    status = 'dibatalkan',
    dibatalkan_oleh = auth.uid(),
    dibatalkan_pada = now(),
    alasan_batal = v_clean_alasan
  where id = p_payment_id
  returning * into v_payment;

  return v_payment;
end;
$$;

comment on function public.cancel_wage_payment(uuid, text) is
  'Membatalkan catatan pembayaran upah dengan alasan pembatalan wajib (Aturan Bisnis #11).';

-- ==============================================================================
-- 5. VIEW: v_wage_status (Security Invoker = true)
-- Menghitung status pembayaran upah per penjahit per minggu.
-- Status (Aturan Bisnis #13):
-- - 'Tanpa upah'   : upah_saat_ini = 0 dan total_dibayar = 0
-- - 'Belum dibayar': upah_saat_ini > 0 dan total_dibayar = 0
-- - 'Lunas'        : total_dibayar = upah_saat_ini
-- - 'Kurang bayar' : total_dibayar < upah_saat_ini (ada entri bertambah pasca dibayar)
-- - 'Lebih bayar'  : total_dibayar > upah_saat_ini (koreksi entri berkurang pasca dibayar)
-- ==============================================================================
create or replace view public.v_wage_status
with (security_invoker = true)
as
with weekly_entries as (
  -- Agregasi entri disetujui per penjahit per minggu
  select
    pe.user_id,
    public.get_week_start(pe.tanggal_kerja) as week_start,
    public.get_week_end(pe.tanggal_kerja) as week_end,
    coalesce(sum(pe.qty_disetujui), 0)::bigint as total_pcs_saat_ini,
    coalesce(sum(pe.qty_disetujui * pe.tarif_snapshot), 0)::bigint as upah_saat_ini
  from public.production_entries pe
  where pe.status = 'disetujui'
  group by
    pe.user_id,
    public.get_week_start(pe.tanggal_kerja),
    public.get_week_end(pe.tanggal_kerja)
),
weekly_payments as (
  -- Agregasi pembayaran aktif (status = 'dibayar') per penjahit per minggu
  select
    wp.user_id,
    wp.periode_mulai as week_start,
    wp.periode_selesai as week_end,
    coalesce(sum(wp.jumlah), 0)::bigint as total_dibayar,
    max(wp.dibayar_pada) as tanggal_bayar_terakhir,
    (array_agg(wp.dibayar_oleh order by wp.dibayar_pada desc))[1] as dibayar_oleh_last,
    count(wp.id)::bigint as total_transaksi_bayar
  from public.wage_payments wp
  where wp.status = 'dibayar'
  group by
    wp.user_id,
    wp.periode_mulai,
    wp.periode_selesai
),
all_weeks as (
  -- Gabungan seluruh penjahit aktif dan minggu yang memiliki entri atau pembayaran
  select distinct
    u.id as user_id,
    u.nama as nama_penjahit,
    u.username as username_penjahit,
    coalesce(we.week_start, wp.week_start) as week_start,
    coalesce(we.week_end, wp.week_end) as week_end
  from public.users u
  left join weekly_entries we on we.user_id = u.id
  left join weekly_payments wp on wp.user_id = u.id
  where u.role = 'penjahit'
    and (we.week_start is not null or wp.week_start is not null)
)
select
  aw.user_id,
  aw.nama_penjahit,
  aw.username_penjahit,
  aw.week_start,
  aw.week_end,
  coalesce(we.total_pcs_saat_ini, 0)::bigint as total_pcs_saat_ini,
  coalesce(we.upah_saat_ini, 0)::bigint as upah_saat_ini,
  coalesce(wp.total_dibayar, 0)::bigint as total_dibayar,
  greatest(0, coalesce(we.upah_saat_ini, 0) - coalesce(wp.total_dibayar, 0))::bigint as sisa,
  case
    when coalesce(we.upah_saat_ini, 0) = 0 and coalesce(wp.total_dibayar, 0) = 0 then 'Tanpa upah'
    when coalesce(wp.total_dibayar, 0) = 0 then 'Belum dibayar'
    when coalesce(wp.total_dibayar, 0) = coalesce(we.upah_saat_ini, 0) then 'Lunas'
    when coalesce(wp.total_dibayar, 0) < coalesce(we.upah_saat_ini, 0) then 'Kurang bayar'
    else 'Lebih bayar'
  end as status_pembayaran,
  wp.tanggal_bayar_terakhir,
  payer.nama as dibayar_oleh_nama,
  coalesce(wp.total_transaksi_bayar, 0)::bigint as total_transaksi_bayar
from all_weeks aw
left join weekly_entries we
  on we.user_id = aw.user_id
  and we.week_start = aw.week_start
left join weekly_payments wp
  on wp.user_id = aw.user_id
  and wp.week_start = aw.week_start
left join public.users payer
  on payer.id = wp.dibayar_oleh_last;

comment on view public.v_wage_status is
  'Status pembayaran upah per penjahit per minggu: Belum dibayar, Lunas, Kurang bayar, Lebih bayar, Tanpa upah (Aturan Bisnis #13).';
