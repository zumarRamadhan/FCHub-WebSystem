"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerSession } from "@/lib/auth-server";
import { formatInternalEmail } from "@/lib/auth";
import {
  createPenjahitSchema,
  resetPinSchema,
  CreatePenjahitInput,
  ResetPinInput,
} from "@/lib/validations/owner";

/**
 * Membuat akun penjahit baru menggunakan service_role di server:
 * 1. Mendaftarkan user ke auth.users (email internal + PIN sebagai password)
 * 2. Menyimpan data profil di public.users dengan role 'penjahit'
 */
export async function createPenjahitAction(data: CreatePenjahitInput) {
  try {
    await requireOwnerSession();

    const parsed = createPenjahitSchema.parse(data);
    const internalEmail = formatInternalEmail(parsed.username);

    const supabase = createClient();

    // 1. Cek apakah username sudah dipakai di public.users
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("username", parsed.username)
      .maybeSingle();

    if (existingUser) {
      return { success: false, error: `Username "${parsed.username}" sudah digunakan.` };
    }

    // 2. Buat user di auth.users dengan Supabase Admin Client (Service Role)
    const supabaseAdmin = createAdminClient();
    const { data: createdAuth, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: parsed.pin,
      email_confirm: true,
      user_metadata: {
        nama: parsed.nama,
        username: parsed.username,
        role: "penjahit",
      },
    });

    if (authError || !createdAuth.user) {
      return {
        success: false,
        error: authError?.message || "Gagal membuat kredensial akun penjahit di auth.",
      };
    }

    // 3. Masukkan ke tabel public.users
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from("users")
      .insert({
        id: createdAuth.user.id,
        nama: parsed.nama,
        username: parsed.username,
        role: "penjahit",
        aktif: true,
      })
      .select()
      .single();

    if (profileError) {
      // Rollback auth user jika insert profile gagal
      await supabaseAdmin.auth.admin.deleteUser(createdAuth.user.id);
      return { success: false, error: "Gagal menyimpan data profil penjahit." };
    }

    revalidatePath("/owner/penjahit");
    return { success: true, data: userProfile };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menambahkan penjahit.";
    return { success: false, error: message };
  }
}

/**
 * Reset PIN penjahit oleh owner menggunakan service_role di server
 */
export async function resetPenjahitPinAction(data: ResetPinInput) {
  try {
    await requireOwnerSession();

    const parsed = resetPinSchema.parse(data);

    const supabaseAdmin = createAdminClient();
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      parsed.userId,
      {
        password: parsed.newPin,
        email_confirm: true,
      }
    );

    if (updateError) {
      return { success: false, error: "Gagal mereset PIN penjahit: " + updateError.message };
    }

    revalidatePath("/owner/penjahit");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mereset PIN.";
    return { success: false, error: message };
  }
}

/**
 * Mengubah status aktif/nonaktif penjahit tanpa menghapus data historisnya
 */
export async function togglePenjahitStatusAction(userId: string, newStatus: boolean) {
  try {
    await requireOwnerSession();

    if (!userId) {
      return { success: false, error: "ID penjahit tidak valid." };
    }

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("users")
      .update({
        aktif: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      return { success: false, error: "Gagal mengubah status penjahit: " + updateError.message };
    }

    revalidatePath("/owner/penjahit");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui status.";
    return { success: false, error: message };
  }
}
