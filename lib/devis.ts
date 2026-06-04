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

import type { DiagnosticResult } from "./vision-diagnostic";

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
}): Devis {
  const { diagnostic, diagnosticId, diagnosticDateISO, emetteur, destinataire, numero } = input;

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

  const totalMO = totalCible * partMO;
  const totalPieces = totalCible * partPieces;
  const totalFluide = totalCible * partFluide;
  const totalDeplacement = totalCible * partDeplacement;

  // Main d'oeuvre : heures = totalMO / taux horaire (arrondi 0.5h le plus proche)
  const heures = Math.max(0.5, Math.round((totalMO / TAUX_HORAIRE_DEFAUT) * 2) / 2);
  const prixUnitaireMO = round2(totalMO / heures);

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

/** Genere un numero de devis simple, idempotent dans la session : prefixe
 *  DEV + annee + timestamp court. Pour V2 on stockera en base et on
 *  incrementera un compteur entreprise. */
export function generateDevisNumero(): string {
  const year = new Date().getFullYear();
  const stamp = Math.floor(Date.now() / 1000).toString().slice(-6);
  return `DEV-${year}-${stamp}`;
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
