"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerSession } from "@/lib/auth-server";
import { createClient } from "@/lib/supabase/server";
import { getTodayJakarta } from "@/lib/dates";

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

/**
 * 4. Mendapatkan Rentang Tanggal Data Upah yang Tersedia
 */
export async function getWagePeriodOptionsAction() {
  try {
    await requireOwnerSession();
    const supabase = createClient();

    const { data, error } = await supabase.rpc("get_wage_period_options");
    if (!error && data && data.length > 0) {
      return {
        success: true,
        data: {
          minDate: data[0].min_date as string,
          maxDate: data[0].max_date as string,
        },
      };
    }

    // Fallback bila RPC belum dieksekusi di database
    const { data: entries } = await supabase
      .from("production_entries")
      .select("tanggal_kerja")
      .eq("status", "disetujui")
      .order("tanggal_kerja", { ascending: true })
      .limit(1);

    const { data: entriesDesc } = await supabase
      .from("production_entries")
      .select("tanggal_kerja")
      .eq("status", "disetujui")
      .order("tanggal_kerja", { ascending: false })
      .limit(1);

    const today = getTodayJakarta();
    return {
      success: true,
      data: {
        minDate: entries?.[0]?.tanggal_kerja || today,
        maxDate: entriesDesc?.[0]?.tanggal_kerja || today,
      },
    };
  } catch {
    const today = getTodayJakarta();
    return {
      success: true,
      data: { minDate: today, maxDate: today },
    };
  }
}

/**
 * 5. Mendapatkan Laporan Pengeluaran Upah Periode Bebas (Bulan s.d. Tahun)
 */
export async function getWageReportAction(params: {
  mulai: string;
  selesai: string;
  projectId?: string;
}) {
  try {
    await requireOwnerSession();
    const supabase = createClient();

    const cleanProject =
      params.projectId && params.projectId !== "all" ? params.projectId : null;

    const { data, error } = await supabase.rpc("get_wage_report", {
      p_mulai: params.mulai,
      p_selesai: params.selesai,
      p_project: cleanProject,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal memuat laporan pengeluaran upah.";
    return { success: false, error: message };
  }
}

/**
 * 6. Mengambil Batas Awal (Senin) dan Akhir (Minggu) dari Database Postgres
 * Sesuai Aturan #3: Batas awal dan akhir minggu dihitung di database via get_week_start & get_week_end.
 */
export async function getWeekRangeFromDbAction(targetDate: string): Promise<{
  success: boolean;
  startDate: string;
  endDate: string;
}> {
  try {
    await requireOwnerSession();
    const supabase = createClient();
    const [{ data: startDate }, { data: endDate }] = await Promise.all([
      supabase.rpc("get_week_start", { p_date: targetDate }),
      supabase.rpc("get_week_end", { p_date: targetDate }),
    ]);

    if (!startDate || !endDate) {
      return { success: false, startDate: targetDate, endDate: targetDate };
    }

    return {
      success: true,
      startDate: String(startDate),
      endDate: String(endDate),
    };
  } catch {
    return { success: false, startDate: targetDate, endDate: targetDate };
  }
}
