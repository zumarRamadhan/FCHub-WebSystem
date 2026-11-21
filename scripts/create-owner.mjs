#!/usr/bin/env node

/**
 * scripts/create-owner.mjs
 * Script administratif untuk membuat akun owner pertama di FCHub
 * menggunakan SUPABASE_SERVICE_ROLE_KEY (kunci rahasia server).
 *
 * Penggunaan:
 *   node scripts/create-owner.mjs "<Nama Lengkap>" "<username>" "<PIN 6 digit>"
 *
 * Contoh:
 *   node scripts/create-owner.mjs "Haji Firdaus" "owner" "123456"
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
  console.error("Pastikan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY sudah terisi dengan benar.");
  console.error("Contoh isi .env.local:");
  console.error("  NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co");
  console.error("  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...");
  console.error("  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...\n");
  process.exit(1);
}

// 2. Baca dan Validasi Argumen Baris Perintah
const args = process.argv.slice(2);
const [namaArg, usernameArg, pinArg] = args;

if (!namaArg || !usernameArg || !pinArg) {
  console.error("\n❌ Penggunaan argumen tidak lengkap!");
  console.error("Format : node scripts/create-owner.mjs \"<Nama Lengkap>\" \"<username>\" \"<PIN 6 digit>\"");
  console.error("Contoh : node scripts/create-owner.mjs \"Haji Firdaus\" \"owner\" \"123456\"\n");
  process.exit(1);
}

const nama = namaArg.trim();
const username = usernameArg.trim().toLowerCase();
const pin = pinArg.trim();

if (nama.length < 2) {
  console.error("❌ Nama minimal harus 2 karakter.");
  process.exit(1);
}

if (!/^[a-z0-9_-]{3,30}$/.test(username)) {
  console.error("❌ Username harus 3-30 karakter (huruf kecil, angka, tanda minus, atau garis bawah).");
  process.exit(1);
}

if (!/^\d{6}$/.test(pin)) {
  console.error("❌ PIN harus persis 6 digit angka numerik (contoh: 123456).");
  process.exit(1);
}

// 3. Inisialisasi Supabase Admin Client
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const internalEmail = `${username}@fchub.local`;

async function main() {
  console.log(`\n⏳ Memproses pembuatan akun owner: "${nama}" (${username})...`);

  try {
    // Cek apakah akun email sudah ada di auth.users
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      throw listError;
    }

    const existingAuthUser = userList.users.find(
      (u) => u.email?.toLowerCase() === internalEmail.toLowerCase()
    );

    let authUserId;

    if (existingAuthUser) {
      console.log(`ℹ️  Pengguna auth "${internalEmail}" sudah terdaftar. Memperbarui PIN dan profil...`);
      authUserId = existingAuthUser.id;

      // Update password / PIN
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        { password: pin, email_confirm: true }
      );
      if (updateAuthError) throw updateAuthError;
    } else {
      // Buat auth user baru
      const { data: createdAuth, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: internalEmail,
        password: pin,
        email_confirm: true,
        user_metadata: {
          nama,
          username,
          role: "owner",
        },
      });

      if (createAuthError || !createdAuth.user) {
        throw createAuthError || new Error("Gagal membuat pengguna di auth.users");
      }

      authUserId = createdAuth.user.id;
    }

    // Upsert profil di tabel public.users
    const { error: profileError } = await supabaseAdmin
      .from("users")
      .upsert({
        id: authUserId,
        nama,
        username,
        role: "owner",
        aktif: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    if (profileError) {
      throw profileError;
    }

    console.log("\n========================================================");
    console.log("✅ AKUN OWNER BERHASIL DIBUAT / DIPERBARUI!");
    console.log("========================================================");
    console.log(`  Nama Lengkap  : ${nama}`);
    console.log(`  Username      : ${username}`);
    console.log(`  Email Internal: ${internalEmail}`);
    console.log(`  PIN Masuk     : ${pin}`);
    console.log(`  Peran (Role)  : owner`);
    console.log(`  Status Akun   : aktif`);
    console.log("========================================================");
    console.log("Silakan gunakan username dan PIN di atas untuk login di:");
    console.log("👉 http://localhost:3000/login\n");

  } catch (err) {
    console.error("\n❌ Terjadi kesalahan saat membuat akun owner:");
    console.error(err.message || err);
    process.exit(1);
  }
}

main();
