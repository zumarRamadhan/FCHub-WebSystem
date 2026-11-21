import { createClient } from "@/lib/supabase/server";
import { InputClient, ActiveProject } from "./input-client";

export default async function PenjahitInputPage() {
  const supabase = createClient();

  // Ambil proyek aktif yang bisa dipilih penjahit
  const { data: rawProjects } = await supabase
    .from("projects")
    .select("id, nama, tarif_per_pcs")
    .eq("status", "aktif")
    .order("created_at", { ascending: false });

  const projects: ActiveProject[] = (rawProjects || []).map((p) => ({
    id: p.id,
    nama: p.nama,
    tarif_per_pcs: p.tarif_per_pcs,
  }));

  return <InputClient projects={projects} />;
}
