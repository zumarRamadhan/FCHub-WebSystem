import * as React from "react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

interface RingProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  badge?: string;
}

/**
 * RingProgress: Visualisasi lingkaran progress SVG sederhana.
 * Mengacu design-fchub.md:
 * - Tebal garis 14, track surface-muted, isi lime-400.
 * - Angka hero di tengah, chip perubahan/label di bawahnya.
 */
export function RingProgress({
  value,
  max = 100,
  size = 160,
  strokeWidth = 14,
  label,
  badge,
  className,
  ...props
}: RingProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className={cn("flex flex-col items-center justify-center relative", className)}
      {...props}
    >
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--surface-muted)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Active Fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--lime-400)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {/* Center Numbers */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
          <span className="text-[32px] sm:text-[36px] font-semibold leading-tight text-ink tabular-nums">
            {formatNumber(value)}
          </span>
          {label && (
            <span className="text-[12px] font-medium text-muted leading-tight mt-0.5">
              {label}
            </span>
          )}
        </div>
      </div>

      {/* Chip status / badge di bawah */}
      {badge && (
        <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-pill bg-lime-100 text-positive text-[11px] font-semibold leading-4">
          {badge}
        </span>
      )}
    </div>
  );
}
