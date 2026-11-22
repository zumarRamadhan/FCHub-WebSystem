"use client";

import React, { useState } from "react";
import { UserX, CheckCircle, Calendar, Users, CalendarX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDateId } from "@/lib/format";

export interface TailorItem {
  id: string;
  nama: string;
  username: string;
}

interface BelumInputCardProps {
  tailors: TailorItem[];
  todayDateStr: string; // YYYY-MM-DD
  yesterdayDateStr: string; // YYYY-MM-DD
  todaySubmittedUserIds: string[];
  yesterdaySubmittedUserIds: string[];
  isTodayHoliday?: boolean;
  todayHolidayLabel?: string;
  isYesterdayHoliday?: boolean;
  yesterdayHolidayLabel?: string;
}

export function BelumInputCard({
  tailors,
  todayDateStr,
  yesterdayDateStr,
  todaySubmittedUserIds,
  yesterdaySubmittedUserIds,
  isTodayHoliday = false,
  todayHolidayLabel,
  isYesterdayHoliday = false,
  yesterdayHolidayLabel,
}: BelumInputCardProps) {
  const [selectedDay, setSelectedDay] = useState<"today" | "yesterday">("today");

  const currentDateStr = selectedDay === "today" ? todayDateStr : yesterdayDateStr;
  const submittedIds =
    selectedDay === "today" ? todaySubmittedUserIds : yesterdaySubmittedUserIds;
  const isCurrentHoliday = selectedDay === "today" ? Boolean(isTodayHoliday) : Boolean(isYesterdayHoliday);
  const currentHolidayLabel = selectedDay === "today" ? todayHolidayLabel : yesterdayHolidayLabel;

  // Filter penjahit yang belum menyetor entri sama sekali pada tanggal terpilih
  const unsubmittedTailors = tailors.filter((t) => !submittedIds.includes(t.id));
  const totalTailors = tailors.length;
  const unsubmittedCount = unsubmittedTailors.length;
  const submittedCount = totalTailors - unsubmittedCount;

  return (
    <Card className="p-4 sm:p-5 shadow-card flex flex-col justify-between h-full">
      <div>
        {/* Header Kartu dengan Toggle Tanggal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-line/60 gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-warning/15 flex items-center justify-center text-[#B77407] shrink-0">
              <UserX className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15px] sm:text-[16px] font-semibold text-ink leading-snug">
                Status Setoran Input
              </h3>
              <p className="text-[11px] sm:text-[12px] text-muted">
                Penjahit aktif yang belum menyetor ({formatDateId(currentDateStr)})
              </p>
            </div>
          </div>

          {/* Chip Toggle: Hari Ini vs Kemarin */}
          <div className="inline-flex items-center p-0.5 rounded-pill bg-surface-muted border border-line self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSelectedDay("today")}
              className={`px-3 py-1 rounded-pill text-[12px] font-semibold transition-all ${
                selectedDay === "today"
                  ? "bg-forest-900 text-white shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => setSelectedDay("yesterday")}
              className={`px-3 py-1 rounded-pill text-[12px] font-semibold transition-all ${
                selectedDay === "yesterday"
                  ? "bg-forest-900 text-white shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              Kemarin
            </button>
          </div>
        </div>

        {/* Banner Hari Libur Konveksi bila tanggal terpilih adalah hari libur */}
        {isCurrentHoliday && (
          <div className="mb-3 p-2.5 rounded-card bg-amber-50/80 border border-amber-200 text-amber-900 text-[12px] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <CalendarX className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Hari libur konveksi</strong> {currentHolidayLabel ? `(${currentHolidayLabel})` : ""}.
                {submittedCount > 0 ? ` ${submittedCount} penjahit lembur.` : " Penjahit tidak dijadwalkan bekerja."}
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-pill bg-amber-200/80 text-amber-900 shrink-0">
              Libur
            </span>
          </div>
        )}

        {/* Ringkasan Jumlah */}
        <div className="flex items-center justify-between bg-surface-muted/60 rounded-card p-3 mb-3 border border-line/50">
          <div className="flex items-center gap-2 text-[13px]">
            <Users className="w-4 h-4 text-muted" />
            <span className="text-muted">Total Penjahit Aktif:</span>
            <strong className="text-ink tabular-nums">{totalTailors} orang</strong>
          </div>
          <div className="text-[13px]">
            {isCurrentHoliday && submittedCount === 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-muted">
                Hari libur konveksi
              </span>
            ) : unsubmittedCount === 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-positive">
                <CheckCircle className="w-3.5 h-3.5" /> Lengkap (100%)
              </span>
            ) : isCurrentHoliday ? (
              <span className="font-semibold text-amber-800 tabular-nums">
                <span className="font-bold">{submittedCount}</span> lembur
              </span>
            ) : (
              <span className="font-semibold text-ink tabular-nums">
                <span className="text-[#B77407] font-bold">{unsubmittedCount}</span> belum setor
              </span>
            )}
          </div>
        </div>

        {/* Konten Daftar Penjahit Belum Input / Libur */}
        {isCurrentHoliday && submittedCount === 0 ? (
          <div className="py-6 text-center text-muted">
            <div className="w-10 h-10 rounded-full bg-surface-muted text-muted mx-auto flex items-center justify-center mb-2 border border-line">
              <CalendarX className="w-5 h-5 text-muted" />
            </div>
            <p className="text-[13px] font-semibold text-ink">
              Hari libur konveksi
            </p>
            <p className="text-[11.5px] text-muted mt-0.5 max-w-xs mx-auto">
              {currentHolidayLabel || "Hari libur rutin konveksi."} Tidak ada kewajiban setor input harian.
            </p>
          </div>
        ) : unsubmittedCount === 0 ? (
          <div className="py-6 text-center text-muted">
            <div className="w-10 h-10 rounded-full bg-lime-100 text-positive mx-auto flex items-center justify-center mb-2">
              <CheckCircle className="w-5 h-5" />
            </div>
            <p className="text-[13px] font-medium text-ink">
              Semua penjahit sudah menyetor input!
            </p>
            <p className="text-[11px] text-muted mt-0.5">
              Seluruh {totalTailors} penjahit aktif telah memiliki catatan untuk{" "}
              {selectedDay === "today" ? "hari ini" : "kemarin"}.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider block mb-1">
              Daftar Belum Input ({unsubmittedCount}):
            </span>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 -mr-1">
              {unsubmittedTailors.map((tailor) => {
                const initial = tailor.nama.charAt(0).toUpperCase();
                return (
                  <div
                    key={tailor.id}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-card bg-surface hover:bg-surface-muted/50 border border-line/60 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-forest-900/10 text-forest-900 font-bold text-[11px] flex items-center justify-center shrink-0">
                        {initial}
                      </div>
                      <span className="text-[13px] font-semibold text-ink truncate">
                        {tailor.nama}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#B77407] font-medium bg-warning/15 px-2 py-0.5 rounded-pill shrink-0">
                      Belum setor
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Keterangan */}
      <div className="mt-4 pt-2.5 border-t border-line/60 flex items-center justify-between text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" /> Tanggal: {formatDateId(currentDateStr)}
        </span>
        <span>
          Sudah setor: <strong className="text-positive">{submittedCount}</strong>
        </span>
      </div>
    </Card>
  );
}
