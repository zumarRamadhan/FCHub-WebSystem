/**
 * lib/wage.ts
 * SATU-SATUNYA tempat rumus perhitungan upah di FCHub pada sisi aplikasi.
 *
 * Sesuai Aturan Bisnis WAJIB (AGENTS.md bagian 6):
 * 1. Hanya input berstatus 'disetujui' yang dihitung ke upah. Input 'menunggu'
 *    dan 'ditolak' tidak pernah dihitung.
 * 2. Upah = qty_disetujui × tarif_snapshot.
 * 3. Rumus upah HANYA ADA DI SINI (dan padanan SQL view/function di database).
 *    Komponen antarmuka TIDAK BOLEH menghitung ulang rumus ini secara mandiri.
 * 4. Penanda reward muncul jika total pcs disetujui >= ambang_reward proyek.
 * 5. Rekap mingguan dihitung dari tanggal_kerja. Batas awal dan akhir minggu
 *    dikonfigurasi di konstanta terpusat di sini.
 */

import { DbProductionEntry } from "./types/database";

/**
 * Konfigurasi Siklus Rekap Mingguan.
 * TODO(owner): Konfirmasi apakah minggu upah Sabtu dihitung dari:
 * - Opsi A: Senin 00:00 s.d. Minggu 23:59 WIB (standar ISO, default saat ini)
 * - Opsi B: Minggu 00:00 s.d. Sabtu 23:59 WIB (sesuai hari pembayaran tunai Sabtu)
 */
export const WEEK_CYCLE_CONFIG = {
  startDayOfWeek: 1, // 1 = Senin, 0 = Minggu
  timezone: "Asia/Jakarta",
  dayNames: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
} as const;

/**
 * Menghitung upah untuk 1 entri produksi.
 * Aturan Bisnis #1 & #2:
 * Hanya entri berstatus 'disetujui' yang menghasilkan upah.
 * Upah = qty_disetujui × tarif_snapshot.
 */
export function calculateEntryWage(
  status: string,
  qtyDisetujui: number | null | undefined,
  tarifSnapshot: number
): number {
  if (status !== "disetujui") {
    return 0;
  }

  const validQty = qtyDisetujui ?? 0;
  if (validQty <= 0 || tarifSnapshot <= 0) {
    return 0;
  }

  return Math.round(validQty * tarifSnapshot);
}

/**
 * Menghitung total upah dari daftar entri produksi.
 * Hanya entri berstatus 'disetujui' yang dijumlahkan.
 */
export function calculateTotalWage(
  entries: Array<Pick<DbProductionEntry, "status" | "qty_disetujui" | "tarif_snapshot">>
): number {
  return entries.reduce((total, entry) => {
    return total + calculateEntryWage(entry.status, entry.qty_disetujui, entry.tarif_snapshot);
  }, 0);
}

/**
 * Menghitung total pcs yang disetujui dari sekumpulan entri.
 */
export function calculateTotalApprovedPcs(
  entries: Array<Pick<DbProductionEntry, "status" | "qty_disetujui">>
): number {
  return entries.reduce((total, entry) => {
    if (entry.status === "disetujui" && entry.qty_disetujui && entry.qty_disetujui > 0) {
      return total + entry.qty_disetujui;
    }
    return total;
  }, 0);
}

/**
 * Mengecek apakah total pcs yang disetujui telah mencapai ambang reward proyek.
 * Aturan Bisnis #9:
 * Pemberian reward adalah keputusan owner; sistem hanya menandai penjahit yang memenuhi syarat.
 */
export function isThresholdReached(
  totalPcsDisetujui: number,
  ambangReward: number
): boolean {
  if (ambangReward <= 0) return false;
  return totalPcsDisetujui >= ambangReward;
}

/**
 * Mendapatkan rentang tanggal awal (Senin) dan akhir (Minggu) dari suatu tanggal,
 * selaras dengan fungsi public.get_week_start() dan public.get_week_end() di Postgres.
 */
export function getWeekDateRange(dateInput: Date | string = new Date()): {
  startDate: string;
  endDate: string;
} {
  const d = typeof dateInput === "string" ? new Date(dateInput) : new Date(dateInput);
  const day = d.getDay(); // 0 = Minggu, 1 = Senin, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const toYMD = (target: Date) => target.toISOString().split("T")[0];

  return {
    startDate: toYMD(monday),
    endDate: toYMD(sunday),
  };
}

export interface WeekOption {
  value: string;
  label: string;
  startDate: string;
  endDate: string;
}

/**
 * Mendapatkan daftar opsi rentang minggu terkini untuk filter rekap upah
 */
export function getRecentWeekOptions(count: number = 4): WeekOption[] {
  const options: WeekOption[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - i * 7);
    const { startDate, endDate } = getWeekDateRange(targetDate);

    let label = "";
    if (i === 0) {
      label = "Minggu Ini";
    } else if (i === 1) {
      label = "Minggu Lalu";
    } else {
      label = `${i} Minggu Lalu`;
    }

    options.push({
      value: startDate,
      label,
      startDate,
      endDate,
    });
  }

  return options;
}
