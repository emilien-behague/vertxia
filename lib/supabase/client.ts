// Client Supabase pour les composants navigateur (Client Components).
//
// Usage :
//   import { createClient } from "@/lib/supabase/client";
//   const supabase = createClient();
//   const { data, error } = await supabase.from("equipements").select("*");
//
// Auth :
//   const { data: { user } } = await supabase.auth.getUser();
//
// Convention Supabase 2026 : NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// (anciennement NEXT_PUBLIC_SUPABASE_ANON_KEY).

import { createBrowserClient, type SupabaseClient } from "@supabase/ssr";

/**
 * Indique si les env vars Supabase sont configurées.
 * Utile pour les composants qui doivent dégrader gracefully en mode démo
 * sans Supabase (ex: /m/* qui marche en localStorage seul).
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export function createClient(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
