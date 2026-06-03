// Storage localStorage des bouteilles + mouvements (CRUD + indexation).
//
// Pattern aligné sur lib/intervention-storage.ts et lib/equipement.ts :
//  - 2 clés distinctes : "vertxia.bouteilles.v1" et "vertxia.mouvements.v1"
//  - Lecture/écriture défensives (SSR-safe + parse JSON sécurisé)
//  - uuid via helper avec fallback Math.random (Safari iOS HTTP)

import type { Bouteille, Mouvement } from "./bouteille";
import { uuid } from "./uuid";
import { scopedKey } from "./user-scope";

const BOUTEILLES_BASE = "vertxia.bouteilles.v1";
const MOUVEMENTS_BASE = "vertxia.mouvements.v1";
function bouteillesKey(): string {
  return scopedKey(BOUTEILLES_BASE);
}
function mouvementsKey(): string {
  return scopedKey(MOUVEMENTS_BASE);
}

// ─── Bouteilles ────────────────────────────────────────────────────────────────

function readBouteilles(): Bouteille[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(bouteillesKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Bouteille[]) : [];
  } catch {
    return [];
  }
}

function writeBouteilles(list: Bouteille[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(bouteillesKey(), JSON.stringify(list));
  } catch (e) {
    console.warn("[bouteille-storage] write failed:", e);
  }
}

export function listBouteilles(): Bouteille[] {
  return readBouteilles();
}

export function getBouteille(id: string): Bouteille | undefined {
  return readBouteilles().find((b) => b.id === id);
}

/** Crée une nouvelle bouteille — génère id + createdAt. */
export function createBouteille(input: Omit<Bouteille, "id" | "createdAt">): Bouteille {
  const bouteille: Bouteille = {
    ...input,
    id: uuid(),
    createdAt: new Date().toISOString(),
  };
  const list = readBouteilles();
  writeBouteilles([bouteille, ...list]);
  return bouteille;
}

/** Met à jour une bouteille existante (par id). Retourne la nouvelle valeur ou undefined. */
export function updateBouteille(id: string, patch: Partial<Omit<Bouteille, "id" | "createdAt">>): Bouteille | undefined {
  const list = readBouteilles();
  const idx = list.findIndex((b) => b.id === id);
  if (idx < 0) return undefined;
  const updated: Bouteille = { ...list[idx], ...patch };
  list[idx] = updated;
  writeBouteilles(list);
  return updated;
}

/** Supprime une bouteille (et tous ses mouvements liés). */
export function deleteBouteille(id: string): void {
  writeBouteilles(readBouteilles().filter((b) => b.id !== id));
  // Cascade : supprime les mouvements liés
  writeMouvements(readMouvements().filter((m) => m.bouteilleId !== id));
}

// ─── Mouvements ────────────────────────────────────────────────────────────────

function readMouvements(): Mouvement[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(mouvementsKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Mouvement[]) : [];
  } catch {
    return [];
  }
}

function writeMouvements(list: Mouvement[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(mouvementsKey(), JSON.stringify(list));
  } catch (e) {
    console.warn("[bouteille-storage] write mouvements failed:", e);
  }
}

export function listMouvements(): Mouvement[] {
  return readMouvements();
}

export function listMouvementsForBouteille(bouteilleId: string): Mouvement[] {
  return readMouvements()
    .filter((m) => m.bouteilleId === bouteilleId)
    .sort((a, b) => new Date(b.dateMouvementISO).getTime() - new Date(a.dateMouvementISO).getTime());
}

export function listMouvementsByPeriode(startISO: string, endISO: string): Mouvement[] {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  return readMouvements()
    .filter((m) => {
      const t = new Date(m.dateMouvementISO).getTime();
      return t >= start && t <= end;
    })
    .sort((a, b) => new Date(a.dateMouvementISO).getTime() - new Date(b.dateMouvementISO).getTime());
}

/** Indexe les mouvements par bouteilleId (utile pour calcul charge en bulk). */
export function indexMouvementsParBouteille(): Map<string, Mouvement[]> {
  const map = new Map<string, Mouvement[]>();
  for (const m of readMouvements()) {
    const arr = map.get(m.bouteilleId) ?? [];
    arr.push(m);
    map.set(m.bouteilleId, arr);
  }
  return map;
}

/** Crée un nouveau mouvement — génère id + createdAt. */
export function createMouvement(input: Omit<Mouvement, "id" | "createdAt">): Mouvement {
  const mouvement: Mouvement = {
    ...input,
    id: uuid(),
    createdAt: new Date().toISOString(),
  };
  const list = readMouvements();
  writeMouvements([mouvement, ...list]);
  return mouvement;
}

/** Supprime un mouvement (utile pour rollback ou correction). */
export function deleteMouvement(id: string): void {
  writeMouvements(readMouvements().filter((m) => m.id !== id));
}

/** Met à jour un mouvement existant (par id). */
export function updateMouvement(id: string, patch: Partial<Omit<Mouvement, "id" | "createdAt">>): Mouvement | undefined {
  const list = readMouvements();
  const idx = list.findIndex((m) => m.id === id);
  if (idx < 0) return undefined;
  const updated: Mouvement = { ...list[idx], ...patch };
  list[idx] = updated;
  writeMouvements(list);
  return updated;
}

/** Retourne tous les mouvements liés à une intervention (utile pour SAV / annulation). */
export function listMouvementsForIntervention(interventionId: string): Mouvement[] {
  return readMouvements().filter((m) => m.interventionId === interventionId);
}
