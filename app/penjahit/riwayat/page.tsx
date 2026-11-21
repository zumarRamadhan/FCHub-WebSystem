import { createClient } from "@/lib/supabase/server";
import { RiwayatClient, PenjahitHistoryEntry } from "./riwayat-client";
import { getWeekDateRange, calculateEntryWage } from "@/lib/wage";

export default async function PenjahitRiwayatPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <RiwayatClient initialEntries={[]} />;
  }

  // 1. Rentang minggu berjalan & upah
  const { startDate, endDate } = getWeekDateRange();

  // Ambil seluruh entri produksi milik penjahit ini
  // Sesuai RLS: Penjahit hanya bisa select miliknya sendiri
  const { data: rawEntries } = await supabase
    .from("production_entries")
    .select(`
      id,
      project_id,
      tanggal_kerja,
      qty,
      qty_disetujui,
      tarif_snapshot,
      status,
      catatan_owner,
      disetujui_pada,
      projects (
        nama
      )
    `)
    .eq("user_id", user.id)
    .order("tanggal_kerja", { ascending: false })
    .order("dibuat_pada", { ascending: false });

  interface HistoryEntryRow {
    id: string;
    project_id: string;
    tanggal_kerja: string;
    qty: number;
    qty_disetujui: number | null;
    tarif_snapshot: number;
    status: "menunggu" | "disetujui" | "ditolak";
    catatan_owner: string | null;
    disetujui_pada: string | null;
    projects: { nama: string } | null;
  }

  const entries: PenjahitHistoryEntry[] = (
    (rawEntries as unknown as HistoryEntryRow[]) || []
  ).map((e) => ({
    id: e.id,
    project_id: e.project_id,
    nama_proyek: e.projects?.nama || "Proyek Konveksi",
    tanggal_kerja: e.tanggal_kerja,
    qty: e.qty,
    qty_disetujui: e.qty_disetujui,
    tarif_snapshot: e.tarif_snapshot,
    status: e.status,
    catatan_owner: e.catatan_owner,
    disetujui_pada: e.disetujui_pada,
  }));

  // Hitung upah minggu berjalan
  let pcsMingguIni = 0;
  let upahMingguIni = 0;
  entries.forEach((e) => {
    if (e.status === "disetujui" && e.tanggal_kerja >= startDate && e.tanggal_kerja <= endDate) {
      const q = e.qty_disetujui || 0;
      pcsMingguIni += q;
      upahMingguIni += calculateEntryWage("disetujui", q, e.tarif_snapshot);
    }
  });

  // Query payment status minggu berjalan
  let paymentInfo: { isPaid: boolean; paidAt?: string } = { isPaid: false };
  try {
    const { data: payments } = await supabase
      .from("wage_payments")
      .select("id, status, dibayar_pada")
      .eq("user_id", user.id)
      .eq("periode_mulai", startDate)
      .eq("status", "dibayar")
      .order("dibayar_pada", { ascending: false })
      .limit(1);

    if (payments && payments.length > 0) {
      paymentInfo = {
        isPaid: true,
        paidAt: payments[0].dibayar_pada,
      };
    }
  } catch {
    paymentInfo = { isPaid: false };
  }

  return (
    <RiwayatClient
      initialEntries={entries}
      weekSummary={{
        pcs: pcsMingguIni,
        upah: upahMingguIni,
        isPaid: paymentInfo.isPaid,
        paidAt: paymentInfo.paidAt,
        startDate,
        endDate,
      }}
    />
  );
}
