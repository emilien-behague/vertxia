// Stockage local des interventions F-Gas générées par Vertxia.
// MVP : localStorage côté client. Multi-device viendra avec OAuth2 + DB.
//
// On ne stocke PAS le PDF lui-même (il est régénéré à la demande à partir
// du payload enregistré), juste les données + l'URL du BSFF TrackDéchets.

import type { TypeIntervention, Destination, ControleDetails } from "@/lib/cerfa";
import { uuid } from "@/lib/uuid";

const STORAGE_KEY = "vertxia:interventions";

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
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function listInterventions(): StoredIntervention[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
  data: Omit<StoredIntervention, "id" | "createdAt">
): StoredIntervention {
  if (!isBrowser()) {
    throw new Error("localStorage indisponible (SSR ?)");
  }
  const entry: StoredIntervention = {
    ...data,
    id: uuid(),
    createdAt: new Date().toISOString(),
  };
  const all = listInterventions();
  all.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return entry;
}

export function deleteIntervention(id: string): void {
  if (!isBrowser()) return;
  const filtered = listInterventions().filter(i => i.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function clearAllInterventions(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
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
