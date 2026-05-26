import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getReservationClient(url?: string, anonKey?: string): SupabaseClient {
  const supabaseUrl = url ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "ReservationForm: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing. " +
        "Set them in your site's .env or pass `supabaseUrl` / `supabaseAnonKey` props."
    );
  }
  if (cached) return cached;
  cached = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
  return cached;
}
