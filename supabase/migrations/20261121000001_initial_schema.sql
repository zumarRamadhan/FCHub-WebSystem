-- ==============================================================================
-- FCHub — Migration 01: Initial Schema, Constraints, Triggers & RLS
-- File: supabase/migrations/20261121000001_initial_schema.sql
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- ==============================================================================
-- 2. TABEL: public.users (Profil Pengguna terhubung ke auth.users)
-- ==============================================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null check (char_length(trim(nama)) >= 2),
  username text not null unique check (username ~ '^[a-z0-9_-]{3,30}$'),
  role text not null check (role in ('owner', 'penjahit')),
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.users is 'Profil pengguna FCHub terhubung langsung ke auth.users Supabase.';
comment on column public.users.username is 'Username unik untuk login tanpa email (dipetakan ke username@fchub.local).';
comment on column public.users.role is 'Peran akses pengguna: owner (admin penuh) atau penjahit.';

-- ==============================================================================
-- 3. TABEL: public.projects (Proyek Konveksi Tas)
-- ==============================================================================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  nama text not null check (char_length(trim(nama)) >= 3),
  target_pcs integer not null check (target_pcs > 0),
  tarif_per_pcs integer not null check (tarif_per_pcs > 0),
  ambang_reward integer not null default 0 check (ambang_reward >= 0),
  tanggal_mulai date not null default (current_timestamp at time zone 'Asia/Jakarta')::date,
  deadline date,
  status text not null default 'aktif' check (status in ('aktif', 'selesai', 'diarsipkan')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint check_project_dates check (deadline is null or deadline >= tanggal_mulai)
);

comment on table public.projects is 'Daftar proyek pengerjaan tas konveksi Firdaus Collection.';
comment on column public.projects.tarif_per_pcs is 'Tarif dasar upah per pcs saat proyek ini dibuat.';
comment on column public.projects.ambang_reward is 'Target pcs minimum seorang penjahit untuk berhak mendapat reward akhir proyek.';

-- ==============================================================================
-- 4. TABEL: public.production_entries (Pencatatan Hasil Kerja Harian)
-- ==============================================================================
create table if not exists public.production_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  tanggal_kerja date not null default (current_timestamp at time zone 'Asia/Jakarta')::date,
  qty integer not null check (qty > 0),
  qty_disetujui integer check (qty_disetujui is null or qty_disetujui >= 0),
  tarif_snapshot integer not null check (tarif_snapshot > 0),
  status text not null default 'menunggu' check (status in ('menunggu', 'disetujui', 'ditolak')),
  catatan_owner text,
  disetujui_oleh uuid references public.users(id) on delete set null,
  disetujui_pada timestamptz,
  dibuat_pada timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.production_entries is 'Entri harian hasil kerja penjahit. Satu-satunya sumber perhitungan upah dan progres.';
comment on column public.production_entries.qty is 'Jumlah pcs yang diinput oleh penjahit (angka asli tidak boleh ditimpa).';
comment on column public.production_entries.qty_disetujui is 'Jumlah pcs akhir setelah disetujui atau dikoreksi oleh owner (null jika menunggu/ditolak).';
comment on column public.production_entries.tarif_snapshot is 'Salinan tarif_per_pcs dari tabel projects saat entri dibuat.';

-- INDEXES untuk performa pencarian dan agregasi
create index if not exists idx_production_entries_user_status on public.production_entries (user_id, status);
create index if not exists idx_production_entries_project_status on public.production_entries (project_id, status);
create index if not exists idx_production_entries_tanggal on public.production_entries (tanggal_kerja);

-- ==============================================================================
-- 5. FUNGSI BANTU SECURITY DEFINER: is_owner()
-- ==============================================================================
create or replace function public.is_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'owner'
      and aktif = true
  );
$$;

comment on function public.is_owner() is 'Memeriksa apakah pengguna saat ini berstatus owner aktif.';

-- ==============================================================================
-- 6. TRIGGER BEFORE INSERT: public.production_entries
-- Aturan Bisnis:
-- - tarif_snapshot disalin dari projects.tarif_per_pcs
-- - status dipaksa 'menunggu' untuk penjahit
-- - user_id dipaksa auth.uid() untuk penjahit (TIDAK boleh spoofing)
-- - qty_disetujui, disetujui_oleh, disetujui_pada dipaksa null saat baru dibuat
-- ==============================================================================
create or replace function public.trg_production_entries_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tarif integer;
  v_project_status text;
  v_is_owner boolean;
begin
  -- 1. Validasi proyek dan ambil tarif proyek saat ini
  select tarif_per_pcs, status into v_tarif, v_project_status
  from public.projects
  where id = NEW.project_id;

  if not found then
    raise exception 'Proyek dengan ID % tidak ditemukan.', NEW.project_id;
  end if;

  if v_project_status != 'aktif' then
    raise exception 'Tidak dapat menginput hasil kerja pada proyek yang tidak aktif (status: %).', v_project_status;
  end if;

  -- 2. Salin tarif snapshot (TIDAK BOLEH berasal dari input klien)
  NEW.tarif_snapshot := v_tarif;

  -- 3. Cek peran pembuat
  v_is_owner := public.is_owner();

  if not v_is_owner then
    -- Penjahit: paksa user_id milik sendiri dan reset field approval
    NEW.user_id := auth.uid();
    NEW.status := 'menunggu';
    NEW.qty_disetujui := null;
    NEW.disetujui_oleh := null;
    NEW.disetujui_pada := null;
    NEW.catatan_owner := null;
  else
    -- Owner yang menginputkan entri
    if NEW.status = 'disetujui' then
      if NEW.qty_disetujui is null then
        NEW.qty_disetujui := NEW.qty;
      end if;
      NEW.disetujui_oleh := auth.uid();
      NEW.disetujui_pada := now();
    else
      NEW.status := 'menunggu';
      NEW.qty_disetujui := null;
      NEW.disetujui_oleh := null;
      NEW.disetujui_pada := null;
    end if;
  end if;

  NEW.dibuat_pada := now();
  NEW.updated_at := now();

  return NEW;
end;
$$;

drop trigger if exists trg_production_entries_before_insert on public.production_entries;
create trigger trg_production_entries_before_insert
before insert on public.production_entries
for each row
execute function public.trg_production_entries_before_insert();

-- ==============================================================================
-- 7. TRIGGER BEFORE UPDATE: public.production_entries
-- Aturan Bisnis:
-- - Penjahit TIDAK BISA mengubah: status, qty_disetujui, tarif_snapshot,
--   disetujui_oleh, disetujui_pada, user_id, project_id, catatan_owner.
-- - Penjahit HANYA bisa mengubah qty dan tanggal_kerja saat status masih 'menunggu'.
-- - Owner saat approval/koreksi:
--   * qty asli penjahit TIDAK PERNAH DITIMPA.
--   * qty_disetujui diisi dengan angka persetujuan/koreksi.
--   * disetujui_oleh diisi auth.uid() dan disetujui_pada diisi timestamp saat ini.
-- ==============================================================================
create or replace function public.trg_production_entries_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_owner boolean;
begin
  v_is_owner := public.is_owner();

  -- 1. Integritas data tidak dapat diubah oleh siapa pun:
  NEW.user_id := OLD.user_id;
  NEW.project_id := OLD.project_id;
  NEW.tarif_snapshot := OLD.tarif_snapshot;
  NEW.dibuat_pada := OLD.dibuat_pada;

  if not v_is_owner then
    -- JIKA PENGUBAH ADALAH PENJAHIT:
    -- Aturan 7: Hanya boleh mengubah saat status 'menunggu'
    if OLD.status != 'menunggu' then
      raise exception 'Entri yang sudah disetujui atau ditolak tidak dapat diubah oleh penjahit.';
    end if;

    -- Aturan 7 & Keamanan: Penjahit tidak boleh memodifikasi status & metadata approval
    if NEW.status != OLD.status or
       NEW.qty_disetujui is distinct from OLD.qty_disetujui or
       NEW.disetujui_oleh is distinct from OLD.disetujui_oleh or
       NEW.disetujui_pada is distinct from OLD.disetujui_pada or
       NEW.catatan_owner is distinct from OLD.catatan_owner then
      raise exception 'Penjahit tidak diizinkan mengubah status persetujuan atau catatan owner.';
    end if;

    -- Penjahit hanya diperbolehkan merevisi qty dan tanggal_kerja
    NEW.qty_disetujui := null;
  else
    -- JIKA PENGUBAH ADALAH OWNER:
    -- Aturan 4: Qty asli penjahit TIDAK BOLEH DITIMPA saat koreksi
    NEW.qty := OLD.qty;

    if NEW.status = 'disetujui' then
      -- Jika owner menyetujui tanpa koreksi khusus, qty_disetujui sama dengan qty asli
      if NEW.qty_disetujui is null then
        NEW.qty_disetujui := OLD.qty;
      end if;
      NEW.disetujui_oleh := auth.uid();
      NEW.disetujui_pada := now();
    elsif NEW.status = 'ditolak' then
      -- Input ditolak tidak punya qty_disetujui
      NEW.qty_disetujui := null;
      NEW.disetujui_oleh := auth.uid();
      NEW.disetujui_pada := now();
    elsif NEW.status = 'menunggu' then
      -- Reset status ke menunggu
      NEW.qty_disetujui := null;
      NEW.disetujui_oleh := null;
      NEW.disetujui_pada := null;
    end if;
  end if;

  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists trg_production_entries_before_update on public.production_entries;
create trigger trg_production_entries_before_update
before update on public.production_entries
for each row
execute function public.trg_production_entries_before_update();

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- A. TABEL public.users
alter table public.users enable row level security;

-- Owner memiliki akses penuh
create policy "owner_all_users"
on public.users
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

-- Pengguna dapat melihat profil miliknya sendiri
create policy "users_select_own"
on public.users
for select
to authenticated
using (id = auth.uid());

-- B. TABEL public.projects
alter table public.projects enable row level security;

-- Owner memiliki akses penuh mengelola proyek
create policy "owner_all_projects"
on public.projects
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

-- Penjahit dapat melihat proyek yang berstatus aktif
create policy "penjahit_select_active_projects"
on public.projects
for select
to authenticated
using (status = 'aktif');

-- C. TABEL public.production_entries
alter table public.production_entries enable row level security;

-- Owner memiliki akses penuh terhadap semua entri produksi
create policy "owner_all_production_entries"
on public.production_entries
for all
to authenticated
using (public.is_owner())
with check (public.is_owner());

-- Penjahit HANYA DAPAT melihat entri miliknya sendiri
create policy "penjahit_select_own_entries"
on public.production_entries
for select
to authenticated
using (user_id = auth.uid());

-- Penjahit dapat memasukkan entri baru untuk dirinya sendiri
create policy "penjahit_insert_own_entries"
on public.production_entries
for insert
to authenticated
with check (user_id = auth.uid());

-- Penjahit HANYA DAPAT mengubah entri miliknya saat status masih 'menunggu'
create policy "penjahit_update_own_pending_entries"
on public.production_entries
for update
to authenticated
using (user_id = auth.uid() and status = 'menunggu')
with check (user_id = auth.uid() and status = 'menunggu');

-- Penjahit HANYA DAPAT menghapus entri miliknya saat status masih 'menunggu'
create policy "penjahit_delete_own_pending_entries"
on public.production_entries
for delete
to authenticated
using (user_id = auth.uid() and status = 'menunggu');
