/**
 * lib/types/database.ts
 * Definisi tipe TypeScript yang selaras 100% dengan skema database Supabase FCHub.
 * Sesuai model data AGENTS.md bagian 5 dan migration supabase/migrations/.
 */

export type UserRole = "owner" | "penjahit";
export type ProjectStatus = "aktif" | "selesai" | "diarsipkan";
export type EntryStatus = "menunggu" | "disetujui" | "ditolak";

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
  ambang_reward: number;
  tanggal_mulai: string; // YYYY-MM-DD
  deadline: string | null; // YYYY-MM-DD
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export type DbProjectInsert = Omit<DbProject, "id" | "created_at" | "updated_at"> & {
  id?: string;
  ambang_reward?: number;
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
