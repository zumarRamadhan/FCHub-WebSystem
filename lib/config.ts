/**
 * lib/config.ts
 * Konfigurasi terpusat sistem FCHub untuk maskot, target, dan waktu kerja.
 */

// TODO(owner): Konfirmasi nama panggilan resmi maskot konveksi Firdaus Collection (nilai awal "Fiko")
export const MASCOT_NAME = "Fiko";

// TODO(owner): Konfirmasi rasio kelipatan target untuk status melampaui (1.25 = 125% dari target)
export const MELAMPAUI_RASIO = 1.25;

// TODO(owner): Konfirmasi apakah target harian konveksi seragam 100 pcs untuk semua penjahit
export const DEFAULT_TARGET_HARIAN = 100;

// TODO(owner): Konfirmasi apakah pose belumCapai sesuai dengan suasana kerja penjahit (dapat dimatikan lewat konfigurasi ini)
export const PAKAI_POSE_BELUM_CAPAI = true;

/**
 * Periode waktu hari dalam zona waktu Asia/Jakarta (WIB = UTC+7)
 * - Pagi : 04.00 - 10.00
 * - Siang: 10.00 - 15.00
 * - Sore : 15.00 - 18.00
 * - Malam: 18.00 - 04.00
 */
export type TimePeriod = "pagi" | "siang" | "sore" | "malam";

export function getJakartaTimePeriod(): TimePeriod {
  // Hitung jam di zona waktu Asia/Jakarta
  const now = new Date();
  const jakartaHours = (now.getUTCHours() + 7) % 24;

  if (jakartaHours >= 4 && jakartaHours < 10) return "pagi";
  if (jakartaHours >= 10 && jakartaHours < 15) return "siang";
  if (jakartaHours >= 15 && jakartaHours < 18) return "sore";
  return "malam";
}
