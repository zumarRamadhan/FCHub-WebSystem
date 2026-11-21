"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
  XCircle,
  Filter,
  History,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatNumber, formatRupiah, formatDateId } from "@/lib/format";
import { getPaymentStatusBadgeInfo } from "@/lib/wage";
import { WeeklyWagePaymentStatus, WagePaymentProjectDetail } from "@/lib/types/database";
import { markWagePaidAction } from "@/app/owner/rekap/actions";

export interface TailorDetailData {
  penjahit: {
    id: string;
    nama: string;
    username: string;
    aktif: boolean;
    created_at?: string;
  };
  summary: {
    total_pcs: number;
    total_pendapatan: number;
    total_proyek: number;
    total_hari_kerja: number;
    rata_rata_pcs_per_hari: number;
    total_sudah_dibayar: number;
    total_belum_dibayar: number;
  };
  projects: Array<{
    project_id: string;
    nama_proyek: string;
    status_proyek: string;
    total_pcs: number;
    total_upah: number;
    persen_kontribusi: number;
    melewati_ambang_reward: boolean;
    ambang_reward: number;
    tanggal_pertama_kerja: string;
    tanggal_terakhir_kerja: string;
  }>;
  weeklyHistory: Array<{
    week_start: string;
    week_end: string;
    total_pcs: number;
    total_upah: number;
    total_dibayar: number;
    sisa: number;
    status_pembayaran: WeeklyWagePaymentStatus;
    tanggal_bayar_terakhir: string | null;
    project_details: WagePaymentProjectDetail[];
    daily_details: Array<{
      id: string;
      tanggal_kerja: string;
      nama_proyek: string;
      qty_disetujui: number;
      tarif_snapshot: number;
      subtotal: number;
    }>;
  }>;
  paymentsHistory: Array<{
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
    dibayar_oleh_nama: string;
    dibatalkan_oleh_nama: string | null;
  }>;
  chartData: Array<{
    weekLabel: string;
    startDate: string;
    endDate: string;
    upah: number;
    pcs: number;
  }>;
}

interface DetailProps {
  data: TailorDetailData;
}

export function PenjahitDetailClient({ data }: DetailProps) {
  const { penjahit, summary, projects, chartData } = data;

  // Filter State
  const [timeFilter, setTimeFilter] = React.useState<"all" | "30days">("all");
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("all");

  // State Accordion Minggu Terbuka
  const [expandedWeeks, setExpandedWeeks] = React.useState<Record<string, boolean>>({});

  // State Modal Bayar Sisa
  const [payTargetWeek, setPayTargetWeek] = React.useState<{
    week_start: string;
    week_end: string;
    total_pcs: number;
    sisa: number;
    project_details: WagePaymentProjectDetail[];
  } | null>(null);
  const [payNote, setPayNote] = React.useState("");
  const [isSubmittingPay, setIsSubmittingPay] = React.useState(false);
  const [paySuccessMsg, setPaySuccessMsg] = React.useState<string | null>(null);

  // Inisial Penjahit
  const initials = penjahit.nama
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const toggleWeek = (weekStart: string) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekStart]: !prev[weekStart],
    }));
  };

  // Tangani Submit Pembayaran Tunai Sisa
  const handleConfirmPay = async () => {
    if (!payTargetWeek) return;
    setIsSubmittingPay(true);

    const result = await markWagePaidAction({
      userId: penjahit.id,
      weekStartDate: payTargetWeek.week_start,
      catatan: payNote || undefined,
    });

    if (result.success) {
      setPaySuccessMsg(
        `Pembayaran tunai sebesar ${formatRupiah(payTargetWeek.sisa)} berhasil dicatat.`
      );
      setPayTargetWeek(null);
      setPayNote("");
      // Refresh state lokal
      window.location.reload();
    } else {
      alert(result.error || "Gagal mencatat pembayaran.");
    }
    setIsSubmittingPay(false);
  };

  // Filter Proyek & Histori Mingguan
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  const filteredProjects = projects.filter((p) => {
    if (selectedProjectId !== "all" && p.project_id !== selectedProjectId) return false;
    if (timeFilter === "30days" && p.tanggal_terakhir_kerja < thirtyDaysAgoStr) return false;
    return true;
  });

  const filteredWeeklyHistory = data.weeklyHistory.filter((w) => {
    if (timeFilter === "30days" && w.week_end < thirtyDaysAgoStr) return false;
    if (selectedProjectId !== "all") {
      const hasProject = w.project_details.some((pd) => pd.project_id === selectedProjectId);
      if (!hasProject) return false;
    }
    return true;
  });

  // Perhitungan Grafik SVG 8 Minggu Terakhir
  const maxUpahChart = Math.max(...chartData.map((c) => c.upah), 100000);
  const chartHeight = 160;
  const chartWidth = 580;
  const barWidth = 36;
  const spacing = (chartWidth - barWidth * chartData.length) / (chartData.length + 1);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Tombol Navigasi Kembali */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/owner/penjahit"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Data Penjahit</span>
        </Link>
      </div>

      {/* Pesan Sukses Toast */}
      {paySuccessMsg && (
        <div className="p-3.5 bg-lime-100/90 border border-lime-300 rounded-card text-[13px] text-forest-900 font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-positive shrink-0" />
            <span>{paySuccessMsg}</span>
          </div>
          <button
            onClick={() => setPaySuccessMsg(null)}
            className="text-[12px] font-bold text-forest-900 underline"
          >
            Tutup
          </button>
        </div>
      )}

      {/* ==============================================================================
          1. HEADER PROFIL PENJAHIT & METRIK SEUMUR HIDUP
          ============================================================================== */}
      <Card className="p-5 sm:p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-line/60">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-full bg-forest-900 text-lime-400 font-bold text-[20px] flex items-center justify-center shrink-0 shadow-sm">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[20px] sm:text-[22px] font-bold text-ink leading-tight">
                  {penjahit.nama}
                </h1>
                {penjahit.aktif ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill bg-lime-100 text-positive text-[11px] font-semibold">
                    Aktif Bekerja
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill bg-negative/10 text-negative text-[11px] font-semibold">
                    Nonaktif
                  </span>
                )}
              </div>
              <p className="text-[13px] text-muted mt-0.5 font-mono">
                @{penjahit.username} · Mitra Penjahit Firdaus Collection
              </p>
            </div>
          </div>
        </div>

        {/* Grid 6 Metrik Seumur Hidup */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-5">
          {/* 1. Total Pcs Seumur Hidup */}
          <div className="p-3 bg-surface-muted rounded-panel border border-line">
            <span className="text-[11px] font-medium text-muted block mb-0.5">
              Pcs Disetujui:
            </span>
            <strong className="text-[18px] sm:text-[20px] font-bold text-ink leading-tight tabular-nums block">
              {formatNumber(summary.total_pcs)}{" "}
              <span className="text-[12px] font-normal text-muted">pcs</span>
            </strong>
            <span className="text-[10.5px] text-muted">Seumur hidup</span>
          </div>

          {/* 2. Total Pendapatan */}
          <div className="p-3 bg-surface-muted rounded-panel border border-line">
            <span className="text-[11px] font-medium text-muted block mb-0.5">
              Total Pendapatan:
            </span>
            <strong className="text-[17px] sm:text-[18px] font-bold text-forest-900 leading-tight tabular-nums block truncate">
              {formatRupiah(summary.total_pendapatan)}
            </strong>
            <span className="text-[10.5px] text-muted">Entri disetujui</span>
          </div>

          {/* 3. Proyek Dikerjakan */}
          <div className="p-3 bg-surface-muted rounded-panel border border-line">
            <span className="text-[11px] font-medium text-muted block mb-0.5">
              Proyek Dikerjakan:
            </span>
            <strong className="text-[18px] sm:text-[20px] font-bold text-ink leading-tight tabular-nums block">
              {summary.total_proyek}{" "}
              <span className="text-[12px] font-normal text-muted">pesanan</span>
            </strong>
            <span className="text-[10.5px] text-muted">Pernah berkontribusi</span>
          </div>

          {/* 4. Rata-rata Pcs/Hari */}
          <div className="p-3 bg-surface-muted rounded-panel border border-line">
            <span className="text-[11px] font-medium text-muted block mb-0.5">
              Rata-rata Harian:
            </span>
            <strong className="text-[18px] sm:text-[20px] font-bold text-ink leading-tight tabular-nums block">
              {formatNumber(summary.rata_rata_pcs_per_hari)}{" "}
              <span className="text-[12px] font-normal text-muted">pcs/hr</span>
            </strong>
            <span className="text-[10.5px] text-muted">{summary.total_hari_kerja} hari kerja</span>
          </div>

          {/* 5. Sudah Dibayar Tunai */}
          <div className="p-3 bg-lime-50 rounded-panel border border-lime-200">
            <span className="text-[11px] font-medium text-positive block mb-0.5">
              Sudah Dibayar:
            </span>
            <strong className="text-[17px] sm:text-[18px] font-bold text-positive leading-tight tabular-nums block truncate">
              {formatRupiah(summary.total_sudah_dibayar)}
            </strong>
            <span className="text-[10.5px] text-positive">Tunai diserahkan</span>
          </div>

          {/* 6. Belum Dibayar Tunai */}
          <div className="p-3 bg-warning/10 rounded-panel border border-warning/30">
            <span className="text-[11px] font-medium text-[#B77407] block mb-0.5">
              Belum Dibayar:
            </span>
            <strong className="text-[17px] sm:text-[18px] font-bold text-[#B77407] leading-tight tabular-nums block truncate">
              {formatRupiah(summary.total_belum_dibayar)}
            </strong>
            <span className="text-[10.5px] text-[#B77407]">Sisa akumulasi</span>
          </div>
        </div>
      </Card>

      {/* ==============================================================================
          2. GRAFIK PENDAPATAN 8 MINGGU TERAKHIR (SVG BAR CHART TANPA LIBRARY)
          ============================================================================== */}
      <Card className="p-5 sm:p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-line/60 mb-4">
          <div>
            <h3 className="text-[16px] font-semibold text-ink leading-snug flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-forest-900" />
              Tren Pendapatan 8 Minggu Terakhir
            </h3>
            <p className="text-[12px] text-muted">
              Distribusi penghasilan disetujui penjahit per siklus Sabtu (WIB)
            </p>
          </div>
          <span className="text-[11px] font-semibold text-forest-900 bg-surface-muted px-2.5 py-1 rounded-pill border border-line">
            Puncak: {formatRupiah(maxUpahChart)}
          </span>
        </div>

        {/* SVG Container */}
        <div className="w-full overflow-x-auto pb-2">
          <div className="min-w-[500px]">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight + 35}`}
              className="w-full h-auto overflow-visible select-none"
            >
              {/* Garis Grid Horizontal */}
              <line
                x1="0"
                y1="10"
                x2={chartWidth}
                y2="10"
                stroke="currentColor"
                strokeDasharray="4 4"
                className="text-line"
              />
              <line
                x1="0"
                y1={chartHeight / 2}
                x2={chartWidth}
                y2={chartHeight / 2}
                stroke="currentColor"
                strokeDasharray="4 4"
                className="text-line"
              />
              <line
                x1="0"
                y1={chartHeight}
                x2={chartWidth}
                y2={chartHeight}
                stroke="currentColor"
                className="text-line stroke-[1.5]"
              />

              {/* Bar Tiap Minggu */}
              {chartData.map((item, idx) => {
                const x = spacing + idx * (barWidth + spacing);
                const barH =
                  item.upah > 0
                    ? Math.max(6, Math.round((item.upah / maxUpahChart) * (chartHeight - 20)))
                    : 3;
                const y = chartHeight - barH;

                const isHighest = item.upah === maxUpahChart && item.upah > 0;

                return (
                  <g key={item.startDate} className="group">
                    {/* Tooltip Hover Background */}
                    <title>
                      {`${item.weekLabel}: ${formatRupiah(item.upah)} (${formatNumber(item.pcs)} pcs)`}
                    </title>

                    {/* Bar Bar */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barH}
                      rx={5}
                      className={`transition-all duration-300 ${
                        item.upah > 0
                          ? isHighest
                            ? "fill-lime-400 group-hover:fill-lime-500"
                            : "fill-forest-900 group-hover:fill-forest-800"
                          : "fill-surface-muted"
                      }`}
                    />

                    {/* Nominal Angka di Atas Bar */}
                    {item.upah > 0 && (
                      <text
                        x={x + barWidth / 2}
                        y={Math.max(12, y - 6)}
                        textAnchor="middle"
                        className="text-[10.5px] font-semibold fill-forest-900"
                      >
                        {item.upah >= 1000000
                          ? `${(item.upah / 1000000).toFixed(1)}jt`
                          : `${Math.round(item.upah / 1000)}rb`}
                      </text>
                    )}

                    {/* Label Sumbu X (Tanggal Minggu) */}
                    <text
                      x={x + barWidth / 2}
                      y={chartHeight + 18}
                      textAnchor="middle"
                      className="text-[11px] font-medium fill-muted"
                    >
                      {item.weekLabel}
                    </text>
                    <text
                      x={x + barWidth / 2}
                      y={chartHeight + 30}
                      textAnchor="middle"
                      className="text-[10px] fill-muted/70"
                    >
                      {item.pcs > 0 ? `${formatNumber(item.pcs)} pcs` : "-"}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </Card>

      {/* ==============================================================================
          3. BAR FILTER: WAKTU & PROYEK
          ============================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-surface rounded-card border border-line">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-forest-900" />
          <span className="text-[13px] font-semibold text-ink">Filter Tampilan Data:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filter Waktu */}
          <div className="inline-flex rounded-pill p-1 bg-surface-muted border border-line text-[12px]">
            <button
              type="button"
              onClick={() => setTimeFilter("all")}
              className={`px-3 py-1 rounded-pill font-semibold transition ${
                timeFilter === "all"
                  ? "bg-forest-900 text-white shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              Semua Waktu
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter("30days")}
              className={`px-3 py-1 rounded-pill font-semibold transition ${
                timeFilter === "30days"
                  ? "bg-forest-900 text-white shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              30 Hari Terakhir
            </button>
          </div>

          {/* Filter Proyek */}
          <div className="relative">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="h-9 px-3 pr-8 rounded-pill bg-surface-muted border border-line text-[12px] font-semibold text-ink focus:outline-none focus:border-forest-900 appearance-none cursor-pointer"
            >
              <option value="all">Semua Proyek ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.project_id} value={p.project_id}>
                  {p.nama_proyek}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ==============================================================================
          4. KARTU "PROYEK YANG DIKERJAKAN"
          ============================================================================== */}
      <Card className="p-5 sm:p-6 shadow-card">
        <div className="flex items-center justify-between pb-3 border-b border-line/60 mb-4">
          <div>
            <h3 className="text-[16px] font-semibold text-ink leading-snug flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-forest-900" />
              Proyek yang Dikerjakan ({filteredProjects.length})
            </h3>
            <p className="text-[12px] text-muted">
              Rincian kontribusi pcs, estimasi upah per proyek, dan kualifikasi reward
            </p>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="text-center py-8 text-muted text-[13px]">
            Tidak ada proyek yang sesuai dengan kriteria filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredProjects.map((prj) => (
              <div
                key={prj.project_id}
                className="p-4 rounded-card border border-line bg-surface hover:border-forest-900/40 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="text-[15px] font-semibold text-ink leading-snug">
                        {prj.nama_proyek}
                      </h4>
                      <p className="text-[11px] text-muted mt-0.5">
                        Status:{" "}
                        <span className="font-semibold capitalize text-ink">
                          {prj.status_proyek}
                        </span>
                      </p>
                    </div>

                    {/* Penanda Reward bila Melewati Ambang */}
                    {prj.melewati_ambang_reward ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold">
                        <Sparkles className="w-3 h-3 text-amber-600 fill-amber-500" /> Kualifikasi Reward
                      </span>
                    ) : prj.ambang_reward > 0 ? (
                      <span className="text-[11px] text-muted bg-surface-muted px-2 py-0.5 rounded-pill">
                        Target Reward: {formatNumber(prj.ambang_reward)} pcs
                      </span>
                    ) : null}
                  </div>

                  {/* Metrik Pcs & Upah */}
                  <div className="grid grid-cols-2 gap-2 my-2.5 p-2.5 bg-surface-muted rounded-panel text-[12px]">
                    <div>
                      <span className="text-[11px] text-muted block">Hasil Kerja:</span>
                      <strong className="text-positive text-[15px] font-bold tabular-nums block">
                        {formatNumber(prj.total_pcs)} pcs
                      </strong>
                      <span className="text-[10.5px] text-muted">
                        Kontribusi {prj.persen_kontribusi}% proyek
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-muted block">Total Upah:</span>
                      <strong className="text-forest-900 text-[15px] font-bold tabular-nums block">
                        {formatRupiah(prj.total_upah)}
                      </strong>
                      <span className="text-[10.5px] text-muted">Disetujui</span>
                    </div>
                  </div>
                </div>

                {/* Tanggal Mulai & Terakhir */}
                <div className="pt-2.5 border-t border-line/60 text-[11px] text-muted flex items-center justify-between">
                  <span>Mulai: {formatDateId(prj.tanggal_pertama_kerja)}</span>
                  <span>Terakhir: {formatDateId(prj.tanggal_terakhir_kerja)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ==============================================================================
          5. HISTORI MINGGUAN DENGAN ACCORDION RINCIAN HARIAN & PER PROYEK
          ============================================================================== */}
      <Card className="p-5 sm:p-6 shadow-card">
        <div className="flex items-center justify-between pb-3 border-b border-line/60 mb-4">
          <div>
            <h3 className="text-[16px] font-semibold text-ink leading-snug flex items-center gap-2">
              <Calendar className="w-4 h-4 text-forest-900" />
              Histori Mingguan ({filteredWeeklyHistory.length} Minggu)
            </h3>
            <p className="text-[12px] text-muted">
              Daftar minggu upah, status bayar tunai, dan rincian kerja harian
            </p>
          </div>
        </div>

        {filteredWeeklyHistory.length === 0 ? (
          <div className="text-center py-8 text-muted text-[13px]">
            Belum ada histori produksi pada rentang waktu yang dipilih.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWeeklyHistory.map((item) => {
              const badgeInfo = getPaymentStatusBadgeInfo(item.status_pembayaran);
              const isExpanded = !!expandedWeeks[item.week_start];

              return (
                <div
                  key={item.week_start}
                  className="border border-line rounded-card overflow-hidden bg-surface transition-all"
                >
                  {/* Header Baris Minggu (Klik untuk expand) */}
                  <div
                    onClick={() => toggleWeek(item.week_start)}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-surface-muted/60 select-none transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-ink">
                          {formatDateId(item.week_start)} – {formatDateId(item.week_end)}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-semibold ${badgeInfo.bgClass} ${badgeInfo.textClass}`}
                        >
                          {badgeInfo.label}
                        </span>
                      </div>
                      {item.tanggal_bayar_terakhir && (
                        <p className="text-[11px] text-muted mt-0.5">
                          Dibayar pada {formatDateId(item.tanggal_bayar_terakhir)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      <div className="text-right">
                        <div className="flex items-baseline gap-1.5 justify-end">
                          <span className="text-[16px] font-bold text-positive tabular-nums">
                            {formatNumber(item.total_pcs)} pcs
                          </span>
                          <span className="text-[14px] font-bold text-forest-900 tabular-nums">
                            ({formatRupiah(item.total_upah)})
                          </span>
                        </div>
                        {item.sisa > 0 && (
                          <span className="text-[11px] text-warning font-semibold block">
                            Sisa belum dibayar: {formatRupiah(item.sisa)}
                          </span>
                        )}
                      </div>

                      <div className="w-8 h-8 rounded-full bg-surface-muted flex items-center justify-center text-muted shrink-0">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Body Accordion: Rincian per Proyek, per Hari, & Tombol Bayar Sisa */}
                  {isExpanded && (
                    <div className="p-4 pt-3 border-t border-line/60 bg-surface-muted/40 space-y-3.5 text-[12px]">
                      {/* Rincian per Proyek */}
                      {item.project_details.length > 0 && (
                        <div>
                          <span className="text-[11px] font-bold uppercase text-muted block mb-1.5">
                            Rincian per Proyek Minggu Ini:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {item.project_details.map((pd) => (
                              <div
                                key={pd.project_id}
                                className="p-2.5 rounded-panel bg-surface border border-line flex items-center justify-between"
                              >
                                <div>
                                  <strong className="text-ink block text-[13px]">
                                    {pd.nama_proyek}
                                  </strong>
                                  <span className="text-muted text-[11px]">
                                    {pd.total_pcs} pcs × {formatRupiah(pd.tarif_snapshot)}
                                  </span>
                                </div>
                                <span className="font-semibold text-forest-900 tabular-nums text-[13px]">
                                  {formatRupiah(pd.subtotal)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rincian Produksi Harian */}
                      {item.daily_details.length > 0 && (
                        <div>
                          <span className="text-[11px] font-bold uppercase text-muted block mb-1.5">
                            Rincian Kerja Harian:
                          </span>
                          <div className="border border-line rounded-panel overflow-hidden bg-surface">
                            <table className="w-full text-left">
                              <thead className="bg-surface-muted/60 text-muted text-[11px] uppercase border-b border-line">
                                <tr>
                                  <th className="py-1.5 px-3">Tanggal</th>
                                  <th className="py-1.5 px-3">Proyek</th>
                                  <th className="py-1.5 px-3 text-right">Pcs Disetujui</th>
                                  <th className="py-1.5 px-3 text-right">Upah</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-line/60">
                                {item.daily_details.map((day) => (
                                  <tr key={day.id} className="hover:bg-surface-muted/30">
                                    <td className="py-1.5 px-3 font-medium text-ink">
                                      {formatDateId(day.tanggal_kerja)}
                                    </td>
                                    <td className="py-1.5 px-3 text-muted truncate max-w-[150px]">
                                      {day.nama_proyek}
                                    </td>
                                    <td className="py-1.5 px-3 text-right font-semibold text-positive tabular-nums">
                                      {formatNumber(day.qty_disetujui)}
                                    </td>
                                    <td className="py-1.5 px-3 text-right font-semibold text-forest-900 tabular-nums">
                                      {formatRupiah(day.subtotal)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Baris Tombol Aksi "Tandai Dibayar" jika masih ada Sisa Upah */}
                      {item.sisa > 0 && (
                        <div className="pt-2 flex items-center justify-between bg-lime-50/70 p-3 rounded-panel border border-lime-200">
                          <div>
                            <span className="text-[11px] font-bold text-forest-900 block">
                              Sisa Upah Belum Dibayar: {formatRupiah(item.sisa)}
                            </span>
                            <span className="text-[11px] text-muted">
                              Bayar sisa upah tunai untuk minggu ini
                            </span>
                          </div>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              setPayTargetWeek({
                                week_start: item.week_start,
                                week_end: item.week_end,
                                total_pcs: item.total_pcs,
                                sisa: item.sisa,
                                project_details: item.project_details,
                              })
                            }
                            className="h-8 px-3 text-[12px]"
                          >
                            <Banknote className="w-3.5 h-3.5 mr-1" />
                            Tandai Dibayar
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ==============================================================================
          6. "RIWAYAT PEMBAYARAN" (AUDIT TRAIL WAGE_PAYMENTS)
          ============================================================================== */}
      <Card className="p-5 sm:p-6 shadow-card">
        <div className="flex items-center justify-between pb-3 border-b border-line/60 mb-4">
          <div>
            <h3 className="text-[16px] font-semibold text-ink leading-snug flex items-center gap-2">
              <History className="w-4 h-4 text-forest-900" />
              Riwayat Transaksi Pembayaran ({data.paymentsHistory.length})
            </h3>
            <p className="text-[12px] text-muted">
              Jejak audit seluruh pencatatan pembayaran tunai dan pembatalan
            </p>
          </div>
        </div>

        {data.paymentsHistory.length === 0 ? (
          <div className="text-center py-8 text-muted text-[13px]">
            Belum ada transaksi pembayaran tunai yang pernah dicatat untuk penjahit ini.
          </div>
        ) : (
          <div className="space-y-3">
            {data.paymentsHistory.map((pay) => {
              const isCancelled = pay.status === "dibatalkan";

              return (
                <div
                  key={pay.id}
                  className={`p-3.5 rounded-card border transition ${
                    isCancelled
                      ? "bg-negative/5 border-negative/20 opacity-80"
                      : "bg-surface border-line"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[16px] font-bold tabular-nums ${
                            isCancelled ? "text-negative line-through" : "text-forest-900"
                          }`}
                        >
                          {formatRupiah(pay.jumlah)}
                        </span>
                        {isCancelled ? (
                          <span className="inline-flex items-center px-2 py-0.2 rounded-pill bg-negative/10 text-negative text-[10.5px] font-bold">
                            Dibatalkan
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.2 rounded-pill bg-lime-100 text-positive text-[10.5px] font-bold">
                            Dibayar Tunai
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-muted mt-0.5">
                        Periode: {formatDateId(pay.periode_mulai)} – {formatDateId(pay.periode_selesai)} · Dicatat oleh: {pay.dibayar_oleh_nama} ({formatDateId(pay.dibayar_pada)})
                      </p>
                    </div>

                    <span className="text-[12px] font-medium text-muted">
                      {formatNumber(pay.total_pcs)} pcs disetujui
                    </span>
                  </div>

                  {pay.catatan && (
                    <p className="text-[12px] text-ink mt-2 bg-surface-muted p-2 rounded-panel">
                      <strong className="text-muted">Catatan:</strong> {pay.catatan}
                    </p>
                  )}

                  {/* Alasan Pembatalan Wajib Ditampilkan */}
                  {isCancelled && (
                    <div className="mt-2.5 p-2.5 rounded-panel bg-negative/10 border border-negative/20 text-[12px] text-negative">
                      <div className="flex items-center gap-1.5 font-bold mb-0.5">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Alasan Pembatalan:</span>
                      </div>
                      <p className="text-ink">{pay.alasan_batal || "-"}</p>
                      <p className="text-[11px] text-muted mt-1">
                        Dibatalkan oleh: {pay.dibatalkan_oleh_nama || "Owner"} pada{" "}
                        {pay.dibatalkan_pada ? formatDateId(pay.dibatalkan_pada) : "-"}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ==============================================================================
          DIALOG MODAL: TANDAI DIBAYAR SISA (DARI HALAMAN DETAIL)
          ============================================================================== */}
      <Dialog
        isOpen={!!payTargetWeek}
        onClose={() => setPayTargetWeek(null)}
        title="Konfirmasi Pembayaran Sisa Upah"
        subtitle="Pastikan uang tunai telah diserahkan langsung kepada penjahit."
      >
        {payTargetWeek && (
          <div className="space-y-3.5 py-1 text-[13px]">
            <div className="p-3 bg-surface-muted rounded-panel border border-line space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted">Nama Penjahit:</span>
                <strong className="text-ink">{penjahit.nama}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Periode Minggu:</span>
                <span>
                  {formatDateId(payTargetWeek.week_start)} - {formatDateId(payTargetWeek.week_end)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total Disetujui:</span>
                <span className="font-semibold">{formatNumber(payTargetWeek.total_pcs)} pcs</span>
              </div>
            </div>

            {/* Nominal Pembayaran Sisa */}
            <div className="p-3.5 bg-lime-100/60 rounded-panel border border-lime-300/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-positive uppercase block">
                  Jumlah Dibayar Tunai (Sisa):
                </span>
                <div className="text-[22px] font-bold text-forest-900 tabular-nums">
                  {formatRupiah(payTargetWeek.sisa)}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-positive bg-white px-2 py-0.5 rounded-pill border border-positive/30">
                Bayar Sisa
              </span>
            </div>

            {/* Catatan Opsional */}
            <div>
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
                Catatan Pembayaran (Opsional):
              </label>
              <input
                type="text"
                placeholder="Contoh: Diserahkan tunai di kantor"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                className="w-full px-3 py-2 rounded-panel border border-line bg-surface-muted text-ink text-[13px] focus:outline-none focus:border-forest-900"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-line/60 mt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPayTargetWeek(null)}
                disabled={isSubmittingPay}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmPay}
                disabled={isSubmittingPay}
              >
                {isSubmittingPay ? "Menyimpan..." : "Konfirmasi Bayar Tunai"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
