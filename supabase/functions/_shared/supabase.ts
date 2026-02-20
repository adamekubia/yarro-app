import { createClient } from "jsr:@supabase/supabase-js@2";

export type SupabaseClient = ReturnType<typeof createClient>;

export function createSupabaseClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
