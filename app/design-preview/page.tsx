"use client";

import * as React from "react";
import {
  Sparkles,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Smartphone,
  Monitor,
  Check,
  X,
  Calendar,
  Sliders,
  DollarSign,
  Package,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { CardAccent } from "@/components/ui/card-accent";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { RingProgress } from "@/components/ui/ring-progress";
import { SegmentedPill, SegmentedOption } from "@/components/ui/segmented-pill";
import { NumberInput } from "@/components/ui/number-input";
import {
  formatNumber,
  formatRupiah,
  formatDateId,
  getJakartaTodayString,
} from "@/lib/format";

export default function DesignPreviewPage() {
  // Mode viewport preview: desktop penuh atau simulasi HP 390px
  const [viewMode, setViewMode] = React.useState<"desktop" | "mobile">("desktop");

  // State interaktif untuk komponen preview
  const [inputPcs, setInputPcs] = React.useState<number>(100);
  const [selectedProject, setSelectedProject] = React.useState<string>("tas-seminar");
  const [selectedRange, setSelectedRange] = React.useState<string>("minggu-ini");

  const projectOptions: SegmentedOption[] = [
    { value: "tas-seminar", label: "Tas Seminar BPS", badge: "Aktif" },
    { value: "tote-bag", label: "Goodie Bag Dinkes" },
    { value: "pouch-kain", label: "Pouch Souvenir" },
  ];

  const rangeOptions: SegmentedOption[] = [
    { value: "minggu-ini", label: "Minggu Ini" },
    { value: "minggu-lalu", label: "Minggu Lalu" },
    { value: "semua", label: "Semua" },
  ];

  const todayStr = getJakartaTodayString();

  return (
    <div className="min-h-screen bg-bg text-ink p-4 sm:p-6 lg:p-8">
      {/* Top Bar Pengontrol Preview */}
      <header className="max-w-[1200px] mx-auto mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-lime-500 inline-block animate-pulse" />
            <h1 className="text-[24px] leading-[32px] font-semibold text-ink">
              FCHub — Design System Preview
            </h1>
          </div>
          <p className="text-[13px] text-muted mt-1">
            Panduan visual sesuai <code className="text-forest-900 font-semibold">design-fchub.md</code> & fondasi <code className="text-forest-900 font-semibold">AGENTS.md</code>
          </p>
        </div>

        {/* Mode Simulator HP (390px) vs Layar Penuh */}
        <div className="flex items-center gap-2 bg-surface p-1 rounded-pill border border-line">
          <button
            type="button"
            onClick={() => setViewMode("mobile")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-[12px] font-semibold transition ${
              viewMode === "mobile"
                ? "bg-forest-900 text-white"
                : "text-muted hover:text-ink"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Layar HP (390px)
          </button>
          <button
            type="button"
            onClick={() => setViewMode("desktop")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-[12px] font-semibold transition ${
              viewMode === "desktop"
                ? "bg-forest-900 text-white"
                : "text-muted hover:text-ink"
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            Layar Desktop
          </button>
        </div>
      </header>

      {/* Kontainer Utama Sesuai Mode */}
      <main
        className={`mx-auto transition-all duration-300 ${
          viewMode === "mobile"
            ? "max-w-[390px] border-4 border-line/80 rounded-[32px] p-4 bg-bg shadow-2xl overflow-hidden"
            : "max-w-[1200px]"
        }`}
      >
        {/* Sapaan Header & Avatar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-forest-900 text-lime-400 font-semibold text-[15px] flex items-center justify-center select-none shadow-sm">
              BP
            </div>
            <div>
              <p className="text-[12px] font-medium text-muted">Selamat datang</p>
              <h2 className="text-[20px] sm:text-[24px] leading-tight font-semibold text-ink">
                Halo, Budi Santoso
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 bg-lime-100 text-positive rounded-pill text-[12px] font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> Penjahit
            </span>
          </div>
        </div>

        {/* SECTION 1: Grid Kartu Utama (Hero 8 Kolom + Aksen Lime 4 Kolom) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
          {/* Kartu Hero Utama (8 Kolom Desktop) */}
          <Card className="lg:col-span-8 flex flex-col justify-between">
            <div>
              <CardHeader
                icon={<Package className="w-5 h-5 text-forest-900" />}
                title="Pcs Disetujui Minggu Ini"
                subtitle="Proyek: Tas Seminar BPS"
                action={
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-lime-100 text-positive text-[11px] font-semibold">
                    <TrendingUp className="w-3 h-3" /> +15% vs minggu lalu
                  </span>
                }
              />
              <div className="mt-3">
                <div className="text-[36px] sm:text-[44px] leading-none font-semibold text-ink tabular-nums">
                  {formatNumber(720)} <span className="text-[18px] sm:text-[20px] font-normal text-muted">pcs</span>
                </div>
                <p className="text-[14px] text-muted mt-2">
                  Estimasi Upah:{" "}
                  <strong className="text-forest-900 font-semibold">
                    {formatRupiah(720 * 500)}
                  </strong>{" "}
                  <span className="text-[12px] text-muted">(Tarif Rp500/pcs)</span>
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-line/60 flex items-center justify-between">
              <div>
                <p className="text-[12px] text-muted">Target Minggu Ini</p>
                <p className="text-[14px] font-semibold text-ink">720 / 600 pcs (120%)</p>
              </div>
              {/* Tombol Aksi Bulat 64px Lime Sesuai Referensi */}
              <Button
                variant="accentAction"
                aria-label="Input hasil kerja baru"
                title="Input Hasil Kerja"
              />
            </div>
          </Card>

          {/* Kartu Aksen Lime (4 Kolom Desktop - Hanya 1 per Layar) */}
          <CardAccent className="lg:col-span-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-forest-900 text-white text-[11px] font-semibold">
                  <Sparkles className="w-3 h-3" /> Peringkat #2
                </div>
                <span className="text-[12px] font-semibold text-forest-900/80">
                  Ambang Reward
                </span>
              </div>

              <h3 className="text-[16px] font-semibold text-forest-900 mb-1">
                Progres Menuju Reward
              </h3>
              <p className="text-[13px] text-forest-900/80 mb-4">
                Capai 1.500 pcs untuk masuk kriteria bonus akhir proyek konveksi.
              </p>

              <div className="bg-forest-900/10 rounded-panel p-3 mb-4">
                <div className="flex justify-between text-[13px] font-semibold mb-1">
                  <span>Tercapai</span>
                  <span className="tabular-nums">1.250 / 1.500 pcs</span>
                </div>
                {/* Progress bar di atas lime */}
                <div className="h-2 w-full bg-forest-900/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-forest-900 rounded-full transition-all"
                    style={{ width: "83%" }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-[12px] font-semibold text-forest-900">
              <span>Kurang 250 pcs lagi</span>
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </CardAccent>
        </section>

        {/* SECTION 2: Grid 3 Kartu (Produksi Hari Ini, Input Cepat, Status Rekap) */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Kartu RingProgress Produksi Hari Ini */}
          <Card className="flex flex-col items-center justify-center p-6 text-center">
            <CardHeader
              className="w-full text-left mb-2"
              icon={<Calendar className="w-5 h-5 text-forest-900" />}
              title="Hari Ini"
              subtitle={`Tanggal: ${formatDateId(todayStr)}`}
            />
            <div className="py-2">
              <RingProgress
                value={inputPcs}
                max={100}
                size={150}
                strokeWidth={14}
                label="Target 100 pcs"
                badge={inputPcs >= 100 ? "Target Tercapai!" : "Sisa " + (100 - inputPcs) + " pcs"}
              />
            </div>
            <p className="text-[12px] text-muted mt-2">
              Zona Waktu: Asia/Jakarta (WIB)
            </p>
          </Card>

          {/* Kartu NumberInput Interaktif */}
          <Card className="flex flex-col justify-between">
            <div>
              <CardHeader
                icon={<Sliders className="w-5 h-5 text-forest-900" />}
                title="Input Angka Harian"
                subtitle="Maks 3 ketukan (keypad numerik)"
              />
              <p className="text-[13px] text-muted mb-3">
                Coba tombol <code className="text-forest-900 font-semibold">-</code> dan <code className="text-forest-900 font-semibold">+</code> atau ketik langsung angka:
              </p>
              <NumberInput
                value={inputPcs}
                onChange={setInputPcs}
                min={0}
                max={500}
                step={10}
              />
            </div>
            <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between">
              <span className="text-[12px] text-muted">Estimasi Upah Hari Ini</span>
              <span className="text-[14px] font-semibold text-forest-900">
                {formatRupiah(inputPcs * 500)}
              </span>
            </div>
          </Card>

          {/* Kartu Pilihan Proyek & Progress Global */}
          <Card className="flex flex-col justify-between">
            <div>
              <CardHeader
                icon={<Layers className="w-5 h-5 text-forest-900" />}
                title="Pilih Proyek"
                subtitle="Segmented pill kontrol"
              />
              <div className="mb-4">
                <SegmentedPill
                  options={projectOptions}
                  value={selectedProject}
                  onChange={setSelectedProject}
                  activeVariant="dark"
                  className="w-full flex justify-between"
                />
              </div>

              <div className="space-y-2 mt-4">
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted">Progres Total Pesanan Proyek</span>
                  <span className="font-semibold text-ink tabular-nums">7.200 / 16.000 pcs</span>
                </div>
                <ProgressBar value={45} max={100} showPill pillText="45%" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between">
              <span className="text-[12px] text-muted">Deadline: 28 Nov 2026</span>
              <span className="text-[12px] font-semibold text-positive">Tepat Waktu</span>
            </div>
          </Card>
        </section>

        {/* SECTION 3: Komponen Tombol, Status Badge, dan Format Helpers */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {/* Showcase Varian Tombol & Status Badge */}
          <Card>
            <CardHeader
              icon={<Check className="w-5 h-5 text-positive" />}
              title="Varian Tombol & Status Badge"
              subtitle="Elemen interaksi standar FCHub"
            />
            <div className="space-y-4 pt-1">
              <div>
                <p className="text-[12px] font-medium text-muted mb-2">Gaya Tombol:</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary">Tombol Primer</Button>
                  <Button variant="primary" arrowIcon>Kirim Input</Button>
                  <Button variant="secondary">Sekunder</Button>
                  {/* Ikon Aksi Bulat Kecil (Approval) */}
                  <div className="flex items-center gap-2 pl-2 border-l border-line">
                    <button
                      type="button"
                      aria-label="Setujui"
                      className="w-9 h-9 rounded-full bg-lime-100 text-positive flex items-center justify-center hover:bg-lime-500 transition active:scale-95"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      aria-label="Tolak"
                      className="w-9 h-9 rounded-full bg-negative/10 text-negative flex items-center justify-center hover:bg-negative/20 transition active:scale-95"
                    >
                      <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-line/60">
                <p className="text-[12px] font-medium text-muted mb-2">Status Input Produksi (Ikon + Teks Wajib):</p>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge status="menunggu" />
                  <StatusBadge status="disetujui" />
                  <StatusBadge status="ditolak" />
                </div>
              </div>

              <div className="pt-3 border-t border-line/60">
                <p className="text-[12px] font-medium text-muted mb-2">Filter Rentang Waktu (Segmented Pill):</p>
                <SegmentedPill
                  options={rangeOptions}
                  value={selectedRange}
                  onChange={setSelectedRange}
                  activeVariant="surface"
                />
              </div>
            </div>
          </Card>

          {/* Showcase Format Utility (lib/format.ts) */}
          <Card>
            <CardHeader
              icon={<DollarSign className="w-5 h-5 text-forest-900" />}
              title="Pengujian Format (lib/format.ts)"
              subtitle="Standarisasi id-ID dan Asia/Jakarta"
            />
            <div className="space-y-3 pt-1 text-[13px]">
              <div className="p-3 bg-surface-muted rounded-panel flex justify-between items-center">
                <span className="text-muted">Format Angka Ribuan:</span>
                <span className="font-semibold text-ink font-mono">
                  formatNumber(16000) = <strong className="text-forest-900">{formatNumber(16000)}</strong>
                </span>
              </div>

              <div className="p-3 bg-surface-muted rounded-panel flex justify-between items-center">
                <span className="text-muted">Format Rupiah:</span>
                <span className="font-semibold text-ink font-mono">
                  formatRupiah(5000000) = <strong className="text-forest-900">{formatRupiah(5000000)}</strong>
                </span>
              </div>

              <div className="p-3 bg-surface-muted rounded-panel flex justify-between items-center">
                <span className="text-muted">Tanggal ID (id-ID):</span>
                <span className="font-semibold text-ink font-mono">
                  formatDateId(&quot;2026-11-21&quot;) = <strong className="text-forest-900">{formatDateId("2026-11-21")}</strong>
                </span>
              </div>

              <div className="p-3 bg-surface-muted rounded-panel flex justify-between items-center">
                <span className="text-muted">Hari Ini (Asia/Jakarta):</span>
                <span className="font-semibold text-ink font-mono">
                  getJakartaTodayString() = <strong className="text-forest-900">{todayStr}</strong>
                </span>
              </div>
            </div>
          </Card>
        </section>

        {/* Footer Info Sesuai AGENTS.md */}
        <footer className="text-center py-6 text-[12px] text-muted border-t border-line/60">
          <p>FCHub — Konveksi Firdaus Collection · Tahap 1 Fondasi UI Selesai</p>
          <p className="mt-1">
            Mendukung target 15-18 penjahit · 100 pcs/hari · Mobile-First Responsive
          </p>
        </footer>
      </main>
    </div>
  );
}
