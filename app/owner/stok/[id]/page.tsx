import * as React from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StockDetailClient } from "./stock-detail-client";
import { getSignedPhotoUrlsBatch } from "../actions";
import type {
  StockItemView,
  DbStockMovement,
  StockItemPhoto,
} from "@/lib/types/database";
import type { ProjectSelectItem } from "@/components/project-select";

interface PageProps {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";

export default async function OwnerStockDetailPage({ params }: PageProps) {
  const supabase = createClient();

  // 1. Verifikasi Sesi & Peran Owner
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, aktif")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "owner" || !profile.aktif) {
    redirect("/login");
  }

  const itemId = params.id;
  if (!itemId) notFound();

  // 2. Ambil data item dari v_stock_items
  const { data: itemData, error: itemError } = await supabase
    .from("v_stock_items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (itemError || !itemData) {
    console.error("Barang stok tidak ditemukan:", itemError);
    notFound();
  }

  const item = itemData as StockItemView;

  // 3. Ambil signed URLs untuk semua foto barang
  const photos = (item.foto as StockItemPhoto[]) || [];
  const allPhotoPaths: string[] = [];
  photos.forEach((p) => {
    if (p.full_path) allPhotoPaths.push(p.full_path);
    if (p.thumb_path) allPhotoPaths.push(p.thumb_path);
  });

  const signedUrlsMap = await getSignedPhotoUrlsBatch(allPhotoPaths);

  // 4. Ambil riwayat mutasi / pergerakan stok
  let movements: DbStockMovement[] = [];
  try {
    const { data: movData, error: movErr } = await supabase
      .from("stock_movements")
      .select(`
        id,
        stock_item_id,
        jenis,
        jumlah,
        stok_sebelum,
        stok_sesudah,
        harga_satuan,
        total_harga,
        pembeli,
        catatan,
        created_by,
        created_at
      `)
      .eq("stock_item_id", itemId)
      .order("created_at", { ascending: false });

    if (!movErr && movData) {
      // Ambil nama-nama pencatat
      const userIds = Array.from(new Set(movData.map((m) => m.created_by).filter(Boolean)));
      const userMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, nama")
          .in("id", userIds);
        if (usersData) {
          usersData.forEach((u) => {
            userMap[u.id] = u.nama;
          });
        }
      }

      movements = movData.map((m) => ({
        ...m,
        nama_pencatat: m.created_by ? userMap[m.created_by] || "Owner" : "Sistem",
      }));
    }
  } catch (err) {
    console.error("Gagal memuat riwayat mutasi stok:", err);
  }

  // 5. Ambil daftar proyek untuk modal edit
  let projects: ProjectSelectItem[] = [];
  try {
    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, nama, warna, status, target_pcs")
      .order("nama", { ascending: true });

    if (projectsData) {
      projects = projectsData.map((p) => ({
        id: p.id,
        nama: p.nama,
        warna: p.warna,
        status: p.status,
        target_pcs: p.target_pcs,
      }));
    }
  } catch (err) {
    console.error("Gagal memuat proyek:", err);
  }

  // 6. Ambil daftar kategori untuk modal edit
  let categories: string[] = [];
  try {
    const { data: catData } = await supabase
      .from("stock_items")
      .select("kategori")
      .eq("status", "aktif");

    if (catData) {
      const setCat = new Set<string>();
      catData.forEach((c) => {
        if (c.kategori && c.kategori.trim()) setCat.add(c.kategori.trim());
      });
      categories = Array.from(setCat).sort();
    }
  } catch (err) {
    console.error("Gagal memuat kategori:", err);
  }

  return (
    <StockDetailClient
      item={item}
      photos={photos}
      photoSignedUrls={signedUrlsMap}
      initialMovements={movements}
      projects={projects}
      categories={categories}
    />
  );
}
