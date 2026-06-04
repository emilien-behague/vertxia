// Profil entreprise du technicien / opérateur F-Gas.
// Stocké localement (localStorage) tant qu'OAuth2 TrackDéchets n'est pas branché.
// Quand OAuth2 sera prêt, SIRET/raisonSociale/adresse seront pré-remplis
// automatiquement depuis l'API TrackDéchets — le user n'aura plus qu'à compléter
// la partie F-Gas (attestation, catégorie, organisme) et la partie visuelle (logo, signature).

import { scopedKey } from "./user-scope";

const STORAGE_KEY_BASE = "vertxia:profil";
function storageKey(): string {
  return scopedKey(STORAGE_KEY_BASE);
}

export type CategorieAttestation = "I" | "II" | "III" | "IV" | "V";

export const ORGANISMES_AGREES = [
  "Dekra",
  "AFCE (Association Française du Froid)",
  "CEMAFROID",
  "Bureau Veritas",
  "Climalife",
  "QualitFroid",
  "Autre",
] as const;

export type OrganismeAgree = (typeof ORGANISMES_AGREES)[number];

export type Profil = {
  // Identité légale (sera pré-rempli par OAuth2 TrackDéchets plus tard)
  raisonSociale: string;
  siret: string;
  adresseRue: string;
  adresseCp: string;
  adresseVille: string;
  telephone: string;
  email: string;
  siteWeb?: string;

  // F-Gas spécifique (non couvert par OAuth2 TrackDéchets)
  numeroAttestation: string;
  categorieAttestation: CategorieAttestation | "";
  organismeAgree: OrganismeAgree | "";
  /** ISO date de la date d'expiration de l'attestation */
  dateExpirationAttestation: string;

  // Transport de déchets dangereux (pour BSFF — facultatif si pas transporteur)
  numeroRecepisseTransport?: string;
  /** Immatriculation du véhicule utilisé pour transporter les bouteilles
   *  vers le centre de traitement. Pré-rempli dans la section [7] du BSFF. */
  immatriculationVehicule?: string;

  // BSFF OFFICIEL TrackDéchets — quand renseigné, le BSFF est signé
  // au nom du technicien (son SIRET, son token) sur le serveur prod
  // au lieu du sandbox Vertxia TEST. Le bordereau a alors une vraie
  // valeur légale opposable au Ministère.
  // Token = obtenu depuis trackdechets.beta.gouv.fr → Mon compte → API.
  /** Token API personnel TrackDéchets (Bearer). Sensible. */
  trackdechetsToken?: string;
  /** "sandbox" (démo Vertxia) ou "production" (officiel Ministère). Default: sandbox. */
  trackdechetsMode?: "sandbox" | "production";
  /** SIRET du centre agréé qui réceptionne les bouteilles HFC pour régénération.
   *  Ex: Climalife (37989147300018), Schneider Electric (51820126800023), etc.
   *  Source de vérité : https://trackdechets.beta.gouv.fr/company-search */
  bsffDestinationSiret?: string;
  /** Nom commercial du centre destination (affiché dans le BSFF) */
  bsffDestinationName?: string;
  /** Adresse du centre destination */
  bsffDestinationAddress?: string;

  // Visuel (data URLs base64)
  /** Logo PNG/JPEG en data URL — affiché sur tous les livrables PDF */
  logoDataUrl?: string;
  /** Signature scannée du gérant en data URL — pour signer automatiquement les rapports */
  signatureDataUrl?: string;

  // Métadonnées
  updatedAt: string;
};

export const EMPTY_PROFIL: Profil = {
  raisonSociale: "",
  siret: "",
  adresseRue: "",
  adresseCp: "",
  adresseVille: "",
  telephone: "",
  email: "",
  siteWeb: "",
  numeroAttestation: "",
  categorieAttestation: "",
  organismeAgree: "",
  dateExpirationAttestation: "",
  numeroRecepisseTransport: "",
  immatriculationVehicule: "",
  trackdechetsToken: "",
  trackdechetsMode: "sandbox",
  bsffDestinationSiret: "",
  bsffDestinationName: "",
  bsffDestinationAddress: "",
  logoDataUrl: undefined,
  signatureDataUrl: undefined,
  updatedAt: new Date(0).toISOString(),
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadProfil(): Profil {
  if (!isBrowser()) return EMPTY_PROFIL;
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return EMPTY_PROFIL;
    const parsed = JSON.parse(raw) as Partial<Profil>;
    return { ...EMPTY_PROFIL, ...parsed };
  } catch {
    return EMPTY_PROFIL;
  }
}

export function saveProfil(profil: Profil): Profil {
  if (!isBrowser()) throw new Error("localStorage indisponible");
  const next: Profil = { ...profil, updatedAt: new Date().toISOString() };
  localStorage.setItem(storageKey(), JSON.stringify(next));
  // Sync background vers Supabase pour que le bloc "Technicien referent"
  // de la fiche publique /eq/[id] affiche le nom de la societe, le tel,
  // l'email et le n° d'attestation. Silent fail si pas connecte.
  void syncProfilToSupabase(next);
  return next;
}

async function syncProfilToSupabase(profil: Profil): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/api/public/profil/upsert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        raisonSociale: profil.raisonSociale,
        siret: profil.siret,
        adresseRue: profil.adresseRue,
        adresseCp: profil.adresseCp,
        adresseVille: profil.adresseVille,
        telephone: profil.telephone,
        email: profil.email,
        siteWeb: profil.siteWeb,
        numeroAttestation: profil.numeroAttestation,
        categorieAttestation: profil.categorieAttestation || undefined,
        organismeAgree: profil.organismeAgree || undefined,
        dateExpirationAttestation: profil.dateExpirationAttestation,
      }),
    });
    if (!res.ok && res.status !== 401) {
      const j = await res.json().catch(() => ({}));
      console.warn("[profil-sync] failed:", j);
    }
  } catch (e) {
    console.warn("[profil-sync] network failed:", e);
  }
}

export function clearProfil(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(storageKey());
}

/**
 * Renvoie true si les champs critiques (raison sociale, SIRET, adresse, attestation)
 * sont remplis. Utilisé pour afficher un badge "profil incomplet" dans le dashboard.
 */
export function isProfilComplete(profil: Profil): boolean {
  return Boolean(
    profil.raisonSociale &&
      profil.siret &&
      profil.adresseRue &&
      profil.adresseCp &&
      profil.adresseVille &&
      profil.numeroAttestation &&
      profil.categorieAttestation
  );
}

/**
 * Renvoie true si la config TrackDéchets officielle est complète. Permet de
 * basculer le BSFF en mode officiel (signé Ministère) au lieu du mode démo
 * sandbox Vertxia. Requiert : token + mode=production + SIRET destination.
 */
export function isTrackDechetsLiveReady(profil: Profil): boolean {
  return Boolean(
    profil.trackdechetsToken &&
      profil.trackdechetsToken.trim().length > 10 &&
      profil.trackdechetsMode === "production" &&
      profil.bsffDestinationSiret &&
      profil.bsffDestinationName
  );
}

/** Pour formater l'adresse en une ligne (livrables PDF). */
export function formatAdresseLigne(profil: Profil): string {
  const parts = [profil.adresseRue, profil.adresseCp, profil.adresseVille].filter(Boolean);
  return parts.join(", ");
}
