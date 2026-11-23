"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flag,
  Layers,
  Settings,
  X,
  CalendarCheck,
  CalendarX,
  RotateCcw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  formatNumber,
  formatDateId,
} from "@/lib/format";
import {
  CalendarMonthDay,
  ProjectColorKey,
  ProjectStatus,
} from "@/lib/types/database";
import {
  getProjectColor,
  getProjectInitials,
} from "@/lib/project-colors";
import { ProjectSelect } from "@/components/project-select";
import {
  setCalendarExceptionAction,
  deleteCalendarExceptionAction,
  updateWeeklyPatternAction,
} from "./actions";

export interface CalendarProjectItem {
  id: string;
  nama: string;
  target_pcs: number;
  tarif_per_pcs: number;
  status: ProjectStatus;
  warna: ProjectColorKey;
  tanggal_mulai: string;
  deadline: string | null;
  reward_aktif?: boolean;
  ambang_reward?: number;
  total_pcs_disetujui: number;
  persentase_progres: number;
}

export interface DayProductionEntryItem {
  id: string;
  user_id: string;
  project_id: string;
  tanggal_kerja: string;
  qty: number;
  qty_disetujui: number | null;
  tarif_snapshot: number;
  status: "menunggu" | "disetujui" | "ditolak";
  users?: { nama: string; username: string } | null;
  projects?: { nama: string; warna: string } | null;
}

interface KalenderClientProps {
  initialYear: number;
  initialMonth: number;
  selectedProjectId: string;
  monthDays: CalendarMonthDay[];
  projects: CalendarProjectItem[];
  weeklyPattern: number[]; // ISO: 1=Senin s.d. 7=Minggu
  monthEntries: DayProductionEntryItem[];
  todayStr: string;
}

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DAY_HEADERS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const ISO_DAY_NAMES: Record<number, string> = {
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
  7: "Minggu",
};

export function KalenderClient({
  initialYear,
  initialMonth,
  selectedProjectId,
  monthDays,
  projects,
  weeklyPattern,
  monthEntries,
  todayStr,
}: KalenderClientProps) {
  const router = useRouter();

  const [currentYear, setCurrentYear] = React.useState(initialYear);
  const [currentMonth, setCurrentMonth] = React.useState(initialMonth);
  const [selectedProject, setSelectedProject] = React.useState(selectedProjectId);

  // Modal Detail Hari
  const [selectedDay, setSelectedDay] = React.useState<CalendarMonthDay | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = React.useState(false);

  // Modal Ubah Status Hari (Libur / Kerja)
  const [isEditDayModalOpen, setIsEditDayModalOpen] = React.useState(false);
  const [editDayDate, setEditDayDate] = React.useState("");
  const [editDayType, setEditDayType] = React.useState<"libur" | "kerja">("libur");
  const [editDayKeterangan, setEditDayKeterangan] = React.useState("");
  const [isSubmittingDay, setIsSubmittingDay] = React.useState(false);

  // Modal Pola Kerja Mingguan
  const [isPatternModalOpen, setIsPatternModalOpen] = React.useState(false);
  const [patternState, setPatternState] = React.useState<number[]>(weeklyPattern);
  const [isSubmittingPattern, setIsSubmittingPattern] = React.useState(false);

  // Alert State
  const [actionMessage, setActionMessage] = React.useState<{ text: string; type: "success" | "error" } | null>(null);

  // Navigasi Bulan
  const navigateMonth = (direction: "prev" | "next" | "today") => {
    let newYear = currentYear;
    let newMonth = currentMonth;

    if (direction === "today") {
      const [tY, tM] = todayStr.split("-").map(Number);
      newYear = tY;
      newMonth = tM;
    } else if (direction === "prev") {
      if (currentMonth === 1) {
        newMonth = 12;
        newYear = currentYear - 1;
      } else {
        newMonth = currentMonth - 1;
      }
    } else {
      if (currentMonth === 12) {
        newMonth = 1;
        newYear = currentYear + 1;
      } else {
        newMonth = currentMonth + 1;
      }
    }

    setCurrentYear(newYear);
    setCurrentMonth(newMonth);

    const query = new URLSearchParams();
    query.set("tahun", String(newYear));
    query.set("bulan", String(newMonth));
    if (selectedProject !== "all") {
      query.set("project", selectedProject);
    }
    router.push(`/owner/kalender?${query.toString()}`);
  };

  // Filter Proyek
  const handleSelectProject = (projectId: string) => {
    setSelectedProject(projectId);
    const query = new URLSearchParams();
    query.set("tahun", String(currentYear));
    query.set("bulan", String(currentMonth));
    if (projectId !== "all") {
      query.set("project", projectId);
    }
    router.push(`/owner/kalender?${query.toString()}`);
  };

  // Klik Sel Kalender
  const handleDayClick = (day: CalendarMonthDay) => {
    setSelectedDay(day);
    setIsDayModalOpen(true);
  };

  // Buka Modal Edit Status Hari
  const handleOpenEditDay = (day: CalendarMonthDay, forceType?: "libur" | "kerja") => {
    setEditDayDate(day.tanggal);
    const targetType = forceType || (day.is_hari_kerja ? "libur" : "kerja");
    setEditDayType(targetType);
    setEditDayKeterangan(day.keterangan_libur || "");
    setIsDayModalOpen(false);
    setIsEditDayModalOpen(true);
  };

  // Submit Ubah Hari (Libur / Kerja)
  const handleSubmitDayException = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingDay(true);
    setActionMessage(null);

    const res = await setCalendarExceptionAction({
      tanggal: editDayDate,
      jenis: editDayType,
      keterangan: editDayKeterangan,
    });

    setIsSubmittingDay(false);
    if (res.success) {
      setIsEditDayModalOpen(false);
      setActionMessage({ text: `Status tanggal ${formatDateId(editDayDate)} berhasil disimpan.`, type: "success" });
      router.refresh();
    } else {
      setActionMessage({ text: res.error || "Gagal mengubah status hari.", type: "error" });
    }
  };

  // Reset Hari ke Pola Default
  const handleResetDayException = async (tanggal: string) => {
    setIsSubmittingDay(true);
    setActionMessage(null);

    const res = await deleteCalendarExceptionAction(tanggal);
    setIsSubmittingDay(false);

    if (res.success) {
      setIsDayModalOpen(false);
      setActionMessage({ text: `Tanggal ${formatDateId(tanggal)} dikembalikan ke pola mingguan rutin.`, type: "success" });
      router.refresh();
    } else {
      setActionMessage({ text: res.error || "Gagal mereset hari.", type: "error" });
    }
  };

  // Submit Pola Mingguan
  const handleSubmitWeeklyPattern = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingPattern(true);
    setActionMessage(null);

    const res = await updateWeeklyPatternAction(patternState);
    setIsSubmittingPattern(false);

    if (res.success) {
      setIsPatternModalOpen(false);
      setActionMessage({ text: "Pola hari kerja mingguan berhasil diperbarui.", type: "success" });
      router.refresh();
    } else {
      setActionMessage({ text: res.error || "Gagal memperbarui pola kerja.", type: "error" });
    }
  };

  // Toggle hari di modal pola kerja
  const togglePatternDay = (isoDay: number) => {
    setPatternState((prev) => {
      if (prev.includes(isoDay)) {
        if (prev.length === 1) return prev; // Minimal 1 hari kerja
        return prev.filter((d) => d !== isoDay);
      } else {
        return [...prev, isoDay].sort((a, b) => a - b);
      }
    });
  };

  // Kalkulasi sel kosong di awal bulan (agar hari Senin selalu di kolom 0)
  const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
  const firstDayJs = firstDayOfMonth.getDay(); // 0 = Minggu, 1 = Senin, ...
  const leadingEmptyCells = firstDayJs === 0 ? 6 : firstDayJs - 1;

  // Filter entri produksi untuk tanggal yang dipilih di modal detail
  const selectedDayEntries = React.useMemo(() => {
    if (!selectedDay) return [];
    return monthEntries.filter((e) => e.tanggal_kerja === selectedDay.tanggal);
  }, [selectedDay, monthEntries]);

  // Proyek relevan untuk legenda ringkas bulan yang ditampilkan (Aturan Requirement 5)
  // Hanya memuat proyek yang memiliki catatan produksi, deadline, atau rentang kerja melintasi bulan ini
  const monthRelevantProjects = React.useMemo(() => {
    const startOfMonthStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    const endOfMonthStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Kumpulkan ID proyek yang memiliki produksi atau deadline bulan ini
    const activeInMonthIds = new Set<string>();
    monthDays.forEach((d) => {
      d.proyek_produksi.forEach((p) => {
        if (p.pcs_disetujui > 0 || p.pcs_menunggu > 0 || p.is_deadline) {
          activeInMonthIds.add(p.project_id);
        }
      });
    });

    return projects.filter((p) => {
      if (activeInMonthIds.has(p.id)) return true;
      // Proyek yang rentang tanggalnya melintasi bulan ini
      const isStartBeforeOrInMonth = p.tanggal_mulai <= endOfMonthStr;
      const isEndAfterOrInMonth = !p.deadline || p.deadline >= startOfMonthStr;
      return isStartBeforeOrInMonth && isEndAfterOrInMonth;
    });
  }, [projects, monthDays, currentYear, currentMonth]);

  return (
    <div className="space-y-6">
      {/* Notifikasi Aksi */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-panel border text-[13px] flex items-center justify-between gap-2 transition-all ${actionMessage.type === "success"
              ? "bg-lime-50 border-lime-200 text-forest-900"
              : "bg-red-50 border-red-200 text-negative"
            }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-positive shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-negative shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-muted hover:text-ink text-[12px]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Halaman & Navigasi Bulan */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-line/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-forest-900" />
            <h1 className="text-[22px] sm:text-[24px] font-semibold text-ink leading-tight">
              Kalender Kerja & Garis Waktu
            </h1>
          </div>
          <p className="text-[13px] text-muted mt-1">
            Jadwal hari kerja, hari libur konveksi, lembur, dan progres timeline multi-proyek.
          </p>
        </div>

        {/* Tombol Aksi Kanan */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsPatternModalOpen(true)}
            className="text-[12.5px] h-9"
          >
            <Settings className="w-3.5 h-3.5 mr-1.5" />
            Pola Kerja ({weeklyPattern.length} Hari)
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditDayDate(todayStr);
              setEditDayType("libur");
              setEditDayKeterangan("");
              setIsEditDayModalOpen(true);
            }}
            className="text-[12.5px] h-9 bg-forest-900 text-white"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Tandai Libur
          </Button>
        </div>
      </div>

      {/* Bar Pengontrol Bulan & Filter Proyek (Dropdown Pencarian) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3 sm:p-4 rounded-panel border border-line shadow-card">
        {/* Kontrol Navigasi Bulan */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigateMonth("prev")}
            className="w-9 h-9 rounded-control border border-line bg-surface hover:bg-surface-muted flex items-center justify-center text-ink transition active:scale-95"
            title="Bulan Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="min-w-[170px] text-center">
            <h2 className="text-[16px] sm:text-[18px] font-bold text-ink tracking-tight">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => navigateMonth("next")}
            className="w-9 h-9 rounded-control border border-line bg-surface hover:bg-surface-muted flex items-center justify-center text-ink transition active:scale-95"
            title="Bulan Berikutnya"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => navigateMonth("today")}
            className="px-3 h-9 rounded-control border border-line bg-surface-muted text-[12px] font-semibold text-forest-900 hover:bg-surface transition ml-1"
          >
            Bulan Ini
          </button>
        </div>

        {/* Pemilih Proyek Dropdown Pencarian */}
        <div className="w-full sm:w-72 lg:w-80 shrink-0">
          <ProjectSelect
            projects={projects.map((p) => ({
              id: p.id,
              nama: p.nama,
              warna: p.warna,
              status: p.status,
              target_pcs: p.target_pcs,
              persentase_progres: p.persentase_progres,
            }))}
            selectedProjectId={selectedProject}
            onChange={(id) => handleSelectProject(id)}
            syncWithUrl={false}
          />
        </div>
      </div>

      {/* Legenda Ringkas Proyek Bulan Ini (Requirement 5) */}
      {/* Non-klik, dibungkus ke baris berikutnya tanpa gulir horizontal */}
      {monthRelevantProjects.length > 0 && (
        <div className="p-3 bg-surface rounded-card border border-line">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
            <span className="font-semibold text-muted text-[11px] uppercase tracking-wider shrink-0">
              Proyek Bulan Ini:
            </span>
            {monthRelevantProjects.map((p) => {
              const pColor = getProjectColor(p.warna);
              return (
                <div
                  key={p.id}
                  className="inline-flex items-center gap-1.5 select-none"
                  title={`${p.nama} (${p.status})`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${pColor.dotClass} shrink-0`} />
                  <span className="font-medium text-ink truncate max-w-[200px]">
                    {p.nama}
                  </span>
                  <span className="text-[10.5px] text-muted font-bold">
                    ({getProjectInitials(p.nama)})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid Kalender Bulanan */}
      <Card className="p-3 sm:p-5 shadow-card overflow-hidden">
        {/* Header Nama Hari (Sen - Min) */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          {DAY_HEADERS.map((dayName, idx) => {
            const isWeekend = idx >= 5; // Sabtu & Minggu
            return (
              <div
                key={dayName}
                className={`text-center py-2 text-[12px] font-bold uppercase tracking-wider ${isWeekend ? "text-negative/80" : "text-muted"
                  }`}
              >
                {dayName}
              </div>
            );
          })}
        </div>

        {/* Sel Hari */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Sel Kosong Awal Bulan */}
          {Array.from({ length: leadingEmptyCells }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="min-h-[80px] sm:min-h-[105px] rounded-card bg-surface-muted/20 border border-transparent p-1.5 opacity-30 select-none"
            />
          ))}

          {/* Hari dalam Bulan */}
          {monthDays.map((day) => {
            const dayNum = Number(day.tanggal.split("-")[2]) || 1;
            const isToday = day.tanggal === todayStr;
            const isHoliday = !day.is_hari_kerja;
            const hasProduction = day.total_pcs_disetujui > 0 || day.total_pcs_menunggu > 0;
            const hasLembur = day.ada_lembur || (isHoliday && hasProduction);

            // Cek apakah ada deadline pada tanggal ini
            const deadlineProjects = day.proyek_produksi.filter((p) => p.is_deadline);

            return (
              <div
                key={day.tanggal}
                onClick={() => handleDayClick(day)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleDayClick(day)}
                className={`min-h-[82px] sm:min-h-[105px] rounded-card p-1.5 sm:p-2 border transition-all cursor-pointer flex flex-col justify-between relative group ${isToday
                    ? "border-forest-900 ring-2 ring-forest-900/15 bg-lime-50/40 shadow-sm"
                    : isHoliday
                      ? "bg-surface-muted/80 border-line/70 hover:border-line hover:bg-surface-muted"
                      : "bg-surface border-line hover:border-forest-900/40 hover:shadow-xs"
                  }`}
              >
                {/* Header Sel: Nomor Tanggal & Indikator Status */}
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-[12px] sm:text-[13px] font-bold tabular-nums ${isToday
                        ? "bg-forest-900 text-white shadow-xs"
                        : isHoliday
                          ? "text-negative font-semibold"
                          : "text-ink"
                      }`}
                  >
                    {dayNum}
                  </span>

                  <div className="flex flex-col items-end gap-0.5">
                    {/* Badge Lembur pada Hari Libur */}
                    {hasLembur && (
                      <span className="text-[9px] px-1 py-0.2 rounded-pill bg-amber-100 text-amber-800 font-bold border border-amber-300 leading-none">
                        Lembur
                      </span>
                    )}

                    {/* Tag Libur */}
                    {isHoliday && !hasLembur && (
                      <span className="text-[9px] px-1 py-0.2 rounded-pill bg-surface text-muted border border-line font-medium leading-none">
                        Libur
                      </span>
                    )}

                    {/* Flag Deadline */}
                    {deadlineProjects.length > 0 && (
                      <span
                        className="text-[9px] px-1 py-0.2 rounded-pill bg-red-100 text-negative font-bold flex items-center gap-0.5 border border-red-200"
                        title={`Deadline: ${deadlineProjects.map((p) => p.nama_proyek).join(", ")}`}
                      >
                        <Flag className="w-2.5 h-2.5" />
                        <span className="hidden sm:inline">Deadline</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Tengah Sel: Titik Proyek yang Berproduksi */}
                <div className="my-1">
                  {day.proyek_produksi.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {day.proyek_produksi.slice(0, 4).map((p) => {
                        const pColor = getProjectColor(p.warna);
                        return (
                          <span
                            key={p.project_id}
                            className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${pColor.dotClass} shadow-2xs`}
                            title={`${p.nama_proyek}: ${formatNumber(p.pcs_disetujui)} pcs`}
                          />
                        );
                      })}
                      {day.proyek_produksi.length > 4 && (
                        <span className="text-[9px] font-bold text-muted bg-surface-muted px-1 rounded-pill">
                          +{day.proyek_produksi.length - 4}
                        </span>
                      )}
                    </div>
                  ) : isHoliday && day.keterangan_libur ? (
                    <p className="text-[10px] text-muted italic line-clamp-2 leading-tight">
                      {day.keterangan_libur}
                    </p>
                  ) : null}
                </div>

                {/* Bawah Sel: Total Pcs Disetujui */}
                <div className="pt-0.5 border-t border-line/40 flex items-center justify-between text-[10.5px] sm:text-[11.5px]">
                  {day.total_pcs_disetujui > 0 ? (
                    <span className="font-semibold text-positive tabular-nums leading-none">
                      {formatNumber(day.total_pcs_disetujui)}{" "}
                      <span className="text-[9px] font-normal text-muted">pcs</span>
                    </span>
                  ) : day.total_pcs_menunggu > 0 ? (
                    <span className="font-medium text-amber-700 tabular-nums leading-none">
                      +{formatNumber(day.total_pcs_menunggu)}{" "}
                      <span className="text-[9px] text-muted">mng</span>
                    </span>
                  ) : (
                    <span className="text-muted/40 font-normal leading-none">-</span>
                  )}

                  {day.total_penjahit > 0 && (
                    <span className="text-[9.5px] text-muted hidden sm:inline tabular-nums">
                      {day.total_penjahit} pjh
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legenda Kalender Sesuai Pedoman Aksesibilitas design-fchub.md */}
        <div className="mt-5 pt-4 border-t border-line/60 flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-ink">Keterangan:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-forest-900 text-white text-[10px] font-bold flex items-center justify-center">
                17
              </span>
              <span>Hari Ini</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-card bg-surface-muted border border-line" />
              <span>Hari Libur</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-amber-100 text-amber-800 font-bold border border-amber-300">
                Lembur
              </span>
              <span>Kerja di Hari Libur</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5 text-negative" />
              <span>Batas Waktu (Deadline)</span>
            </div>
          </div>

          <div className="text-[11px] text-muted italic">
            Klik salah satu tanggal untuk melihat rincian produksi dan mengubah status libur/kerja.
          </div>
        </div>
      </Card>

      {/* Garis Waktu Multi-Proyek (Timeline Bar) */}
      <Card className="p-4 sm:p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line/60">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-forest-900" />
            <div>
              <h2 className="text-[16px] sm:text-[17px] font-semibold text-ink leading-tight">
                Garis Waktu Multi-Proyek
              </h2>
              <p className="text-[11.5px] text-muted">
                Rentang tanggal mulai sampai batas akhir (deadline) serta progres pencapaian pcs.
              </p>
            </div>
          </div>
          <span className="text-[12px] font-medium text-muted">
            {projects.filter((p) => p.status === "aktif").length} Proyek Aktif
          </span>
        </div>

        {/* Daftar Garis Waktu per Proyek */}
        <div className="space-y-4">
          {projects
            .filter((p) => (selectedProject === "all" ? true : p.id === selectedProject))
            .map((proj) => {
              const pColor = getProjectColor(proj.warna);
              const progressPct = Math.min(100, Math.round(proj.persentase_progres || 0));
              const sisaPcs = Math.max(0, proj.target_pcs - proj.total_pcs_disetujui);

              return (
                <div
                  key={proj.id}
                  className="p-3.5 rounded-card bg-surface-muted/50 border border-line space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    {/* Identitas Proyek: Dot + Inisial + Nama */}
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-[8px] ${pColor.bgClass} border ${pColor.borderClass} flex items-center justify-center ${pColor.textClass} font-bold text-[11px] shadow-2xs`}
                      >
                        {getProjectInitials(proj.nama)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${pColor.dotClass}`} />
                          <h3 className="text-[14px] font-semibold text-ink leading-snug">
                            {proj.nama}
                          </h3>
                        </div>
                        <p className="text-[11.5px] text-muted">
                          Mulai: {formatDateId(proj.tanggal_mulai)}
                          {proj.deadline ? ` • Deadline: ${formatDateId(proj.deadline)}` : " • Tanpa deadline"}
                        </p>
                      </div>
                    </div>

                    {/* Metrik Pcs & Progres */}
                    <div className="text-left sm:text-right text-[12px]">
                      <span className="font-bold text-ink tabular-nums">
                        {formatNumber(proj.total_pcs_disetujui)} / {formatNumber(proj.target_pcs)} pcs
                      </span>
                      <span className="text-muted ml-1.5 font-medium">({progressPct}%)</span>
                      <p className="text-[11px] text-muted">
                        Sisa target: {formatNumber(sisaPcs)} pcs
                      </p>
                    </div>
                  </div>

                  {/* Visual Bar Timeline dengan Persentase */}
                  <div className="relative w-full h-3 rounded-full bg-surface border border-line overflow-hidden shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${pColor.dotClass}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </Card>

      {/* ==================================================================== */}
      {/* DIALOG 1: Rincian Hari yang Diklik */}
      {/* ==================================================================== */}
      <Dialog
        isOpen={isDayModalOpen}
        onClose={() => setIsDayModalOpen(false)}
        title={selectedDay ? formatDateId(selectedDay.tanggal) : "Rincian Tanggal"}
        subtitle="Rincian entri produksi, status hari kerja, dan pengecualian kalender."
      >
        {selectedDay && (
          <div className="space-y-4 pt-1">
            {/* Status Hari Kerja & Keterangan */}
            <div className="p-3.5 rounded-panel bg-surface-muted border border-line flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-bold ${selectedDay.is_hari_kerja
                        ? "bg-lime-100 text-positive"
                        : "bg-red-100 text-negative"
                      }`}
                  >
                    {selectedDay.is_hari_kerja ? (
                      <>
                        <CalendarCheck className="w-3.5 h-3.5" /> Hari Kerja
                      </>
                    ) : (
                      <>
                        <CalendarX className="w-3.5 h-3.5" /> Hari Libur
                      </>
                    )}
                  </span>

                  {selectedDay.ada_lembur && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-amber-100 text-amber-800 text-[10.5px] font-bold border border-amber-300">
                      <Clock className="w-3 h-3" /> Ada Lembur
                    </span>
                  )}
                </div>

                <p className="text-[12px] text-muted mt-1.5">
                  {selectedDay.sumber_status === "kalender" ? (
                    <>
                      <strong>Pengecualian Khusus:</strong> {selectedDay.keterangan_libur || "Tanpa catatan"}
                    </>
                  ) : (
                    <>
                      <strong>Sumber:</strong> Pola Rutin Mingguan (
                      {selectedDay.is_hari_kerja ? "Jadwal masuk" : "Libur mingguan"}
                      )
                    </>
                  )}
                </p>
              </div>

              {/* Tombol Cepat Ubah Status */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleOpenEditDay(selectedDay)}
                  className="text-[11.5px] h-8 px-2.5"
                >
                  {selectedDay.is_hari_kerja ? "Tandai Libur" : "Jadikan Masuk"}
                </Button>

                {selectedDay.sumber_status === "kalender" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleResetDayException(selectedDay.tanggal)}
                    disabled={isSubmittingDay}
                    className="text-[11px] h-7 px-2 text-muted hover:text-ink"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset Pola
                  </Button>
                )}
              </div>
            </div>

            {/* Rincian per Proyek */}
            <div className="space-y-2">
              <h4 className="text-[13px] font-semibold text-ink flex items-center justify-between">
                <span>Produksi per Proyek</span>
                <span className="text-[12px] font-normal text-muted tabular-nums">
                  Total: {formatNumber(selectedDay.total_pcs_disetujui)} pcs
                </span>
              </h4>

              {selectedDay.proyek_produksi.length === 0 ? (
                <div className="p-3 bg-surface rounded-card border border-line text-center text-[12px] text-muted">
                  Belum ada catatan produksi pada tanggal ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDay.proyek_produksi.map((p) => {
                    const pColor = getProjectColor(p.warna);
                    return (
                      <div
                        key={p.project_id}
                        className="p-3 rounded-card bg-surface border border-line flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-3 h-3 rounded-full ${pColor.dotClass} shrink-0`} />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h5 className="text-[13px] font-semibold text-ink leading-tight">
                                {p.nama_proyek}
                              </h5>
                              {p.is_deadline && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-pill bg-red-100 text-negative font-bold flex items-center gap-0.5">
                                  <Flag className="w-2.5 h-2.5" /> Deadline
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted">
                              {p.jumlah_penjahit} penjahit aktif
                              {p.is_lembur && " • Kerja lembur"}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[13px] font-bold text-positive tabular-nums">
                            {formatNumber(p.pcs_disetujui)} pcs
                          </span>
                          {p.pcs_menunggu > 0 && (
                            <p className="text-[10.5px] text-amber-700 font-medium">
                              +{formatNumber(p.pcs_menunggu)} menunggu
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Daftar Penjahit yang Setor Entri pada Tanggal Ini */}
            {selectedDayEntries.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-line/60">
                <h4 className="text-[13px] font-semibold text-ink flex items-center justify-between">
                  <span>Daftar Setoran Penjahit</span>
                  <span className="text-[12px] font-normal text-muted tabular-nums">
                    {selectedDayEntries.length} entri
                  </span>
                </h4>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {selectedDayEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-2.5 rounded-card bg-surface-muted/60 border border-line flex items-center justify-between text-[12px]"
                    >
                      <div>
                        <strong className="text-ink font-semibold">
                          {entry.users?.nama || "Penjahit"}
                        </strong>
                        <p className="text-[11px] text-muted">
                          {entry.projects?.nama || "Proyek"}
                        </p>
                      </div>

                      <div className="text-right">
                        <strong className="text-ink font-bold tabular-nums">
                          {formatNumber(entry.qty_disetujui || entry.qty)} pcs
                        </strong>
                        <p
                          className={`text-[10px] font-medium capitalize ${entry.status === "disetujui"
                              ? "text-positive"
                              : entry.status === "menunggu"
                                ? "text-amber-700"
                                : "text-negative"
                            }`}
                        >
                          {entry.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-line/60 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsDayModalOpen(false)}
                className="w-full sm:w-auto"
              >
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ==================================================================== */}
      {/* DIALOG 2: Tandai / Ubah Status Hari (Libur / Kerja Khusus) */}
      {/* ==================================================================== */}
      <Dialog
        isOpen={isEditDayModalOpen}
        onClose={() => !isSubmittingDay && setIsEditDayModalOpen(false)}
        title={editDayType === "libur" ? "Tandai Hari Libur" : "Jadikan Hari Kerja"}
        subtitle="Tetapkan pengecualian kalender kerja konveksi untuk tanggal tertentu."
      >
        <form onSubmit={handleSubmitDayException} className="space-y-4 pt-1">
          <div>
            <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
              Tanggal
            </label>
            <input
              type="date"
              required
              value={editDayDate}
              onChange={(e) => setEditDayDate(e.target.value)}
              className="w-full h-11 px-3.5 rounded-control bg-surface-muted border border-line text-ink text-[14px] focus:outline-none focus:border-forest-900"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
              Status Hari
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditDayType("libur")}
                className={`h-11 rounded-control border text-[13px] font-semibold transition flex items-center justify-center gap-1.5 ${editDayType === "libur"
                    ? "bg-red-50 border-red-300 text-negative font-bold ring-2 ring-red-200"
                    : "bg-surface-muted border-line text-muted hover:text-ink"
                  }`}
              >
                <CalendarX className="w-4 h-4" />
                Hari Libur
              </button>

              <button
                type="button"
                onClick={() => setEditDayType("kerja")}
                className={`h-11 rounded-control border text-[13px] font-semibold transition flex items-center justify-center gap-1.5 ${editDayType === "kerja"
                    ? "bg-lime-50 border-lime-300 text-positive font-bold ring-2 ring-lime-200"
                    : "bg-surface-muted border-line text-muted hover:text-ink"
                  }`}
              >
                <CalendarCheck className="w-4 h-4" />
                Hari Kerja
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
              Keterangan / Alasan (Opsional)
            </label>
            <input
              type="text"
              value={editDayKeterangan}
              onChange={(e) => setEditDayKeterangan(e.target.value)}
              placeholder="Contoh: Libur Nasional Pilkada, Cuti Bersama, dll."
              className="w-full h-11 px-3.5 rounded-control bg-surface-muted border border-line text-ink text-[14px] focus:outline-none focus:border-forest-900"
            />
            <p className="text-[11px] text-muted mt-1">
              Keterangan ini akan muncul pada kartu kalender dan informasi lembur penjahit.
            </p>
          </div>

          <div className="p-3 bg-surface-muted rounded-panel border border-line text-[11.5px] text-muted leading-relaxed">
            <strong>Catatan Aturan Bisnis #20:</strong> Entri penjahit pada hari libur tetap diterima dan dicatat sebagai kerja lembur, tanpa membatalkan atau mengubah rumus upah.
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-line/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditDayModalOpen(false)}
              disabled={isSubmittingDay}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmittingDay}
              className="bg-forest-900 text-white"
            >
              {isSubmittingDay ? "Menyimpan..." : "Simpan Status"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ==================================================================== */}
      {/* DIALOG 3: Pengaturan Pola Kerja Mingguan */}
      {/* ==================================================================== */}
      <Dialog
        isOpen={isPatternModalOpen}
        onClose={() => !isSubmittingPattern && setIsPatternModalOpen(false)}
        title="Pola Hari Kerja Mingguan"
        subtitle="Tentukan hari kerja rutin konveksi Firdaus Collection (default: Senin–Sabtu)."
      >
        <form onSubmit={handleSubmitWeeklyPattern} className="space-y-4 pt-1">
          <p className="text-[13px] text-muted leading-relaxed">
            Pilih hari apa saja konveksi dijadwalkan beroperasi secara rutin setiap pekan:
          </p>

          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 7].map((isoDay) => {
              const isChecked = patternState.includes(isoDay);
              const dayName = ISO_DAY_NAMES[isoDay];

              return (
                <label
                  key={isoDay}
                  onClick={() => togglePatternDay(isoDay)}
                  className={`flex items-center justify-between p-3 rounded-card border cursor-pointer select-none transition ${isChecked
                      ? "bg-surface border-forest-900 ring-1 ring-forest-900/10 shadow-2xs"
                      : "bg-surface-muted border-line opacity-70 hover:opacity-100"
                    }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => togglePatternDay(isoDay)}
                      className="w-4 h-4 accent-forest-900 rounded"
                    />
                    <span className="text-[13.5px] font-semibold text-ink">
                      {dayName}
                    </span>
                    {isoDay === 6 && (
                      <span className="text-[11px] text-muted italic">
                        (TODO: konfirmasi Sabtu penuh atau setengah hari)
                      </span>
                    )}
                    {isoDay === 7 && isChecked && (
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-pill border border-amber-200">
                        Masuk Minggu
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[11.5px] font-bold px-2 py-0.5 rounded-pill ${isChecked
                        ? "bg-lime-100 text-positive"
                        : "bg-surface-muted text-muted"
                      }`}
                  >
                    {isChecked ? "Hari Kerja" : "Libur Rutin"}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-panel text-[11.5px] text-amber-900 leading-relaxed">
            <strong>Dampak Pengaturan:</strong> Pola hari kerja ini menjadi acuan penghitungan hari kerja pada perkiraan selesai proyek (melompati hari libur) dan penentuan penjahit yang belum menyetor input.
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-line/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsPatternModalOpen(false)}
              disabled={isSubmittingPattern}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmittingPattern}
              className="bg-forest-900 text-white"
            >
              {isSubmittingPattern ? "Menyimpan..." : "Simpan Pola Kerja"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
