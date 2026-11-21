import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 - 100
  max?: number;
  showPill?: boolean;
  pillText?: string;
}

/**
 * ProgressBar: Indikator kemajuan horizontal.
 * Track surface-muted tinggi 8px, isi lime-400,
 * dan pill indikator persentase forest-900 kecil.
 */
export function ProgressBar({
  value,
  max = 100,
  showPill = false,
  pillText,
  className,
  ...props
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  const text = pillText || `${percentage}%`;

  return (
    <div className={cn("w-full relative", className)} {...props}>
      {showPill && (
        <div className="flex justify-end mb-1.5">
          <span className="inline-block px-2 py-0.5 bg-forest-900 text-white rounded-full text-[11px] font-semibold leading-none shadow-sm">
            {text}
          </span>
        </div>
      )}
      <div
        className="h-2 w-full bg-surface-muted rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="h-full bg-lime-400 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
