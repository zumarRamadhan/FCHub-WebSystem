import { z } from "zod";

/**
 * lib/validations/stock.ts
 * Skema validasi Zod untuk modul Stok Gudang FCHub (Tahap 18).
 */

export const stockStatusSchema = z.enum(["semua", "tersedia", "menipis", "habis"]);
export const stockSortSchema = z.enum([
  "terbaru",
  "stok_terbanyak",
  "stok_tersedikit",
  "nama_asc",
  "terakhir_terjual",
]);

/**
 * Skema pembuatan item stok baru
 */
export const createStockItemSchema = z.object({
  kode: z
    .string()
    .trim()
    .min(2, "Kode barang minimal 2 karakter")
    .max(50, "Kode barang maksimal 50 karakter")
    .regex(/^[A-Za-z0-9_-]+$/, "Kode barang hanya boleh huruf, angka, tanda minus (-), dan garis bawah (_)"),
  nama: z
    .string()
    .trim()
    .min(2, "Nama barang minimal 2 karakter")
    .max(100, "Nama barang maksimal 100 karakter"),
  kategori: z
    .string()
    .trim()
    .min(1, "Kategori wajib diisi")
    .max(50, "Kategori maksimal 50 karakter")
    .default("Umum"),
  project_id: z
    .string()
    .uuid("ID proyek tidak valid")
    .optional()
    .nullable()
    .or(z.literal("")),
  stok_awal: z.coerce
    .number()
    .int("Stok awal harus bilangan bulat")
    .min(0, "Stok awal minimal 0 pcs")
    .default(0),
  ambang_menipis: z.coerce
    .number()
    .int("Ambang menipis harus bilangan bulat")
    .min(0, "Ambang menipis minimal 0 pcs")
    .default(5),
  harga_jual: z.coerce
    .number()
    .min(0, "Harga jual minimal Rp0")
    .optional()
    .nullable()
    .or(z.literal("")),
  lokasi_gudang: z
    .string()
    .trim()
    .max(100, "Lokasi gudang maksimal 100 karakter")
    .optional()
    .nullable()
    .or(z.literal("")),
  catatan: z
    .string()
    .trim()
    .max(500, "Catatan maksimal 500 karakter")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type CreateStockItemInput = z.infer<typeof createStockItemSchema>;

/**
 * Skema pembaruan metadata item stok (tanpa mengubah stok langsung)
 */
export const updateStockItemSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(2, "Nama barang minimal 2 karakter")
    .max(100, "Nama barang maksimal 100 karakter"),
  kategori: z
    .string()
    .trim()
    .min(1, "Kategori wajib diisi")
    .max(50, "Kategori maksimal 50 karakter"),
  project_id: z
    .string()
    .uuid("ID proyek tidak valid")
    .optional()
    .nullable()
    .or(z.literal("")),
  ambang_menipis: z.coerce
    .number()
    .int("Ambang menipis harus bilangan bulat")
    .min(0, "Ambang menipis minimal 0 pcs")
    .default(5),
  harga_jual: z.coerce
    .number()
    .min(0, "Harga jual minimal Rp0")
    .optional()
    .nullable()
    .or(z.literal("")),
  lokasi_gudang: z
    .string()
    .trim()
    .max(100, "Lokasi gudang maksimal 100 karakter")
    .optional()
    .nullable()
    .or(z.literal("")),
  catatan: z
    .string()
    .trim()
    .max(500, "Catatan maksimal 500 karakter")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type UpdateStockItemInput = z.infer<typeof updateStockItemSchema>;

/**
 * Skema pergerakan / mutasi stok atomik
 */
export const adjustStockSchema = z
  .object({
    itemId: z.string().uuid("ID item stok tidak valid"),
    jenis: z.enum(["masuk", "keluar_penjualan", "keluar_rusak", "koreksi"]),
    qty: z.coerce
      .number()
      .int("Jumlah harus berupa bilangan bulat")
      .min(0, "Jumlah tidak boleh negatif"),
    catatan: z
      .string()
      .trim()
      .max(500, "Catatan maksimal 500 karakter")
      .optional()
      .nullable()
      .or(z.literal("")),
    hargaSatuan: z.coerce
      .number()
      .min(0, "Harga satuan minimal Rp0")
      .optional()
      .nullable()
      .or(z.literal("")),
    pembeli: z
      .string()
      .trim()
      .max(100, "Nama pembeli maksimal 100 karakter")
      .optional()
      .nullable()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    // Pada jenis masuk, keluar_penjualan, keluar_rusak: qty harus > 0
    if (data.jenis !== "koreksi" && data.qty <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Jumlah pcs harus lebih dari 0",
        path: ["qty"],
      });
    }

    // Catatan wajib diisi untuk keluar_rusak dan koreksi
    if (data.jenis === "keluar_rusak" && (!data.catatan || data.catatan.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Catatan penyebab barang rusak/hilang wajib diisi",
        path: ["catatan"],
      });
    }

    if (data.jenis === "koreksi" && (!data.catatan || data.catatan.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Alasan koreksi hitungan fisik wajib diisi",
        path: ["catatan"],
      });
    }
  });

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
