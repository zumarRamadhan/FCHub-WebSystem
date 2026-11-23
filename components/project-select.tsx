"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Search,
  ChevronDown,
  Check,
  Layers,
  X,
  MinusCircle,
} from "lucide-react";
import { formatNumber } from "@/lib/format";
import { getProjectColor } from "@/lib/project-colors";

export interface ProjectSelectItem {
  id: string;
  nama: string;
  warna?: string | null;
  status?: string;
  target_pcs?: number;
  total_pcs_disetujui?: number;
  persentase_progres?: number;
}

export interface ProjectSelectProps {
  projects: ProjectSelectItem[];
  selectedProjectId?: string;
  onChange?: (projectId: string) => void;
  syncWithUrl?: boolean;
  className?: string;
  placeholder?: string;
  allOptionLabel?: string;
  includeNoneOption?: boolean;
  noneOptionLabel?: string;
}

export function ProjectSelect({
  projects,
  selectedProjectId = "all",
  onChange,
  syncWithUrl = true,
  className = "",
  placeholder = "Pilih Proyek",
  allOptionLabel = "Semua proyek",
  includeNoneOption = false,
  noneOptionLabel = "Tanpa proyek",
}: ProjectSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState<number>(-1);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Proyek terpilih saat ini
  const currentSelectedProject = React.useMemo(() => {
    if (!selectedProjectId || selectedProjectId === "all" || selectedProjectId === "none") return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // Filter daftar proyek berdasarkan pencarian
  const filteredProjects = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.nama.toLowerCase().includes(q));
  }, [projects, searchQuery]);

  // Pisahkan proyek aktif dan selesai
  const activeProjects = React.useMemo(() => {
    return filteredProjects.filter((p) => (p.status || "aktif") === "aktif");
  }, [filteredProjects]);

  const completedProjects = React.useMemo(() => {
    return filteredProjects.filter((p) => p.status === "selesai" || p.status === "diarsipkan");
  }, [filteredProjects]);

  // Bangun daftar opsi datar untuk navigasi keyboard
  const isAllOptionVisible = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return allOptionLabel.toLowerCase().includes(q) || "semua proyek".includes(q);
  }, [searchQuery, allOptionLabel]);

  const isNoneOptionVisible = React.useMemo(() => {
    if (!includeNoneOption) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return noneOptionLabel.toLowerCase().includes(q) || "tanpa proyek".includes(q);
  }, [includeNoneOption, searchQuery, noneOptionLabel]);

  const flatOptions = React.useMemo(() => {
    const items: Array<{ id: string; nama: string }> = [];
    if (isAllOptionVisible) {
      items.push({ id: "all", nama: allOptionLabel });
    }
    if (isNoneOptionVisible) {
      items.push({ id: "none", nama: noneOptionLabel });
    }
    activeProjects.forEach((p) => items.push({ id: p.id, nama: p.nama }));
    completedProjects.forEach((p) => items.push({ id: p.id, nama: p.nama }));
    return items;
  }, [isAllOptionVisible, isNoneOptionVisible, activeProjects, completedProjects, allOptionLabel, noneOptionLabel]);

  // Fokus otomatis kolom pencarian saat panel dibuka
  React.useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setHighlightedIndex(-1);
      // Timeout kecil agar render bottom sheet / popover selesai sebelum fokus
      const t = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Handler klik di luar untuk menutup panel
  React.useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Handler pemilihan proyek
  const handleSelect = (id: string) => {
    if (onChange) {
      onChange(id);
    }

    if (syncWithUrl) {
      const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
      if (id === "all") {
        params.delete("project");
      } else {
        params.set("project", id);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }

    setIsOpen(false);
  };

  // Navigasi Keyboard (Panah atas/bawah, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < flatOptions.length - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : flatOptions.length - 1));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < flatOptions.length) {
        handleSelect(flatOptions[highlightedIndex].id);
      } else if (flatOptions.length > 0) {
        handleSelect(flatOptions[0].id);
      }
    }
  };

  // Warna indikator proyek terpilih
  const selectedColorMeta = currentSelectedProject
    ? currentSelectedProject.warna
      ? getProjectColor(currentSelectedProject.warna)
      : null
    : null;

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={`relative inline-block w-full ${className}`}
    >
      {/* ==================================================================== */}
      {/* TOMBOL PEMICU (Trigger Button) */}
      {/* Sesuai design-fchub.md: min-height 48px, radius 14px, teks ellipsis   */}
      {/* ==================================================================== */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full min-h-[48px] h-12 px-3.5 rounded-[14px] bg-surface border transition-all duration-150 flex items-center justify-between gap-2.5 text-left select-none ${
          isOpen
            ? "border-forest-900 ring-2 ring-forest-900/15 shadow-sm"
            : "border-line hover:border-forest-900/40 hover:bg-surface-muted/50 shadow-card"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {currentSelectedProject ? (
            selectedColorMeta ? (
              <span
                className={`w-3 h-3 rounded-full ${selectedColorMeta.dotClass} shrink-0 ring-1 ring-black/10`}
                aria-hidden="true"
              />
            ) : (
              <span
                className="w-3 h-3 rounded-full bg-slate-400 shrink-0 ring-1 ring-black/10"
                aria-hidden="true"
              />
            )
          ) : selectedProjectId === "none" ? (
            <MinusCircle className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
          ) : (
            <Layers className="w-4 h-4 text-forest-900 shrink-0" aria-hidden="true" />
          )}

          <div className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-ink truncate">
              {currentSelectedProject
                ? currentSelectedProject.nama
                : selectedProjectId === "none"
                ? noneOptionLabel
                : selectedProjectId === "all" || !selectedProjectId
                ? allOptionLabel
                : placeholder}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <ChevronDown
            className={`w-4 h-4 text-muted transition-transform duration-200 ${
              isOpen ? "rotate-180 text-forest-900" : ""
            }`}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* ==================================================================== */}
      {/* PANEL DROPDOWN */}
      {/* Mobile: Bottom Sheet (< 640px) | Desktop: Popover (>= 640px)         */}
      {/* ==================================================================== */}
      {isOpen && (
        <>
          {/* Backdrop gelap khusus Mobile (< 640px) */}
          <div
            onClick={() => setIsOpen(false)}
            className="sm:hidden fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] transition-opacity"
            aria-hidden="true"
          />

          <div
            className={`
              /* Mobile (< 640px): Bottom Sheet */
              fixed sm:absolute inset-x-0 bottom-0 sm:inset-auto sm:top-full sm:left-0 sm:mt-1.5
              w-full sm:min-w-[320px] sm:max-w-md
              bg-surface z-50
              rounded-t-[24px] sm:rounded-[16px]
              max-h-[70vh] sm:max-h-[380px]
              flex flex-col
              shadow-2xl sm:shadow-lg
              border-t sm:border border-line
              overflow-hidden
            `}
          >
            {/* Mobile Sheet Handle Bar */}
            <div className="sm:hidden w-10 h-1 rounded-full bg-line mx-auto my-2 shrink-0" />

            {/* Header Panel Dropdown */}
            <div className="p-3 border-b border-line/70 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold text-ink">Pilih Proyek</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-pill bg-surface-muted border border-line text-muted tabular-nums">
                  {projects.length} proyek
                </span>
              </div>

              {/* Tombol Tutup Silang di Mobile */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="sm:hidden w-7 h-7 rounded-full bg-surface-muted flex items-center justify-center text-muted hover:text-ink"
                aria-label="Tutup pemilih proyek"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Kolom Pencarian */}
            <div className="p-2.5 border-b border-line/60 bg-surface-muted/40 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari proyek..."
                  className="w-full h-10 pl-9 pr-8 rounded-[12px] bg-surface border border-line text-[13px] text-ink placeholder:text-muted focus:outline-none focus:border-forest-900 focus:ring-1 focus:ring-forest-900"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Daftar Opsi Proyek (Scrollable List) */}
            <div ref={listRef} className="overflow-y-auto flex-1 p-1.5 space-y-1 divide-y divide-line/40">
              {/* Opsi 1: "Semua proyek" */}
              {isAllOptionVisible && (
                <div className="pb-1">
                  <button
                    type="button"
                    onClick={() => handleSelect("all")}
                    className={`w-full px-3 py-2.5 rounded-[12px] text-left transition flex items-center justify-between gap-2.5 ${
                      selectedProjectId === "all" || !selectedProjectId
                        ? "bg-lime-50 text-forest-900 font-semibold border border-lime-200"
                        : "text-ink hover:bg-surface-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-forest-900/10 text-forest-900 flex items-center justify-center shrink-0">
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[13.5px] font-semibold block truncate">
                          {allOptionLabel}
                        </span>
                        <span className="text-[11px] text-muted block">
                          Seluruh pesanan konveksi
                        </span>
                      </div>
                    </div>

                    {(selectedProjectId === "all" || !selectedProjectId) && (
                      <Check className="w-4 h-4 text-positive shrink-0" />
                    )}
                  </button>
                </div>
              )}

              {/* Opsi Tambahan: "Tanpa proyek" (jika diaktifkan) */}
              {isNoneOptionVisible && (
                <div className="pb-1">
                  <button
                    type="button"
                    onClick={() => handleSelect("none")}
                    className={`w-full px-3 py-2.5 rounded-[12px] text-left transition flex items-center justify-between gap-2.5 ${
                      selectedProjectId === "none"
                        ? "bg-lime-50 text-forest-900 font-semibold border border-lime-200"
                        : "text-ink hover:bg-surface-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                        <MinusCircle className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[13.5px] font-semibold block truncate">
                          {noneOptionLabel}
                        </span>
                        <span className="text-[11px] text-muted block">
                          Barang tanpa kaitan proyek tertentu
                        </span>
                      </div>
                    </div>

                    {selectedProjectId === "none" && (
                      <Check className="w-4 h-4 text-positive shrink-0" />
                    )}
                  </button>
                </div>
              )}

              {/* Kelompok 1: Proyek Aktif */}
              {activeProjects.length > 0 && (
                <div className="pt-1.5 space-y-1">
                  <div className="px-3 py-1 flex items-center justify-between">
                    <span className="text-[10.5px] font-bold text-muted uppercase tracking-wider">
                      Proyek Aktif ({activeProjects.length})
                    </span>
                  </div>

                  {activeProjects.map((proj) => {
                    const isSelected = selectedProjectId === proj.id;
                    const pColor = proj.warna ? getProjectColor(proj.warna) : null;
                    const pct =
                      proj.persentase_progres !== undefined
                        ? Math.min(100, Math.round(proj.persentase_progres))
                        : undefined;

                    return (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => handleSelect(proj.id)}
                        className={`w-full px-3 py-2 rounded-[12px] text-left transition flex items-center justify-between gap-2.5 ${
                          isSelected
                            ? "bg-lime-50 text-forest-900 font-semibold border border-lime-200"
                            : "text-ink hover:bg-surface-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {pColor ? (
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${pColor.dotClass} shrink-0 ring-1 ring-black/10`}
                              aria-hidden="true"
                            />
                          ) : (
                            <span
                              className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0 ring-1 ring-black/10"
                              aria-hidden="true"
                            />
                          )}

                          <div className="min-w-0 flex-1">
                            <span className="text-[13px] font-semibold block truncate text-ink">
                              {proj.nama}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-muted">
                              {proj.target_pcs && (
                                <span>{formatNumber(proj.target_pcs)} pcs</span>
                              )}
                              {pct !== undefined && (
                                <span className="font-semibold text-forest-900">
                                  {pct}% tercapai
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <Check className="w-4 h-4 text-positive shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Kelompok 2: Proyek Selesai / Diarsipkan */}
              {completedProjects.length > 0 && (
                <div className="pt-2 space-y-1">
                  <div className="px-3 py-1 flex items-center justify-between">
                    <span className="text-[10.5px] font-bold text-muted uppercase tracking-wider">
                      Proyek Selesai ({completedProjects.length})
                    </span>
                  </div>

                  {completedProjects.map((proj) => {
                    const isSelected = selectedProjectId === proj.id;
                    const pColor = proj.warna ? getProjectColor(proj.warna) : null;

                    return (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => handleSelect(proj.id)}
                        className={`w-full px-3 py-2 rounded-[12px] text-left transition flex items-center justify-between gap-2.5 opacity-80 hover:opacity-100 ${
                          isSelected
                            ? "bg-surface-muted text-forest-900 font-semibold border border-line"
                            : "text-ink hover:bg-surface-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {pColor ? (
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${pColor.dotClass} shrink-0`}
                              aria-hidden="true"
                            />
                          ) : (
                            <span
                              className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0"
                              aria-hidden="true"
                            />
                          )}

                          <div className="min-w-0 flex-1">
                            <span className="text-[13px] font-medium block truncate text-ink">
                              {proj.nama}
                            </span>
                            <span className="text-[10.5px] text-muted block">
                              Selesai / Ditutup
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <Check className="w-4 h-4 text-positive shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Keadaan Kosong Pencarian */}
              {flatOptions.length === 0 && (
                <div className="py-8 px-4 text-center text-muted">
                  <p className="text-[13px] font-semibold text-ink">
                    Tidak ada proyek ditemukan
                  </p>
                  <p className="text-[11.5px] text-muted mt-0.5">
                    Coba kata kunci pencarian nama proyek lainnya.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
