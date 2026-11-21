-- ==============================================================================
-- FCHub — Migration 05: Tailor Details & Lifetime Earning History Views
-- File: supabase/migrations/20261122000005_penjahit_details.sql
--
-- Sesuai AGENTS.md Bagian 6 (Aturan 1, 2, 3, 11-15) & TAHAP 14:
-- - Hanya entri berstatus 'disetujui' yang dihitung ke pcs & pendapatan.
-- - Upah = qty_disetujui * tarif_snapshot.
-- - Statistik seumur hidup, kontribusi per proyek, dan histori mingguan.
-- ==============================================================================

-- ==============================================================================
-- 1. VIEW: v_tailor_summary
-- Agregasi statistik seumur hidup dan status bayar minggu berjalan per penjahit.
-- ==============================================================================
create or replace view public.v_tailor_summary
with (security_invoker = true)
as
with tailor_entries as (
  -- Agregasi seluruh entri disetujui per penjahit
  select
    pe.user_id,
    coalesce(sum(pe.qty_disetujui), 0)::bigint as total_pcs_seumur_hidup,
    coalesce(sum(pe.qty_disetujui * pe.tarif_snapshot), 0)::bigint as total_pendapatan_seumur_hidup,
    count(distinct pe.project_id)::bigint as total_proyek_dikerjakan,
    count(distinct pe.tanggal_kerja)::bigint as total_hari_kerja
  from public.production_entries pe
  where pe.status = 'disetujui'
  group by pe.user_id
),
tailor_payments as (
  -- Agregasi total pembayaran tunai aktif (status = 'dibayar')
  select
    wp.user_id,
    coalesce(sum(wp.jumlah), 0)::bigint as total_sudah_dibayar
  from public.wage_payments wp
  where wp.status = 'dibayar'
  group by wp.user_id
),
current_week_status as (
  -- Status pembayaran minggu berjalan
  select distinct on (vws.user_id)
    vws.user_id,
    vws.status_pembayaran as status_bayar_minggu_ini,
    vws.sisa as sisa_minggu_ini,
    vws.tanggal_bayar_terakhir as tanggal_bayar_minggu_ini
  from public.v_wage_status vws
  where vws.week_start = public.get_week_start(current_date)
)
select
  u.id as user_id,
  u.nama as nama_penjahit,
  u.username as username_penjahit,
  u.aktif,
  u.created_at,
  coalesce(te.total_pcs_seumur_hidup, 0)::bigint as total_pcs_seumur_hidup,
  coalesce(te.total_pendapatan_seumur_hidup, 0)::bigint as total_pendapatan_seumur_hidup,
  coalesce(te.total_proyek_dikerjakan, 0)::bigint as total_proyek_dikerjakan,
  coalesce(te.total_hari_kerja, 0)::bigint as total_hari_kerja,
  case
    when coalesce(te.total_hari_kerja, 0) > 0 then
      round(coalesce(te.total_pcs_seumur_hidup, 0)::numeric / te.total_hari_kerja::numeric)
    else 0
  end::bigint as rata_rata_pcs_per_hari,
  coalesce(tp.total_sudah_dibayar, 0)::bigint as total_sudah_dibayar,
  greatest(0, coalesce(te.total_pendapatan_seumur_hidup, 0) - coalesce(tp.total_sudah_dibayar, 0))::bigint as total_belum_dibayar,
  coalesce(cws.status_bayar_minggu_ini, 'Tanpa upah') as status_bayar_minggu_ini,
  coalesce(cws.sisa_minggu_ini, 0)::bigint as sisa_minggu_ini,
  cws.tanggal_bayar_minggu_ini
from public.users u
left join tailor_entries te on te.user_id = u.id
left join tailor_payments tp on tp.user_id = u.id
left join current_week_status cws on cws.user_id = u.id
where u.role = 'penjahit';

comment on view public.v_tailor_summary is
  'Statistik seumur hidup penjahit: pcs, pendapatan disetujui, proyek, rata-rata harian, dan pembayaran tunai.';

-- ==============================================================================
-- 2. VIEW: v_tailor_projects
-- Rincian proyek yang pernah dikerjakan oleh penjahit (hanya entri disetujui).
-- Menampilkan kontribusi %, ambang reward, tanggal mulai dan terakhir kerja.
-- ==============================================================================
create or replace view public.v_tailor_projects
with (security_invoker = true)
as
with project_totals as (
  -- Total pcs disetujui per proyek dari seluruh penjahit
  select
    pe.project_id,
    coalesce(sum(pe.qty_disetujui), 0)::bigint as grand_total_pcs_proyek
  from public.production_entries pe
  where pe.status = 'disetujui'
  group by pe.project_id
),
tailor_project_entries as (
  -- Agregasi entri per penjahit per proyek
  select
    pe.user_id,
    pe.project_id,
    coalesce(sum(pe.qty_disetujui), 0)::bigint as total_pcs,
    coalesce(sum(pe.qty_disetujui * pe.tarif_snapshot), 0)::bigint as total_upah,
    min(pe.tanggal_kerja) as tanggal_pertama_kerja,
    max(pe.tanggal_kerja) as tanggal_terakhir_kerja,
    count(pe.id)::bigint as total_hari_kerja_proyek
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
  (tpe.total_pcs >= p.ambang_reward and p.ambang_reward > 0) as melewati_ambang_reward,
  tpe.tanggal_pertama_kerja,
  tpe.tanggal_terakhir_kerja,
  tpe.total_hari_kerja_proyek
from tailor_project_entries tpe
join public.projects p on p.id = tpe.project_id
left join project_totals pt on pt.project_id = p.id;

comment on view public.v_tailor_projects is
  'Rekap kontribusi penjahit per proyek: pcs, upah, persen kontribusi, ambang reward, dan rentang tanggal kerja.';

-- ==============================================================================
-- 3. VIEW: v_tailor_weekly_history
-- Histori mingguan per penjahit: pcs, upah, status bayar, rincian per proyek & per hari.
-- ==============================================================================
create or replace view public.v_tailor_weekly_history
with (security_invoker = true)
as
with weekly_grouped as (
  -- Agregasi per user per minggu
  select
    pe.user_id,
    public.get_week_start(pe.tanggal_kerja) as week_start,
    public.get_week_end(pe.tanggal_kerja) as week_end,
    coalesce(sum(pe.qty_disetujui), 0)::bigint as total_pcs,
    coalesce(sum(pe.qty_disetujui * pe.tarif_snapshot), 0)::bigint as total_upah,
    -- JSONB rincian per proyek
    jsonb_agg(
      distinct jsonb_build_object(
        'project_id', prj.id,
        'nama_proyek', prj.nama,
        'tarif_snapshot', pe.tarif_snapshot
      )
    ) as proyek_list
  from public.production_entries pe
  join public.projects prj on prj.id = pe.project_id
  where pe.status = 'disetujui'
  group by
    pe.user_id,
    public.get_week_start(pe.tanggal_kerja),
    public.get_week_end(pe.tanggal_kerja)
),
weekly_paid as (
  -- Agregasi pembayaran aktif per user per minggu
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
  wp.tanggal_bayar_terakhir
from weekly_grouped wg
left join weekly_paid wp
  on wp.user_id = wg.user_id
  and wp.week_start = wg.week_start;

comment on view public.v_tailor_weekly_history is
  'Histori mingguan per penjahit: pcs, upah disetujui, pembayaran aktif, dan status bayar.';
