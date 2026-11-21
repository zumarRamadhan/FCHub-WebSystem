# FCHub — Design Guide

Panduan visual frontend FCHub (sistem pencatatan produksi penjahit Firdaus Collection). Gaya mengacu pada referensi dashboard keuangan: kartu putih bersudut besar di atas latar abu kehijauan, satu aksen hijau lime, tombol dan pill hijau tua, angka besar yang jadi fokus.

> Semua nilai warna di bawah adalah perkiraan dari gambar referensi. Sesuaikan lewat variabel CSS di satu tempat (lihat bagian Implementasi).

---

## 1. Prinsip visual

1. **Angka adalah pahlawan.** Total pcs, upah, dan progres ditampilkan besar dan tebal; label di sekitarnya kecil dan redup.
2. **Satu aksen.** Hijau lime hanya untuk hal yang penting (kartu utama, progres, tombol aksi utama, penanda reward). Selebihnya putih, abu, dan hijau tua.
3. **Kartu, bukan tabel.** Informasi dibagi ke kartu bersudut besar dengan jarak lega. Tabel hanya untuk rekap upah di layar lebar.
4. **Mobile-first.** Penjahit memakai HP. Semua kartu menumpuk satu kolom, tombol besar, jempol mudah menjangkau aksi utama.
5. **Tenang dan bersih.** Tanpa gradien tebal, tanpa bayangan berat, tanpa dekorasi yang tidak membawa informasi.

---

## 2. Design tokens

### Warna

| Token | Nilai | Pemakaian |
| --- | --- | --- |
| `--bg` | `#F2F4EF` | Latar halaman |
| `--surface` | `#FFFFFF` | Kartu biasa |
| `--surface-muted` | `#F6F8F3` | Panel dalam kartu, track progress |
| `--lime-500` | `#B6F36A` | Kartu utama, tab aktif, tombol bulat aksi |
| `--lime-400` | `#A3E84F` | Isi progress bar dan ring |
| `--lime-100` | `#E8FAD0` | Chip tipis, latar badge sukses |
| `--forest-900` | `#12331C` | Tombol primer, pill gelap, teks di atas lime |
| `--ink` | `#0F1A12` | Teks utama dan angka besar |
| `--muted` | `#7A857C` | Label, caption, ikon pasif |
| `--line` | `#E6EAE3` | Garis pemisah dan border tipis |
| `--positive` | `#1F9D55` | Angka naik, status disetujui |
| `--negative` | `#E5484D` | Angka turun, status ditolak |
| `--warning` | `#F5A524` | Status menunggu |

Pemetaan status input:

| Status | Warna badge | Ikon |
| --- | --- | --- |
| Menunggu | latar `warning` 15%, teks `warning` gelap | `Clock` |
| Disetujui | latar `lime-100`, teks `positive` | `Check` |
| Ditolak | latar `negative` 12%, teks `negative` | `X` |

Kontras: teks di atas `lime-500` selalu `forest-900`, bukan putih.

### Tipografi

- Font: **Plus Jakarta Sans** (alternatif: Urbanist, Outfit) lewat `next/font/google`.
- Angka memakai `font-variant-numeric: tabular-nums`.

| Peran | Ukuran / tinggi baris | Berat |
| --- | --- | --- |
| Angka hero | 44 / 52 (mobile 36 / 44) | 600 |
| Angka kartu | 28 / 34 | 600 |
| Judul halaman (sapaan) | 24 / 32 | 600 |
| Judul kartu | 16 / 24 | 600 |
| Isi | 14 / 22 | 400 |
| Label dan caption | 12 / 16 | 500, warna `muted` |

### Bentuk dan jarak

| Token | Nilai |
| --- | --- |
| Radius kartu | 24px |
| Radius panel dalam | 16px |
| Radius input dan tombol | 14px (tombol utama bisa pill penuh) |
| Radius pill dan badge | 999px |
| Padding kartu | 20px (mobile), 24px (desktop) |
| Jarak antar kartu | 12px (mobile), 16px (desktop) |
| Bayangan | `0 1px 2px rgba(15,26,18,0.04)`; tanpa bayangan besar |
| Target sentuh minimum | 44 x 44px |

---

## 3. Komponen

**Card**: latar `surface`, radius 24, padding 20-24. Header kartu = ikon dalam kotak 36px bersudut 12 di kiri, judul di sebelahnya, menu `...` atau chip pilihan (misal bulan) di kanan.

**Card Aksen (lime)**: latar `lime-500`, teks `forest-900`. Hanya satu per layar. Boleh ada pola garis tipis atau ikon bintang transparan di pojok kanan atas sebagai dekorasi halus.

**Tab pill (navigasi atas desktop)**: deretan teks; tab aktif berupa pill `lime-500` dengan teks `forest-900`, tab lain teks `muted`.

**Bottom nav (mobile)**: 4 item (ikon + label 12px), item aktif memakai pill `lime-500`. Tinggi 64px, latar `surface`, radius atas 24.

**Tombol**

| Jenis | Gaya |
| --- | --- |
| Primer | Latar `forest-900`, teks putih, tinggi 48, pill |
| Sekunder | Border `line`, latar putih, teks `ink` |
| Aksi bulat | Lingkaran 64px `lime-500`, ikon panah `forest-900` (pengganti tombol kirim/ke detail) |
| Ikon kecil | Lingkaran 36px, ikon centang (setujui) dan X (tolak) di daftar approval |

**Segmented pill**: dua sampai tiga opsi dalam wadah `surface-muted`, opsi aktif berlatar putih atau `forest-900`. Dipakai untuk memilih tanggal kerja (Hari Ini / Kemarin / Kustom) dan filter rentang minggu rekap upah.

**Dropdown pemilih proyek (<select>)**: elemen `<select>` native dengan `appearance: none` dan ikon `ChevronDown` di kanan, sehingga di HP membuka pemilih bawaan perangkat (native picker). Tinggi minimal 56px, radius 14px, latar `surface-muted`, border `line`, teks 16px (mencegah zoom otomatis pada iOS), dan memotong nama proyek panjang dengan ellipsis satu baris. Dipakai khusus untuk memilih proyek di formulir Input penjahit.

**Badge status**: pill kecil (tinggi 24, teks 12/500) sesuai pemetaan status.

**Progress bar**: track `surface-muted` tinggi 8, isi `lime-400`, label persentase dalam pill `forest-900` kecil di ujung isi (seperti penanda 51% pada referensi).

**Ring progress**: SVG sederhana, tebal 14, track `surface-muted`, isi `lime-400`, angka di tengah (misal pcs hari ini), chip perubahan di bawahnya.

**Daftar item (riwayat dan approval)**: ikon bulat 40px di kiri, dua baris teks (judul 14/600, keterangan 12 `muted`), nilai di kanan (`positive` atau `negative` untuk selisih). Pemisah garis `line` tipis.

**Input angka besar**: kolom tinggi 72, angka 36/600 di tengah, `inputmode="numeric"`, tombol `-` dan `+` bulat di kedua sisi.

**Chip info**: pill tipis `lime-100` dengan teks `positive` kecil, contoh "+40% bulan ini" atau "Di atas ambang reward".

---

## 4. Layout halaman

### Grid

- Desktop (>= 1024px): 12 kolom, jarak 16, lebar konten maksimum 1200.
  - Baris atas: kartu hero (8 kolom) + kartu aksen lime (4 kolom).
  - Baris bawah: tiga kartu (4 kolom masing-masing).
- Tablet (640-1023px): 2 kolom, kartu hero memenuhi lebar.
- Mobile (< 640px): satu kolom, bottom nav tetap di bawah, konten diberi padding bawah 88px.

### Header

Sapaan "Halo, {nama}" di kiri (24/600 dengan avatar bulat), tab pill di tengah (desktop saja), ikon pencarian dan notifikasi bulat di kanan. Di mobile: sapaan dan avatar saja.

### Peran Penjahit

| Halaman | Isi |
| --- | --- |
| Beranda | Kartu hero "Pcs disetujui minggu ini" (angka besar, chip estimasi upah, tombol aksi bulat ke Input); kartu lime "Leaderboard proyek" (peringkat sendiri, progres menuju ambang reward); kartu "Hari ini" (ring pcs); daftar "Riwayat terbaru" dengan badge status |
| Input | Dropdown pilih proyek (<select> native 56px, rounded 14); Segmented pill tanggal (default hari ini); input angka besar; tombol primer lebar "Kirim" |
| Riwayat | Daftar per tanggal dengan badge status dan catatan owner bila ditolak atau dikoreksi |
| Leaderboard | Daftar peringkat: nomor, avatar, nama, total pcs, progress bar tipis; baris milik sendiri disorot `lime-100`; penanda bintang bagi yang melewati ambang |

### Peran Owner

| Halaman | Isi |
| --- | --- |
| Dashboard | Kartu hero progres proyek (misal 7.200 / 16.000 pcs, progress bar besar); kartu lime "Menunggu approval" (jumlah input + tombol bulat ke antrean); kartu produksi minggu ini (ring); kartu upah minggu ini (ringkasan per penjahit teratas dengan bar); kartu antrean singkat |
| Approval | Daftar input menunggu; tiap baris punya tombol bulat centang dan X, ketuk baris untuk koreksi jumlah; tombol "Setujui semua" tetap di bawah (mobile) atau di header kartu (desktop) |
| Rekap upah | Segmented pill pilih minggu; desktop: tabel (penjahit, pcs disetujui, tarif, upah) dengan total di kartu lime; mobile: daftar kartu per penjahit |
| Proyek | Daftar proyek sebagai kartu: nama, progres, tarif, deadline; form tambah dalam sheet |
| Penjahit | Daftar penjahit aktif; tombol reset PIN per baris |

---

## 5. Ikon dan ilustrasi

- Pustaka ikon: `lucide-react`, garis 1.75px, ukuran 20 (di dalam kotak 36).
- Tanpa foto atau ilustrasi besar; avatar bulat dengan inisial bila belum ada foto.
- Dekorasi hanya pada kartu lime (bintang atau pola tipis transparan).

---

## 6. Interaksi dan gerak

- Transisi 150-200ms (`ease-out`) pada hover, fokus, dan pergantian tab.
- Ring dan progress bar beranimasi sekali saat dimuat (300-500ms).
- Tombol ditekan: turun 1px dan gelap 8%.
- Setelah input terkirim: toast singkat "Terkirim, menunggu persetujuan" dan kolom angka dikosongkan.
- Hormati `prefers-reduced-motion`: matikan animasi ring dan progress.

---

## 7. Aksesibilitas

- Kontras teks minimal 4.5:1; teks `muted` hanya untuk label sekunder, bukan informasi penting.
- Status tidak hanya dibedakan warna: selalu ada ikon dan teks pada badge.
- Fokus terlihat: cincin 2px `forest-900` dengan jarak 2px.
- Semua kontrol interaktif minimal 44 x 44px.
- Angka memakai pemisah titik gaya Indonesia (`16.000`), mata uang `Rp` di depan angka.

---

## 8. Implementasi

### Variabel CSS (`globals.css`)

```css
:root {
  --bg: #f2f4ef;
  --surface: #ffffff;
  --surface-muted: #f6f8f3;
  --lime-500: #b6f36a;
  --lime-400: #a3e84f;
  --lime-100: #e8fad0;
  --forest-900: #12331c;
  --ink: #0f1a12;
  --muted: #7a857c;
  --line: #e6eae3;
  --positive: #1f9d55;
  --negative: #e5484d;
  --warning: #f5a524;
  --radius-card: 24px;
  --radius-panel: 16px;
  --radius-control: 14px;
}

body {
  background: var(--bg);
  color: var(--ink);
  font-feature-settings: "tnum";
}
```

### Tailwind

Petakan token ke tema (`colors`: `bg`, `surface`, `lime`, `forest`, `ink`, `muted`, `line`, `positive`, `negative`, `warning`; `borderRadius`: `card`, `panel`, `control`) agar kelas seperti `bg-surface rounded-card p-5` dipakai konsisten.

### Komponen yang dibuat lebih dulu (shadcn/ui sebagai dasar, tema diganti)

`Card`, `CardAccent`, `Button`, `SegmentedPill`, `StatusBadge`, `ProgressBar`, `RingProgress`, `ListItem`, `NumberInput`, `BottomNav`, `TopTabs`, `Toast`.

---

## 9. Pemetaan dari referensi ke FCHub

| Elemen referensi | Dipakai di FCHub sebagai |
| --- | --- |
| Kartu saldo besar + pilihan mata uang | Kartu hero total pcs disetujui + pilihan proyek |
| Tombol panah bulat lime | Aksi utama ke halaman Input (penjahit) atau antrean Approval (owner) |
| Kartu lime "Priority / Rewards" | Leaderboard dan penanda reward (penjahit), jumlah menunggu approval (owner) |
| Kartu "Spending" dengan ring | Ring produksi hari ini atau minggu ini |
| Kartu "Earning" dengan bar rincian | Estimasi upah dan rincian per proyek atau per penjahit |
| Kartu "Transactions" dengan centang dan X | Riwayat input (penjahit) dan antrean approval (owner) |
| Tab pill (Overview, Wealth, ...) | Navigasi desktop; bottom nav di mobile |

---

## 10. Hindari

- Menambah warna aksen kedua.
- Bayangan tebal, gradien mencolok, atau sudut tajam pada kartu.
- Tabel lebar di mobile; ganti dengan daftar kartu.
- Teks putih di atas lime.
- Lebih dari satu kartu lime dalam satu layar.
