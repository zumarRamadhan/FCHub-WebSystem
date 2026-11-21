import { createClient } from "@/lib/supabase/server";
import { ProyekClient, ProjectItem } from "./proyek-client";

export default async function OwnerProyekPage() {
  const supabase = createClient();

  // Coba ambil dari view agregasi v_project_progress
  const { data: viewProjects, error: viewError } = await supabase
    .from("v_project_progress")
    .select("*")
    .order("status_proyek", { ascending: true })
    .order("tanggal_mulai", { ascending: false });

  let projects: ProjectItem[] = [];

  if (!viewError && viewProjects) {
    projects = viewProjects.map((p) => ({
      id: p.project_id,
      nama: p.nama_proyek,
      target_pcs: p.target_pcs,
      tarif_per_pcs: p.tarif_per_pcs,
      ambang_reward: p.ambang_reward,
      tanggal_mulai: p.tanggal_mulai,
      deadline: p.deadline,
      status: p.status_proyek,
      total_pcs_disetujui: Number(p.total_pcs_disetujui || 0),
      persentase_progres: Number(p.persentase_progres || 0),
      sisa_target_pcs: Number(p.sisa_target_pcs || 0),
      total_entri_menunggu: Number(p.total_entri_menunggu || 0),
    }));
  } else {
    // Fallback ke tabel projects langsung jika view belum dimigrasi di lokal
    const { data: rawProjects } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (rawProjects) {
      projects = rawProjects.map((p) => ({
        id: p.id,
        nama: p.nama,
        target_pcs: p.target_pcs,
        tarif_per_pcs: p.tarif_per_pcs,
        ambang_reward: p.ambang_reward,
        tanggal_mulai: p.tanggal_mulai,
        deadline: p.deadline,
        status: p.status,
        total_pcs_disetujui: 0,
        persentase_progres: 0,
        sisa_target_pcs: p.target_pcs,
        total_entri_menunggu: 0,
      }));
    }
  }

  return <ProyekClient initialProjects={projects} />;
}
