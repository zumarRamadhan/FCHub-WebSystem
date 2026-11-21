"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerSession } from "@/lib/auth-server";
import {
  rejectEntrySchema,
  correctEntrySchema,
  RejectEntryInput,
  CorrectEntryInput,
} from "@/lib/validations/approval";

function revalidateAllRelatedPaths() {
  revalidatePath("/owner/approval");
  revalidatePath("/owner/dashboard");
  revalidatePath("/owner/rekap");
  revalidatePath("/owner/proyek");
  revalidatePath("/penjahit/beranda");
  revalidatePath("/penjahit/riwayat");
  revalidatePath("/penjahit/leaderboard");
}

/**
 * 1. Setujui Entri Langsung (qty_disetujui = qty asli)
 * Dilindungi terhadap double-click via kondisi status = 'menunggu'.
 */
export async function approveEntryAction(id: string) {
  try {
    const owner = await requireOwnerSession();
    const supabase = createClient();

    // Ambil qty asli entri untuk disalin ke qty_disetujui
    const { data: entry, error: fetchError } = await supabase
      .from("production_entries")
      .select("id, qty, status")
      .eq("id", id)
      .eq("status", "menunggu")
      .single();

    if (fetchError || !entry) {
      return { success: false, error: "Entri tidak ditemukan atau sudah diverifikasi." };
    }

    const { error: updateError } = await supabase
      .from("production_entries")
      .update({
        status: "disetujui",
        qty_disetujui: entry.qty,
        disetujui_oleh: owner.id,
        disetujui_pada: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "menunggu");

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidateAllRelatedPaths();
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menyetujui entri.";
    return { success: false, error: message };
  }
}

/**
 * 2. Tolak Entri dengan Catatan Wajib
 * Aturan Bisnis #5: Input ditolak tidak dihitung, penjahit membuat entri baru.
 */
export async function rejectEntryAction(data: RejectEntryInput) {
  try {
    const owner = await requireOwnerSession();
    const parsed = rejectEntrySchema.parse(data);
    const supabase = createClient();

    const { error } = await supabase
      .from("production_entries")
      .update({
        status: "ditolak",
        qty_disetujui: null,
        catatan_owner: parsed.catatan,
        disetujui_oleh: owner.id,
        disetujui_pada: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.id)
      .eq("status", "menunggu");

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateAllRelatedPaths();
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menolak entri.";
    return { success: false, error: message };
  }
}

/**
 * 3. Koreksi Jumlah dan Setujui
 * Aturan Bisnis #4: Qty asli penjahit TIDAK BOLEH ditimpa.
 * Nilai koreksi disimpan di kolom qty_disetujui.
 */
export async function correctAndApproveEntryAction(data: CorrectEntryInput) {
  try {
    const owner = await requireOwnerSession();
    const parsed = correctEntrySchema.parse(data);
    const supabase = createClient();

    // Trigger database 'trg_production_entries_before_update' akan memastikan
    // NEW.qty := OLD.qty sehingga qty asli penjahit tetap aman.
    const { error } = await supabase
      .from("production_entries")
      .update({
        status: "disetujui",
        qty_disetujui: parsed.qty_disetujui,
        catatan_owner: parsed.catatan || null,
        disetujui_oleh: owner.id,
        disetujui_pada: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.id)
      .eq("status", "menunggu");

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateAllRelatedPaths();
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengoreksi entri.";
    return { success: false, error: message };
  }
}

/**
 * 4. Setujui Semua Entri pada Daftar
 * Memproses sekaligus seluruh entri yang dipilih dengan status 'menunggu'.
 */
export async function approveAllEntriesAction(entryIds: string[]) {
  try {
    const owner = await requireOwnerSession();

    if (!entryIds || entryIds.length === 0) {
      return { success: false, error: "Tidak ada entri yang dipilih." };
    }

    const supabase = createClient();

    // Ambil data entri yang berstatus 'menunggu'
    const { data: entries, error: fetchError } = await supabase
      .from("production_entries")
      .select("id, qty")
      .in("id", entryIds)
      .eq("status", "menunggu");

    if (fetchError || !entries || entries.length === 0) {
      return { success: false, error: "Tidak ada entri yang menunggu persetujuan." };
    }

    // Update setiap entri (qty_disetujui = qty asli)
    // Bisa dilakukan per batch
    for (const item of entries) {
      await supabase
        .from("production_entries")
        .update({
          status: "disetujui",
          qty_disetujui: item.qty,
          disetujui_oleh: owner.id,
          disetujui_pada: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("status", "menunggu");
    }

    revalidateAllRelatedPaths();
    return { success: true, count: entries.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menyetujui semua entri.";
    return { success: false, error: message };
  }
}
