"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  Layers,
  ArrowRight,
  Info,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { SegmentedPill, SegmentedOption } from "@/components/ui/segmented-pill";
import {
  formatRupiah,
  getJakartaTodayString,
  formatDateId,
  formatWageCalculation,
  formatTarifPerPcs,
} from "@/lib/format";
import { createEntryAction, getGreetingContextAction } from "@/app/penjahit/actions";
import { DailyGreeting } from "@/components/mascot/DailyGreeting";
import { Mascot } from "@/components/mascot/Mascot";
import {
  SubmissionCelebrationModal,
  SubmissionCelebrationData,
} from "@/components/mascot/SubmissionCelebrationModal";
import { TailorGreetingContext, determineSubmissionCelebration } from "@/lib/messages";

export interface ActiveProject {
  id: string;
  nama: string;
  tarif_per_pcs: number;
  reward_aktif?: boolean;
}

interface InputClientProps {
  projects: ActiveProject[];
  initialLastUsedProjectId?: string;
  initialGreetingContext?: TailorGreetingContext;
}

const LOCAL_STORAGE_LAST_PROJECT_KEY = "fchub_last_project_id";

export function InputClient({
  projects,
  initialLastUsedProjectId,
  initialGreetingContext,
}: InputClientProps) {
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

  // 1. Simpan dan dapatkan proyek terakhir yang dipakai penjahit (localStorage + fallback server)
  const [lastUsedId, setLastUsedId] = React.useState<string | undefined>(
    initialLastUsedProjectId
  );

  React.useEffect(() => {
    try {
      const storedId = localStorage.getItem(LOCAL_STORAGE_LAST_PROJECT_KEY);
      if (storedId && projects.some((p) => p.id === storedId)) {
        setLastUsedId(storedId);
        setSelectedProjectId(storedId);
        return;
      }
    } catch {
      // Abaikan bila localStorage tidak tersedia (private browsing / sandbox)
    }

    if (initialLastUsedProjectId && projects.some((p) => p.id === initialLastUsedProjectId)) {
      setSelectedProjectId(initialLastUsedProjectId);
    } else if (projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, initialLastUsedProjectId]);

  // Urutkan opsi: proyek terakhir dipakai penjahit lebih dulu, lalu abjad
  const sortedProjects = React.useMemo(() => {
    const list = [...projects];
    return list.sort((a, b) => {
      if (lastUsedId && a.id === lastUsedId) return -1;
      if (lastUsedId && b.id === lastUsedId) return 1;
      return a.nama.localeCompare(b.nama, "id", { sensitivity: "base" });
    });
  }, [projects, lastUsedId]);

  const [selectedProjectId, setSelectedProjectId] = React.useState<string>(() => {
    if (initialLastUsedProjectId && projects.some((p) => p.id === initialLastUsedProjectId)) {
      return initialLastUsedProjectId;
    }
    return projects[0]?.id || "";
  });

  const handleProjectChange = (newId: string) => {
    setSelectedProjectId(newId);
    setLastUsedId(newId);
    try {
      localStorage.setItem(LOCAL_STORAGE_LAST_PROJECT_KEY, newId);
    } catch {
      // Abaikan error localStorage
    }
  };

  // Opsi tanggal: "hari-ini" | "kemarin" | "kustom"
  const [dateMode, setDateMode] = React.useState<"hari-ini" | "kemarin" | "kustom">("hari-ini");
  const [customDate, setCustomDate] = React.useState<string>(todayStr);

  const activeDate =
    dateMode === "hari-ini" ? todayStr : dateMode === "kemarin" ? yesterdayStr : customDate;

  // Konteks Sapaan Maskot Fiko & Perayaan
  const [greetingContext, setGreetingContext] = React.useState<TailorGreetingContext | undefined>(
    initialGreetingContext
  );
  const [celebrationData, setCelebrationData] = React.useState<SubmissionCelebrationData | null>(null);
  const [isCelebrationOpen, setIsCelebrationOpen] = React.useState<boolean>(false);

  // Perbarui konteks sapaan saat tanggal kerja diubah
  React.useEffect(() => {
    let isMounted = true;
    getGreetingContextAction(activeDate).then((res) => {
      if (isMounted && res.success && res.data) {
        setGreetingContext(res.data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [activeDate]);

  // Nilai pcs default target harian = 100
  const [qty, setQty] = React.useState<number>(100);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorState, setErrorState] = React.useState<{
    type: "validation" | "failed" | "duplicate";
    message: string;
  } | null>(null);

  // Proyek yang sedang dipilih
  const currentProject = projects.find((p) => p.id === selectedProjectId) || sortedProjects[0];

  const dateOptions: SegmentedOption[] = [
    { value: "hari-ini", label: "Hari Ini" },
    { value: "kemarin", label: "Kemarin" },
    { value: "kustom", label: "Pilih Tanggal" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorState(null);

    if (!selectedProjectId) {
      setErrorState({ type: "validation", message: "Silakan pilih proyek pengerjaan." });
      return;
    }

    if (qty <= 0) {
      setErrorState({ type: "validation", message: "Jumlah pcs harus lebih dari 0." });
      return;
    }

    setIsSubmitting(true);

    const totalSebelumnya = greetingContext?.totalPcsHariIni || 0;
    const targetHarian = greetingContext?.targetHarian || 100;
    const inputQty = Number(qty);
    const totalBaru = totalSebelumnya + inputQty;
    const isFirstEntryToday = totalSebelumnya === 0;

    const result = await createEntryAction({
      project_id: selectedProjectId,
      tanggal_kerja: activeDate,
      qty: inputQty,
    });

    if (!result.success) {
      setIsSubmitting(false);

      if (result.alreadyRecorded) {
        setErrorState({
          type: "duplicate",
          message: result.error || "Sepertinya input ini sudah tercatat",
        });
        // Kosongkan form agar tidak memicu duplikasi berulang
        setQty(100);
        return;
      }

      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      setErrorState({
        type: "failed",
        message: isOffline
          ? "Sepertinya sinyal sedang putus. Isianmu aman, coba kirim lagi saat tersambung."
          : (result.error || "Gagal terkirim. Isianmu aman, coba lagi."),
      });
      // Isian form tetap utuh (qty dipertahankan)
      return;
    }

    // Simpan proyek terakhir sukses ke localStorage
    try {
      localStorage.setItem(LOCAL_STORAGE_LAST_PROJECT_KEY, selectedProjectId);
    } catch {
      // Abaikan error localStorage
    }

    // Tentukan perayaan maskot (perayaan penuh vs kompak)
    const celebration = determineSubmissionCelebration({
      qtyBaru: inputQty,
      totalSebelumnya,
      totalBaru,
      targetHarian,
      isFirstEntryToday,
    });

    setCelebrationData(celebration);
    setIsCelebrationOpen(true);

    // Update state konteks sapaan lokal agar angka dan pesan langsung sinkron
    if (greetingContext) {
      setGreetingContext({
        ...greetingContext,
        totalPcsHariIni: totalBaru,
      });
    }

    // Kolom angka di-reset agar form langsung siap diisi lagi (maksimal 3 ketukan)
    setQty(100);
    setIsSubmitting(false);
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
      {/* Sapaan Hangat Maskot Fiko di Atas Form Input */}
      {greetingContext && <DailyGreeting context={greetingContext} />}

      {/* Modal / Sheet Perayaan Setelah Kirim Entri */}
      <SubmissionCelebrationModal
        data={celebrationData}
        isOpen={isCelebrationOpen}
        onClose={() => setIsCelebrationOpen(false)}
        onInputAgain={() => setIsCelebrationOpen(false)}
      />

      {/* Kartu Formulir Input Utama */}
      <Card className="p-5 sm:p-6 shadow-card">
        <CardHeader
          icon={<Layers className="w-5 h-5 text-forest-900" />}
          title="Input Hasil Kerja Harian"
          subtitle="Pencatatan cepat maksimal 3 ketukan"
        />

        <CardContent className="p-0 pt-1">
          {errorState && errorState.type === "validation" && (
            <div className="mb-4 p-3 rounded-panel bg-negative/10 border border-negative/20 text-negative text-[13px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 stroke-[2]" />
              <span>{errorState.message}</span>
            </div>
          )}

          {errorState && errorState.type === "duplicate" && (
            <div className="mb-4 p-4 rounded-card bg-emerald-50 border border-emerald-200 text-forest-900 text-[13px] flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-forest-900 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="font-semibold text-ink text-[14px]">Input Sudah Masuk</p>
                <p className="text-muted text-[13px]">{errorState.message}</p>
                <div className="pt-1">
                  <Link href="/penjahit/riwayat">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-10 min-h-[44px] px-4 text-[13px] font-medium"
                    >
                      Lihat Riwayat
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {errorState && errorState.type === "failed" && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-4 p-4 rounded-card bg-surface-muted border border-line text-ink text-center flex flex-col items-center justify-center gap-2"
            >
              <Mascot pose="gagal" size={96} animate={true} />
              <h4 className="text-[15px] font-semibold text-ink">Gagal Terkirim</h4>
              <p className="text-[13px] text-muted max-w-xs">{errorState.message}</p>
              <Button
                type="button"
                onClick={(e) => handleSubmit(e)}
                variant="primary"
                className="mt-2 min-h-[44px] h-11 px-5 text-[13px]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Mencoba lagi..." : "Coba Lagi"}
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 1. Pemilih Proyek (Dropdown Native <select>) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="project-select"
                  className="block text-[12px] font-semibold text-muted uppercase tracking-wider"
                >
                  1. Pilih Proyek
                </label>
                {projects.length === 1 && (
                  <span className="text-[11px] font-semibold text-forest-900 bg-lime-100 px-2.5 py-0.5 rounded-pill border border-lime-400/30">
                    1 Proyek Aktif
                  </span>
                )}
              </div>

              {projects.length === 0 ? (
                <div className="p-4 rounded-[14px] bg-surface-muted border border-line text-center text-muted">
                  <p className="text-[13px] font-semibold text-ink">
                    Tidak ada proyek aktif saat ini
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Silakan hubungi owner untuk mengaktifkan proyek sebelum mengisi input.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="project-select"
                    value={selectedProjectId}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    disabled={projects.length === 1 || isSubmitting}
                    className={`w-full min-h-[56px] h-14 pl-4 pr-11 bg-surface-muted border border-line rounded-[14px] text-[16px] text-ink font-medium appearance-none transition-all truncate focus:outline-none focus:border-forest-900 focus:ring-2 focus:ring-forest-900/10 ${projects.length === 1
                      ? "cursor-not-allowed opacity-90 select-none"
                      : "cursor-pointer"
                      }`}
                  >
                    {projects.length > 1 && !selectedProjectId && (
                      <option value="" disabled hidden>
                        Pilih proyek
                      </option>
                    )}
                    {sortedProjects.map((p) => (
                      <option key={p.id} value={p.id} className="text-ink text-[15px] py-2">
                        {p.nama}
                        {p.reward_aktif ? " (Ada reward)" : ""}
                      </option>
                    ))}
                  </select>

                  {/* Ikon Chevron Lucide di kanan */}
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-muted">
                    <ChevronDown className="w-5 h-5 stroke-[2]" />
                  </div>
                </div>
              )}

              {projects.length === 1 && (
                <p className="text-[11px] text-muted mt-1.5 pl-0.5">
                  Hanya ada satu proyek aktif saat ini. Pilihan otomatis diterapkan.
                </p>
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
                  <span className="text-[12px] font-medium text-forest-900 font-mono">
                    Tarif: {formatTarifPerPcs(currentProject.tarif_per_pcs)}
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
                <div>
                  <span className="text-muted block text-[11px]">Estimasi Upah:</span>
                  <span className="text-[11px] font-mono text-muted">
                    {formatWageCalculation(
                      qty,
                      currentProject?.tarif_per_pcs || 500,
                      qty * (currentProject?.tarif_per_pcs || 500)
                    )}
                  </span>
                </div>
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
                disabled={isSubmitting || qty <= 0 || !selectedProjectId || projects.length === 0}
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
