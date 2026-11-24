import { createClient } from "@/lib/supabase/server";
import { BerandaClient } from "./beranda-client";
import { getWeekDateRange, calculateEntryWage } from "@/lib/wage";
import { getJakartaTodayString } from "@/lib/format";
import { getTailorGreetingContextServer } from "@/lib/messages-server";

export default async function PenjahitBerandaPage() {
  const supabase = createClient();
  const todayStr = getJakartaTodayString();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <BerandaClient
        pcsDisetujuiMingguIni={0}
        upahMingguIni={0}
        pcsHariIni={0}
        targetHariIni={100}
        paymentInfo={{ isPaid: false }}
        recentEntries={[]}
      />
    );
  }

  // 1. Rentang minggu upah berjalan
  const { startDate, endDate } = getWeekDateRange();

  // 2. Query entri minggu berjalan milik user ini (HANYA DISETUJUI YANG DIHITUNG)
  const { data: weekEntries } = await supabase
    .from("production_entries")
    .select("qty_disetujui, tarif_snapshot, status")
    .eq("user_id", user.id)
    .eq("status", "disetujui")
    .gte("tanggal_kerja", startDate)
    .lte("tanggal_kerja", endDate);

  let pcsDisetujuiMingguIni = 0;
  let upahMingguIni = 0;
  const weekRatesMap: Record<number, { tarif: number; pcs: number; subtotal: number }> = {};

  (weekEntries || []).forEach((e) => {
    const qty = Number(e.qty_disetujui || 0);
    const tarif = Number(e.tarif_snapshot || 500);
    pcsDisetujuiMingguIni += qty;
    const wage = calculateEntryWage("disetujui", qty, tarif);
    upahMingguIni += wage;

    if (!weekRatesMap[tarif]) {
      weekRatesMap[tarif] = { tarif, pcs: 0, subtotal: 0 };
    }
    weekRatesMap[tarif].pcs += qty;
    weekRatesMap[tarif].subtotal += wage;
  });

  const weekRates = Object.values(weekRatesMap).sort((a, b) => a.tarif - b.tarif);

  // 2b. Query status pembayaran tunai minggu berjalan dari wage_payments
  let paymentInfo: { isPaid: boolean; paidAt?: string } = { isPaid: false };
  try {
    const { data: payments } = await supabase
      .from("wage_payments")
      .select("id, status, dibayar_pada")
      .eq("user_id", user.id)
      .eq("periode_mulai", startDate)
      .eq("status", "dibayar")
      .order("dibayar_pada", { ascending: false })
      .limit(1);

    if (payments && payments.length > 0) {
      paymentInfo = {
        isPaid: true,
        paidAt: payments[0].dibayar_pada,
      };
    }
  } catch {
    // fallback bila tabel belum dimigrasi di live Supabase
    paymentInfo = { isPaid: false };
  }

  // 3. Query entri hari ini (untuk target harian 100 pcs)
  const { data: todayEntries } = await supabase
    .from("production_entries")
    .select("qty, qty_disetujui, status")
    .eq("user_id", user.id)
    .eq("tanggal_kerja", todayStr);

  let pcsHariIni = 0;
  (todayEntries || []).forEach((e) => {
    // Tampilkan pcs hari ini (jika disetujui pakai qty_disetujui, jika menunggu pakai qty yang diinput)
    if (e.status === "disetujui") {
      pcsHariIni += Number(e.qty_disetujui || 0);
    } else if (e.status === "menunggu") {
      pcsHariIni += Number(e.qty || 0);
    }
  });

  // 4. Query 5 entri riwayat terbaru
  const { data: rawRecent } = await supabase
    .from("production_entries")
    .select(`
      id,
      tanggal_kerja,
      qty,
      qty_disetujui,
      tarif_snapshot,
      status,
      projects (
        nama
      )
    `)
    .eq("user_id", user.id)
    .order("dibuat_pada", { ascending: false })
    .limit(5);

  interface RecentEntryRow {
    id: string;
    tanggal_kerja: string;
    qty: number;
    qty_disetujui: number | null;
    tarif_snapshot: number;
    status: "menunggu" | "disetujui" | "ditolak";
    projects: { nama: string } | null;
  }

  const recentEntries = ((rawRecent as unknown as RecentEntryRow[]) || []).map((e) => ({
    id: e.id,
    tanggal_kerja: e.tanggal_kerja,
    nama_proyek: e.projects?.nama || "Proyek Konveksi",
    qty: Number(e.qty),
    qty_disetujui: e.qty_disetujui !== null ? Number(e.qty_disetujui) : null,
    tarif_snapshot: Number(e.tarif_snapshot),
    status: e.status,
  }));

  // 5. Query Progres Reward untuk Proyek Aktif yang Bereward (Tahap 15)
  // Aturan Bisnis #9, #16, #17: Hanya proyek dengan reward_aktif = true
  const { data: rawRewardProjects } = await supabase
    .from("projects")
    .select("id, nama, ambang_reward, target_pcs")
    .eq("status", "aktif")
    .eq("reward_aktif", true);

  const rewardProgressList = await Promise.all(
    (rawRewardProjects || []).map(async (prj) => {
      // Ambil entri penjahit ini untuk proyek tersebut
      const { data: prjEntries } = await supabase
        .from("production_entries")
        .select("qty, qty_disetujui, status")
        .eq("user_id", user.id)
        .eq("project_id", prj.id);

      let pcsDisetujui = 0;
      let pcsMenunggu = 0;

      (prjEntries || []).forEach((pe) => {
        if (pe.status === "disetujui") {
          pcsDisetujui += Number(pe.qty_disetujui || 0);
        } else if (pe.status === "menunggu") {
          pcsMenunggu += Number(pe.qty || 0);
        }
      });

      const ambang = Number(prj.ambang_reward || 0);
      const sisa = Math.max(0, ambang - pcsDisetujui);
      const isQualified = ambang > 0 && pcsDisetujui >= ambang;

      return {
        projectId: prj.id,
        namaProyek: prj.nama,
        ambangReward: ambang,
        pcsDisetujui,
        pcsMenunggu,
        sisaPcs: sisa,
        isQualified,
      };
    })
  );

  // 6. Konteks Sapaan Maskot Fiko untuk Beranda
  const greetingContext = await getTailorGreetingContextServer(user.id, todayStr);

  return (
    <BerandaClient
      pcsDisetujuiMingguIni={pcsDisetujuiMingguIni}
      upahMingguIni={upahMingguIni}
      pcsHariIni={pcsHariIni}
      targetHariIni={greetingContext.targetHarian}
      paymentInfo={paymentInfo}
      rewardProgressList={rewardProgressList}
      recentEntries={recentEntries}
      weekRates={weekRates}
      greetingContext={greetingContext}
    />
  );
}
