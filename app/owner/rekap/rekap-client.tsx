"use client";

import * as React from "react";
import {
  FileSpreadsheet,
  Banknote,
  Calendar,
  CheckCircle2,
  Printer,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { CardAccent } from "@/components/ui/card-accent";
import { Button } from "@/components/ui/button";
import { SegmentedPill, SegmentedOption } from "@/components/ui/segmented-pill";
import { Dialog } from "@/components/ui/dialog";
import { formatNumber, formatRupiah, formatDateId } from "@/lib/format";
import {
  WeekOption,
  determineWagePaymentStatus,
  getPaymentStatusBadgeInfo,
} from "@/lib/wage";
import { WeeklyWagePaymentStatus } from "@/lib/types/database";
import {
  markWagePaidAction,
  markAllWagesPaidAction,
  cancelWagePaymentAction,
} from "./actions";
import { createClient } from "@/lib/supabase/client";

export interface ProjectWageDetail {
  project_id: string;
  nama_proyek: string;
  tarif_snapshot: number;
  total_pcs: number;
  subtotal: number;
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
  initialSummary: PenjahitWageRekapItem[];
  weekOptions: WeekOption[];
  currentWeekStartDate: string;
}

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

export function RekapClient({
  initialSummary,
  weekOptions,
  currentWeekStartDate,
}: RekapClientProps) {
  const [selectedWeekStart, setSelectedWeekStart] = React.useState<string>(currentWeekStartDate);
  const [summary, setSummary] = React.useState<PenjahitWageRekapItem[]>(initialSummary);
  const [isLoading, setIsLoading] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // State Dialog Tandai Dibayar Single
  const [payModalItem, setPayModalItem] = React.useState<PenjahitWageRekapItem | null>(null);
  const [payNote, setPayNote] = React.useState("");
  const [isSubmittingPay, setIsSubmittingPay] = React.useState(false);

  // State Dialog Tandai Semua Dibayar
  const [isAllPayModalOpen, setIsAllPayModalOpen] = React.useState(false);
  const [isSubmittingAllPay, setIsSubmittingAllPay] = React.useState(false);

  // State Dialog Batalkan Pembayaran
  const [cancelModalPayment, setCancelModalPayment] = React.useState<WagePaymentRecordItem | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const [isSubmittingCancel, setIsSubmittingCancel] = React.useState(false);

  // State Expand Riwayat Transaksi per Penjahit
  const [expandedUserIds, setExpandedUserIds] = React.useState<Record<string, boolean>>({});

  const selectedWeekOption =
    weekOptions.find((w) => w.startDate === selectedWeekStart) || weekOptions[0];

  const pillOptions: SegmentedOption[] = weekOptions.map((w) => ({
    value: w.startDate,
    label: w.label,
  }));

  // Hitung total akumulasi
  const grandTotalPcs = summary.reduce((sum, item) => sum + item.total_pcs_disetujui, 0);
  const grandTotalUpah = summary.reduce((sum, item) => sum + item.total_upah, 0);
  const grandTotalDibayar = summary.reduce((sum, item) => sum + item.total_dibayar, 0);
  const grandTotalSisa = summary.reduce((sum, item) => sum + item.sisa, 0);

  const pendingTailorsCount = summary.filter((item) => item.sisa > 0).length;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Muat ulang data minggu saat berganti tab
  const handleSelectWeek = async (weekStart: string) => {
    setSelectedWeekStart(weekStart);
    setIsLoading(true);

    const week = weekOptions.find((w) => w.startDate === weekStart);
    if (!week) {
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      const [entriesRes, paymentsRes] = await Promise.all([
        supabase
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
          .gte("tanggal_kerja", week.startDate)
          .lte("tanggal_kerja", week.endDate),
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
          .eq("periode_mulai", week.startDate),
      ]);

      const entries = (entriesRes.data as unknown as RawEntryRow[]) || [];
      const payments = (paymentsRes.data as unknown as RawPaymentRow[]) || [];

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

      updatedSummary.sort((a, b) => b.total_pcs_disetujui - a.total_pcs_disetujui);
      setSummary(updatedSummary);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  // Eksekusi Konfirmasi Bayar Tunai per Penjahit
  const handleConfirmPay = async () => {
    if (!payModalItem) return;
    setIsSubmittingPay(true);

    const res = await markWagePaidAction({
      userId: payModalItem.user_id,
      weekStartDate: selectedWeekStart,
      catatan: payNote.trim() || undefined,
    });

    setIsSubmittingPay(false);
    if (res.success) {
      showToast(`Upah ${payModalItem.nama_penjahit} berhasil ditandai dibayar!`);
      setPayModalItem(null);
      setPayNote("");
      handleSelectWeek(selectedWeekStart);
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
      weekStartDate: selectedWeekStart,
      items: pendingItems,
    });

    setIsSubmittingAllPay(false);
    setIsAllPayModalOpen(false);

    if (res.success) {
      showToast(`${res.count} pembayaran penjahit berhasil ditandai dibayar!`);
      handleSelectWeek(selectedWeekStart);
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
      handleSelectWeek(selectedWeekStart);
    } else {
      setCancelError(res.error || "Gagal membatalkan catatan.");
    }
  };

  const toggleExpand = (userId: string) => {
    setExpandedUserIds((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

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
            Rekap Upah & Status Pembayaran
          </h1>
          <p className="text-[13px] text-muted mt-0.5">
            Kalkulasi otomatis tiap Sabtu dan pencatatan riwayat pembayaran tunai penjahit.
          </p>
        </div>

        {/* Tombol Cetak Slip */}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => window.print()}
          className="self-start sm:self-auto shrink-0 print:hidden"
        >
          <Printer className="w-3.5 h-3.5 mr-1.5" />
          Cetak Slip Upah
        </Button>
      </div>

      {/* Pemilih Minggu (SegmentedPill) */}
      <div className="space-y-2 print:hidden">
        <div className="overflow-x-auto pb-1">
          <SegmentedPill
            options={pillOptions}
            value={selectedWeekStart}
            onChange={handleSelectWeek}
            activeVariant="dark"
          />
        </div>
        <p className="text-[12px] text-muted flex items-center gap-1.5 pl-1">
          <Calendar className="w-3.5 h-3.5 text-muted" />
          <span>
            Periode Minggu: <strong>{formatDateId(selectedWeekOption.startDate)}</strong> s.d.{" "}
            <strong>{formatDateId(selectedWeekOption.endDate)}</strong> (WIB)
          </span>
        </p>
      </div>

      {/* Kartu Aksen Lime: Total Pengeluaran Upah & Status Pembayaran */}
      <CardAccent className="p-5 sm:p-6 shadow-card">
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
              Total Upah Periode Ini:
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

          <div className="sm:col-span-4 flex flex-col justify-end items-start sm:items-end gap-2 print:hidden">
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
            <strong>TUNAI</strong> di konveksi tiap hari Sabtu. Sistem FCHub menghitung dan mencatat
            status bayar (Lunas, Belum dibayar, Kurang/Lebih bayar) untuk mencegah selisih dan catatan
            ganda.
          </div>
        </div>
      </CardAccent>

      {/* Konten Rekap Penjahit */}
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
                            <div>{row.nama_penjahit}</div>
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

                              {hasPayments && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(row.user_id)}
                                  className="p-1 rounded-md text-muted hover:text-ink hover:bg-surface-muted transition"
                                  title="Lihat riwayat catatan pembayaran"
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

                        {/* Baris Expandable Riwayat Transaksi */}
                        {isExpanded && hasPayments && (
                          <tr className="bg-surface-muted/60">
                            <td colSpan={7} className="p-3.5 text-[12px]">
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
                                        className={`p-2.5 rounded-panel border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                          isBatal
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
                                              className={`text-[10px] px-2 py-0.2 rounded-pill font-bold ${
                                                isBatal
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
                                          {p.catatan && (
                                            <p className="text-[11px] text-muted mt-0.5">
                                              Catatan: {p.catatan}
                                            </p>
                                          )}
                                          {isBatal && (
                                            <p className="text-[11px] text-negative no-underline mt-0.5">
                                              Alasan batal: {p.alasan_batal} (oleh{" "}
                                              {p.dibatalkan_oleh_nama})
                                            </p>
                                          )}
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

          {/* B. TAMPILAN MOBILE: Daftar Kartu Per Penjahit (< 640px / 390px) */}
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
                        <h4 className="text-[15px] font-semibold text-ink truncate leading-tight">
                          {row.nama_penjahit}
                        </h4>
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
                        className={`font-semibold tabular-nums ${
                          row.sisa > 0 ? "text-[#B77407]" : "text-positive"
                        }`}
                      >
                        {formatRupiah(row.sisa)}
                      </span>
                    </div>
                  </div>

                  {row.tanggal_bayar_terakhir && (
                    <div className="pt-2 text-[11px] text-muted flex items-center justify-between">
                      <span>
                        Dibayar: {formatDateId(row.tanggal_bayar_terakhir)} ({row.dibayar_oleh_nama})
                      </span>
                    </div>
                  )}

                  {/* Aksi Mobile */}
                  <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-line/40 print:hidden">
                    {hasPayments ? (
                      <button
                        type="button"
                        onClick={() => toggleExpand(row.user_id)}
                        className="text-[12px] font-semibold text-muted hover:text-ink flex items-center gap-1"
                      >
                        {isExpanded ? "Tutup Riwayat" : `Riwayat (${row.payments.length})`}
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted">Belum ada bayar</span>
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

                  {/* Riwayat Pembayaran Mobile */}
                  {isExpanded && hasPayments && (
                    <div className="mt-3 pt-2.5 border-t border-dashed border-line space-y-2">
                      <span className="text-[11px] font-bold text-muted uppercase">
                        Catatan Transaksi:
                      </span>
                      {row.payments.map((p) => {
                        const isBatal = p.status === "dibatalkan";
                        return (
                          <div
                            key={p.id}
                            className={`p-2 rounded-panel border text-[12px] ${
                              isBatal
                                ? "bg-surface-muted/40 line-through text-muted"
                                : "bg-surface-muted/80"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold">{formatRupiah(p.jumlah)}</span>
                              {!isBatal && (
                                <button
                                  type="button"
                                  onClick={() => setCancelModalPayment(p)}
                                  className="text-[11px] text-negative font-semibold underline"
                                >
                                  Batalkan
                                </button>
                              )}
                            </div>
                            <span className="text-[10px] text-muted block mt-0.5">
                              {formatDateId(p.dibayar_pada)} oleh {p.dibayar_oleh_nama}
                            </span>
                            {isBatal && (
                              <span className="text-[10px] text-negative no-underline block mt-0.5">
                                Batal: {p.alasan_batal}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ==============================================================================
          DIALOG 1: KONFIRMASI TANDAI DIBAYAR (SINGLE PENJAHIT)
          ============================================================================== */}
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
                  {formatDateId(selectedWeekOption.startDate)} -{" "}
                  {formatDateId(selectedWeekOption.endDate)}
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
                        <span className="text-muted text-[11px]">
                          {pd.total_pcs} pcs × {formatRupiah(pd.tarif_snapshot)}
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

      {/* ==============================================================================
          DIALOG 2: KONFIRMASI TANDAI SEMUA DIBAYAR (MASSAL)
          ============================================================================== */}
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

      {/* ==============================================================================
          DIALOG 3: BATALKAN PEMBAYARAN (ALASAN WAJIB)
          ============================================================================== */}
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
    </div>
  );
}
