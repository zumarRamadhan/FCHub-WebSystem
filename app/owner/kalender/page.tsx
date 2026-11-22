import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerSession } from "@/lib/auth-server";
import { getJakartaTodayString } from "@/lib/format";
import { CalendarMonthDay, ProjectColorKey, ProjectStatus } from "@/lib/types/database";
import { KalenderClient, CalendarProjectItem, DayProductionEntryItem } from "./kalender-client";

export const metadata: Metadata = {
  title: "Kalender Kerja & Garis Waktu Proyek | FCHub Owner",
  description: "Kalender kerja konveksi, hari libur, jadwal lembur, dan garis waktu multi-proyek.",
};

interface KalenderPageProps {
  searchParams?: {
    tahun?: string;
    bulan?: string;
    project?: string;
  };
}

export default async function OwnerKalenderPage({ searchParams }: KalenderPageProps) {
  await requireOwnerSession();
  const supabase = createClient();

  const todayStr = getJakartaTodayString();
  const [currentYearStr, currentMonthStr] = todayStr.split("-");

  const tahun = searchParams?.tahun ? parseInt(searchParams.tahun, 10) : parseInt(currentYearStr, 10);
  const bulan = searchParams?.bulan ? parseInt(searchParams.bulan, 10) : parseInt(currentMonthStr, 10);
  const selectedProjectParam = searchParams?.project || "all";
  const rpcProjectParam = selectedProjectParam === "all" ? null : selectedProjectParam;

  // 1. Ambil data hari sebulan dari RPC get_calendar_month
  const { data: monthDaysData, error: monthError } = await supabase.rpc("get_calendar_month", {
    p_tahun: tahun,
    p_bulan: bulan,
    p_project: rpcProjectParam,
  });

  // 2. Ambil seluruh proyek untuk pemilih filter & timeline bar
  const { data: rawProjects } = await supabase
    .from("projects")
    .select("id, nama, target_pcs, tarif_per_pcs, status, warna, tanggal_mulai, deadline, reward_aktif, ambang_reward")
    .order("status", { ascending: true })
    .order("tanggal_mulai", { ascending: false });

  // 3. Ambil progres proyek untuk persentase garis waktu
  const { data: progressData } = await supabase
    .from("v_project_progress")
    .select("project_id, total_pcs_disetujui, persentase_progres");

  const progressMap = new Map<string, { totalPcs: number; pct: number }>();
  progressData?.forEach((pr) => {
    progressMap.set(pr.project_id, {
      totalPcs: Number(pr.total_pcs_disetujui || 0),
      pct: Number(pr.persentase_progres || 0),
    });
  });

  const projects: CalendarProjectItem[] = (rawProjects || []).map((p) => {
    const prog = progressMap.get(p.id) || { totalPcs: 0, pct: 0 };
    return {
      id: p.id,
      nama: p.nama,
      target_pcs: p.target_pcs,
      tarif_per_pcs: p.tarif_per_pcs,
      status: p.status as ProjectStatus,
      warna: (p.warna || "p1") as ProjectColorKey,
      tanggal_mulai: p.tanggal_mulai,
      deadline: p.deadline,
      reward_aktif: Boolean(p.reward_aktif),
      ambang_reward: p.ambang_reward || 0,
      total_pcs_disetujui: prog.totalPcs,
      persentase_progres: prog.pct,
    };
  });

  // 4. Ambil pola hari_kerja dari app_settings
  const { data: patternSetting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "hari_kerja")
    .maybeSingle();

  let weeklyPattern: number[] = [1, 2, 3, 4, 5, 6];
  if (patternSetting?.value && Array.isArray(patternSetting.value)) {
    weeklyPattern = patternSetting.value as number[];
  }

  // 5. Normalisasi data kalender bulan
  let monthDays: CalendarMonthDay[] = [];
  if (!monthError && monthDaysData) {
    monthDays = monthDaysData as CalendarMonthDay[];
  } else {
    // Fallback darurat jika RPC belum dieksekusi di database
    const daysInMonth = new Date(tahun, bulan, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${tahun}-${String(bulan).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const jsDay = new Date(tahun, bulan - 1, d).getDay(); // 0 = Minggu
      const isoDay = jsDay === 0 ? 7 : jsDay;
      const isWork = weeklyPattern.includes(isoDay);
      monthDays.push({
        tanggal: dateStr,
        is_hari_kerja: isWork,
        sumber_status: "pola",
        keterangan_libur: !isWork ? "Libur rutin" : null,
        proyek_produksi: [],
        total_pcs_disetujui: 0,
        total_pcs_menunggu: 0,
        total_penjahit: 0,
        ada_lembur: false,
      });
    }
  }

  // 6. Ambil rincian entri harian bulan ini untuk modal detail hari (penjahit & qty)
  const startDateStr = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
  const endDateStr = `${tahun}-${String(bulan).padStart(2, "0")}-${String(new Date(tahun, bulan, 0).getDate()).padStart(2, "0")}`;

  const { data: monthEntries } = await supabase
    .from("production_entries")
    .select(`
      id,
      user_id,
      project_id,
      tanggal_kerja,
      qty,
      qty_disetujui,
      tarif_snapshot,
      status,
      users:user_id (nama, username),
      projects:project_id (nama, warna)
    `)
    .gte("tanggal_kerja", startDateStr)
    .lte("tanggal_kerja", endDateStr)
    .in("status", ["disetujui", "menunggu"])
    .order("qty_disetujui", { ascending: false });

  return (
    <KalenderClient
      initialYear={tahun}
      initialMonth={bulan}
      selectedProjectId={selectedProjectParam}
      monthDays={monthDays}
      projects={projects}
      weeklyPattern={weeklyPattern}
      monthEntries={(monthEntries as unknown as DayProductionEntryItem[]) || []}
      todayStr={todayStr}
    />
  );
}
