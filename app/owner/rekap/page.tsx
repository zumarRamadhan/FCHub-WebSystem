import { createClient } from "@/lib/supabase/server";
import { RekapClient, PenjahitWageRow } from "./rekap-client";
import { getRecentWeekOptions } from "@/lib/wage";

export default async function OwnerRekapPage() {
  const supabase = createClient();
  const weekOptions = getRecentWeekOptions(4);
  const currentWeek = weekOptions[0];

  // Ambil entri berstatus 'disetujui' pada minggu berjalan
  const { data: entries } = await supabase
    .from("production_entries")
    .select(`
      user_id,
      qty_disetujui,
      tarif_snapshot,
      users:users!user_id (
        nama,
        username
      )
    `)
    .eq("status", "disetujui")
    .gte("tanggal_kerja", currentWeek.startDate)
    .lte("tanggal_kerja", currentWeek.endDate);

  interface RawWageRow {
    user_id: string;
    qty_disetujui: number | null;
    tarif_snapshot: number;
    users: { nama: string; username: string } | null;
  }

  const grouped: Record<string, PenjahitWageRow> = {};

  ((entries as unknown as RawWageRow[]) || []).forEach((e) => {
    const userId = e.user_id;
    const qty = Number(e.qty_disetujui || 0);
    const tarif = Number(e.tarif_snapshot || 500);

    if (!grouped[userId]) {
      grouped[userId] = {
        user_id: userId,
        nama_penjahit: e.users?.nama || "Penjahit",
        username_penjahit: e.users?.username || "penjahit",
        total_pcs_disetujui: 0,
        tarif_snapshot: tarif,
        total_upah: 0,
        total_entri_disetujui: 0,
      };
    }

    grouped[userId].total_pcs_disetujui += qty;
    grouped[userId].total_upah += qty * tarif;
    grouped[userId].total_entri_disetujui += 1;
  });

  const initialSummary = Object.values(grouped).sort(
    (a, b) => b.total_pcs_disetujui - a.total_pcs_disetujui
  );

  return (
    <RekapClient
      initialSummary={initialSummary}
      weekOptions={weekOptions}
      currentWeekStartDate={currentWeek.startDate}
    />
  );
}
