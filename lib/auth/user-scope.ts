"use client";

// Isolation des données localStorage par user_id.
//
// SOURCE DE VÉRITÉ : cookie "vertxia-uid" set par le middleware Supabase
// côté serveur (lib/supabase/middleware.ts) à chaque request. Lu côté
// client de manière SYNCHRONE via document.cookie → pas de race condition.
//
// Comportement :
// - Si connecté : cookie = user.id → namespace localStorage = user.id
// - Si pas connecté : cookie vide ou absent → namespace = "anon"
//
// Conséquence : chaque compte Google a son propre parc isolé sur ce device.
// Les anciens équipements créés avant ce déploiement restent sous "anon"
// (accessibles uniquement en mode déconnecté).

const ANON_NAMESPACE = "anon";

export function getCurrentUserId(): string {
  if (typeof document === "undefined") return ANON_NAMESPACE;
  try {
    const match = document.cookie.match(/(?:^|;\s*)vertxia-uid=([^;]+)/);
    if (match && match[1] && match[1] !== "") {
      return decodeURIComponent(match[1]);
    }
  } catch {
    /* document inaccessible */
  }
  return ANON_NAMESPACE;
}

export function scopedKey(baseKey: string): string {
  return `${baseKey}:${getCurrentUserId()}`;
}

/** No-op : le cookie est géré par le middleware serveur, le client n'a
 *  rien à set manuellement. Conservé pour compat AuthSync. */
export function setCurrentUserId(_userId: string | null): void {
  /* géré par le middleware */
}
