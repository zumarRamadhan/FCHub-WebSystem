import React from "react";
import { formatNumber } from "@/lib/format";

export interface DailyProductionItem {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "Sen", "Sel", dst.
  dateLabel: string; // "15/11"
  pcs: number;
  isToday: boolean;
}

interface DailyProductionChartProps {
  data: DailyProductionItem[];
  title?: string;
  subtitle?: string;
}

export function DailyProductionChart({
  data,
  title = "Tren Produksi Harian",
  subtitle = "7 hari terakhir (hanya entri disetujui)",
}: DailyProductionChartProps) {
  const maxPcs = Math.max(...data.map((d) => d.pcs), 100);
  const totalPcs7Hari = data.reduce((sum, d) => sum + d.pcs, 0);

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-line/60 mb-4 gap-1">
        <div>
          <h3 className="text-[15px] sm:text-[16px] font-semibold text-ink leading-snug">
            {title}
          </h3>
          <p className="text-[11px] sm:text-[12px] text-muted">{subtitle}</p>
        </div>
        <div className="text-left sm:text-right">
          <span className="text-[11px] text-muted block">Total 7 Hari:</span>
          <strong className="text-[14px] sm:text-[15px] font-bold text-forest-900 tabular-nums">
            {formatNumber(totalPcs7Hari)} <span className="text-[12px] font-normal text-muted">pcs</span>
          </strong>
        </div>
      </div>

      {/* SVG Bar Chart Container */}
      <div className="relative pt-6 pb-2">
        {/* Grid lines latar belakang */}
        <div className="absolute inset-x-0 top-6 bottom-8 flex flex-col justify-between pointer-events-none opacity-40">
          <div className="border-b border-dashed border-line w-full" />
          <div className="border-b border-dashed border-line w-full" />
          <div className="border-b border-dashed border-line w-full" />
        </div>

        {/* Bar Columns (7 hari) */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2.5 items-end h-44 sm:h-48 relative z-10">
          {data.map((item) => {
            const heightPct = Math.max(item.pcs > 0 ? 8 : 2, Math.round((item.pcs / maxPcs) * 100));

            return (
              <div
                key={item.date}
                className="flex flex-col items-center justify-end h-full group select-none"
              >
                {/* Nilai Pcs di atas bar */}
                <div className="mb-1.5 text-center">
                  <span
                    className={`text-[10px] sm:text-[11px] font-bold tabular-nums block transition-transform group-hover:scale-110 ${
                      item.isToday
                        ? "text-forest-900 font-extrabold"
                        : item.pcs > 0
                        ? "text-ink"
                        : "text-muted/60"
                    }`}
                  >
                    {item.pcs > 0 ? formatNumber(item.pcs) : "-"}
                  </span>
                </div>

                {/* Tiang Bar SVG / CSS */}
                <div className="w-full max-w-[32px] sm:max-w-[40px] bg-surface-muted rounded-t-md overflow-hidden relative flex flex-col justify-end h-32 sm:h-36">
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t-md transition-all duration-500 ease-out ${
                      item.isToday
                        ? "bg-lime-400 group-hover:bg-lime-500 ring-1 ring-forest-900/20"
                        : item.pcs > 0
                        ? "bg-forest-900/80 group-hover:bg-forest-900"
                        : "bg-line/40"
                    }`}
                  />
                </div>

                {/* Label Hari & Tanggal di bawah bar */}
                <div className="mt-2 text-center w-full">
                  <span
                    className={`text-[11px] sm:text-[12px] block font-semibold leading-tight ${
                      item.isToday ? "text-forest-900 font-bold" : "text-ink"
                    }`}
                  >
                    {item.dayLabel}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-muted block leading-none mt-0.5">
                    {item.dateLabel}
                  </span>
                  {item.isToday && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-forest-900 mt-1" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
