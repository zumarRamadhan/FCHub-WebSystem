"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerSession } from "@/lib/auth-server";
import { projectSchema, ProjectInput } from "@/lib/validations/owner";

export async function createProjectAction(data: ProjectInput) {
  try {
    await requireOwnerSession();

    const parsed = projectSchema.parse(data);

    const supabase = createClient();
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        nama: parsed.nama,
        target_pcs: parsed.target_pcs,
        tarif_per_pcs: parsed.tarif_per_pcs,
        reward_aktif: parsed.reward_aktif,
        ambang_reward: parsed.reward_aktif ? parsed.ambang_reward : 0,
        warna: parsed.warna,
        tanggal_mulai: parsed.tanggal_mulai,
        deadline: parsed.deadline ? parsed.deadline : null,
        status: parsed.status,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/owner/proyek");
    revalidatePath("/owner/dashboard");
    return { success: true, data: project };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menambahkan proyek.";
    return { success: false, error: message };
  }
}

export async function updateProjectAction(id: string, data: ProjectInput) {
  try {
    await requireOwnerSession();

    if (!id) {
      return { success: false, error: "ID proyek tidak valid." };
    }

    const parsed = projectSchema.parse(data);

    const supabase = createClient();
    const { data: project, error } = await supabase
      .from("projects")
      .update({
        nama: parsed.nama,
        target_pcs: parsed.target_pcs,
        tarif_per_pcs: parsed.tarif_per_pcs,
        reward_aktif: parsed.reward_aktif,
        ambang_reward: parsed.reward_aktif ? parsed.ambang_reward : 0,
        warna: parsed.warna,
        tanggal_mulai: parsed.tanggal_mulai,
        deadline: parsed.deadline ? parsed.deadline : null,
        status: parsed.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/owner/proyek");
    revalidatePath("/owner/dashboard");
    return { success: true, data: project };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui proyek.";
    return { success: false, error: message };
  }
}
