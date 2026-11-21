import { z } from "zod";

/**
 * Skema validasi pengiriman entri hasil kerja harian penjahit
 */
export const createEntrySchema = z.object({
  project_id: z.string().uuid("Pilih proyek yang valid"),
  tanggal_kerja: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal kerja harus YYYY-MM-DD"),
  qty: z.coerce
    .number()
    .int("Jumlah pcs harus berupa bilangan bulat")
    .positive("Jumlah pcs harus lebih dari 0")
    .max(2000, "Jumlah pcs melebihi batas wajar harian (maks 2.000 pcs)"),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;

/**
 * Skema validasi pembaruan entri produksi oleh penjahit (hanya status menunggu)
 */
export const updateEntrySchema = z.object({
  id: z.string().uuid("ID entri tidak valid"),
  tanggal_kerja: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal kerja harus YYYY-MM-DD"),
  qty: z.coerce
    .number()
    .int("Jumlah pcs harus berupa bilangan bulat")
    .positive("Jumlah pcs harus lebih dari 0")
    .max(2000, "Jumlah pcs melebihi batas wajar harian (maks 2.000 pcs)"),
});

export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
