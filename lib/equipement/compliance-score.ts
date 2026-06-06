// Score de conformite parc Vertxia — pastille permanente affichee dans le
// header de l'app /m/*. Calcule un score 0-100 a partir de TOUTES les
// donnees deja stockees (equipements, interventions, diagnostics, profil)
// pour donner au pro une vue synthetique de son etat reglementaire en
// temps reel.
//
// Brief Vertxia : "Pastille permanente affichant le score conformite parc
// en temps reel (87/100, vert/orange/rouge)". Au tap, decomposition par
// categorie + actions correctives.
//
// Differenciateur F.i360°/Praxedo : eux affichent des dashboards de
// donnees brutes. Ici on fait UN VRAI JUGEMENT METIER : "ton parc est
// a 72/100, voici pourquoi". Synthese qu'un editeur SaaS classique ne
// se mouille pas a faire.
//
// V1 sans LLM — pur calcul deterministe sur la data deja en RAM. V2
// pourra utiliser Claude pour generer un commentaire personnalise du score.

import type { StoredEquipement, EquipementWithStatus } from "@/lib/equipement/equipement";
import type { StoredIntervention } from "@/lib/intervention/intervention-storage";
import type { StoredDiagnostic } from "@/lib/intervention/diagnostic-storage";
import type { Profil } from "@/lib/profil";
import { detectPredictiveSignals } from "@/lib/intervention/predictive-maintenance";

export type ScoreColor = "green" | "orange" | "red" | "neutral";

export type ScoreCategoryKey =
  | "controles_etancheite"
  | "bsff_complets"
  | "signatures_cerfa"
  | "fluides_phase_out"
  | "attestation_fgas"
  | "signaux_predictifs";

export type ScoreCategory = {
  key: ScoreCategoryKey;
  label: string;
  /** Score obtenu sur cette categorie (entier 0-N) */
  obtenu: number;
  /** Score max possible sur cette categorie (= ponderation) */
  max: number;
  /** Statut couleur de cette categorie isolee */
  statut: ScoreColor;
  /** Message metier explicite : "3 contrôles en retard", "Attestation valide jusqu'au..." */
  message: string;
  /** Actions concretes proposees (si la categorie n'est pas au max). Optionnel. */
  actions?: { titre: string; href?: string }[];
};

export type ComplianceScore = {
  /** Score global 0-100 (entier) */
  total: number;
  /** Couleur globale calculee depuis total */
  color: ScoreColor;
  /** Label court pour le tooltip / drawer header */
  label: string;
  /** Decomposition par categorie metier */
  categories: ScoreCategory[];
  /** Vrai si aucun equipement dans le parc — on affiche le score 100 mais
   *  avec un message explicite "parc vide". */
  parcVide: boolean;
};

const FLUIDES_PHASE_OUT_CODES = new Set([
  "R-22", "R22",
  "R-404A", "R404A",
  "R-507A", "R507A",
  "R-141B", "R141B",
  "R-142B", "R142B",
]);

const FLUIDES_GWP_ELEVE_CODES = new Set([
  "R-410A", "R410A",
  "R-134A", "R-134a", "R134a", "R134A",
]);

function colorFromRatio(ratio: number): ScoreColor {
  if (ratio >= 0.85) return "green";
  if (ratio >= 0.6) return "orange";
  return "red";
}

// ─── Categorie 1 : Controles d'etancheite a jour (30 pts) ─────────────

function scoreControlesEtancheite(
  equipements: EquipementWithStatus[]
): ScoreCategory {
  const max = 30;
  // On note uniquement sur les equipements NON-EXEMPTS (ceux qui doivent
  // etre controles reglementairement). Un parc de 100% d'eqs exempts
  // n'est pas un signal positif ni negatif sur la conformite controle.
  const aControler = equipements.filter((e) => e.statut !== "exempt");
  if (aControler.length === 0) {
    return {
      key: "controles_etancheite",
      label: "Contrôles d'étanchéité",
      obtenu: max,
      max,
      statut: "neutral",
      message: "Aucun équipement soumis à contrôle obligatoire",
    };
  }
  const aJour = aControler.filter((e) => e.statut === "ok").length;
  const enRetard = aControler.filter((e) => e.statut === "en_retard").length;
  const aRelancer = aControler.filter((e) => e.statut === "a_relancer").length;
  const jamais = aControler.filter((e) => e.statut === "jamais").length;

  // Pondération métier : un retard pèse plus qu'un "à relancer", un
  // "jamais contrôlé" pèse encore plus qu'un retard léger.
  // - eq en ok : 100% des points pour cet eq
  // - eq en a_relancer (≤30j) : 80% (encore temps)
  // - eq en a_programmer / jamais : 50%
  // - eq en retard : 20%
  const points =
    aJour * 1.0 +
    aRelancer * 0.8 +
    aControler.filter((e) => e.statut === "a_programmer").length * 0.5 +
    jamais * 0.5 +
    enRetard * 0.2;
  const ratio = points / aControler.length;
  const obtenu = Math.round(max * ratio);
  const statut = colorFromRatio(ratio);

  const msgParts: string[] = [];
  if (enRetard > 0) msgParts.push(`${enRetard} en retard`);
  if (aRelancer > 0) msgParts.push(`${aRelancer} à relancer (J-30)`);
  if (jamais > 0) msgParts.push(`${jamais} jamais contrôlés`);
  if (aJour === aControler.length) msgParts.push(`${aJour} à jour`);

  const message = msgParts.length > 0
    ? msgParts.join(" · ")
    : `${aJour}/${aControler.length} équipements à jour`;

  const actions: ScoreCategory["actions"] = [];
  if (enRetard > 0 || jamais > 0) {
    actions.push({ titre: "Voir équipements en retard", href: "/m/equipements?filter=en_retard" });
  }
  if (aRelancer > 0) {
    actions.push({ titre: "Relancer les clients (J-30)", href: "/m/equipements?filter=a_relancer" });
  }

  return {
    key: "controles_etancheite",
    label: "Contrôles d'étanchéité",
    obtenu,
    max,
    statut,
    message,
    actions: actions.length > 0 ? actions : undefined,
  };
}

// ─── Categorie 2 : BSFF complets sur recuperations (20 pts) ───────────

function scoreBsffComplets(interventions: StoredIntervention[]): ScoreCategory {
  const max = 20;
  const recuperations = interventions.filter(
    (i) => i.typeIntervention === "recuperation" || i.typeIntervention === "demantelement"
  );
  if (recuperations.length === 0) {
    return {
      key: "bsff_complets",
      label: "BSFF récupération",
      obtenu: max,
      max,
      statut: "neutral",
      message: "Aucune récupération de fluide enregistrée",
    };
  }
  const avecBsff = recuperations.filter((i) => Boolean(i.bsffId)).length;
  const ratio = avecBsff / recuperations.length;
  const obtenu = Math.round(max * ratio);
  const statut = colorFromRatio(ratio);

  const manquants = recuperations.length - avecBsff;
  const message = manquants === 0
    ? `${avecBsff}/${recuperations.length} récupérations tracées BSFF`
    : `${manquants} récupération${manquants > 1 ? "s" : ""} sans BSFF signé`;

  return {
    key: "bsff_complets",
    label: "BSFF récupération",
    obtenu,
    max,
    statut,
    message,
    actions: manquants > 0
      ? [{ titre: "Voir les récupérations sans BSFF", href: "/m/historique?filter=bsff_manquant" }]
      : undefined,
  };
}

// ─── Categorie 3 : Signatures CERFA presentes (20 pts) ────────────────

function scoreSignaturesCerfa(interventions: StoredIntervention[]): ScoreCategory {
  const max = 20;
  const controles = interventions.filter(
    (i) =>
      i.typeIntervention === "controle_periodique" ||
      i.typeIntervention === "controle_non_periodique"
  );
  if (controles.length === 0) {
    return {
      key: "signatures_cerfa",
      label: "Signatures CERFA",
      obtenu: max,
      max,
      statut: "neutral",
      message: "Aucun contrôle d'étanchéité enregistré",
    };
  }
  const signees = controles.filter((i) => Boolean(i.hasDetenteurSignature)).length;
  const ratio = signees / controles.length;
  const obtenu = Math.round(max * ratio);
  const statut = colorFromRatio(ratio);

  const manquantes = controles.length - signees;
  const message = manquantes === 0
    ? `${signees}/${controles.length} CERFA signés`
    : `${manquantes} CERFA sans signature détenteur`;

  return {
    key: "signatures_cerfa",
    label: "Signatures CERFA",
    obtenu,
    max,
    statut,
    message,
    actions: manquantes > 0
      ? [{ titre: "Voir les CERFA non signés", href: "/m/historique?filter=cerfa_non_signe" }]
      : undefined,
  };
}

// ─── Categorie 4 : Fluides hors phase-out (15 pts) ────────────────────

function scoreFluidesPhaseOut(equipements: StoredEquipement[]): ScoreCategory {
  const max = 15;
  if (equipements.length === 0) {
    return {
      key: "fluides_phase_out",
      label: "Fluides en phase-out",
      obtenu: max,
      max,
      statut: "neutral",
      message: "Parc vide",
    };
  }
  const interdits = equipements.filter((e) => {
    const code = e.fluide.code.toUpperCase().replace(/\s/g, "");
    return FLUIDES_PHASE_OUT_CODES.has(code) || FLUIDES_PHASE_OUT_CODES.has(code.replace(/^R/, "R-"));
  }).length;
  const gwpEleve = equipements.filter((e) => {
    const code = e.fluide.code.toUpperCase().replace(/\s/g, "");
    return FLUIDES_GWP_ELEVE_CODES.has(code) || FLUIDES_GWP_ELEVE_CODES.has(code.replace(/^R/, "R-"));
  }).length;
  const ok = equipements.length - interdits - gwpEleve;

  // Interdits pèsent x3 vs GWP élevé. Ratio sur le pire cas.
  const points = ok * 1.0 + gwpEleve * 0.7 + interdits * 0.0;
  const ratio = points / equipements.length;
  const obtenu = Math.round(max * ratio);
  const statut = colorFromRatio(ratio);

  const msgParts: string[] = [];
  if (interdits > 0) msgParts.push(`${interdits} interdit${interdits > 1 ? "s" : ""} à la recharge (R-22/R-404A)`);
  if (gwpEleve > 0) msgParts.push(`${gwpEleve} à GWP élevé (R-410A/R-134a)`);
  if (interdits === 0 && gwpEleve === 0) msgParts.push(`${equipements.length} équipements aux fluides conformes`);

  const message = msgParts.join(" · ");

  return {
    key: "fluides_phase_out",
    label: "Fluides en phase-out",
    obtenu,
    max,
    statut,
    message,
    actions: interdits > 0 || gwpEleve > 0
      ? [{ titre: "Voir équipements à retrofiter", href: "/m/equipements" }]
      : undefined,
  };
}

// ─── Categorie 5 : Attestation F-Gas valide (10 pts) ──────────────────

function scoreAttestation(profil: Profil): ScoreCategory {
  const max = 10;
  if (!profil.numeroAttestation?.trim()) {
    return {
      key: "attestation_fgas",
      label: "Attestation F-Gas",
      obtenu: 0,
      max,
      statut: "red",
      message: "Aucun numéro d'attestation enregistré — illégal d'intervenir",
      actions: [{ titre: "Renseigner l'attestation", href: "/m/profil" }],
    };
  }
  // Expiration : si fournie, on check. Si vide, on accepte (V1 lax).
  if (profil.dateExpirationAttestation) {
    const exp = new Date(profil.dateExpirationAttestation);
    const now = new Date();
    const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) {
      return {
        key: "attestation_fgas",
        label: "Attestation F-Gas",
        obtenu: 0,
        max,
        statut: "red",
        message: `Attestation expirée depuis ${Math.abs(Math.round(diffDays))} jours`,
        actions: [{ titre: "Renouveler l'attestation", href: "/m/profil" }],
      };
    }
    if (diffDays < 90) {
      return {
        key: "attestation_fgas",
        label: "Attestation F-Gas",
        obtenu: Math.round(max * 0.7),
        max,
        statut: "orange",
        message: `Attestation expire dans ${Math.round(diffDays)} jours`,
        actions: [{ titre: "Préparer le renouvellement", href: "/m/profil" }],
      };
    }
  }
  return {
    key: "attestation_fgas",
    label: "Attestation F-Gas",
    obtenu: max,
    max,
    statut: "green",
    message: profil.dateExpirationAttestation
      ? `Valide jusqu'au ${new Date(profil.dateExpirationAttestation).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
      : `N° ${profil.numeroAttestation}`,
  };
}

// ─── Categorie 6 : Signaux predictifs (5 pts) ─────────────────────────

function scoreSignauxPredictifs(
  equipements: StoredEquipement[],
  interventions: StoredIntervention[],
  diagnostics: StoredDiagnostic[]
): ScoreCategory {
  const max = 5;
  if (equipements.length === 0) {
    return {
      key: "signaux_predictifs",
      label: "Signaux prédictifs",
      obtenu: max,
      max,
      statut: "neutral",
      message: "Parc vide",
    };
  }
  let critiques = 0;
  let alertes = 0;
  for (const eq of equipements) {
    const sigs = detectPredictiveSignals(eq, interventions, diagnostics);
    if (sigs.some((s) => s.gravite === "critique")) critiques++;
    else if (sigs.some((s) => s.gravite === "alerte")) alertes++;
  }
  const total = critiques + alertes;
  if (total === 0) {
    return {
      key: "signaux_predictifs",
      label: "Signaux prédictifs",
      obtenu: max,
      max,
      statut: "green",
      message: "Aucun équipement à risque détecté",
    };
  }
  // Critique = 0 pt sur cet eq, alerte = 0.4 pt, sain = 1 pt
  const sains = equipements.length - total;
  const points = sains * 1.0 + alertes * 0.4 + critiques * 0.0;
  const ratio = points / equipements.length;
  const obtenu = Math.round(max * ratio);
  const statut = colorFromRatio(ratio);

  const msgParts: string[] = [];
  if (critiques > 0) msgParts.push(`${critiques} équipement${critiques > 1 ? "s" : ""} critique${critiques > 1 ? "s" : ""}`);
  if (alertes > 0) msgParts.push(`${alertes} en alerte`);

  return {
    key: "signaux_predictifs",
    label: "Signaux prédictifs",
    obtenu,
    max,
    statut,
    message: msgParts.join(" · "),
    actions: [{ titre: "Voir équipements à risque", href: "/m/equipements?filter=a_risque" }],
  };
}

// ─── API publique ───────────────────────────────────────────────────────

export function computeComplianceScore(input: {
  equipementsWithStatus: EquipementWithStatus[];
  rawEquipements: StoredEquipement[];
  interventions: StoredIntervention[];
  diagnostics: StoredDiagnostic[];
  profil: Profil;
}): ComplianceScore {
  const { equipementsWithStatus, rawEquipements, interventions, diagnostics, profil } = input;

  // Parc completement vide : on retourne 100/100 neutre (rien a juger) mais
  // on flag parcVide pour que l'UI affiche un message "parc en cours de
  // constitution" au lieu d'un score vert trompeur.
  if (rawEquipements.length === 0 && interventions.length === 0) {
    return {
      total: 100,
      color: "neutral",
      label: "Parc en cours de constitution",
      categories: [],
      parcVide: true,
    };
  }

  const categories: ScoreCategory[] = [
    scoreControlesEtancheite(equipementsWithStatus),
    scoreBsffComplets(interventions),
    scoreSignaturesCerfa(interventions),
    scoreFluidesPhaseOut(rawEquipements),
    scoreAttestation(profil),
    scoreSignauxPredictifs(rawEquipements, interventions, diagnostics),
  ];

  const totalObtenu = categories.reduce((s, c) => s + c.obtenu, 0);
  const totalMax = categories.reduce((s, c) => s + c.max, 0);
  // totalMax doit etre = 100 (30+20+20+15+10+5)
  const total = Math.round((totalObtenu / totalMax) * 100);
  const color: ScoreColor = total >= 85 ? "green" : total >= 60 ? "orange" : "red";

  const label = total >= 85
    ? "Conformité au top"
    : total >= 60
      ? "Quelques points à corriger"
      : "Conformité dégradée — risque DREAL";

  return { total, color, label, categories, parcVide: false };
}

/** Styles centralises pour cohérence visuelle entre badge et drawer. */
export const SCORE_COLOR_STYLES: Record<ScoreColor, { bg: string; ring: string; text: string; dot: string; dotPulse: boolean }> = {
  green: { bg: "bg-emerald-50", ring: "ring-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500", dotPulse: false },
  orange: { bg: "bg-orange-50", ring: "ring-orange-200", text: "text-orange-700", dot: "bg-orange-500", dotPulse: false },
  red: { bg: "bg-red-50", ring: "ring-red-200", text: "text-red-700", dot: "bg-red-600", dotPulse: true },
  neutral: { bg: "bg-black/[0.04]", ring: "ring-black/[0.06]", text: "text-black/55", dot: "bg-black/30", dotPulse: false },
};
