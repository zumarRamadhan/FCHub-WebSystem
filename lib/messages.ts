/**
 * lib/messages.ts
 * Logika pemilihan pesan hangat dan pose maskot untuk penjahit.
 *
 * Prinsip:
 * 1. Bahasa Indonesia hangat, ramah, dan memotivasi.
 * 2. Tanpa sindiran, tanpa nominal upah (hanya jumlah pcs), tanpa perbandingan antar-penjahit.
 * 3. Tidak memakai kata "kurang" atau "belum" pada jumlah kecil.
 * 4. Mendukung rotasi variasi pesan anti-repetisi (localStorage aman dengan try/catch).
 */

import { MascotPose } from "./mascot";
import {
  MELAMPAUI_RASIO,
  PAKAI_POSE_BELUM_CAPAI,
  TimePeriod,
  getJakartaTimePeriod,
} from "./config";
import { formatDateId } from "./format";

export interface TailorGreetingContext {
  nama: string; // nama penjahit (akan diambil nama depan)
  tanggalKerja: string; // tanggal yang sedang dipilih (YYYY-MM-DD)
  todayStr: string; // hari ini di Jakarta (YYYY-MM-DD)
  isHariKerja: boolean; // dari kalender kerja database
  totalPcsHariIni: number; // total entri milik penjahit tanggal itu yang status != 'ditolak'
  targetHarian: number; // target harian dari app_settings (default 100)
  isNewPersonalRecord?: boolean; // true jika rekor pribadi baru (riwayat >= 5 hari)
  rewardContext?: {
    namaProyek: string;
    pcsDisetujui: number;
    ambangReward: number;
    isQualified: boolean;
    sisaPcs: number;
  };
}

export interface GreetingResult {
  pose: MascotPose | null; // null jika hari libur tanpa input
  pesan: string;
  isHolidayNoInput: boolean;
}

/**
 * Penyimpanan pesan terakhir per kunci konteks di localStorage agar tidak mengulang pesan yang sama
 */
const LAST_MESSAGE_STORAGE_PREFIX = "fchub_last_msg_";

function pickNonRepeating(key: string, variations: string[]): string {
  if (variations.length === 0) return "";
  if (variations.length === 1) return variations[0];

  let lastIndex = -1;
  try {
    const saved = localStorage.getItem(LAST_MESSAGE_STORAGE_PREFIX + key);
    if (saved !== null) {
      lastIndex = parseInt(saved, 10);
    }
  } catch {
    // Abaikan error localStorage (mode private/SSR)
  }

  // Pilih indeks baru yang berbeda dari sebelumnya
  let nextIndex = Math.floor(Math.random() * variations.length);
  if (nextIndex === lastIndex && variations.length > 1) {
    nextIndex = (nextIndex + 1) % variations.length;
  }

  try {
    localStorage.setItem(LAST_MESSAGE_STORAGE_PREFIX + key, String(nextIndex));
  } catch {
    // Abaikan
  }

  return variations[nextIndex];
}

/**
 * Mengambil nama panggilan depan dari nama lengkap penjahit
 */
export function getFirstName(fullName: string): string {
  if (!fullName) return "Penjahit";
  const parts = fullName.trim().split(/\s+/);
  return parts[0] || "Penjahit";
}

/**
 * Menghitung pose dan pesan sapaan harian sesuai aturan prioritas bisnis
 */
export function determineGreeting(ctx: TailorGreetingContext): GreetingResult {
  const {
    tanggalKerja,
    todayStr,
    isHariKerja,
    totalPcsHariIni,
    targetHarian,
    isNewPersonalRecord,
  } = ctx;

  const isToday = tanggalKerja === todayStr;
  const timePeriod: TimePeriod = getJakartaTimePeriod();
  const melampauiThreshold = Math.round(targetHarian * MELAMPAUI_RASIO);

  // 1. Hari Libur dan Belum Ada Input (Kini menggunakan pose 'istirahat' yang bernapas pelan)
  if (!isHariKerja && totalPcsHariIni === 0 && isToday) {
    const liburMsgs = [
      "Hari ini libur. Selamat beristirahat!",
      "Hari ini waktu untuk santai dan rehat. Selamat libur!",
      "Selamat beristirahat di hari libur ini!",
    ];
    return {
      pose: "istirahat",
      pesan: pickNonRepeating("libur_no_input", liburMsgs),
      isHolidayNoInput: true,
    };
  }

  // 2. Hari Libur Ada Input (Kerja Lembur)
  if (!isHariKerja && totalPcsHariIni > 0 && isToday) {
    const lemburMsgs = [
      `Terima kasih sudah lembur, ${totalPcsHariIni} pcs tercatat hari ini.`,
      `Luar biasa dedikasimu! ${totalPcsHariIni} pcs lembur sudah masuk sistem.`,
      `Terima kasih atas kerja lemburmu hari ini (${totalPcsHariIni} pcs tercatat).`,
    ];
    let pose: MascotPose = "ajakan";
    if (totalPcsHariIni >= melampauiThreshold) {
      pose = "melampaui";
    } else if (totalPcsHariIni >= targetHarian) {
      pose = "tercapai";
    }
    return {
      pose,
      pesan: pickNonRepeating("libur_lembur", lemburMsgs),
      isHolidayNoInput: false,
    };
  }

  // 3. Tanggal yang Dipilih Bukan Hari Ini (Mencatat entri tanggal kemarin/lain)
  if (!isToday) {
    const tglFormatted = formatDateId(tanggalKerja);
    const dateMsgs = [
      `Mencatat untuk ${tglFormatted}.`,
      `Silakan masukkan catatan hasil jahitan ${tglFormatted}.`,
      `Catatan produksi untuk tanggal ${tglFormatted}.`,
    ];
    return {
      pose: "ajakan",
      pesan: pickNonRepeating("bukan_hari_ini", dateMsgs),
      isHolidayNoInput: false,
    };
  }

  // 4. Melampaui Target (Total >= target * 1.25) atau Rekor Baru
  if (totalPcsHariIni >= melampauiThreshold || isNewPersonalRecord) {
    if (isNewPersonalRecord) {
      const rekorMsgs = [
        `Rekor baru untukmu: ${totalPcsHariIni} pcs!`,
        `Pencapaian terbaikmu sejauh ini: ${totalPcsHariIni} pcs! Luar biasa!`,
        `Selamat atas rekor produksi pribadimu: ${totalPcsHariIni} pcs!`,
      ];
      return {
        pose: "melampaui",
        pesan: pickNonRepeating("rekor_baru", rekorMsgs),
        isHolidayNoInput: false,
      };
    }

    const melampauiMsgs = [
      `Luar biasa! ${totalPcsHariIni} pcs hari ini, melampaui target ${targetHarian}.`,
      `Kerja luar biasa! ${totalPcsHariIni} pcs berhasil tercatat hari ini.`,
      `Hebat sekali! Kamu melampaui target dengan ${totalPcsHariIni} pcs hari ini.`,
    ];
    return {
      pose: "melampaui",
      pesan: pickNonRepeating("melampaui_target", melampauiMsgs),
      isHolidayNoInput: false,
    };
  }

  // 5. Target Tercapai (Target <= Total < Target * 1.25)
  if (totalPcsHariIni >= targetHarian) {
    const tercapaiMsgs = [
      `Target hari ini tercapai (${totalPcsHariIni} dari ${targetHarian} pcs). Kerja bagus!`,
      `Hebat! Target ${targetHarian} pcs berhasil kamu selesaikan hari ini.`,
      `Mantap! ${totalPcsHariIni} pcs hari ini sudah mencapai target harian.`,
    ];
    return {
      pose: "tercapai",
      pesan: pickNonRepeating("tercapai_target", tercapaiMsgs),
      isHolidayNoInput: false,
    };
  }

  // 6. Progres Menuju Reward (Jika dioper konteks reward dan sedang ada reward aktif)
  if (ctx.rewardContext) {
    const rc = ctx.rewardContext;
    if (rc.isQualified) {
      const rewardLulusMsgs = [
        `Kamu sudah melewati ambang reward (${rc.pcsDisetujui} dari ${rc.ambangReward} pcs)!`,
        `Hebat! Kamu telah memenuhi syarat reward proyek ${rc.namaProyek}!`,
        `Target reward tercapai: ${rc.pcsDisetujui} pcs disetujui untuk ${rc.namaProyek}!`,
      ];
      return {
        pose: "melampaui",
        pesan: pickNonRepeating("reward_lulus", rewardLulusMsgs),
        isHolidayNoInput: false,
      };
    } else if (rc.sisaPcs > 0 && rc.sisaPcs <= Math.round(rc.ambangReward * 0.3)) {
      const rewardDekatMsgs = [
        `Tinggal ${rc.sisaPcs} pcs lagi menuju reward proyek ini.`,
        `Sedikit lagi! ${rc.sisaPcs} pcs lagi untuk mencapai reward proyek ${rc.namaProyek}.`,
        `Ayo semangat, sisa ${rc.sisaPcs} pcs menuju bonus reward!`,
      ];
      return {
        pose: "ajakan",
        pesan: pickNonRepeating("reward_dekat", rewardDekatMsgs),
        isHolidayNoInput: false,
      };
    }
  }

  // 7. Total Tercatat = 0
  if (totalPcsHariIni === 0) {
    if (timePeriod === "malam") {
      const malamNolMsgs = [
        "Sudah selesai kerja? Yuk catat hasilmu hari ini.",
        "Jangan lupa catat hasil jahitanmu hari ini ya.",
        "Selamat malam! Yuk masukkan catatan produksi hari ini.",
      ];
      return {
        pose: "ajakan",
        pesan: pickNonRepeating("nol_malam", malamNolMsgs),
        isHolidayNoInput: false,
      };
    }

    // Pagi s.d. Sore
    const pagiNolMsgs = [
      "Yuk selesaikan target harianmu!",
      `Semangat! Target hari ini ${targetHarian} pcs.`,
      "Ayo mulai hari ini dengan semangat dan capai targetmu!",
    ];
    return {
      pose: "ajakan",
      pesan: pickNonRepeating("nol_pagi_sore", pagiNolMsgs),
      isHolidayNoInput: false,
    };
  }

  // 8. Pencapaian di Bawah Target (0 < total < target)
  // Aturan Wajib:
  // - Sore (15.00-18.00) dan malam (18.00-04.00) memakai pose 'belumCapai' (jika PAKAI_POSE_BELUM_CAPAI = true).
  // - Pagi sampai siang tetap pose 'ajakan'.
  // - Tanpa kata menyindir seperti "kurang", "gagal", atau "belum capai", dan tanpa perbandingan dengan penjahit lain.
  const sisa = Math.max(0, targetHarian - totalPcsHariIni);
  const useBelumCapaiPose: MascotPose = PAKAI_POSE_BELUM_CAPAI ? "belumCapai" : "ajakan";

  // 8a. Malam (18.00-04.00)
  if (timePeriod === "malam") {
    const malamParsialMsgs = [
      "Terima kasih sudah mencatat " + totalPcsHariIni + " pcs hari ini. Besok kita lanjutkan!",
      "Kerja bagus hari ini (" + totalPcsHariIni + " pcs tercatat). Selamat beristirahat, besok kita lanjutkan!",
      "Terima kasih atas kerja kerasmu hari ini (" + totalPcsHariIni + " pcs tersimpan). Sampai jumpa besok!",
    ];
    return {
      pose: useBelumCapaiPose,
      pesan: pickNonRepeating("parsial_malam", malamParsialMsgs),
      isHolidayNoInput: false,
    };
  }

  // 8b. Sore (15.00-18.00)
  if (timePeriod === "sore") {
    const soreParsialMsgs = [
      "Hari ini tercatat " + totalPcsHariIni + " pcs. Masih ada waktu, tinggal " + sisa + " pcs lagi menuju target.",
      "Sudah " + totalPcsHariIni + " pcs masuk sore ini. Masih sempat menambah, tinggal " + sisa + " pcs lagi!",
      "Semangat sore! " + totalPcsHariIni + " pcs tercatat, tinggal " + sisa + " pcs lagi menuju target hari ini.",
    ];
    return {
      pose: useBelumCapaiPose,
      pesan: pickNonRepeating("parsial_sore", soreParsialMsgs),
      isHolidayNoInput: false,
    };
  }

  // 8c. Pagi sampai Siang (04.00-15.00)
  if (totalPcsHariIni < Math.round(targetHarian * 0.3)) {
    const kecilPagiSiangMsgs = [
      "Terima kasih sudah mencatat " + totalPcsHariIni + " pcs hari ini. Setiap pcs sangat berharga!",
      "Catatan " + totalPcsHariIni + " pcs hari ini sudah tersimpan dengan aman.",
      "Terima kasih untuk " + totalPcsHariIni + " pcs hasil kerjamu hari ini.",
    ];
    return {
      pose: "ajakan",
      pesan: pickNonRepeating("parsial_kecil_pagi", kecilPagiSiangMsgs),
      isHolidayNoInput: false,
    };
  }

  const siangParsialMsgs = [
    "Hari ini tercatat " + totalPcsHariIni + " pcs. Tinggal " + sisa + " pcs lagi menuju target.",
    "Sudah " + totalPcsHariIni + " pcs masuk hari ini, semangat menyelesaikan target!",
    "Bagus! " + totalPcsHariIni + " pcs tercatat, selangkah lagi menuju target " + targetHarian + " pcs.",
  ];
  return {
    pose: "ajakan",
    pesan: pickNonRepeating("parsial_siang", siangParsialMsgs),
    isHolidayNoInput: false,
  };
}

/**
 * Pesan dan pose perayaan instan setelah penjahit berhasil mengirim entri baru
 */
export function determineSubmissionCelebration(params: {
  qtyBaru: number;
  totalSebelumnya: number;
  totalBaru: number;
  targetHarian: number;
  isFirstEntryToday: boolean;
}): {
  isFullCelebration: boolean;
  pose: MascotPose;
  headline: string;
  pesan: string;
} {
  const { qtyBaru, totalSebelumnya, totalBaru, targetHarian, isFirstEntryToday } = params;
  const melampauiThreshold = Math.round(targetHarian * MELAMPAUI_RASIO);

  const poseSebelumnya: MascotPose =
    totalSebelumnya >= melampauiThreshold
      ? "melampaui"
      : totalSebelumnya >= targetHarian
      ? "tercapai"
      : "ajakan";

  const poseBaru: MascotPose =
    totalBaru >= melampauiThreshold
      ? "melampaui"
      : totalBaru >= targetHarian
      ? "tercapai"
      : "ajakan";

  // Perayaan penuh muncul jika:
  // 1. Ini input pertama hari itu
  // 2. Atau terjadi kenaikan status pose (misal ajakan -> tercapai, atau tercapai -> melampaui)
  const isPoseUpgrade =
    (poseSebelumnya === "ajakan" && (poseBaru === "tercapai" || poseBaru === "melampaui")) ||
    (poseSebelumnya === "tercapai" && poseBaru === "melampaui");

  const isFullCelebration = isFirstEntryToday || isPoseUpgrade;

  let headline = "Catatan Berhasil Disimpan!";
  let pesan = `Terima kasih! ${qtyBaru} pcs berhasil dikirim.`;

  if (poseBaru === "melampaui") {
    headline = "Luar Biasa! Melampaui Target!";
    pesan = `Hebat! Tambahan ${qtyBaru} pcs membuat totalmu jadi ${totalBaru} pcs, melampaui target harian!`;
  } else if (poseBaru === "tercapai") {
    headline = "Target Harian Tercapai!";
    pesan = `Keren! Total jahitanmu hari ini mencapai ${totalBaru} pcs (${targetHarian} pcs target).`;
  } else if (totalBaru < Math.round(targetHarian * 0.3)) {
    headline = "Catatan Berhasil Masuk!";
    pesan = `Terima kasih atas ${qtyBaru} pcs hasil kerjamu. Setiap pcs sangat berarti!`;
  } else {
    const sisa = Math.max(0, targetHarian - totalBaru);
    headline = "Input Berhasil!";
    pesan = `Total hari ini jadi ${totalBaru} pcs. Tinggal ${sisa} pcs lagi menuju target harian.`;
  }

  return {
    isFullCelebration,
    pose: poseBaru,
    headline,
    pesan,
  };
}
