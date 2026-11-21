"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Dialog / Sheet:
 * - Mobile (< 640px): Tampil sebagai Bottom Sheet (rounded-t-[24px])
 * - Desktop (>= 640px): Tampil sebagai Centered Modal (rounded-card)
 */
export function Dialog({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  className,
}: DialogProps) {
  // Tutup dengan tombol ESC
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Konten Modal / Sheet */}
      <div
        className={cn(
          "relative z-10 w-full max-w-lg bg-surface shadow-2xl transition-all duration-200",
          // Mobile: Bottom Sheet
          "rounded-t-[24px] max-h-[90vh] overflow-y-auto p-5 sm:p-6",
          // Desktop: Centered Box
          "sm:rounded-card sm:max-h-[85vh]",
          className
        )}
      >
        {/* Header Modal */}
        <div className="flex items-start justify-between gap-3 pb-4 mb-4 border-b border-line/60">
          <div>
            <h3 className="text-[18px] font-semibold text-ink leading-snug">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[13px] text-muted mt-0.5 leading-normal">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="w-8 h-8 rounded-full bg-surface-muted hover:bg-line text-muted hover:text-ink flex items-center justify-center transition active:scale-95 shrink-0"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Body */}
        <div>{children}</div>
      </div>
    </div>
  );
}
