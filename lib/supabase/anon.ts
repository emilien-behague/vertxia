// Client Supabase anon "pur" — sans cookies de session.
//
// Pourquoi : pour les lectures publiques (partage QR), on veut que la
// policy RLS "equipements_select_public USING (true)" s'applique au
// rôle anon. Avec createServerClient + cookies du visiteur, la requête
// est exécutée en tant qu'authenticated avec son JWT → si une policy
// restrictive existe (user_id = auth.uid()), elle filtre les rows et
// le visiteur ne voit rien.
//
// En passant par un client anon pur, on garantit que les lectures
// publiques voient toutes les rows que la policy "select_public" autorise.

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function createAnonClient(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
  return _client;
}
