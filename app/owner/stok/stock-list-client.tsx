"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Package,
  Layers,
  AlertTriangle,
  XCircle,
  Coins,
  Search,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ProjectSelect, type ProjectSelectItem } from "@/components/project-select";
import { formatNumber, formatRupiah } from "@/lib/format";
import { getProjectColor } from "@/lib/project-colors";
import { compressClientImage } from "@/lib/image-compress";
import {
  createStockItemAction,
  recordStockMovementAction,
} from "./actions";
import type {
  StockItemView,
  StockSummary,
} from "@/lib/types/database";

interface StockListClientProps {
  initialItems: StockItemView[];
  totalItems: number;
  summary: StockSummary;
  projects: ProjectSelectItem[];
  categories: string[];
  currentPage: number;
  pageSize: number;
  schemaMissing?: boolean;
}

interface PhotoDraft {
  id: string;
  originalFile: File;
  previewUrl: string;
  fullBlob?: Blob;
  thumbBlob?: Blob;
  status: "ready" | "compressing" | "error";
  errorMessage?: string;
}

export function StockListClient({
  initialItems,
  totalItems,
  summary,
  projects,
  categories,
  currentPage,
  pageSize,
  schemaMissing,
}: StockListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL state
  const currentQuery = searchParams?.get("q") || "";
  const currentProject = searchParams?.get("project") || "all";
  const currentStatus = searchParams?.get("status") || "semua";
  const currentCategory = searchParams?.get("kategori") || "semua";
  const currentSort = searchParams?.get("sort") || "terbaru";
  const showArchived = searchParams?.get("showArchived") === "true";

  // Search input state with debounce
  const [searchInput, setSearchInput] = React.useState(currentQuery);

  // Helper untuk update URL params
  const updateFilter = React.useCallback(
    (newParams: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
      Object.entries(newParams).forEach(([key, val]) => {
        if (val === null || val === "" || val === "semua" || (key === "project" && val === "all")) {
          params.delete(key);
        } else {
          params.set(key, val);
        }
      });
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [searchParams, pathname, router]
  );

  // Sync state if URL changes externally
  React.useEffect(() => {
    setSearchInput(currentQuery);
  }, [currentQuery]);

  // Handle debounced search
  React.useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== currentQuery) {
        updateFilter({ q: searchInput || null, page: "1" });
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput, currentQuery, updateFilter]);

  // Reset all filters
  const resetAllFilters = () => {
    router.push(pathname);
    setSearchInput("");
  };

  // State Dialog Tambah Barang
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isSubmittingItem, setIsSubmittingItem] = React.useState(false);
  const [addItemError, setAddItemError] = React.useState<string | null>(null);

  // Form Tambah Barang
  const [formKode, setFormKode] = React.useState("");
  const [formNama, setFormNama] = React.useState("");
  const [formKategori, setFormKategori] = React.useState("Tas Kain");
  const [formProjectId, setFormProjectId] = React.useState<string>("none");
  const [formStokAwal, setFormStokAwal] = React.useState<string>("0");
  const [formAmbangMenipis, setFormAmbangMenipis] = React.useState<string>("5");
  const [formHargaJual, setFormHargaJual] = React.useState<string>("");
  const [formLokasi, setFormLokasi] = React.useState<string>("");
  const [formCatatan, setFormCatatan] = React.useState<string>("");
  const [photoDrafts, setPhotoDrafts] = React.useState<PhotoDraft[]>([]);
  const [uploadProgressText, setUploadProgressText] = React.useState<string>("");

  // Auto-generate random kode barang
  const generateRandomKode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let rand = "";
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormKode(`BRG-${rand}`);
  };

  // Handle Photo selection & client-side compression
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 5 - photoDrafts.length;
    if (remainingSlots <= 0) {
      alert("Maksimal 5 foto per barang.");
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots);

    for (const file of selectedFiles) {
      const draftId = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);

      const draft: PhotoDraft = {
        id: draftId,
        originalFile: file,
        previewUrl,
        status: "compressing",
      };

      setPhotoDrafts((prev) => [...prev, draft]);

      try {
        const compressed = await compressClientImage(file);
        setPhotoDrafts((prev) =>
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
        setPhotoDrafts((prev) =>
          prev.map((d) =>
            d.id === draftId ? { ...d, status: "error", errorMessage: msg } : d
          )
        );
      }
    }

    e.target.value = "";
  };

  const removePhotoDraft = (id: string) => {
    setPhotoDrafts((prev) => {
      const target = prev.find((d) => d.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((d) => d.id !== id);
    });
  };

  // Reset form tambah barang
  const resetAddForm = () => {
    setFormKode("");
    setFormNama("");
    setFormKategori(categories[0] || "Umum");
    setFormProjectId("none");
    setFormStokAwal("0");
    setFormAmbangMenipis("5");
    setFormHargaJual("");
    setFormLokasi("");
    setFormCatatan("");
    photoDrafts.forEach((d) => URL.revokeObjectURL(d.previewUrl));
    setPhotoDrafts([]);
    setAddItemError(null);
    setUploadProgressText("");
  };

  // Submit Tambah Barang
  const handleCreateStockItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddItemError(null);

    if (!formKode.trim()) {
      setAddItemError("Kode barang wajib diisi.");
      return;
    }
    if (!formNama.trim()) {
      setAddItemError("Nama barang wajib diisi.");
      return;
    }

    // Pastikan foto selesai kompresi
    const isStillCompressing = photoDrafts.some((d) => d.status === "compressing");
    if (isStillCompressing) {
      setAddItemError("Foto masih dalam proses kompresi di browser, harap tunggu sejenak.");
      return;
    }

    setIsSubmittingItem(true);
    setUploadProgressText("Mengunggah data barang dan foto...");

    try {
      const formData = new FormData();
      formData.set("kode", formKode.trim().toUpperCase());
      formData.set("nama", formNama.trim());
      formData.set("kategori", formKategori.trim());
      formData.set("project_id", formProjectId === "none" ? "" : formProjectId);
      formData.set("stok_awal", formStokAwal || "0");
      formData.set("ambang_menipis", formAmbangMenipis || "5");
      formData.set("harga_jual", formHargaJual || "");
      formData.set("lokasi_gudang", formLokasi.trim());
      formData.set("catatan", formCatatan.trim());

      const validDrafts = photoDrafts.filter(
        (d) => d.status === "ready" && d.fullBlob && d.thumbBlob
      );
      formData.set("photo_count", validDrafts.length.toString());

      validDrafts.forEach((draft, idx) => {
        if (draft.fullBlob && draft.thumbBlob) {
          formData.set(`photo_${idx}_full`, draft.fullBlob, `${draft.id}_full.webp`);
          formData.set(`photo_${idx}_thumb`, draft.thumbBlob, `${draft.id}_thumb.webp`);
          formData.set(`photo_${idx}_name`, draft.originalFile.name);
        }
      });

      const res = await createStockItemAction(formData);

      if (!res.success) {
        setAddItemError(res.error || "Gagal menyimpan barang.");
      } else {
        setIsAddModalOpen(false);
        resetAddForm();
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat simpan barang.";
      setAddItemError(msg);
    } finally {
      setIsSubmittingItem(false);
      setUploadProgressText("");
    }
  };

  // State Dialog Cepat Catat Penjualan
  const [quickSaleItem, setQuickSaleItem] = React.useState<StockItemView | null>(null);
  const [quickSaleQty, setQuickSaleQty] = React.useState<number>(1);
  const [quickSalePrice, setQuickSalePrice] = React.useState<string>("");
  const [quickSaleBuyer, setQuickSaleBuyer] = React.useState<string>("");
  const [quickSaleNotes, setQuickSaleNotes] = React.useState<string>("");
  const [isSubmittingSale, setIsSubmittingSale] = React.useState(false);
  const [quickSaleError, setQuickSaleError] = React.useState<string | null>(null);

  const openQuickSale = (item: StockItemView, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setQuickSaleItem(item);
    setQuickSaleQty(1);
    setQuickSalePrice(item.harga_jual ? item.harga_jual.toString() : "");
    setQuickSaleBuyer("");
    setQuickSaleNotes("");
    setQuickSaleError(null);
  };

  const handleQuickSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSaleItem) return;

    if (quickSaleQty <= 0) {
      setQuickSaleError("Jumlah penjualan harus minimal 1 pcs.");
      return;
    }

    if (quickSaleQty > quickSaleItem.stok_saat_ini) {
      setQuickSaleError(
        `Stok tidak mencukupi. Stok saat ini ${quickSaleItem.stok_saat_ini} pcs, penjualan ${quickSaleQty} pcs.`
      );
      return;
    }

    setIsSubmittingSale(true);
    setQuickSaleError(null);

    try {
      const res = await recordStockMovementAction({
        itemId: quickSaleItem.id,
        jenis: "keluar_penjualan",
        qty: quickSaleQty,
        hargaSatuan: quickSalePrice ? parseFloat(quickSalePrice) : undefined,
        pembeli: quickSaleBuyer.trim() || undefined,
        catatan: quickSaleNotes.trim() || undefined,
      });

      if (!res.success) {
        setQuickSaleError(res.error || "Gagal mencatat penjualan.");
      } else {
        setQuickSaleItem(null);
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      setQuickSaleError(msg);
    } finally {
      setIsSubmittingSale(false);
    }
  };

  // Total pages
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Cek apakah ada filter aktif selain default
  const hasActiveFilters =
    Boolean(currentQuery) ||
    currentProject !== "all" ||
    currentStatus !== "semua" ||
    currentCategory !== "semua" ||
    currentSort !== "terbaru" ||
    showArchived;

  return (
    <div className="space-y-6">
      {/* Peringatan Schema Belum Dijalankan */}
      {schemaMissing && (
        <div className="p-4 rounded-[16px] bg-warning/10 border border-warning/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-[13px] text-ink">
            <p className="font-semibold text-warning">Tabel stok belum aktif di database Supabase</p>
            <p className="mt-0.5 text-muted leading-relaxed">
              Jalankan file migration{" "}
              <code className="px-1.5 py-0.5 rounded bg-surface border border-line font-mono text-[11.5px]">
                supabase/migrations/20261122000010_stock_inventory.sql
              </code>{" "}
              di SQL Editor Supabase untuk mengaktifkan fitur stok gudang.
            </p>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. HEADER HALAMAN & TOMBOL TAMBAH BARANG                             */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-forest-900" />
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
              Manajemen Konveksi
            </span>
          </div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-ink tracking-tight mt-0.5">
            Stok Gudang
          </h1>
          <p className="text-[13px] text-muted mt-0.5">
            Katalog barang jadi, status ketersediaan rak, dan mutasi penjualan tunai.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={() => {
            resetAddForm();
            generateRandomKode();
            setIsAddModalOpen(true);
          }}
          className="h-11 px-5 rounded-pill shadow-sm flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Tambah Barang</span>
        </Button>
      </div>

      {/* ==================================================================== */}
      {/* 2. KARTU RINGKASAN METRIK (5 Kartu)                                  */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Jenis */}
        <div className="p-3.5 sm:p-4 rounded-[16px] bg-surface border border-line shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] font-semibold text-muted">Total Jenis</span>
            <div className="w-7 h-7 rounded-full bg-surface-muted text-ink flex items-center justify-center">
              <Package className="w-4 h-4 text-forest-900" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-[20px] sm:text-[22px] font-bold text-ink tabular-nums">
              {formatNumber(summary.total_jenis)}
            </span>
            <span className="text-[11.5px] text-muted ml-1">jenis</span>
          </div>
        </div>

        {/* Card 2: Total Pcs Tersedia */}
        <div className="p-3.5 sm:p-4 rounded-[16px] bg-surface border border-line shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] font-semibold text-muted">Stok Tersedia</span>
            <div className="w-7 h-7 rounded-full bg-lime-100 text-positive flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-[20px] sm:text-[22px] font-bold text-forest-900 tabular-nums">
              {formatNumber(summary.total_pcs_tersedia)}
            </span>
            <span className="text-[11.5px] text-muted ml-1">pcs</span>
          </div>
        </div>

        {/* Card 3: Menipis */}
        <div className="p-3.5 sm:p-4 rounded-[16px] bg-surface border border-line shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] font-semibold text-muted">Stok Menipis</span>
            <div className="w-7 h-7 rounded-full bg-warning/15 text-warning flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-[20px] sm:text-[22px] font-bold text-warning tabular-nums">
              {formatNumber(summary.total_menipis)}
            </span>
            <span className="text-[11.5px] text-muted ml-1">barang</span>
          </div>
        </div>

        {/* Card 4: Habis */}
        <div className="p-3.5 sm:p-4 rounded-[16px] bg-surface border border-line shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] font-semibold text-muted">Stok Habis</span>
            <div className="w-7 h-7 rounded-full bg-negative/12 text-negative flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-[20px] sm:text-[22px] font-bold text-negative tabular-nums">
              {formatNumber(summary.total_habis)}
            </span>
            <span className="text-[11.5px] text-muted ml-1">barang</span>
          </div>
        </div>

        {/* Card 5: Estimasi Nilai Stok */}
        <div className="col-span-2 sm:col-span-1 p-3.5 sm:p-4 rounded-[16px] bg-surface border border-line shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] font-semibold text-muted">Nilai Stok</span>
            <div className="w-7 h-7 rounded-full bg-emerald-50 text-positive flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-[16px] sm:text-[18px] font-bold text-ink tabular-nums truncate block">
              {formatRupiah(summary.estimasi_nilai_stok)}
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. BILAH PENCARIAN & FILTER DROPDOWN                                 */}
      {/* ==================================================================== */}
      <div className="p-4 rounded-[20px] bg-surface border border-line shadow-card space-y-3.5">
        {/* Kolom Pencarian */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari nama, kode, kategori, lokasi rak, atau catatan..."
            className="w-full h-11 pl-10 pr-9 rounded-[14px] bg-surface-muted/60 border border-line text-[13.5px] text-ink placeholder:text-muted focus:outline-none focus:border-forest-900 focus:bg-surface focus:ring-1 focus:ring-forest-900 transition"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                updateFilter({ q: null, page: "1" });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-line/60 hover:bg-line text-muted hover:text-ink flex items-center justify-center"
              aria-label="Hapus pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Baris Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Dropdown 1: Proyek Asal */}
          <div className="w-full">
            <label className="block text-[11px] font-bold text-muted mb-1 uppercase tracking-wider">
              Proyek Asal
            </label>
            <ProjectSelect
              projects={projects}
              selectedProjectId={currentProject}
              onChange={(pId) => updateFilter({ project: pId, page: "1" })}
              syncWithUrl={false}
              includeNoneOption={true}
              noneOptionLabel="Tanpa proyek"
              allOptionLabel="Semua proyek"
            />
          </div>

          {/* Dropdown 2: Status Stok */}
          <div>
            <label className="block text-[11px] font-bold text-muted mb-1 uppercase tracking-wider">
              Status Ketersediaan
            </label>
            <select
              value={currentStatus}
              onChange={(e) => updateFilter({ status: e.target.value, page: "1" })}
              aria-label="Filter status ketersediaan"
              className="w-full h-12 px-3.5 rounded-[14px] bg-surface border border-line text-[13.5px] font-semibold text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900 shadow-card"
            >
              <option value="semua">Semua Status</option>
              <option value="tersedia">Tersedia (&gt; ambang)</option>
              <option value="menipis">Menipis (&le; ambang)</option>
              <option value="habis">Habis (0 pcs)</option>
            </select>
          </div>

          {/* Dropdown 3: Kategori */}
          <div>
            <label className="block text-[11px] font-bold text-muted mb-1 uppercase tracking-wider">
              Kategori Barang
            </label>
            <select
              value={currentCategory}
              onChange={(e) => updateFilter({ kategori: e.target.value, page: "1" })}
              aria-label="Filter kategori barang"
              className="w-full h-12 px-3.5 rounded-[14px] bg-surface border border-line text-[13.5px] font-semibold text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900 shadow-card"
            >
              <option value="semua">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown 4: Urutkan */}
          <div>
            <label className="block text-[11px] font-bold text-muted mb-1 uppercase tracking-wider">
              Urutkan Berdasarkan
            </label>
            <select
              value={currentSort}
              onChange={(e) => updateFilter({ sort: e.target.value, page: "1" })}
              aria-label="Urutkan daftar barang"
              className="w-full h-12 px-3.5 rounded-[14px] bg-surface border border-line text-[13.5px] font-semibold text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900 shadow-card"
            >
              <option value="terbaru">Terbaru Ditambahkan</option>
              <option value="stok_terbanyak">Stok Terbanyak</option>
              <option value="stok_tersedikit">Stok Tersedikit</option>
              <option value="nama_asc">Nama Barang (A - Z)</option>
              <option value="terakhir_terjual">Aktivitas Terakhir</option>
            </select>
          </div>
        </div>

        {/* Checkbox Tampilkan Arsip & Chip Filter Aktif */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line/60">
          {/* Chip Filter Aktif */}
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {currentQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-surface-muted border border-line text-[11.5px] font-medium text-ink">
                <span>Cari: &quot;{currentQuery}&quot;</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    updateFilter({ q: null, page: "1" });
                  }}
                  className="hover:text-negative"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {currentProject !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-surface-muted border border-line text-[11.5px] font-medium text-ink">
                <span>
                  Proyek:{" "}
                  {currentProject === "none"
                    ? "Tanpa proyek"
                    : projects.find((p) => p.id === currentProject)?.nama || currentProject}
                </span>
                <button
                  type="button"
                  onClick={() => updateFilter({ project: "all", page: "1" })}
                  className="hover:text-negative"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {currentStatus !== "semua" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-surface-muted border border-line text-[11.5px] font-medium text-ink">
                <span>Status: {currentStatus}</span>
                <button
                  type="button"
                  onClick={() => updateFilter({ status: null, page: "1" })}
                  className="hover:text-negative"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {currentCategory !== "semua" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-surface-muted border border-line text-[11.5px] font-medium text-ink">
                <span>Kategori: {currentCategory}</span>
                <button
                  type="button"
                  onClick={() => updateFilter({ kategori: null, page: "1" })}
                  className="hover:text-negative"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[12px] font-semibold text-forest-900 hover:underline px-2 py-1"
              >
                Atur ulang filter
              </button>
            )}
          </div>

          {/* Toggle Arsip */}
          <label className="flex items-center gap-2 text-[12.5px] font-medium text-ink select-none cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) =>
                updateFilter({
                  showArchived: e.target.checked ? "true" : null,
                  page: "1",
                })
              }
              className="rounded border-line text-forest-900 focus:ring-forest-900 h-4 w-4"
            />
            <span>Tampilkan barang diarsipkan</span>
          </label>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. DAFTAR KARTU BARANG (Grid 2 Kolom di HP, 3-4 di Desktop)          */}
      {/* ==================================================================== */}
      {initialItems.length === 0 ? (
        <div className="py-16 px-4 rounded-[20px] bg-surface border border-line text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-surface-muted text-muted mx-auto flex items-center justify-center">
            <Package className="w-6 h-6 stroke-[1.5]" />
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-ink">Tidak ada barang stok ditemukan</h3>
            <p className="text-[13px] text-muted max-w-sm mx-auto mt-1 leading-relaxed">
              {hasActiveFilters
                ? "Tidak ada item yang sesuai dengan kriteria pencarian dan filter saat ini."
                : "Belum ada barang jadi yang didaftarkan ke dalam sistem stok gudang."}
            </p>
          </div>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="secondary"
              onClick={resetAllFilters}
              className="h-10 px-4 text-[13px] mt-2"
            >
              Hapus Semua Filter
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                resetAddForm();
                generateRandomKode();
                setIsAddModalOpen(true);
              }}
              className="h-10 px-5 text-[13px] mt-2"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Tambah Barang Pertama
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {initialItems.map((item) => {
            const pColor = item.warna_proyek ? getProjectColor(item.warna_proyek) : null;
            const isHabis = item.status_stok === "habis";
            const isMenipis = item.status_stok === "menipis";
            const isArchived = item.status === "diarsipkan";

            return (
              <div
                key={item.id}
                className={`group rounded-[18px] bg-surface border transition-all duration-200 flex flex-col justify-between overflow-hidden relative shadow-card hover:shadow-md ${
                  isArchived
                    ? "opacity-60 border-dashed border-line bg-surface-muted/30"
                    : "border-line hover:border-forest-900/30"
                }`}
              >
                <Link
                  href={`/owner/stok/${item.id}`}
                  className="flex-1 flex flex-col focus:outline-none"
                >
                  {/* Foto Sampul */}
                  <div className="relative w-full aspect-[4/3] bg-surface-muted/80 overflow-hidden">
                    {item.sampul_thumb_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.sampul_thumb_url}
                        alt={item.nama}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted/60 p-2">
                        <Package className="w-8 h-8 stroke-[1.2]" />
                        <span className="text-[10px] font-semibold mt-1">Tanpa Foto</span>
                      </div>
                    )}

                    {/* Badge Status Ketersediaan (Pojok Kiri Atas Foto) */}
                    <div className="absolute top-2 left-2">
                      {isHabis ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-negative text-white text-[10.5px] font-bold shadow-sm">
                          <XCircle className="w-3 h-3 stroke-[2.5]" />
                          <span>Habis</span>
                        </span>
                      ) : isMenipis ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning text-white text-[10.5px] font-bold shadow-sm">
                          <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
                          <span>Menipis</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-forest-900 text-lime-400 text-[10.5px] font-bold shadow-sm">
                          <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                          <span>Tersedia</span>
                        </span>
                      )}
                    </div>

                    {/* Badge Diarsipkan jika status diarsipkan */}
                    {isArchived && (
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-ink/75 text-white text-[9.5px] font-bold">
                        Diarsipkan
                      </div>
                    )}
                  </div>

                  {/* Informasi Item */}
                  <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between space-y-2">
                    <div className="space-y-1">
                      {/* Proyek Asal */}
                      <div className="flex items-center gap-1.5 text-[11px] text-muted truncate">
                        {pColor ? (
                          <span
                            className={`w-2 h-2 rounded-full ${pColor.dotClass} shrink-0 ring-1 ring-black/10`}
                          />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                        )}
                        <span className="truncate font-medium">
                          {item.nama_proyek || "Tanpa proyek"}
                        </span>
                      </div>

                      {/* Nama & Kode */}
                      <h4 className="text-[13.5px] sm:text-[14px] font-bold text-ink leading-snug line-clamp-2">
                        {item.nama}
                      </h4>
                      <p className="text-[11px] font-mono text-muted tracking-wider">
                        {item.kode}
                      </p>
                    </div>

                    {/* Angka Stok Besar & Harga */}
                    <div className="pt-2 border-t border-line/50 space-y-1">
                      <div className="flex items-baseline justify-between gap-1">
                        <div>
                          <span
                            className={`text-[17px] sm:text-[19px] font-extrabold tabular-nums ${
                              isHabis
                                ? "text-negative"
                                : isMenipis
                                ? "text-warning"
                                : "text-forest-900"
                            }`}
                          >
                            {formatNumber(item.stok_saat_ini)}
                          </span>
                          <span className="text-[11px] text-muted font-medium ml-1">pcs</span>
                        </div>

                        {item.lokasi_gudang && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted bg-surface-muted px-1.5 py-0.5 rounded-md truncate max-w-[80px]">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{item.lokasi_gudang}</span>
                          </span>
                        )}
                      </div>

                      {item.harga_jual && item.harga_jual > 0 && (
                        <p className="text-[11.5px] font-semibold text-ink/80 truncate">
                          {formatRupiah(item.harga_jual)}
                          <span className="text-[10px] text-muted font-normal"> / pcs</span>
                        </p>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Tombol Cepat: Catat Penjualan (Hanya untuk item aktif) */}
                {!isArchived && (
                  <div className="p-2 sm:p-2.5 pt-0 bg-surface">
                    <button
                      type="button"
                      onClick={(e) => openQuickSale(item, e)}
                      disabled={isHabis}
                      className={`w-full h-8 px-2.5 rounded-[10px] text-[11.5px] font-semibold flex items-center justify-center gap-1.5 transition select-none ${
                        isHabis
                          ? "bg-surface-muted text-muted/60 cursor-not-allowed"
                          : "bg-surface border border-line text-ink hover:bg-forest-900 hover:text-white hover:border-forest-900 active:scale-95"
                      }`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Catat Penjualan</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. PAGINASI                                                          */}
      {/* ==================================================================== */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-line/60">
          <p className="text-[12.5px] text-muted">
            Menampilkan <span className="font-semibold text-ink">{initialItems.length}</span> dari{" "}
            <span className="font-semibold text-ink">{totalItems}</span> barang
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => updateFilter({ page: (currentPage - 1).toString() })}
              className="h-9 px-3 text-[12px] flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Sebelumnya</span>
            </Button>

            <span className="text-[12px] font-semibold px-2 text-ink">
              {currentPage} / {totalPages}
            </span>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => updateFilter({ page: (currentPage + 1).toString() })}
              className="h-9 px-3 text-[12px] flex items-center gap-1"
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. MODAL TAMBAH BARANG                                               */}
      {/* ==================================================================== */}
      <Dialog
        isOpen={isAddModalOpen}
        onClose={() => !isSubmittingItem && setIsAddModalOpen(false)}
        title="Tambah Barang Stok Gudang"
        subtitle="Daftarkan katalog barang jadi konveksi dan tentukan stok awalnya."
        className="sm:max-w-xl"
      >
        <form onSubmit={handleCreateStockItem} className="space-y-4 pt-1">
          {addItemError && (
            <div className="p-3 rounded-[12px] bg-negative/10 border border-negative/20 text-negative text-[12.5px] font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{addItemError}</span>
            </div>
          )}

          {/* Baris 1: Kode & Nama */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11.5px] font-bold text-ink">Kode Barang *</label>
                <button
                  type="button"
                  onClick={generateRandomKode}
                  className="text-[11px] font-semibold text-forest-900 hover:underline flex items-center gap-0.5"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Acak</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={formKode}
                onChange={(e) => setFormKode(e.target.value.toUpperCase())}
                placeholder="BRG-001"
                className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line font-mono text-[13px] font-bold text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11.5px] font-bold text-ink mb-1">
                Nama Barang *
              </label>
              <input
                type="text"
                required
                value={formNama}
                onChange={(e) => setFormNama(e.target.value)}
                placeholder="Contoh: Totebag Kanvas Polos Hitam 30x40"
                className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[13px] font-semibold text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
              />
            </div>
          </div>

          {/* Baris 2: Kategori & Proyek Asal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] font-bold text-ink mb-1">
                Kategori Barang *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  list="kategori-datalist"
                  value={formKategori}
                  onChange={(e) => setFormKategori(e.target.value)}
                  placeholder="Ketik atau pilih kategori"
                  className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
                />
                <datalist id="kategori-datalist">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                  <option value="Tas Kain" />
                  <option value="Totebag" />
                  <option value="Pouch" />
                  <option value="Goodie Bag" />
                  <option value="Lainnya" />
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-[11.5px] font-bold text-ink mb-1">
                Proyek Asal (Opsional)
              </label>
              <select
                value={formProjectId}
                onChange={(e) => setFormProjectId(e.target.value)}
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

          {/* Baris 3: Stok Awal & Ambang Menipis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] font-bold text-ink mb-1">
                Stok Awal (pcs)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={formStokAwal}
                onChange={(e) => setFormStokAwal(e.target.value)}
                className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[14px] font-bold text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
              />
              <span className="text-[10.5px] text-muted block mt-0.5">
                Bila &gt; 0, otomatis dicatat sebagai mutasi Masuk awal.
              </span>
            </div>

            <div>
              <label className="block text-[11.5px] font-bold text-ink mb-1">
                Ambang Batas Menipis (pcs)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={formAmbangMenipis}
                onChange={(e) => setFormAmbangMenipis(e.target.value)}
                className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[14px] font-bold text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
              />
              <span className="text-[10.5px] text-muted block mt-0.5">
                Tanda peringatan saat stok mencapai angka ini atau kurang.
              </span>
            </div>
          </div>

          {/* Baris 4: Harga Jual & Lokasi Gudang */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] font-bold text-ink mb-1">
                Harga Jual Satuan (Rp)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={formHargaJual}
                onChange={(e) => setFormHargaJual(e.target.value)}
                placeholder="Contoh: 35000"
                className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
              />
            </div>

            <div>
              <label className="block text-[11.5px] font-bold text-ink mb-1">
                Lokasi Rak / Gudang
              </label>
              <input
                type="text"
                value={formLokasi}
                onChange={(e) => setFormLokasi(e.target.value)}
                placeholder="Contoh: Rak B-02 Lantai 1"
                className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
              />
            </div>
          </div>

          {/* Baris 5: Catatan Tambahan */}
          <div>
            <label className="block text-[11.5px] font-bold text-ink mb-1">
              Catatan Barang (Opsional)
            </label>
            <textarea
              rows={2}
              value={formCatatan}
              onChange={(e) => setFormCatatan(e.target.value)}
              placeholder="Keterangan spesifikasi bahan, jahitan, atau kegunaan..."
              className="w-full p-2.5 rounded-[12px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900 resize-none"
            />
          </div>

          {/* Baris 6: Unggah Foto (Maks 5 Foto) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11.5px] font-bold text-ink">Foto Barang (Maks. 5)</label>
              <span className="text-[11px] text-muted">{photoDrafts.length} / 5 foto</span>
            </div>

            {/* Grid Pratinjau Foto */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">
              {photoDrafts.map((draft, idx) => (
                <div
                  key={draft.id}
                  className="relative aspect-square rounded-[10px] bg-surface-muted overflow-hidden border border-line group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={draft.previewUrl}
                    alt="Pratinjau"
                    className="w-full h-full object-cover"
                  />
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-forest-900 text-white text-[9px] font-bold">
                      Sampul
                    </span>
                  )}
                  {draft.status === "compressing" && (
                    <div className="absolute inset-0 bg-ink/60 text-white flex items-center justify-center text-[10px] p-1 text-center font-medium">
                      Mengompres...
                    </div>
                  )}
                  {draft.status === "error" && (
                    <div className="absolute inset-0 bg-negative/80 text-white flex items-center justify-center text-[9px] p-1 text-center font-bold">
                      Gagal
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhotoDraft(draft.id)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-negative text-white flex items-center justify-center opacity-90 hover:opacity-100"
                    aria-label="Hapus foto"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {photoDrafts.length < 5 && (
                <label className="aspect-square rounded-[10px] border-2 border-dashed border-line hover:border-forest-900/60 bg-surface-muted/50 hover:bg-surface-muted flex flex-col items-center justify-center text-muted hover:text-ink cursor-pointer transition select-none">
                  <UploadCloud className="w-5 h-5 mb-0.5" />
                  <span className="text-[10.5px] font-semibold text-center leading-tight">
                    + Foto
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <p className="text-[10.5px] text-muted leading-relaxed">
              Foto otomatis dikompresi di browser (maks 1600px full &amp; 480px thumbnail)
              sebelum dikirim ke penyimpanan aman.
            </p>
          </div>

          {/* Status Proses Simpan */}
          {uploadProgressText && (
            <div className="p-2.5 rounded-[10px] bg-forest-900/5 border border-forest-900/20 text-forest-900 text-[12px] font-semibold flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>{uploadProgressText}</span>
            </div>
          )}

          {/* Tombol Aksi Modal */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmittingItem}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmittingItem}
              className="bg-forest-900 text-white min-w-[120px]"
            >
              {isSubmittingItem ? "Menyimpan..." : "Simpan Barang"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ==================================================================== */}
      {/* 7. DIALOG CEPAT CATAT PENJUALAN                                      */}
      {/* ==================================================================== */}
      <Dialog
        isOpen={Boolean(quickSaleItem)}
        onClose={() => !isSubmittingSale && setQuickSaleItem(null)}
        title="Catat Penjualan Cepat"
        subtitle={quickSaleItem ? `${quickSaleItem.nama} (${quickSaleItem.kode})` : ""}
      >
        {quickSaleItem && (
          <form onSubmit={handleQuickSaleSubmit} className="space-y-4 pt-1">
            {quickSaleError && (
              <div className="p-3 rounded-[12px] bg-negative/10 border border-negative/20 text-negative text-[12.5px] font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{quickSaleError}</span>
              </div>
            )}

            {/* Pratinjau Stok Saat Ini & Sesudah */}
            <div className="p-3.5 rounded-[14px] bg-surface-muted border border-line flex items-center justify-between">
              <div>
                <span className="text-[11px] text-muted block">Stok Saat Ini</span>
                <span className="text-[16px] font-bold text-ink">
                  {formatNumber(quickSaleItem.stok_saat_ini)} pcs
                </span>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-muted block">Setelah Dijual</span>
                <span
                  className={`text-[16px] font-bold ${
                    quickSaleItem.stok_saat_ini - quickSaleQty < 0
                      ? "text-negative"
                      : "text-forest-900"
                  }`}
                >
                  {Math.max(0, quickSaleItem.stok_saat_ini - quickSaleQty)} pcs
                </span>
              </div>
            </div>

            {/* Jumlah Terjual */}
            <div>
              <label className="block text-[11.5px] font-bold text-ink mb-1">
                Jumlah Terjual (pcs) *
              </label>
              <input
                type="number"
                inputMode="numeric"
                required
                min="1"
                max={quickSaleItem.stok_saat_ini}
                value={quickSaleQty}
                onChange={(e) => setQuickSaleQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
                className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[15px] font-bold text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
              />
            </div>

            {/* Harga Satuan & Pembeli */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11.5px] font-bold text-ink mb-1">
                  Harga Satuan (Rp)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={quickSalePrice}
                  onChange={(e) => setQuickSalePrice(e.target.value)}
                  placeholder="35000"
                  className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
                />
              </div>

              <div>
                <label className="block text-[11.5px] font-bold text-ink mb-1">
                  Nama Pembeli (Opsional)
                </label>
                <input
                  type="text"
                  value={quickSaleBuyer}
                  onChange={(e) => setQuickSaleBuyer(e.target.value)}
                  placeholder="Instansi / Pelanggan"
                  className="w-full h-11 px-3 rounded-[12px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
                />
              </div>
            </div>

            {/* Total Nilai Penjualan */}
            {quickSalePrice && parseFloat(quickSalePrice) > 0 && (
              <div className="p-2.5 rounded-[10px] bg-lime-50 border border-lime-200 text-forest-900 text-[13px] font-bold flex items-center justify-between">
                <span>Total Penjualan Tunai:</span>
                <span className="text-[14px]">
                  {formatRupiah(parseFloat(quickSalePrice) * quickSaleQty)}
                </span>
              </div>
            )}

            {/* Catatan Penjualan */}
            <div>
              <label className="block text-[11.5px] font-bold text-ink mb-1">
                Catatan Penjualan (Opsional)
              </label>
              <input
                type="text"
                value={quickSaleNotes}
                onChange={(e) => setQuickSaleNotes(e.target.value)}
                placeholder="Keterangan transaksi tunai..."
                className="w-full h-10 px-3 rounded-[12px] bg-surface border border-line text-[13px] text-ink focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
              />
            </div>

            {/* Tombol Aksi */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line/60">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setQuickSaleItem(null)}
                disabled={isSubmittingSale}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmittingSale || quickSaleQty <= 0}
                className="bg-forest-900 text-white min-w-[130px]"
              >
                {isSubmittingSale ? "Menyimpan..." : "Simpan Penjualan"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
