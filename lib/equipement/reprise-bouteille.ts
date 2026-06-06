// Module Reprise bouteille : aide le frigoriste a deposer ses bouteilles
// de recuperation pleines chez le bon distributeur agree.
//
// Logique reglementaire (article R543-94 + R543-104 Code env.) :
// le frigoriste est OBLIGE de remettre les fluides usages a un repreneur
// agree. Il ne peut PAS les stocker indefiniment ni les rejeter (sinon =
// delit penal R543-87).
//
// 3 voies en France :
//  1. Distributeur fluides habituel (Climalife, Gazechim, Framacold,
//     Westfalen, Tron Roger PACA, etc.) - 90% des cas. Reprend la
//     bouteille consignee + emet le BSFF cote destinataire.
//  2. Centres de regeneration directs (Dehon Service, ATC France) -
//     pour gros volumes, regeneration >99% purete + credits quotas HFC.
//  3. Centres ICPE 2770 d'incineration (D10) - pour HCFC R-22 et fluides
//     contamines non regenerables.
//
// Strategie matching distributeur :
//  - Si bouteille.fournisseur connu (Climalife) -> ce distributeur en
//    premier (relation commerciale + bouteille consignee).
//  - Sinon -> top 3 distributeurs fluides du catalogue marketplace
//    classes par couverture geographique FR + delai livraison.
//  - Tous les distributeurs proposes doivent avoir le type "distributeur"
//    dans le catalogue + specialite incluant fluides.

import { FOURNISSEURS, type Fournisseur } from "@/lib/marketplace-pieces";
import type { Bouteille } from "@/lib/equipement/bouteille";

// ----------------------------------------------------------------------------
// CATALOGUE DISTRIBUTEURS FLUIDES — sous-ensemble du catalogue marketplace
// ----------------------------------------------------------------------------

// IDs des fournisseurs du catalogue marketplace qui sont REPRENEURS
// de bouteilles pleines (distributeurs fluides agrees).
const DISTRIBUTEURS_FLUIDES_IDS = [
  "climalife",
  "gazechim-froid",
  "framacold",
  "westfalen-france",
  "tron-roger",
];

export function getDistributeursFluides(): Fournisseur[] {
  return FOURNISSEURS.filter((f) => DISTRIBUTEURS_FLUIDES_IDS.includes(f.id));
}

// ----------------------------------------------------------------------------
// MATCHING DISTRIBUTEUR PRIORITAIRE
// ----------------------------------------------------------------------------

// Trouve les distributeurs pertinents pour reprendre cette bouteille.
// Trie : (1) distributeur d'origine s'il existe / (2) top distributeurs
// fluides du catalogue marketplace.
export function getDistributeursReprise(bouteille: Bouteille): Fournisseur[] {
  const tous = getDistributeursFluides();
  const fournisseurOrigine = bouteille.fournisseur?.toLowerCase().trim();

  if (!fournisseurOrigine) {
    return tous;
  }

  // Cherche un match nom de fournisseur d'origine (Climalife, Gazechim, etc.)
  // dans le catalogue distributeurs. Le matching est tolerant (includes).
  const match = tous.find((d) => {
    const nomDistrib = d.nom.toLowerCase();
    return (
      nomDistrib.includes(fournisseurOrigine) ||
      fournisseurOrigine.includes(d.id.split("-")[0])
    );
  });

  if (!match) return tous;

  // Le distributeur d'origine en premier, puis les autres.
  return [match, ...tous.filter((d) => d.id !== match.id)];
}

// ----------------------------------------------------------------------------
// ESTIMATION FRAIS REPRISE SELON FLUIDE
// ----------------------------------------------------------------------------

// Estimation marche FR 2026 (cf. regle #26 CLAUDE.md : estimations, pas
// prix verifies). Variables : type de fluide, statut regeneration possible
// (R5) vs destruction obligatoire (D10).

export type EstimationFraisReprise = {
  fraisHt: { min: number; max: number };
  uniteFrais: "par_kg" | "forfait";
  motif: string;
  consigneRecuperable: boolean;
  voieReprise: "regeneration_R5" | "destruction_D10" | "tri_avant_traitement";
};

export function estimerFraisReprise(
  fluideCode: string | null | undefined,
  bouteilleFluideMix: boolean
): EstimationFraisReprise {
  // Bouteille melangee / dechet -> tri obligatoire avant traitement, frais haut
  if (bouteilleFluideMix || !fluideCode) {
    return {
      fraisHt: { min: 8, max: 20 },
      uniteFrais: "par_kg",
      motif: "Bouteille mixte/déchet : tri analytique avant régénération ou destruction",
      consigneRecuperable: true,
      voieReprise: "tri_avant_traitement",
    };
  }

  const code = fluideCode.toUpperCase().replace(/\s+/g, "");

  // R-22 (HCFC interdit en regen depuis 2015) -> destruction D10 obligatoire
  if (code === "R-22" || code === "R22") {
    return {
      fraisHt: { min: 12, max: 18 },
      uniteFrais: "par_kg",
      motif: "R-22 : destruction définitive D10 obligatoire (incinérateur ICPE 2770 agréé)",
      consigneRecuperable: true,
      voieReprise: "destruction_D10",
    };
  }

  // R-404A (HFC phase-out, regeneration possible mais surcout)
  if (code === "R-404A" || code === "R404A") {
    return {
      fraisHt: { min: 3, max: 8 },
      uniteFrais: "par_kg",
      motif: "R-404A en phase-out F-Gas : régénération R5 possible, prix variable selon distributeur",
      consigneRecuperable: true,
      voieReprise: "regeneration_R5",
    };
  }

  // HFC modernes (R-410A, R-407C, R-134a) -> regeneration standard, souvent gratuit
  if (
    code === "R-410A" || code === "R410A" ||
    code === "R-407C" || code === "R407C" ||
    code === "R-134A" || code === "R134A" ||
    code === "R-448A" || code === "R448A" ||
    code === "R-449A" || code === "R449A" ||
    code === "R-452A" || code === "R452A"
  ) {
    return {
      fraisHt: { min: 0, max: 3 },
      uniteFrais: "par_kg",
      motif: "HFC standard : régénération R5 chez distributeur agréé, souvent gratuit dans relation commerciale",
      consigneRecuperable: true,
      voieReprise: "regeneration_R5",
    };
  }

  // HFO / nouveaux fluides (R-32, R-454B, R-1234yf) -> regeneration en developpement
  if (
    code === "R-32" || code === "R32" ||
    code === "R-454B" || code === "R454B" ||
    code === "R-454C" || code === "R454C" ||
    code === "R-1234YF" || code === "R1234YF" ||
    code === "R-1234ZE" || code === "R1234ZE" ||
    code === "R-455A" || code === "R455A" ||
    code === "R-513A" || code === "R513A"
  ) {
    return {
      fraisHt: { min: 0, max: 2 },
      uniteFrais: "par_kg",
      motif: "HFO bas-PRG : reprise prioritaire chez distributeur (filiere régénération en développement)",
      consigneRecuperable: true,
      voieReprise: "regeneration_R5",
    };
  }

  // Naturels (R-290, R-744 CO2, R-717 NH3) -> destruction directe en general
  if (
    code === "R-290" || code === "R290" ||
    code === "R-744" || code === "R744" ||
    code === "R-717" || code === "R717" ||
    code === "R-600A" || code === "R600A" ||
    code === "R-1270" || code === "R1270"
  ) {
    return {
      fraisHt: { min: 0, max: 5 },
      uniteFrais: "par_kg",
      motif: "Fluide naturel : destruction simple ou réutilisation, frais réduits",
      consigneRecuperable: true,
      voieReprise: "destruction_D10",
    };
  }

  // Fluide inconnu / non standard
  return {
    fraisHt: { min: 5, max: 15 },
    uniteFrais: "par_kg",
    motif: "Fluide non standard : tri analytique obligatoire avant traitement",
    consigneRecuperable: true,
    voieReprise: "tri_avant_traitement",
  };
}

// ----------------------------------------------------------------------------
// CALCUL FRAIS TOTAL REPRISE
// ----------------------------------------------------------------------------

export function calculerFraisReprise(
  estimation: EstimationFraisReprise,
  quantiteKg: number
): { totalMin: number; totalMax: number } {
  if (estimation.uniteFrais === "forfait") {
    return { totalMin: estimation.fraisHt.min, totalMax: estimation.fraisHt.max };
  }
  return {
    totalMin: Math.round(estimation.fraisHt.min * quantiteKg * 100) / 100,
    totalMax: Math.round(estimation.fraisHt.max * quantiteKg * 100) / 100,
  };
}

// ----------------------------------------------------------------------------
// GENERATION MAIL PRE-REMPLI VERS DISTRIBUTEUR
// ----------------------------------------------------------------------------

export type ContexteMailReprise = {
  distributeur: Fournisseur;
  bouteille: Bouteille;
  chargeActuelleKg: number;
  estimation: EstimationFraisReprise;
  emailFrigoriste?: string;
  nomFrigoriste?: string;
  emailVertxiaCcCommission?: string;
};

export function genererMailtoReprise(ctx: ContexteMailReprise): string {
  const { distributeur, bouteille, chargeActuelleKg, estimation } = ctx;

  // Calcul email destinataire (best-effort, regle #25 : on prefere
  // que le frigoriste verifie avant envoi, donc on met une note dans le body)
  const domain = distributeur.urlOfficielle
    ? distributeur.urlOfficielle
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "")
        .split("/")[0]
        .replace(/^www\./, "")
    : "contact";

  const to = `contact@${domain}`;
  const cc = ctx.emailVertxiaCcCommission || "emilien@vertxia.com";
  const subject = `Demande de reprise bouteille ${bouteille.fluide?.code || "déchet mix"} - ${bouteille.numeroSerie}`;

  const fluideLabel = bouteille.fluideMix
    ? "Mélange déchet (à trier)"
    : bouteille.fluide
      ? `${bouteille.fluide.code} (${bouteille.fluide.label})`
      : "Non identifié";

  const body = [
    `Bonjour,`,
    ``,
    `Via Vertxia, je sollicite la reprise d'une bouteille de récupération pleine pour traitement (régénération ou destruction selon votre filière agréée).`,
    ``,
    `Caractéristiques de la bouteille :`,
    `- N° de série : ${bouteille.numeroSerie}`,
    `- Fluide : ${fluideLabel}`,
    `- Quantité estimée : ${chargeActuelleKg.toFixed(3)} kg`,
    `- Tare : ${bouteille.tareKg} kg`,
    `- Capacité max : ${bouteille.capaciteMaxKg} kg`,
    bouteille.fournisseur ? `- Fournisseur d'origine : ${bouteille.fournisseur}` : null,
    ``,
    `Filière de traitement envisagée : ${labelVoieReprise(estimation.voieReprise)}`,
    ``,
    `Merci de me confirmer :`,
    `1) Vos modalités de récupération (dépôt sur site, enlèvement, point de collecte ?)`,
    `2) Vos frais éventuels de traitement (régénération R5 / destruction D10 selon le cas)`,
    `3) La consigne récupérable sur la bouteille vide`,
    `4) Le délai pour générer le BSFF côté destinataire sur TrackDéchets`,
    ``,
    `Je dispose de l'attestation de capacité F-Gas requise et le BSFF sera émis depuis Vertxia côté émetteur.`,
    ``,
    `Cordialement`,
    ctx.nomFrigoriste ? ctx.nomFrigoriste : "",
  ]
    .filter((l) => l !== null)
    .join("\n");

  return `mailto:${to}?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ----------------------------------------------------------------------------
// LABELS UTILISATEUR
// ----------------------------------------------------------------------------

export function labelVoieReprise(voie: EstimationFraisReprise["voieReprise"]): string {
  switch (voie) {
    case "regeneration_R5":
      return "Régénération R5 (réutilisation après purification)";
    case "destruction_D10":
      return "Destruction D10 (incinérateur ICPE 2770 agréé)";
    case "tri_avant_traitement":
      return "Tri analytique avant régénération ou destruction";
  }
}

export function labelVoieRepriseCourt(voie: EstimationFraisReprise["voieReprise"]): string {
  switch (voie) {
    case "regeneration_R5": return "Régénération R5";
    case "destruction_D10": return "Destruction D10";
    case "tri_avant_traitement": return "Tri préalable";
  }
}
