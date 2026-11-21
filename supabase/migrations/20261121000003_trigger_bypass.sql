-- ==============================================================================
-- Migration 03: Bypass Trigger untuk Sesi Administratif & Kebijakan Penjahit Aktif
-- Berkas: supabase/migrations/20261121000003_trigger_bypass.sql
--
-- Ringkasan:
-- 1. Memperbarui fungsi trigger INSERT dan UPDATE pada public.production_entries:
--    Bila auth.uid() is null (artinya pemanggilan via service_role atau SQL Editor,
--    bukan pengguna aplikasi via Auth JWT), paksaan peran dilewati:
--    - Tetap mengisi tarif_snapshot dari public.projects bila kosong.
--    - Tetap mengisi timestamp dibuat_pada dan updated_at.
--    - Membiarkan status, qty_disetujui, user_id, disetujui_oleh, disetujui_pada sesuai nilai yang dikirim.
-- 2. Memperbarui kebijakan RLS INSERT dan UPDATE untuk penjahit pada public.production_entries
--    agar hanya berlaku bagi pengguna dengan status aktif = true pada public.users.
-- ==============================================================================

-- ==============================================================================
-- 1. FUNGSI TRIGGER BEFORE INSERT (DIPERBARUI DENGAN BYPASS ADMIN/SQL EDITOR)
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
  -- ----------------------------------------------------------------------------
  -- A. BYPASS BILA auth.uid() IS NULL (service_role atau SQL Editor)
  -- ----------------------------------------------------------------------------
  if auth.uid() is null then
    -- Tetap isi tarif_snapshot dari projects bila kosong
    if NEW.tarif_snapshot is null and NEW.project_id is not null then
      select tarif_per_pcs into NEW.tarif_snapshot
      from public.projects
      where id = NEW.project_id;
    end if;

    -- Nilai default status jika tidak disertakan
    if NEW.status is null then
      NEW.status := 'menunggu';
    end if;

    -- Timestamp default
    if NEW.dibuat_pada is null then
      NEW.dibuat_pada := now();
    end if;
    NEW.updated_at := coalesce(NEW.updated_at, now());

    -- Biarkan status, qty_disetujui, user_id, disetujui_oleh, disetujui_pada sesuai nilai yang dikirim
    return NEW;
  end if;

  -- ----------------------------------------------------------------------------
  -- B. LOGIKA KETAT UNTUK PENGGUNA APLIKASI (auth.uid() IS NOT NULL)
  -- ----------------------------------------------------------------------------

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

  NEW.dibuat_pada := coalesce(NEW.dibuat_pada, now());
  NEW.updated_at := now();

  return NEW;
end;
$$;

-- ==============================================================================
-- 2. FUNGSI TRIGGER BEFORE UPDATE (DIPERBARUI DENGAN BYPASS ADMIN/SQL EDITOR)
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
  -- ----------------------------------------------------------------------------
  -- A. BYPASS BILA auth.uid() IS NULL (service_role atau SQL Editor)
  -- ----------------------------------------------------------------------------
  if auth.uid() is null then
    -- Tetap isi updated_at
    NEW.updated_at := now();
    -- Biarkan status, qty_disetujui, user_id, disetujui_oleh, disetujui_pada sesuai nilai yang dikirim
    return NEW;
  end if;

  -- ----------------------------------------------------------------------------
  -- B. LOGIKA KETAT UNTUK PENGGUNA APLIKASI (auth.uid() IS NOT NULL)
  -- ----------------------------------------------------------------------------
  v_is_owner := public.is_owner();

  -- 1. Integritas data tidak dapat diubah oleh siapa pun via klien:
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

-- ==============================================================================
-- 3. PERBARUI KEBIJAKAN RLS PENJAHIT (HANYA UNTUK USERS AKTIF)
-- ==============================================================================

-- A. Kebijakan INSERT: Penjahit hanya dapat memasukkan entri jika users.aktif = true
drop policy if exists "penjahit_insert_own_entries" on public.production_entries;
create policy "penjahit_insert_own_entries"
on public.production_entries
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'penjahit'
      and aktif = true
  )
);

-- B. Kebijakan UPDATE: Penjahit hanya dapat mengubah entri menunggu jika users.aktif = true
drop policy if exists "penjahit_update_own_pending_entries" on public.production_entries;
create policy "penjahit_update_own_pending_entries"
on public.production_entries
for update
to authenticated
using (
  user_id = auth.uid()
  and status = 'menunggu'
  and exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'penjahit'
      and aktif = true
  )
)
with check (
  user_id = auth.uid()
  and status = 'menunggu'
  and exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'penjahit'
      and aktif = true
  )
);

-- C. Kebijakan DELETE: Penjahit hanya dapat menghapus entri menunggu jika users.aktif = true
drop policy if exists "penjahit_delete_own_pending_entries" on public.production_entries;
create policy "penjahit_delete_own_pending_entries"
on public.production_entries
for delete
to authenticated
using (
  user_id = auth.uid()
  and status = 'menunggu'
  and exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'penjahit'
      and aktif = true
  )
);
