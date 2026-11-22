/**
 * lib/project-colors.ts
 * Definisi palet warna terbatas untuk proyek konveksi FCHub.
 * Sesuai design-fchub.md (Pengecualian Terbatas Satu Aksen) & AGENTS.md Aturan Bisnis #20.
 *
 * Catatan Desain:
 * Indikator proyek TIDAK BOLEH hanya mengandalkan warna; selalu sertakan
 * nama proyek atau inisialnya untuk aksesibilitas kontras dan tuna warna.
 */

import { ProjectColorKey } from "./types/database";

export interface ProjectColorMeta {
  key: ProjectColorKey;
  name: string;
  hex: string;
  bgHex: string;
  borderHex: string;
  // Kelas CSS Tailwind untuk styling konsisten
  dotClass: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  ringClass: string;
}

export const PROJECT_COLORS: Record<ProjectColorKey, ProjectColorMeta> = {
  p1: {
    key: "p1",
    name: "Ocean Blue",
    hex: "#2563EB",
    bgHex: "#EFF6FF",
    borderHex: "#BFDBFE",
    dotClass: "bg-blue-600",
    bgClass: "bg-blue-50",
    borderClass: "border-blue-200",
    textClass: "text-blue-700",
    ringClass: "ring-blue-600",
  },
  p2: {
    key: "p2",
    name: "Emerald Green",
    hex: "#059669",
    bgHex: "#ECFDF5",
    borderHex: "#A7F3D0",
    dotClass: "bg-emerald-600",
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-200",
    textClass: "text-emerald-700",
    ringClass: "ring-emerald-600",
  },
  p3: {
    key: "p3",
    name: "Amber Gold",
    hex: "#D97706",
    bgHex: "#FFFBEB",
    borderHex: "#FDE68A",
    dotClass: "bg-amber-600",
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200",
    textClass: "text-amber-800",
    ringClass: "ring-amber-600",
  },
  p4: {
    key: "p4",
    name: "Royal Purple",
    hex: "#7C3AED",
    bgHex: "#F5F3FF",
    borderHex: "#DDD6FE",
    dotClass: "bg-purple-600",
    bgClass: "bg-purple-50",
    borderClass: "border-purple-200",
    textClass: "text-purple-700",
    ringClass: "ring-purple-600",
  },
  p5: {
    key: "p5",
    name: "Rose Crimson",
    hex: "#E11D48",
    bgHex: "#FFF1F2",
    borderHex: "#FECDD3",
    dotClass: "bg-rose-600",
    bgClass: "bg-rose-50",
    borderClass: "border-rose-200",
    textClass: "text-rose-700",
    ringClass: "ring-rose-600",
  },
  p6: {
    key: "p6",
    name: "Cyan Teal",
    hex: "#0891B2",
    bgHex: "#ECFEFF",
    borderHex: "#A5F3FC",
    dotClass: "bg-cyan-600",
    bgClass: "bg-cyan-50",
    borderClass: "border-cyan-200",
    textClass: "text-cyan-800",
    ringClass: "ring-cyan-600",
  },
  p7: {
    key: "p7",
    name: "Warm Orange",
    hex: "#EA580C",
    bgHex: "#FFF7ED",
    borderHex: "#FED7AA",
    dotClass: "bg-orange-600",
    bgClass: "bg-orange-50",
    borderClass: "border-orange-200",
    textClass: "text-orange-700",
    ringClass: "ring-orange-600",
  },
  p8: {
    key: "p8",
    name: "Deep Indigo",
    hex: "#4F46E5",
    bgHex: "#EEF2FF",
    borderHex: "#C7D2FE",
    dotClass: "bg-indigo-600",
    bgClass: "bg-indigo-50",
    borderClass: "border-indigo-200",
    textClass: "text-indigo-700",
    ringClass: "ring-indigo-600",
  },
};

export const PROJECT_COLOR_LIST: ProjectColorMeta[] = Object.values(PROJECT_COLORS);

/**
 * Mengambil metadata warna proyek berdasarkan kunci ('p1'..'p8').
 * Jika tidak ditemukan atau kosong, fallback ke 'p1'.
 */
export function getProjectColor(colorKey?: string | null): ProjectColorMeta {
  if (colorKey && colorKey in PROJECT_COLORS) {
    return PROJECT_COLORS[colorKey as ProjectColorKey];
  }
  return PROJECT_COLORS.p1;
}

/**
 * Membuat inisial proyek 2 huruf dari nama proyek (misal: "Tas Serut Polos" -> "TS").
 */
export function getProjectInitials(nama: string): string {
  if (!nama) return "PR";
  const words = nama.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return nama.slice(0, 2).toUpperCase();
}
