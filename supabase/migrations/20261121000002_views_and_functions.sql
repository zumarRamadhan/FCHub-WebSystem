-- ==============================================================================
-- FCHub — Migration 02: Aggregation Views & Leaderboard Security Definer Function
-- File: supabase/migrations/20261121000002_views_and_functions.sql
-- ==============================================================================

-- ==============================================================================
-- 1. HELPER KONFIGURASI BATAS MINGGU KERJA
-- ==============================================================================
-- TODO(owner): Konfirmasi apakah minggu upah Sabtu dihitung dari Senin-Minggu atau Minggu-Sabtu.
-- Saat ini dikonfigurasi Senin s.d. Minggu (standar ISO).
-- Bila owner ingin menghitung Minggu s.d. Sabtu:
--   cukup ganti rumus offset pada dua fungsi di bawah ini.
-- ==============================================================================

create or replace function public.get_week_start(p_date date)
returns date
language sql
immutable
as $$
  -- Mengembalikan hari Senin pada minggu dari tanggal p_date
  select date_trunc('week', p_date)::date;
$$;

create or replace function public.get_week_end(p_date date)
returns date
language sql
immutable
as $$
  -- Mengembalikan hari Minggu pada minggu dari tanggal p_date
  select (date_trunc('week', p_date) + interval '6 days')::date;
$$;

comment on function public.get_week_start(date) is 'Menentukan tanggal awal minggu upah (TODO(owner): dikonfigurasi Senin).';
comment on function public.get_week_end(date) is 'Menentukan tanggal akhir minggu upah (TODO(owner): dikonfigurasi Minggu).';

-- ==============================================================================
-- 2. VIEW: v_project_progress (Security Invoker = true)
-- Menghitung total pcs disetujui vs target pcs per proyek.
-- Hanya entri berstatus 'disetujui' yang dihitung (Aturan Bisnis #1).
-- ==============================================================================
create or replace view public.v_project_progress
with (security_invoker = true)
as
select
  p.id as project_id,
  p.nama as nama_proyek,
  p.target_pcs,
  p.tarif_per_pcs,
  p.ambang_reward,
  p.status as status_proyek,
  p.tanggal_mulai,
  p.deadline,
  coalesce(sum(case when pe.status = 'disetujui' then pe.qty_disetujui else 0 end), 0)::bigint as total_pcs_disetujui,
  case
    when p.target_pcs > 0 then
      round((coalesce(sum(case when pe.status = 'disetujui' then pe.qty_disetujui else 0 end), 0)::numeric / p.target_pcs::numeric) * 100, 2)
    else 0
  end as persentase_progres,
  greatest(0, p.target_pcs - coalesce(sum(case when pe.status = 'disetujui' then pe.qty_disetujui else 0 end), 0))::bigint as sisa_target_pcs,
  count(case when pe.status = 'menunggu' then 1 end)::bigint as total_entri_menunggu
from public.projects p
left join public.production_entries pe on pe.project_id = p.id
group by
  p.id,
  p.nama,
  p.target_pcs,
  p.tarif_per_pcs,
  p.ambang_reward,
  p.status,
  p.tanggal_mulai,
  p.deadline;

comment on view public.v_project_progress is 'Agregasi progres proyek: total pcs disetujui vs target pcs.';

-- ==============================================================================
-- 3. VIEW: v_leaderboard (Security Invoker = true)
-- Menampilkan rekap pcs, upah, dan pencapaian ambang reward per penjahit per proyek.
-- Hanya menghitung input berstatus 'disetujui' (Aturan Bisnis #1 & #2).
-- ==============================================================================
create or replace view public.v_leaderboard
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
  -- Aturan Bisnis #9: Penanda reward saat total qty_disetujui >= ambang_reward
  (coalesce(sum(case when pe.status = 'disetujui' then pe.qty_disetujui else 0 end), 0) >= p.ambang_reward and p.ambang_reward > 0) as melewati_ambang_reward,
  dense_rank() over (
    partition by p.id
    order by coalesce(sum(case when pe.status = 'disetujui' then pe.qty_disetujui else 0 end), 0) desc
  ) as rank_pcs
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
  u.id,
  u.nama,
  u.username;

comment on view public.v_leaderboard is 'Leaderboard lengkap per proyek (hanya menghitung entri disetujui).';

-- ==============================================================================
-- 4. VIEW: v_weekly_wage (Security Invoker = true)
-- Rekap upah mingguan per penjahit berdasarkan tanggal_kerja (Aturan Bisnis #10).
-- Hanya entri berstatus 'disetujui' yang dihitung (Aturan Bisnis #1).
-- ==============================================================================
create or replace view public.v_weekly_wage
with (security_invoker = true)
as
select
  u.id as user_id,
  u.nama as nama_penjahit,
  u.username as username_penjahit,
  public.get_week_start(pe.tanggal_kerja) as week_start,
  public.get_week_end(pe.tanggal_kerja) as week_end,
  coalesce(sum(pe.qty_disetujui), 0)::bigint as total_pcs_disetujui,
  -- Aturan Bisnis #2: Upah = qty_disetujui * tarif_snapshot
  coalesce(sum(pe.qty_disetujui * pe.tarif_snapshot), 0)::bigint as total_upah,
  count(pe.id)::bigint as total_entri_disetujui
from public.users u
join public.production_entries pe on pe.user_id = u.id
where u.role = 'penjahit'
  and pe.status = 'disetujui'
group by
  u.id,
  u.nama,
  u.username,
  public.get_week_start(pe.tanggal_kerja),
  public.get_week_end(pe.tanggal_kerja);

comment on view public.v_weekly_wage is 'Rekap upah mingguan per penjahit dari tanggal_kerja entri disetujui.';

-- ==============================================================================
-- 5. FUNGSI SECURITY DEFINER: get_project_leaderboard(uuid)
-- Memfasilitasi kebutuhan penjahit:
-- Aturan Bisnis #8: "Penjahit hanya melihat data miliknya sendiri.
-- Leaderboard hanya menampilkan nama dan total pcs disetujui."
-- Fungsi ini aman karena:
-- 1. Menggunakan security definer sehingga dapat mengagregasi pcs semua penjahit
-- 2. HANYA mengembalikan: rank, nama, total_pcs, melewati_ambang, dan flag is_me
-- 3. TIDAK PERNAH membocorkan data upah (nominal rupiah) penjahit lain!
-- ==============================================================================
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
    (coalesce(sum(case when pe.status = 'disetujui' then pe.qty_disetujui else 0 end), 0) >= p.ambang_reward and p.ambang_reward > 0) as melewati_ambang_reward,
    (u.id = auth.uid()) as is_current_user
  from public.projects p
  cross join public.users u
  left join public.production_entries pe
    on pe.project_id = p.id
    and pe.user_id = u.id
  where p.id = p_project_id
    and u.role = 'penjahit'
    and u.aktif = true
  group by
    p.id,
    p.ambang_reward,
    u.id,
    u.nama
  order by
    total_pcs_disetujui desc,
    u.nama asc;
$$;

comment on function public.get_project_leaderboard(uuid) is
  'Leaderboard proyek aman untuk penjahit: hanya menampilkan nama dan total pcs tanpa membocorkan data upah atau entri orang lain.';
