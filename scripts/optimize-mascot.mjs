import fs from "fs";
import path from "path";
import sharp from "sharp";

const inputDir = path.resolve("design-assets/mascot");
const outputDir = path.resolve("public/mascot");

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const targets = [
  "pose-target-harian",
  "pose-target-tercapai",
  "pose-melampaui-target",
  "pose-beristirahat",
  "pose-gagal-terkirim",
  "pose-belum-capaitarget",
];

async function optimize() {
  console.log("Memulai optimasi gambar maskot ke WebP...");
  for (const name of targets) {
    const inputPath = path.join(inputDir, `${name}.png`);
    const outputPath = path.join(outputDir, `${name}.webp`);

    if (!fs.existsSync(inputPath)) {
      console.warn(`File input tidak ditemukan: ${inputPath}`);
      continue;
    }

    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // Resize jika lebar > 480px, pertahankan aspek rasio
    let pipeline = image;
    if (metadata.width && metadata.width > 480) {
      pipeline = pipeline.resize({ width: 480, withoutEnlargement: true });
    }

    // Konversi ke WebP dengan alpha transparan dan kualitas 85
    await pipeline
      .webp({ quality: 85, alphaQuality: 90, lossless: false })
      .toFile(outputPath);

    const stats = fs.statSync(outputPath);
    const sizeKb = (stats.size / 1024).toFixed(2);
    console.log(`✓ ${name}.webp: ${sizeKb} KB (Target <= 80 KB)`);
  }
  console.log("Optimasi selesai!");
}

optimize().catch((err) => {
  console.error("Gagal optimasi maskot:", err);
  process.exit(1);
});
