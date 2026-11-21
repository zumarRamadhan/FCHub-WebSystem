# AGENTS.md — FCHub

Panduan untuk agen AI (Claude Code, Cursor, Copilot, dll.) yang mengerjakan repo ini. Baca seluruh file sebelum menulis kode. Untuk tampilan, ikuti `design.md`. Untuk kebutuhan produk, rujuk dokumen PRD FCHub.

---

## 1. Konteks proyek

**FCHub** adalah web app pencatatan produksi penjahit untuk konveksi tas kain **Firdaus Collection**.

- 15-18 penjahit, target 100 pcs per penjahit per hari.
- Proyek dari instansi bisa sampai 16.000 pcs dalam 1 bulan.
- Upah borongan per pcs (kira-kira Rp500), dibayar **tunai** tiap Sabtu. Sistem **menghitung dan mencatat status bayar tunai**, tidak memproses pembayaran (tanpa transfer atau e-wallet).
- Masalah yang diselesaikan: buku catatan ganda (penjahit dan owner) dan rekap upah manual tiap Sabtu.

**Dua peran:**

| Peran | Akses |
| --- | --- |
| `owner` | Admin penuh: proyek, penjahit, approval, rekap upah & status bayar tunai, leaderboard |
| `penjahit` | Hanya data sendiri: input, riwayat, ringkasan minggu & status bayar, leaderboard proyek |

**Alur inti:** penjahit input malam hari → owner approve keesokan hari → sistem hitung upah mingguan, progres proyek, leaderboard, dan pencatatan status bayar tunai Sabtu.

**Target saat ini:** demo hari Senin 23 November 2026. Kerjakan alur inti dulu (lihat bagian 9).

---

## 2. Tech stack

- **Next.js** (App Router) + **TypeScript** (strict)
- **Tailwind CSS** + **shadcn/ui** (tema diganti sesuai `design.md`)
- **Supabase**: Postgres, Auth, Row-Level Security
- **Vercel** untuk deploy
- Ikon: `lucide-react`
- Validasi: `zod`
- Tanpa library chart; ring dan progress dibuat dengan SVG/CSS sederhana

Jangan menambah dependency baru tanpa alasan jelas. Bila perlu, sebutkan alasannya di pesan commit atau ringkasan kerja.

---

## 3. Struktur folder (acuan)

```
app/
  (auth)/login/            # login username + PIN
  (penjahit)/              # beranda, input, riwayat, leaderboard
  (owner)/                 # dashboard, approval, rekap, proyek, penjahit
  api/                     # route handler bila diperlukan
components/
  ui/                      # komponen dasar (Card, Button, StatusBadge, ...)
  ...                      # komponen fitur
lib/
  supabase/                # client browser dan server
  wage.ts                  # SATU-SATUNYA tempat rumus upah
  format.ts                # format angka dan tanggal (id-ID)
  auth.ts                  # helper sesi dan peran
supabase/
  migrations/              # skema SQL dan kebijakan RLS
design.md
AGENTS.md
```

Ikuti struktur yang sudah ada bila repo sudah berjalan; jangan memindahkan file besar-besaran tanpa diminta.

---

## 4. Perintah

Sesuaikan bila `package.json` berbeda.

```bash
npm install
npm run dev        # server pengembangan
npm run build      # build produksi
npm run lint       # lint
npm run typecheck  # tsc --noEmit (tambahkan script bila belum ada)
```

Sebelum menyatakan pekerjaan selesai: `lint`, `typecheck`, dan `build` harus lolos.

---

## 5. Model data

Empat tabel utama. Rekap upah, progres proyek, dan leaderboard **dihitung dari `production_entries`**, sedangkan status dan riwayat pembayaran tunai mingguan dicatat di `wage_payments`.

| Tabel | Field utama |
| --- | --- |
| `users` | `id`, `nama`, `username`, `role` (`owner` / `penjahit`), `aktif` |
| `projects` | `id`, `nama`, `target_pcs`, `tarif_per_pcs`, `ambang_reward`, `tanggal_mulai`, `deadline`, `status` |
| `production_entries` | `id`, `user_id`, `project_id`, `tanggal_kerja`, `qty`, `qty_disetujui`, `tarif_snapshot`, `status` (`menunggu` / `disetujui` / `ditolak`), `catatan_owner`, `disetujui_oleh`, `disetujui_pada`, `dibuat_pada` |
| `wage_payments` | `id`, `user_id`, `periode_mulai`, `periode_selesai`, `total_pcs`, `jumlah`, `rincian` (jsonb), `status` (`dibayar` / `dibatalkan`), `catatan`, `dibayar_oleh`, `dibayar_pada`, `dibatalkan_oleh`, `dibatalkan_pada`, `alasan_batal` |

Catatan:

- `qty` = angka dari penjahit. `qty_disetujui` = angka akhir setelah koreksi owner (null selama belum disetujui).
- Login memakai **username + PIN**. Di Supabase Auth, petakan username ke email internal (misal `username@fchub.local`) dan PIN sebagai password. Jangan menyimpan PIN mentah di tabel mana pun.
- Semua perubahan skema lewat file di `supabase/migrations/`, bukan perubahan manual di dashboard.

---

## 6. Aturan bisnis (WAJIB)

Aturan ini adalah inti sistem. Jangan dilanggar atau diubah tanpa persetujuan eksplisit.

1. **Hanya input berstatus `disetujui` yang dihitung** ke upah, progres proyek, dan leaderboard. Input `menunggu` dan `ditolak` tidak pernah dihitung.
2. **Upah = `qty_disetujui` × `tarif_snapshot`**. `tarif_snapshot` disalin dari `projects.tarif_per_pcs` saat entri dibuat. Mengubah tarif proyek **tidak boleh** mengubah entri yang sudah ada.
3. **Rumus upah hanya ada di `lib/wage.ts`** (dan padanan SQL view/function bila dibuat). Jangan menulis ulang rumus di komponen.
4. **Koreksi jumlah oleh owner**: simpan `qty` asli, `qty_disetujui` baru, serta `disetujui_oleh` dan `disetujui_pada`. Jangan menimpa `qty` asli.
5. **Input ditolak** tidak dihitung; penjahit membuat entri baru, bukan mengedit yang ditolak.
6. **Input `disetujui`** tidak bisa diubah penjahit; hanya owner.
7. **Penjahit boleh mengubah atau menghapus entri sendiri hanya selama `menunggu`.**
8. **Penjahit hanya melihat data miliknya sendiri.** Leaderboard hanya menampilkan nama dan total pcs disetujui.
9. **Penanda reward**: muncul bila total `qty_disetujui` seorang penjahit pada satu proyek mencapai `ambang_reward`. Pemberian reward adalah keputusan owner; sistem hanya menandai.
10. **Rekap mingguan** dihitung dari `tanggal_kerja`. Batas awal dan akhir minggu belum dikonfirmasi ke owner; jadikan konfigurasi di satu tempat (konstanta atau pengaturan), jangan di-hardcode tersebar.
11. **Pembayaran dicatat sebagai riwayat di tabel `wage_payments`**. Tidak boleh di-update atau di-delete langsung; pembatalan hanya lewat fungsi dengan alasan wajib, dan catatannya tetap ada (status `'dibatalkan'`).
12. **Setiap pembayaran menyimpan salinan angka saat dibayar**: `total_pcs`, `jumlah` (rupiah), dan `rincian` per proyek (`jsonb`). Angka ini tidak berubah walau entri dikoreksi kemudian.
13. **Status minggu per penjahit** dihitung dengan membandingkan `upah_saat_ini` (dari entri disetujui, `qty_disetujui × tarif_snapshot`) dengan total pembayaran aktif (`status = 'dibayar'`): `Belum dibayar`, `Lunas`, `Kurang bayar` (upah naik setelah dibayar), `Lebih bayar` (upah turun setelah dibayar), `Tanpa upah`.
14. **"Tandai dibayar" membayar SISA** (`upah_saat_ini` dikurangi total pembayaran aktif), hanya bila sisa > 0, dieksekusi atomik di database dengan advisory lock (`pg_advisory_xact_lock`) agar klik ganda atau dua owner tidak membuat catatan ganda. Tidak ada pembayaran dengan nominal bebas.
15. **Hanya owner yang boleh membuat atau membatalkan pembayaran**; penjahit hanya boleh melihat catatan miliknya.

Pertanyaan yang masih terbuka (jangan berasumsi di kode tanpa menandainya dengan `TODO(owner)`): apakah ada tahap kerja dengan tarif berbeda, apakah tarif sama untuk semua penjahit dalam satu proyek, apakah satu penjahit boleh input lebih dari sekali sehari.

---

## 7. Keamanan

- **Aktifkan RLS di semua tabel.** Kebijakan minimal:
  - `penjahit`: `select`/`insert` pada `production_entries` miliknya sendiri; `update`/`delete` hanya saat `status = 'menunggu'` dan `user_id = auth.uid()`.
  - `owner`: akses penuh ke semua tabel.
  - Penjahit tidak bisa mengubah kolom `status`, `qty_disetujui`, `tarif_snapshot`, `disetujui_oleh`, `disetujui_pada`.
- `tarif_snapshot` diisi di sisi server (trigger atau function), **bukan** dari input klien.
- Kunci `service_role` hanya dipakai di server dan tidak pernah dikirim ke browser atau di-commit.
- Simpan rahasia di environment variable (`.env.local`), sediakan `.env.example` tanpa nilai asli.
- Validasi semua input di server dengan `zod` (qty bilangan bulat positif, batas wajar, proyek aktif).
- Jangan mencatat PIN atau token di log.

---

## 8. Konvensi kode

- TypeScript strict; tanpa `any` kecuali dengan komentar alasan.
- Server Components secara default; `"use client"` hanya bila perlu interaksi.
- Pengambilan dan perubahan data lewat Server Actions atau route handler dengan pemeriksaan peran di server. Jangan hanya mengandalkan penyembunyian UI.
- Nama berkas `kebab-case`, komponen `PascalCase`, fungsi dan variabel `camelCase`.
- Identifier kode dalam bahasa Inggris; **teks antarmuka dalam bahasa Indonesia**.
- Format: angka `16.000`, mata uang `Rp5.000.000`, tanggal `21 Nov 2026` (locale `id-ID`) lewat `lib/format.ts`.
- Zona waktu `Asia/Jakarta` untuk menentukan "hari ini" dan batas minggu.
- Komponen kecil dan fokus; hindari file lebih dari sekitar 250 baris.
- Tangani state loading, kosong, dan error di setiap halaman data.
- Pesan error untuk pengguna singkat dan jelas, tanpa istilah teknis.

---

## 9. Prioritas dan scope

**Demo Senin (kerjakan sesuai urutan):**

1. Setup proyek, auth dua peran, login username + PIN
2. Kelola proyek dan penjahit (owner)
3. Form input harian (penjahit)
4. Halaman approval (owner): setujui, tolak dengan catatan, koreksi jumlah, "Setujui semua"
5. Rekap upah mingguan, progres proyek, leaderboard
6. Seed data dummy realistis: 16 penjahit, 1 proyek 16.000 pcs, beberapa minggu riwayat
7. Poles tampilan HP

**Setelah demo:** cetak slip dan export Excel/PDF, riwayat perubahan lengkap, PWA, mode offline.

**Pencatatan status pembayaran:** pencatatan tanda bayar tunai Sabtu, deteksi lunas/kurang/lebih bayar, dan riwayat pembatalan masuk dalam scope sistem FCHub.

**Di luar scope:** pemrosesan pembayaran otomatis/elektronik (transfer bank, payment gateway, e-wallet; pembayaran tetap dilakukan secara tunai di luar sistem), absensi, stok bahan, keuangan konveksi, multi-owner, aplikasi native.

Jangan membangun fitur di luar daftar ini tanpa diminta.

---

## 10. UI dan UX

- Ikuti `design.md` untuk warna, tipografi, komponen, dan layout. Jangan menambah warna aksen baru.
- **Mobile-first**: rancang untuk layar 360-390px dulu.
- Alur input penjahit maksimal 3 ketukan: buka, isi angka, kirim. Kolom jumlah memakai `inputmode="numeric"`.
- Target sentuh minimal 44 x 44px; kontras teks minimal 4.5:1.
- Status selalu memakai ikon dan teks, bukan warna saja.

---

## 11. Data seed

Sediakan `supabase/seed.sql` (atau script seed) untuk demo:

- 1 owner, 16 penjahit dengan nama Indonesia yang wajar
- 1 proyek target 16.000 pcs, tarif Rp500 per pcs, ambang reward 1.500 pcs
- Riwayat input beberapa hari dengan campuran status; sebagian besar `disetujui`, beberapa `menunggu`, sedikit `ditolak`
- Distribusi pcs per penjahit bervariasi agar leaderboard terlihat hidup, dan beberapa melewati ambang reward
- Data ini hanya untuk demo dan tidak boleh memakai nama atau PIN orang sungguhan

---

## 12. Cara bekerja

1. Baca bagian yang relevan di file ini, `design.md`, dan PRD sebelum mengubah kode.
2. Kerjakan perubahan kecil dan bertahap; satu fitur per commit bila memungkinkan.
3. Bila permintaan bertentangan dengan aturan bisnis di bagian 6, berhenti dan tanyakan.
4. Bila ada informasi bisnis yang belum jelas, beri `TODO(owner)` dan lanjutkan dengan asumsi paling aman, lalu sebutkan asumsinya di ringkasan.
5. Jangan menghapus data, migrasi, atau berkas tanpa diminta.
6. Setelah selesai, jalankan `lint`, `typecheck`, `build`, lalu ringkas: apa yang berubah, apa yang diasumsikan, dan apa yang belum selesai.
7. Jangan mengklaim sesuatu sudah berjalan bila belum dijalankan atau diuji.
