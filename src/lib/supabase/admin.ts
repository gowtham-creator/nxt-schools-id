import { createClient } from "@supabase/supabase-js";

/**
 * Privileged, service-role Supabase client — SERVER ONLY.
 * Bypasses RLS. Never import this into a Client Component.
 * Use for trusted admin tasks: bulk import, card generation, user provisioning.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
