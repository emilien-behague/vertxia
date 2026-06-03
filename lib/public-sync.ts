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

export async function syncEquipementToSupabase(eq: StoredEquipement): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/api/public/equipement/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(eq),
    });
    if (!res.ok) {
      // 401 = pas connecté → skip silencieux normal
      if (res.status !== 401) {
        const j = await res.json().catch(() => ({}));
        console.warn("[public-sync] equipement upsert failed:", j);
      }
    }
  } catch (e) {
    console.warn("[public-sync] equipement sync failed:", e);
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
  isReadOnly: boolean; // true si le visiteur ≠ owner (vue partagée)
  /** Mode "full" = owner authentifié, toutes données. Mode "public" = vue épurée. */
  mode: "full" | "public";
  /** Présent UNIQUEMENT en mode "public" : coordonnées du frigoriste référent. */
  ownerPublic?: {
    raisonSociale: string | null;
    telephone: string | null;
    email: string | null;
    numeroAttestation: string | null;
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
      mode?: "full" | "public";
      isReadOnly: boolean;
      ownerPublic?: PublicEquipement["ownerPublic"];
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
    // En mode "public", clientName n'existe pas — on met un placeholder neutre.
    const isPublic = mode === "public";
    return {
      id: data.id as string,
      createdAt: data.created_at as string,
      clientName: isPublic ? "" : ((data.client_name as string) ?? ""),
      clientEmail: isPublic ? undefined : ((data.client_email as string) ?? undefined),
      clientTelephone: isPublic ? undefined : ((data.client_telephone as string) ?? undefined),
      siteAdresse: isPublic ? undefined : ((data.site_adresse as string) ?? undefined),
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
      unitesInterieures: isPublic ? undefined : ((data.unites_interieures as UniteInterieure[]) ?? undefined),
      notes: isPublic ? undefined : ((data.notes as string) ?? undefined),
      ownerUserId: data.user_id as string,
      isReadOnly: json.isReadOnly,
      mode,
      ownerPublic: json.ownerPublic ?? null,
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
