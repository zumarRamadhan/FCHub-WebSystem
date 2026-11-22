-- ==============================================================================
-- FCHub — Migration 08: Approval Anomaly Flags & App Settings
-- File: supabase/migrations/20261122000008_approval_anomaly_flags.sql
--
-- Sesuai AGENTS.md Bagian 6 (Aturan 19) & TAHAP 16:
-- - Tabel app_settings untuk konfigurasi ambang terpusat (key text pk, value jsonb).
-- - RLS: Owner akses penuh, penjahit hanya select.
-- - Fungsi get_entry_flags(p_project uuid default null) security definer.
-- - Penjahit/anon ditolak jika memanggil get_entry_flags.
-- - Tanda anomali hanya petunjuk bagi owner (tidak memengaruhi status/upah/qty).
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. TABEL: app_settings
-- ==============================================================================
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.app_settings is
  'Konfigurasi sistem terpusat FCHub (ambang rasio anomali, minimal sampel, target harian).';

-- RLS
alter table public.app_settings enable row level security;

drop policy if exists "Owner full access on app_settings" on public.app_settings;
create policy "Owner full access on app_settings"
  on public.app_settings
  for all
  to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists "Penjahit read app_settings" on public.app_settings;
create policy "Penjahit read app_settings"
  on public.app_settings
  for select
  to authenticated
  using (true);

-- Seed awal konfigurasi anomali
insert into public.app_settings (key, value)
values
  ('anomali_rasio_waspada', '1.5'::jsonb),
  ('anomali_rasio_tinggi', '2.5'::jsonb),
  ('anomali_min_sampel', '5'::jsonb),
  ('target_harian', '100'::jsonb)
on conflict (key) do nothing;

-- ==============================================================================
-- 2. FUNGSI SECURITY DEFINER: get_entry_flags(uuid)
-- Menghitung indikator peringatan angka tidak wajar pada entri 'menunggu'.
-- HANYA dapat dipanggil oleh Owner yang terotentikasi.
-- ==============================================================================
drop function if exists public.get_entry_flags(uuid);

create or replace function public.get_entry_flags(p_project uuid default null)
returns table (
  entry_id uuid,
  tingkat text,
  alasan jsonb,
  alasan_kode text[],
  baseline numeric,
  rasio numeric
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_rasio_waspada numeric;
  v_rasio_tinggi numeric;
  v_min_sampel integer;
  v_target_harian numeric;
  v_today_jakarta date;
  r record;
  v_tailor_median numeric;
  v_tailor_count integer;
  v_global_median numeric;
  v_effective_baseline numeric;
  v_sampel_label text;
  v_rasio numeric;
  v_daily_total bigint;
  v_is_duplicate boolean;
  v_tingkat text;
  v_alasan_arr jsonb;
  v_kode_arr text[];
begin
  -- 1. Validasi Keamanan: Tolak jika tanpa login atau bukan Owner
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Akses ditolak: Hanya owner yang dapat mengakses tanda peringatan anomali.'
      using errcode = '42501';
  end if;

  -- 2. Baca ambang batas dari app_settings secara terpusat (tidak di-hardcode)
  select coalesce((value #>> '{}')::numeric, 1.5)
    into v_rasio_waspada
    from public.app_settings where key = 'anomali_rasio_waspada';
  if v_rasio_waspada is null then v_rasio_waspada := 1.5; end if;

  select coalesce((value #>> '{}')::numeric, 2.5)
    into v_rasio_tinggi
    from public.app_settings where key = 'anomali_rasio_tinggi';
  if v_rasio_tinggi is null then v_rasio_tinggi := 2.5; end if;

  select coalesce((value #>> '{}')::integer, 5)
    into v_min_sampel
    from public.app_settings where key = 'anomali_min_sampel';
  if v_min_sampel is null then v_min_sampel := 5; end if;

  select coalesce((value #>> '{}')::numeric, 100)
    into v_target_harian
    from public.app_settings where key = 'target_harian';
  if v_target_harian is null then v_target_harian := 100; end if;

  v_today_jakarta := (now() at time zone 'Asia/Jakarta')::date;

  -- 3. Loop setiap entri 'menunggu' yang sesuai cakupan proyek
  for r in
    select
      pe.id,
      pe.user_id,
      pe.project_id,
      pe.tanggal_kerja,
      pe.qty,
      pe.dibuat_pada
    from public.production_entries pe
    where pe.status = 'menunggu'
      and (p_project is null or pe.project_id = p_project)
    order by pe.tanggal_kerja desc, pe.dibuat_pada desc
  loop
    v_alasan_arr := '[]'::jsonb;
    v_kode_arr := array[]::text[];
    v_tingkat := 'normal';

    -- a. Di atas kebiasaan:
    -- Cari median qty dari maksimal 14 entri disetujui terakhir milik penjahit itu sebelum entri ini
    with recent_tailor_entries as (
      select pe_sub.qty_disetujui
      from public.production_entries pe_sub
      where pe_sub.user_id = r.user_id
        and pe_sub.status = 'disetujui'
        and (
          pe_sub.tanggal_kerja < r.tanggal_kerja
          or (pe_sub.tanggal_kerja = r.tanggal_kerja and pe_sub.dibuat_pada < r.dibuat_pada)
        )
      order by pe_sub.tanggal_kerja desc, pe_sub.dibuat_pada desc
      limit 14
    )
    select
      count(*)::integer,
      percentile_cont(0.5) within group (order by qty_disetujui)::numeric
    into v_tailor_count, v_tailor_median
    from recent_tailor_entries;

    -- Evaluasi kecukupan sampel
    if v_tailor_count >= v_min_sampel and v_tailor_median is not null and v_tailor_median > 0 then
      v_effective_baseline := v_tailor_median;
      v_sampel_label := format('median %s dari %s input terakhir', round(v_tailor_median), v_tailor_count);
    else
      -- Jika sampel kurang, gunakan median seluruh penjahit pada 30 hari terakhir
      select percentile_cont(0.5) within group (order by pe_all.qty_disetujui)::numeric
      into v_global_median
      from public.production_entries pe_all
      where pe_all.status = 'disetujui'
        and pe_all.tanggal_kerja >= (r.tanggal_kerja - interval '30 days')
        and pe_all.tanggal_kerja <= r.tanggal_kerja;

      if v_global_median is not null and v_global_median > 0 then
        v_effective_baseline := v_global_median;
        v_sampel_label := format('median %s semua penjahit 30 hari terakhir', round(v_global_median));
      else
        -- TODO(owner): Bila masih kosong (penjahit baru & sistem awal), gunakan target_harian sistem
        v_effective_baseline := v_target_harian;
        v_sampel_label := format('target harian %s pcs', round(v_target_harian));
      end if;
    end if;

    -- Hitung rasio
    if v_effective_baseline > 0 then
      v_rasio := round((r.qty::numeric / v_effective_baseline), 2);
    else
      v_rasio := 1.0;
    end if;

    -- Aturan a: Di atas kebiasaan
    if v_rasio >= v_rasio_tinggi then
      v_tingkat := 'sangat_tinggi';
      v_kode_arr := array_append(v_kode_arr, 'sangat_tinggi');
      v_alasan_arr := v_alasan_arr || jsonb_build_object(
        'kode', 'sangat_tinggi',
        'judul', 'Sangat tinggi',
        'deskripsi', format('%sx biasanya (%s)', replace(v_rasio::text, '.', ','), v_sampel_label)
      );
    elsif v_rasio >= v_rasio_waspada then
      if v_tingkat != 'sangat_tinggi' then
        v_tingkat := 'perlu_dicek';
      end if;
      v_kode_arr := array_append(v_kode_arr, 'di_atas_kebiasaan');
      v_alasan_arr := v_alasan_arr || jsonb_build_object(
        'kode', 'di_atas_kebiasaan',
        'judul', 'Perlu dicek',
        'deskripsi', format('%sx biasanya (%s)', replace(v_rasio::text, '.', ','), v_sampel_label)
      );
    end if;

    -- Aturan b: Total harian tinggi (> 2 x target_harian pada tanggal yang sama selain ditolak)
    select coalesce(sum(pe_day.qty), 0)
    into v_daily_total
    from public.production_entries pe_day
    where pe_day.user_id = r.user_id
      and pe_day.tanggal_kerja = r.tanggal_kerja
      and pe_day.status != 'ditolak';

    if v_daily_total > (2 * v_target_harian) then
      if v_tingkat != 'sangat_tinggi' then
        v_tingkat := 'perlu_dicek';
      end if;
      v_kode_arr := array_append(v_kode_arr, 'total_harian_tinggi');
      v_alasan_arr := v_alasan_arr || jsonb_build_object(
        'kode', 'total_harian_tinggi',
        'judul', 'Total harian tinggi',
        'deskripsi', format('Total hari ini %s pcs (di atas batas 2x target %s pcs)', v_daily_total, round(2 * v_target_harian))
      );
    end if;

    -- Aturan c: Kemungkinan ganda (ada entri lain milik penjahit, proyek, tanggal, qty sama, status != ditolak)
    select exists (
      select 1
      from public.production_entries pe_dup
      where pe_dup.id != r.id
        and pe_dup.user_id = r.user_id
        and pe_dup.project_id = r.project_id
        and pe_dup.tanggal_kerja = r.tanggal_kerja
        and pe_dup.qty = r.qty
        and pe_dup.status != 'ditolak'
    ) into v_is_duplicate;

    if v_is_duplicate then
      if v_tingkat != 'sangat_tinggi' then
        v_tingkat := 'perlu_dicek';
      end if;
      v_kode_arr := array_append(v_kode_arr, 'kemungkinan_ganda');
      v_alasan_arr := v_alasan_arr || jsonb_build_object(
        'kode', 'kemungkinan_ganda',
        'judul', 'Kemungkinan ganda',
        'deskripsi', format('Ada input lain yang persis sama (%s pcs) pada tanggal ini', r.qty)
      );
    end if;

    -- Aturan d: Tanggal kerja di masa depan (zona Asia/Jakarta)
    if r.tanggal_kerja > v_today_jakarta then
      if v_tingkat != 'sangat_tinggi' then
        v_tingkat := 'perlu_dicek';
      end if;
      v_kode_arr := array_append(v_kode_arr, 'tanggal_masa_depan');
      v_alasan_arr := v_alasan_arr || jsonb_build_object(
        'kode', 'tanggal_masa_depan',
        'judul', 'Tanggal di masa depan',
        'deskripsi', format('Tanggal kerja (%s) melewati hari ini (%s)', r.tanggal_kerja, v_today_jakarta)
      );
    end if;

    -- Output row
    entry_id := r.id;
    tingkat := v_tingkat;
    alasan := v_alasan_arr;
    alasan_kode := v_kode_arr;
    baseline := round(v_effective_baseline, 1);
    rasio := v_rasio;
    return next;
  end loop;
end;
$$;

comment on function public.get_entry_flags(uuid) is
  'Menghasilkan indikator peringatan anomali angka untuk antrean approval owner (Aturan Bisnis #19).';

-- Kunci keamanan: Cabut dari anon & public, hanya beri ke authenticated (owner diverifikasi di dalam fungsi)
revoke all on function public.get_entry_flags(uuid) from public, anon;
grant execute on function public.get_entry_flags(uuid) to authenticated;

commit;
