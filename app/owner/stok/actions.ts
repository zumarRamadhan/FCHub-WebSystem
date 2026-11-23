"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createStockItemSchema,
  updateStockItemSchema,
  adjustStockSchema,
  type AdjustStockInput,
} from "@/lib/validations/stock";
import type { StockItemPhoto } from "@/lib/types/database";

/**
 * Helper validasi peran owner di sisi server
 */
async function verifyOwnerSession() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sesi tidak valid. Harap login kembali.");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role, aktif")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "owner" || !profile.aktif) {
    throw new Error("Akses ditolak: Hanya peran owner yang berhak mengelola stok.");
  }

  return { supabase, user };
}

/**
 * Server Action: Tambah Barang Stok Baru
 */
export async function createStockItemAction(formData: FormData) {
  try {
    const { supabase, user } = await verifyOwnerSession();

    // 1. Ekstrak data teks & validasi Zod
    const rawData = {
      kode: formData.get("kode")?.toString() || "",
      nama: formData.get("nama")?.toString() || "",
      kategori: formData.get("kategori")?.toString() || "Umum",
      project_id: formData.get("project_id")?.toString() || null,
      stok_awal: formData.get("stok_awal")?.toString() || "0",
      ambang_menipis: formData.get("ambang_menipis")?.toString() || "5",
      harga_jual: formData.get("harga_jual")?.toString() || "",
      lokasi_gudang: formData.get("lokasi_gudang")?.toString() || "",
      catatan: formData.get("catatan")?.toString() || "",
    };

    const parsed = createStockItemSchema.safeParse(rawData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Data barang tidak valid";
      return { success: false, error: firstError };
    }

    const {
      kode,
      nama,
      kategori,
      project_id,
      stok_awal,
      ambang_menipis,
      harga_jual,
      lokasi_gudang,
      catatan,
    } = parsed.data;

    const projectIdClean = project_id && project_id !== "none" && project_id !== "all" ? project_id : null;
    const hargaJualClean = harga_jual ? Number(harga_jual) : null;

    // 2. Unggah foto-foto yang dilampirkan (maks 5)
    const photoCount = parseInt(formData.get("photo_count")?.toString() || "0", 10);
    const photos: StockItemPhoto[] = [];
    const tempItemId = crypto.randomUUID();
    const timestamp = Date.now();

    for (let i = 0; i < Math.min(photoCount, 5); i++) {
      const fullBlob = formData.get(`photo_${i}_full`) as Blob | null;
      const thumbBlob = formData.get(`photo_${i}_thumb`) as Blob | null;
      const originalName = formData.get(`photo_${i}_name`)?.toString() || `foto-${i + 1}`;

      if (fullBlob && thumbBlob) {
        const fullPath = `items/${tempItemId}/${timestamp}_${i}_full.webp`;
        const thumbPath = `items/${tempItemId}/${timestamp}_${i}_thumb.webp`;

        // Upload Full
        const { error: errFull } = await supabase.storage
          .from("stock-photos")
          .upload(fullPath, fullBlob, {
            contentType: "image/webp",
            upsert: false,
          });

        if (errFull) {
          console.error("Gagal unggah foto full:", errFull);
          continue;
        }

        // Upload Thumbnail
        const { error: errThumb } = await supabase.storage
          .from("stock-photos")
          .upload(thumbPath, thumbBlob, {
            contentType: "image/webp",
            upsert: false,
          });

        if (errThumb) {
          console.error("Gagal unggah foto thumb:", errThumb);
          continue;
        }

        photos.push({
          full_path: fullPath,
          thumb_path: thumbPath,
          name: originalName,
          created_at: new Date().toISOString(),
        });
      }
    }

    // 3. Simpan item ke tabel stock_items
    const { data: newItem, error: insertError } = await supabase
      .from("stock_items")
      .insert({
        id: tempItemId,
        kode: kode.trim().toUpperCase(),
        nama: nama.trim(),
        kategori: kategori.trim(),
        project_id: projectIdClean,
        stok_saat_ini: stok_awal,
        ambang_menipis,
        harga_jual: hargaJualClean,
        lokasi_gudang: lokasi_gudang?.trim() || null,
        catatan: catatan?.trim() || null,
        foto: photos,
        status: "aktif",
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return {
          success: false,
          error: `Kode barang "${kode.toUpperCase()}" sudah terdaftar. Harap gunakan kode unik lain.`,
        };
      }
      return { success: false, error: `Gagal menyimpan barang: ${insertError.message}` };
    }

    // 4. Jika stok awal > 0, catat mutasi masuk awal
    if (stok_awal > 0) {
      const { error: movError } = await supabase.from("stock_movements").insert({
        stock_item_id: newItem.id,
        jenis: "masuk",
        jumlah: stok_awal,
        stok_sebelum: 0,
        stok_sesudah: stok_awal,
        harga_satuan: hargaJualClean,
        total_harga: hargaJualClean ? hargaJualClean * stok_awal : null,
        catatan: "Pencatatan stok awal saat penambahan barang ke gudang",
        created_by: user.id,
      });

      if (movError) {
        console.error("Gagal mencatat mutasi awal:", movError);
      }
    }

    revalidatePath("/owner/stok");
    return { success: true, item: newItem };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Terjadi kesalahan internal";
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Perbarui Informasi Barang Stok
 */
export async function updateStockItemAction(formData: FormData) {
  try {
    const { supabase } = await verifyOwnerSession();

    const id = formData.get("id")?.toString();
    if (!id) return { success: false, error: "ID barang tidak ditemukan." };

    const rawData = {
      nama: formData.get("nama")?.toString() || "",
      kategori: formData.get("kategori")?.toString() || "Umum",
      project_id: formData.get("project_id")?.toString() || null,
      ambang_menipis: formData.get("ambang_menipis")?.toString() || "5",
      harga_jual: formData.get("harga_jual")?.toString() || "",
      lokasi_gudang: formData.get("lokasi_gudang")?.toString() || "",
      catatan: formData.get("catatan")?.toString() || "",
    };

    const parsed = updateStockItemSchema.safeParse(rawData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Data barang tidak valid";
      return { success: false, error: firstError };
    }

    const { nama, kategori, project_id, ambang_menipis, harga_jual, lokasi_gudang, catatan } =
      parsed.data;

    const projectIdClean = project_id && project_id !== "none" && project_id !== "all" ? project_id : null;
    const hargaJualClean = harga_jual ? Number(harga_jual) : null;

    // Foto eksisting yang dipertahankan
    const existingPhotosRaw = formData.get("existing_photos")?.toString() || "[]";
    let finalPhotos: StockItemPhoto[] = [];
    try {
      finalPhotos = JSON.parse(existingPhotosRaw);
    } catch {
      finalPhotos = [];
    }

    // Foto baru jika ada (maksimal sisa kapasitas sampai 5 foto)
    const newPhotoCount = parseInt(formData.get("new_photo_count")?.toString() || "0", 10);
    const timestamp = Date.now();

    for (let i = 0; i < newPhotoCount && finalPhotos.length < 5; i++) {
      const fullBlob = formData.get(`new_photo_${i}_full`) as Blob | null;
      const thumbBlob = formData.get(`new_photo_${i}_thumb`) as Blob | null;
      const originalName = formData.get(`new_photo_${i}_name`)?.toString() || `foto-baru-${i + 1}`;

      if (fullBlob && thumbBlob) {
        const fullPath = `items/${id}/${timestamp}_new_${i}_full.webp`;
        const thumbPath = `items/${id}/${timestamp}_new_${i}_thumb.webp`;

        await supabase.storage.from("stock-photos").upload(fullPath, fullBlob, {
          contentType: "image/webp",
          upsert: false,
        });

        await supabase.storage.from("stock-photos").upload(thumbPath, thumbBlob, {
          contentType: "image/webp",
          upsert: false,
        });

        finalPhotos.push({
          full_path: fullPath,
          thumb_path: thumbPath,
          name: originalName,
          created_at: new Date().toISOString(),
        });
      }
    }

    const { data: updatedItem, error } = await supabase
      .from("stock_items")
      .update({
        nama: nama.trim(),
        kategori: kategori.trim(),
        project_id: projectIdClean,
        ambang_menipis,
        harga_jual: hargaJualClean,
        lokasi_gudang: lokasi_gudang?.trim() || null,
        catatan: catatan?.trim() || null,
        foto: finalPhotos,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: `Gagal memperbarui barang: ${error.message}` };
    }

    revalidatePath("/owner/stok");
    revalidatePath(`/owner/stok/${id}`);
    return { success: true, item: updatedItem };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Terjadi kesalahan internal";
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Arsipkan atau Buka Arsip Barang
 */
export async function toggleArchiveStockItemAction(id: string, isArchived: boolean) {
  try {
    const { supabase } = await verifyOwnerSession();

    const newStatus = isArchived ? "diarsipkan" : "aktif";
    const { error } = await supabase
      .from("stock_items")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return { success: false, error: `Gagal mengubah status arsip: ${error.message}` };
    }

    revalidatePath("/owner/stok");
    revalidatePath(`/owner/stok/${id}`);
    return { success: true, status: newStatus };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Terjadi kesalahan internal";
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Catat Pergerakan / Mutasi Stok Atomik (RPC adjust_stock)
 */
export async function recordStockMovementAction(input: AdjustStockInput) {
  try {
    const { supabase } = await verifyOwnerSession();

    const parsed = adjustStockSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Data mutasi tidak valid";
      return { success: false, error: firstError };
    }

    const { itemId, jenis, qty, catatan, hargaSatuan, pembeli } = parsed.data;

    const { data: movement, error } = await supabase.rpc("adjust_stock", {
      p_item_id: itemId,
      p_jenis: jenis,
      p_qty: qty,
      p_catatan: catatan?.trim() || null,
      p_harga_satuan: hargaSatuan && Number(hargaSatuan) > 0 ? Number(hargaSatuan) : null,
      p_pembeli: pembeli?.trim() || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/owner/stok");
    revalidatePath(`/owner/stok/${itemId}`);
    return { success: true, movement };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Terjadi kesalahan internal";
    return { success: false, error: msg };
  }
}

/**
 * Helper Server: Dapatkan Signed URLs berumur pendek (1 jam) untuk foto stok
 */
export async function getSignedPhotoUrlsBatch(
  paths: string[]
): Promise<Record<string, string>> {
  if (!paths || paths.length === 0) return {};
  try {
    const supabase = createClient();
    const cleanPaths = Array.from(new Set(paths.filter(Boolean)));
    if (cleanPaths.length === 0) return {};

    const { data, error } = await supabase.storage
      .from("stock-photos")
      .createSignedUrls(cleanPaths, 3600); // 1 jam

    if (error || !data) {
      console.error("Gagal membuat signed URL foto:", error);
      return {};
    }

    const map: Record<string, string> = {};
    for (const item of data) {
      if (item.signedUrl && item.path) {
        map[item.path] = item.signedUrl;
      }
    }
    return map;
  } catch (err) {
    console.error("Error getSignedPhotoUrlsBatch:", err);
    return {};
  }
}
