// Bouteilles fluides frigorigènes — stock et traçabilité interne technicien.
//
// 2 types distincts (terrain pro Emilien, 02/06/2026) :
//  - RECHARGE : ton stock de fluide neuf pour charger les équipements clients
//  - RÉCUPÉRATION : vide ou en cours de remplissage, pour récupérer du fluide
//                   depuis les équipements clients avant intervention
//
// Règles métier critiques :
//  - 1 bouteille = 1 fluide (sauf si fluideMix = mélangé/déchet)
//  - Remplissage max 80% (sécurité pression) → alerte rouge dès 78%
//  - Méthode balance : pesée avant/après → delta = quantité manipulée
//  - Compatibilité fluide inflammable (R32, R290, R454B) requise pour matériel
//  - Attestation de capacité F-Gas exigée pour manipuler (vérifié au profil)
//
// Pas de format légal imposé (article R543-82 + arrêté 29/02/2016) — on s'inspire
// du standard métier AFCE pour la structure du registre PDF généré.

export type BouteilleType = "recharge" | "recuperation";

export type Bouteille = {
  id: string;
  createdAt: string;
  type: BouteilleType;
  /** Code fluide standardisé (R-32, R-410A, etc.). Null si bouteille mélangée/déchet. */
  fluide: { code: string; label: string; gwp: number } | null;
  /** Accepte plusieurs fluides (bouteille déchet destinée à traitement) */
  fluideMix: boolean;
  /** N° d'identification ESP transportable (gravé sur la bouteille) */
  numeroSerie: string;
  /** Code-barres scannable (sticker fournisseur, ex Linde 14 chiffres GTIN-14).
   *  Indépendant du numeroSerie qui est gravé. Optionnel, rempli au scan. */
  codeBarre?: string;
  /** Poids à vide en kg (tare gravée sur la bouteille) */
  tareKg: number;
  /** Capacité nominale en kg (charge max possible, ex: 10kg) */
  capaciteMaxKg: number;
  /** Charge initiale au moment de l'enregistrement (kg de fluide déjà dedans).
   *  Pour une bouteille neuve recharge → souvent égal à capaciteMaxKg.
   *  Pour une bouteille de récupération vide → 0. */
  chargeInitialeKg: number;
  /** Fournisseur (Climalife, Westfalen, Air Liquide, etc.) — pour recharge */
  fournisseur?: string;
  /** Date d'achat ISO (optionnel) */
  dateAchatISO?: string;
  /** Compatible fluide inflammable (R-32, R-290, R-454B, R-1234yf…)
   *  Dérivable du fluide mais stocké pour bouteilles mix. */
  compatibleInflammable: boolean;
  /** "active" = utilisable / "transit_retour" = envoyée fournisseur ou centre traitement
   *  / "archivee" = hors usage. */
  statut: "active" | "transit_retour" | "archivee";
  notes?: string;
};

export type MouvementType =
  | "remplissage_initial" // achat / réception fournisseur
  | "sortie" // sortie fluide pour chargement équipement client (recharge → équipement)
  | "entree" // entrée fluide depuis équipement client (récupération → bouteille)
  | "cession_traitement" // envoi à centre de traitement (BSFF)
  | "retour_fournisseur" // retour bouteille pleine fournisseur (consigne)
  | "calibrage"; // correction manuelle du poids (anomalie balance)

export type Mouvement = {
  id: string;
  createdAt: string;
  /** ISO date de l'événement (pas forcément l'horodatage de saisie) */
  dateMouvementISO: string;
  bouteilleId: string;
  type: MouvementType;
  /** Quantité manipulée en kg (toujours positive — le signe est dérivé du type) */
  quantiteKg: number;
  /** Si méthode balance : poids brut bouteille AVANT le mouvement */
  poidsAvantKg?: number;
  /** Si méthode balance : poids brut bouteille APRÈS le mouvement */
  poidsApresKg?: number;
  /** "balance" = pesée avant/après / "declarative" = saisi à la main */
  methode: "balance" | "declarative";
  /** Lien optionnel vers une intervention (créé auto depuis form intervention) */
  interventionId?: string;
  /** Lien optionnel vers un équipement client */
  equipementId?: string;
  /** Lien BSFF si type = cession_traitement */
  bsffId?: string;
  /** Nom du client final (pour le registre PDF) */
  clientName?: string;
  /** Identité de l'opérateur (depuis le profil) */
  operateurName?: string;
  notes?: string;
};

// ─── Helpers métier ───────────────────────────────────────────────────────────

/** Indique si le mouvement AJOUTE du fluide à la bouteille (entrée nette). */
export function estEntree(type: MouvementType): boolean {
  return type === "remplissage_initial" || type === "entree";
}

/** Indique si le mouvement RETIRE du fluide de la bouteille (sortie nette). */
export function estSortie(type: MouvementType): boolean {
  return type === "sortie" || type === "cession_traitement" || type === "retour_fournisseur";
}

/** Calcule la charge actuelle de la bouteille à partir des mouvements.
 *  Part de chargeInitialeKg puis applique chaque mouvement chronologiquement. */
export function computeChargeActuelle(
  bouteille: Bouteille,
  mouvements: Mouvement[]
): number {
  let charge = bouteille.chargeInitialeKg;
  const tries = [...mouvements].sort(
    (a, b) => new Date(a.dateMouvementISO).getTime() - new Date(b.dateMouvementISO).getTime()
  );
  for (const m of tries) {
    if (estEntree(m.type)) charge += m.quantiteKg;
    else if (estSortie(m.type)) charge -= m.quantiteKg;
    else if (m.type === "calibrage") {
      // Calibrage : la quantité EST la nouvelle valeur absolue (correction)
      charge = m.quantiteKg;
    }
  }
  return Math.max(0, charge);
}

/** Pourcentage de remplissage rapporté à la capacité max. */
export function computePctRemplissage(bouteille: Bouteille, chargeActuelle: number): number {
  if (bouteille.capaciteMaxKg <= 0) return 0;
  return (chargeActuelle / bouteille.capaciteMaxKg) * 100;
}

/** Niveau d'alerte selon le % de remplissage (seuil sécurité 80%). */
export type NiveauAlerte = "vert" | "orange" | "rouge" | "vide";

export function computeNiveauAlerte(pct: number): NiveauAlerte {
  if (pct <= 0) return "vide";
  if (pct >= 80) return "rouge"; // dépassement seuil sécurité
  if (pct >= 70) return "orange"; // proche du seuil
  return "vert";
}

/** Label utilisateur du niveau d'alerte. */
export function labelAlerte(niveau: NiveauAlerte): string {
  switch (niveau) {
    case "vide": return "Vide";
    case "vert": return "OK";
    case "orange": return "À surveiller";
    case "rouge": return "⚠ Seuil 80% — ne pas remplir";
  }
}

/** Code couleur Tailwind du niveau d'alerte (pour gauges et badges). */
export function colorAlerte(niveau: NiveauAlerte): { bg: string; ring: string; text: string; barFill: string } {
  switch (niveau) {
    case "vide": return { bg: "bg-black/[0.04]", ring: "ring-black/10", text: "text-black/50", barFill: "bg-black/20" };
    case "vert": return { bg: "bg-emerald-50", ring: "ring-emerald-200", text: "text-emerald-800", barFill: "bg-emerald-500" };
    case "orange": return { bg: "bg-amber-50", ring: "ring-amber-200", text: "text-amber-800", barFill: "bg-amber-500" };
    case "rouge": return { bg: "bg-red-50", ring: "ring-red-200", text: "text-red-800", barFill: "bg-red-500" };
  }
}

/** Liste des fluides considérés inflammables (norme A2L, A3). */
const FLUIDES_INFLAMMABLES = new Set([
  "R-32",
  "R-290", // propane
  "R-454B",
  "R-454C",
  "R-1234yf",
  "R-1234ze",
  "R-600a", // isobutane
  "R-152a",
]);

/** Détermine si un code fluide est inflammable (A2L ou A3). */
export function fluideEstInflammable(code: string | null | undefined): boolean {
  if (!code) return false;
  return FLUIDES_INFLAMMABLES.has(code);
}

/** Filtre les bouteilles compatibles pour un usage donné (matching fluide + type + état). */
export function bouteillesCompatibles(
  bouteilles: Bouteille[],
  mouvementsParBouteille: Map<string, Mouvement[]>,
  options: {
    type: BouteilleType;
    fluideCode: string;
    /** Quantité kg qu'on veut ajouter (pour récupération) ou retirer (pour recharge) */
    quantiteKg?: number;
  }
): Array<{ bouteille: Bouteille; chargeActuelle: number; pct: number; niveau: NiveauAlerte; compatible: boolean; raison?: string }> {
  return bouteilles
    .filter((b) => b.statut === "active" && b.type === options.type)
    .map((b) => {
      const mvs = mouvementsParBouteille.get(b.id) ?? [];
      const chargeActuelle = computeChargeActuelle(b, mvs);
      const pct = computePctRemplissage(b, chargeActuelle);
      const niveau = computeNiveauAlerte(pct);

      // Compatibilité fluide
      if (!b.fluideMix && b.fluide?.code !== options.fluideCode) {
        return {
          bouteille: b,
          chargeActuelle,
          pct,
          niveau,
          compatible: false,
          raison: `Fluide incompatible (${b.fluide?.code ?? "n/c"} ≠ ${options.fluideCode})`,
        };
      }

      // Compatibilité inflammabilité
      if (fluideEstInflammable(options.fluideCode) && !b.compatibleInflammable) {
        return {
          bouteille: b,
          chargeActuelle,
          pct,
          niveau,
          compatible: false,
          raison: "Matériel non compatible fluide inflammable",
        };
      }

      // Capacité résiduelle pour récupération
      if (options.type === "recuperation" && typeof options.quantiteKg === "number") {
        const apres = chargeActuelle + options.quantiteKg;
        const pctApres = (apres / b.capaciteMaxKg) * 100;
        if (pctApres > 80) {
          return {
            bouteille: b,
            chargeActuelle,
            pct,
            niveau,
            compatible: false,
            raison: `Récup ${options.quantiteKg}kg → ${pctApres.toFixed(0)}% (>80% seuil sécurité)`,
          };
        }
      }

      // Stock suffisant pour recharge
      if (options.type === "recharge" && typeof options.quantiteKg === "number") {
        if (options.quantiteKg > chargeActuelle) {
          return {
            bouteille: b,
            chargeActuelle,
            pct,
            niveau,
            compatible: false,
            raison: `Stock insuffisant (${chargeActuelle.toFixed(3)}kg disponible)`,
          };
        }
      }

      return { bouteille: b, chargeActuelle, pct, niveau, compatible: true };
    })
    .sort((a, b) => {
      // Compatibles d'abord, puis par % remplissage adapté au type
      if (a.compatible !== b.compatible) return a.compatible ? -1 : 1;
      if (options.type === "recharge") return b.pct - a.pct; // recharge : plus pleine d'abord
      return a.pct - b.pct; // récupération : plus vide d'abord
    });
}

/** Calcule la quantité à partir d'une pesée balance avant/après.
 *  Pour une RÉCUPÉRATION : après > avant → delta positif.
 *  Pour une SORTIE : avant > après → delta positif aussi (toujours kg manipulés). */
export function quantiteDepuisPesee(poidsAvantKg: number, poidsApresKg: number): number {
  return Math.abs(poidsApresKg - poidsAvantKg);
}

/** Label utilisateur d'un type de mouvement. */
export function labelMouvement(type: MouvementType): string {
  switch (type) {
    case "remplissage_initial": return "Réception fournisseur";
    case "sortie": return "Sortie → équipement client";
    case "entree": return "Récupération ← équipement client";
    case "cession_traitement": return "Cession centre de traitement";
    case "retour_fournisseur": return "Retour fournisseur";
    case "calibrage": return "Calibrage (correction)";
  }
}

/** Label court (≤ 12 chars) pour badges UI compacts. */
export function labelMouvementCourt(type: MouvementType): string {
  switch (type) {
    case "remplissage_initial": return "Réception";
    case "sortie": return "Sortie";
    case "entree": return "Récup";
    case "cession_traitement": return "Cession";
    case "retour_fournisseur": return "Retour fourn.";
    case "calibrage": return "Calibrage";
  }
}
