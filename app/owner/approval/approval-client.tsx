"use client";

import * as React from "react";
import {
  CheckSquare,
  Check,
  X,
  AlertCircle,
  AlertTriangle,
  AlertOctagon,
  Copy,
  CalendarClock,
  ArrowUpDown,
  Calendar,
  Layers,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  formatNumber,
  formatDateId,
  formatWageCalculation,
  formatTarifPerPcs,
} from "@/lib/format";
import { EntryFlagItem } from "@/lib/types/database";
import { ProjectSelect, ProjectSelectItem } from "@/components/project-select";
import {
  approveEntryAction,
  rejectEntryAction,
  correctAndApproveEntryAction,
  approveAllEntriesAction,
} from "./actions";

export interface ApprovalEntryItem {
  id: string;
  user_id: string;
  nama_penjahit: string;
  username_penjahit: string;
  project_id: string;
  nama_proyek: string;
  tarif_per_pcs: number;
  tanggal_kerja: string;
  qty: number;
  dibuat_pada: string;
  has_active_payment?: boolean;
  anomaly?: EntryFlagItem;
}

interface ApprovalClientProps {
  initialEntries: ApprovalEntryItem[];
  availableProjects: ProjectSelectItem[];
  initialProjectId?: string;
  initialFilter?: string;
}

export function ApprovalClient({
  initialEntries,
  availableProjects,
  initialProjectId = "all",
  initialFilter = "all",
}: ApprovalClientProps) {
  const [entries, setEntries] = React.useState<ApprovalEntryItem[]>(initialEntries);

  // Filter
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>(initialProjectId);
  const [selectedDate, setSelectedDate] = React.useState<string>("all");
  const [selectedFilterTab, setSelectedFilterTab] = React.useState<"all" | "flagged">(
    initialFilter === "flagged" ? "flagged" : "all"
  );
  const [sortFlaggedFirst, setSortFlaggedFirst] = React.useState<boolean>(
    initialFilter === "flagged"
  );

  React.useEffect(() => {
    if (initialProjectId && initialProjectId !== "all") {
      setSelectedProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  React.useEffect(() => {
    if (initialFilter === "flagged") {
      setSelectedFilterTab("flagged");
      setSortFlaggedFirst(true);
    }
  }, [initialFilter]);

  // Loading state per item untuk mencegah double-click
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Modal Penolakan (Klik X)
  const [rejectingItem, setRejectingItem] = React.useState<ApprovalEntryItem | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejectError, setRejectError] = React.useState<string | null>(null);
  const [isRejecting, setIsRejecting] = React.useState(false);

  // Modal Koreksi Jumlah (Ketuk Baris)
  const [correctingItem, setCorrectingItem] = React.useState<ApprovalEntryItem | null>(null);
  const [correctedQty, setCorrectedQty] = React.useState<number>(100);
  const [correctionNote, setCorrectionNote] = React.useState("");
  const [correctError, setCorrectError] = React.useState<string | null>(null);
  const [isCorrecting, setIsCorrecting] = React.useState(false);

  // Modal Konfirmasi "Setujui Semua"
  const [isApproveAllOpen, setIsApproveAllOpen] = React.useState(false);
  const [isApprovingAll, setIsApprovingAll] = React.useState(false);
  const [targetBatchDate, setTargetBatchDate] = React.useState<string | null>(null);
  const [includeFlaggedInBatch, setIncludeFlaggedInBatch] = React.useState(false);

  // Modal Peringatan: Entri Berada di Minggu yang Sudah Memiliki Pembayaran Aktif
  const [pendingActionWithWarning, setPendingActionWithWarning] = React.useState<{
    entry: ApprovalEntryItem;
    type: "approve" | "reject" | "correct";
    params?: { qty?: number; catatan?: string };
  } | null>(null);

  // Tampilkan toast singkat
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Helper eksekusi persetujuan langsung
  const executeApprove = async (entry: ApprovalEntryItem) => {
    setProcessingId(entry.id);
    const result = await approveEntryAction(entry.id);

    if (result.success) {
      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
      showToast(`Entri ${entry.nama_penjahit} (${entry.qty} pcs) disetujui.`);
    }
    setProcessingId(null);
  };

  // Helper eksekusi penolakan
  const executeReject = async (entry: ApprovalEntryItem, catatan: string) => {
    setIsRejecting(true);
    setRejectError(null);

    const result = await rejectEntryAction({
      id: entry.id,
      catatan,
    });

    if (!result.success) {
      setRejectError(result.error || "Gagal menolak entri.");
      setIsRejecting(false);
      return;
    }

    setEntries((prev) => prev.filter((item) => item.id !== entry.id));
    showToast(`Entri ${entry.nama_penjahit} ditolak.`);
    setIsRejecting(false);
    setRejectingItem(null);
  };

  // Helper eksekusi koreksi
  const executeCorrect = async (entry: ApprovalEntryItem, qty: number, catatan?: string) => {
    setIsCorrecting(true);
    setCorrectError(null);

    const result = await correctAndApproveEntryAction({
      id: entry.id,
      qty_disetujui: qty,
      catatan: catatan || undefined,
    });

    if (!result.success) {
      setCorrectError(result.error || "Gagal mengoreksi entri.");
      setIsCorrecting(false);
      return;
    }

    setEntries((prev) => prev.filter((item) => item.id !== entry.id));
    showToast(`Entri dikoreksi menjadi ${qty} pcs dan disetujui.`);
    setIsCorrecting(false);
    setCorrectingItem(null);
  };

  // Handler Lanjut dari Dialog Peringatan
  const handleProceedWarning = async () => {
    if (!pendingActionWithWarning) return;
    const { entry, type, params } = pendingActionWithWarning;
    setPendingActionWithWarning(null);

    if (type === "approve") {
      await executeApprove(entry);
    } else if (type === "reject") {
      await executeReject(entry, params?.catatan || "");
    } else if (type === "correct") {
      await executeCorrect(entry, params?.qty || entry.qty, params?.catatan);
    }
  };

  // Jumlah entri bertanda pada cakupan proyek saat ini
  const flaggedCountInScope = entries.filter((item) => {
    if (selectedProjectId !== "all" && item.project_id !== selectedProjectId) {
      return false;
    }
    return Boolean(item.anomaly && item.anomaly.tingkat !== "normal");
  }).length;

  const totalInScope = entries.filter((item) => {
    if (selectedProjectId !== "all" && item.project_id !== selectedProjectId) {
      return false;
    }
    return true;
  }).length;

  // Filter entri
  let filteredEntries = entries.filter((item) => {
    if (selectedProjectId !== "all" && item.project_id !== selectedProjectId) {
      return false;
    }
    if (selectedDate !== "all" && item.tanggal_kerja !== selectedDate) {
      return false;
    }
    if (selectedFilterTab === "flagged") {
      return Boolean(item.anomaly && item.anomaly.tingkat !== "normal");
    }
    return true;
  });

  // Urutkan entri: bila sortFlaggedFirst aktif, prioritaskan entri bertanda di posisi atas
  if (sortFlaggedFirst) {
    filteredEntries = [...filteredEntries].sort((a, b) => {
      const aFlagged = a.anomaly && a.anomaly.tingkat !== "normal" ? 1 : 0;
      const bFlagged = b.anomaly && b.anomaly.tingkat !== "normal" ? 1 : 0;
      if (aFlagged !== bFlagged) {
        return bFlagged - aFlagged;
      }
      if (a.tanggal_kerja !== b.tanggal_kerja) {
        return a.tanggal_kerja < b.tanggal_kerja ? 1 : -1;
      }
      return a.dibuat_pada < b.dibuat_pada ? 1 : -1;
    });
  }

  // Kumpulan tanggal unik untuk filter
  const uniqueDates = Array.from(new Set(entries.map((e) => e.tanggal_kerja))).sort(
    (a, b) => (a < b ? 1 : -1)
  );

  // Mengelompokkan entri yang telah difilter per tanggal kerja
  const groupedEntries: Record<string, ApprovalEntryItem[]> = {};
  filteredEntries.forEach((item) => {
    if (!groupedEntries[item.tanggal_kerja]) {
      groupedEntries[item.tanggal_kerja] = [];
    }
    groupedEntries[item.tanggal_kerja].push(item);
  });

  const sortedDates = Object.keys(groupedEntries).sort((a, b) => (a < b ? 1 : -1));

  // 1. Eksekusi Setujui Langsung
  const handleApprove = async (entry: ApprovalEntryItem, e: React.MouseEvent) => {
    e.stopPropagation(); // Mencegah terbukanya modal koreksi
    if (processingId) return;

    if (entry.has_active_payment) {
      setPendingActionWithWarning({ entry, type: "approve" });
      return;
    }

    await executeApprove(entry);
  };

  // 2. Eksekusi Tolak
  const handleOpenReject = (entry: ApprovalEntryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setRejectingItem(entry);
    setRejectReason("");
    setRejectError(null);
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem) return;

    if (!rejectReason.trim() || rejectReason.trim().length < 2) {
      setRejectError("Catatan penolakan wajib diisi (minimal 2 karakter).");
      return;
    }

    const note = rejectReason.trim();

    if (rejectingItem.has_active_payment) {
      setPendingActionWithWarning({
        entry: rejectingItem,
        type: "reject",
        params: { catatan: note },
      });
      setRejectingItem(null);
      return;
    }

    await executeReject(rejectingItem, note);
  };

  // 3. Eksekusi Koreksi Jumlah (Ketuk Baris)
  const handleOpenCorrection = (entry: ApprovalEntryItem) => {
    setCorrectingItem(entry);
    setCorrectedQty(entry.qty);
    setCorrectionNote("");
    setCorrectError(null);
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingItem) return;

    const qty = Number(correctedQty);
    const note = correctionNote.trim();

    if (correctingItem.has_active_payment) {
      setPendingActionWithWarning({
        entry: correctingItem,
        type: "correct",
        params: { qty, catatan: note },
      });
      setCorrectingItem(null);
      return;
    }

    await executeCorrect(correctingItem, qty, note);
  };

  // 4. Eksekusi Setujui Semua
  const handleOpenApproveAll = (date?: string) => {
    setTargetBatchDate(date || null);
    setIncludeFlaggedInBatch(false);
    setIsApproveAllOpen(true);
  };

  const batchTargetEntries = React.useMemo(() => {
    if (targetBatchDate) {
      return entries.filter((e) => e.tanggal_kerja === targetBatchDate);
    }
    return filteredEntries;
  }, [entries, filteredEntries, targetBatchDate]);

  const batchFlaggedEntries = React.useMemo(() => {
    return batchTargetEntries.filter((e) => e.anomaly && e.anomaly.tingkat !== "normal");
  }, [batchTargetEntries]);

  const batchCleanEntries = React.useMemo(() => {
    return batchTargetEntries.filter((e) => !e.anomaly || e.anomaly.tingkat === "normal");
  }, [batchTargetEntries]);

  const entriesToApprove = includeFlaggedInBatch ? batchTargetEntries : batchCleanEntries;
  const countToApprove = entriesToApprove.length;
  const totalBatchPcs = entriesToApprove.reduce((sum, e) => sum + e.qty, 0);

  const handleApproveAllSubmit = async () => {
    setIsApprovingAll(true);
    const ids = entriesToApprove.map((e) => e.id);

    if (ids.length === 0) {
      setIsApprovingAll(false);
      return;
    }

    const result = await approveAllEntriesAction(ids);

    if (result.success) {
      setEntries((prev) => prev.filter((item) => !ids.includes(item.id)));
      showToast(`${ids.length} entri (${formatNumber(totalBatchPcs)} pcs) berhasil disetujui.`);
      setIsApproveAllOpen(false);
      setIncludeFlaggedInBatch(false);
    }
    setIsApprovingAll(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Toast Notifikasi */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-forest-900 text-lime-400 px-4 py-2.5 rounded-pill shadow-2xl text-[13px] font-semibold flex items-center gap-2 border border-lime-400/30 animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <CheckCircle2 className="w-4 h-4 text-lime-400 stroke-[2.5]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Halaman & Aksi Cepat */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] sm:text-[24px] font-semibold text-ink leading-tight">
              Antrean Approval Harian
            </h1>
            {entries.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-pill bg-warning/15 text-[#B77407] text-[12px] font-semibold tabular-nums">
                {entries.length} menunggu
              </span>
            )}
          </div>
          <p className="text-[13px] text-muted mt-1">
            Verifikasi input malam penjahit: setujui langsung, koreksi jumlah, atau tolak dengan catatan.
          </p>
        </div>

        {filteredEntries.length > 0 && (
          <Button
            variant="primary"
            onClick={() => handleOpenApproveAll()}
            className="shrink-0 h-11"
          >
            <CheckSquare className="w-4 h-4 mr-1.5 stroke-[2.2]" />
            Setujui Semua ({filteredEntries.length})
          </Button>
        )}
      </div>

      {/* Pemilih Proyek Dropdown Pencarian */}
      {availableProjects.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3 sm:p-4 rounded-panel border border-line shadow-card">
          <div className="w-full sm:max-w-md">
            <ProjectSelect
              projects={availableProjects}
              selectedProjectId={selectedProjectId}
              onChange={(id) => {
                setSelectedProjectId(id);
                if (typeof window !== "undefined") {
                  const params = new URLSearchParams(window.location.search);
                  if (id === "all") {
                    params.delete("project");
                  } else {
                    params.set("project", id);
                  }
                  const qs = params.toString();
                  window.history.replaceState(null, "", qs ? `/owner/approval?${qs}` : "/owner/approval");
                }
              }}
              syncWithUrl={false}
              placeholder="Pilih atau cari proyek..."
            />
          </div>

          <div className="flex items-center gap-2 text-[12px] text-muted">
            <span>Filter Proyek:</span>
            <span className="font-semibold text-ink">
              {selectedProjectId === "all"
                ? `Semua Proyek (${availableProjects.length})`
                : availableProjects.find((p) => p.id === selectedProjectId)?.nama || "Semua Proyek"}
            </span>
          </div>
        </div>
      )}

      {/* Bar Filter Status Anomali, Tanggal & Urutan */}
      {entries.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface rounded-card border border-line">
          {/* Kiri: Chip Filter Tab (Semua vs Perlu Dicek) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedFilterTab("all")}
              className={`px-3 py-1.5 rounded-pill text-[12px] font-semibold transition-all ${
                selectedFilterTab === "all"
                  ? "bg-forest-900 text-white shadow-sm"
                  : "bg-surface-muted border border-line text-muted hover:text-ink"
              }`}
            >
              Semua ({totalInScope})
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedFilterTab("flagged");
                setSortFlaggedFirst(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-[12px] font-semibold transition-all ${
                selectedFilterTab === "flagged"
                  ? "bg-amber-600 text-white shadow-sm ring-1 ring-amber-600/30"
                  : "bg-surface-muted border border-line text-muted hover:text-ink"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Perlu dicek</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                  selectedFilterTab === "flagged"
                    ? "bg-white text-amber-700"
                    : flaggedCountInScope > 0
                    ? "bg-amber-200 text-amber-900"
                    : "bg-line text-muted"
                }`}
              >
                {flaggedCountInScope}
              </span>
            </button>
          </div>

          {/* Kanan: Dropdown Tanggal, Dropdown Proyek & Toggle Urutkan Bertanda */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Tanggal */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted" />
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 px-2.5 rounded-control bg-surface-muted border border-line text-[12px] text-ink focus:outline-none focus:border-forest-900"
              >
                <option value="all">Semua Tanggal ({uniqueDates.length})</option>
                {uniqueDates.map((d) => (
                  <option key={d} value={d}>
                    {formatDateId(d)}
                  </option>
                ))}
              </select>
            </div>

            {/* Toggle Urutkan Bertanda Dulu */}
            <button
              type="button"
              onClick={() => setSortFlaggedFirst(!sortFlaggedFirst)}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control text-[12px] font-medium border transition-colors ${
                sortFlaggedFirst
                  ? "bg-amber-50 border-amber-300 text-amber-900 font-semibold"
                  : "bg-surface-muted border-line text-muted hover:text-ink"
              }`}
              title="Urutkan input yang memiliki peringatan di posisi teratas"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Urutkan bertanda dulu</span>
            </button>

            {(selectedDate !== "all" || selectedProjectId !== "all" || selectedFilterTab !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDate("all");
                  setSelectedProjectId("all");
                  setSelectedFilterTab("all");
                  setSortFlaggedFirst(false);
                }}
                className="text-[12px] text-muted hover:text-ink underline ml-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Konten Antrean Entri */}
      {filteredEntries.length === 0 ? (
        <Card className="text-center py-14 px-6 shadow-card">
          <div className="w-12 h-12 rounded-[16px] bg-lime-100 text-positive mx-auto flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6 stroke-[2.2]" />
          </div>
          <h3 className="text-[17px] font-semibold text-ink">
            {selectedFilterTab === "flagged"
              ? "Tidak Ada yang Perlu Dicek"
              : "Tidak Ada Input yang Menunggu"}
          </h3>
          <p className="text-[13px] text-muted max-w-sm mx-auto mt-1">
            {entries.length === 0
              ? "Semua input produksi penjahit telah diverifikasi. Input baru yang dikirim malam hari akan muncul di sini."
              : selectedFilterTab === "flagged"
              ? "Tidak ada input dengan tanda anomali pada filter saat ini. Seluruh entri berada dalam batas wajar."
              : "Tidak ada entri yang cocok dengan filter yang dipilih."}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateStr) => {
            const dateEntries = groupedEntries[dateStr];
            const dateSubtotalPcs = dateEntries.reduce((sum, e) => sum + e.qty, 0);

            return (
              <div key={dateStr} className="space-y-2.5">
                {/* Header Tanggal Kelompok */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-forest-900" />
                    <h2 className="text-[15px] font-semibold text-ink">
                      {formatDateId(dateStr)}
                    </h2>
                    <span className="text-[12px] text-muted">
                      · {dateEntries.length} entri ({formatNumber(dateSubtotalPcs)} pcs)
                    </span>
                  </div>

                  {dateEntries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleOpenApproveAll(dateStr)}
                      className="text-[12px] font-semibold text-forest-900 hover:underline"
                    >
                      Setujui Tanggal Ini
                    </button>
                  )}
                </div>

                {/* Daftar Baris Entri */}
                <Card className="p-0 overflow-hidden divide-y divide-line/60 shadow-card">
                  {dateEntries.map((item) => {
                    const initials = item.nama_penjahit
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    const isProcessing = processingId === item.id;
                    const hasAnomaly = Boolean(item.anomaly && item.anomaly.tingkat !== "normal");

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleOpenCorrection(item)}
                        className={`p-4 flex flex-col gap-2 hover:bg-surface-muted/60 transition cursor-pointer select-none ${
                          hasAnomaly ? "bg-amber-50/20" : ""
                        } ${isProcessing ? "opacity-50 pointer-events-none" : ""}`}
                        title="Ketuk baris untuk mengoreksi jumlah"
                      >
                        {/* Baris Utama */}
                        <div className="flex items-center justify-between gap-3">
                          {/* Kiri: Avatar & Info Penjahit */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-surface-muted flex items-center justify-center text-[13px] font-semibold text-ink shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="text-[15px] font-semibold text-ink leading-snug truncate">
                                  {item.nama_penjahit}
                                </h3>
                                <span className="text-[11px] text-muted font-mono hidden sm:inline">
                                  @{item.username_penjahit}
                                </span>
                              </div>
                              <p className="text-[12px] text-muted mt-0.5 truncate flex items-center gap-1">
                                <Layers className="w-3 h-3 text-muted shrink-0" />
                                <span>{item.nama_proyek}</span>
                              </p>
                            </div>
                          </div>

                          {/* Kanan: Qty & Tombol Aksi Bulat 36px Sesuai design-fchub.md */}
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className="text-[17px] font-semibold text-ink tabular-nums block leading-tight">
                                {formatNumber(item.qty)} pcs
                              </span>
                              <span className="text-[11px] text-muted block mt-0.5">
                                Tarif proyek: {formatTarifPerPcs(item.tarif_per_pcs)}
                              </span>
                              <span className="text-[11px] font-mono text-forest-900 font-semibold block">
                                {formatWageCalculation(item.qty, item.tarif_per_pcs)}
                              </span>
                              <span className="text-[10px] text-muted/80 block italic">
                                (tarif snapshot saat input dibuat)
                              </span>
                            </div>

                            {/* Tombol Bulat Centang (Setujui) & X (Tolak) */}
                            <div className="flex items-center gap-2 pl-2 border-l border-line/60">
                              <button
                                type="button"
                                onClick={(e) => handleApprove(item, e)}
                                disabled={isProcessing}
                                aria-label="Setujui langsung entri ini"
                                title="Setujui"
                                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-lime-100 text-positive hover:bg-lime-500 hover:text-forest-900 flex items-center justify-center transition active:scale-95 shadow-sm"
                              >
                                <Check className="w-4 h-4 stroke-[2.5]" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => handleOpenReject(item, e)}
                                disabled={isProcessing}
                                aria-label="Tolak entri ini dengan catatan"
                                title="Tolak"
                                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-negative/10 text-negative hover:bg-negative/20 flex items-center justify-center transition active:scale-95"
                              >
                                <X className="w-4 h-4 stroke-[2.5]" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Baris Indikator Peringatan Anomali (Tahap 16) */}
                        {hasAnomaly && item.anomaly && (
                          <div className="mt-1 pt-2 border-t border-line/50 flex flex-wrap items-center gap-1.5">
                            {item.anomaly.alasan.map((reason, rIdx) => {
                              let IconComponent = AlertTriangle;
                              if (reason.kode === "sangat_tinggi") IconComponent = AlertOctagon;
                              else if (reason.kode === "kemungkinan_ganda") IconComponent = Copy;
                              else if (reason.kode === "tanggal_masa_depan") IconComponent = CalendarClock;

                              return (
                                <div
                                  key={rIdx}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-panel text-[11px] font-medium border ${
                                    reason.kode === "sangat_tinggi"
                                      ? "bg-rose-50 text-rose-800 border-rose-200"
                                      : "bg-amber-50 text-amber-800 border-amber-200"
                                  }`}
                                >
                                  <IconComponent className="w-3.5 h-3.5 shrink-0 stroke-[2.2]" />
                                  <span className="font-semibold">{reason.judul}:</span>
                                  <span>{reason.deskripsi}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* 1. Modal / Sheet Koreksi Jumlah (Ketuk Baris) */}
      <Dialog
        isOpen={!!correctingItem}
        onClose={() => setCorrectingItem(null)}
        title="Koreksi Jumlah & Setujui"
        subtitle={
          correctingItem
            ? `Entri milik ${correctingItem.nama_penjahit} pada ${formatDateId(correctingItem.tanggal_kerja)}`
            : ""
        }
      >
        {correctError && (
          <div className="mb-4 p-3 rounded-panel bg-negative/10 border border-negative/20 text-negative text-[13px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 stroke-[2]" />
            <span>{correctError}</span>
          </div>
        )}

        {correctingItem && (
          <form onSubmit={handleCorrectionSubmit} className="space-y-4">
            {/* Info Angka Asli Penjahit & Tarif Proyek */}
            <div className="p-3 bg-surface-muted rounded-panel border border-line flex items-center justify-between text-[13px]">
              <div>
                <span className="text-muted block text-[11px]">Jumlah Input Penjahit (Asli):</span>
                <strong className="text-ink font-semibold text-[16px] tabular-nums">
                  {formatNumber(correctingItem.qty)} pcs
                </strong>
                <span className="text-[11px] font-mono text-muted block mt-0.5">
                  Nilai awal: {formatWageCalculation(correctingItem.qty, correctingItem.tarif_per_pcs)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-muted block">Tarif Proyek:</span>
                <strong className="text-forest-900 font-mono text-[13px]">
                  {formatTarifPerPcs(correctingItem.tarif_per_pcs)}
                </strong>
                <span className="text-[10px] text-muted block italic">
                  (tarif snapshot)
                </span>
              </div>
            </div>

            {/* Input Jumlah Disetujui */}
            <div>
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
                Jumlah Akhir Disetujui (Pcs)
              </label>
              <input
                type="number"
                min={0}
                required
                value={correctedQty}
                onChange={(e) => setCorrectedQty(Number(e.target.value))}
                className="w-full h-12 px-4 rounded-control bg-surface-muted border border-line text-ink text-[18px] font-semibold tabular-nums focus:outline-none focus:border-forest-900"
              />
              <p className="text-[11.5px] font-mono text-forest-900 font-semibold mt-1.5 tabular-nums">
                Estimasi upah baru: {formatWageCalculation(correctedQty, correctingItem.tarif_per_pcs)}
              </p>
            </div>

            {/* Catatan Koreksi */}
            <div>
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
                Catatan Owner (Opsional)
              </label>
              <input
                type="text"
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                placeholder="contoh: Koreksi 10 pcs reject jahitan melenceng"
                className="w-full h-11 px-3.5 rounded-control bg-surface-muted border border-line text-ink text-[13px] focus:outline-none focus:border-forest-900"
              />
              <p className="text-[11px] text-muted mt-1">
                Catatan ini akan dapat dibaca oleh penjahit pada tab Riwayat.
              </p>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-line/60">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCorrectingItem(null)}
                disabled={isCorrecting}
              >
                Batal
              </Button>
              <Button type="submit" variant="primary" disabled={isCorrecting}>
                {isCorrecting ? "Memproses..." : "Setujui dengan Koreksi"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* 2. Modal Penolakan Entri (Klik X) */}
      <Dialog
        isOpen={!!rejectingItem}
        onClose={() => setRejectingItem(null)}
        title="Tolak Entri Hasil Kerja"
        subtitle={
          rejectingItem
            ? `Tolak ${rejectingItem.qty} pcs dari ${rejectingItem.nama_penjahit}`
            : ""
        }
      >
        {rejectError && (
          <div className="mb-4 p-3 rounded-panel bg-negative/10 border border-negative/20 text-negative text-[13px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 stroke-[2]" />
            <span>{rejectError}</span>
          </div>
        )}

        {rejectingItem && (
          <form onSubmit={handleRejectSubmit} className="space-y-4">
            <div className="p-3 bg-negative/5 border border-negative/20 rounded-panel text-[12px] text-negative">
              Entri yang ditolak tidak akan dihitung ke upah atau progres proyek. Penjahit dapat mengirim entri baru setelah membaca catatan ini.
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
                Catatan Alasan Penolakan (Wajib)
              </label>
              <textarea
                required
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="misal: Jumlah fisik tas tidak sesuai buku hitung / bahan reject belum diperbaiki"
                className="w-full p-3 rounded-control bg-surface-muted border border-line text-ink text-[13px] focus:outline-none focus:border-negative"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-line/60">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRejectingItem(null)}
                disabled={isRejecting}
              >
                Batal
              </Button>
              <Button type="submit" variant="danger" disabled={isRejecting}>
                {isRejecting ? "Menolak..." : "Ya, Tolak Entri"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* 3. Modal Konfirmasi "Setujui Semua" (Tahap 16: Pengecualian Input Bertanda) */}
      <Dialog
        isOpen={isApproveAllOpen}
        onClose={() => {
          setIsApproveAllOpen(false);
          setIncludeFlaggedInBatch(false);
        }}
        title="Setujui Semua Entri?"
        subtitle="Verifikasi massal tanpa koreksi jumlah."
      >
        <div className="space-y-4">
          <p className="text-[13px] text-muted leading-relaxed">
            Anda akan menyetujui sekaligus{" "}
            <strong className="text-ink font-semibold">
              {countToApprove} entri produksi
            </strong>{" "}
            dengan total{" "}
            <strong className="text-forest-900 font-semibold">
              {formatNumber(totalBatchPcs)} pcs
            </strong>
            {targetBatchDate ? ` untuk tanggal ${formatDateId(targetBatchDate)}` : ""}.
          </p>

          {/* Kotak Peringatan & Checkbox Pengecualian Anomali */}
          {batchFlaggedEntries.length > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-panel text-[12px] space-y-2.5">
              <div className="flex items-start gap-2 text-amber-900 font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  {includeFlaggedInBatch
                    ? `${batchFlaggedEntries.length} input bertanda AKAN IKUT DISETUJUI.`
                    : `${batchFlaggedEntries.length} input bertanda TIDAK IKUT DISETUJUI.`}
                </span>
              </div>
              <p className="text-amber-800/90 text-[11px] leading-relaxed">
                Input bertanda peringatan (angka tinggi, kemungkinan ganda, dll) sengaja dikecualikan secara default agar dapat Anda periksa manual satu per satu.
              </p>
              <label className="flex items-center gap-2 pt-2 border-t border-amber-200/60 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeFlaggedInBatch}
                  onChange={(e) => setIncludeFlaggedInBatch(e.target.checked)}
                  className="w-4 h-4 rounded text-forest-900 border-line focus:ring-forest-900"
                />
                <span className="text-[12px] font-semibold text-ink">
                  Sertakan input bertanda ({batchFlaggedEntries.length} entri)
                </span>
              </label>
            </div>
          )}

          <div className="p-3 bg-surface-muted rounded-panel text-[12px] text-muted">
            Setiap entri akan disetujui sesuai jumlah asli yang diinput penjahit.
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-line/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsApproveAllOpen(false);
                setIncludeFlaggedInBatch(false);
              }}
              disabled={isApprovingAll}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleApproveAllSubmit}
              disabled={isApprovingAll || countToApprove === 0}
            >
              {isApprovingAll
                ? "Menyetujui..."
                : countToApprove === 0
                ? "Tidak ada entri dipilih"
                : `Ya, Setujui ${countToApprove} Entri`}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* 4. Modal Peringatan: Entri di Minggu yang Sudah Memiliki Pembayaran Aktif */}
      <Dialog
        isOpen={!!pendingActionWithWarning}
        onClose={() => setPendingActionWithWarning(null)}
        title="Peringatan: Upah Minggu Ini Sudah Dibayar"
        subtitle="Verifikasi entri dapat menimbulkan selisih pembayaran"
      >
        {pendingActionWithWarning && (
          <div className="space-y-4">
            <div className="p-3.5 bg-warning/10 border border-warning/30 rounded-panel text-[13px] text-[#B77407] flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#B77407]" />
              <div className="leading-relaxed">
                <p className="font-semibold text-ink text-[14px]">
                  Minggu ini untuk {pendingActionWithWarning.entry.nama_penjahit} sudah ditandai dibayar, perubahan akan menimbulkan selisih.
                </p>
                <p className="text-[12px] text-muted mt-1.5">
                  Tindakan ini akan mempengaruhi total upah disetujui sehingga status pembayaran mingguan
                  penjahit ini akan otomatis berubah menjadi <strong>Kurang bayar</strong> atau{" "}
                  <strong>Lebih bayar</strong>.
                </p>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-line/60">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPendingActionWithWarning(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleProceedWarning}
              >
                Lanjutkan
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
