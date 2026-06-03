"use client";

// Isolation des données par user_id — DÉSACTIVÉE pour la démo CAPEB.
//
// Retourne TOUJOURS "anon" : toutes les pages /m/* utilisent le même
// namespace localStorage, peu importe le compte connecté. Conséquence :
// 2 comptes Google sur le même device partagent les mêmes données.
//
// C'est OK pour la démo CAPEB où Emilien utilise UN seul compte. Pour
// tester le partage Niveau 1 entre 2 comptes : utiliser 2 navigateurs
// différents (PC + iPhone, ou Safari + Chrome).
//
// L'isolation propre nécessite un refacto complet (server components,
// Supabase comme source de vérité, cleanup race conditions). À faire
// après les premiers vrais clients payants.

const ANON_NAMESPACE = "anon";

export function getCurrentUserId(): string {
  return ANON_NAMESPACE;
}

export function scopedKey(baseKey: string): string {
  return `${baseKey}:${ANON_NAMESPACE}`;
}

export function setCurrentUserId(_userId: string | null): void {
  /* no-op */
}
