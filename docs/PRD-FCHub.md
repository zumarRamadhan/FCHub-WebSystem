# PRD FCHub — Sistem Pencatatan Produksi Firdaus Collection
Nov 21, 2026 · @Cortexpix

## Ringkasan & latar belakang
FCHub adalah web app pencatatan hasil produksi penjahit Firdaus Collection yang menggantikan buku catatan ganda (buku penjahit dan buku owner) dan menghitung upah borongan mingguan secara otomatis.

## Konteks bisnis
Firdaus Collection adalah konveksi tas kain dengan 15-18 penjahit.
Target tiap penjahit 100 pcs per hari.
Proyek utama berasal dari instansi, dengan jumlah pesanan hingga 16.000 pcs yang dikerjakan dalam 1 bulan.
Upah borongan per pcs (kira-kira Rp500), dibayar tunai setiap Sabtu setelah buku dikumpulkan ke owner.
Di akhir proyek, owner biasa memberi reward kepada penjahit dengan hasil terbanyak (misalnya di atas 1.500 pcs).

## Masalah saat ini
Penjahit dan owner mencatat di buku masing-masing, lalu mencocokkan dan menghitung upah secara manual setiap Sabtu.
Riwayat produksi per penjahit sulit dilihat, sehingga reward akhir proyek dihitung dari tumpukan buku.
Progres proyek (sudah berapa dari 16.000 pcs) tidak bisa dipantau harian.

## Solusi
Penjahit menginput hasil kerja pada malam hari, owner menyetujuinya keesokan hari, lalu sistem menghitung upah mingguan, progres proyek, dan leaderboard. Pembayaran tetap tunai di luar sistem; FCHub hanya untuk pencatatan dan kalkulasi.

## Tujuan & metrik keberhasilan
Tujuan utama: owner tidak lagi menghitung upah dari dua set buku, dan progres proyek terlihat setiap hari. Angka pada kolom ukuran adalah target awal yang bisa disesuaikan setelah uji coba.

| Tujuan | Ukuran keberhasilan |
| --- | --- |
| Menghapus buku ganda | Setelah masa uji, penjahit dan owner hanya memakai FCHub untuk pencatatan |
| Rekap upah mingguan cepat | Rekap seluruh penjahit tampil dalam satu halaman pada hari Sabtu, tanpa hitung manual |
| Progres proyek terpantau | Total pcs disetujui dibandingkan target proyek (misal dari 16.000 pcs) terlihat setiap hari |
| Reward akhir proyek transparan | Leaderboard per proyek bisa dilihat penjahit dan owner, dengan penanda ambang reward |
| Mudah dipakai penjahit | Input hasil kerja selesai dalam maksimal 3 ketukan, tanpa pelatihan panjang |

## Pengguna & peran
FCHub punya dua peran: Owner yang juga bertindak sebagai admin, dan Penjahit.

| Peran | Siapa | Kebutuhan utama | Hak akses |
| --- | --- | --- | --- |
| Owner (admin) | Pemilik Firdaus Collection | Memantau produksi, menyetujui input, menghitung upah mingguan, menentukan reward | Seluruh data: proyek, penjahit, input, rekap |
| Penjahit | 15-18 penjahit | Mencatat hasil kerja harian, melihat total dan estimasi upah, melihat posisi di leaderboard | Hanya data milik sendiri, ditambah leaderboard proyek |

Owner memegang administrasi langsung, jadi tidak ada peran admin terpisah pada versi awal.

## Ruang lingkup
Versi demo hari Senin hanya memuat alur inti: input, approval, rekap upah, dan leaderboard.

### Masuk versi demo
- Login penjahit dan owner
- Kelola proyek dan data penjahit
- Input hasil kerja harian oleh penjahit
- Approval harian oleh owner
- Rekap upah mingguan
- Progres proyek dan leaderboard

### Setelah demo (versi pakai)
- Cetak slip upah mingguan
- Export rekap ke Excel atau PDF
- Koreksi dan jejak perubahan yang lebih lengkap
- Install sebagai PWA di HP penjahit
- Mode offline bila sinyal di konveksi tidak stabil

### Tidak masuk
- Pembayaran upah (tetap tunai, di luar sistem)
- Absensi kehadiran, stok bahan, dan keuangan konveksi
- Banyak owner atau banyak cabang
- Aplikasi native Android atau iOS

## Alur kerja utama
Penjahit input pada malam hari, owner menyetujui keesokan harinya, dan upah dibayar tunai setiap Sabtu.
Hanya input yang disetujui owner masuk ke upah dan leaderboard.

## Kebutuhan fungsional: Penjahit
Penjahit mengakses FCHub dari HP, jadi seluruh fitur dirancang untuk layar kecil dan input singkat.

| ID | Kebutuhan | Rilis |
| --- | --- | --- |
| P1 | Login dengan username dan PIN, tanpa email | Demo |
| P2 | Input hasil kerja: pilih proyek, isi jumlah pcs; tanggal otomatis hari ini dan bisa diubah ke hari sebelumnya bila lupa input | Demo |
| P3 | Kolom jumlah memakai keypad angka | Demo |
| P4 | Riwayat input dengan status Menunggu, Disetujui, atau Ditolak beserta catatan owner | Demo |
| P5 | Ubah atau hapus input selama masih berstatus Menunggu | Demo |
| P6 | Ringkasan minggu berjalan: total pcs disetujui dan estimasi upah | Demo |
| P7 | Leaderboard proyek: peringkat dan total pcs disetujui | Demo |

## Kebutuhan fungsional: Owner
Owner memakai FCHub terutama untuk approval harian dan rekap upah mingguan.

| ID | Kebutuhan | Rilis |
| --- | --- | --- |
| O1 | Login owner | Demo |
| O2 | Kelola proyek: nama, target total pcs, tanggal mulai dan deadline, tarif per pcs, ambang reward | Demo |
| O3 | Kelola penjahit: nama, username, reset PIN, status aktif atau nonaktif | Demo |
| O4 | Antrean approval: daftar input berstatus Menunggu per tanggal; setujui, tolak dengan catatan, atau koreksi jumlah | Demo |
| O5 | Tombol "Setujui semua" untuk input yang tidak perlu diubah | Demo |
| O6 | Rekap upah mingguan per penjahit: total pcs disetujui, tarif, dan upah yang harus dibayar | Demo |
| O7 | Dashboard proyek: total pcs disetujui dibandingkan target, serta jumlah input yang menunggu | Demo |
| O8 | Leaderboard proyek dengan penanda penjahit yang sudah melewati ambang reward | Demo |
| O9 | Cetak slip upah dan export rekap ke Excel atau PDF | Setelah demo |
| O10 | Riwayat perubahan lengkap: siapa mengubah apa dan kapan | Setelah demo |

## Aturan bisnis
Aturan berikut menggantikan fungsi buku owner dan mencegah sengketa upah.
- Hanya input berstatus Disetujui yang dihitung ke upah, progres proyek, dan leaderboard.
- Upah = jumlah pcs disetujui × tarif per pcs. Tarif disalin ke setiap input saat input dibuat, sehingga perubahan tarif proyek di kemudian hari tidak mengubah rekap yang lama.
- Bila owner mengoreksi jumlah, sistem menyimpan jumlah asli, jumlah akhir, serta siapa dan kapan koreksi dilakukan.
- Input yang ditolak tidak dihitung; penjahit dapat membuat input baru.
- Input yang sudah disetujui hanya bisa diubah oleh owner.
- Penjahit hanya melihat data miliknya sendiri; leaderboard hanya menampilkan nama dan total pcs.
- Penanda reward muncul saat total pcs disetujui seorang penjahit pada satu proyek mencapai ambang. Pemberian reward tetap keputusan owner.
- Rekap mingguan dihitung dari tanggal kerja pada input; batas awal dan akhir minggu perlu dikonfirmasi ke owner (lihat bagian Risiko).

## Model data
Model data cukup tiga tabel. Rekap upah, progres proyek, dan leaderboard dihitung dari tabel input, tidak disimpan terpisah.

| Tabel | Field utama | Catatan |
| --- | --- | --- |
| users | id, nama, username, pin_hash, role (owner atau penjahit), aktif | Role menentukan hak akses |
| projects | id, nama, target_pcs, tarif_per_pcs, ambang_reward, tanggal_mulai, deadline, status | Satu proyek bisa berjalan bersamaan dengan proyek lain |
| production_entries | id, user_id, project_id, tanggal_kerja, qty, qty_disetujui, tarif_snapshot, status (menunggu, disetujui, ditolak), catatan_owner, disetujui_oleh, disetujui_pada, dibuat_pada | qty adalah angka dari penjahit; qty_disetujui adalah angka akhir setelah koreksi owner |

Satu penjahit punya banyak input, dan satu proyek punya banyak input. Upah dihitung dari qty_disetujui × tarif_snapshot pada input berstatus disetujui.

## Kebutuhan non-fungsional & UX
- Mobile-first: layout dirancang untuk layar HP lebih dulu, lalu dilebarkan untuk laptop owner.
- Input singkat: buka, isi angka, kirim; maksimal 3 ketukan dan keypad angka muncul otomatis.
- Mudah dibaca: tombol dan kolom besar, teks kontras tinggi agar terbaca di ruangan yang kurang terang.
- Keamanan: PIN disimpan dalam bentuk hash, penjahit hanya bisa mengakses data miliknya sendiri (row-level security), dan akses lewat HTTPS.
- Skala: belasan pengguna dan kurang dari seribu input per bulan bila tiap penjahit input sekali sehari, sehingga tidak perlu optimasi khusus.
- Ketersediaan: butuh koneksi internet saat input; mode offline direncanakan setelah demo bila sinyal di konveksi bermasalah.
- Data: backup otomatis dari penyedia database.

## Tech stack & arsitektur
FCHub memakai Next.js untuk tampilan dan logika, Supabase untuk database dan login, serta Vercel untuk hosting.

## Rencana rilis & timeline
Demo Senin 23 November memakai alur inti yang selesai akhir pekan ini; versi pakai menyusul sekitar 3-5 hari sesudahnya.

## Risiko & pertanyaan terbuka
- Penjahit kurang terbiasa memakai aplikasi: UI sederhana, pendampingan minggu pertama, buku lama tetap dipakai paralel sebentar.
- Sinyal di konveksi tidak stabil: Cek kondisi sinyal; siapkan mode offline setelah demo.
- Angka yang diinput tidak sesuai kenyataan: Approval owner dan jejak koreksi.
- Waktu menuju demo singkat: Scope demo dikunci pada alur inti, data dummy realistis.
- Penjahit lupa PIN: Owner bisa mereset PIN.

### Pertanyaan untuk dikonfirmasi ke owner
- Apakah satu penjahit mengerjakan satu tas dari awal sampai selesai, atau ada tahap (potong, jahit, obras) dengan tarif berbeda?
- Minggu upah dihitung dari hari apa sampai hari apa?
- Apakah tarif per pcs sama untuk semua penjahit dalam satu proyek?
- Apakah ambang reward berbeda untuk tiap proyek?
- Apakah semua penjahit punya HP sendiri, dan apakah sinyal di konveksi stabil?
- Bolehkah satu penjahit input lebih dari sekali sehari atau untuk beberapa proyek sekaligus?
