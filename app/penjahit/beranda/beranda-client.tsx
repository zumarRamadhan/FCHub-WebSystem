"use client";

import * as React from "react";
import Link from "next/link";
import {
  Package,
  Calendar,
  TrendingUp,
  ArrowRight,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RingProgress } from "@/components/ui/ring-progress";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge, EntryStatus } from "@/components/ui/status-badge";
import { DailyGreeting } from "@/components/mascot/DailyGreeting";
import { Mascot } from "@/components/mascot/Mascot";
import { TailorGreetingContext } from "@/lib/messages";
import {
  formatNumber,
  formatRupiah,
  formatDateId,
  formatWageCalculation,
  formatMultiTarifSummary,
} from "@/lib/format";

export interface TailorRewardProgress {
  projectId: string;
  namaProyek: string;
  ambangReward: number;
  pcsDisetujui: number;
  pcsMenunggu: number;
  sisaPcs: number;
  isQualified: boolean;
}

export interface BerandaProps {
  pcsDisetujuiMingguIni: number;
  upahMingguIni: number;
  pcsHariIni: number;
  targetHariIni: number;
  paymentInfo?: {
    isPaid: boolean;
    paidAt?: string;
  };
  rewardProgressList?: TailorRewardProgress[];
  recentEntries: Array<{
    id: string;
    tanggal_kerja: string;
    nama_proyek: string;
    qty: number;
    qty_disetujui: number | null;
    tarif_snapshot: number;
    status: EntryStatus;
  }>;
  weekRates?: Array<{
    tarif: number;
    pcs: number;
    subtotal: number;
  }>;
  greetingContext?: TailorGreetingContext;
}

export function BerandaClient({
  pcsDisetujuiMingguIni,
  upahMingguIni,
  pcsHariIni,
  targetHariIni = 100,
  paymentInfo,
  rewardProgressList = [],
  recentEntries,
  weekRates = [],
  greetingContext,
}: BerandaProps) {
  const percentageHariIni = Math.min(100, Math.round((pcsHariIni / targetHariIni) * 100));

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* 1. KARTU HERO: Pcs Disetujui Minggu Ini & Estimasi Upah (HANYA DISETUJUI) */}
      <Card className="p-5 sm:p-6 shadow-card flex flex-col justify-between">
        <div>
          <CardHeader
            icon={<Package className="w-5 h-5 text-forest-900" />}
            title="Pcs Disetujui Minggu Ini"
            subtitle="Hanya input terverifikasi owner yang dihitung"
            action={
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-lime-100 text-positive text-[11px] font-semibold">
                <TrendingUp className="w-3 h-3" /> Siklus Sabtu
              </span>
            }
          />

          <div className="mt-3">
            <div className="text-[36px] sm:text-[44px] leading-none font-semibold text-ink tabular-nums">
              {formatNumber(pcsDisetujuiMingguIni)}{" "}
              <span className="text-[18px] sm:text-[20px] font-normal text-muted">pcs</span>
            </div>
            <div className="flex flex-wrap items-center gap-y-2 gap-x-3 mt-2">
              <p className="text-[13px] text-muted">
                Estimasi Upah:{" "}
                <strong className="text-forest-900 font-semibold text-[16px] tabular-nums">
                  {formatRupiah(upahMingguIni)}
                </strong>
              </p>

              {/* Formula Upah Standar */}
              {pcsDisetujuiMingguIni > 0 && (
                <span className="text-[12px] font-mono font-semibold text-forest-900 bg-surface-muted px-2 py-0.5 rounded-pill border border-line">
                  {weekRates.length > 1
                    ? formatMultiTarifSummary(
                      weekRates.length,
                      Math.round(upahMingguIni / pcsDisetujuiMingguIni)
                    )
                    : formatWageCalculation(
                      pcsDisetujuiMingguIni,
                      weekRates[0]?.tarif ?? 500,
                      upahMingguIni
                    )}
                </span>
              )}

              {/* Badge Status Pembayaran Tunai (Tahap 13) */}
              {paymentInfo?.isPaid ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill bg-positive/10 text-positive text-[12px] font-semibold border border-positive/20">
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  Upah minggu ini: Sudah dibayar ({paymentInfo.paidAt ? formatDateId(paymentInfo.paidAt) : "Sabtu"})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill bg-warning/10 text-warning text-[12px] font-semibold border border-warning/20">
                  <Clock className="w-3.5 h-3.5 stroke-[2]" />
                  Upah minggu ini: Belum dibayar
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tombol Aksi Bulat 64px Menuju Input */}
        <div className="mt-6 pt-4 border-t border-line/60 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-medium text-muted">Input Hasil Kerja Hari Ini</p>
            <p className="text-[13px] font-semibold text-ink">Catat sebelum malam hari</p>
          </div>
          <Link href="/penjahit/input">
            <Button
              variant="accentAction"
              aria-label="Menuju form input hasil kerja"
              title="Input Hasil Kerja"
            />
          </Link>
        </div>
      </Card>

      {/* Sapaan Hangat Maskot Fiko di atas Ring Target */}
      {greetingContext && <DailyGreeting context={greetingContext} />}

      {/* 2. KARTU HARI INI: RingProgress terhadap Target 100 Pcs */}
      <Card className="p-5 sm:p-6 shadow-card flex flex-col items-center justify-center text-center">
        <div className="w-full text-left mb-2">
          <CardHeader
            icon={<Calendar className="w-5 h-5 text-forest-900" />}
            title="Produksi Hari Ini"
            subtitle="Target harian konveksi: 100 pcs"
          />
        </div>

        <div className="py-2">
          <RingProgress
            value={pcsHariIni}
            max={targetHariIni}
            size={160}
            strokeWidth={14}
            label={`Target ${targetHariIni} pcs`}
            badge={
              pcsHariIni >= targetHariIni
                ? "Target 100 Pcs Tercapai!"
                : `Tercapai ${percentageHariIni}% (${pcsHariIni}/${targetHariIni} pcs)`
            }
          />
        </div>

        <div className="w-full mt-3 pt-3 border-t border-line/60 flex items-center justify-between text-[12px] text-muted">
          <span>Zona Waktu: Asia/Jakarta (WIB)</span>
          <Link
            href="/penjahit/input"
            className="text-forest-900 font-semibold hover:underline flex items-center gap-1"
          >
            Input Sekarang <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </Card>

      {/* 2b. KARTU PROGRES MENUJU REWARD (Tahap 15) */}
      {rewardProgressList.length > 0 && (
        <Card className="p-5 sm:p-6 shadow-card space-y-4">
          <CardHeader
            icon={<Sparkles className="w-5 h-5 text-amber-500 fill-amber-400" />}
            title="Progres Menuju Reward"
            subtitle="Hanya input berstatus disetujui yang dihitung ke reward"
          />

          <div className="space-y-4 divide-y divide-line/60">
            {rewardProgressList.map((rp, idx) => {
              const progressPct = Math.min(
                100,
                Math.round((rp.pcsDisetujui / rp.ambangReward) * 100)
              );

              return (
                <div key={rp.projectId} className={idx > 0 ? "pt-4" : ""}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-3">
                      {rp.isQualified ? (
                        <Mascot pose="melampaui" size={44} animate={true} />
                      ) : rp.sisaPcs > 0 && rp.sisaPcs <= Math.round(rp.ambangReward * 0.3) ? (
                        <Mascot pose="ajakan" size={40} animate={true} />
                      ) : null}
                      <div>
                        <h4 className="text-[14px] font-semibold text-ink leading-snug">
                          {rp.namaProyek}
                        </h4>
                        <p className="text-[12px] text-muted mt-0.5">
                          {rp.isQualified ? (
                            <span className="text-positive font-semibold">
                              Kamu sudah melewati ambang reward ({formatNumber(rp.pcsDisetujui)} / {formatNumber(rp.ambangReward)} pcs)!
                            </span>
                          ) : (
                            <span>
                              Tinggal{" "}
                              <strong className="text-ink font-semibold">
                                {formatNumber(rp.sisaPcs)} pcs
                              </strong>{" "}
                              lagi untuk reward proyek {rp.namaProyek}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {rp.isQualified ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold shrink-0">
                        <Sparkles className="w-3 h-3 text-amber-600 fill-amber-500" /> Kualifikasi Tercapai
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-muted bg-surface-muted px-2 py-0.5 rounded-pill shrink-0 tabular-nums">
                        {progressPct}%
                      </span>
                    )}
                  </div>

                  <div className="mt-2 space-y-1.5">
                    <ProgressBar value={rp.pcsDisetujui} max={rp.ambangReward} />
                    <div className="flex items-center justify-between text-[11px] text-muted">
                      <span>{formatNumber(rp.pcsDisetujui)} disetujui</span>
                      <span>Target: {formatNumber(rp.ambangReward)} pcs</span>
                    </div>
                  </div>

                  {rp.pcsMenunggu > 0 && (
                    <p className="text-[11px] text-warning font-medium mt-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      +{formatNumber(rp.pcsMenunggu)} pcs menunggu persetujuan (belum dihitung)
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 3. KARTU RIWAYAT TERBARU (5 Baris Terakhir) */}
      <Card className="p-5 sm:p-6 shadow-card">
        <div className="flex items-center justify-between pb-3 border-b border-line/60 mb-3">
          <div>
            <h3 className="text-[16px] font-semibold text-ink leading-snug">
              Riwayat Terbaru
            </h3>
            <p className="text-[12px] text-muted">5 catatan produksi terakhir</p>
          </div>
          <Link
            href="/penjahit/riwayat"
            className="text-[12px] font-semibold text-forest-900 hover:underline flex items-center gap-1"
          >
            Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentEntries.length === 0 ? (
          <div className="text-center py-6 text-muted text-[13px]">
            <p>Belum ada riwayat hasil kerja yang dicatat.</p>
            <Link href="/penjahit/input" className="mt-2.5 inline-block">
              <Button variant="secondary" size="sm">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Input Pertama
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-line/60">
            {recentEntries.map((item) => {
              const isApproved = item.status === "disetujui";
              const isCorrected = isApproved && item.qty_disetujui !== null && item.qty_disetujui !== item.qty;

              return (
                <div
                  key={item.id}
                  className="py-3 flex items-center justify-between gap-3 first:pt-1 last:pb-1"
                >
                  <div>
                    <span className="text-[13px] font-semibold text-ink block leading-snug">
                      {formatDateId(item.tanggal_kerja)}
                    </span>
                    <span className="text-[11px] text-muted block truncate max-w-[180px]">
                      {item.nama_proyek}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      {isApproved ? (
                        <>
                          <span className="text-[14px] font-semibold text-positive tabular-nums block">
                            {formatNumber(item.qty_disetujui || 0)} pcs
                          </span>
                          <span className="text-[11px] font-mono text-forest-900 block">
                            {formatWageCalculation(
                              item.qty_disetujui || 0,
                              item.tarif_snapshot,
                              (item.qty_disetujui || 0) * item.tarif_snapshot
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[14px] font-semibold text-ink tabular-nums block">
                            {formatNumber(item.qty)} pcs
                          </span>
                          <span className="text-[11px] font-mono text-muted block">
                            {formatWageCalculation(
                              item.qty,
                              item.tarif_snapshot,
                              item.qty * item.tarif_snapshot
                            )}
                          </span>
                        </>
                      )}
                      {isCorrected && (
                        <span className="text-[10px] text-muted line-through block">
                          ({formatNumber(item.qty)} pcs)
                        </span>
                      )}
                    </div>

                    <StatusBadge status={item.status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
