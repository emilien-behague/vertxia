"use client";

// Isolation des données localStorage par user_id.
//
// SOURCE DE VÉRITÉ : cookie "vertxia-uid" set par le middleware Supabase
// côté serveur (lib/supabase/middleware.ts). Lu SYNCHRONIQUEMENT côté
// client via document.cookie → pas de race condition, pas de re-render
// nécessaire après login.
//
// Avant on utilisait localStorage + AuthSync async → les pages /m/* lisaient
// le mauvais namespace pendant le 1er render (race condition).

const ANON_NAMESPACE = "anon";

export function getCurrentUserId(): string {
  if (typeof document === "undefined") return ANON_NAMESPACE;
  try {
    const match = document.cookie.match(/(?:^|;\s*)vertxia-uid=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    /* doc inaccessible */
  }
  return ANON_NAMESPACE;
}

/**
 * Préfixe une clé de storage avec le namespace user courant.
 * Ex: scopedKey("vertxia:equipements") → "vertxia:equipements:abc-uuid"
 */
export function scopedKey(baseKey: string): string {
  return `${baseKey}:${getCurrentUserId()}`;
}

/** API legacy conservée pour ne pas casser AuthSync. No-op : le cookie est
 *  set par le serveur, le client n'a rien à faire. */
export function setCurrentUserId(_userId: string | null): void {
  /* géré par le middleware serveur via cookie */
}
