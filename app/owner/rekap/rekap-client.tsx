"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Banknote,
  Calendar,
  CheckCircle2,
  Printer,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Download,
  Search,
  Layers,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { CardAccent } from "@/components/ui/card-accent";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ProjectSelect, ProjectSelectItem } from "@/components/project-select";
import {
  formatNumber,
  formatRupiah,
  formatDateId,
  formatWageCalculation,
  formatMultiTarifSummary,
} from "@/lib/format";
import {
  determineWagePaymentStatus,
  getPaymentStatusBadgeInfo,
  getWeekDateRange,
  shiftWeek,
  getMonthDateRange,
  getYearDateRange,
  getPresetDateRange,
  PresetRangeType,
} from "@/lib/wage";
import {
  WeeklyWagePaymentStatus,
  WageReportData,
} from "@/lib/types/database";
import {
  markWagePaidAction,
  markAllWagesPaidAction,
  cancelWagePaymentAction,
  getWageReportAction,
  getWeekRangeFromDbAction,
} from "./actions";
import { addDays, getTodayJakarta } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";

export interface ProjectWageDetail {
  project_id: string;
  nama_proyek: string;
  tarif_snapshot: number;
  total_pcs: number;
  subtotal: number;
  tarif_min?: number;
  tarif_max?: number;
  tarif_rata_rata?: number;
  rincian_tarif?: Array<{ tarif: number; pcs: number; subtotal: number }>;
}

export interface WagePaymentRecordItem {
  id: string;
  jumlah: number;
  total_pcs: number;
  status: "dibayar" | "dibatalkan";
  catatan: string | null;
  dibayar_pada: string;
  dibayar_oleh_nama: string;
  dibatalkan_pada: string | null;
  dibatalkan_oleh_nama: string | null;
  alasan_batal: string | null;
  rincian: ProjectWageDetail[];
}

export interface PenjahitWageRekapItem {
  user_id: string;
  nama_penjahit: string;
  username_penjahit: string;
  total_pcs_disetujui: number;
  total_upah: number;
  total_dibayar: number;
  sisa: number;
  status_pembayaran: WeeklyWagePaymentStatus;
  tanggal_bayar_terakhir: string | null;
  dibayar_oleh_nama: string | null;
  project_details: ProjectWageDetail[];
  payments: WagePaymentRecordItem[];
}

interface RekapClientProps {
  initialMode?: "minggu" | "bulan" | "tahun" | "kustom";
  initialStartDate: string;
  initialEndDate: string;
  initialProjectId?: string;
  availableProjects: ProjectSelectItem[];
  periodOptions: { minDate: string; maxDate: string };
  initialSummary: PenjahitWageRekapItem[];
  initialReport: WageReportData | null;
}

export function RekapClient({
  initialMode = "minggu",
  initialStartDate,
  initialEndDate,
  initialProjectId = "all",
  availableProjects,
  periodOptions,
  initialSummary,
  initialReport,
}: RekapClientProps) {
  // 1. State Filter Utama
  const [mode, setMode] = React.useState<"minggu" | "bulan" | "tahun" | "kustom">(initialMode);
  const [startDate, setStartDate] = React.useState<string>(initialStartDate);
  const [endDate, setEndDate] = React.useState<string>(initialEndDate);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>(initialProjectId);

  // State Pemilih Bulan & Tahun (Local Form)
  const [selectedMonth, setSelectedMonth] = React.useState<number>(() => {
    const [, m] = initialStartDate.split("-").map(Number);
    return m || new Date().getMonth() + 1;
  });
  const [selectedYear, setSelectedYear] = React.useState<number>(() => {
    const [y] = initialStartDate.split("-").map(Number);
    return y || new Date().getFullYear();
  });

  // 2. Data State
  const [summary, setSummary] = React.useState<PenjahitWageRekapItem[]>(initialSummary);
  const [reportData, setReportData] = React.useState<WageReportData | null>(initialReport);
  const [isLoading, setIsLoading] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // 3. State Interaktif Operasional Mingguan
  const [payModalItem, setPayModalItem] = React.useState<PenjahitWageRekapItem | null>(null);
  const [payNote, setPayNote] = React.useState("");
  const [isSubmittingPay, setIsSubmittingPay] = React.useState(false);

  const [isAllPayModalOpen, setIsAllPayModalOpen] = React.useState(false);
  const [isSubmittingAllPay, setIsSubmittingAllPay] = React.useState(false);

  const [cancelModalPayment, setCancelModalPayment] = React.useState<WagePaymentRecordItem | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const [isSubmittingCancel, setIsSubmittingCancel] = React.useState(false);

  const [expandedUserIds, setExpandedUserIds] = React.useState<Record<string, boolean>>({});

  // 4. State Filter & Interaksi Laporan
  const [tailorSearch, setTailorSearch] = React.useState("");
  const [tailorSortBy, setTailorSortBy] = React.useState<"upah" | "pcs" | "nama">("upah");
  const [tailorPage, setTailorPage] = React.useState(1);
  const [expandedReportTailors, setExpandedReportTailors] = React.useState<Record<string, boolean>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sinkronkan state ke URL Query String
  const updateUrlParams = React.useCallback(
    (newMode: string, newDari: string, newSampai: string, newPrj: string) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams();
      params.set("mode", newMode);
      params.set("dari", newDari);
      params.set("sampai", newSampai);
      if (newPrj !== "all") params.set("project", newPrj);

      const qs = params.toString();
      window.history.replaceState(null, "", `/owner/rekap?${qs}`);
    },
    []
  );

  // Muat data ulang saat parameter periode/filter berubah
  const loadData = React.useCallback(
    async (
      targetMode: "minggu" | "bulan" | "tahun" | "kustom",
      targetStart: string,
      targetEnd: string,
      targetProject: string
    ) => {
      setIsLoading(true);
      updateUrlParams(targetMode, targetStart, targetEnd, targetProject);

      try {
        if (targetMode === "minggu") {
          // Muat data mingguan (operasional)
          const supabase = createClient();
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
            .gte("tanggal_kerja", targetStart)
            .lte("tanggal_kerja", targetEnd);

          if (targetProject !== "all") {
            entriesQuery = entriesQuery.eq("project_id", targetProject);
          }

          const [entriesRes, paymentsRes] = await Promise.all([
            entriesQuery,
            supabase
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
              .eq("periode_mulai", targetStart),
          ]);

          interface RawEntry {
            user_id: string;
            qty_disetujui: number | null;
            tarif_snapshot: number | null;
            project_id: string;
            projects?: { nama?: string } | null;
            users?: { nama?: string; username?: string } | null;
          }

          interface RawPayment {
            id: string;
            user_id: string;
            periode_mulai: string;
            jumlah: number | null;
            total_pcs: number | null;
            status: "dibayar" | "dibatalkan";
            catatan: string | null;
            dibayar_pada: string;
            dibatalkan_pada: string | null;
            alasan_batal: string | null;
            rincian?: unknown;
            payer?: { nama?: string } | null;
            canceller?: { nama?: string } | null;
          }

          interface TailorAcc {
            user_id: string;
            nama_penjahit: string;
            username_penjahit: string;
            total_pcs: number;
            total_upah: number;
            projectDetailsMap: Record<string, ProjectWageDetail>;
          }

          const entries = (entriesRes.data || []) as unknown as RawEntry[];
          const payments = (paymentsRes.data || []) as unknown as RawPayment[];

          const tailorMap: Record<string, TailorAcc> = {};

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
          });

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

          const updatedSummary: PenjahitWageRekapItem[] = Object.values(tailorMap).map((t) => {
            const userPayments = payments.filter((p) => p.user_id === t.user_id);
            const activePayments = userPayments.filter((p) => p.status === "dibayar");
            const totalDibayar = activePayments.reduce((sum: number, p) => sum + Number(p.jumlah || 0), 0);
            const sisa = Math.max(0, t.total_upah - totalDibayar);
            const statusPembayaran = determineWagePaymentStatus(t.total_upah, totalDibayar);
            const lastPayment = activePayments.sort(
              (a, b) => new Date(b.dibayar_pada).getTime() - new Date(a.dibayar_pada).getTime()
            )[0];

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
              payments: userPayments.map((p) => ({
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
              })),
            };
          });

          updatedSummary.sort((a, b) => b.total_pcs_disetujui - a.total_pcs_disetujui);
          setSummary(updatedSummary);
        } else {
          // Muat data laporan (bulan/tahun/kustom) via getWageReportAction
          const reportRes = await getWageReportAction({
            mulai: targetStart,
            selesai: targetEnd,
            projectId: targetProject,
          });

          if (reportRes.success && reportRes.data) {
            setReportData(reportRes.data as WageReportData);
          } else {
            setReportData(null);
          }
        }
      } catch {
        // Fallback
      } finally {
        setIsLoading(false);
      }
    },
    [updateUrlParams]
  );

  // Handler Ganti Mode
  const handleModeChange = async (newMode: "minggu" | "bulan" | "tahun" | "kustom") => {
    setMode(newMode);
    let newStart = startDate;
    let newEnd = endDate;

    if (newMode === "minggu") {
      const res = await getWeekRangeFromDbAction(startDate);
      if (res.success) {
        newStart = res.startDate;
        newEnd = res.endDate;
      } else {
        const range = getWeekDateRange(startDate);
        newStart = range.startDate;
        newEnd = range.endDate;
      }
    } else if (newMode === "bulan") {
      const range = getMonthDateRange(selectedYear, selectedMonth);
      newStart = range.startDate;
      newEnd = range.endDate;
    } else if (newMode === "tahun") {
      const range = getYearDateRange(selectedYear);
      newStart = range.startDate;
      newEnd = range.endDate;
    }

    setStartDate(newStart);
    setEndDate(newEnd);
    loadData(newMode, newStart, newEnd, selectedProjectId);
  };

  // Navigasi Minggu Sebelumnya / Berikutnya
  // Sesuai Aturan #3: Batas awal dan akhir minggu dihitung di database (get_week_start & get_week_end).
  // Tombol hanya menggeser tanggal acuan sebesar +/- 7 hari via addDays (murni UTC string).
  const handleShiftWeek = async (deltaDays: number) => {
    const targetRef = addDays(startDate, deltaDays);
    const res = await getWeekRangeFromDbAction(targetRef);
    if (res.success) {
      setStartDate(res.startDate);
      setEndDate(res.endDate);
      loadData("minggu", res.startDate, res.endDate, selectedProjectId);
    } else {
      const fallback = shiftWeek(startDate, deltaDays > 0 ? 1 : -1);
      setStartDate(fallback.startDate);
      setEndDate(fallback.endDate);
      loadData("minggu", fallback.startDate, fallback.endDate, selectedProjectId);
    }
  };

  // Handler Pilih Tanggal Minggu Langsung
  const handleDirectWeekPick = async (pickedDate: string) => {
    const res = await getWeekRangeFromDbAction(pickedDate);
    if (res.success) {
      setStartDate(res.startDate);
      setEndDate(res.endDate);
      loadData("minggu", res.startDate, res.endDate, selectedProjectId);
    } else {
      const fallback = getWeekDateRange(pickedDate);
      setStartDate(fallback.startDate);
      setEndDate(fallback.endDate);
      loadData("minggu", fallback.startDate, fallback.endDate, selectedProjectId);
    }
  };

  // Handler Pilih Bulan & Tahun
  const handleApplyMonthYear = (y: number, m: number) => {
    setSelectedYear(y);
    setSelectedMonth(m);
    const range = getMonthDateRange(y, m);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    loadData("bulan", range.startDate, range.endDate, selectedProjectId);
  };

  // Handler Pilih Tahun
  const handleApplyYear = (y: number) => {
    setSelectedYear(y);
    const range = getYearDateRange(y);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    loadData("tahun", range.startDate, range.endDate, selectedProjectId);
  };

  // Handler Pintasan Preset
  const handleApplyPreset = (preset: PresetRangeType) => {
    const range = getPresetDateRange(preset);
    let targetMode: "bulan" | "tahun" | "kustom" = "kustom";
    if (preset === "bulan-ini" || preset === "bulan-lalu") targetMode = "bulan";
    if (preset === "tahun-ini") targetMode = "tahun";

    setMode(targetMode);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    loadData(targetMode, range.startDate, range.endDate, selectedProjectId);
  };

  // Eksekusi Konfirmasi Bayar Tunai per Penjahit
  const handleConfirmPay = async () => {
    if (!payModalItem) return;
    setIsSubmittingPay(true);

    const res = await markWagePaidAction({
      userId: payModalItem.user_id,
      weekStartDate: startDate,
      catatan: payNote.trim() || undefined,
    });

    setIsSubmittingPay(false);
    if (res.success) {
      showToast(`Upah ${payModalItem.nama_penjahit} berhasil ditandai dibayar!`);
      setPayModalItem(null);
      setPayNote("");
      loadData("minggu", startDate, endDate, selectedProjectId);
    } else {
      alert(res.error || "Gagal menandai pembayaran.");
    }
  };

  // Eksekusi Konfirmasi Tandai Semua Dibayar
  const handleConfirmAllPay = async () => {
    setIsSubmittingAllPay(true);
    const pendingItems = summary
      .filter((item) => item.sisa > 0)
      .map((item) => ({ userId: item.user_id, sisa: item.sisa }));

    const res = await markAllWagesPaidAction({
      weekStartDate: startDate,
      items: pendingItems,
    });

    setIsSubmittingAllPay(false);
    setIsAllPayModalOpen(false);

    if (res.success) {
      showToast(`${res.count} pembayaran penjahit berhasil ditandai dibayar!`);
      loadData("minggu", startDate, endDate, selectedProjectId);
    } else {
      alert("Gagal menandai seluruh pembayaran.");
    }
  };

  // Eksekusi Konfirmasi Pembatalan Pembayaran
  const handleConfirmCancel = async () => {
    if (!cancelModalPayment) return;
    setCancelError(null);

    if (!cancelReason.trim()) {
      setCancelError("Alasan pembatalan wajib diisi.");
      return;
    }

    setIsSubmittingCancel(true);
    const res = await cancelWagePaymentAction({
      paymentId: cancelModalPayment.id,
      alasan: cancelReason.trim(),
    });

    setIsSubmittingCancel(false);
    if (res.success) {
      showToast("Catatan pembayaran berhasil dibatalkan.");
      setCancelModalPayment(null);
      setCancelReason("");
      loadData("minggu", startDate, endDate, selectedProjectId);
    } else {
      setCancelError(res.error || "Gagal membatalkan catatan.");
    }
  };

  // Fungsi Ekspor CSV Laporan (Dengan BOM UTF-8)
  const handleExportCSV = () => {
    if (!reportData) return;

    let csvContent = "\uFEFF"; // Byte Order Mark agar rapi di Microsoft Excel
    csvContent += "Periode Mulai;Periode Selesai;Nama Penjahit;Username;Proyek;Pcs;Tarif per Pcs;Subtotal Upah\n";

    reportData.per_penjahit.forEach((tailor) => {
      tailor.rincian_proyek.forEach((p) => {
        csvContent += `"${startDate}";"${endDate}";"${tailor.nama_penjahit}";"${tailor.username_penjahit}";"${p.nama_proyek}";${p.pcs};${p.tarif};${p.subtotal}\n`;
      });
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `laporan-upah-fchub-${startDate}-sd-${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Berkas CSV berhasil diunduh.");
  };

  // Hitung total akumulasi mode mingguan
  const grandTotalPcs = summary.reduce((sum, item) => sum + item.total_pcs_disetujui, 0);
  const grandTotalUpah = summary.reduce((sum, item) => sum + item.total_upah, 0);
  const grandTotalDibayar = summary.reduce((sum, item) => sum + item.total_dibayar, 0);
  const grandTotalSisa = summary.reduce((sum, item) => sum + item.sisa, 0);
  const pendingTailorsCount = summary.filter((item) => item.sisa > 0).length;

  // Filter & Urutkan Penjahit Laporan
  const filteredReportTailors = React.useMemo(() => {
    if (!reportData) return [];
    let list = [...reportData.per_penjahit];

    if (tailorSearch.trim()) {
      const q = tailorSearch.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.nama_penjahit.toLowerCase().includes(q) ||
          t.username_penjahit.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (tailorSortBy === "upah") return b.total_upah - a.total_upah;
      if (tailorSortBy === "pcs") return b.total_pcs - a.total_pcs;
      return a.nama_penjahit.localeCompare(b.nama_penjahit, "id");
    });

    return list;
  }, [reportData, tailorSearch, tailorSortBy]);

  // Paginasi Penjahit Laporan (20 baris per halaman)
  const pageSize = 20;
  const totalTailorPages = Math.max(1, Math.ceil(filteredReportTailors.length / pageSize));
  const paginatedTailors = filteredReportTailors.slice(
    (tailorPage - 1) * pageSize,
    tailorPage * pageSize
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Toast Notifikasi Floating */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-forest-900 text-lime-400 px-4 py-2.5 rounded-pill shadow-2xl text-[13px] font-semibold flex items-center gap-2 border border-lime-400/30 animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <CheckCircle2 className="w-4 h-4 text-lime-400 stroke-[2.5]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-line/60 gap-3">
        <div>
          <h1 className="text-[22px] sm:text-[24px] font-semibold text-ink leading-tight">
            Rekap Upah & Laporan Pengeluaran
          </h1>
          <p className="text-[13px] text-muted mt-0.5">
            Pencatatan status bayar tunai Sabtu dan laporan pengeluaran upah periode bebas.
          </p>
        </div>

        {/* Tombol Cetak / Ekspor */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 print:hidden">
          {mode === "minggu" ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Cetak Slip Upah
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleExportCSV}
                disabled={!reportData || reportData.ringkasan.total_upah === 0}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Ekspor CSV
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
                disabled={!reportData || reportData.ringkasan.total_upah === 0}
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Cetak Laporan
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ==============================================================================
          PANEL KONTROL PERIODE UTAMA (DROPDOWN MODE + PINTASAN + FILTER PROYEK)
          ============================================================================== */}
      <div className="bg-surface p-4 sm:p-5 rounded-card border border-line shadow-card space-y-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
          {/* 1. Pemilih Mode Periode (Dropdown) */}
          <div className="md:col-span-4">
            <label className="block text-[11.5px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Mode Periode:
            </label>
            <div className="relative">
              <select
                value={mode}
                onChange={(e) => handleModeChange(e.target.value as "minggu" | "bulan" | "tahun" | "kustom")}
                className="w-full h-11 px-3.5 pr-9 rounded-control bg-surface-muted border border-line text-[13px] font-semibold text-ink focus:outline-none focus:border-forest-900 appearance-none cursor-pointer"
              >
                <option value="minggu">Mingguan (Operasional Pembayaran)</option>
                <option value="bulan">Bulanan (Laporan Pengeluaran)</option>
                <option value="tahun">Tahunan (Laporan Pengeluaran)</option>
                <option value="kustom">Rentang Bebas / Kustom (Laporan)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 2. Filter Proyek (ProjectSelect) */}
          <div className="md:col-span-4">
            <label className="block text-[11.5px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Filter Proyek:
            </label>
            <ProjectSelect
              projects={availableProjects}
              selectedProjectId={selectedProjectId}
              onChange={(pId) => {
                setSelectedProjectId(pId);
                loadData(mode, startDate, endDate, pId);
              }}
              syncWithUrl={false}
              placeholder="Semua Proyek"
            />
          </div>

          {/* 3. Kontrol Navigasi Sesuai Mode */}
          <div className="md:col-span-4">
            {mode === "minggu" && (() => {
              const todayJakarta = getTodayJakarta();
              const isNextWeekDisabled = addDays(startDate, 7) > todayJakarta;

              return (
                <div>
                  <label className="block text-[11.5px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Navigasi Minggu:
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleShiftWeek(-7)}
                      className="h-11 px-2.5"
                      title="Minggu Sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <input
                      type="date"
                      value={startDate}
                      max={todayJakarta}
                      onChange={(e) => {
                        if (e.target.value) handleDirectWeekPick(e.target.value);
                      }}
                      className="h-11 flex-1 px-3 rounded-control bg-surface-muted border border-line text-[12px] font-semibold text-ink text-center focus:outline-none focus:border-forest-900"
                      title="Pilih tanggal minggu mana pun"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isNextWeekDisabled}
                      onClick={() => handleShiftWeek(7)}
                      className="h-11 px-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={isNextWeekDisabled ? "Sudah di minggu terbaru" : "Minggu Berikutnya"}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })()}

            {mode === "bulan" && (
              <div>
                <label className="block text-[11.5px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Pilih Bulan & Tahun:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={selectedMonth}
                    onChange={(e) => handleApplyMonthYear(selectedYear, Number(e.target.value))}
                    className="h-11 px-2.5 rounded-control bg-surface-muted border border-line text-[12.5px] font-semibold text-ink focus:outline-none focus:border-forest-900"
                  >
                    {[
                      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
                    ].map((mName, mIdx) => (
                      <option key={mIdx + 1} value={mIdx + 1}>
                        {mName}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={2020}
                    max={2035}
                    value={selectedYear}
                    onChange={(e) => handleApplyMonthYear(Number(e.target.value), selectedMonth)}
                    className="h-11 px-3 rounded-control bg-surface-muted border border-line text-[13px] font-semibold text-ink text-center focus:outline-none focus:border-forest-900"
                  />
                </div>
              </div>
            )}

            {mode === "tahun" && (
              <div>
                <label className="block text-[11.5px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Pilih Tahun Laporan:
                </label>
                <input
                  type="number"
                  min={2020}
                  max={2035}
                  value={selectedYear}
                  onChange={(e) => handleApplyYear(Number(e.target.value))}
                  className="w-full h-11 px-4 rounded-control bg-surface-muted border border-line text-[14px] font-semibold text-ink text-center focus:outline-none focus:border-forest-900"
                />
              </div>
            )}

            {mode === "kustom" && (
              <div>
                <label className="block text-[11.5px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                  Rentang Tanggal:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (e.target.value && endDate) {
                        loadData("kustom", e.target.value, endDate, selectedProjectId);
                      }
                    }}
                    className="h-11 px-2 rounded-control bg-surface-muted border border-line text-[12px] font-semibold text-ink text-center focus:outline-none focus:border-forest-900"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      if (startDate && e.target.value) {
                        loadData("kustom", startDate, e.target.value, selectedProjectId);
                      }
                    }}
                    className="h-11 px-2 rounded-control bg-surface-muted border border-line text-[12px] font-semibold text-ink text-center focus:outline-none focus:border-forest-900"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Baris Pintasan Cepat & Keterangan Periode Aktif */}
        <div className="pt-3 border-t border-line/60 flex flex-wrap items-center justify-between gap-2.5 text-[12px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted font-medium mr-1">Pintasan Cepat:</span>
            <button
              type="button"
              onClick={() => handleApplyPreset("bulan-ini")}
              className="px-2.5 py-1 rounded-pill bg-surface-muted border border-line hover:border-forest-900 font-semibold text-ink text-[11px] transition"
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset("bulan-lalu")}
              className="px-2.5 py-1 rounded-pill bg-surface-muted border border-line hover:border-forest-900 font-semibold text-ink text-[11px] transition"
            >
              Bulan Lalu
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset("3-bulan")}
              className="px-2.5 py-1 rounded-pill bg-surface-muted border border-line hover:border-forest-900 font-semibold text-ink text-[11px] transition"
            >
              3 Bulan Terakhir
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset("tahun-ini")}
              className="px-2.5 py-1 rounded-pill bg-surface-muted border border-line hover:border-forest-900 font-semibold text-ink text-[11px] transition"
            >
              Tahun Ini
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset("12-bulan")}
              className="px-2.5 py-1 rounded-pill bg-surface-muted border border-line hover:border-forest-900 font-semibold text-ink text-[11px] transition"
            >
              12 Bulan Terakhir
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-forest-900 font-semibold">
            <Calendar className="w-3.5 h-3.5 text-forest-900" />
            <span>
              {formatDateId(startDate)} s.d. {formatDateId(endDate)}
            </span>
          </div>
        </div>
      </div>

      {/* ==============================================================================
          KONDISI 1: MODE MINGGUAN (OPERASIONAL PEMBAYARAN TUNAI)
          ============================================================================== */}
      {mode === "minggu" && (
        <>
          {/* Kartu Aksen Lime: Total Pengeluaran Upah & Status Pembayaran */}
          <CardAccent className="p-5 sm:p-6 shadow-card print:hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-forest-900 text-white text-[11px] font-semibold">
                <FileSpreadsheet className="w-3 h-3" /> Rekap Pembayaran Sabtu
              </span>
              <span className="text-[12px] font-semibold text-forest-900/80">
                {summary.length} Penjahit Terdaftar
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-8">
                <span className="text-[13px] font-semibold text-forest-900/85 block">
                  Total Upah Periode Minggu Ini:
                </span>
                <div className="text-[34px] sm:text-[42px] font-semibold text-forest-900 leading-tight tabular-nums my-1">
                  {formatRupiah(grandTotalUpah)}
                </div>
                <p className="text-[13px] text-forest-900/80">
                  Total <strong>{formatNumber(grandTotalPcs)} pcs</strong> disetujui · Terbayar:{" "}
                  <strong>{formatRupiah(grandTotalDibayar)}</strong> · Sisa:{" "}
                  <strong className="text-forest-900 underline">{formatRupiah(grandTotalSisa)}</strong>
                </p>
              </div>

              <div className="sm:col-span-4 flex flex-col justify-end items-start sm:items-end gap-2">
                {grandTotalSisa > 0 ? (
                  <Button
                    variant="primary"
                    onClick={() => setIsAllPayModalOpen(true)}
                    className="w-full sm:w-auto text-[13px] h-10 shadow-sm"
                  >
                    <Banknote className="w-4 h-4 mr-1.5" />
                    Tandai Semua Dibayar ({pendingTailorsCount})
                  </Button>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-forest-900 text-lime-400 text-[12px] font-semibold">
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    Seluruh Upah Lunas
                  </div>
                )}
              </div>
            </div>

            {/* Pemberitahuan Penting: Pembayaran Tunai di Luar Sistem */}
            <div className="mt-4 p-3 bg-forest-900/10 rounded-panel text-forest-900 text-[12px] flex items-start gap-2.5 leading-relaxed">
              <Banknote className="w-4 h-4 text-forest-900 mt-0.5 shrink-0 stroke-[2.2]" />
              <div>
                <strong>Pencatatan Status Pembayaran Tunai:</strong> Upah dibayarkan secara{" "}
                <strong>TUNAI</strong> di konveksi tiap hari Sabtu. Sistem FCHub mencatat
                status bayar (Lunas, Belum dibayar, Kurang/Lebih bayar) untuk mencegah selisih dan catatan ganda.
              </div>
            </div>
          </CardAccent>

          {/* Konten Rekap Penjahit Mingguan */}
          {isLoading ? (
            <Card className="text-center py-12 px-6">
              <p className="text-[13px] text-muted">Memuat data rekap upah...</p>
            </Card>
          ) : summary.length === 0 ? (
            <Card className="text-center py-12 px-6 shadow-card">
              <div className="w-12 h-12 rounded-[16px] bg-surface-muted text-muted mx-auto flex items-center justify-center mb-3">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-[16px] font-semibold text-ink">
                Belum Ada Entri yang Disetujui
              </h3>
              <p className="text-[13px] text-muted max-w-sm mx-auto mt-1">
                Belum ada hasil produksi yang disetujui pada periode minggu ini. Pastikan Anda telah
                menyetujui entri pada menu <strong>Approval</strong>.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* A. TAMPILAN DESKTOP: Tabel Lengkap */}
              <div className="hidden md:block">
                <Card className="p-0 overflow-hidden shadow-card border border-line">
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-surface-muted border-b border-line text-[12px] font-semibold text-muted uppercase tracking-wider">
                        <th className="py-3 px-3.5 w-10 text-center">No</th>
                        <th className="py-3 px-3.5">Nama Penjahit</th>
                        <th className="py-3 px-3.5 text-right">Pcs Disetujui</th>
                        <th className="py-3 px-3.5 text-right">Total Upah</th>
                        <th className="py-3 px-3.5 text-right">Sudah Dibayar</th>
                        <th className="py-3 px-3.5 text-center">Status Bayar</th>
                        <th className="py-3 px-3.5 text-right print:hidden">Aksi Owner</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {summary.map((row, idx) => {
                        const badgeInfo = getPaymentStatusBadgeInfo(row.status_pembayaran);
                        const isExpanded = !!expandedUserIds[row.user_id];
                        const hasPayments = row.payments.length > 0;

                        return (
                          <React.Fragment key={row.user_id}>
                            <tr className="hover:bg-surface-muted/40 transition-colors">
                              <td className="py-3 px-3.5 text-center text-muted font-medium">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-3.5 font-semibold text-ink">
                                <Link
                                  href={`/owner/penjahit/${row.user_id}`}
                                  className="hover:text-forest-900 hover:underline block"
                                >
                                  {row.nama_penjahit}
                                </Link>
                                <span className="text-[11px] text-muted font-mono font-normal">
                                  @{row.username_penjahit}
                                </span>
                              </td>
                              <td className="py-3 px-3.5 text-right font-semibold text-ink tabular-nums">
                                {formatNumber(row.total_pcs_disetujui)} pcs
                              </td>
                              <td className="py-3 px-3.5 text-right font-semibold text-forest-900 tabular-nums text-[14px]">
                                {formatRupiah(row.total_upah)}
                              </td>
                              <td className="py-3 px-3.5 text-right font-medium text-ink tabular-nums">
                                {formatRupiah(row.total_dibayar)}
                                {row.sisa > 0 && row.total_dibayar > 0 && (
                                  <span className="block text-[11px] text-[#B77407]">
                                    Sisa {formatRupiah(row.sisa)}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3.5 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-semibold border ${badgeInfo.bgClass} ${badgeInfo.textClass} ${badgeInfo.borderClass}`}
                                >
                                  {badgeInfo.label}
                                </span>
                                {row.tanggal_bayar_terakhir && (
                                  <span className="block text-[10px] text-muted mt-0.5">
                                    {formatDateId(row.tanggal_bayar_terakhir)}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3.5 text-right print:hidden">
                                <div className="flex items-center justify-end gap-1.5">
                                  {row.sisa > 0 ? (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => setPayModalItem(row)}
                                      className="h-8 px-3 text-[12px]"
                                    >
                                      Tandai Dibayar
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      disabled
                                      className="h-8 px-2.5 text-[11px] opacity-60"
                                    >
                                      Lunas
                                    </Button>
                                  )}

                                  {(hasPayments || row.project_details.length > 0) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedUserIds((prev) => ({
                                          ...prev,
                                          [row.user_id]: !prev[row.user_id],
                                        }))
                                      }
                                      className="p-1 rounded-md text-muted hover:text-ink hover:bg-surface-muted transition"
                                      title="Lihat rincian proyek dan riwayat pembayaran"
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="w-4 h-4" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Baris Expandable Rincian Proyek & Riwayat Transaksi */}
                            {isExpanded && (
                              <tr className="bg-surface-muted/60">
                                <td colSpan={7} className="p-3.5 text-[12px]">
                                  <div className="space-y-3">
                                    {/* Rincian Upah per Proyek dengan Formula Standar */}
                                    {row.project_details.length > 0 && (
                                      <div className="rounded-panel bg-surface p-3 border border-line">
                                        <span className="font-semibold text-ink block mb-2">
                                          Rincian Upah per Proyek ({row.nama_penjahit}):
                                        </span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {row.project_details.map((pd) => {
                                            const isMulti = (pd.rincian_tarif?.length || 0) > 1;
                                            return (
                                              <div
                                                key={pd.project_id}
                                                className="p-2.5 rounded-panel bg-surface-muted border border-line flex flex-col justify-between"
                                              >
                                                <div className="flex justify-between items-start gap-2">
                                                  <div>
                                                    <strong className="text-ink block text-[13px]">
                                                      {pd.nama_proyek}
                                                    </strong>
                                                    {!isMulti ? (
                                                      <span className="text-muted text-[11px] font-mono">
                                                        {formatWageCalculation(
                                                          pd.total_pcs,
                                                          pd.tarif_snapshot,
                                                          pd.subtotal
                                                        )}
                                                      </span>
                                                    ) : (
                                                      <span className="text-[11px] text-forest-900 font-semibold block">
                                                        {formatMultiTarifSummary(
                                                          pd.rincian_tarif!.length,
                                                          pd.tarif_rata_rata ||
                                                          Math.round(pd.subtotal / pd.total_pcs)
                                                        )}
                                                      </span>
                                                    )}
                                                  </div>
                                                  <span className="font-semibold text-forest-900 tabular-nums text-[13px]">
                                                    {formatRupiah(pd.subtotal)}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Riwayat Pembayaran */}
                                    {hasPayments && (
                                      <div className="rounded-panel bg-surface p-3 border border-line">
                                        <span className="font-semibold text-ink block mb-2">
                                          Riwayat Catatan Pembayaran ({row.nama_penjahit}):
                                        </span>
                                        <div className="space-y-2">
                                          {row.payments.map((p) => {
                                            const isBatal = p.status === "dibatalkan";
                                            return (
                                              <div
                                                key={p.id}
                                                className={`p-2.5 rounded-panel border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${isBatal
                                                  ? "bg-surface-muted/50 border-line line-through text-muted opacity-75"
                                                  : "bg-surface border-line/80"
                                                  }`}
                                              >
                                                <div>
                                                  <div className="flex items-center gap-2">
                                                    <strong
                                                      className={isBatal ? "text-muted" : "text-forest-900"}
                                                    >
                                                      {formatRupiah(p.jumlah)}
                                                    </strong>
                                                    <span
                                                      className={`text-[10px] px-2 py-0.2 rounded-pill font-bold ${isBatal
                                                        ? "bg-negative/15 text-negative no-underline"
                                                        : "bg-lime-100 text-positive"
                                                        }`}
                                                    >
                                                      {isBatal ? "Dibatalkan" : "Aktif"}
                                                    </span>
                                                    <span className="text-muted text-[11px]">
                                                      {formatDateId(p.dibayar_pada)} oleh {p.dibayar_oleh_nama}
                                                    </span>
                                                  </div>
                                                </div>

                                                {!isBatal && (
                                                  <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => setCancelModalPayment(p)}
                                                    className="text-negative hover:bg-negative/10 border-negative/20 text-[11px] h-7 px-2 shrink-0 self-start sm:self-auto"
                                                  >
                                                    Batalkan
                                                  </Button>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-surface-muted/80 border-t-2 border-line font-semibold text-ink text-[14px]">
                        <td colSpan={2} className="py-3.5 px-3.5 text-right">
                          Total:
                        </td>
                        <td className="py-3.5 px-3.5 text-right text-ink tabular-nums">
                          {formatNumber(grandTotalPcs)} pcs
                        </td>
                        <td className="py-3.5 px-3.5 text-right text-forest-900 tabular-nums text-[15px] font-bold">
                          {formatRupiah(grandTotalUpah)}
                        </td>
                        <td className="py-3.5 px-3.5 text-right text-forest-900 tabular-nums text-[15px] font-bold">
                          {formatRupiah(grandTotalDibayar)}
                        </td>
                        <td className="py-3.5 px-3.5 text-center text-muted text-[12px]">
                          Sisa: {formatRupiah(grandTotalSisa)}
                        </td>
                        <td className="print:hidden"></td>
                      </tr>
                    </tfoot>
                  </table>
                </Card>
              </div>

              {/* B. TAMPILAN MOBILE: Daftar Kartu Per Penjahit */}
              <div className="md:hidden space-y-3">
                {summary.map((row) => {
                  const badgeInfo = getPaymentStatusBadgeInfo(row.status_pembayaran);
                  const initials = row.nama_penjahit
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const hasPayments = row.payments.length > 0;
                  const isExpanded = !!expandedUserIds[row.user_id];

                  return (
                    <Card key={row.user_id} className="p-4 shadow-card">
                      <div className="flex items-center justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-forest-900 text-lime-400 font-semibold text-[13px] flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/owner/penjahit/${row.user_id}`}
                              className="text-[15px] font-semibold text-ink truncate leading-tight hover:text-forest-900 hover:underline block"
                            >
                              {row.nama_penjahit}
                            </Link>
                            <span className="text-[11px] text-muted font-mono">
                              @{row.username_penjahit}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-semibold border ${badgeInfo.bgClass} ${badgeInfo.textClass} ${badgeInfo.borderClass}`}
                        >
                          {badgeInfo.label}
                        </span>
                      </div>

                      <div className="py-2.5 border-y border-line/60 grid grid-cols-2 gap-2 text-[12px]">
                        <div>
                          <span className="text-[11px] text-muted block">Hasil Disetujui:</span>
                          <strong className="text-ink font-semibold tabular-nums text-[13px]">
                            {formatNumber(row.total_pcs_disetujui)} pcs
                          </strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-muted block">Total Upah:</span>
                          <strong className="text-forest-900 font-semibold tabular-nums text-[15px]">
                            {formatRupiah(row.total_upah)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted block">Sudah Dibayar:</span>
                          <span className="text-ink font-medium tabular-nums">
                            {formatRupiah(row.total_dibayar)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-muted block">Sisa Dibayar:</span>
                          <span
                            className={`font-semibold tabular-nums ${row.sisa > 0 ? "text-[#B77407]" : "text-positive"
                              }`}
                          >
                            {formatRupiah(row.sisa)}
                          </span>
                        </div>
                      </div>

                      {/* Aksi Mobile */}
                      <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-line/40 print:hidden">
                        {hasPayments || row.project_details.length > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedUserIds((prev) => ({
                                ...prev,
                                [row.user_id]: !prev[row.user_id],
                              }))
                            }
                            className="text-[12px] font-semibold text-muted hover:text-ink flex items-center gap-1"
                          >
                            {isExpanded ? "Tutup Rincian" : "Lihat Rincian & Riwayat"}
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted">Belum ada riwayat</span>
                        )}

                        {row.sisa > 0 ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setPayModalItem(row)}
                            className="h-8 px-3 text-[12px]"
                          >
                            Tandai Dibayar
                          </Button>
                        ) : (
                          <span className="text-[12px] font-semibold text-positive flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Lunas
                          </span>
                        )}
                      </div>

                      {/* Rincian Proyek & Riwayat Pembayaran Mobile */}
                      {isExpanded && (
                        <div className="mt-3 pt-2.5 border-t border-dashed border-line space-y-3">
                          {row.project_details.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-bold text-muted uppercase block">
                                Rincian Upah per Proyek:
                              </span>
                              <div className="space-y-1">
                                {row.project_details.map((pd) => (
                                  <div
                                    key={pd.project_id}
                                    className="p-2 bg-surface-muted rounded-panel border border-line flex justify-between items-center text-[11px]"
                                  >
                                    <div>
                                      <strong className="block text-ink text-[12px]">
                                        {pd.nama_proyek}
                                      </strong>
                                      <span className="text-muted font-mono">
                                        {formatWageCalculation(
                                          pd.total_pcs,
                                          pd.tarif_snapshot,
                                          pd.subtotal
                                        )}
                                      </span>
                                    </div>
                                    <span className="font-semibold text-forest-900 tabular-nums">
                                      {formatRupiah(pd.subtotal)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ==============================================================================
          KONDISI 2: MODE LAPORAN (BULANAN, TAHUNAN, KUSTOM - HANYA BACA)
          ============================================================================== */}
      {mode !== "minggu" && (
        <div className="space-y-6">
          {isLoading ? (
            <Card className="text-center py-16 px-6 shadow-card">
              <p className="text-[14px] text-muted">Memuat laporan pengeluaran upah...</p>
            </Card>
          ) : !reportData || reportData.ringkasan.total_upah === 0 ? (
            /* State Kosong */
            <Card className="text-center py-12 px-6 shadow-card space-y-3">
              <div className="w-12 h-12 rounded-[16px] bg-surface-muted text-muted mx-auto flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-[17px] font-semibold text-ink">
                Belum Ada Data Upah pada Periode Ini
              </h3>
              <p className="text-[13px] text-muted max-w-md mx-auto">
                Tidak ada entri hasil kerja berstatus disetujui pada rentang tanggal{" "}
                <strong>{formatDateId(startDate)}</strong> s.d.{" "}
                <strong>{formatDateId(endDate)}</strong>.
              </p>
              <div className="pt-2 text-[12px] text-muted">
                <span>Rentang data yang tersedia di sistem: </span>
                <strong className="text-ink">
                  {formatDateId(periodOptions.minDate)} s.d. {formatDateId(periodOptions.maxDate)}
                </strong>
              </div>
              <div className="pt-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    handleDirectWeekPick(periodOptions.maxDate);
                    setMode("minggu");
                  }}
                >
                  Ke Periode Terdekat yang Ada Datanya
                </Button>
              </div>
            </Card>
          ) : (
            <>
              {/* 1. Header Laporan Pengeluaran */}
              <div className="p-4 bg-surface rounded-card border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-bold text-ink">
                    Laporan Pengeluaran Upah Penjahit
                  </h2>
                  <p className="text-[12px] text-muted">
                    Periode: {formatDateId(startDate)} s.d. {formatDateId(endDate)} ·{" "}
                    {reportData.periode.jumlah_hari} hari kerja
                  </p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-surface-muted text-forest-900 border border-line self-start sm:self-auto">
                  Mode Laporan (Hanya Baca)
                </span>
              </div>

              {/* 2. Grid 6 Kartu Ringkasan Metrik */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Metrik 1: Total Pengeluaran Upah */}
                <div className="p-3 bg-surface rounded-panel border border-line shadow-sm">
                  <span className="text-[11px] font-medium text-muted block mb-0.5">
                    Pengeluaran Upah:
                  </span>
                  <strong className="text-[17px] sm:text-[18px] font-bold text-forest-900 block tabular-nums truncate">
                    {formatRupiah(reportData.ringkasan.total_upah)}
                  </strong>
                  {reportData.ringkasan.perubahan_upah_persen !== null && (
                    <span
                      className={`inline-flex items-center gap-0.5 text-[10.5px] font-semibold mt-1 ${reportData.ringkasan.perubahan_upah_persen >= 0
                        ? "text-positive"
                        : "text-negative"
                        }`}
                    >
                      {reportData.ringkasan.perubahan_upah_persen >= 0 ? (
                        <TrendingUp className="w-3 h-3 stroke-[2.5]" />
                      ) : (
                        <TrendingDown className="w-3 h-3 stroke-[2.5]" />
                      )}
                      <span>
                        {reportData.ringkasan.perubahan_upah_persen >= 0 ? "Naik" : "Turun"}{" "}
                        {Math.abs(reportData.ringkasan.perubahan_upah_persen)}%
                      </span>
                    </span>
                  )}
                </div>

                {/* Metrik 2: Total Pcs Disetujui */}
                <div className="p-3 bg-surface rounded-panel border border-line shadow-sm">
                  <span className="text-[11px] font-medium text-muted block mb-0.5">
                    Total Pcs Disetujui:
                  </span>
                  <strong className="text-[18px] sm:text-[20px] font-bold text-ink block tabular-nums">
                    {formatNumber(reportData.ringkasan.total_pcs)}{" "}
                    <span className="text-[12px] font-normal text-muted">pcs</span>
                  </strong>
                  {reportData.ringkasan.perubahan_pcs_persen !== null && (
                    <span
                      className={`inline-flex items-center gap-0.5 text-[10.5px] font-semibold mt-1 ${reportData.ringkasan.perubahan_pcs_persen >= 0
                        ? "text-positive"
                        : "text-negative"
                        }`}
                    >
                      {reportData.ringkasan.perubahan_pcs_persen >= 0 ? (
                        <TrendingUp className="w-3 h-3 stroke-[2.5]" />
                      ) : (
                        <TrendingDown className="w-3 h-3 stroke-[2.5]" />
                      )}
                      <span>
                        {reportData.ringkasan.perubahan_pcs_persen >= 0 ? "Naik" : "Turun"}{" "}
                        {Math.abs(reportData.ringkasan.perubahan_pcs_persen)}%
                      </span>
                    </span>
                  )}
                </div>

                {/* Metrik 3: Rata-rata Upah per Pcs */}
                <div className="p-3 bg-surface rounded-panel border border-line shadow-sm">
                  <span className="text-[11px] font-medium text-muted block mb-0.5">
                    Rata-rata / Pcs:
                  </span>
                  <strong className="text-[17px] sm:text-[18px] font-bold text-ink block tabular-nums">
                    {formatRupiah(Math.round(reportData.ringkasan.rata_rata_upah_per_pcs))}
                    <span className="text-[11px] font-normal text-muted">/pcs</span>
                  </strong>
                  <span className="text-[10px] text-muted block mt-1">Efektivitas tarif</span>
                </div>

                {/* Metrik 4: Rata-rata per Penjahit */}
                <div className="p-3 bg-surface rounded-panel border border-line shadow-sm">
                  <span className="text-[11px] font-medium text-muted block mb-0.5">
                    Rata-rata / Penjahit:
                  </span>
                  <strong className="text-[17px] sm:text-[18px] font-bold text-ink block tabular-nums truncate">
                    {formatRupiah(reportData.ringkasan.rata_rata_per_penjahit)}
                  </strong>
                  <span className="text-[10px] text-muted block mt-1">
                    {reportData.ringkasan.jumlah_penjahit_aktif} penjahit aktif
                  </span>
                </div>

                {/* Metrik 5: Sudah Dibayar Tunai */}
                <div className="p-3 bg-lime-50 rounded-panel border border-lime-200 shadow-sm">
                  <span className="text-[11px] font-medium text-positive block mb-0.5">
                    Sudah Dibayar:
                  </span>
                  <strong className="text-[17px] sm:text-[18px] font-bold text-positive block tabular-nums truncate">
                    {formatRupiah(reportData.ringkasan.total_dibayar)}
                  </strong>
                  <span className="text-[10px] text-positive block mt-1">Tunai dicatat</span>
                </div>

                {/* Metrik 6: Belum Dibayar Tunai */}
                <div className="p-3 bg-warning/10 rounded-panel border border-warning/30 shadow-sm">
                  <span className="text-[11px] font-medium text-[#B77407] block mb-0.5">
                    Belum Dibayar:
                  </span>
                  <strong className="text-[17px] sm:text-[18px] font-bold text-[#B77407] block tabular-nums truncate">
                    {formatRupiah(reportData.ringkasan.total_belum_dibayar)}
                  </strong>
                  <span className="text-[10px] text-[#B77407] block mt-1">Sisa minggu beririsan</span>
                </div>
              </div>

              {/* 3. Grafik Batang SVG Deret Waktu (Tanpa Library) */}
              {reportData.deret_waktu.length > 0 && (
                <Card className="p-5 sm:p-6 shadow-card">
                  <div className="flex items-center justify-between pb-3 border-b border-line/60 mb-4">
                    <div>
                      <h3 className="text-[15px] font-bold text-ink flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-forest-900" />
                        Tren Pengeluaran Upah Periode Ini
                      </h3>
                      <p className="text-[12px] text-muted">
                        Distribusi nominal upah dan jumlah pcs per titik waktu
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const series = reportData.deret_waktu;
                    const maxVal = Math.max(...series.map((s) => s.upah), 100000);
                    const chartHeight = 150;
                    const chartWidth = Math.max(500, series.length * 55);
                    const barWidth = Math.min(36, Math.max(14, Math.floor((chartWidth / series.length) * 0.6)));
                    const spacing = (chartWidth - barWidth * series.length) / (series.length + 1);

                    return (
                      <div className="w-full overflow-x-auto pb-2">
                        <div style={{ minWidth: `${Math.min(chartWidth, 750)}px` }}>
                          <svg
                            viewBox={`0 0 ${chartWidth} ${chartHeight + 35}`}
                            className="w-full h-auto overflow-visible select-none"
                          >
                            {/* Grid Line */}
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

                            {/* Bar Item */}
                            {series.map((item, idx) => {
                              const x = spacing + idx * (barWidth + spacing);
                              const barH =
                                item.upah > 0
                                  ? Math.max(6, Math.round((item.upah / maxVal) * (chartHeight - 20)))
                                  : 3;
                              const y = chartHeight - barH;

                              return (
                                <g key={idx} className="group cursor-pointer">
                                  <title>
                                    {`${item.label}: ${formatRupiah(item.upah)} (${formatNumber(item.pcs)} pcs)`}
                                  </title>
                                  <rect
                                    x={x}
                                    y={y}
                                    width={barWidth}
                                    height={barH}
                                    rx={4}
                                    className={`transition-all duration-200 ${item.upah > 0
                                      ? "fill-forest-900 group-hover:fill-lime-500"
                                      : "fill-surface-muted"
                                      }`}
                                  />
                                  {item.upah > 0 && (
                                    <text
                                      x={x + barWidth / 2}
                                      y={Math.max(12, y - 5)}
                                      textAnchor="middle"
                                      className="text-[10px] font-semibold fill-forest-900"
                                    >
                                      {item.upah >= 1000000
                                        ? `${(item.upah / 1000000).toFixed(1)}jt`
                                        : `${Math.round(item.upah / 1000)}rb`}
                                    </text>
                                  )}
                                  <text
                                    x={x + barWidth / 2}
                                    y={chartHeight + 16}
                                    textAnchor="middle"
                                    className="text-[10.5px] font-medium fill-muted"
                                  >
                                    {item.label}
                                  </text>
                                  <text
                                    x={x + barWidth / 2}
                                    y={chartHeight + 28}
                                    textAnchor="middle"
                                    className="text-[9.5px] fill-muted/70"
                                  >
                                    {item.pcs > 0 ? `${formatNumber(item.pcs)} pcs` : "-"}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                      </div>
                    );
                  })()}
                </Card>
              )}

              {/* 4. Tabel Breakdown "Per Proyek" */}
              <Card className="p-5 sm:p-6 shadow-card">
                <div className="flex items-center justify-between pb-3 border-b border-line/60 mb-3">
                  <div>
                    <h3 className="text-[15px] font-bold text-ink flex items-center gap-2">
                      <Layers className="w-4 h-4 text-forest-900" />
                      Rincian Pengeluaran Per Proyek ({reportData.per_proyek.length})
                    </h3>
                    <p className="text-[12px] text-muted">
                      Total pcs, nominal upah, porsi kontribusi, dan rincian tarif per pesanan
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-surface-muted border-b border-line text-[11.5px] font-semibold text-muted uppercase tracking-wider">
                        <th className="py-2.5 px-3">Nama Proyek</th>
                        <th className="py-2.5 px-3 text-right">Pcs Disetujui</th>
                        <th className="py-2.5 px-3 text-right">Total Upah</th>
                        <th className="py-2.5 px-3 text-right">Porsi (%)</th>
                        <th className="py-2.5 px-3">Rincian Perhitungan Tarif</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {reportData.per_proyek.map((p) => {
                        const isMulti = p.rincian_tarif.length > 1;
                        return (
                          <tr key={p.project_id} className="hover:bg-surface-muted/40">
                            <td className="py-2.5 px-3 font-semibold text-ink">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-forest-900 shrink-0" />
                                <span>{p.nama_proyek}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-ink tabular-nums">
                              {formatNumber(p.total_pcs)} pcs
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-forest-900 tabular-nums">
                              {formatRupiah(p.total_upah)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-muted tabular-nums">
                              {p.persen_dari_total}%
                            </td>
                            <td className="py-2.5 px-3 text-[11.5px] font-mono text-muted">
                              {!isMulti ? (
                                <span>
                                  {formatWageCalculation(
                                    p.rincian_tarif[0]?.pcs || p.total_pcs,
                                    p.rincian_tarif[0]?.tarif || 500,
                                    p.total_upah
                                  )}
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="font-sans font-semibold text-forest-900 block text-[11px]">
                                    {p.rincian_tarif.length} tarif berbeda:
                                  </span>
                                  {p.rincian_tarif.map((rt) => (
                                    <div key={rt.tarif}>
                                      {formatWageCalculation(rt.pcs, rt.tarif, rt.subtotal)}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* 5. Tabel Breakdown "Per Penjahit" */}
              <Card className="p-5 sm:p-6 shadow-card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-line/60 gap-3">
                  <div>
                    <h3 className="text-[15px] font-bold text-ink flex items-center gap-2">
                      <Users className="w-4 h-4 text-forest-900" />
                      Rincian Pendapatan Per Penjahit ({reportData.per_penjahit.length})
                    </h3>
                    <p className="text-[12px] text-muted">
                      Hasil produksi dan upah yang dihasilkan masing-masing penjahit
                    </p>
                  </div>

                  {/* Filter Pencarian & Sorting */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari nama penjahit..."
                        value={tailorSearch}
                        onChange={(e) => {
                          setTailorSearch(e.target.value);
                          setTailorPage(1);
                        }}
                        className="h-9 pl-8 pr-3 rounded-control bg-surface-muted border border-line text-[12px] text-ink focus:outline-none focus:border-forest-900"
                      />
                    </div>

                    <div className="relative">
                      <select
                        value={tailorSortBy}
                        onChange={(e) => setTailorSortBy(e.target.value as "upah" | "pcs" | "nama")}
                        className="h-9 px-2.5 pr-7 rounded-control bg-surface-muted border border-line text-[12px] font-semibold text-ink focus:outline-none focus:border-forest-900 appearance-none cursor-pointer"
                      >
                        <option value="upah">Urut: Upah Terbesar</option>
                        <option value="pcs">Urut: Pcs Terbanyak</option>
                        <option value="nama">Urut: Nama A-Z</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-muted absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {paginatedTailors.length === 0 ? (
                  <div className="text-center py-8 text-muted text-[13px]">
                    Tidak ada penjahit yang cocok dengan pencarian &quot;{tailorSearch}&quot;.
                  </div>
                ) : (
                  <>
                    {/* Tampilan Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[13px]">
                        <thead>
                          <tr className="bg-surface-muted border-b border-line text-[11.5px] font-semibold text-muted uppercase tracking-wider">
                            <th className="py-2.5 px-3 w-10 text-center">No</th>
                            <th className="py-2.5 px-3">Nama Penjahit</th>
                            <th className="py-2.5 px-3 text-center">Proyek</th>
                            <th className="py-2.5 px-3 text-right">Pcs Disetujui</th>
                            <th className="py-2.5 px-3 text-right">Total Upah</th>
                            <th className="py-2.5 px-3 text-right">Rincian</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line/60">
                          {paginatedTailors.map((t, idx) => {
                            const isExpanded = !!expandedReportTailors[t.user_id];
                            return (
                              <React.Fragment key={t.user_id}>
                                <tr className="hover:bg-surface-muted/40">
                                  <td className="py-2.5 px-3 text-center text-muted font-medium">
                                    {(tailorPage - 1) * pageSize + idx + 1}
                                  </td>
                                  <td className="py-2.5 px-3 font-semibold text-ink">
                                    <Link
                                      href={`/owner/penjahit/${t.user_id}`}
                                      className="hover:text-forest-900 hover:underline block"
                                    >
                                      {t.nama_penjahit}
                                    </Link>
                                    <span className="text-[11px] text-muted font-mono font-normal">
                                      @{t.username_penjahit}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-muted font-medium">
                                    {t.total_proyek} proyek
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-semibold text-ink tabular-nums">
                                    {formatNumber(t.total_pcs)} pcs
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-semibold text-forest-900 tabular-nums">
                                    {formatRupiah(t.total_upah)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedReportTailors((prev) => ({
                                          ...prev,
                                          [t.user_id]: !prev[t.user_id],
                                        }))
                                      }
                                      className="text-[11.5px] font-semibold text-forest-900 underline hover:text-ink inline-flex items-center gap-0.5"
                                    >
                                      <span>{isExpanded ? "Tutup" : "Rincian"}</span>
                                      {isExpanded ? (
                                        <ChevronUp className="w-3.5 h-3.5" />
                                      ) : (
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </td>
                                </tr>

                                {isExpanded && (
                                  <tr className="bg-surface-muted/60">
                                    <td colSpan={6} className="p-3">
                                      <div className="bg-surface rounded-panel p-3 border border-line space-y-1.5 text-[12px]">
                                        <span className="text-[11px] font-bold uppercase text-muted block mb-1">
                                          Rincian Proyek ({t.nama_penjahit}):
                                        </span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          {t.rincian_proyek.map((rp, rIdx) => (
                                            <div
                                              key={rIdx}
                                              className="p-2 bg-surface-muted rounded-panel border border-line flex justify-between items-center"
                                            >
                                              <div>
                                                <strong className="block text-ink">
                                                  {rp.nama_proyek}
                                                </strong>
                                                <span className="text-[11px] font-mono text-muted">
                                                  {formatWageCalculation(rp.pcs, rp.tarif, rp.subtotal)}
                                                </span>
                                              </div>
                                              <span className="font-semibold text-forest-900 tabular-nums">
                                                {formatRupiah(rp.subtotal)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Tampilan Mobile Cards */}
                    <div className="md:hidden space-y-2.5">
                      {paginatedTailors.map((t, idx) => {
                        const isExpanded = !!expandedReportTailors[t.user_id];
                        return (
                          <div
                            key={t.user_id}
                            className="p-3.5 bg-surface-muted/60 rounded-card border border-line space-y-2 text-[12px]"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-muted text-[11px]">
                                  #{(tailorPage - 1) * pageSize + idx + 1}
                                </span>
                                <Link
                                  href={`/owner/penjahit/${t.user_id}`}
                                  className="font-semibold text-ink text-[14px] hover:text-forest-900 hover:underline block leading-tight"
                                >
                                  {t.nama_penjahit}
                                </Link>
                                <span className="text-[11px] text-muted font-mono">
                                  @{t.username_penjahit} · {t.total_proyek} proyek
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold text-forest-900 text-[14px] block tabular-nums">
                                  {formatRupiah(t.total_upah)}
                                </span>
                                <span className="text-muted text-[11px] tabular-nums">
                                  {formatNumber(t.total_pcs)} pcs
                                </span>
                              </div>
                            </div>

                            <div className="pt-1.5 border-t border-line/60 flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedReportTailors((prev) => ({
                                    ...prev,
                                    [t.user_id]: !prev[t.user_id],
                                  }))
                                }
                                className="text-[11px] font-semibold text-forest-900 underline flex items-center gap-0.5"
                              >
                                <span>{isExpanded ? "Tutup Rincian" : "Lihat Rincian Proyek"}</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="mt-2 pt-2 border-t border-dashed border-line space-y-1">
                                {t.rincian_proyek.map((rp, rIdx) => (
                                  <div
                                    key={rIdx}
                                    className="p-2 bg-surface rounded-panel border border-line flex justify-between items-center text-[11px]"
                                  >
                                    <div>
                                      <strong className="block text-ink">{rp.nama_proyek}</strong>
                                      <span className="font-mono text-muted">
                                        {formatWageCalculation(rp.pcs, rp.tarif, rp.subtotal)}
                                      </span>
                                    </div>
                                    <span className="font-semibold text-forest-900">
                                      {formatRupiah(rp.subtotal)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Kontrol Paginasi */}
                    {totalTailorPages > 1 && (
                      <div className="pt-3 border-t border-line/60 flex items-center justify-between text-[12px] text-muted">
                        <span>
                          Menampilkan {(tailorPage - 1) * pageSize + 1} -{" "}
                          {Math.min(tailorPage * pageSize, filteredReportTailors.length)} dari{" "}
                          {filteredReportTailors.length} penjahit
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={tailorPage <= 1}
                            onClick={() => setTailorPage((p) => p - 1)}
                            className="h-8 px-2.5"
                          >
                            Sebelumnya
                          </Button>
                          <span className="font-semibold text-ink px-1">
                            {tailorPage} / {totalTailorPages}
                          </span>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={tailorPage >= totalTailorPages}
                            onClick={() => setTailorPage((p) => p + 1)}
                            className="h-8 px-2.5"
                          >
                            Berikutnya
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card>

              {/* 6. Catatan Keterangan Resmi di Bawah Laporan */}
              <div className="p-3.5 bg-surface-muted rounded-card border border-line text-[11.5px] text-muted leading-relaxed">
                <strong>Catatan Laporan:</strong> Berdasarkan tanggal kerja. Minggu yang melewati pergantian bulan terbagi ke dua bulan. Belum termasuk bonus reward dan kasbon.
              </div>
            </>
          )}
        </div>
      )}

      {/* ==============================================================================
          DIALOG MODAL OPERASIONAL MINGGUAN
          ============================================================================== */}
      {/* Dialog 1: Konfirmasi Tandai Dibayar Single */}
      <Dialog
        isOpen={!!payModalItem}
        onClose={() => setPayModalItem(null)}
        title="Konfirmasi Pembayaran Tunai"
        subtitle="Pastikan uang tunai sebesar sisa upah telah diserahkan langsung kepada penjahit."
      >
        {payModalItem && (
          <div className="space-y-3.5 py-1 text-[13px]">
            <div className="p-3 bg-surface-muted rounded-panel border border-line space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted">Nama Penjahit:</span>
                <strong className="text-ink">{payModalItem.nama_penjahit}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Periode Minggu:</span>
                <span>
                  {formatDateId(startDate)} - {formatDateId(endDate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total Disetujui:</span>
                <span className="font-semibold">{formatNumber(payModalItem.total_pcs_disetujui)} pcs</span>
              </div>
            </div>

            {/* Rincian per Proyek */}
            {payModalItem.project_details.length > 0 && (
              <div className="border border-line rounded-panel p-3 space-y-2">
                <span className="text-[11px] font-bold uppercase text-muted block">
                  Rincian per Proyek:
                </span>
                <div className="divide-y divide-line/60">
                  {payModalItem.project_details.map((pd) => (
                    <div key={pd.project_id} className="py-1.5 flex justify-between text-[12px]">
                      <div>
                        <strong className="block text-ink">{pd.nama_proyek}</strong>
                        <span className="text-muted text-[11px] font-mono">
                          {formatWageCalculation(pd.total_pcs, pd.tarif_snapshot, pd.subtotal)}
                        </span>
                      </div>
                      <span className="font-semibold text-forest-900 tabular-nums">
                        {formatRupiah(pd.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nominal Pembayaran */}
            <div className="p-3.5 bg-lime-100/60 rounded-panel border border-lime-300/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-positive uppercase block">
                  Jumlah Dibayar Tunai (Sisa):
                </span>
                <div className="text-[22px] font-bold text-forest-900 tabular-nums">
                  {formatRupiah(payModalItem.sisa)}
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
                onClick={() => setPayModalItem(null)}
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

      {/* Dialog 2: Konfirmasi Tandai Semua Dibayar */}
      <Dialog
        isOpen={isAllPayModalOpen}
        onClose={() => setIsAllPayModalOpen(false)}
        title="Tandai Semua Upah Dibayar?"
        subtitle="Tindakan ini akan menandai pembayaran tunai untuk seluruh penjahit yang masih memiliki sisa upah pada periode minggu ini."
      >
        <div className="space-y-3 py-2 text-[13px]">
          <div className="p-3 bg-surface-muted rounded-panel border border-line space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted">Jumlah Penjahit:</span>
              <strong className="text-ink">{pendingTailorsCount} penjahit</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Total Dana Tunai:</span>
              <strong className="text-forest-900 text-[15px] tabular-nums">
                {formatRupiah(grandTotalSisa)}
              </strong>
            </div>
          </div>

          <p className="text-[12px] text-muted leading-relaxed">
            Pastikan Anda telah menyiapkan dan menyerahkan uang tunai sebesar{" "}
            <strong>{formatRupiah(grandTotalSisa)}</strong> kepada {pendingTailorsCount} penjahit
            terkait.
          </p>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-line/60 mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAllPayModalOpen(false)}
              disabled={isSubmittingAllPay}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirmAllPay}
              disabled={isSubmittingAllPay}
            >
              {isSubmittingAllPay ? "Menyimpan..." : "Ya, Tandai Semua Dibayar"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog 3: Batalkan Pembayaran */}
      <Dialog
        isOpen={!!cancelModalPayment}
        onClose={() => setCancelModalPayment(null)}
        title="Batalkan Catatan Pembayaran"
        subtitle="Catatan pembayaran tidak akan dihapus, melainkan ditandai sebagai dibatalkan untuk audit trail."
      >
        {cancelModalPayment && (
          <div className="space-y-3 py-1 text-[13px]">
            <div className="p-3 bg-surface-muted rounded-panel border border-line space-y-1">
              <div className="flex justify-between">
                <span className="text-muted">Nominal:</span>
                <strong className="text-ink">{formatRupiah(cancelModalPayment.jumlah)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Tanggal Dicatat:</span>
                <span>{formatDateId(cancelModalPayment.dibayar_pada)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Dicatat Oleh:</span>
                <span>{cancelModalPayment.dibayar_oleh_nama}</span>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-ink uppercase tracking-wider mb-1">
                Alasan Pembatalan (Wajib): <span className="text-negative">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Sebutkan alasan pembatalan (contoh: Salah nominal, penjahit belum menerima tunai, dll.)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2.5 rounded-panel border border-line bg-surface-muted text-ink text-[13px] focus:outline-none focus:border-forest-900"
              />
              {cancelError && (
                <p className="text-[12px] text-negative mt-1 font-medium">{cancelError}</p>
              )}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-line/60 mt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCancelModalPayment(null)}
                disabled={isSubmittingCancel}
              >
                Tutup
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmCancel}
                disabled={isSubmittingCancel || !cancelReason.trim()}
              >
                {isSubmittingCancel ? "Membatalkan..." : "Konfirmasi Pembatalan"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ==============================================================================
          TAMPILAN CETAK A4 (HANYA MUNCUL SAAT PRINT)
          ============================================================================== */}
      {mode === "minggu" ? (
        /* Slip Cetak Upah Mingguan */
        <div className="hidden print:block space-y-6 pt-4 text-black">
          <div className="border-b-2 border-black pb-3 text-center">
            <h2 className="text-[20px] font-bold uppercase tracking-wider">
              Konveksi Firdaus Collection
            </h2>
            <p className="text-[14px] font-semibold mt-0.5">
              REKAP SLIP UPAH MINGGUAN PENJAHIT
            </p>
            <p className="text-[12px] mt-0.5">
              Periode: {formatDateId(startDate)} s.d. {formatDateId(endDate)}
            </p>
          </div>

          <div className="space-y-4">
            {summary.map((row, idx) => (
              <div
                key={row.user_id}
                className="p-3 border border-black rounded-sm break-inside-avoid text-[12px] space-y-2"
              >
                <div className="flex justify-between items-center border-b border-black/40 pb-1 font-bold">
                  <span>
                    {idx + 1}. {row.nama_penjahit} (@{row.username_penjahit})
                  </span>
                  <span>
                    Total: {formatNumber(row.total_pcs_disetujui)} pcs · Upah:{" "}
                    {formatRupiah(row.total_upah)}
                  </span>
                </div>

                <div className="space-y-1 pl-3 font-mono text-[11px]">
                  {row.project_details.map((pd) => (
                    <div key={pd.project_id} className="flex justify-between">
                      <span>
                        • {pd.nama_proyek}:{" "}
                        {formatWageCalculation(pd.total_pcs, pd.tarif_snapshot, pd.subtotal)}
                      </span>
                      <span className="font-sans font-semibold">
                        {formatRupiah(pd.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-dashed border-black/40 text-[11px]">
                  <div>
                    <span>Status: </span>
                    <span className="font-semibold uppercase">
                      {row.status_pembayaran}
                    </span>
                    {row.sisa > 0 && (
                      <span className="ml-2 font-bold">
                        (Sisa: {formatRupiah(row.sisa)})
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] italic">
                      Tanda Tangan Penerima Tunai: ____________________
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t-2 border-black pt-2 flex justify-between font-bold text-[13px]">
            <span>TOTAL KESELURUHAN: {formatNumber(grandTotalPcs)} PCS</span>
            <span>TOTAL DANA: {formatRupiah(grandTotalUpah)}</span>
          </div>
        </div>
      ) : (
        /* Cetak Laporan Pengeluaran Upah A4 */
        reportData && (
          <div className="hidden print:block space-y-6 pt-4 text-black">
            <div className="border-b-2 border-black pb-3 text-center">
              <h2 className="text-[20px] font-bold uppercase tracking-wider">
                Konveksi Firdaus Collection
              </h2>
              <p className="text-[14px] font-semibold mt-0.5">
                LAPORAN PENGELUARAN UPAH PRODUKSI PENJAHIT
              </p>
              <p className="text-[12px] mt-0.5">
                Periode: {formatDateId(startDate)} s.d. {formatDateId(endDate)} ({reportData.periode.jumlah_hari} Hari Kerja)
              </p>
            </div>

            {/* Ringkasan Eksekutif */}
            <div className="grid grid-cols-3 gap-3 border border-black p-3 text-[12px]">
              <div>
                <span className="block text-muted">Total Pengeluaran Upah:</span>
                <strong className="text-[16px] block">{formatRupiah(reportData.ringkasan.total_upah)}</strong>
              </div>
              <div>
                <span className="block text-muted">Total Pcs Disetujui:</span>
                <strong className="text-[16px] block">{formatNumber(reportData.ringkasan.total_pcs)} pcs</strong>
              </div>
              <div>
                <span className="block text-muted">Penjahit Aktif:</span>
                <strong className="text-[16px] block">{reportData.ringkasan.jumlah_penjahit_aktif} penjahit</strong>
              </div>
              <div>
                <span className="block text-muted">Rata-rata Upah / Pcs:</span>
                <strong>{formatRupiah(Math.round(reportData.ringkasan.rata_rata_upah_per_pcs))}/pcs</strong>
              </div>
              <div>
                <span className="block text-muted">Sudah Dibayar Tunai:</span>
                <strong>{formatRupiah(reportData.ringkasan.total_dibayar)}</strong>
              </div>
              <div>
                <span className="block text-muted">Sisa Belum Dibayar:</span>
                <strong>{formatRupiah(reportData.ringkasan.total_belum_dibayar)}</strong>
              </div>
            </div>

            {/* Tabel Proyek */}
            <div className="space-y-2">
              <h4 className="font-bold text-[13px] uppercase">Rincian Per Proyek</h4>
              <table className="w-full text-left border-collapse text-[11px] border border-black">
                <thead>
                  <tr className="border-b border-black bg-gray-100 font-bold">
                    <th className="py-1.5 px-2">Nama Proyek</th>
                    <th className="py-1.5 px-2 text-right">Pcs</th>
                    <th className="py-1.5 px-2 text-right">Total Upah</th>
                    <th className="py-1.5 px-2 text-right">Porsi (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/40">
                  {reportData.per_proyek.map((p) => (
                    <tr key={p.project_id}>
                      <td className="py-1.5 px-2 font-semibold">{p.nama_proyek}</td>
                      <td className="py-1.5 px-2 text-right">{formatNumber(p.total_pcs)} pcs</td>
                      <td className="py-1.5 px-2 text-right">{formatRupiah(p.total_upah)}</td>
                      <td className="py-1.5 px-2 text-right">{p.persen_dari_total}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tabel Penjahit */}
            <div className="space-y-2">
              <h4 className="font-bold text-[13px] uppercase">Rincian Per Penjahit</h4>
              <table className="w-full text-left border-collapse text-[11px] border border-black">
                <thead>
                  <tr className="border-b border-black bg-gray-100 font-bold">
                    <th className="py-1.5 px-2 w-8 text-center">No</th>
                    <th className="py-1.5 px-2">Nama Penjahit</th>
                    <th className="py-1.5 px-2 text-center">Proyek</th>
                    <th className="py-1.5 px-2 text-right">Pcs</th>
                    <th className="py-1.5 px-2 text-right">Total Upah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/40">
                  {reportData.per_penjahit.map((t, idx) => (
                    <tr key={t.user_id}>
                      <td className="py-1.5 px-2 text-center">{idx + 1}</td>
                      <td className="py-1.5 px-2 font-semibold">{t.nama_penjahit} (@{t.username_penjahit})</td>
                      <td className="py-1.5 px-2 text-center">{t.total_proyek}</td>
                      <td className="py-1.5 px-2 text-right">{formatNumber(t.total_pcs)} pcs</td>
                      <td className="py-1.5 px-2 text-right">{formatRupiah(t.total_upah)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-black text-[10px] text-gray-600">
              Catatan: Berdasarkan tanggal kerja. Minggu yang melewati pergantian bulan terbagi ke dua bulan. Belum termasuk bonus reward dan kasbon.
            </div>
          </div>
        )
      )}
    </div>
  );
}
