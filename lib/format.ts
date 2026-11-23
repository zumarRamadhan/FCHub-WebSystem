/**
 * lib/format.ts
 * Utilitas pemformatan angka, mata uang, dan tanggal untuk FCHub.
 * Sesuai konvensi AGENTS.md (id-ID, zona waktu Asia/Jakarta).
 */

const JAKARTA_TIMEZONE = "Asia/Jakarta";

/**
 * Format angka dengan pemisah ribuan titik (contoh: 16000 -> "16.000")
 */
export function formatNumber(value: number): string {
  if (isNaN(value)) return "0";
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format nominal Rupiah (contoh: 5000000 -> "Rp5.000.000")
 */
export function formatRupiah(value: number): string {
  if (isNaN(value)) return "Rp0";
  return `Rp${formatNumber(value)}`;
}

/**
 * Format tanggal dalam bahasa Indonesia (contoh: "21 Nov 2026")
 */
export function formatDateId(
  dateInput: Date | string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: JAKARTA_TIMEZONE,
  }
): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TIMEZONE,
    ...options,
  }).format(date);
}

/**
 * Mendapatkan string tanggal hari ini dalam format "YYYY-MM-DD"
 * berdasarkan zona waktu Asia/Jakarta.
 */
export function getJakartaTodayString(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now); // en-CA menghasilkan format YYYY-MM-DD
}

/**
 * Mendapatkan objek Date yang diselaraskan dengan waktu Jakarta saat ini.
 */
export function getJakartaNow(): Date {
  const now = new Date();
  const jakartaString = now.toLocaleString("en-US", { timeZone: JAKARTA_TIMEZONE });
  return new Date(jakartaString);
}

/**
 * Format standar perhitungan upah (Tahap Transparansi Tarif):
 * "{pcs} pcs × Rp{tarif} = Rp{subtotal}"
 * Contoh: "150 pcs × Rp500 = Rp75.000"
 */
export function formatWageCalculation(
  pcs: number,
  tarif: number,
  subtotal?: number
): string {
  const finalSubtotal = subtotal !== undefined ? subtotal : pcs * tarif;
  return `${formatNumber(pcs)} pcs × ${formatRupiah(tarif)} = ${formatRupiah(finalSubtotal)}`;
}

/**
 * Format tarif per pcs:
 * "Rp{tarif}/pcs"
 * Contoh: "Rp500/pcs"
 */
export function formatTarifPerPcs(tarif: number): string {
  return `${formatRupiah(tarif)}/pcs`;
}

/**
 * Format label ringkasan multi-tarif jika ada lebih dari 1 tarif:
 * "{count} tarif (rata-rata Rp{avg}/pcs)"
 * Contoh: "2 tarif (rata-rata Rp533/pcs)"
 */
export function formatMultiTarifSummary(
  count: number,
  avgTarif: number
): string {
  return `${count} tarif (rata-rata ${formatTarifPerPcs(Math.round(avgTarif))})`;
}

