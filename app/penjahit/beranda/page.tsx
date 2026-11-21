import { createClient } from "@/lib/supabase/server";
import { BerandaClient } from "./beranda-client";
import { getWeekDateRange, calculateEntryWage } from "@/lib/wage";
import { getJakartaTodayString } from "@/lib/format";

export default async function PenjahitBerandaPage() {
  const supabase = createClient();
  const todayStr = getJakartaTodayString();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <BerandaClient
        pcsDisetujuiMingguIni={0}
        upahMingguIni={0}
        pcsHariIni={0}
        targetHariIni={100}
        recentEntries={[]}
      />
    );
  }

  // 1. Rentang minggu upah berjalan
  const { startDate, endDate } = getWeekDateRange();

  // 2. Query entri minggu berjalan milik user ini (HANYA DISETUJUI YANG DIHITUNG)
  const { data: weekEntries } = await supabase
    .from("production_entries")
    .select("qty_disetujui, tarif_snapshot, status")
    .eq("user_id", user.id)
    .eq("status", "disetujui")
    .gte("tanggal_kerja", startDate)
    .lte("tanggal_kerja", endDate);

  let pcsDisetujuiMingguIni = 0;
  let upahMingguIni = 0;

  (weekEntries || []).forEach((e) => {
    const qty = Number(e.qty_disetujui || 0);
    pcsDisetujuiMingguIni += qty;
    upahMingguIni += calculateEntryWage("disetujui", qty, Number(e.tarif_snapshot || 500));
  });

  // 3. Query entri hari ini (untuk target harian 100 pcs)
  const { data: todayEntries } = await supabase
    .from("production_entries")
    .select("qty, qty_disetujui, status")
    .eq("user_id", user.id)
    .eq("tanggal_kerja", todayStr);

  let pcsHariIni = 0;
  (todayEntries || []).forEach((e) => {
    // Tampilkan pcs hari ini (jika disetujui pakai qty_disetujui, jika menunggu pakai qty yang diinput)
    if (e.status === "disetujui") {
      pcsHariIni += Number(e.qty_disetujui || 0);
    } else if (e.status === "menunggu") {
      pcsHariIni += Number(e.qty || 0);
    }
  });

  // 4. Query 5 entri riwayat terbaru
  const { data: rawRecent } = await supabase
    .from("production_entries")
    .select(`
      id,
      tanggal_kerja,
      qty,
      qty_disetujui,
      tarif_snapshot,
      status,
      projects (
        nama
      )
    `)
    .eq("user_id", user.id)
    .order("dibuat_pada", { ascending: false })
    .limit(5);

  interface RecentEntryRow {
    id: string;
    tanggal_kerja: string;
    qty: number;
    qty_disetujui: number | null;
    tarif_snapshot: number;
    status: "menunggu" | "disetujui" | "ditolak";
    projects: { nama: string } | null;
  }

  const recentEntries = ((rawRecent as unknown as RecentEntryRow[]) || []).map((e) => ({
    id: e.id,
    tanggal_kerja: e.tanggal_kerja,
    nama_proyek: e.projects?.nama || "Proyek Konveksi",
    qty: Number(e.qty),
    qty_disetujui: e.qty_disetujui !== null ? Number(e.qty_disetujui) : null,
    tarif_snapshot: Number(e.tarif_snapshot),
    status: e.status,
  }));

  return (
    <BerandaClient
      pcsDisetujuiMingguIni={pcsDisetujuiMingguIni}
      upahMingguIni={upahMingguIni}
      pcsHariIni={pcsHariIni}
      targetHariIni={100}
      recentEntries={recentEntries}
    />
  );
}
