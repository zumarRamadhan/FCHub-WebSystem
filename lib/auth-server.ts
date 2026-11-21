import { createClient } from "@/lib/supabase/server";

export interface CurrentUserSession {
  id: string;
  nama: string;
  username: string;
  role: "owner" | "penjahit";
  aktif: boolean;
}

/**
 * Memverifikasi di server bahwa pemanggil aksi adalah pengguna yang sah
 * dan memiliki peran 'owner' yang aktif.
 */
export async function requireOwnerSession(): Promise<CurrentUserSession> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Sesi tidak valid atau telah berakhir. Silakan login kembali.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, nama, username, role, aktif")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Profil pengguna tidak ditemukan.");
  }

  if (!profile.aktif) {
    throw new Error("Akun Anda telah dinonaktifkan.");
  }

  if (profile.role !== "owner") {
    throw new Error("Akses ditolak: Hanya owner yang diizinkan melakukan tindakan ini.");
  }

  return profile as CurrentUserSession;
}

/**
 * Memverifikasi di server bahwa pemanggil aksi adalah pengguna yang sah
 * dan memiliki peran 'penjahit' yang aktif.
 */
export async function requirePenjahitSession(): Promise<CurrentUserSession> {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Sesi tidak valid atau telah berakhir. Silakan login kembali.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, nama, username, role, aktif")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Profil penjahit tidak ditemukan.");
  }

  if (!profile.aktif) {
    throw new Error("Akun Anda telah dinonaktifkan oleh owner.");
  }

  return profile as CurrentUserSession;
}
