import { z } from "zod";

/**
 * Skema validasi pembuatan dan pembaruan proyek konveksi
 */
export const projectSchema = z
  .object({
    nama: z
      .string()
      .trim()
      .min(3, "Nama proyek minimal 3 karakter"),
    target_pcs: z.coerce
      .number()
      .int("Target pcs harus berupa bilangan bulat")
      .positive("Target pcs harus lebih dari 0"),
    tarif_per_pcs: z.coerce
      .number()
      .int("Tarif per pcs harus berupa bilangan bulat")
      .positive("Tarif per pcs harus lebih dari 0"),
    reward_aktif: z.boolean().default(false),
    ambang_reward: z.coerce
      .number()
      .int("Ambang reward harus berupa bilangan bulat")
      .min(0, "Ambang reward minimal 0")
      .default(0),
    warna: z
      .enum(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"])
      .default("p1"),
    tanggal_mulai: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal mulai harus YYYY-MM-DD"),
    deadline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format deadline harus YYYY-MM-DD")
      .optional()
      .nullable()
      .or(z.literal("")),
    status: z.enum(["aktif", "selesai", "diarsipkan"]).default("aktif"),
  })
  .superRefine((data, ctx) => {
    // Aturan Bisnis #17: ambang_reward wajib diisi (> 0 dan <= target_pcs) hanya bila reward_aktif = true
    if (data.reward_aktif) {
      if (!data.ambang_reward || data.ambang_reward <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ambang reward wajib diisi lebih dari 0 saat reward diaktifkan",
          path: ["ambang_reward"],
        });
      } else if (data.ambang_reward > data.target_pcs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Ambang reward tidak boleh melebihi target pcs (${data.target_pcs} pcs)`,
          path: ["ambang_reward"],
        });
      }
    }
  });

export type ProjectInput = z.infer<typeof projectSchema>;

/**
 * Skema validasi pembuatan akun penjahit
 */
export const createPenjahitSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(2, "Nama penjahit minimal 2 karakter"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9_-]{3,30}$/,
      "Username harus 3-30 karakter (huruf kecil, angka, - atau _)"
    ),
  pin: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "PIN harus persis 6 digit angka"),
});

export type CreatePenjahitInput = z.infer<typeof createPenjahitSchema>;

/**
 * Skema validasi reset PIN penjahit
 */
export const resetPinSchema = z.object({
  userId: z.string().uuid("ID penjahit tidak valid"),
  newPin: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "PIN baru harus persis 6 digit angka"),
});

export type ResetPinInput = z.infer<typeof resetPinSchema>;
