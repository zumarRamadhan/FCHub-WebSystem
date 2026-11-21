"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  KeyRound,
  Power,
  Search,
  AlertCircle,
  ArrowRight,
  Check,
  ShieldAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatNumber, formatRupiah } from "@/lib/format";
import { getPaymentStatusBadgeInfo } from "@/lib/wage";
import { WeeklyWagePaymentStatus } from "@/lib/types/database";
import {
  createPenjahitAction,
  resetPenjahitPinAction,
  togglePenjahitStatusAction,
} from "./actions";

export interface PenjahitItem {
  id: string;
  nama: string;
  username: string;
  role: "penjahit" | "owner";
  aktif: boolean;
  created_at?: string;
  total_pcs: number;
  total_pendapatan: number;
  total_proyek: number;
  status_bayar_minggu_ini: WeeklyWagePaymentStatus;
}

interface PenjahitClientProps {
  initialPenjahits: PenjahitItem[];
}

export function PenjahitClient({ initialPenjahits }: PenjahitClientProps) {
  const router = useRouter();
  const [penjahits, setPenjahits] = React.useState<PenjahitItem[]>(initialPenjahits);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Modal Tambah Penjahit
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [addNama, setAddNama] = React.useState("");
  const [addUsername, setAddUsername] = React.useState("");
  const [addPin, setAddPin] = React.useState("");
  const [addError, setAddError] = React.useState<string | null>(null);
  const [isAddLoading, setIsAddLoading] = React.useState(false);

  // Modal Reset PIN
  const [resetTarget, setResetTarget] = React.useState<PenjahitItem | null>(null);
  const [newPin, setNewPin] = React.useState("");
  const [resetError, setResetError] = React.useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = React.useState<string | null>(null);
  const [isResetLoading, setIsResetLoading] = React.useState(false);

  // Status Toggle
  const [toggleLoadingId, setToggleLoadingId] = React.useState<string | null>(null);

  // Filter Search
  const filteredPenjahits = penjahits.filter((p) => {
    const q = searchQuery.toLowerCase();
    return p.nama.toLowerCase().includes(q) || p.username.toLowerCase().includes(q);
  });

  const totalAktif = penjahits.filter((p) => p.aktif).length;
  const totalNonaktif = penjahits.length - totalAktif;

  // Handle Tambah Penjahit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setIsAddLoading(true);

    const result = await createPenjahitAction({
      nama: addNama,
      username: addUsername,
      pin: addPin,
    });

    if (!result.success) {
      setAddError(result.error || "Gagal menambahkan akun penjahit.");
      setIsAddLoading(false);
      return;
    }

    if (result.data) {
      setPenjahits((prev) => [result.data as PenjahitItem, ...prev]);
    }

    setIsAddLoading(false);
    setIsAddOpen(false);
    setAddNama("");
    setAddUsername("");
    setAddPin("");
  };

  // Handle Reset PIN
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;

    setResetError(null);
    setResetSuccess(null);
    setIsResetLoading(true);

    const result = await resetPenjahitPinAction({
      userId: resetTarget.id,
      newPin,
    });

    if (!result.success) {
      setResetError(result.error || "Gagal mereset PIN.");
      setIsResetLoading(false);
      return;
    }

    setIsResetLoading(false);
    setResetSuccess(`PIN untuk ${resetTarget.nama} berhasil diperbarui.`);
    setNewPin("");
    setTimeout(() => {
      setResetTarget(null);
      setResetSuccess(null);
    }, 1500);
  };

  // Handle Toggle Status Aktif/Nonaktif
  const handleToggleStatus = async (penjahit: PenjahitItem) => {
    setToggleLoadingId(penjahit.id);
    const newStatus = !penjahit.aktif;

    const result = await togglePenjahitStatusAction(penjahit.id, newStatus);
    if (result.success) {
      setPenjahits((prev) =>
        prev.map((p) => (p.id === penjahit.id ? { ...p, aktif: newStatus } : p))
      );
    }
    setToggleLoadingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <h1 className="text-[22px] sm:text-[24px] font-semibold text-ink leading-tight">
            Manajemen Data Penjahit
          </h1>
          <p className="text-[13px] text-muted mt-1">
            Kelola akun 15–18 penjahit Firdaus Collection, atur kredensial PIN, dan status akses kerja.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setAddError(null);
            setIsAddOpen(true);
          }}
          className="shrink-0"
        >
          <UserPlus className="w-4 h-4 mr-1.5 stroke-[2.5]" />
          Tambah Penjahit
        </Button>
      </div>

      {/* Ringkasan & Bar Pencarian */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-surface rounded-card border border-line flex items-center justify-between">
          <span className="text-[12px] font-medium text-muted">Total Terdaftar</span>
          <strong className="text-[18px] font-semibold text-ink tabular-nums">
            {penjahits.length} orang
          </strong>
        </div>
        <div className="p-3.5 bg-surface rounded-card border border-line flex items-center justify-between">
          <span className="text-[12px] font-medium text-muted">Penjahit Aktif</span>
          <strong className="text-[18px] font-semibold text-positive tabular-nums">
            {totalAktif} orang
          </strong>
        </div>
        <div className="p-3.5 bg-surface rounded-card border border-line flex items-center justify-between">
          <span className="text-[12px] font-medium text-muted">Nonaktif</span>
          <strong className="text-[18px] font-semibold text-muted tabular-nums">
            {totalNonaktif} orang
          </strong>
        </div>
      </div>

      {/* Kolom Pencarian */}
      <div className="relative">
        <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari berdasarkan nama atau username penjahit..."
          className="w-full h-11 pl-10 pr-4 rounded-control bg-surface border border-line text-ink text-[13px] placeholder:text-muted/50 focus:outline-none focus:border-forest-900 transition"
        />
      </div>

      {/* Daftar Penjahit */}
      {filteredPenjahits.length === 0 ? (
        <Card className="text-center py-12 px-6">
          <div className="w-12 h-12 rounded-[16px] bg-surface-muted text-muted mx-auto flex items-center justify-center mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-[16px] font-semibold text-ink">
            {searchQuery ? "Penjahit tidak ditemukan" : "Belum ada penjahit terdaftar"}
          </h3>
          <p className="text-[13px] text-muted max-w-sm mx-auto mt-1 mb-5">
            {searchQuery
              ? `Tidak ditemukan penjahit dengan kata kunci "${searchQuery}".`
              : "Daftarkan penjahit pertama Anda agar mereka dapat mulai menginput hasil kerja harian."}
          </p>
          {!searchQuery && (
            <Button variant="primary" onClick={() => setIsAddOpen(true)}>
              <UserPlus className="w-4 h-4 mr-1.5" />
              Tambah Penjahit Pertama
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredPenjahits.map((penjahit) => {
            const initials = penjahit.nama
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            const isToggling = toggleLoadingId === penjahit.id;
            const badgeInfo = getPaymentStatusBadgeInfo(penjahit.status_bayar_minggu_ini);

            return (
              <Card
                key={penjahit.id}
                onClick={() => router.push(`/owner/penjahit/${penjahit.id}`)}
                className={`p-4 sm:p-5 flex flex-col justify-between transition-all cursor-pointer hover:border-forest-900/40 hover:shadow-md group ${
                  !penjahit.aktif ? "opacity-75 bg-surface/70" : ""
                }`}
              >
                <div>
                  {/* Baris 1: Header Nama & Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center text-[14px] font-semibold select-none shrink-0 ${
                          penjahit.aktif
                            ? "bg-forest-900 text-lime-400"
                            : "bg-surface-muted text-muted"
                        }`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-[15px] font-semibold text-ink leading-snug truncate group-hover:text-forest-900 transition-colors">
                          {penjahit.nama}
                        </h2>
                        <p className="text-[12px] font-mono text-muted truncate">
                          @{penjahit.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {penjahit.aktif ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-lime-100 text-positive text-[11px] font-semibold">
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-negative/10 text-negative text-[11px] font-medium">
                          Nonaktif
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Baris 2: 4 Kolom Ringkas (Pcs Seumur Hidup, Pendapatan, Proyek, Status Bayar Minggu Ini) */}
                  <div className="grid grid-cols-2 gap-2 my-2.5 p-3 rounded-panel bg-surface-muted border border-line text-[12px]">
                    <div>
                      <span className="text-[11px] text-muted block">Produksi Seumur Hidup:</span>
                      <strong className="text-ink text-[13px] font-semibold tabular-nums">
                        {formatNumber(penjahit.total_pcs)} pcs
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted block">Total Pendapatan:</span>
                      <strong className="text-forest-900 text-[13px] font-semibold tabular-nums">
                        {formatRupiah(penjahit.total_pendapatan)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted block">Proyek Dikerjakan:</span>
                      <span className="text-ink font-medium">
                        {penjahit.total_proyek} proyek
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted block">Status Minggu Ini:</span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-pill text-[10.5px] font-semibold ${badgeInfo.bgClass} ${badgeInfo.textClass}`}>
                        {badgeInfo.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Baris 3: Footer Aksi */}
                <div className="pt-3 border-t border-line/60 flex items-center justify-between gap-2 mt-1">
                  <span className="text-[12px] font-semibold text-forest-900 group-hover:underline flex items-center gap-1">
                    Lihat Histori <ArrowRight className="w-3.5 h-3.5" />
                  </span>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setResetTarget(penjahit);
                        setNewPin("");
                        setResetError(null);
                        setResetSuccess(null);
                      }}
                      className="h-8 px-2.5 text-[11.5px]"
                    >
                      <KeyRound className="w-3.5 h-3.5 mr-1 text-muted" />
                      Reset PIN
                    </Button>

                    <Button
                      variant={penjahit.aktif ? "danger" : "secondary"}
                      size="sm"
                      disabled={isToggling}
                      onClick={() => handleToggleStatus(penjahit)}
                      className="h-8 px-2.5 text-[11.5px]"
                    >
                      <Power className="w-3.5 h-3.5 mr-1" />
                      {isToggling
                        ? "..."
                        : penjahit.aktif
                        ? "Nonaktifkan"
                        : "Aktifkan"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog Modal Tambah Penjahit */}
      <Dialog
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Tambah Akun Penjahit"
        subtitle="Buat kredensial login penjahit (username dan PIN 6 digit)."
      >
        {addError && (
          <div className="mb-4 p-3 rounded-panel bg-negative/10 border border-negative/20 text-negative text-[13px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 stroke-[2]" />
            <span>{addError}</span>
          </div>
        )}

        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
              Nama Lengkap Penjahit
            </label>
            <input
              type="text"
              required
              value={addNama}
              onChange={(e) => setAddNama(e.target.value)}
              placeholder="contoh: Budi Santoso"
              className="w-full h-11 px-3.5 rounded-control bg-surface-muted border border-line text-ink text-[14px] focus:outline-none focus:border-forest-900"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
              Username (Untuk Login)
            </label>
            <input
              type="text"
              required
              autoCapitalize="none"
              autoCorrect="off"
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value.toLowerCase().trim())}
              placeholder="contoh: budi"
              className="w-full h-11 px-3.5 rounded-control bg-surface-muted border border-line text-ink text-[14px] font-mono focus:outline-none focus:border-forest-900"
            />
            <p className="text-[11px] text-muted mt-1">
              Hanya huruf kecil, angka, - atau _ (tanpa spasi).
            </p>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
              PIN Awal (6 Digit Angka)
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={addPin}
              onChange={(e) => setAddPin(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="••••••"
              className="w-full h-11 px-3.5 rounded-control bg-surface-muted border border-line text-ink text-center text-[18px] tracking-[0.3em] font-semibold tabular-nums focus:outline-none focus:border-forest-900"
            />
            <p className="text-[11px] text-muted mt-1">
              Berikan PIN ini kepada penjahit untuk masuk di aplikasi.
            </p>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-line/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddOpen(false)}
              disabled={isAddLoading}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" disabled={isAddLoading}>
              {isAddLoading ? "Mendaftarkan..." : "Buat Akun Penjahit"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Dialog Modal Reset PIN */}
      <Dialog
        isOpen={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="Reset PIN Penjahit"
        subtitle={resetTarget ? `Atur ulang PIN masuk untuk ${resetTarget.nama} (@${resetTarget.username})` : ""}
      >
        {resetError && (
          <div className="mb-4 p-3 rounded-panel bg-negative/10 border border-negative/20 text-negative text-[13px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 stroke-[2]" />
            <span>{resetError}</span>
          </div>
        )}

        {resetSuccess && (
          <div className="mb-4 p-3 rounded-panel bg-lime-100 border border-lime-400 text-positive text-[13px] flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 stroke-[2.5]" />
            <span>{resetSuccess}</span>
          </div>
        )}

        <form onSubmit={handleResetSubmit} className="space-y-4">
          <div className="p-3 bg-surface-muted rounded-panel text-[13px] text-muted flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-warning mt-0.5 shrink-0" />
            <span>
              PIN baru akan langsung aktif dan menggantikan PIN lama penjahit yang bersangkutan.
            </span>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
              PIN Baru (6 Digit)
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="••••••"
              className="w-full h-11 px-3.5 rounded-control bg-surface-muted border border-line text-ink text-center text-[18px] tracking-[0.3em] font-semibold tabular-nums focus:outline-none focus:border-forest-900"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-line/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setResetTarget(null)}
              disabled={isResetLoading}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" disabled={isResetLoading}>
              {isResetLoading ? "Menyimpan..." : "Simpan PIN Baru"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
