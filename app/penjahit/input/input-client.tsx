"use client";

import * as React from "react";
import {
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ArrowRight,
  Info,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { SegmentedPill, SegmentedOption } from "@/components/ui/segmented-pill";
import { formatRupiah, getJakartaTodayString, formatDateId } from "@/lib/format";
import { createEntryAction } from "@/app/penjahit/actions";

export interface ActiveProject {
  id: string;
  nama: string;
  tarif_per_pcs: number;
}

interface InputClientProps {
  projects: ActiveProject[];
}

export function InputClient({ projects }: InputClientProps) {
  const todayStr = getJakartaTodayString();

  // Kemarin dalam zona Asia/Jakarta
  const yesterdayStr = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(d);
  }, []);

  const [selectedProjectId, setSelectedProjectId] = React.useState<string>(
    projects[0]?.id || ""
  );

  // Opsi tanggal: "hari-ini" | "kemarin" | "kustom"
  const [dateMode, setDateMode] = React.useState<"hari-ini" | "kemarin" | "kustom">("hari-ini");
  const [customDate, setCustomDate] = React.useState<string>(todayStr);

  const activeDate = dateMode === "hari-ini" ? todayStr : dateMode === "kemarin" ? yesterdayStr : customDate;

  // Nilai pcs default target harian = 100
  const [qty, setQty] = React.useState<number>(100);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Proyek yang sedang dipilih
  const currentProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  const projectOptions: SegmentedOption[] = projects.map((p) => ({
    value: p.id,
    label: p.nama,
  }));

  const dateOptions: SegmentedOption[] = [
    { value: "hari-ini", label: "Hari Ini" },
    { value: "kemarin", label: "Kemarin" },
    { value: "kustom", label: "Pilih Tanggal" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedProjectId) {
      setErrorMessage("Silakan pilih proyek pengerjaan.");
      return;
    }

    if (qty <= 0) {
      setErrorMessage("Jumlah pcs harus lebih dari 0.");
      return;
    }

    setIsSubmitting(true);

    const result = await createEntryAction({
      project_id: selectedProjectId,
      tanggal_kerja: activeDate,
      qty: Number(qty),
    });

    if (!result.success) {
      setErrorMessage(result.error || "Gagal mengirim hasil kerja.");
      setIsSubmitting(false);
      return;
    }

    // Sesuai design-fchub.md:
    // Tampilkan toast "Terkirim, menunggu persetujuan" dan kolom angka dikosongkan
    setToastMessage("Terkirim, menunggu persetujuan");
    setQty(0);
    setIsSubmitting(false);

    // Hilangkan toast setelah 3.5 detik
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  if (projects.length === 0) {
    return (
      <Card className="text-center py-12 px-6">
        <div className="w-12 h-12 rounded-[16px] bg-surface-muted text-muted mx-auto flex items-center justify-center mb-3">
          <Layers className="w-6 h-6" />
        </div>
        <h3 className="text-[17px] font-semibold text-ink">
          Tidak Ada Proyek Aktif
        </h3>
        <p className="text-[13px] text-muted max-w-sm mx-auto mt-1">
          Saat ini belum ada proyek konveksi yang dibuka oleh owner. Silakan hubungi owner untuk mengaktifkan proyek.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Toast Notifikasi Floating */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-forest-900 text-lime-400 px-4 py-2.5 rounded-pill shadow-2xl text-[13px] font-semibold flex items-center gap-2 border border-lime-400/30 animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <CheckCircle2 className="w-4 h-4 text-lime-400 stroke-[2.5]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Kartu Formulir Input Utama */}
      <Card className="p-5 sm:p-6 shadow-card">
        <CardHeader
          icon={<Layers className="w-5 h-5 text-forest-900" />}
          title="Input Hasil Kerja Harian"
          subtitle="Pencatatan cepat maksimal 3 ketukan"
        />

        <CardContent className="p-0 pt-1">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-panel bg-negative/10 border border-negative/20 text-negative text-[13px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 stroke-[2]" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 1. Pemilih Proyek (SegmentedPill / Tab) */}
            <div>
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-2">
                1. Pilih Proyek
              </label>
              {projects.length <= 3 ? (
                <SegmentedPill
                  options={projectOptions}
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  activeVariant="dark"
                  className="w-full flex justify-between"
                />
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {projects.map((p) => {
                    const isSelected = p.id === selectedProjectId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedProjectId(p.id)}
                        className={`p-3 rounded-panel border text-left flex items-center justify-between transition ${
                          isSelected
                            ? "bg-forest-900 text-white border-forest-900"
                            : "bg-surface-muted text-ink border-line hover:border-forest-900/40"
                        }`}
                      >
                        <span className="text-[13px] font-semibold truncate">
                          {p.nama}
                        </span>
                        <span className={`text-[12px] ${isSelected ? "text-lime-400" : "text-muted"}`}>
                          {formatRupiah(p.tarif_per_pcs)}/pcs
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Pemilih Tanggal Kerja */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider">
                  2. Tanggal Kerja
                </label>
                <span className="text-[12px] font-medium text-forest-900">
                  {formatDateId(activeDate)}
                </span>
              </div>

              <SegmentedPill
                options={dateOptions}
                value={dateMode}
                onChange={(val) => setDateMode(val as "hari-ini" | "kemarin" | "kustom")}
                activeVariant="surface"
                className="w-full flex justify-between mb-2"
              />

              {dateMode === "kustom" && (
                <div className="mt-2 flex items-center gap-2 bg-surface-muted p-2 rounded-panel border border-line">
                  <Calendar className="w-4 h-4 text-muted ml-1" />
                  <input
                    type="date"
                    max={todayStr}
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full bg-transparent text-[13px] text-ink focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* 3. Input Angka Besar (NumberInput) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider">
                  3. Jumlah Selesai (Pcs)
                </label>
                {currentProject && (
                  <span className="text-[12px] text-muted">
                    Tarif: {formatRupiah(currentProject.tarif_per_pcs)} / pcs
                  </span>
                )}
              </div>

              <NumberInput
                value={qty}
                onChange={setQty}
                min={0}
                max={2000}
                step={10}
              />

              {/* Estimasi Upah jika disetujui */}
              <div className="mt-3 flex items-center justify-between p-3 rounded-panel bg-surface-muted border border-line/60 text-[13px]">
                <span className="text-muted">Estimasi Upah:</span>
                <strong className="text-forest-900 font-semibold text-[15px] tabular-nums">
                  {formatRupiah(qty * (currentProject?.tarif_per_pcs || 500))}
                </strong>
              </div>
            </div>

            {/* Tombol Kirim */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full h-12 text-[14px] shadow-sm"
                disabled={isSubmitting || qty <= 0}
              >
                {isSubmitting ? (
                  "Mengirim..."
                ) : (
                  <>
                    <span>Kirim Hasil Kerja</span>
                    <ArrowRight className="ml-1.5 w-4 h-4 stroke-[2.2]" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info Aturan Singkat */}
      <div className="p-3.5 bg-surface rounded-card border border-line/60 text-[12px] text-muted flex items-start gap-2.5">
        <Info className="w-4 h-4 text-muted mt-0.5 shrink-0" />
        <p className="leading-relaxed">
          Input otomatis berstatus <strong>Menunggu</strong> sampai disetujui oleh owner keesokan harinya. Anda dapat mengubah atau menghapus entri ini selama belum disetujui di tab <strong>Riwayat</strong>.
        </p>
      </div>
    </div>
  );
}
