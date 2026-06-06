// Stockage local des interventions F-Gas générées par Vertxia.
// MVP : localStorage côté client. Multi-device viendra avec OAuth2 + DB.
//
// On ne stocke PAS le PDF lui-même (il est régénéré à la demande à partir
// du payload enregistré), juste les données + l'URL du BSFF TrackDéchets.

import type { TypeIntervention, Destination, ControleDetails } from "@/lib/cerfa/cerfa";
import { uuid } from "@/lib/uuid";
import { scopedKey } from "@/lib/user-scope";

const STORAGE_KEY_BASE = "vertxia:interventions";
function storageKey(): string {
  return scopedKey(STORAGE_KEY_BASE);
}

// Tombstones : IDs des interventions supprimees localement. Necessaire car la
// page historique merge des interventions remote (Supabase, confreres via lien
// magique) avec les locales — sans tombstone, une intervention supprimee
// "reapparait" au prochain refresh tant que le delete Supabase n'a pas reussi
// (offline) ou tant qu'un confrere la garde dans son cache.
const TOMBSTONE_KEY_BASE = "vertxia:interventions:deleted";
const TOMBSTONE_MAX = 5000;
function tombstoneKey(): string {
  return scopedKey(TOMBSTONE_KEY_BASE);
}

export type StoredIntervention = {
  /** UUID local — pas relié à TrackDéchets, pour le tri/identification UI. */
  id: string;
  /** Date de création ISO 8601. */
  createdAt: string;
  typeIntervention: TypeIntervention;
  fluide: { code: string; label: string; gwp: number };
  weight: number;
  packagingNumero: string;
  clientName: string | null;
  modeleEquipement?: string;
  numeroSerieEquipement?: string;
  attestation?: string;
  lieuIntervention?: string;
  /** Si récupération : BSFF officiel signé. */
  bsffId?: string;
  /** URL signée TrackDéchets — peut expirer après ~15min. */
  bsffPdfUrl?: string;
  bsffSignedAt?: string;
  destination?: Destination | null;
  controleDetails?: ControleDetails;
  /** Signature détenteur — on stocke juste le flag (la dataURL est trop lourde). */
  hasDetenteurSignature?: boolean;
  detenteurName?: string;
  detenteurQuality?: string;
  /** Notes libres saisies ou dictées par le technicien (observations terrain) */
  notes?: string;
  /** Si l'intervention a ete creee depuis un diagnostic IA, on garde la ref
   *  pour afficher la photo + composant identifie sur la page detail. */
  diagnosticId?: string;
  /** ID de l'equipement parent dans le parc. Persiste localement (pas
   *  seulement dans le sync Supabase) pour pouvoir generer un QR de l'etiquette
   *  TFE qui pointe vers /eq/<id> (page publique avec historique). */
  equipementId?: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function listInterventions(): StoredIntervention[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredIntervention[];
    if (!Array.isArray(parsed)) return [];
    // Tri par date desc (plus récent en premier)
    return parsed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function getIntervention(id: string): StoredIntervention | null {
  return listInterventions().find(i => i.id === id) ?? null;
}

export function saveIntervention(
  data: Omit<StoredIntervention, "id" | "createdAt"> & { equipementId?: string }
): StoredIntervention {
  if (!isBrowser()) {
    throw new Error("localStorage indisponible (SSR ?)");
  }
  const { equipementId, ...rest } = data;
  const entry: StoredIntervention = {
    ...rest,
    id: uuid(),
    createdAt: new Date().toISOString(),
    // Persiste l'equipementId en local pour pouvoir generer l'etiquette TFE
    // avec QR -> /eq/<id> meme sans roundtrip Supabase.
    equipementId,
  };
  const all = listInterventions();
  all.unshift(entry);
  localStorage.setItem(storageKey(), JSON.stringify(all));
  // Sync background vers Supabase pour partage public (scan QR de l'équipement
  // → l'historique s'affiche). equipementId lie l'intervention à un équipement
  // du parc partagé.
  import("@/lib/public-sync")
    .then((m) => m.syncInterventionToSupabase(entry, equipementId))
    .catch(() => {});
  return entry;
}

/** Met a jour les champs editables d'une intervention existante.
 *  Resync vers Supabase en background si l'intervention a un equipementId.
 *  Retourne l'intervention mise a jour ou null si introuvable. */
export function updateIntervention(
  id: string,
  patch: Partial<Omit<StoredIntervention, "id" | "createdAt">>
): StoredIntervention | null {
  if (!isBrowser()) return null;
  const all = listInterventions();
  const idx = all.findIndex(i => i.id === id);
  if (idx === -1) return null;
  const updated: StoredIntervention = { ...all[idx], ...patch };
  all[idx] = updated;
  localStorage.setItem(storageKey(), JSON.stringify(all));
  // Resync Supabase en background (silent fail si offline ou pas connecte)
  import("@/lib/public-sync")
    .then((m) => m.syncInterventionToSupabase(updated, updated.equipementId))
    .catch(() => {});
  return updated;
}

export function deleteIntervention(id: string): void {
  if (!isBrowser()) return;
  // 1. Retire de la liste locale
  const filtered = listInterventions().filter(i => i.id !== id);
  localStorage.setItem(storageKey(), JSON.stringify(filtered));
  // 2. Marque l'ID comme tombstone (filtre anti-resurrection au merge remote)
  addInterventionTombstone(id);
  // 3. Supprime cote Supabase en background (silent fail si offline / pas auth)
  import("@/lib/public-sync")
    .then((m) => m.deleteInterventionFromSupabase(id))
    .catch(() => {});
}

export function clearAllInterventions(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(storageKey());
}

/** Retourne l'ensemble des IDs d'interventions supprimees localement.
 *  A appeler par le merge UI (historique) pour filtrer les remotes. */
export function getDeletedInterventionIds(): Set<string> {
  if (!isBrowser()) return new Set();
  try {
    const raw = localStorage.getItem(tombstoneKey());
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function addInterventionTombstone(id: string): void {
  if (!isBrowser()) return;
  try {
    const current = getDeletedInterventionIds();
    if (current.has(id)) return;
    current.add(id);
    // Cap a TOMBSTONE_MAX pour eviter une croissance non bornee (FIFO).
    let arr = Array.from(current);
    if (arr.length > TOMBSTONE_MAX) {
      arr = arr.slice(arr.length - TOMBSTONE_MAX);
    }
    localStorage.setItem(tombstoneKey(), JSON.stringify(arr));
  } catch {
    // Quota plein / mode prive : on ignore, le delete UI a deja eu lieu
  }
}

/** Compteurs pour le header de la page historique. */
export function getStats(items: StoredIntervention[]): {
  total: number;
  thisMonth: number;
  thisYear: number;
  withBsff: number;
} {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
  return {
    total: items.length,
    thisMonth: items.filter(i => i.createdAt >= monthStart).length,
    thisYear: items.filter(i => i.createdAt >= yearStart).length,
    withBsff: items.filter(i => Boolean(i.bsffId)).length,
  };
}
