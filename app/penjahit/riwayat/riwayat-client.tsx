"use client";

import * as React from "react";
import {
  Clock,
  Edit2,
  Trash2,
  AlertCircle,
  Calendar,
  Layers,
  MessageSquare,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, EntryStatus } from "@/components/ui/status-badge";
import { Dialog } from "@/components/ui/dialog";
import { SegmentedPill, SegmentedOption } from "@/components/ui/segmented-pill";
import { formatNumber, formatRupiah, formatDateId, getJakartaTodayString } from "@/lib/format";
import { updateEntryAction, deleteEntryAction } from "@/app/penjahit/actions";

export interface PenjahitHistoryEntry {
  id: string;
  project_id: string;
  nama_proyek: string;
  tanggal_kerja: string;
  qty: number;
  qty_disetujui: number | null;
  tarif_snapshot: number;
  status: EntryStatus;
  catatan_owner: string | null;
  disetujui_pada: string | null;
}

interface RiwayatClientProps {
  initialEntries: PenjahitHistoryEntry[];
}

export function RiwayatClient({ initialEntries }: RiwayatClientProps) {
  const [entries, setEntries] = React.useState<PenjahitHistoryEntry[]>(initialEntries);
  const [filterStatus, setFilterStatus] = React.useState<string>("semua");

  // Modal Edit
  const [editingEntry, setEditingEntry] = React.useState<PenjahitHistoryEntry | null>(null);
  const [editQty, setEditQty] = React.useState<number>(100);
  const [editTanggal, setEditTanggal] = React.useState<string>(getJakartaTodayString());
  const [editError, setEditError] = React.useState<string | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);

  // Modal Konfirmasi Hapus
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const filterOptions: SegmentedOption[] = [
    { value: "semua", label: "Semua", badge: entries.length },
    { value: "menunggu", label: "Menunggu", badge: entries.filter((e) => e.status === "menunggu").length },
    { value: "disetujui", label: "Disetujui", badge: entries.filter((e) => e.status === "disetujui").length },
    { value: "ditolak", label: "Ditolak", badge: entries.filter((e) => e.status === "ditolak").length },
  ];

  const filteredEntries = entries.filter((item) => {
    if (filterStatus === "semua") return true;
    return item.status === filterStatus;
  });

  // Buka Modal Edit
  const handleOpenEdit = (entry: PenjahitHistoryEntry) => {
    setEditingEntry(entry);
    setEditQty(entry.qty);
    setEditTanggal(entry.tanggal_kerja);
    setEditError(null);
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    setEditError(null);
    setIsEditing(true);

    const result = await updateEntryAction({
      id: editingEntry.id,
      qty: Number(editQty),
      tanggal_kerja: editTanggal,
    });

    if (!result.success) {
      setEditError(result.error || "Gagal mengubah entri.");
      setIsEditing(false);
      return;
    }

    setEntries((prev) =>
      prev.map((e) =>
        e.id === editingEntry.id ? { ...e, qty: Number(editQty), tanggal_kerja: editTanggal } : e
      )
    );

    setIsEditing(false);
    setEditingEntry(null);
  };

  // Submit Hapus
  const handleDeleteSubmit = async () => {
    if (!deletingId) return;

    setIsDeleting(true);
    const result = await deleteEntryAction(deletingId);

    if (result.success) {
      setEntries((prev) => prev.filter((e) => e.id !== deletingId));
      setDeletingId(null);
    }
    setIsDeleting(false);
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line/60">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-semibold text-ink leading-tight">
            Riwayat Hasil Kerja
          </h1>
          <p className="text-[12px] sm:text-[13px] text-muted mt-0.5">
            Daftar input produksi harian, status verifikasi owner, dan catatan koreksi.
          </p>
        </div>
      </div>

      {/* Filter Status */}
      <div className="overflow-x-auto pb-1">
        <SegmentedPill
          options={filterOptions}
          value={filterStatus}
          onChange={setFilterStatus}
          activeVariant="dark"
        />
      </div>

      {/* Daftar Item Riwayat */}
      {filteredEntries.length === 0 ? (
        <Card className="text-center py-12 px-6">
          <div className="w-12 h-12 rounded-[16px] bg-surface-muted text-muted mx-auto flex items-center justify-center mb-3">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-[16px] font-semibold text-ink">
            Tidak ada riwayat
          </h3>
          <p className="text-[13px] text-muted max-w-sm mx-auto mt-1">
            {filterStatus === "semua"
              ? "Anda belum pernah mengirim input produksi. Buka tab Input untuk mulai mencatat."
              : `Tidak ada entri dengan status "${filterStatus}".`}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((item) => {
            const isPending = item.status === "menunggu";
            const isApproved = item.status === "disetujui";
            const isRejected = item.status === "ditolak";
            const isCorrected = isApproved && item.qty_disetujui !== null && item.qty_disetujui !== item.qty;

            return (
              <Card key={item.id} className="p-4 sm:p-5 shadow-card transition-all">
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-muted" />
                      <span className="text-[13px] font-semibold text-ink">
                        {formatDateId(item.tanggal_kerja)}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted mt-0.5 flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {item.nama_proyek}
                    </p>
                  </div>

                  <StatusBadge status={item.status} />
                </div>

                {/* Baris Jumlah Pcs & Upah */}
                <div className="p-3 bg-surface-muted rounded-panel flex items-center justify-between my-2">
                  <div>
                    <span className="text-[11px] font-medium text-muted block">Jumlah Produksi:</span>
                    {isApproved ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[18px] font-semibold text-positive tabular-nums">
                          {formatNumber(item.qty_disetujui || 0)} pcs
                        </span>
                        {isCorrected && (
                          <span className="text-[12px] text-muted line-through tabular-nums">
                            ({formatNumber(item.qty)} pcs)
                          </span>
                        )}
                      </div>
                    ) : isRejected ? (
                      <span className="text-[16px] font-semibold text-negative line-through tabular-nums">
                        {formatNumber(item.qty)} pcs
                      </span>
                    ) : (
                      <span className="text-[18px] font-semibold text-ink tabular-nums">
                        {formatNumber(item.qty)} pcs
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] font-medium text-muted block">
                      {isApproved ? "Upah Disetujui:" : "Estimasi Upah:"}
                    </span>
                    <strong
                      className={`text-[15px] font-semibold tabular-nums ${
                        isApproved ? "text-forest-900" : isRejected ? "text-muted line-through" : "text-muted"
                      }`}
                    >
                      {formatRupiah(
                        (isApproved ? item.qty_disetujui || 0 : item.qty) * item.tarif_snapshot
                      )}
                    </strong>
                  </div>
                </div>

                {/* Catatan Owner bila Ada Koreksi atau Penolakan */}
                {item.catatan_owner && (
                  <div className="p-2.5 bg-surface border border-line rounded-panel text-[12px] text-muted flex items-start gap-2 mb-2">
                    <MessageSquare className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
                    <div>
                      <strong className="text-ink">Catatan Owner:</strong>{" "}
                      <span>{item.catatan_owner}</span>
                    </div>
                  </div>
                )}

                {/* Aksi Khusus Entri 'Menunggu' (Aturan Bisnis #7) */}
                {isPending && (
                  <div className="pt-2.5 border-t border-line/60 flex items-center justify-between text-[11px] text-muted">
                    <span>Menunggu verifikasi owner</span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenEdit(item)}
                        className="h-7 px-2.5 text-[11px]"
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        Ubah
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeletingId(item.id)}
                        className="h-7 px-2.5 text-[11px]"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Hapus
                      </Button>
                    </div>
                  </div>
                )}

                {!isPending && (
                  <div className="pt-2 border-t border-line/60 text-[11px] text-muted">
                    {isApproved
                      ? `Disetujui pada ${item.disetujui_pada ? formatDateId(item.disetujui_pada) : "kemarin"}`
                      : "Entri ditolak. Silakan kirim entri baru yang sesuai di tab Input."}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Ubah Entri Menunggu */}
      <Dialog
        isOpen={!!editingEntry}
        onClose={() => setEditingEntry(null)}
        title="Ubah Entri Produksi"
        subtitle="Hanya entri berstatus menunggu yang dapat diubah."
      >
        {editError && (
          <div className="mb-4 p-3 rounded-panel bg-negative/10 border border-negative/20 text-negative text-[13px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 stroke-[2]" />
            <span>{editError}</span>
          </div>
        )}

        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
              Tanggal Kerja
            </label>
            <input
              type="date"
              max={getJakartaTodayString()}
              required
              value={editTanggal}
              onChange={(e) => setEditTanggal(e.target.value)}
              className="w-full h-11 px-3.5 rounded-control bg-surface-muted border border-line text-ink text-[14px] focus:outline-none focus:border-forest-900"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
              Jumlah Produksi (Pcs)
            </label>
            <input
              type="number"
              min={1}
              max={2000}
              required
              value={editQty}
              onChange={(e) => setEditQty(Number(e.target.value))}
              className="w-full h-11 px-3.5 rounded-control bg-surface-muted border border-line text-ink text-[16px] font-semibold tabular-nums focus:outline-none focus:border-forest-900"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-line/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditingEntry(null)}
              disabled={isEditing}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" disabled={isEditing}>
              {isEditing ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal Konfirmasi Hapus */}
      <Dialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Hapus Entri Menunggu?"
        subtitle="Entri yang dihapus tidak dapat dikembalikan."
      >
        <p className="text-[13px] text-muted mb-4">
          Apakah Anda yakin ingin menghapus entri hasil kerja ini? Tindakan ini hanya dapat dilakukan sebelum owner menyetujui data Anda.
        </p>

        <div className="flex items-center justify-end gap-2 border-t border-line/60 pt-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDeletingId(null)}
            disabled={isDeleting}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleDeleteSubmit}
            disabled={isDeleting}
          >
            {isDeleting ? "Menghapus..." : "Ya, Hapus Entri"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
