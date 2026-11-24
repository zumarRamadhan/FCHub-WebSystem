"use client";

import * as React from "react";
import { Moon, Sparkles } from "lucide-react";
import { Mascot } from "./Mascot";
import { determineGreeting, getFirstName, TailorGreetingContext } from "@/lib/messages";

export interface DailyGreetingProps {
  context: TailorGreetingContext;
  className?: string;
}

const STORAGE_ANIM_KEY = "fchub_mascot_anim_enabled";

export function DailyGreeting({ context, className = "" }: DailyGreetingProps) {
  // State pengaturan animasi maskot (localStorage dengan fallback aman)
  const [isAnimEnabled, setIsAnimEnabled] = React.useState<boolean>(true);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ANIM_KEY);
      if (saved !== null) {
        setIsAnimEnabled(saved === "true");
      }
    } catch {
      // Abaikan bila di-disable oleh browser
    }
  }, []);

  const toggleAnim = () => {
    const nextVal = !isAnimEnabled;
    setIsAnimEnabled(nextVal);
    try {
      localStorage.setItem(STORAGE_ANIM_KEY, String(nextVal));
    } catch {
      // Abaikan
    }
  };

  const greeting = React.useMemo(() => {
    return determineGreeting(context);
  }, [context]);

  const firstName = getFirstName(context.nama);

  // KONDISI KHUSUS: Bila pose null (fallback aman tanpa maskot)
  if (greeting.pose === null) {
    return (
      <div
        className={`bg-surface p-4 sm:p-5 rounded-card border border-line shadow-card flex items-center gap-3.5 ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="w-11 h-11 rounded-control bg-forest-900/10 text-forest-900 flex items-center justify-center shrink-0">
          <Moon className="w-5 h-5 text-forest-900" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] sm:text-[15px] font-semibold text-ink leading-snug">
            Halo, {firstName}!
          </p>
          <p className="text-[12.5px] sm:text-[13px] text-muted leading-relaxed mt-0.5">
            {greeting.pesan}
          </p>
        </div>
      </div>
    );
  }

  // KONDISI UTAMA: Menampilkan Maskot Fiko dengan pose sesuai konteks
  // (termasuk pose 'istirahat' saat hari libur, 'ajakan', 'belumCapai', 'tercapai', atau 'melampaui')
  return (
    <div
      className={`bg-surface p-4 sm:p-5 rounded-card border border-line shadow-card relative overflow-hidden ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3.5 sm:gap-5">
        {/* Maskot Fiko (96px di HP, 120px di Desktop) */}
        <div className="shrink-0">
          {/* Mobile height 96px */}
          <div className="sm:hidden">
            <Mascot
              pose={greeting.pose}
              size={96}
              animate={isAnimEnabled}
              priority={true}
            />
          </div>
          {/* Desktop height 120px */}
          <div className="hidden sm:block">
            <Mascot
              pose={greeting.pose}
              size={120}
              animate={isAnimEnabled}
              priority={true}
            />
          </div>
        </div>

        {/* Teks Sapaan & Pesan Hangat */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] sm:text-[17px] font-bold text-ink leading-tight truncate">
                Halo, {firstName}!
              </h2>
              {greeting.isHolidayNoInput && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-forest-900/10 text-forest-900 text-[10.5px] font-semibold">
                  <Moon className="w-3 h-3 text-forest-900" /> Hari Libur
                </span>
              )}
            </div>

            {/* Pengaturan Cepat: Toggle Animasi Maskot */}
            <button
              type="button"
              onClick={toggleAnim}
              title={isAnimEnabled ? "Matikan animasi maskot" : "Nyalakan animasi maskot"}
              className={`p-1.5 rounded-pill border text-[11px] font-semibold flex items-center gap-1 transition ${
                isAnimEnabled
                  ? "bg-surface-muted text-forest-900 border-line hover:border-forest-900/40"
                  : "bg-surface text-muted border-line/60 opacity-70 hover:opacity-100"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-forest-900" />
              <span className="hidden md:inline">
                {isAnimEnabled ? "Animasi Aktif" : "Animasi Diam"}
              </span>
            </button>
          </div>

          <p className="text-[13px] sm:text-[14px] text-ink/85 font-medium leading-relaxed mt-1">
            {greeting.pesan}
          </p>
        </div>
      </div>
    </div>
  );
}
