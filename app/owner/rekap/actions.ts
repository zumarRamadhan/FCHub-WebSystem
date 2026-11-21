"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerSession } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";

function revalidateWagePaths() {
  revalidatePath("/owner/rekap");
  revalidatePath("/owner/dashboard");
  revalidatePath("/owner/approval");
  revalidatePath("/owner/penjahit");
  revalidatePath("/penjahit/beranda");
  revalidatePath("/penjahit/riwayat");
}

/**
 * 1. Menandai Sisa Upah Penjahit Dibayar Tunai
 * Aturan Bisnis #14: Membayar sisa upah secara atomik dengan advisory lock.
 */
export async function markWagePaidAction(params: {
  userId: string;
  weekStartDate: string;
  catatan?: string;
}) {
  try {
    await requireOwnerSession();
    const supabase = createClient();

    const { data, error } = await supabase.rpc("mark_wage_paid", {
      p_user_id: params.userId,
      p_periode_mulai: params.weekStartDate,
      p_catatan: params.catatan || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateWagePaths();
    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menandai pembayaran upah.";
    return { success: false, error: message };
  }
}

/**
 * 2. Menandai Semua Penjahit yang Memiliki Sisa Upah Dibayar
 */
export async function markAllWagesPaidAction(params: {
  weekStartDate: string;
  items: Array<{ userId: string; sisa: number }>;
}) {
  try {
    await requireOwnerSession();
    const supabase = createClient();
    let successCount = 0;
    const errors: string[] = [];

    for (const item of params.items) {
      if (item.sisa <= 0) continue;

      const { error } = await supabase.rpc("mark_wage_paid", {
        p_user_id: item.userId,
        p_periode_mulai: params.weekStartDate,
        p_catatan: "Tandai lunas massal",
      });

      if (error) {
        errors.push(error.message);
      } else {
        successCount++;
      }
    }

    revalidateWagePaths();
    return {
      success: successCount > 0,
      count: successCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menandai seluruh pembayaran.";
    return { success: false, error: message };
  }
}

/**
 * 3. Membatalkan Catatan Pembayaran Upah
 * Aturan Bisnis #11: Alasan wajib diisi, catatan tidak dihapus melainkan berstatus 'dibatalkan'.
 */
export async function cancelWagePaymentAction(params: {
  paymentId: string;
  alasan: string;
}) {
  try {
    await requireOwnerSession();

    const cleanAlasan = params.alasan ? params.alasan.trim() : "";
    if (cleanAlasan.length === 0) {
      return { success: false, error: "Alasan pembatalan pembayaran wajib diisi." };
    }

    const supabase = createClient();

    const { data, error } = await supabase.rpc("cancel_wage_payment", {
      p_payment_id: params.paymentId,
      p_alasan: cleanAlasan,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateWagePaths();
    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal membatalkan catatan pembayaran.";
    return { success: false, error: message };
  }
}
