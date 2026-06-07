// Profil entreprise du technicien / opérateur F-Gas.
// Stocké localement (localStorage) tant qu'OAuth2 TrackDéchets n'est pas branché.
// Quand OAuth2 sera prêt, SIRET/raisonSociale/adresse seront pré-remplis
// automatiquement depuis l'API TrackDéchets — le user n'aura plus qu'à compléter
// la partie F-Gas (attestation, catégorie, organisme) et la partie visuelle (logo, signature).

import { scopedKey } from "@/lib/auth/user-scope";

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

// ─── Tarification ────────────────────────────────────────────────────────
// Configuration complete des tarifs du pro pour generer ses devis.
// Validation terrain (climaticien, 06/06/2026) : chaque pro a SES prix,
// son perimetre, son materiel. Vertxia ne FIXE pas de prix, il MULTIPLIE
// ce que le pro a configure ici.

export type TarificationDeplacement =
  | { mode: "forfait"; forfaitHT: number }
  | {
      mode: "km";
      prixKmHT: number;
      /** Rayon (km) inclus dans le tarif intervention. Au-dela, on
       *  facture le delta en €/km. */
      perimetreOffertKm?: number;
      /** Si client hors departement perimetre : majoration % sur total HT.
       *  Ex : 30 = +30%. Laisser undefined pour ne pas majorer. */
      majorationHorsPerimetrePct?: number;
    };

export type MaterielAcces = {
  /** Echelle classique inclus dans la main d'oeuvre (pas de ligne separee
   *  devis). Default true — la plupart des pros n'ont pas de facturation
   *  separee pour ca. */
  echelleInclusMO: boolean;
  /** Nacelle articulee 3-7m (typique exterieur niveau 1, comble bas) */
  nacelle3a7m: { active: boolean; prixJourHT: number };
  /** Nacelle telescopique > 7m (toiture, gros equipement haut) */
  nacelle7mPlus: { active: boolean; prixJourHT: number };
  /** Sous-traitance externe nacelle (location + chauffeur) */
  sousTraitanceNacelle: { active: boolean; prixJourHT: number };
};

export type TarificationProfil = {
  /** Taux horaire HT en €/h. Default 65. */
  tauxHoraireHT: number;
  /** Taux journalier HT en €/jour si le pro facture en journees au lieu
   *  d'heures. Default undefined (facturation heures). */
  tauxJournalierHT?: number;

  /** Mode deplacement : forfait fixe ou au kilometre. */
  deplacement: TarificationDeplacement;

  /** Codes departements (ex: ["31", "82", "65"]) ou le pro intervient
   *  sans majoration. Si vide ou undefined : pas de notion de perimetre. */
  departementsPerimetre?: string[];

  /** Materiel d'acces (echelle / nacelle / sous-traitance). */
  acces: MaterielAcces;

  /** Multiplicateur applique au prix d'achat des pieces pour la marge.
   *  Default 1.3 = +30% marge brute. */
  margePiecesMultiplicateur: number;

  /** TVA par defaut (10% renovation, 20% neuf / hors residentiel). */
  tvaParDefautPct: 10 | 20;
};

export const EMPTY_TARIFICATION: TarificationProfil = {
  tauxHoraireHT: 65,
  tauxJournalierHT: undefined,
  deplacement: { mode: "forfait", forfaitHT: 60 },
  departementsPerimetre: [],
  acces: {
    echelleInclusMO: true,
    nacelle3a7m: { active: false, prixJourHT: 150 },
    nacelle7mPlus: { active: false, prixJourHT: 280 },
    sousTraitanceNacelle: { active: false, prixJourHT: 500 },
  },
  margePiecesMultiplicateur: 1.3,
  tvaParDefautPct: 20,
};

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

  // Tarification (configurable pour la generation de devis client)
  /** @deprecated Migre vers tarification.tauxHoraireHT. Lecture conservee
   *  pour compat (anciens profils stockes en localStorage). A retirer dans
   *  une version future quand tous les profils auront ete migres. */
  tauxHoraireDevisHT?: number;
  /** Configuration complete tarification : main d'oeuvre, deplacement,
   *  perimetre, materiel d'acces, marge pieces, TVA. Voir TarificationProfil.
   *  Configurable dans /m/profil/tarification. */
  tarification?: TarificationProfil;

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
  tauxHoraireDevisHT: 65,
  tarification: undefined,
  updatedAt: new Date(0).toISOString(),
};

/** Resout la tarification effective : prefere profil.tarification si presente,
 *  sinon construit un fallback minimal a partir du legacy tauxHoraireDevisHT
 *  + les defauts EMPTY_TARIFICATION. Ainsi devis.ts peut TOUJOURS appeler
 *  resolveTarification(profil) sans gerer le cas "pas encore configure". */
export function resolveTarification(profil: Profil): TarificationProfil {
  if (profil.tarification) return profil.tarification;
  // Migration souple : si l'ancien tauxHoraireDevisHT est present, on l'injecte
  // dans la base EMPTY_TARIFICATION. Le pro pourra completer le reste en
  // ouvrant /m/profil/tarification.
  return {
    ...EMPTY_TARIFICATION,
    tauxHoraireHT: profil.tauxHoraireDevisHT && profil.tauxHoraireDevisHT > 0
      ? profil.tauxHoraireDevisHT
      : EMPTY_TARIFICATION.tauxHoraireHT,
  };
}

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
