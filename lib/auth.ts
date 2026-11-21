/**
 * lib/auth.ts
 * Tipe dan antarmuka peran pengguna FCHub (owner vs penjahit).
 */

export type UserRole = "owner" | "penjahit";

export interface FCHubUser {
  id: string;
  nama: string;
  username: string;
  role: UserRole;
  aktif: boolean;
}

/**
 * Format email internal untuk pemetaan auth Supabase:
 * Username + PIN dipetakan ke email sintesis di Supabase Auth.
 * Contoh: "budi" -> "budi@fchub.local"
 */
export function formatInternalEmail(username: string): string {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return `${clean}@fchub.local`;
}
