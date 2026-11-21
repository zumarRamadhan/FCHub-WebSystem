import { createClient } from "@/lib/supabase/server";
import { InputClient, ActiveProject } from "./input-client";

export default async function PenjahitInputPage() {
  const supabase = createClient();

  // 1. Ambil proyek aktif yang bisa dipilih penjahit
  const { data: rawProjects } = await supabase
    .from("projects")
    .select("id, nama, tarif_per_pcs")
    .eq("status", "aktif")
    .order("nama", { ascending: true });

  const projects: ActiveProject[] = (rawProjects || []).map((p) => ({
    id: p.id,
    nama: p.nama,
    tarif_per_pcs: Number(p.tarif_per_pcs || 500),
  }));

  // 2. Ambil proyek terakhir yang pernah dipakai oleh penjahit ini
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let lastUsedProjectId: string | undefined = undefined;

  if (user) {
    const { data: lastEntry } = await supabase
      .from("production_entries")
      .select("project_id")
      .eq("user_id", user.id)
      .order("dibuat_pada", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastEntry?.project_id) {
      lastUsedProjectId = lastEntry.project_id;
    }
  }

  return <InputClient projects={projects} initialLastUsedProjectId={lastUsedProjectId} />;
}
