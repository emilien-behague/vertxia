// Synchronisation des données locales vers Supabase pour le partage public
// Niveau 1 — quiconque scan le QR d'un équipement peut lire la fiche +
// l'historique des interventions, même sans compte Vertxia.
//
// Stratégie :
//  - Sur saveEquipement local → upsert vers Supabase en background
//  - Sur saveIntervention local → idem
//  - Si l'utilisateur n'est pas connecté Supabase → skip silencieux
//    (les données restent en local, juste pas partagées)
//  - Si une erreur réseau survient → silencieuse, ne casse pas le flow
//
// Lecture publique :
//  - fetchPublicEquipement(id) : retourne l'équipement depuis Supabase
//    (RLS policy "equipements_select_public" autorise anon + authenticated)
//  - fetchPublicInterventions(equipementId) : historique lié à un équipement

import type { StoredEquipement, UniteInterieure } from "@/lib/equipement";
import type { StoredIntervention } from "@/lib/intervention-storage";

// ── ECRITURES (sync local → Supabase) ───────────────────────────────────────

/** Resultat detaille du sync, pour les flows critiques (etiquette F-Gas)
 *  qui ont besoin de savoir si l'eq est BIEN en BDD avant de generer un QR. */
export type SyncResult =
  | { ok: true }
  | { ok: false; reason: "auth"; message: string }
  | { ok: false; reason: "network"; message: string }
  | { ok: false; reason: "server"; message: string; code?: string };

export async function syncEquipementToSupabase(eq: StoredEquipement): Promise<SyncResult> {
  if (typeof window === "undefined") return { ok: false, reason: "network", message: "SSR" };
  try {
    const res = await fetch("/api/public/equipement/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(eq),
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) {
      return {
        ok: false,
        reason: "auth",
        message: "Tu dois être connecté à Vertxia pour synchroniser l'équipement.",
      };
    }
    const j = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    console.warn("[public-sync] equipement upsert failed:", j);
    return {
      ok: false,
      reason: "server",
      message: j.error || `Erreur serveur HTTP ${res.status}`,
      code: j.code,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[public-sync] equipement sync failed:", msg);
    return { ok: false, reason: "network", message: msg };
  }
}

export async function syncInterventionToSupabase(int: StoredIntervention, equipementId?: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/api/public/intervention/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...int, equipementId }),
    });
    if (!res.ok) {
      if (res.status !== 401) {
        const j = await res.json().catch(() => ({}));
        console.warn("[public-sync] intervention upsert failed:", j);
      }
    }
  } catch (e) {
    console.warn("[public-sync] intervention sync failed:", e);
  }
}

// ── LECTURES PUBLIQUES (Supabase → app) ─────────────────────────────────────

export type PublicEquipement = StoredEquipement & {
  ownerUserId: string;
  /** True si le visiteur ≠ owner (= ne peut pas éditer). */
  isReadOnly: boolean;
  /** True si le visiteur EST le owner. */
  isOwner: boolean;
  /** True si le visiteur peut démarrer une nouvelle intervention sur cet eq.
   *  Owner = toujours. Confrère = uniquement s'il a déjà au moins 1 intervention
   *  sur cet équipement (= il a déjà été "admis" par une prise en charge). */
  canCreateIntervention: boolean;
  /** Niveaux de visibilité :
   *  - "public" : visiteur anonyme → vue épurée pure
   *  - "confrere" : pro Vertxia d'une autre boîte → vue technique sans données commerciales
   *  - "full" : owner ou technicien ayant déjà intervenu → tout visible */
  mode: "full" | "public" | "confrere";
  /** Présent UNIQUEMENT en mode "public" : coordonnées du technicien référent. */
  ownerPublic?: {
    raisonSociale: string | null;
    telephone: string | null;
    email: string | null;
    numeroAttestation: string | null;
  } | null;
  /** Debug serveur — utile pour comprendre pourquoi le mode est "confrere"
   *  alors qu'un grant aurait dû passer le visiteur en "full". */
  debug?: {
    userId: string;
    isOwner: boolean;
    hasIntervened: boolean;
    hasGrant: boolean;
    ownerUserId: string;
  } | null;
};

// Debug : la dernière exécution de fetchPublicEquipement stocke ici le détail
// (pour afficher dans le UI quand un équipement est introuvable).
export type FetchDebug = {
  supabaseConfigured: boolean;
  fetched: boolean;
  errorMessage?: string;
  errorCode?: string;
  rowCount?: number;
  searchedId: string;
};
export let lastFetchDebug: FetchDebug | null = null;

export async function fetchPublicEquipement(id: string): Promise<PublicEquipement | null> {
  if (typeof window === "undefined") return null;
  // On passe désormais par une route API server-side qui parle à Supabase
  // côté Node.js. Côté client, c'est un fetch same-origin → pas de CORS,
  // pas d'ITP Safari iOS, pas de "Load failed" sur les domaines tiers.
  try {
    const res = await fetch(`/api/public/equipement/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { "cache-control": "no-store" },
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {}
      lastFetchDebug = {
        supabaseConfigured: true,
        fetched: true,
        errorMessage: msg,
        searchedId: id,
      };
      return null;
    }
    const json = (await res.json()) as {
      data: Record<string, unknown> | null;
      mode?: "full" | "public" | "confrere";
      isOwner?: boolean;
      isReadOnly: boolean;
      canCreateIntervention?: boolean;
      ownerPublic?: PublicEquipement["ownerPublic"];
      debug?: PublicEquipement["debug"];
    };
    if (!json.data) {
      lastFetchDebug = {
        supabaseConfigured: true,
        fetched: true,
        rowCount: 0,
        searchedId: id,
      };
      return null;
    }
    const data = json.data;
    const mode = json.mode ?? (json.isReadOnly ? "public" : "full");
    lastFetchDebug = {
      supabaseConfigured: true,
      fetched: true,
      rowCount: 1,
      searchedId: id,
    };
    // Les champs commerciaux (client, notes) ne sont présents dans la
    // réponse API qu'en mode "full". En "public" ou "confrere" ils sont
    // absents — on met des placeholders neutres.
    const isFullMode = mode === "full";
    return {
      id: data.id as string,
      createdAt: data.created_at as string,
      clientName: isFullMode ? ((data.client_name as string) ?? "") : "",
      clientEmail: isFullMode ? ((data.client_email as string) ?? undefined) : undefined,
      clientTelephone: isFullMode ? ((data.client_telephone as string) ?? undefined) : undefined,
      siteAdresse: isFullMode ? ((data.site_adresse as string) ?? undefined) : undefined,
      modele: data.modele as string,
      numeroSerie: data.numero_serie as string,
      fluide: {
        code: data.fluide_code as string,
        label: (data.fluide_label as string) ?? (data.fluide_code as string),
        gwp: (data.fluide_gwp as number) ?? 0,
      },
      chargeKg: Number(data.charge_kg) || 0,
      detecteurFixe: Boolean(data.detecteur_fixe),
      dernierControleISO: (data.dernier_controle_iso as string) ?? undefined,
      // unites_interieures détaillées en mode "full" et "confrere" (technique objective)
      unitesInterieures: mode !== "public"
        ? ((data.unites_interieures as UniteInterieure[]) ?? undefined)
        : undefined,
      // notes uniquement en "full" (donnée commerciale)
      notes: isFullMode ? ((data.notes as string) ?? undefined) : undefined,
      ownerUserId: data.user_id as string,
      isReadOnly: json.isReadOnly,
      isOwner: json.isOwner ?? !json.isReadOnly,
      canCreateIntervention: json.canCreateIntervention ?? (json.isOwner ?? !json.isReadOnly),
      mode,
      ownerPublic: json.ownerPublic ?? null,
      debug: json.debug ?? null,
    };
  } catch (e) {
    console.warn("[public-sync] fetchPublicEquipement failed:", e);
    lastFetchDebug = {
      supabaseConfigured: true,
      fetched: false,
      errorMessage: e instanceof Error ? e.message : String(e),
      searchedId: id,
    };
    return null;
  }
}

/** Compte total d'équipements dans Supabase (visibles publiquement).
 *  Pour debug : si 0 → le sync n'a jamais marché. Si > 0 → bug fetch ID.
 *  Passe par la route API server-side (same-origin, pas de CORS). */
export async function countPublicEquipements(): Promise<number | { error: string } | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/public/count", {
      method: "GET",
      headers: { "cache-control": "no-store" },
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {}
      return { error: msg };
    }
    const j = (await res.json()) as { count: number };
    return j.count ?? 0;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// ── PULL MULTI-DEVICE (Supabase -> localStorage, hydratation au login) ──────

/** Mappe une row Supabase equipements -> StoredEquipement camelCase.
 *  Utilise par fetchMyEquipements + tout endpoint qui retourne du raw DB. */
function mapEquipementRow(row: Record<string, unknown>): StoredEquipement {
  return {
    id: row.id as string,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    clientName: (row.client_name as string) ?? "",
    clientEmail: (row.client_email as string) ?? undefined,
    clientTelephone: (row.client_telephone as string) ?? undefined,
    siteAdresse: (row.site_adresse as string) ?? undefined,
    modele: (row.modele as string) ?? "",
    numeroSerie: (row.numero_serie as string) ?? "",
    fluide: {
      code: (row.fluide_code as string) ?? "",
      label: (row.fluide_label as string) ?? (row.fluide_code as string) ?? "",
      gwp: Number(row.fluide_gwp) || 0,
    },
    chargeKg: Number(row.charge_kg) || 0,
    detecteurFixe: Boolean(row.detecteur_fixe),
    dernierControleISO: (row.dernier_controle_iso as string) ?? undefined,
    unitesInterieures: (row.unites_interieures as UniteInterieure[]) ?? undefined,
    notes: (row.notes as string) ?? undefined,
  };
}

function mapInterventionRow(row: Record<string, unknown>): StoredIntervention {
  return {
    id: row.id as string,
    createdAt: (row.date_iso as string) ?? new Date().toISOString(),
    typeIntervention: row.type_intervention as StoredIntervention["typeIntervention"],
    fluide: {
      code: (row.fluide_code as string) ?? "",
      label: (row.fluide_label as string) ?? (row.fluide_code as string) ?? "",
      gwp: Number(row.fluide_gwp) || 0,
    },
    weight: Number(row.weight_kg) || 0,
    packagingNumero: (row.packaging_numero as string) ?? "",
    clientName: (row.client_name as string) ?? null,
    modeleEquipement: (row.modele_equipement as string) ?? undefined,
    numeroSerieEquipement: (row.numero_serie_equipement as string) ?? undefined,
    lieuIntervention: (row.lieu_intervention as string) ?? undefined,
    bsffId: (row.bsff_id as string) ?? undefined,
    controleDetails: (row.controle_details as StoredIntervention["controleDetails"]) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    hasDetenteurSignature: Boolean(row.has_detenteur_signature),
    detenteurName: (row.detenteur_name as string) ?? undefined,
    detenteurQuality: (row.detenteur_quality as StoredIntervention["detenteurQuality"]) ?? undefined,
  };
}

/** Fetch tous les equipements de l'user connecte depuis Supabase.
 *  Retourne [] si pas connecte (auth check serveur, response 200 + data vide).
 *  Retourne null si erreur reseau / 500. */
export async function fetchMyEquipements(): Promise<StoredEquipement[] | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/public/my-equipements", {
      method: "GET",
      headers: { "cache-control": "no-store" },
    });
    if (!res.ok) {
      console.warn("[public-sync] fetchMyEquipements HTTP", res.status);
      return null;
    }
    const json = (await res.json()) as { data: Record<string, unknown>[] };
    if (!Array.isArray(json.data)) return [];
    return json.data.map(mapEquipementRow);
  } catch (e) {
    console.warn("[public-sync] fetchMyEquipements failed:", e);
    return null;
  }
}

/** Fetch toutes les interventions liees aux equipements de l'user connecte.
 *  Inclut les interventions des confreres via lien magique. */
export async function fetchMyInterventions(): Promise<StoredIntervention[] | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/public/my-interventions", {
      method: "GET",
      headers: { "cache-control": "no-store" },
    });
    if (!res.ok) {
      console.warn("[public-sync] fetchMyInterventions HTTP", res.status);
      return null;
    }
    const json = (await res.json()) as { data: Record<string, unknown>[] };
    if (!Array.isArray(json.data)) return [];
    return json.data.map(mapInterventionRow);
  } catch (e) {
    console.warn("[public-sync] fetchMyInterventions failed:", e);
    return null;
  }
}

export type PublicIntervention = StoredIntervention;

export async function fetchPublicInterventions(equipementId: string): Promise<PublicIntervention[]> {
  if (typeof window === "undefined") return [];
  try {
    const res = await fetch(
      `/api/public/interventions?equipementId=${encodeURIComponent(equipementId)}`,
      { method: "GET", headers: { "cache-control": "no-store" } }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { data: Record<string, unknown>[] };
    if (!json.data) return [];
    return json.data.map((row) => ({
      id: row.id as string,
      createdAt: row.date_iso as string,
      typeIntervention: row.type_intervention as PublicIntervention["typeIntervention"],
      fluide: {
        code: row.fluide_code as string,
        label: (row.fluide_label as string) ?? (row.fluide_code as string),
        gwp: (row.fluide_gwp as number) ?? 0,
      },
      weight: Number(row.weight_kg) || 0,
      packagingNumero: (row.packaging_numero as string) ?? "",
      clientName: (row.client_name as string) ?? null,
      modeleEquipement: (row.modele_equipement as string) ?? undefined,
      numeroSerieEquipement: (row.numero_serie_equipement as string) ?? undefined,
      lieuIntervention: (row.lieu_intervention as string) ?? undefined,
      bsffId: (row.bsff_id as string) ?? undefined,
      controleDetails: (row.controle_details as PublicIntervention["controleDetails"]) ?? undefined,
      notes: (row.notes as string) ?? undefined,
      hasDetenteurSignature: Boolean(row.has_detenteur_signature),
      detenteurName: (row.detenteur_name as string) ?? undefined,
      detenteurQuality: (row.detenteur_quality as PublicIntervention["detenteurQuality"]) ?? undefined,
    }));
  } catch (e) {
    console.warn("[public-sync] fetchPublicInterventions failed:", e);
    return [];
  }
}
