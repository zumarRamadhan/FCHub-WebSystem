import { createClient } from "@/lib/supabase/server";
import {
  RekapClient,
  PenjahitWageRekapItem,
  ProjectWageDetail,
  WagePaymentRecordItem,
} from "./rekap-client";
import {
  getWeekDateRange,
  getMonthDateRange,
  getYearDateRange,
  determineWagePaymentStatus,
} from "@/lib/wage";
import { WageReportData } from "@/lib/types/database";
import { ProjectSelectItem } from "@/components/project-select";
import { getTodayJakarta } from "@/lib/dates";

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

export default async function OwnerRekapPage({
  searchParams,
}: {
  searchParams?: {
    mode?: string;
    dari?: string;
    sampai?: string;
    project?: string;
  };
}) {
  const supabase = createClient();
  const todayStr = getTodayJakarta();
  const now = new Date();

  const mode = (searchParams?.mode || "minggu") as "minggu" | "bulan" | "tahun" | "kustom";
  const selectedProject = searchParams?.project || "all";

  // 1. Ambil daftar seluruh proyek untuk filter ProjectSelect
  const { data: rawProjects } = await supabase
    .from("projects")
    .select("id, nama, status, warna, target_pcs")
    .order("status", { ascending: true })
    .order("nama", { ascending: true });

  const availableProjects: ProjectSelectItem[] = (rawProjects || []).map((p) => ({
    id: p.id,
    nama: p.nama,
    status: p.status,
    warna: p.warna,
    target_pcs: p.target_pcs,
  }));

  // 2. Ambil rentang tanggal data yang tersedia dari RPC get_wage_period_options()
  let periodOptions = {
    minDate: todayStr,
    maxDate: todayStr,
  };

  try {
    const { data: periodData, error: periodErr } = await supabase.rpc("get_wage_period_options");
    if (!periodErr && periodData && periodData.length > 0) {
      periodOptions = {
        minDate: periodData[0].min_date || todayStr,
        maxDate: periodData[0].max_date || todayStr,
      };
    } else {
      // Fallback query langsung
      const { data: minRow } = await supabase
        .from("production_entries")
        .select("tanggal_kerja")
        .eq("status", "disetujui")
        .order("tanggal_kerja", { ascending: true })
        .limit(1);

      const { data: maxRow } = await supabase
        .from("production_entries")
        .select("tanggal_kerja")
        .eq("status", "disetujui")
        .order("tanggal_kerja", { ascending: false })
        .limit(1);

      if (minRow && minRow.length > 0) periodOptions.minDate = minRow[0].tanggal_kerja;
      if (maxRow && maxRow.length > 0) periodOptions.maxDate = maxRow[0].tanggal_kerja;
    }
  } catch {
    // Fallback
  }

  // 3. Tentukan Rentang Tanggal Sesuai Mode
  let currentStartDate = searchParams?.dari;
  let currentEndDate = searchParams?.sampai;

  if (mode === "minggu") {
    const targetDate = searchParams?.dari || todayStr;
    const [{ data: dbStart }, { data: dbEnd }] = await Promise.all([
      supabase.rpc("get_week_start", { p_date: targetDate }),
      supabase.rpc("get_week_end", { p_date: targetDate }),
    ]);
    if (dbStart && dbEnd) {
      currentStartDate = String(dbStart);
      currentEndDate = String(dbEnd);
    } else {
      const weekRange = getWeekDateRange(targetDate);
      currentStartDate = weekRange.startDate;
      currentEndDate = weekRange.endDate;
    }
  } else if (mode === "bulan") {
    if (!currentStartDate || !currentEndDate) {
      const monthRange = getMonthDateRange(now.getFullYear(), now.getMonth() + 1);
      currentStartDate = monthRange.startDate;
      currentEndDate = monthRange.endDate;
    }
  } else if (mode === "tahun") {
    if (!currentStartDate || !currentEndDate) {
      const yearRange = getYearDateRange(now.getFullYear());
      currentStartDate = yearRange.startDate;
      currentEndDate = yearRange.endDate;
    }
  } else {
    // mode kustom
    if (!currentStartDate || !currentEndDate) {
      const monthRange = getMonthDateRange(now.getFullYear(), now.getMonth() + 1);
      currentStartDate = monthRange.startDate;
      currentEndDate = monthRange.endDate;
    }
  }

  // 4. Data Mode Mingguan: Operasional Pembayaran Lengkap
  let initialSummary: PenjahitWageRekapItem[] = [];

  if (mode === "minggu") {
    // Ambil entri disetujui pada minggu terpilih
    let entriesQuery = supabase
      .from("production_entries")
      .select(`
        user_id,
        project_id,
        qty_disetujui,
        tarif_snapshot,
        users:users!user_id ( nama, username ),
        projects ( nama )
      `)
      .eq("status", "disetujui")
      .gte("tanggal_kerja", currentStartDate)
      .lte("tanggal_kerja", currentEndDate);

    if (selectedProject !== "all") {
      entriesQuery = entriesQuery.eq("project_id", selectedProject);
    }

    const { data: rawEntries } = await entriesQuery;
    const entries = (rawEntries as unknown as RawEntryRow[]) || [];

    // Ambil catatan pembayaran wage_payments pada minggu terpilih
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
      .eq("periode_mulai", currentStartDate);

    const payments = (rawPayments as unknown as RawPaymentRow[]) || [];

    // Agregasi entri per penjahit dan per proyek
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
          rincian_tarif: [],
        };
      }

      tailorMap[userId].projectDetailsMap[prjId].total_pcs += qty;
      tailorMap[userId].projectDetailsMap[prjId].subtotal += qty * tarif;

      const existingRates = tailorMap[userId].projectDetailsMap[prjId].rincian_tarif || [];
      const foundRate = existingRates.find((r) => r.tarif === tarif);
      if (foundRate) {
        foundRate.pcs += qty;
        foundRate.subtotal += qty * tarif;
      } else {
        existingRates.push({ tarif, pcs: qty, subtotal: qty * tarif });
      }
      existingRates.sort((a, b) => a.tarif - b.tarif);
      tailorMap[userId].projectDetailsMap[prjId].rincian_tarif = existingRates;
      tailorMap[userId].projectDetailsMap[prjId].tarif_min = existingRates[0]?.tarif ?? tarif;
      tailorMap[userId].projectDetailsMap[prjId].tarif_max =
        existingRates[existingRates.length - 1]?.tarif ?? tarif;
      tailorMap[userId].projectDetailsMap[prjId].tarif_rata_rata =
        tailorMap[userId].projectDetailsMap[prjId].total_pcs > 0
          ? Math.round(
              tailorMap[userId].projectDetailsMap[prjId].subtotal /
                tailorMap[userId].projectDetailsMap[prjId].total_pcs
            )
          : tarif;
    });

    // Pastikan penjahit yang punya pembayaran tapi tidak punya entri tetap masuk
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

    initialSummary = Object.values(tailorMap).map((t) => {
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
  }

  // 5. Data Mode Laporan (Bulanan, Tahunan, Kustom): Panggil RPC get_wage_report
  let initialReport: WageReportData | null = null;

  if (mode !== "minggu") {
    try {
      const cleanProject = selectedProject !== "all" ? selectedProject : null;
      const { data: reportData, error: reportErr } = await supabase.rpc("get_wage_report", {
        p_mulai: currentStartDate,
        p_selesai: currentEndDate,
        p_project: cleanProject,
      });

      if (!reportErr && reportData) {
        initialReport = reportData as unknown as WageReportData;
      }
    } catch {
      // Fallback
    }
  }

  return (
    <RekapClient
      initialMode={mode}
      initialStartDate={currentStartDate}
      initialEndDate={currentEndDate}
      initialProjectId={selectedProject}
      availableProjects={availableProjects}
      periodOptions={periodOptions}
      initialSummary={initialSummary}
      initialReport={initialReport}
    />
  );
}
