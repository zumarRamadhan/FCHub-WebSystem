"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, History, Plus, X } from "lucide-react";
import { Mascot } from "./Mascot";
import { MascotPose } from "@/lib/mascot";
import { Button } from "@/components/ui/button";

export interface SubmissionCelebrationData {
  isFullCelebration: boolean;
  pose: MascotPose;
  headline: string;
  pesan: string;
}

export interface SubmissionCelebrationModalProps {
  data: SubmissionCelebrationData | null;
  isOpen: boolean;
  onClose: () => void;
  onInputAgain: () => void;
}

export function SubmissionCelebrationModal({
  data,
  isOpen,
  onClose,
  onInputAgain,
}: SubmissionCelebrationModalProps) {
  // Timer auto dismiss (3 detik untuk full, 2.5 detik untuk compact)
  React.useEffect(() => {
    if (!isOpen || !data) return;

    const duration = data.isFullCelebration ? 3500 : 2500;
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [isOpen, data, onClose]);

  if (!isOpen || !data) return null;

  // VARIAN 1: PERAYAAN PENUH (Bottom Sheet di HP, Modal di Desktop)
  if (data.isFullCelebration) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[2px] p-0 sm:p-4 animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-md bg-surface rounded-t-[28px] sm:rounded-card border border-line shadow-2xl p-6 sm:p-7 relative overflow-hidden animate-in slide-in-from-bottom-6 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tombol Tutup Silang Pojok Kanan */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup perayaan"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-muted hover:bg-line/70 flex items-center justify-center text-muted hover:text-ink transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-center text-center">
            {/* Maskot Fiko Pose Sesuai Pencapaian (170px) */}
            <div className="my-2">
              <Mascot pose={data.pose} size={170} animate={true} priority={true} />
            </div>

            {/* Headline Perayaan */}
            <h3
              id="celebration-title"
              className="text-[19px] sm:text-[21px] font-bold text-ink mt-2 leading-tight"
            >
              {data.headline}
            </h3>

            {/* Pesan Hangat */}
            <p className="text-[13.5px] sm:text-[14px] text-ink/80 mt-1.5 leading-relaxed max-w-sm">
              {data.pesan}
            </p>

            {/* Catatan Status Menunggu Owner (Tanpa Nominal Upah) */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-surface-muted border border-line/80 text-[11.5px] font-semibold text-muted mt-3">
              <CheckCircle2 className="w-3.5 h-3.5 text-positive" />
              <span>Menunggu persetujuan owner</span>
            </div>

            {/* Tombol Aksi */}
            <div className="grid grid-cols-2 gap-2.5 w-full mt-6">
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  onInputAgain();
                  onClose();
                }}
                className="h-11 text-[13px] font-semibold"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Input Lagi
              </Button>
              <Link href="/penjahit/riwayat" className="w-full">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full h-11 text-[13px] font-semibold"
                  onClick={onClose}
                >
                  <History className="w-4 h-4 mr-1.5" />
                  Lihat Riwayat
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // VARIAN 2: PERAYAAN KOMPAK (Toast Melayang)
  return (
    <div
      className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 bg-forest-900 text-white p-3.5 rounded-control shadow-2xl border border-forest-900/40 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-200 cursor-pointer"
      role="status"
      aria-live="polite"
      onClick={onClose}
    >
      <div className="shrink-0">
        <Mascot pose={data.pose} size={54} animate={true} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-bold text-lime-400 truncate leading-tight">
          {data.headline}
        </p>
        <p className="text-[11.5px] text-white/90 leading-snug mt-0.5 line-clamp-2">
          {data.pesan}
        </p>
        <span className="text-[10px] text-white/60 block mt-0.5">
          Menunggu persetujuan owner
        </span>
      </div>
    </div>
  );
}
