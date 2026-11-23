-- ==============================================================================
-- Migration: 20261123000012_wage_report_extended.sql
-- Deskripsi: Fungsi agregasi laporan pengeluaran upah periode bebas (bulan-tahun),
--            rentang tanggal data (period options), dan indeks performa.
-- Aturan:
--   - Jangan ubah migration lama
--   - Bungkus dalam begin; ... commit;
--   - Tanpa cascade
--   - Security definer dengan search_path = public
--   - Revoke all from public, anon; grant execute to authenticated
-- ==============================================================================

begin;

-- 1. Indeks performa untuk agregasi laporan rentang tanggal panjang (1-5 tahun)
create index if not exists idx_production_entries_wage_report
on public.production_entries (tanggal_kerja, status, project_id, user_id)
include (qty_disetujui, tarif_snapshot);

-- 2. Fungsi get_wage_period_options()
-- Mengembalikan rentang tanggal_kerja paling awal dan paling akhir dari entri disetujui
create or replace function public.get_wage_period_options()
returns table (
  min_date date,
  max_date date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(min(tanggal_kerja), current_date) as min_date,
    coalesce(max(tanggal_kerja), current_date) as max_date
  from public.production_entries
  where status = 'disetujui';
$$;

comment on function public.get_wage_period_options() is
  'Mengembalikan rentang tanggal kerja entri disetujui yang tersedia untuk referensi pemilih periode.';

-- 3. Fungsi get_wage_report(p_mulai date, p_selesai date, p_project uuid default null)
-- Mengembalikan agregasi lengkap pengeluaran upah: ringkasan, deret waktu, per proyek, per penjahit
create or replace function public.get_wage_report(
  p_mulai date,
  p_selesai date,
  p_project uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days int;
  v_prev_mulai date;
  v_prev_selesai date;
  
  -- Variabel Ringkasan Saat Ini
  v_total_upah bigint := 0;
  v_total_pcs bigint := 0;
  v_rata_upah_per_pcs numeric := 0;
  v_penjahit_aktif int := 0;
  v_rata_per_penjahit numeric := 0;
  v_total_dibayar bigint := 0;
  v_total_belum_dibayar bigint := 0;

  -- Variabel Ringkasan Pembanding
  v_prev_total_upah bigint := 0;
  v_prev_total_pcs bigint := 0;
  v_perubahan_upah_persen numeric := null;
  v_perubahan_pcs_persen numeric := null;

  v_deret_waktu jsonb := '[]'::jsonb;
  v_per_proyek jsonb := '[]'::jsonb;
  v_per_penjahit jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  -- Pemeriksaan Keamanan
  if auth.uid() is null then
    raise exception 'Akses ditolak: pengguna belum login.';
  end if;

  if not public.is_owner() then
    raise exception 'Akses ditolak: hanya owner yang berhak mengakses laporan pengeluaran upah.';
  end if;

  if p_selesai < p_mulai then
    raise exception 'Parameter tidak valid: tanggal selesai tidak boleh lebih awal dari tanggal mulai.';
  end if;

  v_days := (p_selesai - p_mulai) + 1;
  if v_days > 1826 then
    raise exception 'Rentang laporan maksimal adalah 5 tahun.';
  end if;

  -- Hitung rentang periode pembanding dengan durasi yang sama persis
  v_prev_selesai := p_mulai - 1;
  v_prev_mulai := v_prev_selesai - v_days + 1;

  -- A. Agregasi Entri Periode Saat Ini
  select
    coalesce(sum(pe.qty_disetujui * pe.tarif_snapshot), 0)::bigint,
    coalesce(sum(pe.qty_disetujui), 0)::bigint,
    count(distinct pe.user_id)::int
  into
    v_total_upah,
    v_total_pcs,
    v_penjahit_aktif
  from public.production_entries pe
  where pe.status = 'disetujui'
    and pe.tanggal_kerja between p_mulai and p_selesai
    and (p_project is null or pe.project_id = p_project);

  if v_total_pcs > 0 then
    v_rata_upah_per_pcs := round(v_total_upah::numeric / v_total_pcs, 2);
  end if;

  if v_penjahit_aktif > 0 then
    v_rata_per_penjahit := round(v_total_upah::numeric / v_penjahit_aktif);
  end if;

  -- Agregasi Sudah Dibayar dari wage_payments aktif pada rentang tanggal tersebut
  select coalesce(sum(wp.jumlah), 0)::bigint
  into v_total_dibayar
  from public.wage_payments wp
  where wp.status = 'dibayar'
    and (wp.dibayar_pada at time zone 'Asia/Jakarta')::date between p_mulai and p_selesai
    and (
      p_project is null
      or exists (
        select 1 from jsonb_array_elements(wp.rincian) r
        where (r->>'project_id')::uuid = p_project
      )
    );

  -- Agregasi Belum Dibayar dari sisa minggu-minggu yang beririsan dengan periode
  -- (v_wage_status minggu beririsan dengan p_mulai s.d. p_selesai)
  select coalesce(sum(ws.sisa), 0)::bigint
  into v_total_belum_dibayar
  from public.v_wage_status ws
  where ws.week_start <= p_selesai
    and ws.week_end >= p_mulai;

  -- B. Agregasi Entri Periode Pembanding (Sebelumnya)
  select
    coalesce(sum(pe.qty_disetujui * pe.tarif_snapshot), 0)::bigint,
    coalesce(sum(pe.qty_disetujui), 0)::bigint
  into
    v_prev_total_upah,
    v_prev_total_pcs
  from public.production_entries pe
  where pe.status = 'disetujui'
    and pe.tanggal_kerja between v_prev_mulai and v_prev_selesai
    and (p_project is null or pe.project_id = p_project);

  if v_prev_total_upah > 0 then
    v_perubahan_upah_persen := round(((v_total_upah - v_prev_total_upah)::numeric / v_prev_total_upah) * 100, 1);
  end if;

  if v_prev_total_pcs > 0 then
    v_perubahan_pcs_persen := round(((v_total_pcs - v_prev_total_pcs)::numeric / v_prev_total_pcs) * 100, 1);
  end if;

  -- C. Deret Waktu Granularitas Otomatis (Termasuk Periode Nol)
  if v_days <= 14 then
    -- Granularitas Harian
    with date_series as (
      select generate_series(p_mulai::timestamp, p_selesai::timestamp, '1 day'::interval)::date as tgl
    ),
    daily_wages as (
      select
        pe.tanggal_kerja as tgl,
        coalesce(sum(pe.qty_disetujui * pe.tarif_snapshot), 0)::bigint as upah,
        coalesce(sum(pe.qty_disetujui), 0)::bigint as pcs
      from public.production_entries pe
      where pe.status = 'disetujui'
        and pe.tanggal_kerja between p_mulai and p_selesai
        and (p_project is null or pe.project_id = p_project)
      group by pe.tanggal_kerja
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'label', to_char(ds.tgl, 'DD Mon'),
        'start_date', ds.tgl,
        'end_date', ds.tgl,
        'upah', coalesce(dw.upah, 0),
        'pcs', coalesce(dw.pcs, 0)
      ) order by ds.tgl
    ), '[]'::jsonb)
    into v_deret_waktu
    from date_series ds
    left join daily_wages dw on dw.tgl = ds.tgl;

  elsif v_days <= 62 then
    -- Granularitas Mingguan
    with week_series as (
      select
        w_start::date as w_start,
        (w_start + interval '6 days')::date as w_end
      from generate_series(
        public.get_week_start(p_mulai)::timestamp,
        public.get_week_start(p_selesai)::timestamp,
        '1 week'::interval
      ) as w_start
    ),
    weekly_wages as (
      select
        public.get_week_start(pe.tanggal_kerja) as w_start,
        coalesce(sum(pe.qty_disetujui * pe.tarif_snapshot), 0)::bigint as upah,
        coalesce(sum(pe.qty_disetujui), 0)::bigint as pcs
      from public.production_entries pe
      where pe.status = 'disetujui'
        and pe.tanggal_kerja between p_mulai and p_selesai
        and (p_project is null or pe.project_id = p_project)
      group by public.get_week_start(pe.tanggal_kerja)
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'label', to_char(ws.w_start, 'DD Mon') || ' - ' || to_char(ws.w_end, 'DD Mon'),
        'start_date', ws.w_start,
        'end_date', ws.w_end,
        'upah', coalesce(ww.upah, 0),
        'pcs', coalesce(ww.pcs, 0)
      ) order by ws.w_start
    ), '[]'::jsonb)
    into v_deret_waktu
    from week_series ws
    left join weekly_wages ww on ww.w_start = ws.w_start;

  else
    -- Granularitas Bulanan
    with month_series as (
      select
        date_trunc('month', m_start)::date as m_start,
        (date_trunc('month', m_start) + interval '1 month - 1 day')::date as m_end
      from generate_series(
        date_trunc('month', p_mulai)::timestamp,
        date_trunc('month', p_selesai)::timestamp,
        '1 month'::interval
      ) as m_start
    ),
    monthly_wages as (
      select
        date_trunc('month', pe.tanggal_kerja)::date as m_start,
        coalesce(sum(pe.qty_disetujui * pe.tarif_snapshot), 0)::bigint as upah,
        coalesce(sum(pe.qty_disetujui), 0)::bigint as pcs
      from public.production_entries pe
      where pe.status = 'disetujui'
        and pe.tanggal_kerja between p_mulai and p_selesai
        and (p_project is null or pe.project_id = p_project)
      group by date_trunc('month', pe.tanggal_kerja)::date
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'label', to_char(ms.m_start, 'Mon YYYY'),
        'start_date', ms.m_start,
        'end_date', ms.m_end,
        'upah', coalesce(mw.upah, 0),
        'pcs', coalesce(mw.pcs, 0)
      ) order by ms.m_start
    ), '[]'::jsonb)
    into v_deret_waktu
    from month_series ms
    left join monthly_wages mw on mw.m_start = ms.m_start;
  end if;

  -- D. Rincian Per Proyek
  with project_rates as (
    select
      pe.project_id,
      pe.tarif_snapshot as tarif,
      coalesce(sum(pe.qty_disetujui), 0)::bigint as pcs,
      coalesce(sum(pe.qty_disetujui * pe.tarif_snapshot), 0)::bigint as subtotal
    from public.production_entries pe
    where pe.status = 'disetujui'
      and pe.tanggal_kerja between p_mulai and p_selesai
      and (p_project is null or pe.project_id = p_project)
    group by pe.project_id, pe.tarif_snapshot
  ),
  project_totals as (
    select
      pr.project_id,
      p.nama as nama_proyek,
      coalesce(p.warna, 'p1') as warna,
      sum(pr.pcs)::bigint as total_pcs,
      sum(pr.subtotal)::bigint as total_upah,
      jsonb_agg(
        jsonb_build_object(
          'tarif', pr.tarif,
          'pcs', pr.pcs,
          'subtotal', pr.subtotal
        ) order by pr.tarif
      ) as rincian_tarif
    from project_rates pr
    join public.projects p on p.id = pr.project_id
    group by pr.project_id, p.nama, p.warna
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'project_id', pt.project_id,
      'nama_proyek', pt.nama_proyek,
      'warna', pt.warna,
      'total_pcs', pt.total_pcs,
      'total_upah', pt.total_upah,
      'persen_dari_total', case when v_total_upah > 0 then round((pt.total_upah::numeric / v_total_upah) * 100, 1) else 0 end,
      'rincian_tarif', pt.rincian_tarif
    ) order by pt.total_upah desc
  ), '[]'::jsonb)
  into v_per_proyek
  from project_totals pt;

  -- E. Rincian Per Penjahit
  with tailor_project_rates as (
    select
      pe.user_id,
      pe.project_id,
      p.nama as nama_proyek,
      pe.tarif_snapshot as tarif,
      coalesce(sum(pe.qty_disetujui), 0)::bigint as pcs,
      coalesce(sum(pe.qty_disetujui * pe.tarif_snapshot), 0)::bigint as subtotal
    from public.production_entries pe
    join public.projects p on p.id = pe.project_id
    where pe.status = 'disetujui'
      and pe.tanggal_kerja between p_mulai and p_selesai
      and (p_project is null or pe.project_id = p_project)
    group by pe.user_id, pe.project_id, p.nama, pe.tarif_snapshot
  ),
  tailor_totals as (
    select
      tpr.user_id,
      u.nama as nama_penjahit,
      u.username as username_penjahit,
      sum(tpr.pcs)::bigint as total_pcs,
      sum(tpr.subtotal)::bigint as total_upah,
      count(distinct tpr.project_id)::int as total_proyek,
      jsonb_agg(
        jsonb_build_object(
          'project_id', tpr.project_id,
          'nama_proyek', tpr.nama_proyek,
          'tarif', tpr.tarif,
          'pcs', tpr.pcs,
          'subtotal', tpr.subtotal
        ) order by tpr.subtotal desc
      ) as rincian_proyek
    from tailor_project_rates tpr
    join public.users u on u.id = tpr.user_id
    group by tpr.user_id, u.nama, u.username
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id', tt.user_id,
      'nama_penjahit', tt.nama_penjahit,
      'username_penjahit', tt.username_penjahit,
      'total_pcs', tt.total_pcs,
      'total_upah', tt.total_upah,
      'total_proyek', tt.total_proyek,
      'rincian_proyek', tt.rincian_proyek
    ) order by tt.total_upah desc
  ), '[]'::jsonb)
  into v_per_penjahit
  from tailor_totals tt;

  -- Susun kembalian akhir
  v_result := jsonb_build_object(
    'periode', jsonb_build_object(
      'mulai', p_mulai,
      'selesai', p_selesai,
      'jumlah_hari', v_days,
      'prev_mulai', v_prev_mulai,
      'prev_selesai', v_prev_selesai
    ),
    'ringkasan', jsonb_build_object(
      'total_upah', v_total_upah,
      'total_pcs', v_total_pcs,
      'rata_rata_upah_per_pcs', v_rata_upah_per_pcs,
      'jumlah_penjahit_aktif', v_penjahit_aktif,
      'rata_rata_per_penjahit', v_rata_per_penjahit,
      'total_dibayar', v_total_dibayar,
      'total_belum_dibayar', v_total_belum_dibayar,
      'prev_total_upah', v_prev_total_upah,
      'prev_total_pcs', v_prev_total_pcs,
      'perubahan_upah_persen', v_perubahan_upah_persen,
      'perubahan_pcs_persen', v_perubahan_pcs_persen
    ),
    'deret_waktu', v_deret_waktu,
    'per_proyek', v_per_proyek,
    'per_penjahit', v_per_penjahit
  );

  return v_result;
end;
$$;

comment on function public.get_wage_report(date, date, uuid) is
  'Menghitung agregasi lengkap laporan pengeluaran upah penjahit untuk periode bebas hingga 5 tahun.';

-- 4. Batasi Hak Akses: Tutup anon/public, berikan hanya ke authenticated
revoke all on function public.get_wage_period_options() from public, anon;
grant execute on function public.get_wage_period_options() to authenticated;

revoke all on function public.get_wage_report(date, date, uuid) from public, anon;
grant execute on function public.get_wage_report(date, date, uuid) to authenticated;

commit;
