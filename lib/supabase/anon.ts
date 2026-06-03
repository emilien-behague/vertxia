// Client Supabase pour les lectures publiques server-side.
//
// Stratégie :
// - Si SUPABASE_SERVICE_ROLE_KEY est set (recommandé) → on utilise ce role
//   qui BYPASS RLS totalement. C'est sûr car ce client n'est jamais exposé
//   au navigateur, et les routes /api/public/* sont des endpoints intentionnels
//   pour la lecture publique (Niveau 1 partage QR).
// - Sinon → fallback sur publishable key (anon role). Nécessite que les
//   policies "*_select_public USING (true)" soient appliquées dans Supabase.
//
// Pourquoi pas le client cookies-aware : si on lit avec le JWT du visiteur
// authentifié, RLS filtre les rows par auth.uid() → un user connecté ne
// peut pas voir les équipements créés par un autre compte. Le partage
// Niveau 1 est cassé.

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _usingServiceRole = false;

export function createAnonClient(): SupabaseClient {
  if (_client) return _client;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = serviceKey || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  _usingServiceRole = Boolean(serviceKey);
  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
  return _client;
}

export function isUsingServiceRole(): boolean {
  // Trigger lazy init si jamais on demande avant le premier createAnonClient
  if (!_client) createAnonClient();
  return _usingServiceRole;
}
