-- ==============================================================================
-- FCHub — Migration 11: Wage Rate Breakdown per Project & Historical Views
-- File: supabase/migrations/20261122000011_wage_rate_breakdown.sql
--
-- Sesuai AGENTS.md Bagian 6 (Aturan 1, 2, 3) & Penambahan Transparansi Tarif:
-- - Menampilkan tarif_snapshot per pcs di seluruh tampilan upah.
-- - Mendukung proyek dengan multi-tarif snapshot (karena tarif disalin per entri).
-- - Menambahkan kolom baru di AKHIR view:
--     v_tailor_projects (kolom 17..20: tarif_min, tarif_max, tarif_rata_rata, rincian_tarif)
--     v_tailor_weekly_history (kolom 10: rincian_proyek)
--     v_weekly_project_wages (view baru agregasi per proyek per minggu)
-- ==============================================================================

begin;

-- ==============================================================================
-- 1. PERBARUI VIEW: public.v_tailor_projects
-- Drop & create view dengan security_invoker = true.
-- Kolom 1..16 tetap sama persis urutan, nama, dan tipenya.
-- Kolom baru 17..20 ditambahkan di paling akhir:
--   17: tarif_min (integer)
--   18: tarif_max (integer)
--   19: tarif_rata_rata (bigint)
--   20: rincian_tarif (jsonb) -> array [{ "tarif": N, "pcs": N, "subtotal": N }]
-- ==============================================================================
drop view if exists public.v_tailor_projects;

create view public.v_tailor_projects
with (security_invoker = true)
as
with project_totals as (
  select
    pe.project_id,
    coalesce(sum(pe.qty_disetujui), 0)::bigint as grand_total_pcs_proyek
  from public.production_entries pe
  where pe.status = 'disetujui'
  group by pe.project_id
),
tailor_project_rates as (
  select
    sub.user_id,
    sub.project_id,
    jsonb_agg(
      jsonb_build_object(
        'tarif', sub.tarif,
        'pcs', sub.pcs,
        'subtotal', sub.subtotal
      ) order by sub.tarif asc
    ) as rincian_tarif
  from (
    select
      pe.user_id,
      pe.project_id,
      pe.tarif_snapshot as tarif,
      sum(pe.qty_disetujui)::bigint as pcs,
      sum(pe.qty_disetujui * pe.tarif_snapshot)::bigint as subtotal
    from public.production_entries pe
    where pe.status = 'disetujui'
    group by pe.user_id, pe.project_id, pe.tarif_snapshot
  ) sub
  group by sub.user_id, sub.project_id
),
tailor_project_entries as (
  select
    pe.user_id,
    pe.project_id,
    coalesce(sum(pe.qty_disetujui), 0)::bigint as total_pcs,
    coalesce(sum(pe.qty_disetujui * pe.tarif_snapshot), 0)::bigint as total_upah,
    min(pe.tanggal_kerja) as tanggal_pertama_kerja,
    max(pe.tanggal_kerja) as tanggal_terakhir_kerja,
    count(pe.id)::bigint as total_hari_kerja_proyek,
    min(pe.tarif_snapshot)::integer as tarif_min,
    max(pe.tarif_snapshot)::integer as tarif_max,
    case
      when coalesce(sum(pe.qty_disetujui), 0) > 0 then
        round(coalesce(sum(pe.qty_disetujui * pe.tarif_snapshot), 0)::numeric / sum(pe.qty_disetujui)::numeric)::bigint
      else 0::bigint
    end as tarif_rata_rata
  from public.production_entries pe
  where pe.status = 'disetujui'
  group by pe.user_id, pe.project_id
)
select
  tpe.user_id,
  p.id as project_id,
  p.nama as nama_proyek,
  p.status as status_proyek,
  p.target_pcs,
  p.tarif_per_pcs,
  p.ambang_reward,
  tpe.total_pcs,
  tpe.total_upah,
  coalesce(pt.grand_total_pcs_proyek, 0)::bigint as grand_total_pcs_proyek,
  case
    when coalesce(pt.grand_total_pcs_proyek, 0) > 0 then
      round((tpe.total_pcs::numeric / pt.grand_total_pcs_proyek::numeric) * 100, 1)
    else 0
  end as persen_kontribusi,
  (
    p.reward_aktif = true and
    p.ambang_reward > 0 and
    tpe.total_pcs >= p.ambang_reward
  ) as melewati_ambang_reward,
  tpe.tanggal_pertama_kerja,
  tpe.tanggal_terakhir_kerja,
  tpe.total_hari_kerja_proyek,
  p.reward_aktif as reward_aktif,
  -- Kolom baru di paling akhir (17, 18, 19, 20)
  tpe.tarif_min,
  tpe.tarif_max,
  tpe.tarif_rata_rata,
  coalesce(tpr.rincian_tarif, '[]'::jsonb) as rincian_tarif
from tailor_project_entries tpe
join public.projects p on p.id = tpe.project_id
left join project_totals pt on pt.project_id = p.id
left join tailor_project_rates tpr
  on tpr.user_id = tpe.user_id
  and tpr.project_id = tpe.project_id;

comment on view public.v_tailor_projects is
  'Rekap kontribusi penjahit per proyek lengkap dengan tarif_min, tarif_max, tarif_rata_rata, dan rincian_tarif per tarif snapshot.';

grant select on public.v_tailor_projects to authenticated;
revoke all on public.v_tailor_projects from public, anon;

-- ==============================================================================
-- 2. VIEW BARU: public.v_weekly_project_wages
-- Menghitung agregasi upah dan rincian tarif per penjahit per proyek per minggu.
-- ==============================================================================
create or replace view public.v_weekly_project_wages
with (security_invoker = true)
as
with project_rates as (
  select
    pe.user_id,
    pe.project_id,
    public.get_week_start(pe.tanggal_kerja) as week_start,
    public.get_week_end(pe.tanggal_kerja) as week_end,
    pe.tarif_snapshot,
    sum(pe.qty_disetujui)::bigint as pcs,
    sum(pe.qty_disetujui * pe.tarif_snapshot)::bigint as subtotal
  from public.production_entries pe
  where pe.status = 'disetujui'
  group by
    pe.user_id,
    pe.project_id,
    public.get_week_start(pe.tanggal_kerja),
    public.get_week_end(pe.tanggal_kerja),
    pe.tarif_snapshot
)
select
  pr.user_id,
  pr.project_id,
  p.nama as nama_proyek,
  p.warna as warna_proyek,
  pr.week_start,
  pr.week_end,
  sum(pr.pcs)::bigint as total_pcs,
  sum(pr.subtotal)::bigint as total_upah,
  min(pr.tarif_snapshot)::integer as tarif_min,
  max(pr.tarif_snapshot)::integer as tarif_max,
  case
    when sum(pr.pcs) > 0 then round(sum(pr.subtotal)::numeric / sum(pr.pcs)::numeric)::bigint
    else 0::bigint
  end as tarif_rata_rata,
  jsonb_agg(
    jsonb_build_object(
      'tarif', pr.tarif_snapshot,
      'pcs', pr.pcs,
      'subtotal', pr.subtotal
    ) order by pr.tarif_snapshot asc
  ) as rincian_tarif
from project_rates pr
join public.projects p on p.id = pr.project_id
group by
  pr.user_id,
  pr.project_id,
  p.nama,
  p.warna,
  pr.week_start,
  pr.week_end;

comment on view public.v_weekly_project_wages is
  'Rincian upah mingguan per penjahit per proyek lengkap dengan rincian tarif snapshot.';

grant select on public.v_weekly_project_wages to authenticated;
revoke all on public.v_weekly_project_wages from public, anon;

-- ==============================================================================
-- 3. PERBARUI VIEW: public.v_tailor_weekly_history
-- Kolom 1..9 dipertahankan persis. Kolom 10 ditambahkan di akhir: rincian_proyek.
-- ==============================================================================
drop view if exists public.v_tailor_weekly_history;

create view public.v_tailor_weekly_history
with (security_invoker = true)
as
with weekly_project_rates as (
  select
    sub.user_id,
    sub.week_start,
    sub.project_id,
    sub.nama_proyek,
    sum(sub.pcs)::bigint as total_pcs,
    sum(sub.subtotal)::bigint as total_upah,
    min(sub.tarif)::integer as tarif_min,
    max(sub.tarif)::integer as tarif_max,
    case
      when sum(sub.pcs) > 0 then round(sum(sub.subtotal)::numeric / sum(sub.pcs)::numeric)::bigint
      else 0::bigint
    end as tarif_rata_rata,
    jsonb_agg(
      jsonb_build_object(
        'tarif', sub.tarif,
        'pcs', sub.pcs,
        'subtotal', sub.subtotal
      ) order by sub.tarif asc
    ) as rincian_tarif
  from (
    select
      pe.user_id,
      public.get_week_start(pe.tanggal_kerja) as week_start,
      pe.project_id,
      prj.nama as nama_proyek,
      pe.tarif_snapshot as tarif,
      sum(pe.qty_disetujui)::bigint as pcs,
      sum(pe.qty_disetujui * pe.tarif_snapshot)::bigint as subtotal
    from public.production_entries pe
    join public.projects prj on prj.id = pe.project_id
    where pe.status = 'disetujui'
    group by
      pe.user_id,
      public.get_week_start(pe.tanggal_kerja),
      pe.project_id,
      prj.nama,
      pe.tarif_snapshot
  ) sub
  group by
    sub.user_id,
    sub.week_start,
    sub.project_id,
    sub.nama_proyek
),
weekly_rates_agg as (
  select
    wpr.user_id,
    wpr.week_start,
    jsonb_agg(
      jsonb_build_object(
        'project_id', wpr.project_id,
        'nama_proyek', wpr.nama_proyek,
        'total_pcs', wpr.total_pcs,
        'total_upah', wpr.total_upah,
        'tarif_min', wpr.tarif_min,
        'tarif_max', wpr.tarif_max,
        'tarif_rata_rata', wpr.tarif_rata_rata,
        'rincian_tarif', wpr.rincian_tarif
      ) order by wpr.nama_proyek asc
    ) as rincian_proyek
  from weekly_project_rates wpr
  group by wpr.user_id, wpr.week_start
),
weekly_grouped as (
  select
    pe.user_id,
    public.get_week_start(pe.tanggal_kerja) as week_start,
    public.get_week_end(pe.tanggal_kerja) as week_end,
    coalesce(sum(pe.qty_disetujui), 0)::bigint as total_pcs,
    coalesce(sum(pe.qty_disetujui * pe.tarif_snapshot), 0)::bigint as total_upah
  from public.production_entries pe
  where pe.status = 'disetujui'
  group by
    pe.user_id,
    public.get_week_start(pe.tanggal_kerja),
    public.get_week_end(pe.tanggal_kerja)
),
weekly_paid as (
  select
    wp.user_id,
    wp.periode_mulai as week_start,
    coalesce(sum(wp.jumlah), 0)::bigint as total_dibayar,
    max(wp.dibayar_pada) as tanggal_bayar_terakhir
  from public.wage_payments wp
  where wp.status = 'dibayar'
  group by wp.user_id, wp.periode_mulai
)
select
  wg.user_id,
  wg.week_start,
  wg.week_end,
  wg.total_pcs,
  wg.total_upah,
  coalesce(wp.total_dibayar, 0)::bigint as total_dibayar,
  greatest(0, wg.total_upah - coalesce(wp.total_dibayar, 0))::bigint as sisa,
  case
    when wg.total_upah = 0 and coalesce(wp.total_dibayar, 0) = 0 then 'Tanpa upah'
    when coalesce(wp.total_dibayar, 0) = 0 then 'Belum dibayar'
    when coalesce(wp.total_dibayar, 0) = wg.total_upah then 'Lunas'
    when coalesce(wp.total_dibayar, 0) < wg.total_upah then 'Kurang bayar'
    else 'Lebih bayar'
  end as status_pembayaran,
  wp.tanggal_bayar_terakhir,
  -- Kolom baru di paling akhir (posisi 10)
  coalesce(wra.rincian_proyek, '[]'::jsonb) as rincian_proyek
from weekly_grouped wg
left join weekly_paid wp
  on wp.user_id = wg.user_id
  and wp.week_start = wg.week_start
left join weekly_rates_agg wra
  on wra.user_id = wg.user_id
  and wra.week_start = wg.week_start;

comment on view public.v_tailor_weekly_history is
  'Histori mingguan per penjahit lengkap dengan rincian_proyek dan rincian tarif per proyek.';

grant select on public.v_tailor_weekly_history to authenticated;
revoke all on public.v_tailor_weekly_history from public, anon;

commit;
