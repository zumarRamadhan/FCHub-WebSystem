import { z } from "zod";

/**
 * Skema validasi penolakan input produksi oleh owner
 * Catatan penolakan bersifat wajib singkat
 */
export const rejectEntrySchema = z.object({
  id: z.string().uuid("ID entri tidak valid"),
  catatan: z
    .string()
    .trim()
    .min(2, "Catatan penolakan wajib diisi (minimal 2 karakter)"),
});

export type RejectEntryInput = z.infer<typeof rejectEntrySchema>;

/**
 * Skema validasi koreksi jumlah dan persetujuan oleh owner
 */
export const correctEntrySchema = z.object({
  id: z.string().uuid("ID entri tidak valid"),
  qty_disetujui: z.coerce
    .number()
    .int("Jumlah pcs harus berupa bilangan bulat")
    .min(0, "Jumlah pcs disetujui tidak boleh negatif"),
  catatan: z.string().trim().optional(),
});

export type CorrectEntryInput = z.infer<typeof correctEntrySchema>;
