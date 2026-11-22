"use client";

import * as React from "react";
import {
  Briefcase,
  Plus,
  Edit2,
  Calendar,
  AlertCircle,
  Info,
  CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Dialog } from "@/components/ui/dialog";
import { formatNumber, formatRupiah, formatDateId, getJakartaTodayString } from "@/lib/format";
import { createProjectAction, updateProjectAction } from "./actions";
import { ProjectInput } from "@/lib/validations/owner";

export interface ProjectItem {
  id: string;
  nama: string;
  target_pcs: number;
  tarif_per_pcs: number;
  reward_aktif?: boolean;
  ambang_reward: number;
  tanggal_mulai: string;
  deadline: string | null;
  status: "aktif" | "selesai" | "diarsipkan";
  total_pcs_disetujui?: number;
  persentase_progres?: number;
  sisa_target_pcs?: number;
  total_entri_menunggu?: number;
}

interface ProyekClientProps {
  initialProjects: ProjectItem[];
}

export function ProyekClient({ initialProjects }: ProyekClientProps) {
  const [projects, setProjects] = React.useState<ProjectItem[]>(initialProjects);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingProject, setEditingProject] = React.useState<ProjectItem | null>(null);

  // Form State
  const [nama, setNama] = React.useState("");
  const [targetPcs, setTargetPcs] = React.useState<number>(1000);
  const [tarifPerPcs, setTarifPerPcs] = React.useState<number>(500);
  const [rewardAktif, setRewardAktif] = React.useState<boolean>(false);
  const [ambangReward, setAmbangReward] = React.useState<number>(0);
  const [tanggalMulai, setTanggalMulai] = React.useState(getJakartaTodayString());
  const [deadline, setDeadline] = React.useState("");
  const [status, setStatus] = React.useState<"aktif" | "selesai" | "diarsipkan">("aktif");

  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Dialog Konfirmasi Mematikan Reward
  const [isConfirmDisableRewardOpen, setIsConfirmDisableRewardOpen] = React.useState(false);

  // Buka Modal Tambah Proyek
  const handleOpenAdd = () => {
    setEditingProject(null);
    setNama("");
    setTargetPcs(1000);
    setTarifPerPcs(500);
    setRewardAktif(false);
    setAmbangReward(0);
    setTanggalMulai(getJakartaTodayString());
    setDeadline("");
    setStatus("aktif");
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  // Buka Modal Edit Proyek
  const handleOpenEdit = (project: ProjectItem) => {
    setEditingProject(project);
    setNama(project.nama);
    setTargetPcs(project.target_pcs);
    setTarifPerPcs(project.tarif_per_pcs);
    setRewardAktif(Boolean(project.reward_aktif));
    setAmbangReward(project.reward_aktif ? project.ambang_reward || 0 : 0);
    setTanggalMulai(project.tanggal_mulai);
    setDeadline(project.deadline || "");
    setStatus(project.status);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  // Toggle Reward Handler
  const handleToggleReward = () => {
    if (rewardAktif) {
      if (editingProject && editingProject.reward_aktif) {
        setIsConfirmDisableRewardOpen(true);
        return;
      }
      setRewardAktif(false);
      setAmbangReward(0);
    } else {
      setRewardAktif(true);
      if (!ambangReward || ambangReward <= 0) {
        setAmbangReward(Math.min(1500, targetPcs));
      }
    }
  };

  const handleConfirmDisableReward = () => {
    setRewardAktif(false);
    setAmbangReward(0);
    setIsConfirmDisableRewardOpen(false);
  };

  // Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    const payload: ProjectInput = {
      nama,
      target_pcs: Number(targetPcs),
      tarif_per_pcs: Number(tarifPerPcs),
      reward_aktif: rewardAktif,
      ambang_reward: rewardAktif ? Number(ambangReward) : 0,
      tanggal_mulai: tanggalMulai,
      deadline: deadline || null,
      status,
    };

    if (editingProject) {
      const result = await updateProjectAction(editingProject.id, payload);
      if (!result.success) {
        setErrorMsg(result.error || "Gagal memperbarui proyek.");
        setIsLoading(false);
        return;
      }

      setProjects((prev) =>
        prev.map((p) => (p.id === editingProject.id ? { ...p, ...payload } : p))
      );
    } else {
      const result = await createProjectAction(payload);
      if (!result.success) {
        setErrorMsg(result.error || "Gagal menambahkan proyek.");
        setIsLoading(false);
        return;
      }

      if (result.data) {
        const newProj: ProjectItem = {
          ...result.data,
          total_pcs_disetujui: 0,
          persentase_progres: 0,
          sisa_target_pcs: result.data.target_pcs,
          total_entri_menunggu: 0,
        };
        setProjects((prev) => [newProj, ...prev]);
      }
    }

    setIsLoading(false);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <h1 className="text-[22px] sm:text-[24px] font-semibold text-ink leading-tight">
            Manajemen Proyek Konveksi
          </h1>
          <p className="text-[13px] text-muted mt-1">
            Kelola daftar pesanan, target pcs, tarif per pcs, dan ambang reward penjahit.
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenAdd} className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5 stroke-[2.5]" />
          Tambah Proyek
        </Button>
      </div>

      {/* Daftar Kartu Proyek */}
      {projects.length === 0 ? (
        <Card className="text-center py-12 px-6">
          <div className="w-12 h-12 rounded-[16px] bg-surface-muted text-muted mx-auto flex items-center justify-center mb-3">
            <Briefcase className="w-6 h-6" />
          </div>
          <h3 className="text-[16px] font-semibold text-ink">
            Belum ada proyek yang dibuat
          </h3>
          <p className="text-[13px] text-muted max-w-sm mx-auto mt-1 mb-5">
            Buat proyek konveksi pertama Anda untuk memulai pencatatan hasil kerja penjahit.
          </p>
          <Button variant="primary" onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 mr-1.5" />
            Buat Proyek Pertama
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((proj) => {
            const approvedPcs = proj.total_pcs_disetujui || 0;
            const targetPcsVal = proj.target_pcs || 1;
            const progressPct =
              proj.persentase_progres !== undefined
                ? Math.min(100, Math.round(proj.persentase_progres))
                : Math.min(100, Math.round((approvedPcs / targetPcsVal) * 100));

            const isAktif = proj.status === "aktif";

            return (
              <Card key={proj.id} className="flex flex-col justify-between p-5 sm:p-6 shadow-card">
                <div>
                  {/* Header Proyek */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[12px] bg-surface-muted flex items-center justify-center text-ink shrink-0">
                        <Briefcase className="w-5 h-5 text-forest-900" />
                      </div>
                      <div>
                        <h2 className="text-[16px] font-semibold text-ink leading-snug">
                          {proj.nama}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {isAktif ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-lime-100 text-positive text-[11px] font-semibold">
                              <CheckCircle2 className="w-3 h-3" /> Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-surface-muted text-muted text-[11px] font-medium">
                              Selesai
                            </span>
                          )}
                          <span className="text-[12px] font-semibold text-forest-900">
                            {formatRupiah(proj.tarif_per_pcs)} / pcs
                          </span>
                          {proj.reward_aktif && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-lime-100 text-positive text-[10.5px] font-bold border border-lime-300">
                              Reward aktif – ambang {formatNumber(proj.ambang_reward)} pcs
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenEdit(proj)}
                      className="shrink-0 h-8 px-3 text-[12px]"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1" />
                      Ubah
                    </Button>
                  </div>

                  {/* Progress Bar & Metrik */}
                  <div className="bg-surface-muted p-3.5 rounded-panel mb-4 space-y-2">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-muted">Progres Produksi:</span>
                      <span className="font-semibold text-ink tabular-nums">
                        {formatNumber(approvedPcs)} / {formatNumber(proj.target_pcs)} pcs ({progressPct}%)
                      </span>
                    </div>
                    <ProgressBar value={progressPct} max={100} />
                  </div>

                  {/* Rincian Proyek */}
                  <div className={`grid ${proj.reward_aktif ? "grid-cols-2" : "grid-cols-1"} gap-2 text-[12px] pt-1`}>
                    {proj.reward_aktif && (
                      <div className="p-2.5 rounded-panel bg-surface border border-line/50">
                        <span className="text-muted block text-[11px]">Ambang Reward:</span>
                        <strong className="text-forest-900 font-semibold tabular-nums">
                          {formatNumber(proj.ambang_reward)} pcs
                        </strong>
                      </div>
                    )}

                    <div className="p-2.5 rounded-panel bg-surface border border-line/50">
                      <span className="text-muted block text-[11px]">Deadline:</span>
                      <strong className="text-ink font-semibold flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-muted" />
                        {proj.deadline ? formatDateId(proj.deadline) : "Tanpa batas"}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-[11px] text-muted">
                  <span>Mulai: {formatDateId(proj.tanggal_mulai)}</span>
                  {proj.total_entri_menunggu ? (
                    <span className="text-warning font-semibold">
                      {proj.total_entri_menunggu} input menunggu
                    </span>
                  ) : (
                    <span>Semua input terverifikasi</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog Modal Tambah & Ubah Proyek */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProject ? "Ubah Data Proyek" : "Tambah Proyek Baru"}
        subtitle="Atur target produksi, tarif upah per pcs, dan tanggal pengerjaan."
      >
        {errorMsg && (
          <div className="mb-4 p-3 rounded-panel bg-negative/10 border border-negative/20 text-negative text-[13px] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 stroke-[2]" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Catatan Penting Mengenai Tarif Snapshot */}
        <div className="mb-4 p-3 bg-lime-100/60 border border-lime-400/30 rounded-panel text-forest-900 text-[12px] flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 text-forest-900 shrink-0" />
          <p className="leading-relaxed">
            <strong>Catatan Tarif:</strong> Mengubah tarif per pcs hanya berlaku untuk entri hasil kerja yang diinput setelah perubahan. Riwayat entri lama tetap terlindungi memakai tarif snapshot saat dibuat.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
              Nama Proyek
            </label>
            <input
              type="text"
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="contoh: Tas Seminar BPS 2026"
              className="w-full h-11 px-3.5 rounded-control bg-surface-muted border border-line text-ink text-[14px] focus:outline-none focus:border-forest-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
                Target Total (Pcs)
              </label>
              <input
                type="number"
                min={1}
                required
                value={targetPcs}
                onChange={(e) => setTargetPcs(Number(e.target.value))}
                className="w-full h-11 px-3.5 rounded-control bg-surface-muted border border-line text-ink text-[14px] tabular-nums focus:outline-none focus:border-forest-900"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
                Tarif Upah (Rp/pcs)
              </label>
              <input
                type="number"
                min={1}
                required
                value={tarifPerPcs}
                onChange={(e) => setTarifPerPcs(Number(e.target.value))}
                className="w-full h-11 px-3.5 rounded-control bg-surface-muted border border-line text-ink text-[14px] tabular-nums focus:outline-none focus:border-forest-900"
              />
            </div>
          </div>

          {/* Toggle Aktifkan Reward (Tahap 15) */}
          <div className="p-3 bg-surface-muted rounded-panel border border-line space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <label
                  onClick={handleToggleReward}
                  className="text-[13px] font-semibold text-ink cursor-pointer flex items-center gap-2 select-none"
                >
                  <span>Aktifkan Reward</span>
                  {rewardAktif && (
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-pill bg-lime-100 text-positive">
                      Aktif
                    </span>
                  )}
                </label>
                <p className="text-[11px] text-muted mt-0.5">
                  Untuk proyek besar. Penjahit melihat progres dan leaderboard proyek ini.
                </p>
              </div>
              <input
                type="checkbox"
                checked={rewardAktif}
                onChange={handleToggleReward}
                className="w-5 h-5 accent-forest-900 cursor-pointer rounded"
              />
            </div>

            {/* Catatan jika diaktifkan di tengah proyek berjalan */}
            {editingProject && !editingProject.reward_aktif && rewardAktif && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-panel text-[11.5px] text-amber-900 flex items-start gap-1.5">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  Perhitungan kualifikasi reward akan memakai seluruh pcs disetujui sejak proyek dimulai.
                </span>
              </div>
            )}
          </div>

          {/* Kolom Ambang Reward hanya tampil dan wajib jika reward aktif */}
          {rewardAktif && (
            <div>
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
                Ambang Reward Penjahit (Pcs) <span className="text-negative">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={targetPcs}
                required={rewardAktif}
                value={ambangReward || ""}
                onChange={(e) => setAmbangReward(Number(e.target.value))}
                placeholder={`Maksimal ${formatNumber(targetPcs)} pcs`}
                className="w-full h-11 px-3.5 rounded-control bg-surface-muted border border-line text-ink text-[14px] tabular-nums focus:outline-none focus:border-forest-900"
              />
              <p className="text-[11px] text-muted mt-1">
                Penjahit dengan total pcs disetujui mencapai angka ini akan ditandai berhak mendapat reward.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
                Tanggal Mulai
              </label>
              <input
                type="date"
                required
                value={tanggalMulai}
                onChange={(e) => setTanggalMulai(e.target.value)}
                className="w-full h-11 px-3.5 rounded-control bg-surface-muted border border-line text-ink text-[14px] focus:outline-none focus:border-forest-900"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
                Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full h-11 px-3.5 rounded-control bg-surface-muted border border-line text-ink text-[14px] focus:outline-none focus:border-forest-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-muted uppercase tracking-wider mb-1">
              Status Proyek
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "aktif" | "selesai" | "diarsipkan")}
              className="w-full h-11 px-3.5 rounded-control bg-surface-muted border border-line text-ink text-[14px] focus:outline-none focus:border-forest-900"
            >
              <option value="aktif">Aktif (Bisa Dipilih Penjahit)</option>
              <option value="selesai">Selesai (Ditutup)</option>
              <option value="diarsipkan">Diarsipkan</option>
            </select>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-line/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isLoading}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? "Menyimpan..." : editingProject ? "Simpan Perubahan" : "Buat Proyek"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Dialog Konfirmasi Mematikan Reward */}
      <Dialog
        isOpen={isConfirmDisableRewardOpen}
        onClose={() => setIsConfirmDisableRewardOpen(false)}
        title="Matikan Reward Proyek?"
        subtitle="Konfirmasi perubahan status reward pada proyek berjalan."
      >
        <div className="space-y-3 text-[13px] text-muted py-1">
          <p className="text-ink font-medium">
            Penjahit tidak akan lagi melihat progres reward dan leaderboard proyek ini.
          </p>
          <p className="text-[12px] leading-relaxed">
            Apakah Anda yakin ingin menonaktifkan reward untuk proyek <strong>{editingProject?.nama}</strong>?
          </p>
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-line/60 mt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsConfirmDisableRewardOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmDisableReward}
            >
              Ya, Matikan Reward
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
