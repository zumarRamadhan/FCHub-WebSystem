import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PenjahitDetailClient, TailorDetailData } from "./detail-client";
import { getWeekDateRange, calculateEntryWage, determineWagePaymentStatus } from "@/lib/wage";
import { WeeklyWagePaymentStatus, WagePaymentProjectDetail } from "@/lib/types/database";

interface PageProps {
  params: { id: string };
}

export default async function PenjahitDetailPage({ params }: PageProps) {
  const supabase = createClient();
  const tailorId = params.id;

  // 1. Ambil data profil penjahit
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, nama, username, role, aktif, created_at")
    .eq("id", tailorId)
    .single();

  if (userError || !user || user.role !== "penjahit") {
    notFound();
  }

  // 2. Ambil statistik seumur hidup
  let summary = {
    total_pcs: 0,
    total_pendapatan: 0,
    total_proyek: 0,
    total_hari_kerja: 0,
    rata_rata_pcs_per_hari: 0,
    total_sudah_dibayar: 0,
    total_belum_dibayar: 0,
  };

  const { data: viewSummary } = await supabase
    .from("v_tailor_summary")
    .select("*")
    .eq("user_id", tailorId)
    .maybeSingle();

  if (viewSummary) {
    summary = {
      total_pcs: Number(viewSummary.total_pcs_seumur_hidup || 0),
      total_pendapatan: Number(viewSummary.total_pendapatan_seumur_hidup || 0),
      total_proyek: Number(viewSummary.total_proyek_dikerjakan || 0),
      total_hari_kerja: Number(viewSummary.total_hari_kerja || 0),
      rata_rata_pcs_per_hari: Number(viewSummary.rata_rata_pcs_per_hari || 0),
      total_sudah_dibayar: Number(viewSummary.total_sudah_dibayar || 0),
      total_belum_dibayar: Number(viewSummary.total_belum_dibayar || 0),
    };
  }

  // 3. Ambil seluruh entri produksi disetujui milik penjahit ini (Aturan Bisnis #1 & #2)
  const { data: rawEntries } = await supabase
    .from("production_entries")
    .select(`
      id,
      project_id,
      tanggal_kerja,
      qty_disetujui,
      tarif_snapshot,
      projects (
        id,
        nama,
        status,
        target_pcs,
        tarif_per_pcs,
        ambang_reward
      )
    `)
    .eq("user_id", tailorId)
    .eq("status", "disetujui")
    .order("tanggal_kerja", { ascending: false });

  interface EntryRow {
    id: string;
    project_id: string;
    tanggal_kerja: string;
    qty_disetujui: number | null;
    tarif_snapshot: number;
    projects: {
      id: string;
      nama: string;
      status: string;
      target_pcs: number;
      tarif_per_pcs: number;
      reward_aktif?: boolean;
      ambang_reward: number;
    } | null;
  }

  const entries = (rawEntries as unknown as EntryRow[]) || [];

  // Ambil total pcs disetujui per proyek dari seluruh penjahit (untuk menghitung kontribusi %)
  const { data: projectProgressData } = await supabase
    .from("v_project_progress")
    .select("project_id, total_pcs_disetujui");

  // Ambil status reward_aktif dari tabel projects
  const { data: rawProjectsTable } = await supabase
    .from("projects")
    .select("id, reward_aktif");

  const rewardAktifMap: Record<string, boolean> = {};
  (rawProjectsTable || []).forEach((p) => {
    rewardAktifMap[p.id] = Boolean(p.reward_aktif);
  });

  const projectTotalPcsMap: Record<string, number> = {};
  (projectProgressData || []).forEach((pp) => {
    projectTotalPcsMap[pp.project_id] = Number(pp.total_pcs_disetujui || 0);
  });

  // 4. Hitung Proyek yang Dikerjakan
  const projectMap: Record<
    string,
    {
      project_id: string;
      nama_proyek: string;
      status_proyek: string;
      total_pcs: number;
      total_upah: number;
      reward_aktif: boolean;
      ambang_reward: number;
      tanggal_pertama: string;
      tanggal_terakhir: string;
    }
  > = {};

  entries.forEach((e) => {
    const q = Number(e.qty_disetujui || 0);
    const wage = calculateEntryWage("disetujui", q, Number(e.tarif_snapshot || 500));
    const prj = e.projects;
    const pId = e.project_id;
    const isRewardAktif = rewardAktifMap[pId] ?? Boolean(prj?.reward_aktif);

    if (!projectMap[pId]) {
      projectMap[pId] = {
        project_id: pId,
        nama_proyek: prj?.nama || "Proyek Konveksi",
        status_proyek: prj?.status || "aktif",
        total_pcs: 0,
        total_upah: 0,
        reward_aktif: isRewardAktif,
        ambang_reward: Number(prj?.ambang_reward || 0),
        tanggal_pertama: e.tanggal_kerja,
        tanggal_terakhir: e.tanggal_kerja,
      };
    }

    projectMap[pId].total_pcs += q;
    projectMap[pId].total_upah += wage;
    if (e.tanggal_kerja < projectMap[pId].tanggal_pertama) {
      projectMap[pId].tanggal_pertama = e.tanggal_kerja;
    }
    if (e.tanggal_kerja > projectMap[pId].tanggal_terakhir) {
      projectMap[pId].tanggal_terakhir = e.tanggal_kerja;
    }
  });

  const projectsList = Object.values(projectMap).map((p) => {
    const grandPcs = projectTotalPcsMap[p.project_id] || p.total_pcs;
    const persenKontribusi =
      grandPcs > 0 ? Math.round((p.total_pcs / grandPcs) * 1000) / 10 : 0;
    const melewatiReward =
      p.reward_aktif && p.ambang_reward > 0 && p.total_pcs >= p.ambang_reward;

    return {
      project_id: p.project_id,
      nama_proyek: p.nama_proyek,
      status_proyek: p.status_proyek,
      total_pcs: p.total_pcs,
      total_upah: p.total_upah,
      persen_kontribusi: persenKontribusi,
      reward_aktif: p.reward_aktif,
      melewati_ambang_reward: melewatiReward,
      ambang_reward: p.ambang_reward,
      tanggal_pertama_kerja: p.tanggal_pertama,
      tanggal_terakhir_kerja: p.tanggal_terakhir,
    };
  });

  // Jika viewSummary belum ada, lengkapi summary dari data fallback
  if (!viewSummary) {
    let fallbackPcs = 0;
    let fallbackUpah = 0;
    const distinctDates = new Set<string>();

    entries.forEach((e) => {
      const q = Number(e.qty_disetujui || 0);
      fallbackPcs += q;
      fallbackUpah += calculateEntryWage("disetujui", q, Number(e.tarif_snapshot || 500));
      distinctDates.add(e.tanggal_kerja);
    });

    summary.total_pcs = fallbackPcs;
    summary.total_pendapatan = fallbackUpah;
    summary.total_proyek = Object.keys(projectMap).length;
    summary.total_hari_kerja = distinctDates.size;
    summary.rata_rata_pcs_per_hari =
      distinctDates.size > 0 ? Math.round(fallbackPcs / distinctDates.size) : 0;
  }

  // 5. Ambil Catatan Pembayaran (wage_payments) untuk penjahit ini
  const { data: rawPayments } = await supabase
    .from("wage_payments")
    .select(`
      id,
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
      payer:dibayar_oleh (nama),
      canceler:dibatalkan_oleh (nama)
    `)
    .eq("user_id", tailorId)
    .order("created_at", { ascending: false });

  interface RawPaymentRow {
    id: string;
    periode_mulai: string;
    periode_selesai: string;
    total_pcs: number;
    jumlah: number;
    rincian: WagePaymentProjectDetail[];
    status: "dibayar" | "dibatalkan";
    catatan: string | null;
    dibayar_pada: string;
    dibatalkan_pada: string | null;
    alasan_batal: string | null;
    payer: { nama: string } | null;
    canceler: { nama: string } | null;
  }

  const paymentsHistory = ((rawPayments as unknown as RawPaymentRow[]) || []).map((p) => ({
    id: p.id,
    periode_mulai: p.periode_mulai,
    periode_selesai: p.periode_selesai,
    total_pcs: Number(p.total_pcs),
    jumlah: Number(p.jumlah),
    rincian: p.rincian || [],
    status: p.status,
    catatan: p.catatan,
    dibayar_pada: p.dibayar_pada,
    dibatalkan_pada: p.dibatalkan_pada,
    alasan_batal: p.alasan_batal,
    dibayar_oleh_nama: p.payer?.nama || "Owner",
    dibatalkan_oleh_nama: p.canceler?.nama || null,
  }));

  // Update total sudah dibayar dan belum dibayar bila belum terisi dari view
  if (!viewSummary) {
    let totalPaid = 0;
    paymentsHistory.forEach((p) => {
      if (p.status === "dibayar") {
        totalPaid += p.jumlah;
      }
    });
    summary.total_sudah_dibayar = totalPaid;
    summary.total_belum_dibayar = Math.max(0, summary.total_pendapatan - totalPaid);
  }

  // 6. Agregasi Histori Mingguan
  // Kelompokkan entri disetujui per minggu upah
  const paymentsByWeek: Record<string, { total: number; lastDate: string | null }> = {};
  paymentsHistory.forEach((p) => {
    if (p.status === "dibayar") {
      if (!paymentsByWeek[p.periode_mulai]) {
        paymentsByWeek[p.periode_mulai] = { total: 0, lastDate: null };
      }
      paymentsByWeek[p.periode_mulai].total += p.jumlah;
      if (
        !paymentsByWeek[p.periode_mulai].lastDate ||
        p.dibayar_pada > paymentsByWeek[p.periode_mulai].lastDate!
      ) {
        paymentsByWeek[p.periode_mulai].lastDate = p.dibayar_pada;
      }
    }
  });

  const weeklyMap: Record<
    string,
    {
      week_start: string;
      week_end: string;
      total_pcs: number;
      total_upah: number;
      projectDetailsMap: Record<
        string,
        { project_id: string; nama_proyek: string; tarif_snapshot: number; total_pcs: number; subtotal: number }
      >;
      dailyDetails: Array<{
        id: string;
        tanggal_kerja: string;
        nama_proyek: string;
        qty_disetujui: number;
        tarif_snapshot: number;
        subtotal: number;
      }>;
    }
  > = {};

  entries.forEach((e) => {
    const { startDate, endDate } = getWeekDateRange(e.tanggal_kerja);
    const q = Number(e.qty_disetujui || 0);
    const wage = calculateEntryWage("disetujui", q, Number(e.tarif_snapshot || 500));
    const prjNama = e.projects?.nama || "Proyek Konveksi";

    if (!weeklyMap[startDate]) {
      weeklyMap[startDate] = {
        week_start: startDate,
        week_end: endDate,
        total_pcs: 0,
        total_upah: 0,
        projectDetailsMap: {},
        dailyDetails: [],
      };
    }

    weeklyMap[startDate].total_pcs += q;
    weeklyMap[startDate].total_upah += wage;

    // Rincian per proyek pada minggu ini
    if (!weeklyMap[startDate].projectDetailsMap[e.project_id]) {
      weeklyMap[startDate].projectDetailsMap[e.project_id] = {
        project_id: e.project_id,
        nama_proyek: prjNama,
        tarif_snapshot: Number(e.tarif_snapshot),
        total_pcs: 0,
        subtotal: 0,
      };
    }
    weeklyMap[startDate].projectDetailsMap[e.project_id].total_pcs += q;
    weeklyMap[startDate].projectDetailsMap[e.project_id].subtotal += wage;

    // Rincian harian
    weeklyMap[startDate].dailyDetails.push({
      id: e.id,
      tanggal_kerja: e.tanggal_kerja,
      nama_proyek: prjNama,
      qty_disetujui: q,
      tarif_snapshot: Number(e.tarif_snapshot),
      subtotal: wage,
    });
  });

  // Tambahkan juga minggu yang punya pembayaran tapi tidak punya entri
  Object.keys(paymentsByWeek).forEach((wStart) => {
    if (!weeklyMap[wStart]) {
      const { startDate, endDate } = getWeekDateRange(wStart);
      weeklyMap[wStart] = {
        week_start: startDate,
        week_end: endDate,
        total_pcs: 0,
        total_upah: 0,
        projectDetailsMap: {},
        dailyDetails: [],
      };
    }
  });

  const weeklyHistory = Object.values(weeklyMap)
    .sort((a, b) => b.week_start.localeCompare(a.week_start))
    .map((w) => {
      const paidInfo = paymentsByWeek[w.week_start] || { total: 0, lastDate: null };
      const statusPembayaran: WeeklyWagePaymentStatus = determineWagePaymentStatus(
        w.total_upah,
        paidInfo.total
      );
      const sisa = Math.max(0, w.total_upah - paidInfo.total);

      return {
        week_start: w.week_start,
        week_end: w.week_end,
        total_pcs: w.total_pcs,
        total_upah: w.total_upah,
        total_dibayar: paidInfo.total,
        sisa,
        status_pembayaran: statusPembayaran,
        tanggal_bayar_terakhir: paidInfo.lastDate,
        project_details: Object.values(w.projectDetailsMap),
        daily_details: w.dailyDetails.sort((a, b) => b.tanggal_kerja.localeCompare(a.tanggal_kerja)),
      };
    });

  // 7. Data 8 Minggu Terakhir untuk Grafik Pendapatan
  const { startDate: currentWeekStart } = getWeekDateRange();
  const last8WeeksData: Array<{
    weekLabel: string;
    startDate: string;
    endDate: string;
    upah: number;
    pcs: number;
  }> = [];

  for (let i = 7; i >= 0; i--) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - i * 7);
    const dateStr = d.toISOString().split("T")[0];
    const { startDate, endDate } = getWeekDateRange(dateStr);

    const weekItem = weeklyMap[startDate];
    const upah = weekItem ? weekItem.total_upah : 0;
    const pcs = weekItem ? weekItem.total_pcs : 0;

    // Format label ringkas: misal "21 Nov" atau "W-x"
    const startObj = new Date(startDate);
    const day = startObj.getDate();
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agt",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];
    const label = `${day} ${monthNames[startObj.getMonth()]}`;

    last8WeeksData.push({
      weekLabel: label,
      startDate,
      endDate,
      upah,
      pcs,
    });
  }

  const initialData: TailorDetailData = {
    penjahit: {
      id: user.id,
      nama: user.nama,
      username: user.username,
      aktif: user.aktif,
      created_at: user.created_at,
    },
    summary,
    projects: projectsList,
    weeklyHistory,
    paymentsHistory,
    chartData: last8WeeksData,
  };

  return <PenjahitDetailClient data={initialData} />;
}
