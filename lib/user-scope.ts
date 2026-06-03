"use client";

// Isolation des données localStorage par user_id.
//
// Avant : tous les comptes connectés sur le même device voyaient les MÊMES
// équipements / interventions / bouteilles (localStorage global au domaine).
//
// Maintenant : chaque user a son namespace via sessionStorage["vertxia:current-user"].
// Les helpers de storage (lib/equipement.ts, lib/intervention-storage.ts,
// lib/bouteille-storage.ts, lib/profil.ts) appellent scopedKey(base) pour
// préfixer leur clé avec le user_id courant.
//
// Au login → useAuthSync hook appelle setCurrentUser(user.id).
// Au logout → useAuthSync hook appelle setCurrentUser(null) (namespace "anon").

const CURRENT_USER_KEY = "vertxia:current-user";
const ANON_NAMESPACE = "anon";

export function getCurrentUserId(): string {
  if (typeof window === "undefined") return ANON_NAMESPACE;
  try {
    return sessionStorage.getItem(CURRENT_USER_KEY) || ANON_NAMESPACE;
  } catch {
    return ANON_NAMESPACE;
  }
}

export function setCurrentUserId(userId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      sessionStorage.setItem(CURRENT_USER_KEY, userId);
    } else {
      sessionStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch {
    /* sessionStorage indispo (mode privé strict ?) */
  }
}

/**
 * Préfixe une clé de storage avec le namespace user courant.
 * Ex: scopedKey("vertxia:equipements") → "vertxia:equipements:abc-123..."
 */
export function scopedKey(baseKey: string): string {
  return `${baseKey}:${getCurrentUserId()}`;
}
