"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Package,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  MapPin,
  Edit3,
  Archive,
  ArchiveRestore,
  Plus,
  ShoppingCart,
  Maximize2,
  X,
  UploadCloud,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatNumber, formatRupiah, formatDateId } from "@/lib/format";
import { getProjectColor } from "@/lib/project-colors";
import { compressClientImage } from "@/lib/image-compress";
import {
  recordStockMovementAction,
  updateStockItemAction,
  toggleArchiveStockItemAction,
} from "../actions";
import type {
  StockItemView,
  DbStockMovement,
  StockItemPhoto,
  StockMovementType,
} from "@/lib/types/database";
import type { ProjectSelectItem } from "@/components/project-select";

interface StockDetailClientProps {
  item: StockItemView;
  photos: StockItemPhoto[];
  photoSignedUrls: Record<string, string>;
  initialMovements: DbStockMovement[];
  projects: ProjectSelectItem[];
  categories: string[];
}

interface NewPhotoDraft {
  id: string;
  originalFile: File;
  previewUrl: string;
  fullBlob?: Blob;
  thumbBlob?: Blob;
  status: "ready" | "compressing" | "error";
  errorMessage?: string;
}

export function StockDetailClient({
  item,
  photos,
  photoSignedUrls,
  initialMovements,
  projects,
  categories,
}: StockDetailClientProps) {
  const router = useRouter();

  // Photo viewer state
  const [selectedPhotoIndex, setSelectedPhotoIndex] = React.useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = React.useState(false);

  // Active photo signed URLs
  const activePhoto = photos[selectedPhotoIndex] || null;
  const activeFullUrl = activePhoto?.full_path ? photoSignedUrls[activePhoto.full_path] : null;

  // State Dialog Catat Pergerakan
  const [isMoveModalOpen, setIsMoveModalOpen] = React.useState(false);
  const [moveJenis, setMoveJenis] = React.useState<StockMovementType>("masuk");
  const [moveQty, setMoveQty] = React.useState<number>(1);
  const [moveKoreksiTarget, setMoveKoreksiTarget] = React.useState<number>(item.stok_saat_ini);
  const [moveHargaSatuan, setMoveHargaSatuan] = React.useState<string>(
    item.harga_jual ? item.harga_jual.toString() : ""
  );
  const [movePembeli, setMovePembeli] = React.useState<string>("");
  const [moveCatatan, setMoveCatatan] = React.useState<string>("");
  const [isSubmittingMove, setIsSubmittingMove] = React.useState(false);
  const [moveError, setMoveError] = React.useState<string | null>(null);

  // Hitung perkiraan stok sesudah mutasi
  const projectedStockAfter = React.useMemo(() => {
    if (moveJenis === "masuk") {
      return item.stok_saat_ini + (moveQty || 0);
    }
    if (moveJenis === "keluar_penjualan" || moveJenis === "keluar_rusak") {
      return item.stok_saat_ini - (moveQty || 0);
    }
    if (moveJenis === "koreksi") {
      return moveKoreksiTarget;
    }
    return item.stok_saat_ini;
  }, [item.stok_saat_ini, moveJenis, moveQty, moveKoreksiTarget]);

  // Submit Catat Pergerakan
  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setMoveError(null);

    if (moveJenis === "koreksi") {
      if (moveKoreksiTarget < 0) {
        setMoveError("Stok fisik akhir tidak boleh kurang dari 0 pcs.");
        return;
      }
      if (!moveCatatan.trim()) {
        setMoveError("Alasan koreksi hitungan fisik wajib diisi.");
        return;
      }
    } else {
      if (!moveQty || moveQty <= 0) {
        setMoveError("Jumlah pcs pergerakan harus lebih dari 0.");
        return;
      }
      if (
        (moveJenis === "keluar_penjualan" || moveJenis === "keluar_rusak") &&
        moveQty > item.stok_saat_ini
      ) {
        setMoveError(
          `Stok tidak mencukupi. Pengeluaran ${moveQty} pcs melebihi stok saat ini (${item.stok_saat_ini} pcs).`
        );
        return;
      }
      if (moveJenis === "keluar_rusak" && !moveCatatan.trim()) {
        setMoveError("Penyebab barang rusak atau hilang wajib diisi.");
        return;
      }
    }

    setIsSubmittingMove(true);

    try {
      const res = await recordStockMovementAction({
        itemId: item.id,
        jenis: moveJenis,
        qty: moveJenis === "koreksi" ? moveKoreksiTarget : moveQty,
        hargaSatuan:
          moveJenis === "keluar_penjualan" && moveHargaSatuan && parseFloat(moveHargaSatuan) > 0
            ? parseFloat(moveHargaSatuan)
            : undefined,
        pembeli: moveJenis === "keluar_penjualan" && movePembeli.trim() ? movePembeli.trim() : undefined,
        catatan: moveCatatan.trim() || undefined,
      });

      if (!res.success) {
        setMoveError(res.error || "Gagal mencatat mutasi stok.");
      } else {
        setIsMoveModalOpen(false);
        setMoveCatatan("");
        setMovePembeli("");
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan internal";
      setMoveError(msg);
    } finally {
      setIsSubmittingMove(false);
    }
  };

  // State Dialog Ubah Info Barang
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editNama, setEditNama] = React.useState(item.nama);
  const [editKategori, setEditKategori] = React.useState(item.kategori);
  const [editProjectId, setEditProjectId] = React.useState<string>(item.project_id || "none");
  const [editAmbangMenipis, setEditAmbangMenipis] = React.useState<string>(
    item.ambang_menipis.toString()
  );
  const [editHargaJual, setEditHargaJual] = React.useState<string>(
    item.harga_jual ? item.harga_jual.toString() : ""
  );
  const [editLokasi, setEditLokasi] = React.useState<string>(item.lokasi_gudang || "");
  const [editCatatan, setEditCatatan] = React.useState<string>(item.catatan || "");
  const [existingPhotos, setExistingPhotos] = React.useState<StockItemPhoto[]>(photos);
  const [newPhotoDrafts, setNewPhotoDrafts] = React.useState<NewPhotoDraft[]>([]);
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  // Handle new photos for Edit Modal
  const handleEditPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 5 - (existingPhotos.length + newPhotoDrafts.length);
    if (remainingSlots <= 0) {
      alert("Maksimal total 5 foto.");
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots);

    for (const file of selectedFiles) {
      const draftId = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);

      const draft: NewPhotoDraft = {
        id: draftId,
        originalFile: file,
        previewUrl,
        status: "compressing",
      };

      setNewPhotoDrafts((prev) => [...prev, draft]);

      try {
        const compressed = await compressClientImage(file);
        setNewPhotoDrafts((prev) =>
          prev.map((d) =>
            d.id === draftId
              ? {
                  ...d,
                  fullBlob: compressed.fullBlob,
                  thumbBlob: compressed.thumbBlob,
                  status: "ready",
                }
              : d
          )
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Gagal kompresi";
        setNewPhotoDrafts((prev) =>
          prev.map((d) =>
            d.id === draftId ? { ...d, status: "error", errorMessage: msg } : d
          )
        );
      }
    }

    e.target.value = "";
  };

  const removeExistingPhoto = (idx: number) => {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeNewDraft = (id: string) => {
    setNewPhotoDrafts((prev) => {
      const target = prev.find((d) => d.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((d) => d.id !== id);
    });
  };

  // Submit Edit Barang
  const handleUpdateStockItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    if (!editNama.trim()) {
      setEditError("Nama barang wajib diisi.");
      return;
    }

    const isCompressing = newPhotoDrafts.some((d) => d.status === "compressing");
    if (isCompressing) {
      setEditError("Foto baru masih sedang dikompresi, mohon tunggu sebentar.");
      return;
    }

    setIsSubmittingEdit(true);

    try {
      const formData = new FormData();
      formData.set("id", item.id);
      formData.set("nama", editNama.trim());
      formData.set("kategori", editKategori.trim());
      formData.set("project_id", editProjectId === "none" ? "" : editProjectId);
      formData.set("ambang_menipis", editAmbangMenipis || "5");
      formData.set("harga_jual", editHargaJual || "");
      formData.set("lokasi_gudang", editLokasi.trim());
      formData.set("catatan", editCatatan.trim());
      formData.set("existing_photos", JSON.stringify(existingPhotos));

      const readyNewDrafts = newPhotoDrafts.filter(
        (d) => d.status === "ready" && d.fullBlob && d.thumbBlob
      );
      formData.set("new_photo_count", readyNewDrafts.length.toString());

      readyNewDrafts.forEach((draft, idx) => {
        if (draft.fullBlob && draft.thumbBlob) {
          formData.set(`new_photo_${idx}_full`, draft.fullBlob, `${draft.id}_full.webp`);
          formData.set(`new_photo_${idx}_thumb`, draft.thumbBlob, `${draft.id}_thumb.webp`);
          formData.set(`new_photo_${idx}_name`, draft.originalFile.name);
        }
      });

      const res = await updateStockItemAction(formData);

      if (!res.success) {
        setEditError(res.error || "Gagal memperbarui barang.");
      } else {
        setIsEditModalOpen(false);
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan internal";
      setEditError(msg);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // State Arsip / Buka Arsip
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = React.useState(false);
  const [isSubmittingArchive, setIsSubmittingArchive] = React.useState(false);

  const handleToggleArchive = async () => {
    setIsSubmittingArchive(true);
    try {
      const isArchived = item.status === "aktif"; // Jika saat ini aktif, maka kita arsipkan
      const res = await toggleArchiveStockItemAction(item.id, isArchived);
      if (res.success) {
        setIsArchiveConfirmOpen(false);
        router.refresh();
      } else {
        alert(res.error || "Gagal mengubah status arsip.");
      }
    } catch (err) {
      console.error("Gagal toggle archive:", err);
    } finally {
      setIsSubmittingArchive(false);
    }
  };

  // Filter jenis riwayat mutasi
  const [historyFilter, setHistoryFilter] = React.useState<string>("semua");

  const filteredMovements = React.useMemo(() => {
    if (historyFilter === "semua") return initialMovements;
    return initialMovements.filter((m) => m.jenis === historyFilter);
  }, [initialMovements, historyFilter]);

  const pColor = item.warna_proyek ? getProjectColor(item.warna_proyek) : null;
  const isHabis = item.status_stok === "habis";
  const isMenipis = item.status_stok === "menipis";
  const isArchived = item.status === "diarsipkan";

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* 1. HEADER & TOMBOL KEMBALI                                           */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/owner/stok"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-forest-900 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Kembali ke Daftar Stok</span>
          </Link>

          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[22px] sm:text-[26px] font-bold text-ink tracking-tight">
              {item.nama}
            </h1>
            <span className="font-mono text-[13px] font-bold px-2.5 py-0.5 rounded-pill bg-surface border border-line text-muted">
              {item.kode}
            </span>
          </div>
        </div>

        {/* Tombol Aksi Kanan */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditNama(item.nama);
              setEditKategori(item.kategori);
              setEditProjectId(item.project_id || "none");
              setEditAmbangMenipis(item.ambang_menipis.toString());
              setEditHargaJual(item.harga_jual ? item.harga_jual.toString() : "");
              setEditLokasi(item.lokasi_gudang || "");
              setEditCatatan(item.catatan || "");
              setExistingPhotos(photos);
              newPhotoDrafts.forEach((d) => URL.revokeObjectURL(d.previewUrl));
              setNewPhotoDrafts([]);
              setEditError(null);
              setIsEditModalOpen(true);
            }}
            className="h-10 px-3.5 text-[12.5px] flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Ubah Info</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsArchiveConfirmOpen(true)}
            className="h-10 px-3.5 text-[12.5px] flex items-center gap-1.5"
          >
            {isArchived ? (
              <>
                <ArchiveRestore className="w-3.5 h-3.5 text-positive" />
                <span>Buka Arsip</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5 text-muted" />
                <span>Arsipkan</span>
              </>
            )}
          </Button>

          {!isArchived && (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setMoveJenis("masuk");
                setMoveQty(1);
                setMoveKoreksiTarget(item.stok_saat_ini);
                setMoveHargaSatuan(item.harga_jual ? item.harga_jual.toString() : "");
                setMovePembeli("");
                setMoveCatatan("");
                setMoveError(null);
                setIsMoveModalOpen(true);
              }}
              className="h-10 px-4 text-[13px] bg-forest-900 text-white flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Catat Pergerakan</span>
            </Button>
          )}
        </div>
      </div>

      {/* Banner Barang Diarsipkan */}
      {isArchived && (
        <div className="p-4 rounded-[16px] bg-ink/5 border border-line flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Archive className="w-5 h-5 text-muted shrink-0" />
            <div>
              <p className="text-[13px] font-bold text-ink">Barang ini sedang diarsipkan</p>
              <p className="text-[12px] text-muted">
                Barang tidak muncul di daftar pencarian utama, namun mutasi dan riwayat tetap tersimpan.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsArchiveConfirmOpen(true)}
            className="h-9 px-3 text-[12px]"
          >
            Aktifkan Kembali
          </Button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. GRID UTAMA: GALERI FOTO & KARTU METRIK                            */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri: Galeri Foto (5 Kolom di Desktop) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Foto Utama Aktif */}
          <div className="relative aspect-[4/3] rounded-[20px] bg-surface border border-line overflow-hidden shadow-card group">
            {activeFullUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeFullUrl}
                alt={item.nama}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted/60 p-4">
                <Package className="w-12 h-12 stroke-[1.2]" />
                <span className="text-[12px] font-semibold mt-2">Belum ada foto barang</span>
              </div>
            )}

            {/* Tombol Zoom Lightbox */}
            {activeFullUrl && (
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-ink/70 text-white flex items-center justify-center opacity-80 hover:opacity-100 transition shadow"
                aria-label="Lihat ukuran penuh"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}

            {/* Status Ketersediaan Pojok Kiri Atas */}
            <div className="absolute top-3 left-3">
              {isHabis ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-negative text-white text-[11px] font-bold shadow-sm">
                  <XCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Stok Habis</span>
                </span>
              ) : isMenipis ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning text-white text-[11px] font-bold shadow-sm">
                  <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Stok Menipis</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-forest-900 text-lime-400 text-[11px] font-bold shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Stok Tersedia</span>
                </span>
              )}
            </div>
          </div>

          {/* Strip Thumbnail Foto */}
          {photos.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {photos.map((photo, idx) => {
                const thumbUrl = photo.thumb_path ? photoSignedUrls[photo.thumb_path] : null;
                const isSelected = idx === selectedPhotoIndex;

                return (
                  <button
                    key={photo.thumb_path || idx}
                    type="button"
                    onClick={() => setSelectedPhotoIndex(idx)}
                    className={`relative w-16 h-16 rounded-[12px] overflow-hidden border-2 transition shrink-0 ${
                      isSelected
                        ? "border-forest-900 ring-2 ring-forest-900/20"
                        : "border-line opacity-70 hover:opacity-100"
                    }`}
                  >
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbUrl}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface-muted flex items-center justify-center text-muted">
                        <Package className="w-4 h-4" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Kolom Kanan: Status Stok & Rincian Informasi (7 Kolom di Desktop) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Kartu Status Stok Utama */}
          <div className="p-5 sm:p-6 rounded-[22px] bg-surface border border-line shadow-card space-y-4">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div>
                <span className="text-[11.5px] font-bold text-muted uppercase tracking-wider block">
                  Jumlah Stok Saat Ini
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className={`text-[36px] sm:text-[42px] font-black tracking-tight tabular-nums ${
                      isHabis
                        ? "text-negative"
                        : isMenipis
                        ? "text-warning"
                        : "text-forest-900"
                    }`}
                  >
                    {formatNumber(item.stok_saat_ini)}
                  </span>
                  <span className="text-[14px] font-bold text-muted">pcs</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11.5px] font-bold text-muted uppercase tracking-wider block">
                  Ambang Menipis
                </span>
                <span className="text-[15px] font-bold text-ink mt-1 block tabular-nums">
                  &le; {formatNumber(item.ambang_menipis)} pcs
                </span>
              </div>
            </div>

            {/* Estimasi Nilai & Tombol Catat Mutasi Cepat */}
            <div className="pt-3 border-t border-line/60 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <span className="text-[11px] text-muted block">Estimasi Nilai Total</span>
                <span className="text-[16px] font-bold text-ink">
                  {item.harga_jual && item.harga_jual > 0
                    ? formatRupiah(item.stok_saat_ini * item.harga_jual)
                    : "Belum ditentukan"}
                </span>
              </div>

              {!isArchived && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setMoveJenis("keluar_penjualan");
                    setMoveQty(1);
                    setMoveHargaSatuan(item.harga_jual ? item.harga_jual.toString() : "");
                    setMovePembeli("");
                    setMoveCatatan("");
                    setMoveError(null);
                    setIsMoveModalOpen(true);
                  }}
                  disabled={isHabis}
                  className="h-9 px-3.5 text-[12px] bg-forest-900 text-white flex items-center gap-1.5"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Catat Penjualan</span>
                </Button>
              )}
            </div>
          </div>

          {/* Kartu Rincian Spesifikasi & Gudang */}
          <div className="p-5 rounded-[22px] bg-surface border border-line shadow-card space-y-3.5">
            <h3 className="text-[14px] font-bold text-ink pb-2 border-b border-line/60">
              Rincian Informasi Barang
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
              <div>
                <span className="text-[11px] font-semibold text-muted block">Kategori</span>
                <span className="font-semibold text-ink">{item.kategori}</span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-muted block">Proyek Asal</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {pColor ? (
                    <span className={`w-2 h-2 rounded-full ${pColor.dotClass} shrink-0`} />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                  )}
                  <span className="font-semibold text-ink">
                    {item.nama_proyek || "Tanpa proyek"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-muted block">Harga Jual Satuan</span>
                <span className="font-semibold text-ink">
                  {item.harga_jual && item.harga_jual > 0
                    ? `${formatRupiah(item.harga_jual)} / pcs`
                    : "Belum diisi"}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-muted block">Lokasi Rak / Gudang</span>
                <span className="font-semibold text-ink flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-muted" />
                  <span>{item.lokasi_gudang || "Belum ditentukan"}</span>
                </span>
              </div>

              <div className="sm:col-span-2">
                <span className="text-[11px] font-semibold text-muted block">Catatan Barang</span>
                <p className="text-ink leading-relaxed mt-0.5 whitespace-pre-wrap">
                  {item.catatan || "-"}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-muted block">Didaftarkan Pada</span>
                <span className="text-muted text-[12px]">{formatDateId(item.created_at)}</span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-muted block">Terakhir Diperbarui</span>
                <span className="text-muted text-[12px]">{formatDateId(item.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. RIWAYAT MUTASI / PERGERAKAN STOK GUDANG                            */}
      {/* ==================================================================== */}
      <div className="p-4 sm:p-5 rounded-[22px] bg-surface border border-line shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-bold text-ink">Riwayat Pergerakan Stok</h3>
            <p className="text-[12.5px] text-muted">
              Daftar seluruh transaksi masuk, keluar, dan koreksi stok fisik.
            </p>
          </div>

          {/* Filter Tab Mutasi */}
          <div className="flex items-center gap-1 p-1 bg-surface-muted rounded-pill border border-line/60 self-start sm:self-auto overflow-x-auto max-w-full">
            {[
              { id: "semua", label: "Semua" },
              { id: "masuk", label: "Masuk" },
              { id: "keluar_penjualan", label: "Terjual" },
              { id: "keluar_rusak", label: "Rusak/Hilang" },
              { id: "koreksi", label: "Koreksi" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHistoryFilter(tab.id)}
                className={`px-3 py-1 rounded-pill text-[12px] font-semibold transition shrink-0 ${
                  historyFilter === tab.id
                    ? "bg-forest-900 text-white shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabel Desktop / Kartu Mobile */}
        {filteredMovements.length === 0 ? (
          <div className="py-10 text-center text-muted">
            <Clock className="w-8 h-8 stroke-[1.2] mx-auto text-muted/50 mb-1.5" />
            <p className="text-[13px] font-semibold text-ink">Belum ada riwayat pergerakan</p>
            <p className="text-[11.5px] text-muted mt-0.5">
              Setiap penambahan atau pengeluaran stok akan tercatat di sini secara permanen.
            </p>
          </div>
        ) : (
          <>
            {/* Tampilan Desktop: Tabel Bersih */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-surface-muted/60 text-muted uppercase text-[10.5px] tracking-wider font-bold">
                  <tr>
                    <th className="py-2.5 px-3 rounded-l-[10px]">Waktu</th>
                    <th className="py-2.5 px-3">Jenis</th>
                    <th className="py-2.5 px-3 text-right">Perubahan</th>
                    <th className="py-2.5 px-3 text-center">Stok (Sebelum &rarr; Sesudah)</th>
                    <th className="py-2.5 px-3">Keterangan / Pembeli</th>
                    <th className="py-2.5 px-3 rounded-r-[10px]">Pencatat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40">
                  {filteredMovements.map((m) => {
                    const isMasuk = m.jenis === "masuk";
                    const isPenjualan = m.jenis === "keluar_penjualan";
                    const isRusak = m.jenis === "keluar_rusak";
                    const isKoreksi = m.jenis === "koreksi";

                    return (
                      <tr key={m.id} className="hover:bg-surface-muted/30 transition">
                        <td className="py-3 px-3 font-medium text-ink whitespace-nowrap">
                          {formatDateId(m.created_at)}
                          <span className="text-[11px] text-muted block">
                            {new Date(m.created_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          {isMasuk && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-lime-100 text-positive text-[11px] font-bold">
                              <Plus className="w-3 h-3" />
                              <span>Masuk</span>
                            </span>
                          )}
                          {isPenjualan && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-forest-900/10 text-forest-900 text-[11px] font-bold">
                              <ShoppingCart className="w-3 h-3" />
                              <span>Terjual</span>
                            </span>
                          )}
                          {isRusak && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-negative/12 text-negative text-[11px] font-bold">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Rusak / Hilang</span>
                            </span>
                          )}
                          {isKoreksi && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-muted border border-line text-ink text-[11px] font-bold">
                              <RefreshCw className="w-3 h-3" />
                              <span>Koreksi Fisik</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right tabular-nums font-bold">
                          <span
                            className={
                              m.jumlah > 0
                                ? "text-positive"
                                : m.jumlah < 0
                                ? "text-negative"
                                : "text-muted"
                            }
                          >
                            {m.jumlah > 0 ? `+${m.jumlah}` : m.jumlah} pcs
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center tabular-nums font-medium text-muted">
                          <span>{m.stok_sebelum}</span>
                          <span className="mx-1.5 text-line">&rarr;</span>
                          <span className="font-bold text-ink">{m.stok_sesudah}</span>
                        </td>

                        <td className="py-3 px-3 max-w-xs">
                          {m.pembeli && (
                            <p className="font-semibold text-ink text-[12px]">
                              Pembeli: {m.pembeli}
                            </p>
                          )}
                          {m.total_harga && (
                            <p className="text-forest-900 text-[11.5px] font-bold">
                              {formatRupiah(m.total_harga)}
                            </p>
                          )}
                          <p className="text-muted text-[11.5px] truncate">{m.catatan || "-"}</p>
                        </td>

                        <td className="py-3 px-3 text-muted text-[11.5px] whitespace-nowrap">
                          {m.nama_pencatat}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Tampilan Mobile: Kartu Linimasa */}
            <div className="sm:hidden space-y-2.5">
              {filteredMovements.map((m) => {
                const isMasuk = m.jenis === "masuk";
                const isPenjualan = m.jenis === "keluar_penjualan";
                const isRusak = m.jenis === "keluar_rusak";
                const isKoreksi = m.jenis === "koreksi";

                return (
                  <div
                    key={m.id}
                    className="p-3 rounded-[14px] bg-surface-muted/50 border border-line space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {isMasuk && (
                          <span className="px-2 py-0.5 rounded-full bg-lime-100 text-positive text-[10.5px] font-bold">
                            Masuk
                          </span>
                        )}
                        {isPenjualan && (
                          <span className="px-2 py-0.5 rounded-full bg-forest-900/10 text-forest-900 text-[10.5px] font-bold">
                            Terjual
                          </span>
                        )}
                        {isRusak && (
                          <span className="px-2 py-0.5 rounded-full bg-negative/12 text-negative text-[10.5px] font-bold">
                            Rusak / Hilang
                          </span>
                        )}
                        {isKoreksi && (
                          <span className="px-2 py-0.5 rounded-full bg-surface border border-line text-ink text-[10.5px] font-bold">
                            Koreksi
                          </span>
                        )}
                        <span className="text-[11px] text-muted">
                          {formatDateId(m.created_at)}
                        </span>
                      </div>

                      <span
                        className={`text-[14px] font-bold tabular-nums ${
                          m.jumlah > 0
                            ? "text-positive"
                            : m.jumlah < 0
                            ? "text-negative"
                            : "text-muted"
                        }`}
                      >
                        {m.jumlah > 0 ? `+${m.jumlah}` : m.jumlah} pcs
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11.5px] text-muted pt-1 border-t border-line/40">
                      <span>
                        Stok: {m.stok_sebelum} &rarr;{" "}
                        <strong className="text-ink">{m.stok_sesudah}</strong> pcs
                      </span>
                      <span>Oleh: {m.nama_pencatat}</span>
                    </div>

                    {(m.pembeli || m.total_harga || m.catatan) && (
                      <div className="text-[11.5px] text-ink bg-surface p-2 rounded-[8px] border border-line/50 space-y-0.5">
                        {m.pembeli && <p className="font-semibold">Pembeli: {m.pembeli}</p>}
                        {m.total_harga && (
                          <p className="text-forest-900 font-bold">
                            {formatRupiah(m.total_harga)}
                          </p>
                        )}
                        {m.catatan && <p className="text-muted">{m.catatan}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 4. DIALOG CATAT PERGERAKAN STOK                                      */}
      {/* ==================================================================== */}
      <Dialog
        isOpen={isMoveModalOpen}
        onClose={() => !isSubmittingMove && setIsMoveModalOpen(false)}
        title="Catat Pergerakan Stok"
        subtitle={`${item.nama} (${item.kode})`}
      >
        <form onSubmit={handleRecordMovement} className="space-y-4 pt-1">
          {moveError && (
            <div className="p-3 rounded-[12px] bg-negative/10 border border-negative/20 text-negative text-[12.5px] font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{moveError}</span>
            </div>
          )}

          {/* Pilihan 4 Jenis Mutasi */}
          <div>
            <label className="block text-[11.5px] font-bold text-ink mb-1.5">
              Jenis Pergerakan *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMoveJenis("masuk")}
                className={`p-2.5 rounded-[12px] border text-left flex items-center gap-2 transition ${
                  moveJenis === "masuk"
                    ? "bg-lime-50 border-forest-900 text-forest-900 font-bold"
                    : "bg-surface border-line text-ink hover:bg-surface-muted"
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-lime-100 text-positive flex items-center justify-center shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[12.5px] block truncate">Tambah Stok</span>
                  <span className="text-[10px] text-muted block">Masuk gudang (+)</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMoveJenis("keluar_penjualan")}
                className={`p-2.5 rounded-[12px] border text-left flex items-center gap-2 transition ${
                  moveJenis === "keluar_penjualan"
                    ? "bg-lime-50 border-forest-900 text-forest-900 font-bold"
                    : "bg-surface border-line text-ink hover:bg-surface-muted"
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-forest-900/10 text-forest-900 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[12.5px] block truncate">Terjual</span>
                  <span className="text-[10px] text-muted block">Penjualan (-)</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMoveJenis("keluar_rusak")}
                className={`p-2.5 rounded-[12px] border text-left flex items-center gap-2 transition ${
                  moveJenis === "keluar_rusak"
                    ? "bg-rose-50 border-negative text-negative font-bold"
                    : "bg-surface border-line text-ink hover:bg-surface-muted"
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-negative/12 text-negative flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[12.5px] block truncate">Rusak / Hilang</span>
                  <span className="text-[10px] text-muted block">Pengurangan (-)</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMoveJenis("koreksi")}
                className={`p-2.5 rounded-[12px] border text-left flex items-center gap-2 transition ${
                  moveJenis === "koreksi"
                    ? "bg-surface-muted border-ink text-ink font-bold"
                    : "bg-surface border-line text-ink hover:bg-surface-muted"
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-line text-ink flex items-center justify-center shrink-0">
                  <RefreshCw className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[12.5px] block truncate">Koreksi Hitungan</span>
                  <span className="text-[10px] text-muted block">Penyesuaian fisik</span>
                </div>
              </button>
            </div>
          </div>

          {/* Pratinjau Dampak Stok */}
          <div className="p-3.5 rounded-[14px] bg-surface-muted border border-line flex items-center justify-between">
            <div>
              <span className="text-[11px] text-muted block">Stok Saat Ini</span>
              <span className="text-[16px] font-bold text-ink">
                {formatNumber(item.stok_saat_ini)} pcs
              </span>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-muted block">Setelah Dicatat</span>
              <span
                className={`text-[16px] font-bold ${
                  projectedStockAfter < 0 ? "text-negative" : "text-forest-900"
                }`}
              >
                {formatNumber(Math.max(0, projectedStockAfter))} pcs
              </span>
            </div>
          </div>

          {/* Kolom Jumlah / Target */}
          {moveJenis === "koreksi" ? (
            <div>
              <label className="block text-[11.5px] font-bold text-ink mb-1">
                Stok Fisik Sebenarnya (Target Akhir) *
              </label>
              <input
                type="number"
                inputMode="numeric"
                required
                min="0"
                value={moveKoreksiTarget}
                onChange={(e) =>
                  setMoveKoreksiTarget(Math.max(0, parseInt(e.target.value || "0", 10)))
                }
                className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[15px] font-bold text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
              />
              <span className="text-[11px] text-muted block mt-0.5">
                Selisih:{" "}
                <strong
                  className={
                    moveKoreksiTarget - item.stok_saat_ini > 0
                      ? "text-positive"
                      : moveKoreksiTarget - item.stok_saat_ini < 0
                      ? "text-negative"
                      : "text-muted"
                  }
                >
                  {moveKoreksiTarget - item.stok_saat_ini > 0
                    ? `+${moveKoreksiTarget - item.stok_saat_ini}`
                    : moveKoreksiTarget - item.stok_saat_ini}{" "}
                  pcs
                </strong>
              </span>
            </div>
          ) : (
            <div>
              <label className="block text-[11.5px] font-bold text-ink mb-1">
                Jumlah Pcs {moveJenis === "masuk" ? "Ditambahkan" : "Dikeluarkan"} *
              </label>
              <input
                type="number"
                inputMode="numeric"
                required
                min="1"
                max={
                  moveJenis === "keluar_penjualan" || moveJenis === "keluar_rusak"
                    ? item.stok_saat_ini
                    : undefined
                }
                value={moveQty}
                onChange={(e) => setMoveQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
                className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[15px] font-bold text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
              />
            </div>
          )}

          {/* Field Khusus Penjualan: Harga Satuan, Pembeli, Total */}
          {moveJenis === "keluar_penjualan" && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11.5px] font-bold text-ink mb-1">
                    Harga Satuan (Rp)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={moveHargaSatuan}
                    onChange={(e) => setMoveHargaSatuan(e.target.value)}
                    placeholder="Contoh: 35000"
                    className="w-full h-10 px-3 rounded-[12px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
                  />
                </div>

                <div>
                  <label className="block text-[11.5px] font-bold text-ink mb-1">
                    Nama Pembeli (Opsional)
                  </label>
                  <input
                    type="text"
                    value={movePembeli}
                    onChange={(e) => setMovePembeli(e.target.value)}
                    placeholder="Instansi / Toko"
                    className="w-full h-10 px-3 rounded-[12px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
                  />
                </div>
              </div>

              {moveHargaSatuan && parseFloat(moveHargaSatuan) > 0 && (
                <div className="p-2.5 rounded-[10px] bg-lime-50 border border-lime-200 text-forest-900 text-[13px] font-bold flex items-center justify-between">
                  <span>Total Penjualan:</span>
                  <span className="text-[14px]">
                    {formatRupiah(parseFloat(moveHargaSatuan) * moveQty)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Catatan Mutasi (Wajib untuk Rusak & Koreksi) */}
          <div>
            <label className="block text-[11.5px] font-bold text-ink mb-1">
              {moveJenis === "keluar_rusak"
                ? "Penyebab Barang Rusak / Hilang *"
                : moveJenis === "koreksi"
                ? "Alasan Koreksi Hitungan Fisik *"
                : "Catatan Mutasi (Opsional)"}
            </label>
            <textarea
              rows={2}
              required={moveJenis === "keluar_rusak" || moveJenis === "koreksi"}
              value={moveCatatan}
              onChange={(e) => setMoveCatatan(e.target.value)}
              placeholder={
                moveJenis === "keluar_rusak"
                  ? "Sebutkan penyebab kerusakan (kotor, robek, resleting rusak, dll)..."
                  : moveJenis === "koreksi"
                  ? "Sebutkan alasan penyesuaian (hasil opname fisik rak, selisih hitung awal, dll)..."
                  : "Keterangan mutasi..."
              }
              className="w-full p-2.5 rounded-[12px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900 resize-none"
            />
          </div>

          {/* Tombol Aksi */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsMoveModalOpen(false)}
              disabled={isSubmittingMove}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmittingMove || projectedStockAfter < 0}
              className="bg-forest-900 text-white min-w-[130px]"
            >
              {isSubmittingMove ? "Menyimpan..." : "Simpan Pergerakan"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ==================================================================== */}
      {/* 5. DIALOG UBAH INFO BARANG                                           */}
      {/* ==================================================================== */}
      <Dialog
        isOpen={isEditModalOpen}
        onClose={() => !isSubmittingEdit && setIsEditModalOpen(false)}
        title="Ubah Informasi Barang"
        subtitle={`Kode: ${item.kode}`}
        className="sm:max-w-xl"
      >
        <form onSubmit={handleUpdateStockItem} className="space-y-4 pt-1">
          {editError && (
            <div className="p-3 rounded-[12px] bg-negative/10 border border-negative/20 text-negative text-[12.5px] font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div>
            <label className="block text-[11.5px] font-bold text-ink mb-1">
              Nama Barang *
            </label>
            <input
              type="text"
              required
              value={editNama}
              onChange={(e) => setEditNama(e.target.value)}
              className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[13.5px] font-semibold text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] font-bold text-ink mb-1">
                Kategori *
              </label>
              <input
                type="text"
                required
                list="edit-kategori-list"
                value={editKategori}
                onChange={(e) => setEditKategori(e.target.value)}
                className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
              />
              <datalist id="edit-kategori-list">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11.5px] font-bold text-ink mb-1">
                Proyek Asal (Opsional)
              </label>
              <select
                value={editProjectId}
                onChange={(e) => setEditProjectId(e.target.value)}
                aria-label="Pilih proyek asal barang"
                className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
              >
                <option value="none">Tanpa kaitan proyek</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] font-bold text-ink mb-1">
                Ambang Batas Menipis (pcs)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={editAmbangMenipis}
                onChange={(e) => setEditAmbangMenipis(e.target.value)}
                className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[13.5px] font-bold text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
              />
            </div>

            <div>
              <label className="block text-[11.5px] font-bold text-ink mb-1">
                Harga Jual Satuan (Rp)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={editHargaJual}
                onChange={(e) => setEditHargaJual(e.target.value)}
                placeholder="35000"
                className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11.5px] font-bold text-ink mb-1">
              Lokasi Rak Gudang
            </label>
            <input
              type="text"
              value={editLokasi}
              onChange={(e) => setEditLokasi(e.target.value)}
              placeholder="Contoh: Rak B-02 Lantai 1"
              className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-bold text-ink mb-1">
              Catatan Spesifikasi
            </label>
            <textarea
              rows={2}
              value={editCatatan}
              onChange={(e) => setEditCatatan(e.target.value)}
              className="w-full p-2.5 rounded-[12px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900 resize-none"
            />
          </div>

          {/* Kelola Foto */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11.5px] font-bold text-ink">Foto Barang</label>
              <span className="text-[11px] text-muted">
                {existingPhotos.length + newPhotoDrafts.length} / 5 foto
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">
              {/* Foto Eksisting */}
              {existingPhotos.map((photo, idx) => {
                const thumbUrl = photo.thumb_path ? photoSignedUrls[photo.thumb_path] : null;
                return (
                  <div
                    key={photo.thumb_path || idx}
                    className="relative aspect-square rounded-[10px] bg-surface-muted overflow-hidden border border-line group"
                  >
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbUrl}
                        alt="Foto"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted">
                        <Package className="w-4 h-4" />
                      </div>
                    )}
                    {idx === 0 && (
                      <span className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-forest-900 text-white text-[9px] font-bold">
                        Sampul
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeExistingPhoto(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-negative text-white flex items-center justify-center opacity-90 hover:opacity-100"
                      aria-label="Hapus foto"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {/* Foto Baru Ditambahkan */}
              {newPhotoDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className="relative aspect-square rounded-[10px] bg-surface-muted overflow-hidden border border-line"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={draft.previewUrl}
                    alt="Pratinjau baru"
                    className="w-full h-full object-cover"
                  />
                  {draft.status === "compressing" && (
                    <div className="absolute inset-0 bg-ink/60 text-white flex items-center justify-center text-[10px] p-1 text-center font-medium">
                      Kompres...
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeNewDraft(draft.id)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-negative text-white flex items-center justify-center opacity-90 hover:opacity-100"
                    aria-label="Hapus draft foto"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {existingPhotos.length + newPhotoDrafts.length < 5 && (
                <label className="aspect-square rounded-[10px] border-2 border-dashed border-line hover:border-forest-900/60 bg-surface-muted/50 hover:bg-surface-muted flex flex-col items-center justify-center text-muted hover:text-ink cursor-pointer transition select-none">
                  <UploadCloud className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px] font-semibold text-center leading-tight">
                    + Foto
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleEditPhotoSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmittingEdit}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmittingEdit}
              className="bg-forest-900 text-white min-w-[120px]"
            >
              {isSubmittingEdit ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ==================================================================== */}
      {/* 6. DIALOG KONFIRMASI ARSIP                                           */}
      {/* ==================================================================== */}
      <Dialog
        isOpen={isArchiveConfirmOpen}
        onClose={() => !isSubmittingArchive && setIsArchiveConfirmOpen(false)}
        title={isArchived ? "Buka Arsip Barang?" : "Arsipkan Barang Ini?"}
        subtitle={`${item.nama} (${item.kode})`}
      >
        <div className="space-y-4 pt-1">
          <p className="text-[13px] text-muted leading-relaxed">
            {isArchived
              ? "Barang akan diaktifkan kembali dan muncul di daftar pencarian utama stok gudang."
              : "Barang yang diarsipkan akan disembunyikan dari daftar utama, namun riwayat mutasi dan catatan transaksi tidak akan dihapus."}
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsArchiveConfirmOpen(false)}
              disabled={isSubmittingArchive}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleToggleArchive}
              disabled={isSubmittingArchive}
              className={
                isArchived
                  ? "bg-forest-900 text-white"
                  : "bg-negative text-white hover:bg-negative/90"
              }
            >
              {isSubmittingArchive
                ? "Memproses..."
                : isArchived
                ? "Buka Arsip"
                : "Ya, Arsipkan"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ==================================================================== */}
      {/* 7. LIGHTBOX FOTO UKURAN PENUH                                        */}
      {/* ==================================================================== */}
      {isLightboxOpen && activeFullUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-ink/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
            aria-label="Tutup foto penuh"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="max-w-4xl max-h-[85vh] overflow-hidden rounded-[16px] shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeFullUrl}
              alt={item.nama}
              className="w-full h-full object-contain max-h-[85vh]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
