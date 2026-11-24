"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePenjahitSession } from "@/lib/auth-server";
import { getTailorGreetingContextServer } from "@/lib/messages-server";
import {
  createEntrySchema,
  updateEntrySchema,
  CreateEntryInput,
  UpdateEntryInput,
} from "@/lib/validations/penjahit";

/**
 * Mengirim entri hasil kerja harian penjahit.
 * Aturan Bisnis AGENTS.md:
 * - status, tarif_snapshot, dan user_id TIDAK dikirim dari klien.
 * - Server database otomatis mengisi tarif_snapshot dan memaksakan status 'menunggu'.
 */
export async function createEntryAction(data: CreateEntryInput) {
  try {
    const session = await requirePenjahitSession();

    const parsed = createEntrySchema.parse(data);
    const supabase = createClient();

    // Pastikan proyek aktif
    const { data: project, error: projError } = await supabase
      .from("projects")
      .select("id, status")
      .eq("id", parsed.project_id)
      .single();

    if (projError || !project) {
      return { success: false, error: "Proyek tidak ditemukan." };
    }

    if (project.status !== "aktif") {
      return { success: false, error: "Tidak dapat menginput pada proyek yang sudah tidak aktif." };
    }

    // 2. Cegah input ganda saat "Coba lagi":
    // Periksa apakah ada entri dengan penjahit, proyek, tanggal kerja, dan jumlah yang sama
    // yang dibuat dalam 2 menit terakhir dan bukan berstatus 'ditolak'
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: duplicateEntry } = await supabase
      .from("production_entries")
      .select("id")
      .eq("user_id", session.id)
      .eq("project_id", parsed.project_id)
      .eq("tanggal_kerja", parsed.tanggal_kerja)
      .eq("qty", parsed.qty)
      .neq("status", "ditolak")
      .gte("dibuat_pada", twoMinutesAgo)
      .limit(1)
      .maybeSingle();

    if (duplicateEntry) {
      return {
        success: false,
        alreadyRecorded: true,
        error: "Sepertinya input ini sudah tercatat",
      };
    }

    // Insert ke tabel production_entries.
    // Trigger database 'trg_production_entries_before_insert' akan:
    // 1. Mengisi tarif_snapshot dari projects.tarif_per_pcs
    // 2. Memaksa status = 'menunggu'
    // 3. Mengisi user_id = auth.uid()
    const { data: inserted, error: insertError } = await supabase
      .from("production_entries")
      .insert({
        project_id: parsed.project_id,
        tanggal_kerja: parsed.tanggal_kerja,
        qty: parsed.qty,
        user_id: session.id, // Sesuai RLS
      })
      .select()
      .single();

    if (insertError) {
      return { success: false, error: insertError.message || "Gagal menyimpan entri produksi." };
    }

    revalidatePath("/penjahit/beranda");
    revalidatePath("/penjahit/riwayat");
    revalidatePath("/penjahit/input");
    revalidatePath("/owner/dashboard");
    revalidatePath("/owner/approval");

    return { success: true, data: inserted };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengirim hasil kerja.";
    return { success: false, error: message };
  }
}

/**
 * Memperbarui entri produksi (HANYA diperbolehkan saat status 'menunggu').
 * Aturan Bisnis #7: Penjahit hanya boleh mengubah entri sendiri selama 'menunggu'.
 */
export async function updateEntryAction(data: UpdateEntryInput) {
  try {
    const session = await requirePenjahitSession();

    const parsed = updateEntrySchema.parse(data);
    const supabase = createClient();

    // Update hanya boleh jika user_id sesuai dan status masih 'menunggu'
    const { data: updated, error } = await supabase
      .from("production_entries")
      .update({
        qty: parsed.qty,
        tanggal_kerja: parsed.tanggal_kerja,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.id)
      .eq("user_id", session.id)
      .eq("status", "menunggu")
      .select();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!updated || updated.length === 0) {
      return {
        success: false,
        error: "Entri tidak dapat diubah (sudah disetujui, ditolak, atau tidak ditemukan).",
      };
    }

    revalidatePath("/penjahit/beranda");
    revalidatePath("/penjahit/riwayat");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui entri.";
    return { success: false, error: message };
  }
}

/**
 * Menghapus entri produksi (HANYA diperbolehkan saat status 'menunggu').
 * Aturan Bisnis #7: Penjahit hanya boleh menghapus entri sendiri selama 'menunggu'.
 */
export async function deleteEntryAction(id: string) {
  try {
    const session = await requirePenjahitSession();

    if (!id) {
      return { success: false, error: "ID entri tidak valid." };
    }

    const supabase = createClient();

    const { data: deleted, error } = await supabase
      .from("production_entries")
      .delete()
      .eq("id", id)
      .eq("user_id", session.id)
      .eq("status", "menunggu")
      .select();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!deleted || deleted.length === 0) {
      return {
        success: false,
        error: "Entri tidak dapat dihapus (sudah disetujui, ditolak, atau tidak ditemukan).",
      };
    }

    revalidatePath("/penjahit/beranda");
    revalidatePath("/penjahit/riwayat");
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus entri.";
    return { success: false, error: message };
  }
}

/**
 * Mengambil konteks sapaan dan status maskot penjahit untuk tanggal tertentu
 */
export async function getGreetingContextAction(tanggalKerja?: string) {
  try {
    const session = await requirePenjahitSession();
    const ctx = await getTailorGreetingContextServer(session.id, tanggalKerja);
    return { success: true, data: ctx };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat konteks sapaan.";
    return { success: false, error: message };
  }
}
