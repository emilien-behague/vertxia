// Structuration d'un devis client a partir d'un diagnostic IA Vertxia.
//
// Brief Vertxia #7 : "Transformer le diagnostic en CA". Aujourd'hui le
// DiagnosticResult fournit une fourchette indicative (devisEstimeMin /
// devisEstimeMax) qui n'est PAS exploitable commercialement. Ici on construit
// un devis structure (main d'oeuvre + pieces + deplacement + fluide
// eventuel), en marque blanche (logo + identite du pro), pret a etre
// envoye au client final.
//
// V1 = montants pre-calcules a partir du diagnostic + defauts raisonnables.
// V2 ajoutera les tarifs habituels du pro (taux horaire, marge piece,
// tarif deplacement) appris sur ses devis precedents ou configures dans
// son profil. Pour V1 on garde simple : ventilation lineaire du devisEstime
// IA en 3 lignes typiques.

import type { DiagnosticResult } from "@/lib/vision-diagnostic";

export type DevisLigne = {
  /** Libelle visible sur le PDF (ex : "Main d'oeuvre - reparation brasure") */
  designation: string;
  /** Detail optionnel sous le libelle */
  detail?: string;
  /** Quantite (par defaut 1 — pour main d'oeuvre c'est en heures) */
  quantite: number;
  /** Unite affichee (h, U, kg, ...) */
  unite: string;
  /** Prix unitaire HT en € */
  prixUnitaireHT: number;
  /** Montant HT total = quantite * prixUnitaireHT */
  montantHT: number;
};

export type Devis = {
  /** Numero unique cote PDF (ex: DEV-2026-001). Genere cote serveur. */
  numero?: string;
  /** Date du devis ISO */
  dateISO: string;
  /** Date de validite ISO (par defaut +30 jours) */
  validiteISO: string;
  /** Identite du pro emetteur — pre-rempli depuis le profil */
  emetteur: {
    raisonSociale: string;
    siret?: string;
    adresseRue?: string;
    adresseCp?: string;
    adresseVille?: string;
    telephone?: string;
    email?: string;
    siteWeb?: string;
    numeroAttestation?: string;
    /** Data URL du logo */
    logoDataUrl?: string;
    /** Data URL de la signature */
    signatureDataUrl?: string;
  };
  /** Identite du destinataire (client final) — saisi par le pro */
  destinataire: {
    nom: string;
    adresse?: string;
    telephone?: string;
    email?: string;
  };
  /** Reference du diagnostic source (si genere depuis un diag IA Vertxia) */
  diagnosticRef?: {
    diagnosticId: string;
    composant: string;
    dateDiagnosticISO: string;
  };
  /** Lignes du devis */
  lignes: DevisLigne[];
  /** Taux de TVA en % (par defaut 20 — TVA normale FR) */
  tauxTVA: number;
  /** Totaux calcules (en €) */
  totaux: {
    totalHT: number;
    montantTVA: number;
    totalTTC: number;
  };
  /** Conditions / mentions legales */
  conditionsPaiement: string;
  /** Texte additionnel libre (justification de la prestation) */
  noteIntro?: string;
};

// ─── Construction d'un devis depuis un diagnostic IA ────────────────────
//
// Strategie de ventilation V1 :
// - On prend la moyenne (min + max) / 2 comme montant total cible HT.
// - On repartit en 3 lignes typiques :
//   * Main d'oeuvre : 50% du total (estime en heures via taux horaire 65 €/h)
//   * Pieces / consommables : 35% du total
//   * Deplacement / forfait intervention : 15% du total
// - Si le diagnostic mentionne une fuite/recharge, on ajoute une 4eme ligne
//   "Fluide" (estime forfaitaire selon la gravite).
//
// C'est SIMPLE et raisonnable. Le pro pourra ajuster en V2 (ecran d'edition).

const TAUX_HORAIRE_DEFAUT = 65; // €/h HT — moyenne FR frigoriste artisan
const TAUX_TVA_DEFAUT = 20; // % — TVA normale FR
const VALIDITE_JOURS_DEFAUT = 30;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeTotaux(lignes: DevisLigne[], tauxTVA: number): {
  totalHT: number;
  montantTVA: number;
  totalTTC: number;
} {
  const totalHT = round2(lignes.reduce((sum, l) => sum + l.montantHT, 0));
  const montantTVA = round2(totalHT * (tauxTVA / 100));
  const totalTTC = round2(totalHT + montantTVA);
  return { totalHT, montantTVA, totalTTC };
}

/** Estime un montant total HT cible a partir du diagnostic. */
function estimerMontantCible(diag: DiagnosticResult): number {
  if (typeof diag.devisEstimeMin === "number" && typeof diag.devisEstimeMax === "number") {
    return (diag.devisEstimeMin + diag.devisEstimeMax) / 2;
  }
  if (typeof diag.devisEstimeMin === "number") return diag.devisEstimeMin;
  if (typeof diag.devisEstimeMax === "number") return diag.devisEstimeMax;
  // Pas d'estimation IA → on met un montant raisonnable par defaut pour
  // qu'un devis editable se cree quand meme.
  return 350;
}

/** Detecte si l'action recommandee implique du fluide (recharge, recuperation,
 *  brasage + remise en service). Heuristique simple sur les mots-cles. */
function mentionFluide(diag: DiagnosticResult): boolean {
  const text = `${diag.actionRecommandee} ${diag.causeProbable}`.toLowerCase();
  return /\brecharg|\brecuper|\bbrasur|\bfluid|\bgaz|\bsoudure|\bbrasage|\betancheite/.test(text);
}

/**
 * Estime le nombre d'heures de main d'oeuvre par defaut a partir du
 * diagnostic. Calcul : 50% du devis cible / taux horaire, arrondi a la
 * 0.5h. Sert au pre-remplissage du prompt heures dans l'UI : l'utilisateur
 * voit la valeur estimee et peut la modifier avant gen.
 *
 * @param tauxHoraireHT — taux horaire du pro en €/h (defaut 65). Doit
 *   etre le meme que celui passe a buildDevisFromDiagnostic pour rester
 *   coherent (sinon le user voit "2.5h" suggerees mais le devis final
 *   utilise un autre taux et un autre montant).
 */
export function estimerHeuresMainOeuvre(
  diagnostic: DiagnosticResult,
  tauxHoraireHT?: number
): number {
  const taux = tauxHoraireHT && tauxHoraireHT > 0 ? tauxHoraireHT : TAUX_HORAIRE_DEFAUT;
  const totalCible = estimerMontantCible(diagnostic);
  const totalMO = totalCible * 0.5; // part main d'oeuvre par defaut
  return Math.max(0.5, Math.round((totalMO / taux) * 2) / 2);
}

/** Construit un devis pre-rempli depuis un diagnostic IA + l'identite du
 *  pro + le client. Le devis est pret a etre genere en PDF — V1 sans
 *  edition cote client. */
export function buildDevisFromDiagnostic(input: {
  diagnostic: DiagnosticResult;
  diagnosticId: string;
  diagnosticDateISO: string;
  emetteur: Devis["emetteur"];
  destinataire: Devis["destinataire"];
  /** Reference unique optionnelle (ex : DEV-2026-001) */
  numero?: string;
  /** Override du nombre d'heures de main d'oeuvre. Si fourni > 0, la
   *  ligne "Main d'oeuvre" est recalculee avec ce nombre x taux horaire
   *  (au lieu d'utiliser la ventilation 50% auto). Les autres lignes
   *  (pieces, fluide, deplacement) restent calculees sur le devisEstime
   *  IA — le total final est donc ajuste si les heures fournies different
   *  du calcul auto. */
  heuresMainOeuvre?: number;
  /** Override du taux horaire HT en €/h. Par defaut 65 €/h. */
  tauxHoraireHT?: number;
}): Devis {
  const { diagnostic, diagnosticId, diagnosticDateISO, emetteur, destinataire, numero } = input;

  const tauxHoraire = input.tauxHoraireHT && input.tauxHoraireHT > 0
    ? input.tauxHoraireHT
    : TAUX_HORAIRE_DEFAUT;

  const totalCible = estimerMontantCible(diagnostic);
  const composantLabel = diagnostic.composantIdentifie || "composant frigorifique";
  // Libelle court pour la colonne "designation" du tableau (sera wrappe
  // de toute facon, mais on evite des phrases entieres style 'ATTENTION :
  // intervention hors champ F-Gas...'). On garde l'action complete dans la
  // note intro + dans le detail de la ligne.
  const composantCourt = composantLabel.length > 45 ? `${composantLabel.slice(0, 42)}…` : composantLabel;

  // Ventilation :
  // - Main d'oeuvre : 50%
  // - Pieces : 35%
  // - Deplacement : 15%
  // Si fluide impacte : on retient 12% du total cible pour le fluide,
  // on retire ces 12% de la part "pieces" (qui passe de 35% a 23%).
  const fluide = mentionFluide(diagnostic);

  const partMO = 0.5;
  const partPieces = fluide ? 0.23 : 0.35;
  const partFluide = fluide ? 0.12 : 0;
  const partDeplacement = 0.15;

  const totalMOAuto = totalCible * partMO;
  const totalPieces = totalCible * partPieces;
  const totalFluide = totalCible * partFluide;
  const totalDeplacement = totalCible * partDeplacement;

  // Main d'oeuvre : si l'utilisateur a fourni un nombre d'heures explicite,
  // on l'utilise tel quel (le taux horaire reste fixe a tauxHoraire €/h →
  // le montant MO devient heures × tauxHoraire). Sinon, on garde la
  // ventilation auto (totalMOAuto / tauxHoraire arrondi 0.5h).
  const heuresAuto = Math.max(0.5, Math.round((totalMOAuto / tauxHoraire) * 2) / 2);
  const heures = input.heuresMainOeuvre && input.heuresMainOeuvre > 0
    ? input.heuresMainOeuvre
    : heuresAuto;
  const totalMO = round2(heures * tauxHoraire);
  const prixUnitaireMO = round2(tauxHoraire);

  const lignes: DevisLigne[] = [
    {
      designation: "Main d'œuvre",
      detail: `Intervention sur ${composantCourt}${diagnostic.actionRecommandee ? ` — ${diagnostic.actionRecommandee}` : ""}`,
      quantite: heures,
      unite: "h",
      prixUnitaireHT: prixUnitaireMO,
      montantHT: round2(totalMO),
    },
    {
      designation: "Pièces et consommables",
      detail: `Selon préconisation technique sur ${composantCourt}`,
      quantite: 1,
      unite: "U",
      prixUnitaireHT: round2(totalPieces),
      montantHT: round2(totalPieces),
    },
  ];

  if (fluide) {
    lignes.push({
      designation: "Fluide frigorigène",
      detail: "Estimation — facturation au poids réel constaté",
      quantite: 1,
      unite: "lot",
      prixUnitaireHT: round2(totalFluide),
      montantHT: round2(totalFluide),
    });
  }

  lignes.push({
    designation: "Frais de déplacement",
    detail: "Aller-retour sur site",
    quantite: 1,
    unite: "forfait",
    prixUnitaireHT: round2(totalDeplacement),
    montantHT: round2(totalDeplacement),
  });

  const tauxTVA = TAUX_TVA_DEFAUT;
  const totaux = computeTotaux(lignes, tauxTVA);

  // Validite par defaut : +30 jours a partir d'aujourd'hui
  const today = new Date();
  const validite = new Date(today);
  validite.setDate(validite.getDate() + VALIDITE_JOURS_DEFAUT);

  // Note d'intro generee depuis le diagnostic — donne du contexte au client.
  // Pas de mention "généré par IA" — c'est un devis du pro, pas de Vertxia.
  let noteIntro = `Suite au diagnostic réalisé le ${new Date(diagnosticDateISO).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} sur votre ${composantLabel.toLowerCase()}`;
  if (diagnostic.causeProbable) {
    noteIntro += `, cause probable identifiée : ${diagnostic.causeProbable.toLowerCase()}.`;
  } else {
    noteIntro += ".";
  }
  noteIntro += ` Nous vous proposons l'intervention suivante.`;

  return {
    numero,
    dateISO: today.toISOString(),
    validiteISO: validite.toISOString(),
    emetteur,
    destinataire,
    diagnosticRef: {
      diagnosticId,
      composant: composantLabel,
      dateDiagnosticISO: diagnosticDateISO,
    },
    lignes,
    tauxTVA,
    totaux,
    conditionsPaiement:
      "Acompte 30% à la commande, solde à la fin de l'intervention. Paiement par virement, chèque ou espèces.",
    noteIntro,
  };
}

// ─── Construction d'un devis depuis une INTERVENTION enregistree ────────
//
// Cas d'usage different du diagnostic IA : l'intervention a deja ete
// effectuee (controle d'etancheite annuel, maintenance preventive,
// recuperation BSFF, etc.). On veut generer le devis/facture pour
// facturer le client APRES intervention.
//
// Strategie de ventilation :
// - Main d'oeuvre : heures × taux horaire (heures par defaut selon type
//   intervention, modifiable par l'utilisateur)
// - Fluide : si recuperation/recharge → quantite kg × prix kg fluide
// - Contrôle reglementaire : si type controle_* → ligne dediee CERFA
// - BSFF/cession : si bsffId → ligne "frais de traitement filiere"
// - Deplacement : forfait configurable (60 EUR HT par defaut)
// - Ligne libre "Pieces" laissee a 0 pour edition manuelle V2

// Heures de main d'oeuvre estimees par defaut selon type intervention
// (basees sur fourchettes terrain frigoristes pros FR).
const HEURES_MO_PAR_TYPE: Record<string, number> = {
  recuperation: 2,
  demantelement: 4,
  controle_periodique: 1,
  controle_non_periodique: 1.5,
  mise_service: 4,
  maintenance: 1.5,
  assemblage: 6,
  modification: 3,
};

export function estimerHeuresMOFromTypeIntervention(typeIntervention: string): number {
  return HEURES_MO_PAR_TYPE[typeIntervention] ?? 1.5;
}

// Prix indicatif HT par kg de fluide frigorigene marche FR 2026.
// Estimations marche (regle #26 CLAUDE.md), a affiner avec marges pro.
const PRIX_KG_FLUIDE_HT: Record<string, number> = {
  "R-22": 80, // HCFC legacy maintenance retrofit
  "R-32": 35,
  "R-134A": 55,
  "R-410A": 65,
  "R-404A": 95, // phase-out -> prix tendu
  "R-407C": 60,
  "R-407F": 55,
  "R-448A": 75,
  "R-449A": 75,
  "R-452A": 70,
  "R-454B": 75,
  "R-454C": 80,
  "R-1234YF": 150,
  "R-1234ZE": 120,
  "R-450A": 75,
  "R-455A": 85,
  "R-513A": 70,
  "R-290": 25, // propane naturel
  "R-744": 15, // CO2
  "R-717": 12, // NH3
  "R-600A": 30, // isobutane
};

export function prixKgFluideHt(codeFluide: string): number {
  const code = codeFluide.toUpperCase().replace(/\s+/g, "");
  return PRIX_KG_FLUIDE_HT[code] ?? 60; // defaut prudent 60 EUR/kg
}

const FORFAIT_DEPLACEMENT_HT = 60;

const LABEL_TYPE_INTERVENTION: Record<string, string> = {
  recuperation: "Récupération de fluide frigorigène",
  demantelement: "Démantèlement d'équipement",
  controle_periodique: "Contrôle d'étanchéité périodique",
  controle_non_periodique: "Contrôle d'étanchéité suite fuite",
  mise_service: "Mise en service",
  maintenance: "Maintenance préventive",
  assemblage: "Assemblage / montage initial",
  modification: "Modification d'équipement",
};

/**
 * Construit un devis pre-rempli depuis une intervention enregistree.
 * Cas d'usage post-intervention : facturer ce qui a ete fait.
 *
 * Lignes generees automatiquement :
 *  - Main d'oeuvre : heures × taux horaire (heures par defaut selon type
 *    intervention, override possible via param heuresMainOeuvre)
 *  - Fluide : si quantiteFluideKg > 0 → ligne fluide × prix kg
 *  - Controle reglementaire : si type controle_* → ligne dediee CERFA
 *  - Frais traitement BSFF : si hasBsff = true → ligne dediee filiere R5/D10
 *  - Deplacement : forfait fixe (configurable via forfaitDeplacementHt)
 */
export function buildDevisFromIntervention(input: {
  intervention: {
    id: string;
    typeIntervention: string;
    fluide: { code: string; label: string };
    weight: number;
    bsffId?: string;
    modeleEquipement?: string;
    numeroSerieEquipement?: string;
    createdAt: string;
  };
  emetteur: Devis["emetteur"];
  destinataire: Devis["destinataire"];
  numero?: string;
  /** Override des heures de main d'oeuvre. Si non fourni, utilise la
   *  valeur par defaut selon le type d'intervention. */
  heuresMainOeuvre?: number;
  /** Override du taux horaire HT. Defaut 65 EUR/h. */
  tauxHoraireHT?: number;
  /** Override du forfait deplacement. Defaut 60 EUR HT. */
  forfaitDeplacementHt?: number;
}): Devis {
  const { intervention, emetteur, destinataire, numero } = input;
  const tauxHoraire = input.tauxHoraireHT && input.tauxHoraireHT > 0
    ? input.tauxHoraireHT
    : TAUX_HORAIRE_DEFAUT;
  const heures = input.heuresMainOeuvre && input.heuresMainOeuvre > 0
    ? input.heuresMainOeuvre
    : estimerHeuresMOFromTypeIntervention(intervention.typeIntervention);
  const forfaitDeplacement = typeof input.forfaitDeplacementHt === "number"
    ? input.forfaitDeplacementHt
    : FORFAIT_DEPLACEMENT_HT;

  const labelType = LABEL_TYPE_INTERVENTION[intervention.typeIntervention]
    ?? intervention.typeIntervention;

  const equipementLabel = intervention.modeleEquipement
    ? `${intervention.modeleEquipement}${intervention.numeroSerieEquipement ? ` (n° ${intervention.numeroSerieEquipement})` : ""}`
    : "équipement frigorifique";

  const lignes: DevisLigne[] = [];

  // Ligne 1 : Main d'oeuvre
  const totalMO = round2(heures * tauxHoraire);
  lignes.push({
    designation: "Main d'œuvre",
    detail: `${labelType} sur ${equipementLabel}`,
    quantite: heures,
    unite: "h",
    prixUnitaireHT: round2(tauxHoraire),
    montantHT: totalMO,
  });

  // Ligne 2 : Fluide (si quantite manipulee > 0)
  const quantiteFluide = intervention.weight;
  if (quantiteFluide > 0) {
    const prixKg = prixKgFluideHt(intervention.fluide.code);
    const totalFluide = round2(quantiteFluide * prixKg);
    // Pour une recuperation : fluide recupere, pas facture au client (sauf
    // si on facture des frais de traitement separes ci-dessous).
    // Pour une recharge/maintenance/mise_service : fluide consomme facture.
    if (
      intervention.typeIntervention !== "recuperation" &&
      intervention.typeIntervention !== "demantelement"
    ) {
      lignes.push({
        designation: `Fluide ${intervention.fluide.code}`,
        detail: `Recharge ${quantiteFluide.toFixed(3)} kg — ${intervention.fluide.label}`,
        quantite: round2(quantiteFluide),
        unite: "kg",
        prixUnitaireHT: round2(prixKg),
        montantHT: totalFluide,
      });
    }
  }

  // Ligne 3 : Controle reglementaire CERFA si type controle_*
  if (
    intervention.typeIntervention === "controle_periodique" ||
    intervention.typeIntervention === "controle_non_periodique"
  ) {
    lignes.push({
      designation: "Contrôle d'étanchéité réglementaire",
      detail: "Génération CERFA 15497*04 + détection fuite NF EN 14624 + signature détenteur",
      quantite: 1,
      unite: "forfait",
      prixUnitaireHT: 45,
      montantHT: 45,
    });
  }

  // Ligne 4 : Frais traitement BSFF si recuperation/demantelement
  if (
    intervention.bsffId &&
    (intervention.typeIntervention === "recuperation" ||
      intervention.typeIntervention === "demantelement")
  ) {
    // Estimation moyenne frais traitement filiere R5/D10 selon fluide
    const prixKgTraitement = prixKgFluideHt(intervention.fluide.code) * 0.15; // ~15% prix neuf
    const totalTraitement = round2(quantiteFluide * prixKgTraitement);
    lignes.push({
      designation: "Frais de traitement filière",
      detail: `Récupération ${quantiteFluide.toFixed(3)} kg ${intervention.fluide.code} + BSFF officiel TrackDéchets`,
      quantite: round2(quantiteFluide),
      unite: "kg",
      prixUnitaireHT: round2(prixKgTraitement),
      montantHT: totalTraitement,
    });
  }

  // Ligne 5 : Deplacement (forfait)
  if (forfaitDeplacement > 0) {
    lignes.push({
      designation: "Frais de déplacement",
      detail: "Aller-retour sur site",
      quantite: 1,
      unite: "forfait",
      prixUnitaireHT: round2(forfaitDeplacement),
      montantHT: round2(forfaitDeplacement),
    });
  }

  const tauxTVA = TAUX_TVA_DEFAUT;
  const totaux = computeTotaux(lignes, tauxTVA);

  const today = new Date();
  const validite = new Date(today);
  validite.setDate(validite.getDate() + VALIDITE_JOURS_DEFAUT);

  const noteIntro = `Suite à l'intervention ${labelType.toLowerCase()} réalisée le ${new Date(intervention.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} sur ${equipementLabel}, voici le récapitulatif de la prestation.`;

  return {
    numero,
    dateISO: today.toISOString(),
    validiteISO: validite.toISOString(),
    emetteur,
    destinataire,
    lignes,
    tauxTVA,
    totaux,
    conditionsPaiement:
      "Paiement à réception de facture sous 30 jours. Pénalités de retard : 3 fois le taux d'intérêt légal en vigueur.",
    noteIntro,
  };
}

/** Genere un numero de devis simple, idempotent dans la session : prefixe
 *  DEV + annee + timestamp court. Pour V2 on stockera en base et on
 *  incrementera un compteur entreprise. */
export function generateDevisNumero(): string {
  const year = new Date().getFullYear();
  const stamp = Math.floor(Date.now() / 1000).toString().slice(-6);
  return `DEV-${year}-${stamp}`;
}

/**
 * Verifie si un DiagnosticResult est suffisamment fiable pour generer un
 * devis credible. Cas a EXCLURE :
 *
 *  - composantIdentifie null : l'IA n'a pas reconnu de composant
 *    frigorifique. Cas typique : photo d'un ecran d'ordi, d'un papier,
 *    d'une plaque non-FCgaz. Generer un devis = inventer une intervention
 *    qui n'existe pas → arnaque du client.
 *
 *  - confiance "basse" : l'IA elle-meme se mefie de son output. Un devis
 *    base la-dessus serait fragile (mauvais composant identifie, mauvais
 *    montant). Mieux vaut demander une nouvelle photo.
 *
 *  - causeProbable contient "non liee/non lie/reprendre la photo" : le
 *    system prompt force ces phrases quand la photo ne montre pas un
 *    composant frigorifique. Garde-fou supplementaire au cas ou
 *    composantIdentifie aurait ete defini par hasard.
 *
 * Retourne null si OK, sinon une raison (string courte) pour afficher en UI.
 */
export function whyDevisBlocked(diagnostic: {
  composantIdentifie?: string | null;
  confiance?: "haute" | "moyenne" | "basse";
  causeProbable?: string;
  defautsDetectes?: { gravite: string }[];
}): string | null {
  if (!diagnostic.composantIdentifie) {
    return "Composant non identifié — reprends la photo en cadrant sur le composant à diagnostiquer";
  }
  if (diagnostic.confiance === "basse") {
    return "Confiance IA trop faible — reprends une photo plus nette et mieux cadrée avant de générer un devis";
  }
  const cause = (diagnostic.causeProbable ?? "").toLowerCase();
  if (
    cause.includes("non lie") ||
    cause.includes("non liée") ||
    cause.includes("reprendre la photo") ||
    cause.includes("reprends la photo")
  ) {
    return "Image non liée à un composant frigorifique — reprends une photo du composant à diagnostiquer";
  }
  return null;
}

/** Helper boolean simple pour les UI conditionnelles */
export function canGenerateDevis(diagnostic: {
  composantIdentifie?: string | null;
  confiance?: "haute" | "moyenne" | "basse";
  causeProbable?: string;
}): boolean {
  return whyDevisBlocked(diagnostic) === null;
}

/** Format montant en EUR FR (ex : 1 234,50 €) */
export function fmtEUR(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
