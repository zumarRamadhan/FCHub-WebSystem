import { createClient } from "@/lib/supabase/server";
import { PenjahitClient, PenjahitItem } from "./penjahit-client";

export default async function OwnerPenjahitPage() {
  const supabase = createClient();

  // Ambil daftar seluruh penjahit (role = 'penjahit')
  const { data: rawUsers } = await supabase
    .from("users")
    .select("id, nama, username, role, aktif, created_at")
    .eq("role", "penjahit")
    .order("aktif", { ascending: false }) // Aktif didahulukan
    .order("nama", { ascending: true });

  const penjahits: PenjahitItem[] = (rawUsers || []).map((u) => ({
    id: u.id,
    nama: u.nama,
    username: u.username,
    role: u.role as "penjahit" | "owner",
    aktif: u.aktif,
    created_at: u.created_at,
  }));

  return <PenjahitClient initialPenjahits={penjahits} />;
}
