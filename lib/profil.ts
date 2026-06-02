// Profil entreprise du frigoriste / opérateur F-Gas.
// Stocké localement (localStorage) tant qu'OAuth2 TrackDéchets n'est pas branché.
// Quand OAuth2 sera prêt, SIRET/raisonSociale/adresse seront pré-remplis
// automatiquement depuis l'API TrackDéchets — le user n'aura plus qu'à compléter
// la partie F-Gas (attestation, catégorie, organisme) et la partie visuelle (logo, signature).

const STORAGE_KEY = "vertxia:profil";

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
    const raw = localStorage.getItem(STORAGE_KEY);
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearProfil(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
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

/** Pour formater l'adresse en une ligne (livrables PDF). */
export function formatAdresseLigne(profil: Profil): string {
  const parts = [profil.adresseRue, profil.adresseCp, profil.adresseVille].filter(Boolean);
  return parts.join(", ");
}
