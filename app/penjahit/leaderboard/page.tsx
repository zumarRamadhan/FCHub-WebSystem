import { createClient } from "@/lib/supabase/server";
import { LeaderboardClient, ProjectOptionItem } from "./leaderboard-client";
import { LeaderboardPublicItem } from "@/lib/types/database";

export default async function PenjahitLeaderboardPage() {
  const supabase = createClient();

  // 1. Ambil daftar proyek aktif yang memiliki reward aktif (Aturan Bisnis #18)
  const { data: rawProjects } = await supabase
    .from("projects")
    .select("id, nama, ambang_reward")
    .eq("status", "aktif")
    .eq("reward_aktif", true)
    .order("created_at", { ascending: false });

  const projects: ProjectOptionItem[] = (rawProjects || []).map((p) => ({
    id: p.id,
    nama: p.nama,
    ambang_reward: p.ambang_reward || 0,
  }));

  const defaultProjectId = projects[0]?.id || "";
  let initialLeaderboard: LeaderboardPublicItem[] = [];

  // 2. Jika ada proyek aktif, panggil RPC get_project_leaderboard
  if (defaultProjectId) {
    const { data: rpcData, error } = await supabase.rpc("get_project_leaderboard", {
      p_project_id: defaultProjectId,
    });

    if (!error && rpcData) {
      initialLeaderboard = rpcData as LeaderboardPublicItem[];
    }
  }

  return (
    <LeaderboardClient
      projects={projects}
      initialLeaderboard={initialLeaderboard}
      defaultProjectId={defaultProjectId}
    />
  );
}
