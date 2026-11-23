import * as React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StockListClient } from "./stock-list-client";
import { getSignedPhotoUrlsBatch } from "./actions";
import type {
  StockItemView,
  StockSummary,
} from "@/lib/types/database";
import type { ProjectSelectItem } from "@/components/project-select";

interface PageProps {
  searchParams?: {
    q?: string;
    project?: string;
    status?: string;
    kategori?: string;
    sort?: string;
    page?: string;
    showArchived?: string;
  };
}

export const dynamic = "force-dynamic";

export default async function OwnerStokPage({ searchParams }: PageProps) {
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

  // 2. Ekstraksi Query String
  const query = searchParams?.q?.trim() || "";
  const selectedProject = searchParams?.project || "all";
  const selectedStatus = searchParams?.status || "semua";
  const selectedCategory = searchParams?.kategori || "semua";
  const selectedSort = searchParams?.sort || "terbaru";
  const showArchived = searchParams?.showArchived === "true";
  const currentPage = Math.max(1, parseInt(searchParams?.page || "1", 10));
  const PAGE_SIZE = 20;

  // 3. Ambil Ringkasan Metrik (get_stock_summary)
  let summary: StockSummary = {
    total_jenis: 0,
    total_pcs_tersedia: 0,
    total_menipis: 0,
    total_habis: 0,
    estimasi_nilai_stok: 0,
  };

  try {
    const { data: summaryData, error: summaryErr } = await supabase.rpc(
      "get_stock_summary"
    );
    if (!summaryErr && summaryData && summaryData.length > 0) {
      summary = {
        total_jenis: Number(summaryData[0].total_jenis || 0),
        total_pcs_tersedia: Number(summaryData[0].total_pcs_tersedia || 0),
        total_menipis: Number(summaryData[0].total_menipis || 0),
        total_habis: Number(summaryData[0].total_habis || 0),
        estimasi_nilai_stok: Number(summaryData[0].estimasi_nilai_stok || 0),
      };
    }
  } catch (err) {
    console.error("Gagal memuat get_stock_summary:", err);
  }

  // 4. Ambil Daftar Proyek untuk Filter
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
    console.error("Gagal memuat daftar proyek:", err);
  }

  // 5. Ambil Daftar Kategori Unik
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
    console.error("Gagal memuat daftar kategori:", err);
  }

  // 6. Query Daftar Barang dari v_stock_items
  let items: StockItemView[] = [];
  let totalItems = 0;
  let schemaMissing = false;

  try {
    let qb = supabase
      .from("v_stock_items")
      .select("*", { count: "exact" });

    // Filter status lifecycle
    if (!showArchived) {
      qb = qb.eq("status", "aktif");
    }

    // Filter proyek
    if (selectedProject === "none") {
      qb = qb.is("project_id", null);
    } else if (selectedProject !== "all" && selectedProject) {
      qb = qb.eq("project_id", selectedProject);
    }

    // Filter status stok (tersedia, menipis, habis)
    if (selectedStatus && selectedStatus !== "semua") {
      qb = qb.eq("status_stok", selectedStatus);
    }

    // Filter kategori
    if (selectedCategory && selectedCategory !== "semua") {
      qb = qb.eq("kategori", selectedCategory);
    }

    // Filter pencarian
    if (query) {
      qb = qb.or(
        `nama.ilike.%${query}%,kode.ilike.%${query}%,kategori.ilike.%${query}%,catatan.ilike.%${query}%,lokasi_gudang.ilike.%${query}%`
      );
    }

    // Urutan
    switch (selectedSort) {
      case "stok_terbanyak":
        qb = qb.order("stok_saat_ini", { ascending: false });
        break;
      case "stok_tersedikit":
        qb = qb.order("stok_saat_ini", { ascending: true });
        break;
      case "nama_asc":
        qb = qb.order("nama", { ascending: true });
        break;
      case "terakhir_terjual":
        qb = qb.order("updated_at", { ascending: false });
        break;
      case "terbaru":
      default:
        qb = qb.order("created_at", { ascending: false });
        break;
    }

    // Pagination
    const fromIndex = (currentPage - 1) * PAGE_SIZE;
    const toIndex = fromIndex + PAGE_SIZE - 1;
    qb = qb.range(fromIndex, toIndex);

    const { data: itemsData, count, error: qbError } = await qb;

    if (qbError) {
      console.error("Gagal query v_stock_items:", qbError);
      if (qbError.code === "42P01" || qbError.message.includes("does not exist")) {
        schemaMissing = true;
      }
    } else {
      items = (itemsData as StockItemView[]) || [];
      totalItems = count || 0;
    }
  } catch (err) {
    console.error("Error query stock:", err);
    schemaMissing = true;
  }

  // 7. Ambil Signed URLs untuk thumbnail foto barang
  const thumbPaths = items
    .map((item) => item.sampul_thumb_path)
    .filter((p): p is string => Boolean(p));

  const signedUrlsMap = await getSignedPhotoUrlsBatch(thumbPaths);

  items = items.map((item) => ({
    ...item,
    sampul_thumb_url: item.sampul_thumb_path
      ? signedUrlsMap[item.sampul_thumb_path] || null
      : null,
  }));

  return (
    <StockListClient
      initialItems={items}
      totalItems={totalItems}
      summary={summary}
      projects={projects}
      categories={categories}
      currentPage={currentPage}
      pageSize={PAGE_SIZE}
      schemaMissing={schemaMissing}
    />
  );
}
