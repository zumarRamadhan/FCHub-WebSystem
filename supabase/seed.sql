-- ==============================================================================
-- FCHub — Data Seed untuk Demo (AGENTS.md Bagian 11)
-- Target: 1 Owner, 16 Penjahit, 1 Proyek (16.000 pcs, Rp500, ambang 1.500 pcs)
-- Riwayat input realistis (~2 minggu) dengan status disetujui, menunggu, dan ditolak.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. BERSIHKAN DATA DEMO (JALANKAN BILA INGIN RESET)
-- ------------------------------------------------------------------------------
DELETE FROM public.production_entries
WHERE project_id IN (SELECT id FROM public.projects WHERE nama LIKE '%Tas Spunbond Kemendikbud%');

DELETE FROM public.projects
WHERE nama LIKE '%Tas Spunbond Kemendikbud%';

DELETE FROM public.users
WHERE username IN (
  'owner', 'siti', 'budi', 'sri', 'joko', 'dewi', 'agus', 'rina', 'hendra',
  'nurul', 'bambang', 'eka', 'supriyadi', 'tri', 'rudi', 'yuni', 'dedi'
);

DELETE FROM auth.users
WHERE email LIKE '%@fchub.local';

-- ------------------------------------------------------------------------------
-- 1. PEMBUATAN AKUN AUTH & PROFIL USERS
-- Kredensial default seluruh akun demo: PIN 123456 (password hash bcrypt)
-- ------------------------------------------------------------------------------

-- 1.1 Owner (Haji Firdaus)
DO $$
DECLARE
  v_owner_id uuid := '00000000-0000-0000-0000-000000000001';
  v_project_id uuid := '00000000-0000-0000-0000-000000000100';
  v_pin_hash text := crypt('123456', gen_salt('bf'));
BEGIN
  -- Insert Auth User: Owner
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    v_owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'owner@fchub.local', v_pin_hash, now(),
    '{"provider":"email","providers":["email"]}', '{"nama":"Haji Firdaus","role":"owner"}', now(), now()
  ) ON CONFLICT (id) DO UPDATE SET encrypted_password = v_pin_hash;

  INSERT INTO public.users (id, nama, username, role, aktif)
  VALUES (v_owner_id, 'Haji Firdaus', 'owner', 'owner', true)
  ON CONFLICT (id) DO UPDATE SET nama = EXCLUDED.nama, aktif = true;

  -- Insert 16 Penjahit
  -- UUID generator deterministik: 00000000-0000-0000-0000-00000000001X .. 2X
  PERFORM 1;
END $$;

-- Masukkan 16 Penjahit ke auth.users dan public.users
WITH demo_tailors (uid, username, nama) AS (
  VALUES
    ('00000000-0000-0000-0000-000000000011'::uuid, 'siti', 'Siti Rahma'),
    ('00000000-0000-0000-0000-000000000012'::uuid, 'budi', 'Budi Santoso'),
    ('00000000-0000-0000-0000-000000000013'::uuid, 'sri', 'Sri Wahyuni'),
    ('00000000-0000-0000-0000-000000000014'::uuid, 'joko', 'Joko Susilo'),
    ('00000000-0000-0000-0000-000000000015'::uuid, 'dewi', 'Dewi Lestari'),
    ('00000000-0000-0000-0000-000000000016'::uuid, 'agus', 'Agus Prasetyo'),
    ('00000000-0000-0000-0000-000000000017'::uuid, 'rina', 'Rina Marlina'),
    ('00000000-0000-0000-0000-000000000018'::uuid, 'hendra', 'Hendra Wijaya'),
    ('00000000-0000-0000-0000-000000000019'::uuid, 'nurul', 'Nurul Hidayah'),
    ('00000000-0000-0000-0000-000000000020'::uuid, 'bambang', 'Bambang Pamungkas'),
    ('00000000-0000-0000-0000-000000000021'::uuid, 'eka', 'Eka Yuliana'),
    ('00000000-0000-0000-0000-000000000022'::uuid, 'supriyadi', 'Supriyadi'),
    ('00000000-0000-0000-0000-000000000023'::uuid, 'tri', 'Tri Mulyani'),
    ('00000000-0000-0000-0000-000000000024'::uuid, 'rudi', 'Rudi Hartono'),
    ('00000000-0000-0000-0000-000000000025'::uuid, 'yuni', 'Yuni Astuti'),
    ('00000000-0000-0000-0000-000000000026'::uuid, 'dedi', 'Dedi Kurniawan')
)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
SELECT
  uid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  username || '@fchub.local',
  crypt('123456', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  json_build_object('nama', nama, 'role', 'penjahit')::jsonb,
  now(),
  now()
FROM demo_tailors
ON CONFLICT (id) DO UPDATE SET encrypted_password = crypt('123456', gen_salt('bf'));

-- Masukkan ke public.users
WITH demo_tailors (uid, username, nama) AS (
  VALUES
    ('00000000-0000-0000-0000-000000000011'::uuid, 'siti', 'Siti Rahma'),
    ('00000000-0000-0000-0000-000000000012'::uuid, 'budi', 'Budi Santoso'),
    ('00000000-0000-0000-0000-000000000013'::uuid, 'sri', 'Sri Wahyuni'),
    ('00000000-0000-0000-0000-000000000014'::uuid, 'joko', 'Joko Susilo'),
    ('00000000-0000-0000-0000-000000000015'::uuid, 'dewi', 'Dewi Lestari'),
    ('00000000-0000-0000-0000-000000000016'::uuid, 'agus', 'Agus Prasetyo'),
    ('00000000-0000-0000-0000-000000000017'::uuid, 'rina', 'Rina Marlina'),
    ('00000000-0000-0000-0000-000000000018'::uuid, 'hendra', 'Hendra Wijaya'),
    ('00000000-0000-0000-0000-000000000019'::uuid, 'nurul', 'Nurul Hidayah'),
    ('00000000-0000-0000-0000-000000000020'::uuid, 'bambang', 'Bambang Pamungkas'),
    ('00000000-0000-0000-0000-000000000021'::uuid, 'eka', 'Eka Yuliana'),
    ('00000000-0000-0000-0000-000000000022'::uuid, 'supriyadi', 'Supriyadi'),
    ('00000000-0000-0000-0000-000000000023'::uuid, 'tri', 'Tri Mulyani'),
    ('00000000-0000-0000-0000-000000000024'::uuid, 'rudi', 'Rudi Hartono'),
    ('00000000-0000-0000-0000-000000000025'::uuid, 'yuni', 'Yuni Astuti'),
    ('00000000-0000-0000-0000-000000000026'::uuid, 'dedi', 'Dedi Kurniawan')
)
INSERT INTO public.users (id, nama, username, role, aktif)
SELECT uid, nama, username, 'penjahit', true
FROM demo_tailors
ON CONFLICT (id) DO UPDATE SET nama = EXCLUDED.nama, aktif = true;

-- ------------------------------------------------------------------------------
-- 2. PROYEK UTAMA (16.000 PCS, TARIF RP500, AMBANG REWARD 1.500 PCS)
-- ------------------------------------------------------------------------------
INSERT INTO public.projects (
  id, nama, target_pcs, tarif_per_pcs, ambang_reward, tanggal_mulai, deadline, status
) VALUES (
  '00000000-0000-0000-0000-000000000100',
  'Tas Spunbond Kemendikbud 2026',
  16000,
  500,
  1500,
  '2026-11-10',
  '2026-11-30',
  'aktif'
) ON CONFLICT (id) DO UPDATE SET
  nama = EXCLUDED.nama,
  target_pcs = EXCLUDED.target_pcs,
  tarif_per_pcs = EXCLUDED.tarif_per_pcs,
  ambang_reward = EXCLUDED.ambang_reward,
  status = EXCLUDED.status;

-- ------------------------------------------------------------------------------
-- 3. ENTRI PRODUKSI REALISTIS
-- (Didukung oleh migration 03: bypass otomatis saat dieksekusi di SQL Editor/admin)
-- ------------------------------------------------------------------------------

-- 3.1 Entri Disetujui (10-19 November 2026)
-- Siti Rahma: Total disetujui 1.620 pcs (LOLOS REWARD ⭐)
INSERT INTO public.production_entries (user_id, project_id, tanggal_kerja, qty, qty_disetujui, tarif_snapshot, status, disetujui_oleh, disetujui_pada) VALUES
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000100', '2026-11-10', 160, 160, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', '2026-11-11 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000100', '2026-11-11', 165, 165, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', '2026-11-12 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000100', '2026-11-12', 170, 170, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', '2026-11-13 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000100', '2026-11-13', 155, 155, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', '2026-11-14 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000100', '2026-11-14', 160, 160, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', '2026-11-15 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000100', '2026-11-16', 165, 165, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', '2026-11-17 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000100', '2026-11-17', 160, 160, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', '2026-11-18 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000100', '2026-11-18', 165, 165, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', '2026-11-19 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000100', '2026-11-19', 160, 160, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', '2026-11-20 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000100', '2026-11-20', 160, 160, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', '2026-11-21 08:00:00+07');

-- Budi Santoso: Total disetujui 1.540 pcs (LOLOS REWARD ⭐) + 1 entri dikoreksi
INSERT INTO public.production_entries (user_id, project_id, tanggal_kerja, qty, qty_disetujui, tarif_snapshot, status, catatan_owner, disetujui_oleh, disetujui_pada) VALUES
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000100', '2026-11-10', 150, 150, 500, 'disetujui', null, '00000000-0000-0000-0000-000000000001', '2026-11-11 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000100', '2026-11-11', 160, 160, 500, 'disetujui', null, '00000000-0000-0000-0000-000000000001', '2026-11-12 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000100', '2026-11-12', 170, 160, 500, 'disetujui', '10 pcs reject jahitan melenceng.', '00000000-0000-0000-0000-000000000001', '2026-11-13 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000100', '2026-11-13', 150, 150, 500, 'disetujui', null, '00000000-0000-0000-0000-000000000001', '2026-11-14 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000100', '2026-11-14', 155, 155, 500, 'disetujui', null, '00000000-0000-0000-0000-000000000001', '2026-11-15 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000100', '2026-11-16', 155, 155, 500, 'disetujui', null, '00000000-0000-0000-0000-000000000001', '2026-11-17 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000100', '2026-11-17', 150, 150, 500, 'disetujui', null, '00000000-0000-0000-0000-000000000001', '2026-11-18 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000100', '2026-11-18', 155, 155, 500, 'disetujui', null, '00000000-0000-0000-0000-000000000001', '2026-11-19 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000100', '2026-11-19', 150, 150, 500, 'disetujui', null, '00000000-0000-0000-0000-000000000001', '2026-11-20 08:00:00+07'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000100', '2026-11-20', 155, 155, 500, 'disetujui', null, '00000000-0000-0000-0000-000000000001', '2026-11-21 08:00:00+07');

-- Sri Wahyuni: 1.420 pcs (Mendekati ambang 1.500)
INSERT INTO public.production_entries (user_id, project_id, tanggal_kerja, qty, qty_disetujui, tarif_snapshot, status, disetujui_oleh, disetujui_pada)
SELECT
  '00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000100',
  d::date, 142, 142, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', (d + interval '1 day 8 hour')
FROM generate_series('2026-11-10'::date, '2026-11-20'::date, '1 day'::interval) d
WHERE extract(dow from d) != 0; -- lewati hari minggu

-- Joko Susilo: 1.310 pcs
INSERT INTO public.production_entries (user_id, project_id, tanggal_kerja, qty, qty_disetujui, tarif_snapshot, status, disetujui_oleh, disetujui_pada)
SELECT
  '00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000100',
  d::date, 131, 131, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', (d + interval '1 day 8 hour')
FROM generate_series('2026-11-10'::date, '2026-11-20'::date, '1 day'::interval) d
WHERE extract(dow from d) != 0;

-- Dewi Lestari: 1.220 pcs
INSERT INTO public.production_entries (user_id, project_id, tanggal_kerja, qty, qty_disetujui, tarif_snapshot, status, disetujui_oleh, disetujui_pada)
SELECT
  '00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000100',
  d::date, 122, 122, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', (d + interval '1 day 8 hour')
FROM generate_series('2026-11-10'::date, '2026-11-20'::date, '1 day'::interval) d
WHERE extract(dow from d) != 0;

-- Agus Prasetyo (1.150 pcs) & Rina Marlina (1.080 pcs)
INSERT INTO public.production_entries (user_id, project_id, tanggal_kerja, qty, qty_disetujui, tarif_snapshot, status, disetujui_oleh, disetujui_pada)
SELECT
  '00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000100',
  d::date, 115, 115, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', (d + interval '1 day 8 hour')
FROM generate_series('2026-11-10'::date, '2026-11-20'::date, '1 day'::interval) d
WHERE extract(dow from d) != 0;

INSERT INTO public.production_entries (user_id, project_id, tanggal_kerja, qty, qty_disetujui, tarif_snapshot, status, disetujui_oleh, disetujui_pada)
SELECT
  '00000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000100',
  d::date, 108, 108, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', (d + interval '1 day 8 hour')
FROM generate_series('2026-11-10'::date, '2026-11-20'::date, '1 day'::interval) d
WHERE extract(dow from d) != 0;

-- Penjahit lainnya (Hendra s.d. Dedi): Variasi bertahap 980 s.d. 430 pcs
INSERT INTO public.production_entries (user_id, project_id, tanggal_kerja, qty, qty_disetujui, tarif_snapshot, status, disetujui_oleh, disetujui_pada)
SELECT
  '00000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000100',
  d::date, 98, 98, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', (d + interval '1 day 8 hour')
FROM generate_series('2026-11-10'::date, '2026-11-20'::date, '1 day'::interval) d
WHERE extract(dow from d) != 0;

INSERT INTO public.production_entries (user_id, project_id, tanggal_kerja, qty, qty_disetujui, tarif_snapshot, status, disetujui_oleh, disetujui_pada)
SELECT
  '00000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000100',
  d::date, 92, 92, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', (d + interval '1 day 8 hour')
FROM generate_series('2026-11-10'::date, '2026-11-20'::date, '1 day'::interval) d
WHERE extract(dow from d) != 0;

INSERT INTO public.production_entries (user_id, project_id, tanggal_kerja, qty, qty_disetujui, tarif_snapshot, status, disetujui_oleh, disetujui_pada)
SELECT
  '00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000100',
  d::date, 85, 85, 500, 'disetujui', '00000000-0000-0000-0000-000000000001', (d + interval '1 day 8 hour')
FROM generate_series('2026-11-10'::date, '2026-11-20'::date, '1 day'::interval) d
WHERE extract(dow from d) != 0;

-- 3.2 Entri Menunggu Approval (Tersedia untuk Demo Approval Owner)
INSERT INTO public.production_entries (user_id, project_id, tanggal_kerja, qty, qty_disetujui, tarif_snapshot, status) VALUES
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000100', '2026-11-21', 160, null, 500, 'menunggu'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000100', '2026-11-21', 150, null, 500, 'menunggu'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000100', '2026-11-21', 140, null, 500, 'menunggu'),
  ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000100', '2026-11-21', 130, null, 500, 'menunggu'),
  ('00000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000100', '2026-11-21', 120, null, 500, 'menunggu'),
  ('00000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000100', '2026-11-21', 115, null, 500, 'menunggu'),
  ('00000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000100', '2026-11-21', 105, null, 500, 'menunggu'),
  ('00000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000100', '2026-11-21', 95, null, 500, 'menunggu'),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000100', '2026-11-20', 80, null, 500, 'menunggu'),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000100', '2026-11-20', 75, null, 500, 'menunggu');

-- 3.3 Entri Ditolak (Sampel Realistis)
INSERT INTO public.production_entries (
  user_id, project_id, tanggal_kerja, qty, qty_disetujui, tarif_snapshot, status, catatan_owner, disetujui_oleh, disetujui_pada
) VALUES
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000100', '2026-11-13', 60, null, 500, 'ditolak', 'Bahan kotor terkena oli mesin jahit, tolong potong ulang.', '00000000-0000-0000-0000-000000000001', '2026-11-14 09:00:00+07'),
  ('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000100', '2026-11-17', 70, null, 500, 'ditolak', 'Ukuran lebar lipatan tali tidak sesuai pola cetak.', '00000000-0000-0000-0000-000000000001', '2026-11-18 09:15:00+07');

-- ==============================================================================
-- SELESAI: Seed Data Demo Berhasil Dibuat
-- • Owner    : username: 'owner' | PIN: '123456'
-- • Penjahit : username: 'siti'  | PIN: '123456' (atau 'budi', 'sri', dll)
-- ==============================================================================
