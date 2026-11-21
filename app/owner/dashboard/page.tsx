import Link from "next/link";
import {
  Package,
  Clock,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Trophy,
  CheckSquare,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { CardAccent } from "@/components/ui/card-accent";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { RingProgress } from "@/components/ui/ring-progress";
import { createClient } from "@/lib/supabase/server";
import { formatNumber, formatRupiah, formatDateId } from "@/lib/format";
import { getWeekDateRange } from "@/lib/wage";

export default async function OwnerDashboardPage() {
  const supabase = createClient();
  const { startDate, endDate } = getWeekDateRange();

  // 1. Ambil proyek aktif utama
  const { data: projects } = await supabase
    .from("projects")
    .select("id, nama, target_pcs, tarif_per_pcs, ambang_reward, deadline")
    .eq("status", "aktif")
    .order("created_at", { ascending: false })
    .limit(1);

  const mainProject = projects?.[0];

  // 2. Hitung total pcs disetujui untuk proyek utama
  let totalApprovedMain = 0;
  if (mainProject) {
    const { data: approvedEntries } = await supabase
      .from("production_entries")
      .select("qty_disetujui")
      .eq("project_id", mainProject.id)
      .eq("status", "disetujui");

    totalApprovedMain = (approvedEntries || []).reduce(
      (sum, e) => sum + Number(e.qty_disetujui || 0),
      0
    );
  }

  // 3. Hitung jumlah entri yang sedang menunggu approval
  const { count: waitingCount } = await supabase
    .from("production_entries")
    .select("*", { count: "exact", head: true })
    .eq("status", "menunggu");

  // 4. Hitung total pcs disetujui & upah seluruh penjahit minggu ini (Aturan Bisnis #1)
  const { data: weekEntries } = await supabase
    .from("production_entries")
    .select(`
      user_id,
      qty_disetujui,
      tarif_snapshot,
      users:users!user_id (
        nama
      )
    `)
    .eq("status", "disetujui")
    .gte("tanggal_kerja", startDate)
    .lte("tanggal_kerja", endDate);

  interface RawWeekRow {
    user_id: string;
    qty_disetujui: number | null;
    tarif_snapshot: number;
    users: { nama: string } | null;
  }

  let weekPcsTotal = 0;
  let weekWageTotal = 0;
  const userWeekMap: Record<string, { nama: string; pcs: number; upah: number }> = {};

  ((weekEntries as unknown as RawWeekRow[]) || []).forEach((e) => {
    const qty = Number(e.qty_disetujui || 0);
    const tarif = Number(e.tarif_snapshot || 500);
    const wage = qty * tarif;

    weekPcsTotal += qty;
    weekWageTotal += wage;

    if (!userWeekMap[e.user_id]) {
      userWeekMap[e.user_id] = {
        nama: e.users?.nama || "Penjahit",
        pcs: 0,
        upah: 0,
      };
    }
    userWeekMap[e.user_id].pcs += qty;
    userWeekMap[e.user_id].upah += wage;
  });

  // Top penjahit minggu ini (diurutkan berdasarkan upah tertinggi)
  const topPenjahitMingguIni = Object.values(userWeekMap)
    .sort((a, b) => b.upah - a.upah)
    .slice(0, 4);

  // 5. Antrean singkat (4 entri menunggu terbaru)
  const { data: rawWaitingPreview } = await supabase
    .from("production_entries")
    .select(`
      id,
      tanggal_kerja,
      qty,
      users:users!user_id (
        nama
      ),
      projects (
        nama
      )
    `)
    .eq("status", "menunggu")
    .order("dibuat_pada", { ascending: false })
    .limit(4);

  interface RawPreviewRow {
    id: string;
    tanggal_kerja: string;
    qty: number;
    users: { nama: string } | null;
    projects: { nama: string } | null;
  }

  const waitingPreview = ((rawWaitingPreview as unknown as RawPreviewRow[]) || []).map((e) => ({
    id: e.id,
    tanggal_kerja: e.tanggal_kerja,
    qty: Number(e.qty),
    nama_penjahit: e.users?.nama || "Penjahit",
    nama_proyek: e.projects?.nama || "Proyek Konveksi",
  }));

  // 6. Leaderboard lengkap per proyek untuk Owner
  interface OwnerLeaderboardRow {
    user_id: string;
    nama_penjahit: string;
    total_pcs_disetujui: number;
    total_upah: number;
    melewati_ambang_reward: boolean;
  }

  let projectLeaderboard: OwnerLeaderboardRow[] = [];

  if (mainProject) {
    const { data: lbData, error: lbError } = await supabase
      .from("v_leaderboard")
      .select("*")
      .eq("project_id", mainProject.id)
      .order("total_pcs_disetujui", { ascending: false });

    if (!lbError && lbData) {
      projectLeaderboard = (lbData as unknown as OwnerLeaderboardRow[]).map((r) => ({
        user_id: r.user_id,
        nama_penjahit: r.nama_penjahit,
        total_pcs_disetujui: Number(r.total_pcs_disetujui || 0),
        total_upah: Number(r.total_upah || 0),
        melewati_ambang_reward: Boolean(r.melewati_ambang_reward),
      }));
    } else {
      // Fallback
      const { data: allApproved } = await supabase
        .from("production_entries")
        .select(`
          user_id,
          qty_disetujui,
          tarif_snapshot,
          users:users!user_id (
            nama
          )
        `)
        .eq("project_id", mainProject.id)
        .eq("status", "disetujui");

      const map: Record<string, OwnerLeaderboardRow> = {};
      ((allApproved as unknown as RawWeekRow[]) || []).forEach((e) => {
        const uid = e.user_id;
        const q = Number(e.qty_disetujui || 0);
        const t = Number(e.tarif_snapshot || 500);

        if (!map[uid]) {
          map[uid] = {
            user_id: uid,
            nama_penjahit: e.users?.nama || "Penjahit",
            total_pcs_disetujui: 0,
            total_upah: 0,
            melewati_ambang_reward: false,
          };
        }
        map[uid].total_pcs_disetujui += q;
        map[uid].total_upah += q * t;
        map[uid].melewati_ambang_reward =
          mainProject.ambang_reward > 0 &&
          map[uid].total_pcs_disetujui >= mainProject.ambang_reward;
      });

      projectLeaderboard = Object.values(map).sort(
        (a, b) => b.total_pcs_disetujui - a.total_pcs_disetujui
      );
    }
  }

  const targetPcs = mainProject?.target_pcs || 16000;
  const progressPercent = Math.min(
    100,
    Math.round((totalApprovedMain / targetPcs) * 100)
  );

  return (
    <div className="space-y-6">
      {/* 1. BARIS ATAS: Hero Progres Proyek (8 Kolom) + Kartu Aksen Lime Menunggu Approval (4 Kolom) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Kartu Hero Progres Proyek Utama */}
        <Card className="lg:col-span-8 flex flex-col justify-between p-5 sm:p-6 shadow-card">
          <div>
            <CardHeader
              icon={<Package className="w-5 h-5 text-forest-900" />}
              title="Progres Produksi Proyek Utama"
              subtitle={
                mainProject
                  ? `${mainProject.nama} (Target: ${formatNumber(mainProject.target_pcs)} pcs)`
                  : "Belum ada proyek aktif"
              }
              action={
                mainProject ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-lime-100 text-positive text-[11px] font-semibold">
                    <TrendingUp className="w-3 h-3" /> Berjalan
                  </span>
                ) : undefined
              }
            />
            <div className="mt-2">
              <div className="text-[36px] sm:text-[44px] font-semibold text-ink leading-tight tabular-nums">
                {formatNumber(totalApprovedMain)}{" "}
                <span className="text-[18px] sm:text-[20px] font-normal text-muted">
                  / {formatNumber(targetPcs)} pcs
                </span>
              </div>
              <p className="text-[13px] text-muted mt-1.5">
                {mainProject ? (
                  <>
                    Tarif: <strong className="text-forest-900">{formatRupiah(mainProject.tarif_per_pcs)} / pcs</strong> · Target Harian: 100 pcs / penjahit
                  </>
                ) : (
                  "Buka menu Proyek untuk membuat proyek baru."
                )}
              </p>
            </div>

            <div className="mt-6 space-y-1.5">
              <div className="flex justify-between text-[12px] text-muted">
                <span>Persentase Tercapai</span>
                <span className="font-semibold text-ink tabular-nums">{progressPercent}%</span>
              </div>
              <ProgressBar value={progressPercent} max={100} />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-line/60 flex items-center justify-between text-[12px] text-muted">
            <span>Sisa Target: {formatNumber(Math.max(0, targetPcs - totalApprovedMain))} pcs</span>
            <Link
              href="/owner/proyek"
              className="font-semibold text-forest-900 hover:underline flex items-center gap-1"
            >
              Kelola Proyek <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>

        {/* Kartu Aksen Lime: Antrean Approval */}
        <CardAccent className="lg:col-span-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-forest-900 text-white text-[11px] font-semibold">
                <Clock className="w-3.5 h-3.5" /> Antrean Input
              </span>
              <span className="text-[12px] font-semibold text-forest-900/80">
                Pagi Hari
              </span>
            </div>

            <h3 className="text-[18px] font-semibold text-forest-900 mb-1 leading-snug">
              Menunggu Approval
            </h3>
            <p className="text-[13px] text-forest-900/80 mb-4">
              Input hasil kerja penjahit tadi malam siap diverifikasi dan disetujui.
            </p>

            <div className="text-[36px] font-semibold text-forest-900 tabular-nums leading-none mb-2">
              {waitingCount || 0}{" "}
              <span className="text-[16px] font-medium opacity-80">entri</span>
            </div>
          </div>

          <div className="pt-4 border-t border-forest-900/15 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-forest-900">
              {waitingCount && waitingCount > 0 ? "Buka Antrean Sekarang" : "Tidak Ada Antrean"}
            </span>
            <Link href="/owner/approval">
              <Button
                variant="accentAction"
                size="round36"
                aria-label="Ke halaman antrean approval"
              />
            </Link>
          </div>
        </CardAccent>
      </div>

      {/* 2. BARIS TENGAH: Produksi Minggu Ini (Ring) + Upah Minggu Ini (Bar) + Antrean Singkat */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* A. RingProgress Produksi Minggu Ini */}
        <Card className="p-5 sm:p-6 shadow-card flex flex-col items-center justify-between text-center">
          <div className="w-full text-left">
            <CardHeader
              title="Produksi Minggu Ini"
              subtitle="Total pcs disetujui seluruh penjahit"
            />
          </div>

          <div className="py-2">
            <RingProgress
              value={weekPcsTotal}
              max={1500}
              size={150}
              strokeWidth={14}
              label="pcs disetujui"
              badge={`Total ${formatNumber(weekPcsTotal)} pcs`}
            />
          </div>

          <p className="text-[12px] text-muted pt-2 border-t border-line/60 w-full text-center">
            Siklus: {formatDateId(startDate)} - {formatDateId(endDate)}
          </p>
        </Card>

        {/* B. Rincian Upah Top Penjahit Minggu Ini */}
        <Card className="p-5 sm:p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-line/60 mb-3">
              <div>
                <h3 className="text-[16px] font-semibold text-ink leading-snug">
                  Upah Minggu Ini
                </h3>
                <p className="text-[12px] text-muted">Performa penjahit teratas</p>
              </div>
              <strong className="text-forest-900 font-semibold text-[15px] tabular-nums">
                {formatRupiah(weekWageTotal)}
              </strong>
            </div>

            {topPenjahitMingguIni.length === 0 ? (
              <div className="text-center py-8 text-muted text-[13px]">
                Belum ada upah disetujui minggu ini.
              </div>
            ) : (
              <div className="space-y-3">
                {topPenjahitMingguIni.map((p) => {
                  const pct = weekWageTotal > 0 ? Math.round((p.upah / weekWageTotal) * 100) : 0;
                  return (
                    <div key={p.nama} className="space-y-1">
                      <div className="flex justify-between text-[12px]">
                        <span className="font-semibold text-ink truncate max-w-[120px]">
                          {p.nama}
                        </span>
                        <span className="font-medium text-forest-900 tabular-nums">
                          {formatRupiah(p.upah)} ({p.pcs} pcs)
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-surface-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-lime-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-line/60 text-right">
            <Link
              href="/owner/rekap"
              className="text-[12px] font-semibold text-forest-900 hover:underline flex items-center justify-end gap-1"
            >
              Lihat Rekap Lengkap <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>

        {/* C. Antrean Singkat Approval */}
        <Card className="p-5 sm:p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-line/60 mb-3">
              <div>
                <h3 className="text-[16px] font-semibold text-ink leading-snug">
                  Antrean Singkat
                </h3>
                <p className="text-[12px] text-muted">Input terbaru menunggu approval</p>
              </div>
              <span className="text-[12px] font-semibold text-[#B77407] bg-warning/15 px-2 py-0.5 rounded-pill tabular-nums">
                {waitingCount || 0}
              </span>
            </div>

            {waitingPreview.length === 0 ? (
              <div className="text-center py-8 text-muted text-[13px]">
                Semua input sudah diverifikasi.
              </div>
            ) : (
              <div className="divide-y divide-line/60">
                {waitingPreview.map((w) => (
                  <div key={w.id} className="py-2.5 flex items-center justify-between text-[12px]">
                    <div className="min-w-0">
                      <strong className="text-ink block truncate">{w.nama_penjahit}</strong>
                      <span className="text-muted block text-[11px] truncate">
                        {w.nama_proyek} · {formatDateId(w.tanggal_kerja)}
                      </span>
                    </div>
                    <span className="font-semibold text-ink tabular-nums shrink-0">
                      {formatNumber(w.qty)} pcs
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-line/60">
            <Link href="/owner/approval">
              <Button variant="secondary" size="sm" className="w-full text-[12px]">
                <CheckSquare className="w-3.5 h-3.5 mr-1" />
                Buka Antrean Approval
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* 3. LEADERBOARD OWNER PER PROYEK LENGKAP */}
      <Card className="p-5 sm:p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-line/60 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-forest-900" />
              <h3 className="text-[18px] font-semibold text-ink">
                Leaderboard Proyek Konveksi
              </h3>
            </div>
            <p className="text-[12px] text-muted mt-0.5">
              Peringkat produksi, akumulasi upah, dan status ambang reward (
              {mainProject ? mainProject.nama : "Proyek"})
            </p>
          </div>

          {mainProject && mainProject.ambang_reward > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-lime-100 text-positive text-[12px] font-semibold shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-positive" />
              Ambang Reward: {formatNumber(mainProject.ambang_reward)} pcs
            </span>
          )}
        </div>

        {projectLeaderboard.length === 0 ? (
          <div className="text-center py-10 text-muted text-[13px]">
            Belum ada hasil produksi yang disetujui pada proyek ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line text-[12px] font-semibold text-muted uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-14 text-center">Peringkat</th>
                  <th className="py-2.5 px-3">Nama Penjahit</th>
                  <th className="py-2.5 px-3 text-right">Pcs Disetujui</th>
                  <th className="py-2.5 px-3 text-right">Total Upah</th>
                  <th className="py-2.5 px-3 text-center">Kualifikasi Reward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {projectLeaderboard.map((row, idx) => (
                  <tr key={row.user_id} className="hover:bg-surface-muted/50 transition">
                    <td className="py-3 px-3 text-center font-bold">
                      {idx === 0 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-forest-900 text-[12px]">
                          1
                        </span>
                      ) : idx === 1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-forest-900 text-[12px]">
                          2
                        </span>
                      ) : idx === 2 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-600/30 text-amber-900 text-[12px]">
                          3
                        </span>
                      ) : (
                        <span className="text-muted tabular-nums">#{idx + 1}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-ink">
                      {row.nama_penjahit}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-ink tabular-nums">
                      {formatNumber(row.total_pcs_disetujui)} pcs
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-forest-900 tabular-nums">
                      {formatRupiah(row.total_upah)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {row.melewati_ambang_reward ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-forest-900 text-lime-400 text-[11px] font-semibold">
                          <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
                          Lolos Reward
                        </span>
                      ) : (
                        <span className="text-muted text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
