-- ==============================================================================
-- FCHub — Migration 09: Work Calendar, Project Color Palette & Working Day Rules
-- File: supabase/migrations/20261122000009_work_calendar.sql
--
-- Sesuai AGENTS.md Bagian 6 (Aturan 20) & TAHAP 17:
-- - Tabel work_calendar untuk hari libur & pengecualian tanggal.
-- - Pola hari_kerja di app_settings (default [1,2,3,4,5,6]).
-- - Fungsi is_hari_kerja(p_tanggal date) & hitung_hari_kerja(mulai, selesai).
-- - Fungsi tambah_hari_kerja(mulai, n_hari) untuk estimasi selesai akurat.
-- - Kolom projects.warna text (palet 'p1'..'p8') dan get_next_project_color().
-- - Fungsi get_calendar_month(tahun, bulan, project) khusus owner.
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. TABEL: work_calendar
-- ==============================================================================
create table if not exists public.work_calendar (
  tanggal date primary key,
  jenis text not null check (jenis in ('libur', 'kerja')),
  keterangan text,
  dibuat_oleh uuid references auth.users(id),
  dibuat_pada timestamptz not null default now()
);

comment on table public.work_calendar is
  'Daftar hari libur dan pengecualian tanggal kalender kerja konveksi (Aturan Bisnis #20).';

-- RLS
alter table public.work_calendar enable row level security;

drop policy if exists "Owner full access on work_calendar" on public.work_calendar;
create policy "Owner full access on work_calendar"
  on public.work_calendar
  for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "Penjahit read work_calendar" on public.work_calendar;
create policy "Penjahit read work_calendar"
  on public.work_calendar
  for select
  to authenticated
  using (true);

-- ==============================================================================
-- 2. POLA HARI KERJA DI APP_SETTINGS
-- Pola mingguan ISO (1=Senin s.d. 7=Minggu). Default: Senin s.d. Sabtu.
-- ==============================================================================
insert into public.app_settings (key, value)
values ('hari_kerja', '[1,2,3,4,5,6]'::jsonb)
on conflict (key) do nothing;

-- ==============================================================================
-- 3. KOLOM: projects.warna (Palet p1..p8)
-- ==============================================================================
alter table public.projects
  add column if not exists warna text not null default 'p1';

comment on column public.projects.warna is
  'Kunci token warna proyek dari palet p1..p8 sesuai design-fchub.md.';

-- Migrasi proyek lama: beri warna bergiliran menurut urutan created_at
with ordered_projects as (
  select id, row_number() over (order by created_at asc) as rn
  from public.projects
)
update public.projects p
set warna = 'p' || (((op.rn - 1) % 8) + 1)::text
from ordered_projects op
where p.id = op.id;

-- ==============================================================================
-- 4. FUNGSI: is_hari_kerja(p_tanggal date)
-- Satu sumber kebenaran status hari kerja di sistem.
-- ==============================================================================
create or replace function public.is_hari_kerja(p_tanggal date)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_override text;
  v_dow integer;
  v_pattern jsonb;
begin
  if p_tanggal is null then
    return false;
  end if;

  -- 1. Cek tabel pengecualian work_calendar terlebih dahulu
  select jenis into v_override
  from public.work_calendar
  where tanggal = p_tanggal;

  if v_override is not null then
    return v_override = 'kerja';
  end if;

  -- 2. Cek pola mingguan di app_settings
  select value into v_pattern
  from public.app_settings
  where key = 'hari_kerja';

  if v_pattern is null or jsonb_typeof(v_pattern) != 'array' then
    v_pattern := '[1,2,3,4,5,6]'::jsonb;
  end if;

  -- extract(isodow from date): 1 = Senin, 7 = Minggu
  v_dow := extract(isodow from p_tanggal)::integer;

  return v_pattern @> to_jsonb(v_dow);
end;
$$;

revoke all on function public.is_hari_kerja(date) from public, anon;
grant execute on function public.is_hari_kerja(date) to authenticated;

-- ==============================================================================
-- 5. FUNGSI: hitung_hari_kerja(p_mulai date, p_selesai date)
-- Menghitung total hari kerja antara rentang tanggal (inklusif).
-- ==============================================================================
create or replace function public.hitung_hari_kerja(p_mulai date, p_selesai date)
returns integer
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_curr date;
  v_end date;
  v_count integer := 0;
begin
  if p_mulai is null or p_selesai is null or p_mulai > p_selesai then
    return 0;
  end if;

  v_curr := p_mulai;
  v_end := p_selesai;

  while v_curr <= v_end loop
    if public.is_hari_kerja(v_curr) then
      v_count := v_count + 1;
    end if;
    v_curr := v_curr + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.hitung_hari_kerja(date, date) from public, anon;
grant execute on function public.hitung_hari_kerja(date, date) to authenticated;

-- ==============================================================================
-- 6. FUNGSI: tambah_hari_kerja(p_mulai date, p_jumlah_hari integer)
-- Menghitung tanggal target dengan melompati hari libur kalender.
-- ==============================================================================
create or replace function public.tambah_hari_kerja(p_mulai date, p_jumlah_hari integer)
returns date
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_curr date := p_mulai;
  v_added integer := 0;
begin
  if p_mulai is null or p_jumlah_hari is null or p_jumlah_hari <= 0 then
    return p_mulai;
  end if;

  while v_added < p_jumlah_hari loop
    v_curr := v_curr + 1;
    if public.is_hari_kerja(v_curr) then
      v_added := v_added + 1;
    end if;
  end loop;

  return v_curr;
end;
$$;

revoke all on function public.tambah_hari_kerja(date, integer) from public, anon;
grant execute on function public.tambah_hari_kerja(date, integer) to authenticated;

-- ==============================================================================
-- 7. FUNGSI: get_next_project_color()
-- Memilih otomatis warna proyek dari p1..p8 yang paling jarang digunakan.
-- ==============================================================================
create or replace function public.get_next_project_color()
returns text
language sql
security definer
stable
set search_path = public
as $$
  with palette as (
    select unnest(array['p1','p2','p3','p4','p5','p6','p7','p8']) as c
  ),
  counts as (
    select
      pal.c,
      count(p.id) as total_used
    from palette pal
    left join public.projects p on p.warna = pal.c
    group by pal.c
  )
  select c
  from counts
  order by total_used asc, c asc
  limit 1;
$$;

revoke all on function public.get_next_project_color() from public, anon;
grant execute on function public.get_next_project_color() to authenticated;

-- ==============================================================================
-- 8. FUNGSI: get_calendar_month(p_tahun int, p_bulan int, p_project uuid default null)
-- Mengembalikan grid data harian satu bulan penuh khusus owner.
-- ==============================================================================
create or replace function public.get_calendar_month(
  p_tahun integer,
  p_bulan integer,
  p_project uuid default null
)
returns table (
  tanggal date,
  is_hari_kerja boolean,
  sumber_status text,
  keterangan_libur text,
  proyek_produksi jsonb,
  total_pcs_disetujui bigint,
  total_pcs_menunggu bigint,
  total_penjahit bigint,
  ada_lembur boolean
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_start date;
  v_end date;
  v_curr date;
  v_override record;
  v_is_work boolean;
  v_source text;
  v_ket text;
  v_proyek_arr jsonb;
  v_pcs_disetujui bigint;
  v_pcs_menunggu bigint;
  v_tailor_count bigint;
  v_lembur boolean;
begin
  -- Keamanan: Hanya Owner yang Login yang Boleh Memanggil
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Akses ditolak: Hanya owner yang dapat mengakses kalender kerja.'
      using errcode = '42501';
  end if;

  v_start := make_date(p_tahun, p_bulan, 1);
  v_end := (v_start + interval '1 month - 1 day')::date;
  v_curr := v_start;

  while v_curr <= v_end loop
    -- 1. Evaluasi status hari kerja
    select jenis, keterangan into v_override
    from public.work_calendar
    where work_calendar.tanggal = v_curr;

    if v_override.jenis is not null then
      v_is_work := (v_override.jenis = 'kerja');
      v_source := 'kalender';
      v_ket := v_override.keterangan;
    else
      v_is_work := public.is_hari_kerja(v_curr);
      v_source := 'pola';
      v_ket := case when not v_is_work then 'Libur rutin mingguan' else null end;
    end if;

    -- 2. Agregasi entri produksi dan deadline proyek pada tanggal v_curr
    with day_entries as (
      select
        pe.project_id,
        coalesce(sum(case when pe.status = 'disetujui' then pe.qty_disetujui else 0 end), 0)::bigint as pcs_disetujui,
        coalesce(sum(case when pe.status = 'menunggu' then pe.qty else 0 end), 0)::bigint as pcs_menunggu,
        count(distinct pe.user_id)::bigint as jumlah_penjahit
      from public.production_entries pe
      where pe.tanggal_kerja = v_curr
        and pe.status in ('disetujui', 'menunggu')
        and (p_project is null or pe.project_id = p_project)
      group by pe.project_id
    ),
    project_info as (
      select
        p.id as project_id,
        p.nama as nama_proyek,
        p.warna,
        p.deadline,
        (p.deadline = v_curr) as is_deadline,
        coalesce(de.pcs_disetujui, 0)::bigint as pcs_disetujui,
        coalesce(de.pcs_menunggu, 0)::bigint as pcs_menunggu,
        coalesce(de.jumlah_penjahit, 0)::bigint as jumlah_penjahit
      from public.projects p
      left join day_entries de on de.project_id = p.id
      where (p_project is null or p.id = p_project)
        and (
          de.project_id is not null
          or p.deadline = v_curr
        )
    )
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'project_id', pi.project_id,
            'nama_proyek', pi.nama_proyek,
            'warna', pi.warna,
            'pcs_disetujui', pi.pcs_disetujui,
            'pcs_menunggu', pi.pcs_menunggu,
            'jumlah_penjahit', pi.jumlah_penjahit,
            'is_deadline', pi.is_deadline,
            'is_lembur', (not v_is_work and (pi.pcs_disetujui > 0 or pi.pcs_menunggu > 0))
          )
          order by pi.pcs_disetujui desc, pi.nama_proyek asc
        ),
        '[]'::jsonb
      ),
      coalesce(sum(pi.pcs_disetujui), 0)::bigint,
      coalesce(sum(pi.pcs_menunggu), 0)::bigint,
      coalesce(sum(pi.jumlah_penjahit), 0)::bigint
    into
      v_proyek_arr,
      v_pcs_disetujui,
      v_pcs_menunggu,
      v_tailor_count
    from project_info pi;

    v_lembur := (not v_is_work) and (v_pcs_disetujui > 0 or v_pcs_menunggu > 0);

    -- Return row
    tanggal := v_curr;
    is_hari_kerja := v_is_work;
    sumber_status := v_source;
    keterangan_libur := v_ket;
    proyek_produksi := v_proyek_arr;
    total_pcs_disetujui := v_pcs_disetujui;
    total_pcs_menunggu := v_pcs_menunggu;
    total_penjahit := v_tailor_count;
    ada_lembur := v_lembur;
    return next;

    v_curr := v_curr + 1;
  end loop;
end;
$$;

revoke all on function public.get_calendar_month(integer, integer, uuid) from public, anon;
grant execute on function public.get_calendar_month(integer, integer, uuid) to authenticated;

commit;
