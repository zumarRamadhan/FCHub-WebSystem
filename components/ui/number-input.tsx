import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * NumberInput: Input angka besar sesuai design-fchub.md:
 * - Kolom tinggi 72px, angka 36/600 di tengah.
 * - inputmode="numeric" untuk membuka keypad numerik di HP secara langsung.
 * - Tombol bulat - dan + di kedua sisi dengan target sentuh aman (>= 44x44px).
 */
export function NumberInput({
  value,
  onChange,
  min = 0,
  max = 99999,
  step = 10,
  className,
  disabled = false,
}: NumberInputProps) {
  const handleDecrement = () => {
    if (disabled) return;
    const nextVal = Math.max(min, value - step);
    onChange(nextVal);
  };

  const handleIncrement = () => {
    if (disabled) return;
    const nextVal = Math.min(max, value + step);
    onChange(nextVal);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, "");
    const parsed = parseInt(rawVal, 10);
    if (isNaN(parsed)) {
      onChange(min);
    } else {
      onChange(Math.min(max, Math.max(min, parsed)));
    }
  };

  return (
    <div
      className={cn(
        "h-[72px] bg-surface rounded-card border border-line flex items-center justify-between px-3 sm:px-4 transition-all focus-within:border-forest-900 focus-within:ring-1 focus-within:ring-forest-900",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      {/* Tombol Kurang (-) */}
      <button
        type="button"
        aria-label="Kurangi jumlah"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        className="w-12 h-12 min-w-[44px] min-h-[44px] rounded-full bg-surface-muted flex items-center justify-center text-ink hover:bg-line transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
      >
        <Minus className="w-5 h-5 stroke-[2.5]" />
      </button>

      {/* Kolom Angka Besar di Tengah */}
      <div className="flex-1 px-2 text-center">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value === 0 ? "" : value}
          placeholder="0"
          onChange={handleInputChange}
          disabled={disabled}
          className="w-full bg-transparent text-center text-[36px] font-semibold text-ink leading-none tabular-nums focus:outline-none placeholder:text-muted/40"
        />
        <div className="text-[12px] font-medium text-muted mt-0.5 select-none">
          pcs
        </div>
      </div>

      {/* Tombol Tambah (+) */}
      <button
        type="button"
        aria-label="Tambah jumlah"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        className="w-12 h-12 min-w-[44px] min-h-[44px] rounded-full bg-surface-muted flex items-center justify-center text-ink hover:bg-line transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
      >
        <Plus className="w-5 h-5 stroke-[2.5]" />
      </button>
    </div>
  );
}
