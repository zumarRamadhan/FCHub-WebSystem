import { createClient } from "@/lib/supabase/server";
import { ApprovalClient, ApprovalEntryItem } from "./approval-client";

export default async function OwnerApprovalPage() {
  const supabase = createClient();

  // 1. Ambil antrean entri berstatus 'menunggu'
  const { data: rawEntries } = await supabase
    .from("production_entries")
    .select(`
      id,
      user_id,
      project_id,
      tanggal_kerja,
      qty,
      tarif_snapshot,
      status,
      dibuat_pada,
      users:users!user_id (
        nama,
        username
      ),
      projects (
        nama,
        tarif_per_pcs
      )
    `)
    .eq("status", "menunggu")
    .order("tanggal_kerja", { ascending: false })
    .order("dibuat_pada", { ascending: false });

  // 2. Ambil daftar proyek untuk filter
  const { data: rawProjects } = await supabase
    .from("projects")
    .select("id, nama")
    .order("status", { ascending: true })
    .order("nama", { ascending: true });

  interface RawApprovalRow {
    id: string;
    user_id: string;
    project_id: string;
    tanggal_kerja: string;
    qty: number;
    tarif_snapshot: number;
    status: string;
    dibuat_pada: string;
    users: { nama: string; username: string } | null;
    projects: { nama: string; tarif_per_pcs: number } | null;
  }

  const entries: ApprovalEntryItem[] = (
    (rawEntries as unknown as RawApprovalRow[]) || []
  ).map((e) => ({
    id: e.id,
    user_id: e.user_id,
    nama_penjahit: e.users?.nama || "Penjahit",
    username_penjahit: e.users?.username || "penjahit",
    project_id: e.project_id,
    nama_proyek: e.projects?.nama || "Proyek Konveksi",
    tarif_per_pcs: Number(e.tarif_snapshot || e.projects?.tarif_per_pcs || 500),
    tanggal_kerja: e.tanggal_kerja,
    qty: Number(e.qty),
    dibuat_pada: e.dibuat_pada,
  }));

  const availableProjects = (rawProjects || []).map((p) => ({
    id: p.id,
    nama: p.nama,
  }));

  return (
    <ApprovalClient
      initialEntries={entries}
      availableProjects={availableProjects}
    />
  );
}
