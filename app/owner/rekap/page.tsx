import { createClient } from "@/lib/supabase/server";
import {
  RekapClient,
  PenjahitWageRekapItem,
  ProjectWageDetail,
  WagePaymentRecordItem,
} from "./rekap-client";
import { getRecentWeekOptions, determineWagePaymentStatus } from "@/lib/wage";

interface RawEntryRow {
  user_id: string;
  project_id: string;
  qty_disetujui: number | null;
  tarif_snapshot: number;
  users: { nama: string; username: string } | null;
  projects: { nama: string } | null;
}

interface RawPaymentRow {
  id: string;
  user_id: string;
  periode_mulai: string;
  periode_selesai: string;
  total_pcs: number;
  jumlah: number;
  rincian: unknown;
  status: "dibayar" | "dibatalkan";
  catatan: string | null;
  dibayar_pada: string;
  dibatalkan_pada: string | null;
  alasan_batal: string | null;
  payer: { nama: string } | null;
  canceller: { nama: string } | null;
}

export default async function OwnerRekapPage() {
  const supabase = createClient();
  const weekOptions = getRecentWeekOptions(4);
  const currentWeek = weekOptions[0];

  // 1. Ambil seluruh entri berstatus 'disetujui' pada minggu berjalan
  const { data: rawEntries } = await supabase
    .from("production_entries")
    .select(`
      user_id,
      project_id,
      qty_disetujui,
      tarif_snapshot,
      users:users!user_id (
        nama,
        username
      ),
      projects (
        nama
      )
    `)
    .eq("status", "disetujui")
    .gte("tanggal_kerja", currentWeek.startDate)
    .lte("tanggal_kerja", currentWeek.endDate);

  const entries = (rawEntries as unknown as RawEntryRow[]) || [];

  // 2. Ambil catatan pembayaran wage_payments pada minggu berjalan
  const { data: rawPayments } = await supabase
    .from("wage_payments")
    .select(`
      id,
      user_id,
      periode_mulai,
      periode_selesai,
      total_pcs,
      jumlah,
      rincian,
      status,
      catatan,
      dibayar_pada,
      dibatalkan_pada,
      alasan_batal,
      payer:users!dibayar_oleh ( nama ),
      canceller:users!dibatalkan_oleh ( nama )
    `)
    .eq("periode_mulai", currentWeek.startDate);

  const payments = (rawPayments as unknown as RawPaymentRow[]) || [];

  // 3. Agregasi entri per penjahit dan per proyek
  const tailorMap: Record<
    string,
    {
      user_id: string;
      nama_penjahit: string;
      username_penjahit: string;
      total_pcs: number;
      total_upah: number;
      projectDetailsMap: Record<string, ProjectWageDetail>;
    }
  > = {};

  entries.forEach((e) => {
    const userId = e.user_id;
    const qty = Number(e.qty_disetujui || 0);
    const tarif = Number(e.tarif_snapshot || 500);
    const prjId = e.project_id;
    const prjNama = e.projects?.nama || "Proyek Konveksi";

    if (!tailorMap[userId]) {
      tailorMap[userId] = {
        user_id: userId,
        nama_penjahit: e.users?.nama || "Penjahit",
        username_penjahit: e.users?.username || "penjahit",
        total_pcs: 0,
        total_upah: 0,
        projectDetailsMap: {},
      };
    }

    tailorMap[userId].total_pcs += qty;
    tailorMap[userId].total_upah += qty * tarif;

    if (!tailorMap[userId].projectDetailsMap[prjId]) {
      tailorMap[userId].projectDetailsMap[prjId] = {
        project_id: prjId,
        nama_proyek: prjNama,
        tarif_snapshot: tarif,
        total_pcs: 0,
        subtotal: 0,
      };
    }

    tailorMap[userId].projectDetailsMap[prjId].total_pcs += qty;
    tailorMap[userId].projectDetailsMap[prjId].subtotal += qty * tarif;
  });

  // Pastikan penjahit yang punya pembayaran tapi tidak punya entri baru tetap masuk
  payments.forEach((p) => {
    if (!tailorMap[p.user_id]) {
      tailorMap[p.user_id] = {
        user_id: p.user_id,
        nama_penjahit: "Penjahit",
        username_penjahit: "penjahit",
        total_pcs: 0,
        total_upah: 0,
        projectDetailsMap: {},
      };
    }
  });

  // 4. Susun item rekap lengkap
  const initialSummary: PenjahitWageRekapItem[] = Object.values(tailorMap).map((t) => {
    const userPayments = payments.filter((p) => p.user_id === t.user_id);
    const activePayments = userPayments.filter((p) => p.status === "dibayar");
    const totalDibayar = activePayments.reduce((sum, p) => sum + Number(p.jumlah || 0), 0);

    const sisa = Math.max(0, t.total_upah - totalDibayar);
    const statusPembayaran = determineWagePaymentStatus(t.total_upah, totalDibayar);

    const lastPayment = activePayments.sort(
      (a, b) => new Date(b.dibayar_pada).getTime() - new Date(a.dibayar_pada).getTime()
    )[0];

    const paymentRecords: WagePaymentRecordItem[] = userPayments.map((p) => ({
      id: p.id,
      jumlah: Number(p.jumlah || 0),
      total_pcs: Number(p.total_pcs || 0),
      status: p.status,
      catatan: p.catatan,
      dibayar_pada: p.dibayar_pada,
      dibayar_oleh_nama: p.payer?.nama || "Owner",
      dibatalkan_pada: p.dibatalkan_pada,
      dibatalkan_oleh_nama: p.canceller?.nama || null,
      alasan_batal: p.alasan_batal,
      rincian: Array.isArray(p.rincian) ? (p.rincian as ProjectWageDetail[]) : [],
    }));

    return {
      user_id: t.user_id,
      nama_penjahit: t.nama_penjahit,
      username_penjahit: t.username_penjahit,
      total_pcs_disetujui: t.total_pcs,
      total_upah: t.total_upah,
      total_dibayar: totalDibayar,
      sisa,
      status_pembayaran: statusPembayaran,
      tanggal_bayar_terakhir: lastPayment?.dibayar_pada || null,
      dibayar_oleh_nama: lastPayment?.payer?.nama || null,
      project_details: Object.values(t.projectDetailsMap),
      payments: paymentRecords,
    };
  });

  initialSummary.sort((a, b) => b.total_pcs_disetujui - a.total_pcs_disetujui);

  return (
    <RekapClient
      initialSummary={initialSummary}
      weekOptions={weekOptions}
      currentWeekStartDate={currentWeek.startDate}
    />
  );
}
