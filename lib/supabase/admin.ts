import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * createAdminClient:
 * Digunakan HANYA di sisi server (scripts atau secure server tasks)
 * menggunakan SUPABASE_SERVICE_ROLE_KEY.
 * JANGAN PERNAH DIKIRIM KE BROWSER ATAU KLIEN.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
