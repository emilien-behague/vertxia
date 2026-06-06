// Garde-fou qualite Vertxia — verifie l'integrite reglementaire et la
// coherence d'une intervention AVANT envoi (BSFF / CERFA / SYDEREP).
//
// Vise le brief #4 : "L'IA detecte les fraudes / incoherences avant envoi".
// V1 = 100% regles deterministes (pure functions, instantane, fiable, pas
// de dependance reseau). V2 = ajout d'une couche LLM pour cas ambigus
// (incoherences narratives entre notes et type d'intervention, etc.).
//
// Principe : on bloque les erreurs reglementaires GRAVES (R-22 recharge,
// signature manquante, attestation expiree), on alerte sur les
// incoherences metier suspectes (charge >120% nominal, test bullage absent
// sur gros equipement), et on informe pour les bonnes pratiques (notes
// vides sur controle suite fuite).
//
// Argument de vente direct : "Avec Vertxia, jamais d'erreur DREAL."

import type { StoredIntervention } from "@/lib/intervention-storage";
import type { StoredEquipement } from "@/lib/equipement";
import type { Profil } from "@/lib/profil";

export type IntegritySeverite = "blocant" | "alerte" | "info";

export type IntegrityIssue = {
  /** Identifiant unique de la regle (pour analytics / traduction future) */
  code: string;
  severite: IntegritySeverite;
  /** Titre court (4-6 mots) */
  titre: string;
  /** Description 1-2 phrases avec le pourquoi reglementaire/metier */
  message: string;
  /** Action concrete proposee au technicien pour resoudre */
  suggestion?: string;
  /** Champ concerne (pour highlighting UI eventuel) */
  champ?: string;
  /** Reference reglementaire si applicable */
  articleRef?: string;
};

export type IntegrityReport = {
  issues: IntegrityIssue[];
  /** Au moins 1 issue blocante presente. Submit doit etre interdit. */
  hasBlocking: boolean;
  /** Au moins 1 alerte presente. Submit possible mais doit demander
   *  confirmation explicite. */
  hasAlertes: boolean;
  /** Compteur par severite pour affichage rapide */
  countBySeverite: Record<IntegritySeverite, number>;
};

// ─── Input minimal pour les checks ───────────────────────────────────
// On evite de demander un StoredIntervention complet (qui necessite un
// uuid + createdAt) — les checks doivent pouvoir tourner sur les donnees
// du formulaire en cours, avant save.

export type DraftIntervention = {
  typeIntervention: string;
  fluide: { code: string; gwp?: number };
  /** Poids en kg (manipulation/recharge/recuperation) */
  weight: number;
  packagingNumero?: string;
  clientName?: string | null;
  modeleEquipement?: string;
  numeroSerieEquipement?: string;
  lieuIntervention?: string;
  controleDetails?: {
    detecteurPermanent?: boolean;
    methodeControle?: string;
    testBullage?: boolean;
  };
  notes?: string;
  hasDetenteurSignature?: boolean;
  detenteurName?: string;
  detenteurQuality?: string;
  hasOperateurSignature?: boolean;
  /** Date prevue/saisie de l'intervention (ISO). Defaut = now si absent. */
  dateInterventionISO?: string;
};

// Liste de codes fluides totalement interdits a la recharge (HCFC phase-out
// UE 1005/2009 et amendes). Source : Reglement UE 2024/573.
const FLUIDES_INTERDITS_RECHARGE = new Set([
  "R-22",
  "R22",
  "R-141B",
  "R141B",
  "R-142B",
  "R142B",
]);

// Codes d'intervention qui MODIFIENT la charge de fluide (donc weight > 0
// attendu et trace dans le registre obligatoire).
const TYPES_MODIFIANT_CHARGE = new Set([
  "recuperation",
  "demantelement",
  "maintenance",
  "modification",
  "mise_service",
  "assemblage",
]);

// Codes d'intervention de CONTROLE (CERFA 15497*04 obligatoire, signatures
// detenteur + operateur exigees).
const TYPES_CONTROLE = new Set(["controle_periodique", "controle_non_periodique"]);

// Calcul tCO2eq simple pour les regles V1. Source de verite : lib/equipement.
function computeTCo2eq(chargeKg: number, gwp: number | undefined): number {
  if (!gwp || gwp <= 0) return 0;
  return (chargeKg * gwp) / 1000;
}

// ─── Regle 1 : R-22 et autres HCFC interdits a la recharge ─────────────

function checkFluideInterdit(d: DraftIntervention): IntegrityIssue | null {
  if (!TYPES_MODIFIANT_CHARGE.has(d.typeIntervention)) return null;
  const code = d.fluide.code.toUpperCase().replace(/[\s-]/g, "");
  for (const interdit of FLUIDES_INTERDITS_RECHARGE) {
    if (code === interdit.replace(/[\s-]/g, "")) {
      return {
        code: "FLUIDE_INTERDIT_RECHARGE",
        severite: "blocant",
        titre: `Recharge ${d.fluide.code} interdite`,
        message: `Le ${d.fluide.code} est un HCFC en phase-out total dans l'UE depuis 2015. Toute recharge est illegale et expose le technicien a des sanctions penales + retrait d'attestation de capacite.`,
        suggestion: `Proposer un retrofit au client (R-407C, R-422D ou R-449A selon application). Demantelement du systeme et recuperation du fluide existant via BSFF.`,
        champ: "fluide",
        articleRef: "Reglement UE 1005/2009",
      };
    }
  }
  return null;
}

// ─── Regle 2 : Charge saisie incoherente avec charge nominale equipement ─

function checkChargeIncoherente(
  d: DraftIntervention,
  eq: StoredEquipement | null
): IntegrityIssue | null {
  if (!eq || eq.chargeKg <= 0) return null;
  if (d.weight <= 0) return null;
  if (!TYPES_MODIFIANT_CHARGE.has(d.typeIntervention)) return null;

  const ratio = d.weight / eq.chargeKg;

  if (ratio > 1.5) {
    return {
      code: "CHARGE_VS_NOMINAL_EXCESSIVE",
      severite: "alerte",
      titre: `Poids saisi > 150% de la charge nominale`,
      message: `Tu saisis ${d.weight.toFixed(2)} kg de ${d.fluide.code} sur un equipement dont la charge nominale est de ${eq.chargeKg.toFixed(2)} kg. Ratio ${(ratio * 100).toFixed(0)}% — il y a probablement une erreur de saisie (kg vs g, oubli de virgule).`,
      suggestion: `Verifie le poids saisi. Si correct (cas rare : remplacement de fluide apres demantelement), confirme ci-dessous.`,
      champ: "weight",
    };
  }
  if (ratio > 1.2 && d.typeIntervention !== "recuperation") {
    return {
      code: "CHARGE_VS_NOMINAL_ELEVEE",
      severite: "info",
      titre: `Poids saisi > 120% de la charge nominale`,
      message: `${d.weight.toFixed(2)} kg saisis pour ${eq.chargeKg.toFixed(2)} kg nominaux. Pas forcement une erreur mais merite verification.`,
      champ: "weight",
    };
  }
  return null;
}

// ─── Regle 3 : Date intervention dans le futur ─────────────────────────

function checkDateFuture(d: DraftIntervention): IntegrityIssue | null {
  if (!d.dateInterventionISO) return null;
  try {
    const date = new Date(d.dateInterventionISO);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMin = diffMs / (1000 * 60);
    if (diffMin > 60) {
      return {
        code: "DATE_FUTURE",
        severite: "blocant",
        titre: "Date d'intervention dans le futur",
        message: `La date saisie (${date.toLocaleString("fr-FR")}) est posterieure a maintenant. Un BSFF / CERFA avec une date future serait rejete par TrackDechets.`,
        suggestion: "Corrige la date d'intervention pour qu'elle soit dans le passe ou dans l'instant present.",
        champ: "dateIntervention",
      };
    }
  } catch {
    // Date mal formee → c'est une autre erreur, qui sera detectee ailleurs
  }
  return null;
}

// ─── Regle 4 : Signature detenteur manquante sur CERFA ─────────────────

function checkSignatureDetenteur(d: DraftIntervention): IntegrityIssue | null {
  if (!TYPES_CONTROLE.has(d.typeIntervention)) return null;
  if (d.hasDetenteurSignature) return null;
  return {
    code: "SIGNATURE_DETENTEUR_MANQUANTE",
    severite: "blocant",
    titre: "Signature du detenteur manquante",
    message: `Le CERFA 15497*04 exige la signature du detenteur de l'equipement (client final) pour etre valable. Sans signature, le document n'a pas de valeur reglementaire en cas de controle DREAL.`,
    suggestion: "Demande au client de signer sur l'ecran avant generation du CERFA.",
    champ: "detenteurSignature",
    articleRef: "Article 6 du decret F-Gas FR",
  };
}

// ─── Regle 5 : Identite detenteur manquante sur CERFA ──────────────────

function checkDetenteurIdentite(d: DraftIntervention): IntegrityIssue | null {
  if (!TYPES_CONTROLE.has(d.typeIntervention)) return null;
  if (d.detenteurName?.trim() && d.detenteurQuality?.trim()) return null;
  return {
    code: "DETENTEUR_IDENTITE_MANQUANTE",
    severite: "blocant",
    titre: "Identite du detenteur incomplete",
    message: `Le CERFA exige le nom du detenteur + sa qualite (proprietaire, gerant, responsable technique). Champs ${!d.detenteurName?.trim() ? "nom" : ""}${!d.detenteurName?.trim() && !d.detenteurQuality?.trim() ? " et " : ""}${!d.detenteurQuality?.trim() ? "qualite" : ""} a remplir avant signature.`,
    suggestion: "Renseigne le nom et la qualite de la personne qui va signer.",
    champ: "detenteur",
  };
}

// ─── Regle 6 : Attestation de capacite manquante / expiree ─────────────

function checkAttestation(profil: Profil | null): IntegrityIssue | null {
  if (!profil?.numeroAttestation?.trim()) {
    return {
      code: "ATTESTATION_MANQUANTE",
      severite: "blocant",
      titre: "Attestation de capacite F-Gas manquante",
      message: `Aucun numero d'attestation de capacite n'est enregistre dans ton profil entreprise. Toute manipulation de fluide HFC sans attestation valide est illegale (article 10 du reglement UE 2024/573).`,
      suggestion: "Va dans Profil → Attestation et saisis ton numero d'attestation de capacite (delivre par un organisme agree).",
      articleRef: "Reglement UE 2024/573 art. 10",
    };
  }
  return null;
}

// ─── Regle 7 : Test bullage / methode de detection obligatoire ─────────

function checkMethodeControle(
  d: DraftIntervention,
  eq: StoredEquipement | null
): IntegrityIssue | null {
  if (!TYPES_CONTROLE.has(d.typeIntervention)) return null;
  if (!eq) return null;
  const tCO2eq = computeTCo2eq(eq.chargeKg, eq.fluide.gwp);
  // Seuil 50 tCO2eq : detecteur sensibilite < 5g/an obligatoire (norme).
  // Sur les eqs ≥ 500 tCO2eq, methode + test bullage devraient idealement
  // etre tous les deux declares.
  if (tCO2eq < 50) return null;
  const m = d.controleDetails?.methodeControle?.trim();
  if (!m) {
    return {
      code: "METHODE_CONTROLE_MANQUANTE",
      severite: "alerte",
      titre: "Methode de detection non documentee",
      message: `Cet equipement contient ${tCO2eq.toFixed(1)} tCO2eq de fluide. Pour les eqs ≥ 50 tCO2eq, la methode de detection (bullage savon, detecteur electronique sensibilite < 5g/an, traceur UV) DOIT etre documentee dans le CERFA.`,
      suggestion: "Renseigne la methode de detection utilisee dans les details du controle.",
      champ: "methodeControle",
      articleRef: "Norme NF EN 14624",
    };
  }
  return null;
}

// ─── Regle 8 : Fluide non selectionne mais charge saisie ───────────────

function checkFluideManquant(d: DraftIntervention): IntegrityIssue | null {
  if (!d.fluide.code?.trim() && d.weight > 0) {
    return {
      code: "FLUIDE_MANQUANT",
      severite: "blocant",
      titre: "Fluide non selectionne",
      message: `Tu saisis ${d.weight.toFixed(2)} kg mais aucun fluide n'est selectionne. Impossible de generer le BSFF / CERFA sans connaitre la nature du fluide.`,
      suggestion: "Selectionne le fluide manipule (R-32, R-410A, R-134a, R-449A, etc.) dans la liste deroulante.",
      champ: "fluide",
    };
  }
  return null;
}

// ─── Regle 9 : Recuperation sans numero de bouteille ────────────────────

function checkBouteilleSurRecuperation(d: DraftIntervention): IntegrityIssue | null {
  if (d.typeIntervention !== "recuperation" && d.typeIntervention !== "demantelement") {
    return null;
  }
  if (d.weight <= 0) return null;
  if (d.packagingNumero?.trim()) return null;
  return {
    code: "PACKAGING_RECUPERATION_MANQUANT",
    severite: "blocant",
    titre: "Numero de bouteille de recuperation manquant",
    message: `Tu declares ${d.weight.toFixed(2)} kg recuperes mais aucun numero de bouteille (packaging) n'est saisi. Le BSFF TrackDechets sera rejete sans ce numero (tracabilite obligatoire).`,
    suggestion: "Saisis le numero de la bouteille dans laquelle tu as recupere le fluide.",
    champ: "packagingNumero",
    articleRef: "Article R.541-45 Code de l'environnement",
  };
}

// ─── Regle 10 : Client / detenteur manquant ─────────────────────────────

function checkClient(d: DraftIntervention): IntegrityIssue | null {
  if (!d.clientName?.trim()) {
    return {
      code: "CLIENT_MANQUANT",
      severite: "blocant",
      titre: "Client / detenteur de l'equipement manquant",
      message: `Aucun nom de client (detenteur de l'equipement) saisi. Le CERFA ne peut pas etre genere sans ce champ.`,
      suggestion: "Renseigne le nom du detenteur (raison sociale ou particulier).",
      champ: "clientName",
    };
  }
  return null;
}

// ─── Regle 11 : Notes vides sur controle non periodique ─────────────────

function checkNotesControleSuiteFuite(d: DraftIntervention): IntegrityIssue | null {
  if (d.typeIntervention !== "controle_non_periodique") return null;
  if (d.notes?.trim() && d.notes.trim().length >= 20) return null;
  return {
    code: "NOTES_CONTROLE_FUITE_VIDES",
    severite: "alerte",
    titre: "Cause du controle non documentee",
    message: `Un controle non periodique (= suite a une fuite ou un defaut) DOIT documenter la cause de l'intervention dans les observations. Le CERFA sans cette info est juridiquement incomplet en cas de litige.`,
    suggestion: "Decris brievement la cause du controle dans les notes (ex: 'Alarme detecteur fixe', 'Constat fuite par client', 'Suite reparation').",
    champ: "notes",
  };
}

// ─── Regle 12 : Recharge sans recherche de fuite (eq ayant fui) ────────

function checkRechargeRepetee(
  d: DraftIntervention,
  eq: StoredEquipement | null,
  historiqueInterventions: StoredIntervention[]
): IntegrityIssue | null {
  if (!eq) return null;
  if (!TYPES_MODIFIANT_CHARGE.has(d.typeIntervention)) return null;
  if (d.weight <= 0) return null;
  if (d.typeIntervention === "recuperation") return null;

  // Cherche si l'eq a deja eu une recharge dans les 12 derniers mois
  const now = Date.now();
  const recentReloads = historiqueInterventions.filter((i) => {
    if (i.numeroSerieEquipement?.toLowerCase().trim() !== eq.numeroSerie.toLowerCase().trim()) return false;
    if (!TYPES_MODIFIANT_CHARGE.has(i.typeIntervention)) return false;
    if (i.typeIntervention === "recuperation") return false;
    if ((i.weight ?? 0) <= 0) return false;
    const age = (now - new Date(i.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return age <= 365;
  });

  if (recentReloads.length >= 1) {
    return {
      code: "RECHARGE_REPETEE",
      severite: "alerte",
      titre: "Recharge repetee sur le meme equipement",
      message: `Cet equipement a deja recu ${recentReloads.length} recharge${recentReloads.length > 1 ? "s" : ""} dans les 12 derniers mois. Une nouvelle recharge sans recherche de fuite documentee est une non-conformite reglementaire (art. 5 UE 2024/573).`,
      suggestion: "Documenter une recherche de fuite (test bullage / detecteur electronique) ET tracer la reparation dans les notes avant la recharge.",
      champ: "weight",
      articleRef: "Reglement UE 2024/573 art. 5",
    };
  }
  return null;
}

// ─── API publique ───────────────────────────────────────────────────────

export type IntegrityCheckInput = {
  intervention: DraftIntervention;
  /** Equipement concerne si connu (pre-rempli depuis le parc ou QR scan) */
  equipement?: StoredEquipement | null;
  /** Profil entreprise du technicien (pour verifier attestation, signature operateur) */
  profil?: Profil | null;
  /** Historique des interventions du pro (pour detecter recharges repetees) */
  historiqueInterventions?: StoredIntervention[];
};

/**
 * Lance TOUS les checks d'integrite sur une intervention en cours de saisie
 * et retourne un rapport structure. Pure function — pas de side effect,
 * appelable autant de fois qu'on veut (debounced live ou au submit).
 */
export function checkInterventionIntegrity(
  input: IntegrityCheckInput
): IntegrityReport {
  const { intervention: d, equipement = null, profil = null, historiqueInterventions = [] } = input;

  const issues: IntegrityIssue[] = [];

  // Ordre : on lance dans l'ordre logique (les blocants legaux en premier)
  const checks: Array<IntegrityIssue | null> = [
    checkFluideInterdit(d),
    checkAttestation(profil),
    checkFluideManquant(d),
    checkClient(d),
    checkBouteilleSurRecuperation(d),
    checkSignatureDetenteur(d),
    checkDetenteurIdentite(d),
    checkDateFuture(d),
    checkChargeIncoherente(d, equipement),
    checkMethodeControle(d, equipement),
    checkRechargeRepetee(d, equipement, historiqueInterventions),
    checkNotesControleSuiteFuite(d),
  ];

  for (const c of checks) {
    if (c) issues.push(c);
  }

  // Tri par severite (blocant > alerte > info) puis par code (stable)
  const order: Record<IntegritySeverite, number> = { blocant: 0, alerte: 1, info: 2 };
  issues.sort((a, b) => {
    const s = order[a.severite] - order[b.severite];
    if (s !== 0) return s;
    return a.code.localeCompare(b.code);
  });

  const countBySeverite: Record<IntegritySeverite, number> = {
    blocant: 0,
    alerte: 0,
    info: 0,
  };
  for (const i of issues) countBySeverite[i.severite]++;

  return {
    issues,
    hasBlocking: countBySeverite.blocant > 0,
    hasAlertes: countBySeverite.alerte > 0,
    countBySeverite,
  };
}

/** Helper de styling pour rendre les severites visuellement dans la modal. */
export const SEVERITE_STYLES: Record<
  IntegritySeverite,
  { bg: string; text: string; ring: string; dot: string; label: string; icon: string }
> = {
  blocant: {
    bg: "bg-red-50",
    text: "text-red-700",
    ring: "ring-red-200",
    dot: "bg-red-600",
    label: "BLOQUANT",
    icon: "🚫",
  },
  alerte: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    ring: "ring-orange-200",
    dot: "bg-orange-500",
    label: "ALERTE",
    icon: "⚠️",
  },
  info: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    ring: "ring-blue-200",
    dot: "bg-blue-500",
    label: "INFO",
    icon: "ℹ️",
  },
};
