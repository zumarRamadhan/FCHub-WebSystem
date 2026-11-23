/**
 * lib/image-compress.ts
 * Utilitas kompresi foto di sisi klien (browser Canvas).
 * Sesuai panduan Tahap 18B:
 * - Full resolution: maks 1600px sisi terpanjang, kualitas 0.82
 * - Thumbnail: maks 480px sisi terpanjang, kualitas 0.80
 * - Format: WebP (dengan fallback JPEG bila canvas.toBlob WebP tidak didukung)
 * - Validasi: ukuran asli <= 10MB, mime type image/jpeg, png, webp
 */

export interface CompressedImageResult {
  fullBlob: Blob;
  thumbBlob: Blob;
  mimeType: string;
  width: number;
  height: number;
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_RAW_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Membaca File dan mengompres ke format WebP / JPEG (full dan thumb)
 */
export async function compressClientImage(
  file: File,
  options?: {
    maxFullDimension?: number;
    maxThumbDimension?: number;
    fullQuality?: number;
    thumbQuality?: number;
  }
): Promise<CompressedImageResult> {
  if (typeof window === "undefined") {
    throw new Error("Kompresi gambar hanya dapat dilakukan di browser (klien).");
  }

  // Validasi tipe file
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error("Format foto tidak didukung. Harap pilih file JPG, PNG, atau WebP.");
  }

  // Validasi ukuran mentah
  if (file.size > MAX_RAW_SIZE_BYTES) {
    throw new Error("Ukuran foto asli terlalu besar (maksimal 10MB).");
  }

  const maxFull = options?.maxFullDimension || 1600;
  const maxThumb = options?.maxThumbDimension || 480;
  const qFull = options?.fullQuality || 0.82;
  const qThumb = options?.thumbQuality || 0.8;

  // Muat gambar ke HTMLImageElement
  const img = await loadImageFromFile(file);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  if (srcW <= 0 || srcH <= 0) {
    throw new Error("Dimensi gambar tidak valid atau gambar rusak.");
  }

  // 1. Kompres Full
  const { blob: fullBlob, mimeType: outputMime, width: outW, height: outH } =
    await resizeAndExport(img, srcW, srcH, maxFull, qFull);

  // 2. Kompres Thumbnail
  const { blob: thumbBlob } = await resizeAndExport(img, srcW, srcH, maxThumb, qThumb);

  return {
    fullBlob,
    thumbBlob,
    mimeType: outputMime,
    width: outW,
    height: outH,
  };
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Gagal membaca data file gambar."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Gagal membaca file dari perangkat."));
    reader.readAsDataURL(file);
  });
}

function resizeAndExport(
  img: HTMLImageElement,
  srcW: number,
  srcH: number,
  maxDimension: number,
  quality: number
): Promise<{ blob: Blob; mimeType: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    let targetW = srcW;
    let targetH = srcH;

    if (srcW > maxDimension || srcH > maxDimension) {
      if (srcW >= srcH) {
        targetW = maxDimension;
        targetH = Math.round((srcH * maxDimension) / srcW);
      } else {
        targetH = maxDimension;
        targetW = Math.round((srcW * maxDimension) / srcH);
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Browser tidak mendukung HTML Canvas 2D."));
      return;
    }

    // Gambar dengan smoothing berkualitas tinggi
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Coba ekspor WebP
    canvas.toBlob(
      (blob) => {
        if (blob && blob.size > 0) {
          resolve({
            blob,
            mimeType: "image/webp",
            width: targetW,
            height: targetH,
          });
        } else {
          // Fallback ke JPEG jika WebP gagal
          canvas.toBlob(
            (jpegBlob) => {
              if (jpegBlob && jpegBlob.size > 0) {
                resolve({
                  blob: jpegBlob,
                  mimeType: "image/jpeg",
                  width: targetW,
                  height: targetH,
                });
              } else {
                reject(new Error("Gagal mengompres gambar di kanvas browser."));
              }
            },
            "image/jpeg",
            quality
          );
        }
      },
      "image/webp",
      quality
    );
  });
}
