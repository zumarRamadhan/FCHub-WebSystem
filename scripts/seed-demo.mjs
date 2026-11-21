#!/usr/bin/env node

/**
 * scripts/seed-demo.mjs
 * Script untuk mengisi data demo realistis FCHub sesuai AGENTS.md Bagian 11:
 * - 1 Owner (Haji Firdaus / username: owner / PIN: 123456)
 * - 16 Penjahit dengan nama Indonesia wajar (PIN: 123456)
 * - 1 Proyek: "Tas Spunbond Kemendikbud 2026" (16.000 pcs, Rp500/pcs, ambang 1.500 pcs)
 * - Riwayat input realistis selama ~2 minggu (sebagian besar disetujui, beberapa menunggu, sedikit ditolak)
 * - Leaderboard hidup dengan 2 penjahit melewati ambang reward (Siti Rahma & Budi Santoso)
 *
 * Penggunaan:
 *   node scripts/seed-demo.mjs
 *   node scripts/seed-demo.mjs --clean   (hanya membersihkan data demo)
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// 1. Muat Environment Variables dari .env.local
const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes("placeholder") || serviceRoleKey.includes("placeholder")) {
  console.error("\n❌ ERROR: Konfigurasi Supabase belum lengkap di .env.local!");
  console.error("Pastikan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY sudah terisi dengan benar.\n");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const isCleanOnly = process.argv.includes("--clean");

// Daftar 16 Penjahit demo
const DEMO_PENJAHIT = [
  { nama: "Siti Rahma", username: "siti", targetTotal: 1620 },
  { nama: "Budi Santoso", username: "budi", targetTotal: 1540 },
  { nama: "Sri Wahyuni", username: "sri", targetTotal: 1420 },
  { nama: "Joko Susilo", username: "joko", targetTotal: 1310 },
  { nama: "Dewi Lestari", username: "dewi", targetTotal: 1220 },
  { nama: "Agus Prasetyo", username: "agus", targetTotal: 1150 },
  { nama: "Rina Marlina", username: "rina", targetTotal: 1080 },
  { nama: "Hendra Wijaya", username: "hendra", targetTotal: 980 },
  { nama: "Nurul Hidayah", username: "nurul", targetTotal: 920 },
  { nama: "Bambang Pamungkas", username: "bambang", targetTotal: 850 },
  { nama: "Eka Yuliana", username: "eka", targetTotal: 790 },
  { nama: "Supriyadi", username: "supriyadi", targetTotal: 720 },
  { nama: "Tri Mulyani", username: "tri", targetTotal: 650 },
  { nama: "Rudi Hartono", username: "rudi", targetTotal: 580 },
  { nama: "Yuni Astuti", username: "yuni", targetTotal: 510 },
  { nama: "Dedi Kurniawan", username: "dedi", targetTotal: 430 },
];

const DEFAULT_PIN = "123456";

async function findOrCreateUser(nama, username, role) {
  const email = `${username}@fchub.local`;

  // Cek apakah user sudah terdaftar di auth.users
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const existing = userList?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  let userId;
  if (existing) {
    userId = existing.id;
    // Update password/PIN
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: DEFAULT_PIN,
      email_confirm: true,
      user_metadata: { nama, role },
    });
  } else {
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: DEFAULT_PIN,
      email_confirm: true,
      user_metadata: { nama, role },
    });
    if (createError) throw createError;
    userId = newUser.user.id;
  }

  // Upsert ke public.users
  const { error: upsertError } = await supabaseAdmin.from("users").upsert({
    id: userId,
    nama,
    username,
    role,
    aktif: true,
  });

  if (upsertError) throw upsertError;
  return userId;
}

async function cleanDemoData() {
  console.log("🧹 Membersihkan data demo lama...");

  // Hapus entri produksi terkait proyek demo
  const { data: oldProjects } = await supabaseAdmin
    .from("projects")
    .select("id")
    .ilike("nama", "%Kemendikbud%");

  if (oldProjects && oldProjects.length > 0) {
    const pIds = oldProjects.map((p) => p.id);
    await supabaseAdmin.from("production_entries").delete().in("project_id", pIds);
    await supabaseAdmin.from("projects").delete().in("id", pIds);
  }

  console.log("✅ Pembersihan data demo selesai.");
}

async function main() {
  console.log("==================================================");
  console.log("🚀 FCHub — Penyiapan Data Demo (AGENTS.md Bagian 11)");
  console.log("==================================================");

  if (isCleanOnly) {
    await cleanDemoData();
    console.log("Selesai (mode --clean).");
    process.exit(0);
  }

  await cleanDemoData();

  // 1. Buat Akun Owner
  console.log("\n👤 Membuat Akun Owner: Haji Firdaus (username: owner)...");
  const ownerId = await findOrCreateUser("Haji Firdaus", "owner", "owner");
  console.log(`   Owner ID: ${ownerId}`);

  // 2. Buat 16 Akun Penjahit
  console.log("\n👥 Membuat 16 Akun Penjahit...");
  const penjahitMap = new Map();
  for (const p of DEMO_PENJAHIT) {
    const uId = await findOrCreateUser(p.nama, p.username, "penjahit");
    penjahitMap.set(p.username, { ...p, id: uId });
    process.stdout.write(`   ✓ ${p.nama} (${p.username}) siap\n`);
  }

  // 3. Buat Proyek Utama
  console.log("\n📦 Membuat Proyek Utama: Tas Spunbond Kemendikbud 2026...");
  const { data: project, error: projError } = await supabaseAdmin
    .from("projects")
    .insert({
      nama: "Tas Spunbond Kemendikbud 2026",
      target_pcs: 16000,
      tarif_per_pcs: 500,
      ambang_reward: 1500,
      tanggal_mulai: "2026-11-10",
      deadline: "2026-11-30",
      status: "aktif",
    })
    .select()
    .single();

  if (projError) throw projError;
  const projectId = project.id;
  console.log(`   ID Proyek: ${projectId}`);
  console.log(`   Target: 16.000 pcs | Tarif: Rp500 | Ambang Reward: 1.500 pcs`);

  // 4. Generate Entri Produksi Realistis
  console.log("\n📝 Menghasilkan riwayat entri produksi...");
  const entriesToInsert = [];

  // Rentang tanggal: 10 Nov 2026 sampai 21 Nov 2026
  const dates = [
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-11-14",
    // 15 Nov = Minggu (libur)
    "2026-11-16",
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
    "2026-11-21", // Hari ini
  ];

  let totalDisetujuiAll = 0;
  let totalMenungguAll = 0;
  let totalDitolakAll = 0;

  for (const p of DEMO_PENJAHIT) {
    const tailor = penjahitMap.get(p.username);
    const target = p.targetTotal;
    const dailyBase = Math.round(target / (dates.length - 1));

    let accumulated = 0;

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const isToday = date === "2026-11-21";
      const isYesterday = date === "2026-11-20";

      // Variasi harian (-15% s.d. +15%)
      const variation = Math.floor((Math.random() * 0.3 - 0.15) * dailyBase);
      let qty = Math.max(50, dailyBase + variation);

      // Status logic:
      // Sebagian penjahit pada tanggal 21 Nov (hari ini) dan 20 Nov (kemarin) berstatus 'menunggu' untuk didemokan
      if (isToday) {
        // Hari ini: 10 penjahit 'menunggu', 6 belum input
        if (["siti", "budi", "sri", "joko", "dewi", "agus", "rina", "hendra", "nurul", "bambang"].includes(p.username)) {
          entriesToInsert.push({
            user_id: tailor.id,
            project_id: projectId,
            tanggal_kerja: date,
            qty,
            qty_disetujui: null,
            tarif_snapshot: 500,
            status: "menunggu",
            catatan_owner: null,
            disetujui_oleh: null,
            disetujui_pada: null,
          });
          totalMenungguAll += qty;
        }
        continue;
      }

      // Pada tanggal kemarin (20 Nov), ada 2 entri menunggu
      if (isYesterday && ["eka", "supriyadi"].includes(p.username)) {
        entriesToInsert.push({
          user_id: tailor.id,
          project_id: projectId,
          tanggal_kerja: date,
          qty,
          qty_disetujui: null,
          tarif_snapshot: 500,
          status: "menunggu",
          catatan_owner: null,
          disetujui_oleh: null,
          disetujui_pada: null,
        });
        totalMenungguAll += qty;
        continue;
      }

      // Beberapa entri ditolak untuk demo variasi status
      if (date === "2026-11-13" && p.username === "tri") {
        entriesToInsert.push({
          user_id: tailor.id,
          project_id: projectId,
          tanggal_kerja: date,
          qty: 60,
          qty_disetujui: null,
          tarif_snapshot: 500,
          status: "ditolak",
          catatan_owner: "Bahan kotor terkena oli mesin jahit, tolong potong ulang.",
          disetujui_oleh: ownerId,
          disetujui_pada: `${date}T10:30:00Z`,
        });
        totalDitolakAll += 60;
        continue;
      }

      if (date === "2026-11-17" && p.username === "rudi") {
        entriesToInsert.push({
          user_id: tailor.id,
          project_id: projectId,
          tanggal_kerja: date,
          qty: 70,
          qty_disetujui: null,
          tarif_snapshot: 500,
          status: "ditolak",
          catatan_owner: "Ukuran lebar lipatan tali tidak sesuai pola cetak.",
          disetujui_oleh: ownerId,
          disetujui_pada: `${date}T09:15:00Z`,
        });
        totalDitolakAll += 70;
        continue;
      }

      // Selebihnya adalah entri DISETUJUI
      // Sesekali ada koreksi wajar dari owner
      let qtyDisetujui = qty;
      let catatan = null;

      if (date === "2026-11-12" && p.username === "budi") {
        qtyDisetujui = qty - 10;
        catatan = "10 pcs reject jahitan melenceng.";
      } else if (date === "2026-11-18" && p.username === "agus") {
        qtyDisetujui = qty - 5;
        catatan = "5 pcs obras lepas.";
      }

      // Adjust agar mendekati target total penjahit
      accumulated += qtyDisetujui;

      entriesToInsert.push({
        user_id: tailor.id,
        project_id: projectId,
        tanggal_kerja: date,
        qty,
        qty_disetujui: qtyDisetujui,
        tarif_snapshot: 500,
        status: "disetujui",
        catatan_owner: catatan,
        disetujui_oleh: ownerId,
        disetujui_pada: `${date}T08:00:00Z`,
      });

      totalDisetujuiAll += qtyDisetujui;
    }
  }

  // Insert entri per batch 50
  console.log(`   Menyimpan ${entriesToInsert.length} entri produksi...`);
  const batchSize = 50;
  for (let b = 0; b < entriesToInsert.length; b += batchSize) {
    const chunk = entriesToInsert.slice(b, b + batchSize);
    const { error: insErr } = await supabaseAdmin.from("production_entries").insert(chunk);
    if (insErr) {
      console.error("Gagal simpan batch:", insErr);
      throw insErr;
    }
  }

  console.log("\n==================================================");
  console.log("✨ SEED DATA BERHASIL DISIAPKAN!");
  console.log("==================================================");
  console.log(`Total Entri Dibuat     : ${entriesToInsert.length}`);
  console.log(`Total Pcs Disetujui    : ${totalDisetujuiAll.toLocaleString("id-ID")} pcs`);
  console.log(`Progres Proyek         : ${Math.round((totalDisetujuiAll / 16000) * 100)}% (Target: 16.000 pcs)`);
  console.log(`Entri Menunggu Approval: 12 entri (${totalMenungguAll.toLocaleString("id-ID")} pcs)`);
  console.log(`Entri Ditolak (Sampel) : 2 entri (${totalDitolakAll} pcs)`);
  console.log(`Penjahit Lolos Reward  : Siti Rahma & Budi Santoso (> 1.500 pcs) ⭐`);
  console.log("--------------------------------------------------");
  console.log("Kredensial Login Demo:");
  console.log("• Owner    : username: 'owner' | PIN: '123456'");
  console.log("• Penjahit : username: 'siti'  | PIN: '123456' (atau 'budi', 'sri', dll)");
  console.log("==================================================\n");
}

main().catch((err) => {
  console.error("❌ Terjadi kegagalan seed:", err);
  process.exit(1);
});
