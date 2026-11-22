"use client";

import * as React from "react";
import {
  Trophy,
  Sparkles,
  Layers,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { SegmentedPill, SegmentedOption } from "@/components/ui/segmented-pill";
import { formatNumber } from "@/lib/format";
import { LeaderboardPublicItem } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/client";

export interface ProjectOptionItem {
  id: string;
  nama: string;
  ambang_reward: number;
}

interface LeaderboardClientProps {
  projects: ProjectOptionItem[];
  initialLeaderboard: LeaderboardPublicItem[];
  defaultProjectId: string;
}

export function LeaderboardClient({
  projects,
  initialLeaderboard,
  defaultProjectId,
}: LeaderboardClientProps) {
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>(defaultProjectId);
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardPublicItem[]>(initialLeaderboard);
  const [isLoading, setIsLoading] = React.useState(false);

  const currentProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  const projectOptions: SegmentedOption[] = projects.map((p) => ({
    value: p.id,
    label: p.nama,
  }));

  const handleSelectProject = async (projId: string) => {
    setSelectedProjectId(projId);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_project_leaderboard", {
        p_project_id: projId,
      });

      if (!error && data) {
        setLeaderboard(data as LeaderboardPublicItem[]);
      }
    } catch {
      // Handle fallback gracefully
    } finally {
      setIsLoading(false);
    }
  };

  if (projects.length === 0) {
    return (
      <Card className="text-center py-12 px-6">
        <div className="w-12 h-12 rounded-[16px] bg-surface-muted text-muted mx-auto flex items-center justify-center mb-3">
          <Trophy className="w-6 h-6" />
        </div>
        <h3 className="text-[17px] font-semibold text-ink">
          Tidak Ada Kompetisi Reward Aktif
        </h3>
        <p className="text-[13px] text-muted max-w-sm mx-auto mt-1">
          Kompetisi dan papan peringkat leaderboard hanya tersedia pada proyek besar konveksi yang mengaktifkan program reward.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header Halaman */}
      <div className="pb-2 border-b border-line/60">
        <h1 className="text-[20px] sm:text-[22px] font-semibold text-ink leading-tight">
          Leaderboard Proyek
        </h1>
        <p className="text-[12px] sm:text-[13px] text-muted mt-0.5">
          Peringkat total pcs disetujui dan penanda kualifikasi reward akhir proyek.
        </p>
      </div>

      {/* Pemilih Proyek jika > 1 */}
      {projects.length > 1 && (
        <div className="overflow-x-auto pb-1">
          <SegmentedPill
            options={projectOptions}
            value={selectedProjectId}
            onChange={handleSelectProject}
            activeVariant="dark"
          />
        </div>
      )}

      {/* Info Ambang Reward Proyek Terpilih */}
      {currentProject && (
        <div className="p-3.5 bg-surface rounded-card border border-line flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px]">
            <Layers className="w-4 h-4 text-forest-900" />
            <span className="font-semibold text-ink truncate max-w-[200px]">
              {currentProject.nama}
            </span>
          </div>
          {currentProject.ambang_reward > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-lime-100 text-positive text-[11px] font-semibold shrink-0">
              <Sparkles className="w-3 h-3 text-positive" />
              Ambang: {formatNumber(currentProject.ambang_reward)} pcs
            </span>
          ) : (
            <span className="text-[11px] text-muted">Tanpa target reward</span>
          )}
        </div>
      )}

      {/* Daftar Peringkat */}
      <Card className="p-4 sm:p-5 shadow-card">
        <CardHeader
          icon={<Trophy className="w-5 h-5 text-forest-900" />}
          title="Peringkat Penjahit"
          subtitle="Hanya menghitung entri yang telah disetujui owner"
        />

        <CardContent className="p-0 pt-2">
          {isLoading ? (
            <div className="text-center py-8 text-muted text-[13px]">
              Memuat data peringkat...
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-8 text-muted text-[13px]">
              Belum ada hasil produksi yang disetujui untuk proyek ini.
            </div>
          ) : (
            <div className="divide-y divide-line/60">
              {leaderboard.map((item, index) => {
                const rankNum = item.rank_position || index + 1;
                const isMe = item.is_current_user;
                const hasReward = item.melewati_ambang_reward;

                const initials = item.nama_penjahit
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <div
                    key={item.user_id || index}
                    className={`py-3 px-3 rounded-panel flex items-center justify-between gap-3 transition-colors ${
                      isMe
                        ? "bg-lime-100/70 border border-lime-400/50 shadow-sm my-1"
                        : "hover:bg-surface-muted/60"
                    }`}
                  >
                    {/* Posisi & Profil */}
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Medali / Nomor Peringkat */}
                      <div className="w-7 text-center shrink-0">
                        {rankNum === 1 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-forest-900 font-bold text-[13px] shadow-sm">
                            1
                          </span>
                        ) : rankNum === 2 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-forest-900 font-bold text-[13px]">
                            2
                          </span>
                        ) : rankNum === 3 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-600/30 text-amber-900 font-bold text-[13px]">
                            3
                          </span>
                        ) : (
                          <span className="text-[14px] font-semibold text-muted tabular-nums">
                            #{rankNum}
                          </span>
                        )}
                      </div>

                      {/* Avatar */}
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 select-none ${
                          isMe ? "bg-forest-900 text-lime-400" : "bg-surface-muted text-ink"
                        }`}
                      >
                        {initials}
                      </div>

                      {/* Nama Penjahit */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[14px] font-semibold text-ink truncate leading-snug">
                            {item.nama_penjahit}
                          </span>
                          {isMe && (
                            <span className="px-1.5 py-0.2 rounded-full bg-forest-900 text-white text-[10px] font-semibold shrink-0">
                              Anda
                            </span>
                          )}
                        </div>

                        {hasReward && (
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-forest-900 mt-0.5">
                            <Sparkles className="w-3 h-3 text-amber-600 fill-amber-500" />
                            <span>Melewati Ambang Reward</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Total Pcs Disetujui */}
                    <div className="text-right shrink-0">
                      <span className="text-[16px] font-semibold text-ink tabular-nums block">
                        {formatNumber(item.total_pcs_disetujui || 0)}
                      </span>
                      <span className="text-[11px] text-muted block">
                        pcs disetujui
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
