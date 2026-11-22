"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerSession } from "@/lib/auth-server";

/**
 * Menyimpan atau memperbarui hari libur/kerja khusus di work_calendar
 */
export async function setCalendarExceptionAction(data: {
  tanggal: string; // YYYY-MM-DD
  jenis: "libur" | "kerja";
  keterangan?: string;
}) {
  try {
    const user = await requireOwnerSession();
    const supabase = createClient();

    const { error } = await supabase.from("work_calendar").upsert({
      tanggal: data.tanggal,
      jenis: data.jenis,
      keterangan: data.keterangan?.trim() || null,
      dibuat_oleh: user.id,
      dibuat_pada: new Date().toISOString(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/owner/kalender");
    revalidatePath("/owner/dashboard");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal mengubah status kalender.";
    return { success: false, error: msg };
  }
}

/**
 * Menghapus hari libur/kerja khusus dari work_calendar (kembali ke pola mingguan rutin)
 */
export async function deleteCalendarExceptionAction(tanggal: string) {
  try {
    await requireOwnerSession();
    const supabase = createClient();

    const { error } = await supabase
      .from("work_calendar")
      .delete()
      .eq("tanggal", tanggal);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/owner/kalender");
    revalidatePath("/owner/dashboard");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal mereset status kalender.";
    return { success: false, error: msg };
  }
}

/**
 * Memperbarui pola hari kerja mingguan di app_settings (key: 'hari_kerja')
 * Pola berupa array angka ISO (1 = Senin s.d. 7 = Minggu)
 */
export async function updateWeeklyPatternAction(pattern: number[]) {
  try {
    await requireOwnerSession();
    const supabase = createClient();

    // Validasi pola minimal ada 1 hari kerja dan angka antara 1-7
    const validPattern = Array.from(new Set(pattern))
      .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
      .sort((a, b) => a - b);

    if (validPattern.length === 0) {
      return { success: false, error: "Pola kerja harus memiliki minimal 1 hari kerja per minggu." };
    }

    const { error } = await supabase
      .from("app_settings")
      .upsert({
        key: "hari_kerja",
        value: validPattern,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/owner/kalender");
    revalidatePath("/owner/dashboard");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal memperbarui pola kerja mingguan.";
    return { success: false, error: msg };
  }
}
