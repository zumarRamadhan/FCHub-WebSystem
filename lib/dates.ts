/**
 * lib/dates.ts
 * Helper manipulasi tanggal berbasis string "YYYY-MM-DD" murni dengan Date.UTC
 * Mencegah bug pergeseran tanggal akibat zona waktu perangkat (misal Asia/Jakarta UTC+7 vs toISOString UTC).
 */

/**
 * Memecah string tanggal "YYYY-MM-DD" menjadi [tahun, bulan (1-12), hari (1-31)]
 */
export function parseYMD(dateStr: string): [number, number, number] {
  const parts = dateStr.split("-").map(Number);
  const y = parts[0] || 2026;
  const m = parts[1] || 1;
  const d = parts[2] || 1;
  return [y, m, d];
}

/**
 * Memformat tahun, bulan, hari menjadi string standar "YYYY-MM-DD"
 */
export function formatYMD(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Menambahkan atau mengurangi sejumlah hari (n) pada string "YYYY-MM-DD"
 * Dihitung murni dengan Date.UTC dan getUTC* sehingga bebas dari pengaruh zona waktu lokal.
 */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = parseYMD(dateStr);
  const utcMs = Date.UTC(y, m - 1, d) + n * 86400000;
  const target = new Date(utcMs);
  return formatYMD(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    target.getUTCDate()
  );
}

/**
 * Mendapatkan tanggal hari ini dalam zona waktu Asia/Jakarta (WIB = UTC+7)
 * Selaras dengan Aturan Bisnis #8 (AGENTS.md).
 */
export function getTodayJakarta(): string {
  const now = new Date();
  // Tambah offset UTC+7 (7 jam = 25.200.000 ms)
  const jakartaMs = now.getTime() + 7 * 3600000;
  const target = new Date(jakartaMs);
  return formatYMD(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    target.getUTCDate()
  );
}

/**
 * Menghitung batas Senin dan Minggu dari suatu tanggal string secara murni UTC (fallback jika tanpa DB).
 * Catatan: Di /owner/rekap, batas resmi tetap diambil langsung dari database via get_week_start & get_week_end.
 */
export function getWeekRangeUtc(dateStr: string): { startDate: string; endDate: string } {
  const [y, m, d] = parseYMD(dateStr);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  const day = utcDate.getUTCDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = addDays(dateStr, diffToMonday);
  const sunday = addDays(monday, 6);

  return {
    startDate: monday,
    endDate: sunday,
  };
}
