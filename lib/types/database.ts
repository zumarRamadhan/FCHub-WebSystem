/**
 * lib/types/database.ts
 * Definisi tipe TypeScript yang selaras 100% dengan skema database Supabase FCHub.
 * Sesuai model data AGENTS.md bagian 5 dan migration supabase/migrations/.
 */

export type UserRole = "owner" | "penjahit";
export type ProjectStatus = "aktif" | "selesai" | "diarsipkan";
export type EntryStatus = "menunggu" | "disetujui" | "ditolak";
export type ProjectColorKey = "p1" | "p2" | "p3" | "p4" | "p5" | "p6" | "p7" | "p8";

/**
 * Tabel: public.users (Profil Pengguna)
 */
export interface DbUser {
  id: string; // references auth.users(id)
  nama: string;
  username: string;
  role: UserRole;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export type DbUserInsert = Omit<DbUser, "created_at" | "updated_at">;
export type DbUserUpdate = Partial<Omit<DbUser, "id" | "created_at" | "updated_at">>;

/**
 * Tabel: public.projects (Proyek Konveksi)
 */
export interface DbProject {
  id: string;
  nama: string;
  target_pcs: number;
  tarif_per_pcs: number;
  reward_aktif: boolean;
  ambang_reward: number;
  warna: ProjectColorKey;
  tanggal_mulai: string; // YYYY-MM-DD
  deadline: string | null; // YYYY-MM-DD
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export type DbProjectInsert = Omit<DbProject, "id" | "created_at" | "updated_at"> & {
  id?: string;
  ambang_reward?: number;
  warna?: ProjectColorKey;
  status?: ProjectStatus;
};

export type DbProjectUpdate = Partial<Omit<DbProject, "id" | "created_at" | "updated_at">>;

/**
 * Tabel: public.production_entries (Entri Produksi Harian Penjahit)
 */
export interface DbProductionEntry {
  id: string;
  user_id: string;
  project_id: string;
  tanggal_kerja: string; // YYYY-MM-DD
  qty: number; // Angka asli dari penjahit
  qty_disetujui: number | null; // Angka persetujuan/koreksi owner
  tarif_snapshot: number; // Salinan tarif_per_pcs saat entri dibuat
  status: EntryStatus;
  catatan_owner: string | null;
  disetujui_oleh: string | null;
  disetujui_pada: string | null;
  dibuat_pada: string;
  updated_at: string;
}

export interface DbProductionEntryInsert {
  project_id: string;
  qty: number;
  tanggal_kerja?: string;
  // Field berikut diatur oleh trigger database di sisi server (TIDAK dari klien):
  user_id?: string;
  tarif_snapshot?: number;
  status?: EntryStatus;
}

export interface DbProductionEntryUpdate {
  qty?: number;
  tanggal_kerja?: string;
  // Khusus owner:
  status?: EntryStatus;
  qty_disetujui?: number | null;
  catatan_owner?: string | null;
}

/**
 * View: public.v_project_progress
 */
export interface ProjectProgressView {
  project_id: string;
  nama_proyek: string;
  target_pcs: number;
  tarif_per_pcs: number;
  ambang_reward: number;
  status_proyek: ProjectStatus;
  tanggal_mulai: string;
  deadline: string | null;
  total_pcs_disetujui: number;
  persentase_progres: number;
  sisa_target_pcs: number;
  total_entri_menunggu: number;
}

/**
 * View: public.v_leaderboard (Akses Owner)
 */
export interface LeaderboardView {
  project_id: string;
  nama_proyek: string;
  reward_aktif?: boolean;
  user_id: string;
  nama_penjahit: string;
  username_penjahit: string;
  total_pcs_disetujui: number;
  total_upah: number;
  ambang_reward: number;
  melewati_ambang_reward: boolean;
  rank_pcs: number;
}

/**
 * Fungsi: public.get_project_leaderboard (Akses Penjahit / Publik Aman)
 * Hanya memuat nama dan total pcs, tanpa upah penjahit lain.
 */
export interface LeaderboardPublicItem {
  rank_position: number;
  user_id: string;
  nama_penjahit: string;
  total_pcs_disetujui: number;
  melewati_ambang_reward: boolean;
  is_current_user: boolean;
}

/**
 * View: public.v_weekly_wage
 */
export interface WeeklyWageView {
  user_id: string;
  nama_penjahit: string;
  username_penjahit: string;
  week_start: string; // YYYY-MM-DD
  week_end: string; // YYYY-MM-DD
  total_pcs_disetujui: number;
  total_upah: number;
  total_entri_disetujui: number;
}

/**
 * Tabel: public.wage_payments (Catatan Pembayaran Tunai Mingguan)
 */
export type WagePaymentStatus = "dibayar" | "dibatalkan";

export interface WageRateBreakdown {
  tarif: number;
  pcs: number;
  subtotal: number;
}

export interface WagePaymentProjectDetail {
  project_id: string;
  nama_proyek: string;
  tarif_snapshot: number;
  total_pcs: number;
  subtotal: number;
  tarif_min?: number;
  tarif_max?: number;
  tarif_rata_rata?: number;
  rincian_tarif?: WageRateBreakdown[];
}

export interface DbWagePayment {
  id: string;
  user_id: string;
  periode_mulai: string; // YYYY-MM-DD
  periode_selesai: string; // YYYY-MM-DD
  total_pcs: number;
  jumlah: number;
  rincian: WagePaymentProjectDetail[];
  status: WagePaymentStatus;
  catatan: string | null;
  dibayar_oleh: string;
  dibayar_pada: string;
  dibatalkan_oleh: string | null;
  dibatalkan_pada: string | null;
  alasan_batal: string | null;
  created_at: string;
}

/**
 * Status Pembayaran Upah Mingguan per Penjahit
 * Aturan Bisnis #13:
 * - 'Tanpa upah'   : upah_saat_ini = 0 dan total_dibayar = 0
 * - 'Belum dibayar': upah_saat_ini > 0 dan total_dibayar = 0
 * - 'Lunas'        : total_dibayar = upah_saat_ini
 * - 'Kurang bayar' : total_dibayar < upah_saat_ini (upah naik setelah dibayar)
 * - 'Lebih bayar'  : total_dibayar > upah_saat_ini (upah turun setelah dibayar)
 */
export type WeeklyWagePaymentStatus =
  | "Belum dibayar"
  | "Lunas"
  | "Kurang bayar"
  | "Lebih bayar"
  | "Tanpa upah";

/**
 * View: public.v_wage_status
 */
export interface WageStatusView {
  user_id: string;
  nama_penjahit: string;
  username_penjahit: string;
  week_start: string; // YYYY-MM-DD
  week_end: string; // YYYY-MM-DD
  total_pcs_saat_ini: number;
  upah_saat_ini: number;
  total_dibayar: number;
  sisa: number;
  status_pembayaran: WeeklyWagePaymentStatus;
  tanggal_bayar_terakhir: string | null;
  dibayar_oleh_nama: string | null;
  total_transaksi_bayar: number;
}

/**
 * View: public.v_tailor_summary (Tahap 14)
 */
export interface TailorSummaryView {
  user_id: string;
  nama_penjahit: string;
  username_penjahit: string;
  aktif: boolean;
  created_at: string;
  total_pcs_seumur_hidup: number;
  total_pendapatan_seumur_hidup: number;
  total_proyek_dikerjakan: number;
  total_hari_kerja: number;
  rata_rata_pcs_per_hari: number;
  total_sudah_dibayar: number;
  total_belum_dibayar: number;
  status_bayar_minggu_ini: WeeklyWagePaymentStatus;
  sisa_minggu_ini: number;
  tanggal_bayar_minggu_ini: string | null;
}

/**
 * View: public.v_tailor_projects (Tahap 14)
 */
export interface TailorProjectView {
  user_id: string;
  project_id: string;
  nama_proyek: string;
  status_proyek: string;
  target_pcs: number;
  tarif_per_pcs: number;
  reward_aktif?: boolean;
  ambang_reward: number;
  total_pcs: number;
  total_upah: number;
  grand_total_pcs_proyek: number;
  persen_kontribusi: number;
  melewati_ambang_reward: boolean;
  tanggal_pertama_kerja: string;
  tanggal_terakhir_kerja: string;
  total_hari_kerja_proyek: number;
  tarif_min?: number;
  tarif_max?: number;
  tarif_rata_rata?: number;
  rincian_tarif?: WageRateBreakdown[];
}

/**
 * View: public.v_tailor_weekly_history (Tahap 14)
 */
export interface TailorWeeklyHistoryView {
  user_id: string;
  week_start: string;
  week_end: string;
  total_pcs: number;
  total_upah: number;
  total_dibayar: number;
  sisa: number;
  status_pembayaran: WeeklyWagePaymentStatus;
  tanggal_bayar_terakhir: string | null;
  rincian_proyek?: Array<{
    project_id: string;
    nama_proyek: string;
    total_pcs: number;
    total_upah: number;
    tarif_min: number;
    tarif_max: number;
    tarif_rata_rata: number;
    rincian_tarif: WageRateBreakdown[];
  }>;
}

/**
 * Tabel: public.app_settings (Tahap 16)
 */
export interface AppSetting {
  key: string;
  value: unknown;
  updated_at: string;
}

/**
 * Kode Alasan Anomali (Tahap 16)
 */
export type AnomalyReasonCode =
  | "di_atas_kebiasaan"
  | "sangat_tinggi"
  | "total_harian_tinggi"
  | "kemungkinan_ganda"
  | "tanggal_masa_depan";

export interface AnomalyReasonItem {
  kode: AnomalyReasonCode;
  judul: string;
  deskripsi: string;
}

/**
 * Hasil RPC: public.get_entry_flags (Tahap 16)
 */
export interface EntryFlagItem {
  entry_id: string;
  tingkat: "normal" | "perlu_dicek" | "sangat_tinggi";
  alasan: AnomalyReasonItem[];
  alasan_kode: AnomalyReasonCode[];
  baseline: number;
  rasio: number;
}

/**
 * Tabel: public.work_calendar (Tahap 17)
 */
export interface WorkCalendarEntry {
  tanggal: string; // YYYY-MM-DD pk
  jenis: "libur" | "kerja";
  keterangan: string | null;
  dibuat_oleh?: string | null;
  dibuat_pada?: string;
}

/**
 * Rincian Proyek Harian pada get_calendar_month (Tahap 17)
 */
export interface CalendarMonthProjectItem {
  project_id: string;
  nama_proyek: string;
  warna: ProjectColorKey;
  pcs_disetujui: number;
  pcs_menunggu: number;
  jumlah_penjahit: number;
  is_deadline: boolean;
  is_lembur: boolean;
}

/**
 * Hasil RPC: public.get_calendar_month (Tahap 17)
 */
export interface CalendarMonthDay {
  tanggal: string; // YYYY-MM-DD
  is_hari_kerja: boolean;
  sumber_status: "kalender" | "pola";
  keterangan_libur: string | null;
  proyek_produksi: CalendarMonthProjectItem[];
  total_pcs_disetujui: number;
  total_pcs_menunggu: number;
  total_penjahit: number;
  ada_lembur: boolean;
}

/**
 * ==============================================================================
 * TAHAP 18: MANAJEMEN STOK GUDANG & INVENTARIS BARANG JADI
 * ==============================================================================
 */

export type StockStatus = "tersedia" | "menipis" | "habis";
export type StockItemLifecycle = "aktif" | "diarsipkan";
export type StockMovementType =
  | "masuk"
  | "keluar_penjualan"
  | "keluar_rusak"
  | "koreksi";

export interface StockItemPhoto {
  full_path: string;
  thumb_path: string;
  created_at?: string;
  name?: string;
}

export interface DbStockItem {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  project_id: string | null;
  stok_saat_ini: number;
  ambang_menipis: number;
  harga_jual: number | null;
  lokasi_gudang: string | null;
  catatan: string | null;
  foto: StockItemPhoto[];
  status: StockItemLifecycle;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockItemView extends DbStockItem {
  nama_proyek: string | null;
  warna_proyek: ProjectColorKey | null;
  status_stok: StockStatus;
  sampul_thumb_path: string | null;
  sampul_full_path: string | null;
  sampul_thumb_url?: string | null;
}

export interface DbStockMovement {
  id: string;
  stock_item_id: string;
  jenis: StockMovementType;
  jumlah: number; // Positif menambah, negatif mengurangi
  stok_sebelum: number;
  stok_sesudah: number;
  harga_satuan: number | null;
  total_harga: number | null;
  pembeli: string | null;
  catatan: string | null;
  created_by: string | null;
  created_at: string;
  nama_pencatat?: string | null;
}

export interface StockSummary {
  total_jenis: number;
  total_pcs_tersedia: number;
  total_menipis: number;
  total_habis: number;
  estimasi_nilai_stok: number;
}

/**
 * Tipe Data Laporan Pengeluaran Upah (Tahap Rekap Upah Periode Bebas)
 */
export interface WageReportPeriodInfo {
  mulai: string;
  selesai: string;
  jumlah_hari: number;
  prev_mulai: string;
  prev_selesai: string;
}

export interface WageReportSummary {
  total_upah: number;
  total_pcs: number;
  rata_rata_upah_per_pcs: number;
  jumlah_penjahit_aktif: number;
  rata_rata_per_penjahit: number;
  total_dibayar: number;
  total_belum_dibayar: number;
  prev_total_upah: number;
  prev_total_pcs: number;
  perubahan_upah_persen: number | null;
  perubahan_pcs_persen: number | null;
}

export interface WageReportTimeSeriesItem {
  label: string;
  start_date: string;
  end_date: string;
  upah: number;
  pcs: number;
}

export interface WageReportProjectItem {
  project_id: string;
  nama_proyek: string;
  warna: ProjectColorKey | string;
  total_pcs: number;
  total_upah: number;
  persen_dari_total: number;
  rincian_tarif: Array<{
    tarif: number;
    pcs: number;
    subtotal: number;
  }>;
}

export interface WageReportTailorItem {
  user_id: string;
  nama_penjahit: string;
  username_penjahit: string;
  total_pcs: number;
  total_upah: number;
  total_proyek: number;
  rincian_proyek: Array<{
    project_id: string;
    nama_proyek: string;
    tarif: number;
    pcs: number;
    subtotal: number;
  }>;
}

export interface WageReportData {
  periode: WageReportPeriodInfo;
  ringkasan: WageReportSummary;
  deret_waktu: WageReportTimeSeriesItem[];
  per_proyek: WageReportProjectItem[];
  per_penjahit: WageReportTailorItem[];
}



