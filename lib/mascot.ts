/**
 * lib/mascot.ts
 * SATU-SATUNYA tempat pemetaan pose maskot ke berkas aset.
 * Memudahkan penambahan pose baru atau penggantian berkas tanpa mengubah komponen UI.
 */

export type MascotPose =
  | "ajakan"
  | "tercapai"
  | "melampaui"
  | "istirahat"
  | "gagal"
  | "belumCapai";

export interface MascotAssetConfig {
  src: string;
  width: number;
  height: number;
  deskripsi: string;
}

/**
 * Pemetaan terpusat pose maskot ke berkas WebP transparan teroptimasi di /public/mascot
 */
export const MASCOT_ASSETS: Record<MascotPose, MascotAssetConfig> = {
  ajakan: {
    src: "/mascot/pose-target-harian.webp",
    width: 480,
    height: 565,
    deskripsi: "Maskot Fiko tersenyum menunjuk ke samping mengajak bekerja",
  },
  tercapai: {
    src: "/mascot/pose-target-tercapai.webp",
    width: 480,
    height: 582,
    deskripsi: "Maskot Fiko melompat gembira dengan jempol merayakan target tercapai",
  },
  melampaui: {
    src: "/mascot/pose-melampaui-target.webp",
    width: 480,
    height: 595,
    deskripsi: "Maskot Fiko terkejut senang dengan mata berbintang merayakan melampaui target",
  },
  istirahat: {
    src: "/mascot/pose-beristirahat.webp",
    width: 480,
    height: 581,
    deskripsi: "Maskot Fiko sedang santai dan bernapas tenang beristirahat",
  },
  gagal: {
    src: "/mascot/pose-gagal-terkirim.webp",
    width: 480,
    height: 524,
    deskripsi: "Maskot Fiko prihatin saat pengiriman gagal",
  },
  belumCapai: {
    src: "/mascot/pose-belum-capaitarget.webp",
    width: 480,
    height: 572,
    deskripsi: "Maskot Fiko melayang tenang memberi semangat melanjutkan target",
  },
};

/**
 * Helper untuk mengambil metadata berkas pose maskot
 */
export function getMascotAsset(pose: MascotPose): MascotAssetConfig {
  return MASCOT_ASSETS[pose] || MASCOT_ASSETS.ajakan;
}
