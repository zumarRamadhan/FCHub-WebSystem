import Link from "next/link";
import {
  Package,
  Clock,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Trophy,
  CheckSquare,
  Layers,
  CheckCircle2,
  Briefcase,
  FolderArchive,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { CardAccent } from "@/components/ui/card-accent";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { RingProgress } from "@/components/ui/ring-progress";
import { createClient } from "@/lib/supabase/server";
import {
  formatNumber,
  formatRupiah,
  formatDateId,
  getJakartaTodayString,
} from "@/lib/format";
import {
  getWeekDateRange,
  calculateEntryWage,
  calculateTotalWage,
  calculateTotalApprovedPcs,
  estimateProjectCompletion,
  ProjectCompletionEstimate,
} from "@/lib/wage";
import { EntryStatus } from "@/lib/types/database";
import { DailyProductionChart, DailyProductionItem } from "@/components/dashboard/daily-production-chart";
import { BelumInputCard, TailorItem } from "@/components/dashboard/belum-input-card";

interface ProjectProgressRow {
  project_id: string;
  nama_proyek: string;
  target_pcs: number;
  tarif_per_pcs: number;
  ambang_reward: number;
  status_proyek: string;
  tanggal_mulai: string;
  deadline: string;
  total_pcs_disetujui: number;
  persentase_progres: number;
  sisa_target_pcs: number;
  total_entri_menunggu: number;
}

interface RawWeekRow {
  id: string;
  user_id: string;
  project_id: string;
  qty: number;
  qty_disetujui: number | null;
  tarif_snapshot: number;
  status: EntryStatus;
  tanggal_kerja: string;
  users: { nama: string } | null;
  projects: { nama: string; tarif_per_pcs: number } | null;
}

interface OwnerLeaderboardRow {
  user_id: string;
  nama_penjahit: string;
  total_pcs_disetujui: number;
  total_upah: number;
  melewati_ambang_reward: boolean;
}

interface RawPreviewRow {
  id: string;
  tanggal_kerja: string;
  qty: number;
  users: { nama: string } | null;
  projects: { nama: string } | null;
}

function getDeadlineStatus(deadlineStr: string) {
  if (!deadlineStr) return { label: "-", isLate: false };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineStr);
  deadline.setHours(0, 0, 0, 0);
  const diffTime = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: `Lewat ${Math.abs(diffDays)} hari`, isLate: true };
  } else if (diffDays === 0) {
    return { label: "Hari ini", isLate: false };
  } else {
    return { label: `${diffDays} hari lagi`, isLate: false };
  }
}

function renderDeadlineBadge(estimate?: ProjectCompletionEstimate) {
  if (!estimate || estimate.statusDeadline === "tanpa_deadline") return null;

  if (estimate.statusDeadline === "selesai") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-lime-100 text-positive text-[11px] font-bold">
        <CheckCircle2 className="w-3 h-3" /> Target Tercapai
      </span>
    );
  }

  if (estimate.statusDeadline === "aman") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-lime-100 text-positive text-[11px] font-bold">
        <CheckCircle2 className="w-3 h-3" /> Aman
      </span>
    );
  }

  if (estimate.statusDeadline === "terlambat") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-red-100 text-negative text-[11px] font-bold">
        <Clock className="w-3 h-3" /> Terlambat {estimate.selisihHariTerlambat} hr
      </span>
    );
  }

  if (estimate.statusDeadline === "belum_cukup_data") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-surface-muted border border-line text-muted text-[11px] font-medium">
        <Clock className="w-3 h-3 opacity-60" /> Belum cukup data
      </span>
    );
  }

  return null;
}

export default async function OwnerDashboardPage({
  searchParams,
}: {
  searchParams?: { project?: string };
}) {
  const supabase = createClient();
  const { startDate, endDate } = getWeekDateRange();
  const selectedProjectParam = searchParams?.project || "all";

  // 1. Ambil seluruh data progres proyek dari view v_project_progress
  const { data: rawProjects } = await supabase
    .from("v_project_progress")
    .select("*")
    .order("status_proyek", { ascending: true }) // 'aktif' first
    .order("tanggal_mulai", { ascending: false });

  const allProjects: ProjectProgressRow[] = (rawProjects || []).map((p) => ({
    project_id: p.project_id,
    nama_proyek: p.nama_proyek,
    target_pcs: Number(p.target_pcs || 0),
    tarif_per_pcs: Number(p.tarif_per_pcs || 500),
    ambang_reward: Number(p.ambang_reward || 0),
    status_proyek: p.status_proyek || "aktif",
    tanggal_mulai: p.tanggal_mulai,
    deadline: p.deadline,
    total_pcs_disetujui: Number(p.total_pcs_disetujui || 0),
    persentase_progres: Number(p.persentase_progres || 0),
    sisa_target_pcs: Number(p.sisa_target_pcs || 0),
    total_entri_menunggu: Number(p.total_entri_menunggu || 0),
  }));

  const activeProjects = allProjects.filter((p) => p.status_proyek === "aktif");
  const completedProjects = allProjects.filter((p) => p.status_proyek === "selesai");

  // Deteksi mode tampilan
  const isAllProjectsView = selectedProjectParam === "all";
  const isCompletedView = selectedProjectParam === "completed";
  const isSingleProjectView = !isAllProjectsView && !isCompletedView;

  // Proyek spesifik yang dipilih (bila mode satu proyek)
  const selectedProject = isSingleProjectView
    ? allProjects.find((p) => p.project_id === selectedProjectParam) || activeProjects[0]
    : null;

  // 2. Query entri disetujui minggu ini (Aturan Bisnis #1, #2, #3: upah = qty_disetujui * tarif_snapshot)
  let weekQuery = supabase
    .from("production_entries")
    .select(`
      id,
      user_id,
      project_id,
      qty,
      qty_disetujui,
      tarif_snapshot,
      status,
      tanggal_kerja,
      users:users!user_id (
        nama
      ),
      projects (
        nama,
        tarif_per_pcs
      )
    `)
    .eq("status", "disetujui")
    .gte("tanggal_kerja", startDate)
    .lte("tanggal_kerja", endDate);

  if (isSingleProjectView && selectedProject) {
    weekQuery = weekQuery.eq("project_id", selectedProject.project_id);
  }

  const { data: rawWeekEntries } = await weekQuery;
  const weekEntries = (rawWeekEntries as unknown as RawWeekRow[]) || [];

  // Hitung upah dan pcs minggu ini memakai rumus terpusat di lib/wage.ts
  const weekPcsTotal = calculateTotalApprovedPcs(weekEntries);
  const weekWageTotal = calculateTotalWage(weekEntries);

  // Agregasi top penjahit minggu ini (performa upah)
  const userWeekMap: Record<string, { nama: string; pcs: number; upah: number }> = {};
  weekEntries.forEach((e) => {
    const qty = Number(e.qty_disetujui || 0);
    const tarif = Number(e.tarif_snapshot || 500);
    const wage = calculateEntryWage(e.status, qty, tarif);

    if (!userWeekMap[e.user_id]) {
      userWeekMap[e.user_id] = {
        nama: e.users?.nama || "Penjahit",
        pcs: 0,
        upah: 0,
      };
    }
    userWeekMap[e.user_id].pcs += qty;
    userWeekMap[e.user_id].upah += wage;
  });

  const topPenjahitMingguIni = Object.values(userWeekMap)
    .sort((a, b) => b.upah - a.upah)
    .slice(0, 4);

  // 3. Query jumlah antrean approval menunggu
  let waitingCountQuery = supabase
    .from("production_entries")
    .select("*", { count: "exact", head: true })
    .eq("status", "menunggu");

  if (isSingleProjectView && selectedProject) {
    waitingCountQuery = waitingCountQuery.eq("project_id", selectedProject.project_id);
  }

  const { count: waitingCount } = await waitingCountQuery;

  // 4. Query antrean singkat approval (maks 4 entri)
  let waitingPreviewQuery = supabase
    .from("production_entries")
    .select(`
      id,
      tanggal_kerja,
      qty,
      users:users!user_id (
        nama
      ),
      projects (
        nama
      )
    `)
    .eq("status", "menunggu")
    .order("dibuat_pada", { ascending: false })
    .limit(4);

  if (isSingleProjectView && selectedProject) {
    waitingPreviewQuery = waitingPreviewQuery.eq("project_id", selectedProject.project_id);
  }

  const { data: rawWaitingPreview } = await waitingPreviewQuery;
  const waitingPreview = ((rawWaitingPreview as unknown as RawPreviewRow[]) || []).map((e) => ({
    id: e.id,
    tanggal_kerja: e.tanggal_kerja,
    qty: Number(e.qty),
    nama_penjahit: e.users?.nama || "Penjahit",
    nama_proyek: e.projects?.nama || "Proyek Konveksi",
  }));

  // 5. Query Leaderboard lengkap (hanya untuk mode Satu Proyek)
  let projectLeaderboard: OwnerLeaderboardRow[] = [];
  if (isSingleProjectView && selectedProject) {
    const { data: lbData } = await supabase
      .from("v_leaderboard")
      .select("*")
      .eq("project_id", selectedProject.project_id)
      .order("total_pcs_disetujui", { ascending: false });

    if (lbData && lbData.length > 0) {
      projectLeaderboard = (lbData as unknown as OwnerLeaderboardRow[]).map((r) => ({
        user_id: r.user_id,
        nama_penjahit: r.nama_penjahit,
        total_pcs_disetujui: Number(r.total_pcs_disetujui || 0),
        total_upah: Number(r.total_upah || 0),
        melewati_ambang_reward: Boolean(r.melewati_ambang_reward),
      }));
    }
  }

  // 6. Tanggal Hari Ini & Kemarin (Asia/Jakarta) dan Rentang 7 Hari Terakhir
  const todayDateStr = getJakartaTodayString();
  const [ty, tm, td] = todayDateStr.split("-").map(Number);

  const yesterdayDateObj = new Date(ty, tm - 1, td - 1);
  const yYear = yesterdayDateObj.getFullYear();
  const yMonth = String(yesterdayDateObj.getMonth() + 1).padStart(2, "0");
  const yDay = String(yesterdayDateObj.getDate()).padStart(2, "0");
  const yesterdayDateStr = `${yYear}-${yMonth}-${yDay}`;

  const last7DaysList: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(ty, tm - 1, td - i);
    const yearStr = d.getFullYear();
    const monthStr = String(d.getMonth() + 1).padStart(2, "0");
    const dayStr = String(d.getDate()).padStart(2, "0");
    last7DaysList.push(`${yearStr}-${monthStr}-${dayStr}`);
  }
  const startDate7DaysStr = last7DaysList[0];

  // A. Ambil entri 7 hari terakhir yang disetujui untuk estimasi & grafik bar
  const { data: rawEntries7Hari } = await supabase
    .from("production_entries")
    .select("project_id, tanggal_kerja, qty_disetujui, status")
    .eq("status", "disetujui")
    .gte("tanggal_kerja", startDate7DaysStr)
    .lte("tanggal_kerja", todayDateStr);
  const entries7Hari = rawEntries7Hari || [];

  // B. Ambil seluruh penjahit aktif
  const { data: rawTailors } = await supabase
    .from("users")
    .select("id, nama, username")
    .eq("role", "penjahit")
    .eq("aktif", true)
    .order("nama", { ascending: true });
  const activeTailors: TailorItem[] = (rawTailors || []).map((t) => ({
    id: t.id,
    nama: t.nama,
    username: t.username,
  }));

  // C. Ambil entri hari ini & kemarin (SEMUA status) untuk penentuan "Belum Input"
  const { data: rawRecentEntriesAllStatus } = await supabase
    .from("production_entries")
    .select("user_id, tanggal_kerja, status")
    .in("tanggal_kerja", [todayDateStr, yesterdayDateStr]);
  const recentEntries = rawRecentEntriesAllStatus || [];

  const todaySubmittedUserIds = Array.from(
    new Set(
      recentEntries
        .filter((e) => e.tanggal_kerja === todayDateStr)
        .map((e) => e.user_id)
    )
  );
  const yesterdaySubmittedUserIds = Array.from(
    new Set(
      recentEntries
        .filter((e) => e.tanggal_kerja === yesterdayDateStr)
        .map((e) => e.user_id)
    )
  );

  // D. Hitung estimasi selesai untuk setiap proyek aktif
  const projectEstimatesMap: Record<string, ProjectCompletionEstimate> = {};
  allProjects.forEach((p) => {
    const projectEntries = entries7Hari.filter((e) => e.project_id === p.project_id);
    projectEstimatesMap[p.project_id] = estimateProjectCompletion({
      targetPcs: p.target_pcs,
      totalPcsDisetujui: p.total_pcs_disetujui,
      deadline: p.deadline,
      todayDateStr,
      entries7Hari: projectEntries,
    });
  });

  // E. Siapkan data grafik 7 hari harian untuk cakupan yang dipilih
  const dayNamesShort = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  let chartSourceEntries = entries7Hari;
  if (isSingleProjectView && selectedProject) {
    chartSourceEntries = entries7Hari.filter((e) => e.project_id === selectedProject.project_id);
  }
  const chartData: DailyProductionItem[] = last7DaysList.map((dStr) => {
    const [y, m, d] = dStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayLabel = dayNamesShort[dateObj.getDay()];
    const dateLabel = `${d}/${m}`;
    const pcs = chartSourceEntries
      .filter((e) => e.tanggal_kerja === dStr)
      .reduce((sum, e) => sum + Number(e.qty_disetujui || 0), 0);
    return {
      date: dStr,
      dayLabel,
      dateLabel,
      pcs,
      isToday: dStr === todayDateStr,
    };
  });

  return (
    <div className="space-y-6">
      {/* ==============================================================================
          0. CHIP PEMILIH PROYEK HORIZONTAL
          ============================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-line/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] sm:text-[22px] font-semibold text-ink leading-tight">
              Dashboard Produksi
            </h1>
            <span className="px-2.5 py-0.5 rounded-pill bg-surface-muted border border-line text-[11px] font-semibold text-muted">
              {isAllProjectsView
                ? "Semua Proyek"
                : isCompletedView
                ? "Arsip Selesai"
                : selectedProject?.nama_proyek}
            </span>
          </div>
          <p className="text-[12px] sm:text-[13px] text-muted mt-0.5">
            Monitoring progres pesanan konveksi, efektivitas penjahit, dan rekap upah mingguan.
          </p>
        </div>

        {/* Tautan Cepat Kelola Proyek */}
        <Link href="/owner/proyek" className="shrink-0">
          <Button variant="secondary" size="sm" className="h-9 px-3.5 text-[12px]">
            <Briefcase className="w-3.5 h-3.5 mr-1.5" />
            Kelola Proyek
          </Button>
        </Link>
      </div>

      {/* Baris Chip Selector Horizontal */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {/* Chip 1: Semua Proyek */}
        <Link
          href="/owner/dashboard?project=all"
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-pill text-[13px] font-semibold whitespace-nowrap transition-all select-none ${
            isAllProjectsView
              ? "bg-forest-900 text-white shadow-sm ring-2 ring-forest-900/20"
              : "bg-surface border border-line text-muted hover:text-ink hover:border-forest-900/30"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Semua proyek</span>
          <span
            className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
              isAllProjectsView ? "bg-lime-400 text-forest-900" : "bg-surface-muted text-muted"
            }`}
          >
            {activeProjects.length}
          </span>
        </Link>

        {/* Chip per Proyek Aktif */}
        {activeProjects.map((p) => {
          const isSelected = selectedProjectParam === p.project_id;
          const pct = Math.min(100, Math.round(Number(p.persentase_progres || 0)));
          const shortName =
            p.nama_proyek.length > 20 ? p.nama_proyek.slice(0, 18) + "…" : p.nama_proyek;

          return (
            <Link
              key={p.project_id}
              href={`/owner/dashboard?project=${p.project_id}`}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-pill text-[13px] font-semibold whitespace-nowrap transition-all select-none ${
                isSelected
                  ? "bg-forest-900 text-white shadow-sm ring-2 ring-forest-900/20"
                  : "bg-surface border border-line text-muted hover:text-ink hover:border-forest-900/30"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>{shortName}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                  isSelected ? "bg-lime-400 text-forest-900" : "bg-surface-muted text-forest-900"
                }`}
              >
                {pct}%
              </span>
            </Link>
          );
        })}

        {/* Chip Proyek Selesai */}
        <Link
          href="/owner/dashboard?project=completed"
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-pill text-[13px] font-semibold whitespace-nowrap transition-all select-none ${
            isCompletedView
              ? "bg-forest-900 text-white shadow-sm ring-2 ring-forest-900/20"
              : "bg-surface border border-line text-muted hover:text-ink hover:border-forest-900/30"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Selesai</span>
          {completedProjects.length > 0 && (
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                isCompletedView ? "bg-lime-400 text-forest-900" : "bg-surface-muted text-muted"
              }`}
            >
              {completedProjects.length}
            </span>
          )}
        </Link>
      </div>

      {/* ==============================================================================
          1. TAMPILAN: SEMUA PROYEK (DEFAULT / ?project=all)
          ============================================================================== */}
      {isAllProjectsView && (
        <div className="space-y-6">
          {/* A. 4 Kartu Ringkasan Akumulasi Lintas Proyek */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Proyek Aktif */}
            <Card className="p-4 sm:p-5 shadow-card flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                  Proyek Berjalan
                </span>
                <strong className="text-[26px] sm:text-[28px] font-bold text-ink leading-tight tabular-nums block">
                  {activeProjects.length}{" "}
                  <span className="text-[14px] font-normal text-muted">proyek</span>
                </strong>
              </div>
              <p className="text-[12px] text-muted mt-2 pt-2 border-t border-line/60 flex items-center justify-between">
                <span>Total pesanan aktif</span>
                <Link href="/owner/proyek" className="font-semibold text-forest-900 hover:underline">
                  Lihat →
                </Link>
              </p>
            </Card>

            {/* 2. Total Pcs Disetujui Minggu Ini */}
            <Card className="p-4 sm:p-5 shadow-card flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                  Produksi Minggu Ini
                </span>
                <strong className="text-[26px] sm:text-[28px] font-bold text-positive leading-tight tabular-nums block">
                  {formatNumber(weekPcsTotal)}{" "}
                  <span className="text-[14px] font-normal text-muted">pcs</span>
                </strong>
              </div>
              <p className="text-[12px] text-muted mt-2 pt-2 border-t border-line/60">
                Disetujui lintas seluruh proyek
              </p>
            </Card>

            {/* 3. Total Upah Minggu Ini Lintas Proyek */}
            <Card className="p-4 sm:p-5 shadow-card flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
                  Upah Minggu Ini
                </span>
                <strong className="text-[24px] sm:text-[26px] font-bold text-forest-900 leading-tight tabular-nums block">
                  {formatRupiah(weekWageTotal)}
                </strong>
              </div>
              <p className="text-[12px] text-muted mt-2 pt-2 border-t border-line/60 flex items-center justify-between">
                <span>Dibayar tunai Sabtu</span>
                <Link href="/owner/rekap" className="font-semibold text-forest-900 hover:underline">
                  Rekap →
                </Link>
              </p>
            </Card>

            {/* 4. Menunggu Approval Lintas Proyek (Kartu Aksen Lime) */}
            <CardAccent className="p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-forest-900 uppercase tracking-wider">
                    Menunggu Approval
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-pill bg-forest-900 text-lime-400">
                    Pagi Hari
                  </span>
                </div>
                <strong className="text-[26px] sm:text-[28px] font-bold text-forest-900 leading-tight tabular-nums block">
                  {waitingCount || 0}{" "}
                  <span className="text-[14px] font-normal opacity-80">entri</span>
                </strong>
              </div>
              <div className="mt-2 pt-2 border-t border-forest-900/20 flex items-center justify-between text-[12px] font-semibold text-forest-900">
                <span>{waitingCount && waitingCount > 0 ? "Siap diverifikasi" : "Semua diverifikasi"}</span>
                <Link href="/owner/approval">
                  <Button variant="accentAction" size="round36" aria-label="Buka approval" />
                </Link>
              </div>
            </CardAccent>
          </div>

          {/* B. Grafik Tren Produksi 7 Hari & Status Setoran Penjahit */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Card className="lg:col-span-7 p-4 sm:p-5 shadow-card flex flex-col justify-between">
              <DailyProductionChart
                data={chartData}
                title="Tren Produksi 7 Hari Terakhir"
                subtitle="Akumulasi seluruh proyek (hanya entri disetujui)"
              />
            </Card>
            <div className="lg:col-span-5">
              <BelumInputCard
                tailors={activeTailors}
                todayDateStr={todayDateStr}
                yesterdayDateStr={yesterdayDateStr}
                todaySubmittedUserIds={todaySubmittedUserIds}
                yesterdaySubmittedUserIds={yesterdaySubmittedUserIds}
              />
            </div>
          </div>

          {/* C. Grid Kartu Per Proyek Aktif */}
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h2 className="text-[16px] font-semibold text-ink leading-snug">
                  Daftar Proyek Aktif ({activeProjects.length})
                </h2>
                <p className="text-[12px] text-muted">
                  Pilih kartu untuk melihat rincian progres, leaderboard, dan antrean proyek tersebut.
                </p>
              </div>
              <span className="text-[12px] font-medium text-muted hidden sm:inline">
                Klik kartu untuk detail
              </span>
            </div>

            {activeProjects.length === 0 ? (
              <Card className="p-8 text-center text-muted text-[13px]">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Belum ada proyek berstatus aktif saat ini.
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeProjects.map((p) => {
                  const pct = Math.min(100, Math.round(Number(p.persentase_progres || 0)));
                  const deadlineInfo = getDeadlineStatus(p.deadline);
                  const estimate = projectEstimatesMap[p.project_id];

                  return (
                    <Link
                      key={p.project_id}
                      href={`/owner/dashboard?project=${p.project_id}`}
                      className="group block"
                    >
                      <Card className="p-5 h-full flex flex-col justify-between shadow-card hover:border-forest-900/50 hover:shadow-md transition-all">
                        <div>
                          {/* Header Kartu Proyek */}
                          <div className="flex items-start justify-between gap-2 mb-2.5">
                            <div className="min-w-0">
                              <h3 className="text-[15px] font-semibold text-ink leading-snug group-hover:text-forest-900 transition-colors truncate">
                                {p.nama_proyek}
                              </h3>
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-lime-100 text-positive text-[11px] font-bold">
                                  {formatRupiah(p.tarif_per_pcs)} / pcs
                                </span>
                                {renderDeadlineBadge(estimate)}
                              </div>
                            </div>
                          </div>

                          {/* Angka Progres */}
                          <div className="flex items-baseline justify-between mt-3 mb-1.5 text-[13px]">
                            <span className="text-muted">Progres Produksi</span>
                            <span className="font-semibold text-ink tabular-nums">
                              {formatNumber(p.total_pcs_disetujui)}{" "}
                              <span className="text-muted font-normal">
                                / {formatNumber(p.target_pcs)} pcs
                              </span>
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <ProgressBar value={pct} max={100} />

                          {/* Perkiraan Selesai & Tren 7 Hari */}
                          <div className="mt-3.5 pt-3 border-t border-line/60 space-y-1.5 text-[12px]">
                            <div className="flex items-center justify-between">
                              <span className="text-muted text-[11px]">Perkiraan Selesai:</span>
                              <span className="font-semibold text-ink">
                                {estimate?.perkiraanSelesaiDate
                                  ? formatDateId(estimate.perkiraanSelesaiDate)
                                  : "Belum cukup data"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted">Tren 7 Hari:</span>
                              <span className="font-semibold text-forest-900 tabular-nums">
                                {estimate && estimate.rataRataHarian > 0
                                  ? `${formatNumber(estimate.rataRataHarian)} pcs/hr (${estimate.jumlahHariProduksi} hr aktif)`
                                  : "Belum ada tren"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] pt-0.5">
                              <span className="text-muted">Batas Waktu:</span>
                              <span
                                className={`font-medium ${
                                  deadlineInfo.isLate ? "text-negative font-semibold" : "text-ink"
                                }`}
                              >
                                {deadlineInfo.label}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted/70 italic text-right pt-0.5">
                              *Perkiraan kasar tren 7 hari
                            </p>
                          </div>
                        </div>

                        {/* Footer Kartu */}
                        <div className="mt-3 pt-2.5 border-t border-line/60 flex items-center justify-between text-[12px]">
                          <div>
                            {p.total_entri_menunggu > 0 ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-[#B77407] text-[11px]">
                                <Clock className="w-3 h-3" />
                                {p.total_entri_menunggu} menunggu
                              </span>
                            ) : (
                              <span className="text-positive font-medium text-[11px]">Selesai diperiksa</span>
                            )}
                          </div>
                          <span className="text-[12px] font-semibold text-forest-900 group-hover:underline inline-flex items-center gap-1">
                            Detail Proyek <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* C. Bagian Bawah: Produksi Ring + Top Upah Bar + Antrean Singkat (Semua Proyek) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* Produksi Minggu Ini */}
            <Card className="p-5 sm:p-6 shadow-card flex flex-col items-center justify-between text-center">
              <div className="w-full text-left">
                <CardHeader
                  title="Produksi Minggu Ini"
                  subtitle="Cakupan: Seluruh Proyek Aktif"
                />
              </div>

              <div className="py-2">
                <RingProgress
                  value={weekPcsTotal}
                  max={Math.max(1000, weekPcsTotal * 1.2)}
                  size={150}
                  strokeWidth={14}
                  label="pcs disetujui"
                  badge={`Total ${formatNumber(weekPcsTotal)} pcs`}
                />
              </div>

              <p className="text-[12px] text-muted pt-2 border-t border-line/60 w-full text-center">
                Siklus: {formatDateId(startDate)} - {formatDateId(endDate)}
              </p>
            </Card>

            {/* Top Penjahit Minggu Ini */}
            <Card className="p-5 sm:p-6 shadow-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-line/60 mb-3">
                  <div>
                    <h3 className="text-[16px] font-semibold text-ink leading-snug">
                      Upah Minggu Ini
                    </h3>
                    <p className="text-[12px] text-muted">Cakupan: Seluruh Proyek</p>
                  </div>
                  <strong className="text-forest-900 font-semibold text-[15px] tabular-nums">
                    {formatRupiah(weekWageTotal)}
                  </strong>
                </div>

                {topPenjahitMingguIni.length === 0 ? (
                  <div className="text-center py-8 text-muted text-[13px]">
                    Belum ada upah disetujui minggu ini.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topPenjahitMingguIni.map((p) => {
                      const pct =
                        weekWageTotal > 0 ? Math.round((p.upah / weekWageTotal) * 100) : 0;
                      return (
                        <div key={p.nama} className="space-y-1">
                          <div className="flex justify-between text-[12px]">
                            <span className="font-semibold text-ink truncate max-w-[120px]">
                              {p.nama}
                            </span>
                            <span className="font-medium text-forest-900 tabular-nums">
                              {formatRupiah(p.upah)} ({p.pcs} pcs)
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-lime-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-line/60 text-right">
                <Link
                  href="/owner/rekap"
                  className="text-[12px] font-semibold text-forest-900 hover:underline flex items-center justify-end gap-1"
                >
                  Lihat Rekap Lengkap <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>

            {/* Antrean Singkat Approval Lintas Proyek */}
            <Card className="p-5 sm:p-6 shadow-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-line/60 mb-3">
                  <div>
                    <h3 className="text-[16px] font-semibold text-ink leading-snug">
                      Antrean Singkat
                    </h3>
                    <p className="text-[12px] text-muted">Semua proyek menunggu</p>
                  </div>
                  <span className="text-[12px] font-semibold text-[#B77407] bg-warning/15 px-2 py-0.5 rounded-pill tabular-nums">
                    {waitingCount || 0}
                  </span>
                </div>

                {waitingPreview.length === 0 ? (
                  <div className="text-center py-8 text-muted text-[13px]">
                    Semua input sudah diverifikasi.
                  </div>
                ) : (
                  <div className="divide-y divide-line/60">
                    {waitingPreview.map((w) => (
                      <div key={w.id} className="py-2.5 flex items-center justify-between text-[12px]">
                        <div className="min-w-0">
                          <strong className="text-ink block truncate">{w.nama_penjahit}</strong>
                          <span className="text-muted block text-[11px] truncate">
                            {w.nama_proyek} · {formatDateId(w.tanggal_kerja)}
                          </span>
                        </div>
                        <span className="font-semibold text-ink tabular-nums shrink-0">
                          {formatNumber(w.qty)} pcs
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-line/60">
                <Link href="/owner/approval">
                  <Button variant="secondary" size="sm" className="w-full text-[12px]">
                    <CheckSquare className="w-3.5 h-3.5 mr-1" />
                    Buka Antrean Approval
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ==============================================================================
          2. TAMPILAN: SATU PROYEK SPESIFIK (?project=<project_id>)
          ============================================================================== */}
      {isSingleProjectView && selectedProject && (
        <div className="space-y-6">
          {/* Banner Cakupan Proyek */}
          <div className="flex items-center justify-between p-3.5 bg-surface rounded-card border border-line">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-forest-900" />
              <span className="text-[13px] font-semibold text-ink">
                Cakupan: {selectedProject.nama_proyek}
              </span>
            </div>
            <Link
              href="/owner/dashboard?project=all"
              className="text-[12px] font-semibold text-forest-900 hover:underline flex items-center gap-1"
            >
              Lihat Semua Proyek <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Baris 1: Hero Progres Proyek Ini (8 Kolom) + Kartu Lime Antrean Proyek Ini (4 Kolom) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Kartu Hero Progres */}
            <Card className="lg:col-span-8 flex flex-col justify-between p-5 sm:p-6 shadow-card">
              <div>
                <CardHeader
                  icon={<Package className="w-5 h-5 text-forest-900" />}
                  title={selectedProject.nama_proyek}
                  subtitle={`Target Pesanan: ${formatNumber(selectedProject.target_pcs)} pcs`}
                  action={
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-lime-100 text-positive text-[11px] font-semibold">
                        <TrendingUp className="w-3 h-3" /> Berjalan
                      </span>
                      {renderDeadlineBadge(projectEstimatesMap[selectedProject.project_id])}
                    </div>
                  }
                />
                <div className="mt-2">
                  <div className="text-[36px] sm:text-[44px] font-semibold text-ink leading-tight tabular-nums">
                    {formatNumber(selectedProject.total_pcs_disetujui)}{" "}
                    <span className="text-[18px] sm:text-[20px] font-normal text-muted">
                      / {formatNumber(selectedProject.target_pcs)} pcs
                    </span>
                  </div>
                  <p className="text-[13px] text-muted mt-1.5">
                    Tarif:{" "}
                    <strong className="text-forest-900">
                      {formatRupiah(selectedProject.tarif_per_pcs)} / pcs
                    </strong>{" "}
                    · Deadline: {formatDateId(selectedProject.deadline)} (
                    {getDeadlineStatus(selectedProject.deadline).label})
                  </p>

                  {/* Box Perkiraan Selesai & Tren 7 Hari */}
                  <div className="mt-3.5 p-3 sm:p-3.5 bg-surface-muted/60 rounded-card border border-line/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                    <div>
                      <span className="text-muted block text-[11px]">Perkiraan Selesai:</span>
                      <span className="font-bold text-ink text-[13px]">
                        {projectEstimatesMap[selectedProject.project_id]?.perkiraanSelesaiDate
                          ? formatDateId(
                              projectEstimatesMap[selectedProject.project_id].perkiraanSelesaiDate!
                            )
                          : "Belum cukup data"}
                      </span>
                      <span className="text-muted block text-[11px] mt-0.5">
                        Status: {projectEstimatesMap[selectedProject.project_id]?.labelStatus || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-[11px]">Tren 7 Hari Terakhir:</span>
                      <span className="font-bold text-forest-900 text-[13px] tabular-nums">
                        {projectEstimatesMap[selectedProject.project_id] &&
                        projectEstimatesMap[selectedProject.project_id].rataRataHarian > 0
                          ? `${formatNumber(
                              projectEstimatesMap[selectedProject.project_id].rataRataHarian
                            )} pcs / hari`
                          : "Belum ada tren"}
                      </span>
                      <span className="text-muted block text-[11px] mt-0.5">
                        {projectEstimatesMap[selectedProject.project_id]?.jumlahHariProduksi || 0} hari kerja terdeteksi
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted/80 italic mt-1.5">
                    *Perkiraan kasar berdasarkan tren 7 hari (hanya entri disetujui).
                  </p>
                </div>

                <div className="mt-6 space-y-1.5">
                  <div className="flex justify-between text-[12px] text-muted">
                    <span>Persentase Tercapai</span>
                    <span className="font-semibold text-ink tabular-nums">
                      {Math.min(100, Math.round(selectedProject.persentase_progres))}%
                    </span>
                  </div>
                  <ProgressBar
                    value={Math.min(100, Math.round(selectedProject.persentase_progres))}
                    max={100}
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-line/60 flex items-center justify-between text-[12px] text-muted">
                <span>
                  Sisa Target: {formatNumber(selectedProject.sisa_target_pcs)} pcs
                </span>
                <Link
                  href="/owner/proyek"
                  className="font-semibold text-forest-900 hover:underline flex items-center gap-1"
                >
                  Ubah Parameter Proyek <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>

            {/* Kartu Lime: Antrean Approval Proyek Ini */}
            <CardAccent className="lg:col-span-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-forest-900 text-white text-[11px] font-semibold">
                    <Clock className="w-3.5 h-3.5" /> Antrean Proyek Ini
                  </span>
                  <span className="text-[12px] font-semibold text-forest-900/80 bg-forest-900/10 px-2.5 py-0.5 rounded-pill">
                    Pagi Hari
                  </span>
                </div>

                <h3 className="text-[18px] font-semibold text-forest-900 mb-1 leading-snug">
                  Menunggu Approval
                </h3>
                <p className="text-[13px] text-forest-900/80 mb-4">
                  Input penjahit untuk {selectedProject.nama_proyek} yang belum diverifikasi.
                </p>

                <div className="text-[36px] font-semibold text-forest-900 tabular-nums leading-none mb-2">
                  {waitingCount || 0}{" "}
                  <span className="text-[16px] font-medium opacity-80">entri</span>
                </div>
              </div>

              <div className="pt-4 border-t border-forest-900/15 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-forest-900">
                  {waitingCount && waitingCount > 0
                    ? "Buka Antrean Proyek Ini"
                    : "Semua Terverifikasi"}
                </span>
                <Link href={`/owner/approval?project=${selectedProject.project_id}`}>
                  <Button
                    variant="accentAction"
                    size="round36"
                    aria-label="Ke antrean approval proyek ini"
                  />
                </Link>
              </div>
            </CardAccent>
          </div>

          {/* Tren Produksi Harian Proyek Ini + Status Setoran Penjahit */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Card className="lg:col-span-7 p-4 sm:p-5 shadow-card flex flex-col justify-between">
              <DailyProductionChart
                data={chartData}
                title={`Tren Produksi: ${selectedProject.nama_proyek}`}
                subtitle="7 hari terakhir khusus proyek ini (hanya entri disetujui)"
              />
            </Card>
            <div className="lg:col-span-5">
              <BelumInputCard
                tailors={activeTailors}
                todayDateStr={todayDateStr}
                yesterdayDateStr={yesterdayDateStr}
                todaySubmittedUserIds={todaySubmittedUserIds}
                yesterdaySubmittedUserIds={yesterdaySubmittedUserIds}
              />
            </div>
          </div>

          {/* Baris 2: Produksi Minggu Ini + Upah Minggu Ini + Antrean Singkat (Proyek Ini) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Produksi Minggu Ini Proyek Ini */}
            <Card className="p-5 sm:p-6 shadow-card flex flex-col items-center justify-between text-center">
              <div className="w-full text-left">
                <CardHeader
                  title="Produksi Minggu Ini"
                  subtitle={`Cakupan: ${selectedProject.nama_proyek}`}
                />
              </div>

              <div className="py-2">
                <RingProgress
                  value={weekPcsTotal}
                  max={Math.max(500, weekPcsTotal * 1.3)}
                  size={150}
                  strokeWidth={14}
                  label="pcs disetujui"
                  badge={`Total ${formatNumber(weekPcsTotal)} pcs`}
                />
              </div>

              <p className="text-[12px] text-muted pt-2 border-t border-line/60 w-full text-center">
                Siklus: {formatDateId(startDate)} - {formatDateId(endDate)}
              </p>
            </Card>

            {/* Upah Minggu Ini Proyek Ini */}
            <Card className="p-5 sm:p-6 shadow-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-line/60 mb-3">
                  <div>
                    <h3 className="text-[16px] font-semibold text-ink leading-snug">
                      Upah Minggu Ini
                    </h3>
                    <p className="text-[12px] text-muted truncate max-w-[140px]">
                      {selectedProject.nama_proyek}
                    </p>
                  </div>
                  <strong className="text-forest-900 font-semibold text-[15px] tabular-nums">
                    {formatRupiah(weekWageTotal)}
                  </strong>
                </div>

                {topPenjahitMingguIni.length === 0 ? (
                  <div className="text-center py-8 text-muted text-[13px]">
                    Belum ada entri disetujui untuk proyek ini minggu ini.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topPenjahitMingguIni.map((p) => {
                      const pct =
                        weekWageTotal > 0 ? Math.round((p.upah / weekWageTotal) * 100) : 0;
                      return (
                        <div key={p.nama} className="space-y-1">
                          <div className="flex justify-between text-[12px]">
                            <span className="font-semibold text-ink truncate max-w-[120px]">
                              {p.nama}
                            </span>
                            <span className="font-medium text-forest-900 tabular-nums">
                              {formatRupiah(p.upah)} ({p.pcs} pcs)
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-surface-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-lime-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-line/60 text-right">
                <Link
                  href="/owner/rekap"
                  className="text-[12px] font-semibold text-forest-900 hover:underline flex items-center justify-end gap-1"
                >
                  Lihat Rekap Seluruh Upah <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>

            {/* Antrean Singkat Proyek Ini */}
            <Card className="p-5 sm:p-6 shadow-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-line/60 mb-3">
                  <div>
                    <h3 className="text-[16px] font-semibold text-ink leading-snug">
                      Antrean Singkat
                    </h3>
                    <p className="text-[12px] text-muted truncate max-w-[140px]">
                      {selectedProject.nama_proyek}
                    </p>
                  </div>
                  <span className="text-[12px] font-semibold text-[#B77407] bg-warning/15 px-2 py-0.5 rounded-pill tabular-nums">
                    {waitingCount || 0}
                  </span>
                </div>

                {waitingPreview.length === 0 ? (
                  <div className="text-center py-8 text-muted text-[13px]">
                    Semua input proyek ini sudah diverifikasi.
                  </div>
                ) : (
                  <div className="divide-y divide-line/60">
                    {waitingPreview.map((w) => (
                      <div key={w.id} className="py-2.5 flex items-center justify-between text-[12px]">
                        <div className="min-w-0">
                          <strong className="text-ink block truncate">{w.nama_penjahit}</strong>
                          <span className="text-muted block text-[11px] truncate">
                            {formatDateId(w.tanggal_kerja)}
                          </span>
                        </div>
                        <span className="font-semibold text-ink tabular-nums shrink-0">
                          {formatNumber(w.qty)} pcs
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-line/60">
                <Link href={`/owner/approval?project=${selectedProject.project_id}`}>
                  <Button variant="secondary" size="sm" className="w-full text-[12px]">
                    <CheckSquare className="w-3.5 h-3.5 mr-1" />
                    Buka Antrean Proyek Ini
                  </Button>
                </Link>
              </div>
            </Card>
          </div>

          {/* Baris 3: Leaderboard Lengkap Proyek Ini */}
          <Card className="p-5 sm:p-6 shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-line/60 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-forest-900" />
                  <h3 className="text-[18px] font-semibold text-ink">
                    Klasemen Penjahit: {selectedProject.nama_proyek}
                  </h3>
                </div>
                <p className="text-[12px] text-muted mt-0.5">
                  Peringkat pcs disetujui dan akumulasi upah khusus proyek ini.
                </p>
              </div>

              {selectedProject.ambang_reward > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-lime-100 text-positive text-[12px] font-semibold shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-positive" />
                  Ambang Reward: {formatNumber(selectedProject.ambang_reward)} pcs
                </span>
              )}
            </div>

            {projectLeaderboard.length === 0 ? (
              <div className="text-center py-10 text-muted text-[13px]">
                Belum ada hasil produksi yang disetujui pada proyek ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-line text-[12px] font-semibold text-muted uppercase tracking-wider">
                      <th className="py-2.5 px-3 w-14 text-center">Peringkat</th>
                      <th className="py-2.5 px-3">Nama Penjahit</th>
                      <th className="py-2.5 px-3 text-right">Pcs Disetujui</th>
                      <th className="py-2.5 px-3 text-right">Total Upah</th>
                      <th className="py-2.5 px-3 text-center">Kualifikasi Reward</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {projectLeaderboard.map((row, idx) => (
                      <tr key={row.user_id} className="hover:bg-surface-muted/50 transition">
                        <td className="py-3 px-3 text-center font-bold">
                          {idx === 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-forest-900 text-[12px]">
                              1
                            </span>
                          ) : idx === 1 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-forest-900 text-[12px]">
                              2
                            </span>
                          ) : idx === 2 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-600/30 text-amber-900 text-[12px]">
                              3
                            </span>
                          ) : (
                            <span className="text-muted tabular-nums">#{idx + 1}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-semibold text-ink">
                          {row.nama_penjahit}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-ink tabular-nums">
                          {formatNumber(row.total_pcs_disetujui)} pcs
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-forest-900 tabular-nums">
                          {formatRupiah(row.total_upah)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {row.melewati_ambang_reward ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-forest-900 text-lime-400 text-[11px] font-semibold">
                              <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
                              Lolos Reward
                            </span>
                          ) : (
                            <span className="text-muted text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ==============================================================================
          3. TAMPILAN: PROYEK SELESAI (?project=completed)
          ============================================================================== */}
      {isCompletedView && (
        <div className="space-y-6">
          {/* Banner Cakupan Selesai */}
          <div className="flex items-center justify-between p-3.5 bg-surface rounded-card border border-line">
            <div className="flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-forest-900" />
              <span className="text-[13px] font-semibold text-ink">
                Cakupan: Arsip Proyek Selesai ({completedProjects.length} proyek)
              </span>
            </div>
            <Link
              href="/owner/dashboard?project=all"
              className="text-[12px] font-semibold text-forest-900 hover:underline flex items-center gap-1"
            >
              Kembali ke Proyek Aktif <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {completedProjects.length === 0 ? (
            <Card className="p-12 text-center text-muted">
              <div className="w-12 h-12 rounded-[16px] bg-surface-muted text-muted mx-auto flex items-center justify-center mb-3">
                <FolderArchive className="w-6 h-6" />
              </div>
              <h3 className="text-[16px] font-semibold text-ink">
                Belum ada proyek yang selesai
              </h3>
              <p className="text-[13px] text-muted max-w-sm mx-auto mt-1 mb-5">
                Proyek yang telah mencapai target atau telah ditutup akan diarsipkan di sini.
              </p>
              <Link href="/owner/dashboard?project=all">
                <Button variant="secondary" size="sm">
                  Lihat Proyek Aktif
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedProjects.map((p) => {
                const pct = Math.min(100, Math.round(Number(p.persentase_progres || 0)));

                return (
                  <Card
                    key={p.project_id}
                    className="p-5 flex flex-col justify-between shadow-card bg-surface/90"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-[15px] font-semibold text-ink leading-snug">
                          {p.nama_proyek}
                        </h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-surface-muted text-muted text-[11px] font-semibold">
                          <CheckCircle2 className="w-3 h-3 text-positive" /> Selesai
                        </span>
                      </div>

                      <div className="mt-3 mb-1.5 flex items-baseline justify-between text-[13px]">
                        <span className="text-muted">Total Tercapai</span>
                        <span className="font-semibold text-ink tabular-nums">
                          {formatNumber(p.total_pcs_disetujui)} / {formatNumber(p.target_pcs)} pcs
                        </span>
                      </div>

                      <ProgressBar value={pct} max={100} />

                      <div className="mt-4 pt-3 border-t border-line/60 space-y-1 text-[12px] text-muted">
                        <div className="flex justify-between">
                          <span>Tarif Borongan:</span>
                          <strong className="text-ink">{formatRupiah(p.tarif_per_pcs)} / pcs</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Periode:</span>
                          <span>
                            {formatDateId(p.tanggal_mulai)} - {formatDateId(p.deadline)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-line/60 text-right">
                      <Link
                        href={`/owner/dashboard?project=${p.project_id}`}
                        className="text-[12px] font-semibold text-forest-900 hover:underline inline-flex items-center gap-1"
                      >
                        Buka Arsip Proyek <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
