"use client";

// Isolation des données localStorage par user_id.
// Avant : tous les comptes connectés sur le même device voyaient les MÊMES
// équipements / interventions / bouteilles (localStorage global au domaine).
// Maintenant : chaque user a son namespace localStorage.
//
// On utilise localStorage (pas sessionStorage) car sessionStorage est purgé
// par Safari iOS en mode privé et après certains reloads → boucle infinie
// dans AuthSync qui détectait un changement de namespace fantôme.

const CURRENT_USER_KEY = "vertxia:current-user";
const ANON_NAMESPACE = "anon";

export function getCurrentUserId(): string {
  if (typeof window === "undefined") return ANON_NAMESPACE;
  try {
    return localStorage.getItem(CURRENT_USER_KEY) || ANON_NAMESPACE;
  } catch {
    return ANON_NAMESPACE;
  }
}

export function setCurrentUserId(userId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      localStorage.setItem(CURRENT_USER_KEY, userId);
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch {
    /* localStorage indispo (mode privé strict ?) */
  }
}

/** Préfixe une clé de storage avec le namespace user courant. */
export function scopedKey(baseKey: string): string {
  return `${baseKey}:${getCurrentUserId()}`;
}
