# Panduan Migrasi Database & Verifikasi RLS — FCHub

Dokumen ini berisi panduan menjalankan migrasi database Supabase dan memverifikasi aturan keamanan serta Row-Level Security (RLS) untuk sistem FCHub (Firdaus Collection).

---

## 1. Urutan Menjalankan Migration di Supabase SQL Editor

Jalankan berkas migrasi di menu **SQL Editor** pada Supabase Dashboard secara berurutan:

1. **`supabase/migrations/20261121000001_initial_schema.sql`**
   - Membuat ekstensi UUID
   - Membuat tabel `public.users`, `public.projects`, dan `public.production_entries`
   - Membuat fungsi `public.is_owner()` (security definer)
   - Membuat trigger `trg_production_entries_before_insert` (pengisian tarif otomatis, pemaksaan status menunggu, dan proteksi `user_id`)
   - Membuat trigger `trg_production_entries_before_update` (proteksi status penjahit, pengisian otomatis `disetujui_oleh`/`disetujui_pada`, dan perlindungan `qty` asli penjahit)
   - Mengaktifkan Row-Level Security (RLS) di seluruh tabel beserta kebijakannya.

2. **`supabase/migrations/20261121000002_views_and_functions.sql`**
   - Membuat fungsi pembatas siklus minggu upah: `public.get_week_start()` dan `public.get_week_end()`
   - Membuat view `public.v_project_progress` (security_invoker = true)
   - Membuat view `public.v_leaderboard` (security_invoker = true)
   - Membuat view `public.v_weekly_wage` (security_invoker = true)
   - Membuat fungsi aman `public.get_project_leaderboard(p_project_id)` (security definer) untuk akses penjahit tanpa membocorkan upah orang lain.

3. **`supabase/migrations/20261121000003_trigger_bypass.sql`**
   - Memperbarui trigger `trg_production_entries_before_insert` dan `before_update` agar melewati paksaan peran saat `auth.uid() IS NULL` (service_role atau SQL Editor).
   - Memperbarui kebijakan RLS INSERT dan UPDATE penjahit di `production_entries` agar mensyaratkan `users.aktif = true`.

---

## 2. Pemetaan Aturan Bisnis ke Objek Database

| No | Aturan Bisnis (AGENTS.md Bagian 6) | Implementasi Database |
| :--- | :--- | :--- |
| **1** | Hanya input `disetujui` yang dihitung ke upah, progres, & leaderboard | Filter `status = 'disetujui'` di seluruh view (`v_project_progress`, `v_leaderboard`, `v_weekly_wage`). |
| **2** | Upah = `qty_disetujui × tarif_snapshot` | Trigger INSERT menyalin `tarif_per_pcs` ke `tarif_snapshot`. Perhitungan upah memakai formula ini. |
| **3** | Nilai `tarif_snapshot` tidak boleh dari input klien | Trigger BEFORE INSERT memaksa snapshot dari tabel `projects`. Update trigger mengunci nilai agar tidak bisa diubah. |
| **4** | Koreksi jumlah oleh owner tidak boleh menimpa `qty` asli | Trigger BEFORE UPDATE memaksa `NEW.qty := OLD.qty`. Angka koreksi disimpan di `qty_disetujui`. |
| **5** | Penjahit hanya bisa ubah/hapus saat status `menunggu` | Kebijakan RLS (UPDATE & DELETE) membatasi `status = 'menunggu' AND user_id = auth.uid()`. |
| **6** | Penjahit tidak bisa ubah entri `disetujui` atau `ditolak` | RLS + Trigger BEFORE UPDATE melempar exception bila penjahit mengubah entri non-menunggu. |
| **7** | Penjahit tidak bisa manipulasi status approval | Trigger BEFORE UPDATE menolak update kolom approval (`status`, `qty_disetujui`, dll.) dari non-owner. |
| **8** | Penjahit hanya melihat data miliknya sendiri | RLS `user_id = auth.uid()`. Leaderboard publik memakai fungsi `get_project_leaderboard()` yang menyembunyikan nominal upah. |
| **9** | Penanda reward saat `total_pcs >= ambang_reward` | Kolom terhitung `melewati_ambang_reward` di view dan fungsi leaderboard. |
| **10** | Rekap mingguan dihitung dari `tanggal_kerja` | Fungsi `get_week_start()` & `get_week_end()` dengan tag `TODO(owner)`. |

---

## 3. Matriks Hak Akses ("Siapa Boleh Apa")

| Objek | Operasi | Penjahit | Owner |
| :--- | :--- | :--- | :--- |
| **`public.users`** | SELECT | Hanya baris sendiri (`id = auth.uid()`) | Semua pengguna |
| | INSERT / UPDATE / DELETE | ❌ Ditolak RLS | ✅ Penuh |
| **`public.projects`** | SELECT | Hanya proyek aktif (`status = 'aktif'`) | Semua proyek (aktif/selesai/arsip) |
| | INSERT / UPDATE / DELETE | ❌ Ditolak RLS | ✅ Penuh |
| **`public.production_entries`** | SELECT | Hanya entri miliknya (`user_id = auth.uid()`) | Semua entri seluruh penjahit |
| | INSERT | ✅ Entri sendiri (status otomatis dipaksa `menunggu`) | ✅ Penuh |
| | UPDATE | ✅ Hanya saat `menunggu` (hanya boleh edit `qty` & `tanggal_kerja`) | ✅ Penuh (approval, koreksi `qty_disetujui`, catatan) |
| | DELETE | ✅ Hanya saat `menunggu` | ✅ Penuh |
| **`v_project_progress`** | SELECT | Menghitung progres dari entri yang bisa dibaca | Melihat progres total seluruh konveksi |
| **`v_weekly_wage`** | SELECT | Hanya rekap upah miliknya sendiri | Rekap upah seluruh penjahit |
| **`get_project_leaderboard()`** | EXECUTE | ✅ Melihat peringkat & total pcs (upah disembunyikan) | ✅ Penuh |

---

## 4. Skrip Pengujian Manual di SQL Editor

Gunakan blok pengujian berikut di SQL Editor untuk memverifikasi proteksi RLS dan trigger secara langsung:

```sql
-- ==============================================================================
-- PENGUJIAN 1: Simulasi Akses Penjahit
-- Ganti 'UUID-PENJAHIT-1' dengan auth.uid() penjahit yang ada
-- ==============================================================================

-- 1. Set sesi sebagai penjahit
set local role authenticated;
set local "request.jwt.claim.sub" to 'UUID-PENJAHIT-1';

-- 2. Cek apakah hanya bisa melihat data sendiri (Harus hanya menghasilkan data penjahit 1)
select * from public.production_entries;

-- 3. Coba bypass status menjadi 'disetujui' saat insert (Harus dipaksa 'menunggu' oleh trigger)
insert into public.production_entries (project_id, qty, status, tarif_snapshot)
values ('UUID-PROYEK-AKTIF', 80, 'disetujui', 999999);

-- 4. Verifikasi tarif_snapshot dan status entri yang baru diinput
select id, qty, qty_disetujui, tarif_snapshot, status
from public.production_entries
where project_id = 'UUID-PROYEK-AKTIF'
order by dibuat_pada desc limit 1;
-- Ekspektasi: status = 'menunggu', tarif_snapshot = tarif asli proyek (bukan 999999), qty_disetujui = null

-- 5. Coba ubah status menjadi disetujui (Harus ERROR: Ditolak oleh trigger/RLS)
update public.production_entries
set status = 'disetujui'
where user_id = 'UUID-PENJAHIT-1';

-- ==============================================================================
-- PENGUJIAN 2: Simulasi Koreksi Jumlah oleh Owner
-- Ganti 'UUID-OWNER' dengan auth.uid() owner
-- ==============================================================================

set local role authenticated;
set local "request.jwt.claim.sub" to 'UUID-OWNER';

-- Owner menyetujui dengan koreksi: qty asli penjahit 100, owner setujui 90
update public.production_entries
set status = 'disetujui',
    qty_disetujui = 90,
    catatan_owner = 'Koreksi 10 pcs reject bahan cacat'
where id = 'UUID-ENTRI-UJI';

-- Verifikasi Aturan #4: qty asli tidak boleh ditimpa
select qty, qty_disetujui, status, catatan_owner, disetujui_oleh, disetujui_pada
from public.production_entries
where id = 'UUID-ENTRI-UJI';
-- Ekspektasi: qty tetap 100 (asli), qty_disetujui = 90, disetujui_oleh = UUID-OWNER, disetujui_pada terisi otomatis
```

---

## 5. Data Seed Demo & Cara Menghapusnya (AGENTS.md Bagian 11)

Tersedia dua opsi untuk menyiapkan data demo:

### Opsi A (Rekomendasi via Node.js Script)
Jalankan script otomatis menggunakan kunci `service_role` di `.env.local`:
```bash
# Menyiapkan data demo lengkap (1 Owner, 16 Penjahit, 1 Proyek 16.000 pcs, ~150 riwayat entri)
node scripts/seed-demo.mjs

# Hanya membersihkan/menghapus data demo
node scripts/seed-demo.mjs --clean
```

### Opsi B (via Supabase SQL Editor)
1. Salin seluruh isi berkas `supabase/seed.sql`.
2. Tempel dan jalankan di menu **SQL Editor** Supabase Dashboard.
3. Untuk menghapus data demo secara manual lewat SQL Editor:
```sql
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
```

### Kredensial Login Akun Demo:
- **Owner**: Username `owner` | PIN `123456`
- **Penjahit**: Username `siti` | PIN `123456` (atau `budi`, `sri`, `joko`, `dewi`, dll.)

