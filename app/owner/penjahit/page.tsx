import { createClient } from "@/lib/supabase/server";
import { PenjahitClient, PenjahitItem } from "./penjahit-client";
import { getWeekDateRange, calculateEntryWage, determineWagePaymentStatus } from "@/lib/wage";
import { WeeklyWagePaymentStatus } from "@/lib/types/database";

export default async function OwnerPenjahitPage() {
  const supabase = createClient();
  const { startDate, endDate } = getWeekDateRange();

  // 1. Coba ambil dari view v_tailor_summary
  let penjahits: PenjahitItem[] = [];

  const { data: viewData, error: viewError } = await supabase
    .from("v_tailor_summary")
    .select(`
      user_id,
      nama_penjahit,
      username_penjahit,
      aktif,
      created_at,
      total_pcs_seumur_hidup,
      total_pendapatan_seumur_hidup,
      total_proyek_dikerjakan,
      status_bayar_minggu_ini
    `)
    .order("aktif", { ascending: false })
    .order("nama_penjahit", { ascending: true });

  if (!viewError && viewData && viewData.length > 0) {
    interface ViewRow {
      user_id: string;
      nama_penjahit: string;
      username_penjahit: string;
      aktif: boolean;
      created_at: string;
      total_pcs_seumur_hidup: number;
      total_pendapatan_seumur_hidup: number;
      total_proyek_dikerjakan: number;
      status_bayar_minggu_ini: WeeklyWagePaymentStatus;
    }

    penjahits = (viewData as unknown as ViewRow[]).map((u) => ({
      id: u.user_id,
      nama: u.nama_penjahit,
      username: u.username_penjahit,
      role: "penjahit",
      aktif: u.aktif,
      created_at: u.created_at,
      total_pcs: Number(u.total_pcs_seumur_hidup || 0),
      total_pendapatan: Number(u.total_pendapatan_seumur_hidup || 0),
      total_proyek: Number(u.total_proyek_dikerjakan || 0),
      status_bayar_minggu_ini: u.status_bayar_minggu_ini || "Tanpa upah",
    }));
  } else {
    // 2. Fallback jika view belum dijalankan di live Supabase
    const { data: rawUsers } = await supabase
      .from("users")
      .select("id, nama, username, role, aktif, created_at")
      .eq("role", "penjahit")
      .order("aktif", { ascending: false })
      .order("nama", { ascending: true });

    const users = rawUsers || [];

    // Ambil seluruh entri produksi disetujui (Aturan Bisnis #1)
    const { data: rawEntries } = await supabase
      .from("production_entries")
      .select("user_id, project_id, qty_disetujui, tarif_snapshot, tanggal_kerja")
      .eq("status", "disetujui");

    // Ambil seluruh pembayaran aktif
    const { data: rawPayments } = await supabase
      .from("wage_payments")
      .select("user_id, periode_mulai, jumlah, status")
      .eq("status", "dibayar");

    const entriesByUser: Record<
      string,
      {
        totalPcs: number;
        totalUpah: number;
        projectIds: Set<string>;
        weekPcs: number;
        weekUpah: number;
      }
    > = {};

    users.forEach((u) => {
      entriesByUser[u.id] = {
        totalPcs: 0,
        totalUpah: 0,
        projectIds: new Set<string>(),
        weekPcs: 0,
        weekUpah: 0,
      };
    });

    (rawEntries || []).forEach((e) => {
      if (!entriesByUser[e.user_id]) return;
      const q = Number(e.qty_disetujui || 0);
      const wage = calculateEntryWage("disetujui", q, Number(e.tarif_snapshot || 500));
      entriesByUser[e.user_id].totalPcs += q;
      entriesByUser[e.user_id].totalUpah += wage;
      if (e.project_id) {
        entriesByUser[e.user_id].projectIds.add(e.project_id);
      }
      if (e.tanggal_kerja >= startDate && e.tanggal_kerja <= endDate) {
        entriesByUser[e.user_id].weekPcs += q;
        entriesByUser[e.user_id].weekUpah += wage;
      }
    });

    const paymentsByUserWeek: Record<string, number> = {};
    (rawPayments || []).forEach((p) => {
      if (p.periode_mulai === startDate) {
        paymentsByUserWeek[p.user_id] =
          (paymentsByUserWeek[p.user_id] || 0) + Number(p.jumlah || 0);
      }
    });

    penjahits = users.map((u) => {
      const stats = entriesByUser[u.id] || {
        totalPcs: 0,
        totalUpah: 0,
        projectIds: new Set<string>(),
        weekPcs: 0,
        weekUpah: 0,
      };
      const paidThisWeek = paymentsByUserWeek[u.id] || 0;
      const statusMingguIni = determineWagePaymentStatus(stats.weekUpah, paidThisWeek);

      return {
        id: u.id,
        nama: u.nama,
        username: u.username,
        role: "penjahit",
        aktif: u.aktif,
        created_at: u.created_at,
        total_pcs: stats.totalPcs,
        total_pendapatan: stats.totalUpah,
        total_proyek: stats.projectIds.size,
        status_bayar_minggu_ini: statusMingguIni,
      };
    });
  }

  return <PenjahitClient initialPenjahits={penjahits} />;
}
