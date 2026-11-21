"use client";

import * as React from "react";
import {
  FileSpreadsheet,
  Banknote,
  Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { CardAccent } from "@/components/ui/card-accent";
import { SegmentedPill, SegmentedOption } from "@/components/ui/segmented-pill";
import { formatNumber, formatRupiah, formatDateId } from "@/lib/format";
import { WeekOption } from "@/lib/wage";
import { createClient } from "@/lib/supabase/client";

export interface PenjahitWageRow {
  user_id: string;
  nama_penjahit: string;
  username_penjahit: string;
  total_pcs_disetujui: number;
  tarif_snapshot: number;
  total_upah: number;
  total_entri_disetujui: number;
}

interface RekapClientProps {
  initialSummary: PenjahitWageRow[];
  weekOptions: WeekOption[];
  currentWeekStartDate: string;
}

interface RawWageRow {
  user_id: string;
  qty_disetujui: number | null;
  tarif_snapshot: number;
  users: { nama: string; username: string } | null;
}

export function RekapClient({
  initialSummary,
  weekOptions,
  currentWeekStartDate,
}: RekapClientProps) {
  const [selectedWeekStart, setSelectedWeekStart] = React.useState<string>(currentWeekStartDate);
  const [summary, setSummary] = React.useState<PenjahitWageRow[]>(initialSummary);
  const [isLoading, setIsLoading] = React.useState(false);

  const selectedWeekOption =
    weekOptions.find((w) => w.startDate === selectedWeekStart) || weekOptions[0];

  const pillOptions: SegmentedOption[] = weekOptions.map((w) => ({
    value: w.startDate,
    label: w.label,
  }));

  // Hitung total akumulasi
  const grandTotalPcs = summary.reduce((sum, item) => sum + item.total_pcs_disetujui, 0);
  const grandTotalUpah = summary.reduce((sum, item) => sum + item.total_upah, 0);

  // Ambil data saat minggu diubah
  const handleSelectWeek = async (weekStart: string) => {
    setSelectedWeekStart(weekStart);
    setIsLoading(true);

    const week = weekOptions.find((w) => w.startDate === weekStart);
    if (!week) {
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      // Query entri disetujui pada rentang tanggal minggu yang dipilih
      const { data: entries, error } = await supabase
        .from("production_entries")
        .select(`
          user_id,
          qty_disetujui,
          tarif_snapshot,
          users:users!user_id (
            nama,
            username
          )
        `)
        .eq("status", "disetujui")
        .gte("tanggal_kerja", week.startDate)
        .lte("tanggal_kerja", week.endDate);

      if (!error && entries) {
        // Kelompokkan per penjahit
        const grouped: Record<string, PenjahitWageRow> = {};

        ((entries as unknown as RawWageRow[]) || []).forEach((e) => {
          const userId = e.user_id;
          const qty = Number(e.qty_disetujui || 0);
          const tarif = Number(e.tarif_snapshot || 500);

          if (!grouped[userId]) {
            grouped[userId] = {
              user_id: userId,
              nama_penjahit: e.users?.nama || "Penjahit",
              username_penjahit: e.users?.username || "penjahit",
              total_pcs_disetujui: 0,
              tarif_snapshot: tarif,
              total_upah: 0,
              total_entri_disetujui: 0,
            };
          }

          grouped[userId].total_pcs_disetujui += qty;
          grouped[userId].total_upah += qty * tarif;
          grouped[userId].total_entri_disetujui += 1;
        });

        const sorted = Object.values(grouped).sort(
          (a, b) => b.total_pcs_disetujui - a.total_pcs_disetujui
        );
        setSummary(sorted);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Halaman */}
      <div className="pb-2 border-b border-line/60">
        <h1 className="text-[22px] sm:text-[24px] font-semibold text-ink leading-tight">
          Rekap Upah Mingguan Penjahit
        </h1>
        <p className="text-[13px] text-muted mt-1">
          Dihitung otomatis tiap Sabtu dari entri produksi berstatus disetujui (pcs disetujui × tarif snapshot).
        </p>
      </div>

      {/* Pemilih Minggu (SegmentedPill) */}
      <div className="space-y-2">
        <div className="overflow-x-auto pb-1">
          <SegmentedPill
            options={pillOptions}
            value={selectedWeekStart}
            onChange={handleSelectWeek}
            activeVariant="dark"
          />
        </div>
        <p className="text-[12px] text-muted flex items-center gap-1.5 pl-1">
          <Calendar className="w-3.5 h-3.5 text-muted" />
          <span>
            Periode: <strong>{formatDateId(selectedWeekOption.startDate)}</strong> s.d.{" "}
            <strong>{formatDateId(selectedWeekOption.endDate)}</strong> (WIB)
          </span>
        </p>
      </div>

      {/* Kartu Aksen Lime: Total Pengeluaran Upah */}
      <CardAccent className="p-5 sm:p-6 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-forest-900 text-white text-[11px] font-semibold">
            <FileSpreadsheet className="w-3 h-3" /> Rekap Pembayaran Sabtu
          </span>
          <span className="text-[12px] font-semibold text-forest-900/80">
            {summary.length} Penjahit Aktif
          </span>
        </div>

        <div>
          <span className="text-[13px] font-semibold text-forest-900/85 block">
            Total Upah Seluruh Penjahit:
          </span>
          <div className="text-[36px] sm:text-[44px] font-semibold text-forest-900 leading-tight tabular-nums my-1">
            {formatRupiah(grandTotalUpah)}
          </div>
          <p className="text-[13px] text-forest-900/80">
            Total <strong>{formatNumber(grandTotalPcs)} pcs</strong> telah disetujui untuk periode minggu ini.
          </p>
        </div>

        {/* Pemberitahuan Penting: Pembayaran Tunai di Luar Sistem */}
        <div className="mt-4 p-3.5 bg-forest-900/10 rounded-panel text-forest-900 text-[12px] flex items-start gap-2.5 leading-relaxed">
          <Banknote className="w-4 h-4 text-forest-900 mt-0.5 shrink-0 stroke-[2.2]" />
          <div>
            <strong>Catatan Pembayaran Tunai:</strong> Upah dibayarkan secara <strong>TUNAI</strong> di konveksi setiap hari Sabtu setelah buku atau catatan diverifikasi. Web app FCHub murni berfungsi sebagai sistem kalkulasi dan pencatatan tanpa pemrosesan transfer bank.
          </div>
        </div>
      </CardAccent>

      {/* Konten Rekap Penjahit */}
      {isLoading ? (
        <Card className="text-center py-12 px-6">
          <p className="text-[13px] text-muted">Memuat data rekap upah...</p>
        </Card>
      ) : summary.length === 0 ? (
        <Card className="text-center py-12 px-6 shadow-card">
          <div className="w-12 h-12 rounded-[16px] bg-surface-muted text-muted mx-auto flex items-center justify-center mb-3">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <h3 className="text-[16px] font-semibold text-ink">
            Belum Ada Entri yang Disetujui
          </h3>
          <p className="text-[13px] text-muted max-w-sm mx-auto mt-1">
            Belum ada hasil produksi yang disetujui pada periode minggu ini. Pastikan Anda telah menyetujui entri pada menu <strong>Approval</strong>.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* A. TAMPILAN DESKTOP: Tabel Bersih Bergaris Sesuai design-fchub.md */}
          <div className="hidden md:block">
            <Card className="p-0 overflow-hidden shadow-card border border-line">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-surface-muted border-b border-line text-[12px] font-semibold text-muted uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Penjahit</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4 text-right">Pcs Disetujui</th>
                    <th className="py-3 px-4 text-right">Tarif Dasar</th>
                    <th className="py-3 px-4 text-right">Total Upah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {summary.map((row, idx) => (
                    <tr
                      key={row.user_id}
                      className="hover:bg-surface-muted/50 transition-colors"
                    >
                      <td className="py-3 px-4 text-center text-muted font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-semibold text-ink">
                        {row.nama_penjahit}
                      </td>
                      <td className="py-3 px-4 text-muted font-mono text-[12px]">
                        @{row.username_penjahit}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-ink tabular-nums">
                        {formatNumber(row.total_pcs_disetujui)} pcs
                      </td>
                      <td className="py-3 px-4 text-right text-muted tabular-nums">
                        {formatRupiah(row.tarif_snapshot)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-forest-900 tabular-nums text-[14px]">
                        {formatRupiah(row.total_upah)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-muted/80 border-t-2 border-line font-semibold text-ink text-[14px]">
                    <td colSpan={3} className="py-3.5 px-4 text-right">
                      Total Seluruh Penjahit:
                    </td>
                    <td className="py-3.5 px-4 text-right text-ink tabular-nums">
                      {formatNumber(grandTotalPcs)} pcs
                    </td>
                    <td className="py-3.5 px-4 text-right text-muted">-</td>
                    <td className="py-3.5 px-4 text-right text-forest-900 tabular-nums text-[16px] font-bold">
                      {formatRupiah(grandTotalUpah)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </Card>
          </div>

          {/* B. TAMPILAN MOBILE: Daftar Kartu Per Penjahit (< 640px / 390px) */}
          <div className="md:hidden space-y-3">
            {summary.map((row, idx) => {
              const initials = row.nama_penjahit
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();

              return (
                <Card key={row.user_id} className="p-4 shadow-card">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-forest-900 text-lime-400 font-semibold text-[13px] flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-semibold text-ink truncate leading-tight">
                          {row.nama_penjahit}
                        </h4>
                        <span className="text-[11px] text-muted font-mono">
                          @{row.username_penjahit}
                        </span>
                      </div>
                    </div>

                    <span className="text-[11px] font-semibold text-muted shrink-0">
                      #{idx + 1}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-line/60 flex items-center justify-between text-[13px]">
                    <div>
                      <span className="text-[11px] text-muted block">Hasil Disetujui:</span>
                      <strong className="text-ink font-semibold tabular-nums">
                        {formatNumber(row.total_pcs_disetujui)} pcs
                      </strong>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-muted block">Upah Tunai:</span>
                      <strong className="text-forest-900 font-semibold tabular-nums text-[16px]">
                        {formatRupiah(row.total_upah)}
                      </strong>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
