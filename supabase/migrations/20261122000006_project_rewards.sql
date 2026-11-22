-- ==============================================================================
-- FCHub — Migration 06: Project Reward Toggle & Qualification Update
-- File: supabase/migrations/20261122000006_project_rewards.sql
--
-- Sesuai AGENTS.md Bagian 6 (Aturan 9, 16, 17, 18) & TAHAP 15:
-- - Kolom reward_aktif di projects (default false untuk proyek baru).
-- - Constraint: ambang_reward wajib > 0 dan <= target_pcs hanya jika reward_aktif = true.
-- - v_leaderboard & get_project_leaderboard hanya menandai reward jika reward_aktif = true.
-- - get_project_leaderboard (akses penjahit) hanya mengembalikan proyek bereward.
-- - Seluruh script dibungkus transaksi (BEGIN ... COMMIT).
-- - Semua view mempertahankan nama, tipe, dan urutan kolom lama; kolom baru di paling akhir.
-- ==============================================================================

begin;

-- 1. Tambah kolom reward_aktif pada tabel projects
alter table public.projects
  add column if not exists reward_aktif boolean not null default false;

comment on column public.projects.reward_aktif is
  'Toggle manual owner untuk mengaktifkan kompetisi dan reward pada proyek besar (Aturan Bisnis #16).';

-- Set semua proyek lama menjadi reward_aktif = false (jika ada nilai null)
update public.projects
set reward_aktif = false
where reward_aktif is null;

-- 2. Constraint: Bila reward_aktif = true, ambang_reward wajib > 0 dan <= target_pcs (Aturan Bisnis #17)
alter table public.projects
  drop constraint if exists check_ambang_reward_if_active;

alter table public.projects
  add constraint check_ambang_reward_if_active check (
    (reward_aktif = false) or (
      reward_aktif = true and
      ambang_reward > 0 and
      ambang_reward <= target_pcs
    )
  );

-- ==============================================================================
-- 3. PERBARUI VIEW: v_leaderboard (Akses Owner)
-- Drop & create untuk keamanan skema.
-- Kolom lama (1..10) dipertahankan persis urutan, nama, dan tipenya:
--   1: project_id (uuid)
--   2: nama_proyek (text)
--   3: user_id (uuid)
--   4: nama_penjahit (text)
--   5: username_penjahit (text)
--   6: total_pcs_disetujui (bigint)
--   7: total_upah (bigint)
--   8: ambang_reward (integer)
--   9: melewati_ambang_reward (boolean)
--  10: rank_pcs (bigint)
-- Kolom baru diletakkan di paling akhir (posisi 11):
--  11: reward_aktif (boolean)
-- Penanda melewati_ambang_reward HANYA true bila reward_aktif = true (Aturan Bisnis #9).
-- ==============================================================================
drop view if exists public.v_leaderboard;

create view public.v_leaderboard
with (security_invoker = true)
as
select
  p.id as project_id,
  p.nama as nama_proyek,
  u.id as user_id,
  u.nama as nama_penjahit,
  u.username as username_penjahit,
  coalesce(sum(case when pe.status = 'disetujui' then pe.qty_disetujui else 0 end), 0)::bigint as total_pcs_disetujui,
  -- Aturan Bisnis #2: Upah = qty_disetujui * tarif_snapshot
  coalesce(sum(case when pe.status = 'disetujui' then pe.qty_disetujui * pe.tarif_snapshot else 0 end), 0)::bigint as total_upah,
  p.ambang_reward,
  -- Aturan Bisnis #9: Penanda reward hanya muncul jika reward_aktif = true
  (
    p.reward_aktif = true and
    p.ambang_reward > 0 and
    coalesce(sum(case when pe.status = 'disetujui' then pe.qty_disetujui else 0 end), 0) >= p.ambang_reward
  ) as melewati_ambang_reward,
  dense_rank() over (
    partition by p.id
    order by coalesce(sum(case when pe.status = 'disetujui' then pe.qty_disetujui else 0 end), 0) desc
  ) as rank_pcs,
  -- Kolom baru di paling akhir
  p.reward_aktif as reward_aktif
from public.projects p
cross join public.users u
left join public.production_entries pe
  on pe.project_id = p.id
  and pe.user_id = u.id
where u.role = 'penjahit' and u.aktif = true
group by
  p.id,
  p.nama,
  p.ambang_reward,
  p.reward_aktif,
  u.id,
  u.nama,
  u.username;

comment on view public.v_leaderboard is
  'Leaderboard owner untuk semua proyek; penanda reward hanya aktif jika reward_aktif = true.';

grant select on public.v_leaderboard to authenticated, anon;

-- ==============================================================================
-- 4. PERBARUI FUNGSI SECURITY DEFINER: get_project_leaderboard(uuid)
-- Aturan Bisnis #18: Leaderboard untuk penjahit HANYA menampilkan proyek bereward (reward_aktif = true).
-- Jika proyek tidak memiliki reward aktif, fungsi mengembalikan 0 baris.
-- ==============================================================================
drop function if exists public.get_project_leaderboard(uuid);

create or replace function public.get_project_leaderboard(p_project_id uuid)
returns table (
  rank_position bigint,
  user_id uuid,
  nama_penjahit text,
  total_pcs_disetujui bigint,
  melewati_ambang_reward boolean,
  is_current_user boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    dense_rank() over (
      order by coalesce(sum(case when pe.status = 'disetujui' then pe.qty_disetujui else 0 end), 0) desc
    ) as rank_position,
    u.id as user_id,
    u.nama as nama_penjahit,
    coalesce(sum(case when pe.status = 'disetujui' then pe.qty_disetujui else 0 end), 0)::bigint as total_pcs_disetujui,
    (
      p.reward_aktif = true and
      p.ambang_reward > 0 and
      coalesce(sum(case when pe.status = 'disetujui' then pe.qty_disetujui else 0 end), 0) >= p.ambang_reward
    ) as melewati_ambang_reward,
    (u.id = auth.uid()) as is_current_user
  from public.projects p
  cross join public.users u
  left join public.production_entries pe
    on pe.project_id = p.id
    and pe.user_id = u.id
  where p.id = p_project_id
    and p.reward_aktif = true -- Aturan Bisnis #18: hanya proyek bereward untuk penjahit
    and u.role = 'penjahit'
    and u.aktif = true
  group by
    p.id,
    p.reward_aktif,
    p.ambang_reward,
    u.id,
    u.nama
  order by
    total_pcs_disetujui desc,
    u.nama asc;
$$;

comment on function public.get_project_leaderboard(uuid) is
  'Leaderboard publik untuk penjahit: hanya untuk proyek dengan reward_aktif = true (Aturan Bisnis #18).';

grant execute on function public.get_project_leaderboard(uuid) to authenticated, anon;

-- ==============================================================================
-- 5. PERBARUI VIEW: v_tailor_projects (Tahap 14 & 15)
-- Drop & create untuk keamanan skema.
-- Kolom lama (1..15) dipertahankan persis urutan, nama, dan tipenya:
--   1: user_id (uuid)
--   2: project_id (uuid)
--   3: nama_proyek (text)
--   4: status_proyek (project_status)
--   5: target_pcs (integer)
--   6: tarif_per_pcs (integer)
--   7: ambang_reward (integer)
--   8: total_pcs (bigint)
--   9: total_upah (bigint)
--  10: grand_total_pcs_proyek (bigint)
--  11: persen_kontribusi (numeric)
--  12: melewati_ambang_reward (boolean)
--  13: tanggal_pertama_kerja (date)
--  14: tanggal_terakhir_kerja (date)
--  15: total_hari_kerja_proyek (bigint)
-- Kolom baru diletakkan di paling akhir (posisi 16):
--  16: reward_aktif (boolean)
-- Penanda melewati_ambang_reward hanya aktif jika reward_aktif = true.
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
tailor_project_entries as (
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
  (
    p.reward_aktif = true and
    p.ambang_reward > 0 and
    tpe.total_pcs >= p.ambang_reward
  ) as melewati_ambang_reward,
  tpe.tanggal_pertama_kerja,
  tpe.tanggal_terakhir_kerja,
  tpe.total_hari_kerja_proyek,
  -- Kolom baru di paling akhir
  p.reward_aktif as reward_aktif
from tailor_project_entries tpe
join public.projects p on p.id = tpe.project_id
left join project_totals pt on pt.project_id = p.id;

comment on view public.v_tailor_projects is
  'Rekap kontribusi penjahit per proyek: pcs, upah, persen kontribusi, ambang reward, rentang tanggal kerja, dan reward_aktif.';

grant select on public.v_tailor_projects to authenticated, anon;

commit;
