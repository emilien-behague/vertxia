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

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { StoredEquipement, UniteInterieure } from "@/lib/equipement";
import type { StoredIntervention } from "@/lib/intervention-storage";

// ── ECRITURES (sync local → Supabase) ───────────────────────────────────────

export async function syncEquipementToSupabase(eq: StoredEquipement): Promise<void> {
  if (typeof window === "undefined") return;
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // pas connecté → skip silencieux

    await supabase.from("equipements").upsert(
      {
        id: eq.id,
        user_id: user.id,
        client_name: eq.clientName,
        client_email: eq.clientEmail ?? null,
        client_telephone: eq.clientTelephone ?? null,
        site_adresse: eq.siteAdresse ?? null,
        modele: eq.modele,
        numero_serie: eq.numeroSerie,
        fluide_code: eq.fluide.code,
        fluide_label: eq.fluide.label,
        fluide_gwp: eq.fluide.gwp,
        charge_kg: eq.chargeKg,
        detecteur_fixe: eq.detecteurFixe,
        dernier_controle_iso: eq.dernierControleISO ?? null,
        unites_interieures: eq.unitesInterieures ?? [],
        notes: eq.notes ?? null,
      },
      { onConflict: "id" }
    );
  } catch (e) {
    console.warn("[public-sync] equipement sync failed:", e);
  }
}

export async function syncInterventionToSupabase(int: StoredIntervention, equipementId?: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("interventions").upsert(
      {
        id: int.id,
        user_id: user.id,
        equipement_id: equipementId ?? null,
        date_iso: int.createdAt,
        type_intervention: int.typeIntervention,
        fluide_code: int.fluide.code,
        fluide_label: int.fluide.label,
        fluide_gwp: int.fluide.gwp,
        weight_kg: int.weight,
        packaging_numero: int.packagingNumero,
        client_name: int.clientName ?? null,
        modele_equipement: int.modeleEquipement ?? null,
        numero_serie_equipement: int.numeroSerieEquipement ?? null,
        lieu_intervention: int.lieuIntervention ?? null,
        bsff_id: int.bsffId ?? null,
        controle_details: int.controleDetails ?? null,
        notes: int.notes ?? null,
        has_detenteur_signature: int.hasDetenteurSignature ?? false,
        detenteur_name: int.detenteurName ?? null,
        detenteur_quality: int.detenteurQuality ?? null,
      },
      { onConflict: "id" }
    );
  } catch (e) {
    console.warn("[public-sync] intervention sync failed:", e);
  }
}

// ── LECTURES PUBLIQUES (Supabase → app) ─────────────────────────────────────

export type PublicEquipement = StoredEquipement & {
  ownerUserId: string;
  isReadOnly: boolean; // true si le visiteur ≠ owner (vue partagée)
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
  if (!isSupabaseConfigured()) {
    lastFetchDebug = {
      supabaseConfigured: false,
      fetched: false,
      errorMessage: "Supabase env vars absentes",
      searchedId: id,
    };
    return null;
  }
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("equipements")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      lastFetchDebug = {
        supabaseConfigured: true,
        fetched: true,
        errorMessage: error.message,
        errorCode: error.code,
        searchedId: id,
      };
      return null;
    }
    if (!data) {
      lastFetchDebug = {
        supabaseConfigured: true,
        fetched: true,
        rowCount: 0,
        searchedId: id,
      };
      return null;
    }

    // Check si le visiteur est le owner
    const { data: { user } } = await supabase.auth.getUser();
    const isReadOnly = !user || user.id !== data.user_id;

    lastFetchDebug = {
      supabaseConfigured: true,
      fetched: true,
      rowCount: 1,
      searchedId: id,
    };
    return {
      id: data.id,
      createdAt: data.created_at,
      clientName: data.client_name,
      clientEmail: data.client_email ?? undefined,
      clientTelephone: data.client_telephone ?? undefined,
      siteAdresse: data.site_adresse ?? undefined,
      modele: data.modele,
      numeroSerie: data.numero_serie,
      fluide: {
        code: data.fluide_code,
        label: data.fluide_label ?? data.fluide_code,
        gwp: data.fluide_gwp ?? 0,
      },
      chargeKg: Number(data.charge_kg) || 0,
      detecteurFixe: Boolean(data.detecteur_fixe),
      dernierControleISO: data.dernier_controle_iso ?? undefined,
      unitesInterieures: (data.unites_interieures as UniteInterieure[]) ?? undefined,
      notes: data.notes ?? undefined,
      ownerUserId: data.user_id,
      isReadOnly,
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
 *  Pour debug : si 0 → le sync n'a jamais marché. Si > 0 → bug fetch ID. */
export async function countPublicEquipements(): Promise<number | null> {
  if (typeof window === "undefined") return null;
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createClient();
    const { count, error } = await supabase
      .from("equipements")
      .select("*", { count: "exact", head: true });
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

export type PublicIntervention = StoredIntervention;

export async function fetchPublicInterventions(equipementId: string): Promise<PublicIntervention[]> {
  if (typeof window === "undefined") return [];
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("interventions")
      .select("*")
      .eq("equipement_id", equipementId)
      .order("date_iso", { ascending: false });
    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      createdAt: row.date_iso,
      typeIntervention: row.type_intervention,
      fluide: {
        code: row.fluide_code,
        label: row.fluide_label ?? row.fluide_code,
        gwp: row.fluide_gwp ?? 0,
      },
      weight: Number(row.weight_kg) || 0,
      packagingNumero: row.packaging_numero ?? "",
      clientName: row.client_name ?? null,
      modeleEquipement: row.modele_equipement ?? undefined,
      numeroSerieEquipement: row.numero_serie_equipement ?? undefined,
      lieuIntervention: row.lieu_intervention ?? undefined,
      bsffId: row.bsff_id ?? undefined,
      controleDetails: row.controle_details ?? undefined,
      notes: row.notes ?? undefined,
      hasDetenteurSignature: Boolean(row.has_detenteur_signature),
      detenteurName: row.detenteur_name ?? undefined,
      detenteurQuality: row.detenteur_quality ?? undefined,
    }));
  } catch (e) {
    console.warn("[public-sync] fetchPublicInterventions failed:", e);
    return [];
  }
}
