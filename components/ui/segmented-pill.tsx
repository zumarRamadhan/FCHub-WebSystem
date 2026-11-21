import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption {
  value: string;
  label: string;
  badge?: string | number;
}

interface SegmentedPillProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  activeVariant?: "surface" | "dark";
  className?: string;
}

/**
 * SegmentedPill: Kontrol pemilih segmented berbasis pill.
 * Mengacu design-fchub.md:
 * Wadah surface-muted, opsi aktif berlatar putih (surface) atau forest-900.
 */
export function SegmentedPill({
  options,
  value,
  onChange,
  activeVariant = "surface",
  className,
}: SegmentedPillProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center p-1 bg-surface-muted rounded-pill gap-1 select-none",
        className
      )}
      role="tablist"
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "px-4 py-1.5 rounded-pill text-[13px] font-medium transition-all duration-150 flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-forest-900",
              isActive
                ? activeVariant === "dark"
                  ? "bg-forest-900 text-white shadow-sm"
                  : "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink hover:bg-surface/50"
            )}
          >
            <span>{option.label}</span>
            {option.badge !== undefined && (
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-semibold",
                  isActive
                    ? activeVariant === "dark"
                      ? "bg-white/20 text-white"
                      : "bg-surface-muted text-ink"
                    : "bg-surface text-muted"
                )}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
