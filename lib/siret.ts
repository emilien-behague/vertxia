// Lookup SIRET → raison sociale + adresse via l'API publique data.gouv.fr
// (recherche-entreprises.api.gouv.fr). Pas d'auth, gratuit, source = INSEE/SIRENE.
//
// Utilisé pour auto-remplir le centre de destination du BSFF dans /m/profil
// : le user tape un SIRET (14 chiffres), Vertxia récupère le nom + adresse
// officiels et pré-remplit les 3 champs.

const SEARCH_URL = "https://recherche-entreprises.api.gouv.fr/search";

export type SiretLookupResult = {
  siret: string;
  /** Raison sociale officielle (ex: "DEHON SERVICE") */
  raisonSociale: string;
  /** Adresse complète sur une ligne (rue + numéro) — sans CP/ville */
  adresseRue: string;
  /** Code postal 5 chiffres */
  codePostal: string;
  /** Nom de la commune en majuscules (ex: "PARIS", "TARBES") */
  commune: string;
  /** Adresse complète prête pour BSFF : "{adresseRue}, {codePostal} {commune}" */
  adresseComplete: string;
};

type ApiEtablissement = {
  siret: string;
  adresse?: string;
  code_postal?: string;
  libelle_commune?: string;
};

type ApiResult = {
  nom_complet?: string;
  nom_raison_sociale?: string;
  siege?: ApiEtablissement;
  matching_etablissements?: ApiEtablissement[];
};

type ApiResponse = {
  results?: ApiResult[];
  total_results?: number;
};

/** Normalise un SIRET : retire espaces et tirets, garde 14 chiffres. */
export function normalizeSiret(input: string): string {
  return input.replace(/\D+/g, "").slice(0, 14);
}

/** Vérifie qu'un SIRET a bien 14 chiffres (sans valider la clé Luhn). */
export function isValidSiretFormat(siret: string): boolean {
  return /^\d{14}$/.test(siret);
}

/**
 * Recherche un établissement par SIRET (14 chiffres) sur l'API publique
 * data.gouv.fr. Renvoie null si introuvable, ou un objet structuré sinon.
 *
 * Throw une Error si la requête réseau échoue (à différencier d'un SIRET
 * inexistant qui renvoie just `null`).
 */
export async function lookupSiret(siret: string): Promise<SiretLookupResult | null> {
  const normalized = normalizeSiret(siret);
  if (!isValidSiretFormat(normalized)) {
    throw new Error("SIRET invalide : 14 chiffres attendus.");
  }

  const url = `${SEARCH_URL}?q=${normalized}&page=1&per_page=1`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API recherche-entreprises HTTP ${res.status}`);
  }
  const data = (await res.json()) as ApiResponse;
  const first = data.results?.[0];
  if (!first) return null;

  // Chercher l'établissement EXACT (match SIRET) dans matching_etablissements,
  // fallback sur le siège si présent et même SIRET, sinon premier matching.
  const candidates: ApiEtablissement[] = [
    ...(first.matching_etablissements || []),
    ...(first.siege ? [first.siege] : []),
  ];
  const etab =
    candidates.find((e) => e.siret === normalized) ||
    candidates[0] ||
    null;
  if (!etab) return null;

  const raisonSociale = (first.nom_complet || first.nom_raison_sociale || "").trim();
  const adresseRue = (etab.adresse || "").trim();
  const codePostal = (etab.code_postal || "").trim();
  const commune = (etab.libelle_commune || "").trim();
  const adresseComplete = [
    adresseRue,
    [codePostal, commune].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return {
    siret: etab.siret || normalized,
    raisonSociale,
    adresseRue,
    codePostal,
    commune,
    adresseComplete,
  };
}
