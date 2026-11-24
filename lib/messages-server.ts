import { createClient } from "@/lib/supabase/server";
import { getJakartaTodayString } from "@/lib/format";
import { DEFAULT_TARGET_HARIAN } from "@/lib/config";
import { TailorGreetingContext } from "@/lib/messages";

/**
 * Mengambil konteks lengkap sapaan penjahit dari database (Server-side)
 * Sesuai aturan:
 * - Total tercatat hari itu = jumlah qty entri milik penjahit itu pada tanggal kerja
 *   yang dipilih dengan status bukan 'ditolak' (disetujui + menunggu).
 * - Target harian diambil dari app_settings (key: target_harian).
 * - Status hari libur diambil dari fungsi SQL is_hari_kerja (bukan dihitung di klien).
 * - Rekor pribadi dihitung jika penjahit memiliki riwayat kerja minimal 5 hari berbeda.
 */
export async function getTailorGreetingContextServer(
  userId: string,
  tanggalKerja?: string
): Promise<TailorGreetingContext> {
  const supabase = createClient();
  const todayStr = getJakartaTodayString();
  const activeDate = tanggalKerja || todayStr;

  // 1. Ambil nama penjahit dari tabel users
  const { data: userProfile } = await supabase
    .from("users")
    .select("nama")
    .eq("id", userId)
    .maybeSingle();

  const nama = userProfile?.nama || "Penjahit";

  // 2. Ambil target harian dari app_settings (fallback ke DEFAULT_TARGET_HARIAN)
  let targetHarian = DEFAULT_TARGET_HARIAN;
  try {
    const { data: settingRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "target_harian")
      .maybeSingle();

    if (settingRow?.value !== undefined && settingRow?.value !== null) {
      const parsed = Number(settingRow.value);
      if (!isNaN(parsed) && parsed > 0) {
        targetHarian = parsed;
      }
    }
  } catch {
    targetHarian = DEFAULT_TARGET_HARIAN;
  }

  // 3. Status hari kerja / libur dari fungsi SQL is_hari_kerja
  let isHariKerja = true;
  try {
    const { data: isWorkRpc, error: rpcErr } = await supabase.rpc("is_hari_kerja", {
      p_tanggal: activeDate,
    });
    if (!rpcErr && typeof isWorkRpc === "boolean") {
      isHariKerja = isWorkRpc;
    }
  } catch {
    // Default fallback: Senin-Sabtu hari kerja
    const day = new Date(activeDate).getDay();
    isHariKerja = day !== 0; // bukan hari Minggu
  }

  // 4. Query entri penjahit pada tanggal kerja yang dipilih (status bukan 'ditolak')
  const { data: dateEntries } = await supabase
    .from("production_entries")
    .select("qty, qty_disetujui, status")
    .eq("user_id", userId)
    .eq("tanggal_kerja", activeDate)
    .neq("status", "ditolak");

  let totalPcsHariIni = 0;
  (dateEntries || []).forEach((e) => {
    if (e.status === "disetujui") {
      totalPcsHariIni += Number(e.qty_disetujui || 0);
    } else {
      totalPcsHariIni += Number(e.qty || 0);
    }
  });

  // 5. Cek Rekor Pribadi (Hanya jika riwayat kerja minimal 5 hari berbeda sebelumnya)
  let isNewPersonalRecord = false;
  try {
    const { data: historyEntries } = await supabase
      .from("production_entries")
      .select("tanggal_kerja, qty, qty_disetujui, status")
      .eq("user_id", userId)
      .neq("status", "ditolak")
      .neq("tanggal_kerja", activeDate);

    if (historyEntries && historyEntries.length > 0) {
      const dayTotals: Record<string, number> = {};
      historyEntries.forEach((h) => {
        const val = h.status === "disetujui" ? Number(h.qty_disetujui || 0) : Number(h.qty || 0);
        dayTotals[h.tanggal_kerja] = (dayTotals[h.tanggal_kerja] || 0) + val;
      });

      const uniqueDays = Object.keys(dayTotals);
      if (uniqueDays.length >= 5) {
        const previousMax = Math.max(...Object.values(dayTotals));
        if (totalPcsHariIni > previousMax && totalPcsHariIni > targetHarian) {
          isNewPersonalRecord = true;
        }
      }
    }
  } catch {
    // Abaikan jika kalkulasi rekor gagal
  }

  // 6. Cek Reward Proyek Aktif Terdekat
  let rewardContext: TailorGreetingContext["rewardContext"] = undefined;
  try {
    const { data: rewardProjects } = await supabase
      .from("projects")
      .select("id, nama, ambang_reward")
      .eq("status", "aktif")
      .eq("reward_aktif", true)
      .limit(1);

    if (rewardProjects && rewardProjects.length > 0) {
      const prj = rewardProjects[0];
      const { data: pEntries } = await supabase
        .from("production_entries")
        .select("qty_disetujui")
        .eq("user_id", userId)
        .eq("project_id", prj.id)
        .eq("status", "disetujui");

      const pcsDisetujui = (pEntries || []).reduce(
        (sum, e) => sum + Number(e.qty_disetujui || 0),
        0
      );
      const ambang = Number(prj.ambang_reward || 0);
      const sisa = Math.max(0, ambang - pcsDisetujui);

      rewardContext = {
        namaProyek: prj.nama,
        pcsDisetujui,
        ambangReward: ambang,
        isQualified: ambang > 0 && pcsDisetujui >= ambang,
        sisaPcs: sisa,
      };
    }
  } catch {
    // Abaikan
  }

  return {
    nama,
    tanggalKerja: activeDate,
    todayStr,
    isHariKerja,
    totalPcsHariIni,
    targetHarian,
    isNewPersonalRecord,
    rewardContext,
  };
}
