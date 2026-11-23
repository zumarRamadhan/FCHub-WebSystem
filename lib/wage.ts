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

import { DbProductionEntry, WeeklyWagePaymentStatus } from "./types/database";
import { addDays, getTodayJakarta, getWeekRangeUtc } from "./dates";

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
 * Menggunakan kalkulasi murni UTC untuk mencegah pergeseran tanggal akibat zona waktu perangkat.
 */
export function getWeekDateRange(dateInput: Date | string = getTodayJakarta()): {
  startDate: string;
  endDate: string;
} {
  const dateStr =
    typeof dateInput === "string"
      ? dateInput.split("T")[0]
      : getTodayJakarta();
  return getWeekRangeUtc(dateStr);
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
  const todayStr = getTodayJakarta();

  for (let i = 0; i < count; i++) {
    const targetDate = addDays(todayStr, -i * 7);
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

/**
 * Menggeser minggu ke depan (+deltaWeeks) atau ke belakang (-deltaWeeks) tanpa batas.
 */
export function shiftWeek(
  currentWeekStartDate: string,
  deltaWeeks: number
): { startDate: string; endDate: string } {
  const targetDate = addDays(currentWeekStartDate, deltaWeeks * 7);
  return getWeekRangeUtc(targetDate);
}

/**
 * Rentang tanggal awal sampai akhir untuk suatu bulan tertentu (1-12)
 */
export function getMonthDateRange(
  year: number,
  month: number
): { startDate: string; endDate: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    startDate: `${year}-${pad(month)}-01`,
    endDate: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

/**
 * Rentang tanggal awal sampai akhir untuk suatu tahun tertentu
 */
export function getYearDateRange(
  year: number
): { startDate: string; endDate: string } {
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

export type PresetRangeType =
  | "bulan-ini"
  | "bulan-lalu"
  | "3-bulan"
  | "tahun-ini"
  | "12-bulan";

/**
 * Menghitung rentang tanggal berdasarkan pintasan preset
 */
export function getPresetDateRange(preset: PresetRangeType): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === "bulan-ini") {
    return getMonthDateRange(now.getFullYear(), now.getMonth() + 1);
  }

  if (preset === "bulan-lalu") {
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return getMonthDateRange(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1);
  }

  if (preset === "3-bulan") {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: toYMD(start), endDate: toYMD(end) };
  }

  if (preset === "tahun-ini") {
    return getYearDateRange(now.getFullYear());
  }

  if (preset === "12-bulan") {
    const start = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: toYMD(start), endDate: toYMD(end) };
  }

  return getMonthDateRange(now.getFullYear(), now.getMonth() + 1);
}

export interface ProjectCompletionEstimate {
  totalQty7Hari: number;
  jumlahHariProduksi: number;
  rataRataHarian: number;
  sisaTargetPcs: number;
  hariDibutuhkan: number | null;
  perkiraanSelesaiDate: string | null; // format YYYY-MM-DD
  statusDeadline: "aman" | "terlambat" | "belum_cukup_data" | "tanpa_deadline" | "selesai";
  selisihHariTerlambat: number;
  labelStatus: string;
}

/**
 * Menghitung perkiraan selesai proyek dan status terhadap batas waktu (deadline).
 *
 * Sesuai aturan:
 * - rata-rata pcs per hari = total qty_disetujui 7 hari terakhir / jumlah hari produksi (min 1).
 * - perkiraan selesai = tanggal hari ini + Math.ceil(sisa target / rata-rata harian).
 * - "Belum cukup data" bila jumlah hari produksi < 2 hari dalam 7 hari terakhir.
 * - "Aman" bila perkiraan selesai <= deadline.
 * - "Terlambat [N] hari" bila perkiraan selesai > deadline.
 * - Tanpa badge bila proyek tidak memiliki deadline.
 *
 * TODO(owner):
 * Perhitungan estimasi ini mengasumsikan konveksi beroperasi setiap hari (7 hari seminggu).
 * Konfirmasi apakah konveksi libur pada hari Minggu atau menerapkan 6 hari kerja,
 * serta apakah perlu memperhitungkan hari libur nasional / cuti konveksi.
 */
export function estimateProjectCompletion(params: {
  targetPcs: number;
  totalPcsDisetujui: number;
  deadline?: string | null;
  todayDateStr: string; // format YYYY-MM-DD
  entries7Hari: Array<{
    tanggal_kerja: string;
    qty_disetujui: number | null;
    status: string;
  }>;
}): ProjectCompletionEstimate {
  const { targetPcs, totalPcsDisetujui, deadline, todayDateStr, entries7Hari } = params;

  // 1. Filter entri yang disetujui dalam 7 hari terakhir
  const approved7Hari = entries7Hari.filter(
    (e) => e.status === "disetujui" && (e.qty_disetujui ?? 0) > 0
  );

  // 2. Hitung total pcs dan jumlah hari produksi unik
  const totalQty7Hari = approved7Hari.reduce((sum, e) => sum + (e.qty_disetujui ?? 0), 0);
  const distinctDays = new Set(approved7Hari.map((e) => e.tanggal_kerja));
  const jumlahHariProduksi = distinctDays.size;

  const sisaTargetPcs = Math.max(0, targetPcs - totalPcsDisetujui);

  // Jika target sudah tercapai
  if (sisaTargetPcs === 0) {
    return {
      totalQty7Hari,
      jumlahHariProduksi,
      rataRataHarian: jumlahHariProduksi > 0 ? Math.round(totalQty7Hari / jumlahHariProduksi) : 0,
      sisaTargetPcs: 0,
      hariDibutuhkan: 0,
      perkiraanSelesaiDate: todayDateStr,
      statusDeadline: "selesai",
      selisihHariTerlambat: 0,
      labelStatus: "Selesai",
    };
  }

  // Jika hari produksi kurang dari 2 hari
  if (jumlahHariProduksi < 2) {
    return {
      totalQty7Hari,
      jumlahHariProduksi,
      rataRataHarian: jumlahHariProduksi === 1 ? totalQty7Hari : 0,
      sisaTargetPcs,
      hariDibutuhkan: null,
      perkiraanSelesaiDate: null,
      statusDeadline: "belum_cukup_data",
      selisihHariTerlambat: 0,
      labelStatus: "Belum cukup data",
    };
  }

  // 3. Rata-rata harian = total pcs 7 hari / jumlah hari produksi (dibulatkan ke bilangan bulat terdekat)
  const rataRataHarian = Math.round(totalQty7Hari / Math.max(1, jumlahHariProduksi));

  if (rataRataHarian <= 0) {
    return {
      totalQty7Hari,
      jumlahHariProduksi,
      rataRataHarian: 0,
      sisaTargetPcs,
      hariDibutuhkan: null,
      perkiraanSelesaiDate: null,
      statusDeadline: "belum_cukup_data",
      selisihHariTerlambat: 0,
      labelStatus: "Belum cukup data",
    };
  }

  // 4. Hari dibutuhkan = sisa target / rata-rata harian, dibulatkan ke atas
  const hariDibutuhkan = Math.ceil(sisaTargetPcs / rataRataHarian);

  // 5. Perkiraan selesai = tanggal hari ini + hari dibutuhkan
  const [year, month, day] = todayDateStr.split("-").map(Number);
  const finishDateObj = new Date(year, month - 1, day + hariDibutuhkan);
  const fYear = finishDateObj.getFullYear();
  const fMonth = String(finishDateObj.getMonth() + 1).padStart(2, "0");
  const fDay = String(finishDateObj.getDate()).padStart(2, "0");
  const perkiraanSelesaiDate = `${fYear}-${fMonth}-${fDay}`;

  // 6. Evaluasi terhadap deadline bila ada
  if (!deadline) {
    return {
      totalQty7Hari,
      jumlahHariProduksi,
      rataRataHarian,
      sisaTargetPcs,
      hariDibutuhkan,
      perkiraanSelesaiDate,
      statusDeadline: "tanpa_deadline",
      selisihHariTerlambat: 0,
      labelStatus: "-",
    };
  }

  const cleanDeadlineStr = deadline.includes("T") ? deadline.split("T")[0] : deadline;
  const [dYear, dMonth, dDay] = cleanDeadlineStr.split("-").map(Number);
  const deadlineObj = new Date(dYear, dMonth - 1, dDay);

  // Hitung selisih hari: finishDateObj - deadlineObj
  const diffMs = finishDateObj.getTime() - deadlineObj.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return {
      totalQty7Hari,
      jumlahHariProduksi,
      rataRataHarian,
      sisaTargetPcs,
      hariDibutuhkan,
      perkiraanSelesaiDate,
      statusDeadline: "aman",
      selisihHariTerlambat: 0,
      labelStatus: "Aman",
    };
  } else {
    return {
      totalQty7Hari,
      jumlahHariProduksi,
      rataRataHarian,
      sisaTargetPcs,
      hariDibutuhkan,
      perkiraanSelesaiDate,
      statusDeadline: "terlambat",
      selisihHariTerlambat: diffDays,
      labelStatus: `Terlambat ${diffDays} hari`,
    };
  }
}

/**
 * Menentukan status pembayaran upah mingguan seorang penjahit.
 * Aturan Bisnis #13:
 * - 'Tanpa upah'   : upah_saat_ini = 0 dan total_dibayar = 0
 * - 'Belum dibayar': upah_saat_ini > 0 dan total_dibayar = 0
 * - 'Lunas'        : total_dibayar = upah_saat_ini (dan upah_saat_ini > 0)
 * - 'Kurang bayar' : total_dibayar < upah_saat_ini (upah naik setelah dibayar)
 * - 'Lebih bayar'  : total_dibayar > upah_saat_ini (upah turun setelah dibayar)
 */
export function determineWagePaymentStatus(
  upahSaatIni: number,
  totalDibayarAktif: number
): WeeklyWagePaymentStatus {
  if (upahSaatIni === 0 && totalDibayarAktif === 0) {
    return "Tanpa upah";
  }
  if (totalDibayarAktif === 0) {
    return "Belum dibayar";
  }
  if (totalDibayarAktif === upahSaatIni) {
    return "Lunas";
  }
  if (totalDibayarAktif < upahSaatIni) {
    return "Kurang bayar";
  }
  return "Lebih bayar";
}

export interface PaymentStatusBadgeInfo {
  label: string;
  variant: "positive" | "warning" | "negative" | "muted";
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export function getPaymentStatusBadgeInfo(
  status: WeeklyWagePaymentStatus
): PaymentStatusBadgeInfo {
  switch (status) {
    case "Lunas":
      return {
        label: "Lunas",
        variant: "positive",
        bgClass: "bg-lime-100",
        textClass: "text-positive",
        borderClass: "border-lime-300/60",
      };
    case "Kurang bayar":
      return {
        label: "Kurang bayar",
        variant: "warning",
        bgClass: "bg-warning/15",
        textClass: "text-[#B77407]",
        borderClass: "border-warning/30",
      };
    case "Lebih bayar":
      return {
        label: "Lebih bayar",
        variant: "negative",
        bgClass: "bg-negative/15",
        textClass: "text-negative",
        borderClass: "border-negative/30",
      };
    case "Belum dibayar":
      return {
        label: "Belum dibayar",
        variant: "muted",
        bgClass: "bg-surface-muted",
        textClass: "text-muted",
        borderClass: "border-line",
      };
    case "Tanpa upah":
    default:
      return {
        label: "Tanpa upah",
        variant: "muted",
        bgClass: "bg-surface-muted/60",
        textClass: "text-muted/60",
        borderClass: "border-line/40",
      };
  }
}
