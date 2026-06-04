// Maintenance predictive F-Gas — detecte les patterns suspects dans l'historique
// d'un equipement et alerte avant la panne / le sinistre reglementaire.
//
// Vise le brief Vertxia point #10 : "Alerter si un equipement fuit de facon
// recurrente sur plusieurs interventions, avant la panne." Etend aussi aux
// defauts visuels chroniques detectes par le diagnostic IA.
//
// Approche : on regarde uniquement l'historique deja stocke localement
// (interventions + diagnostics scopes par user_id). Aucune dependance cloud.
// Le score s'execute en quelques ms sur du JSON deja en RAM. Conforme north
// star "l'utilisateur ne remplit plus rien" : aucune saisie supplementaire
// requise, l'IA "comprend" l'equipement tout seul a partir de l'historique
// que le pro genere naturellement en travaillant.

import type { StoredIntervention } from "./intervention-storage";
import type { StoredEquipement } from "./equipement";
import type { StoredDiagnostic } from "./diagnostic-storage";

export type SignalGravite = "critique" | "alerte" | "surveillance";

export type SignalPredictif = {
  /** Identifiant stable pour le rendu (key React) */
  id: string;
  /** Titre court (ex: "Fuite recurrente detectee") */
  titre: string;
  /** Explication 1-2 phrases avec chiffres concrets */
  description: string;
  /** Action recommandee concrete pour le technicien */
  actionRecommandee: string;
  gravite: SignalGravite;
  /** Liens vers les preuves dans l'historique (interventions/diagnostics IDs) */
  evidence: {
    interventionIds?: string[];
    diagnosticIds?: string[];
  };
};

/** Ordre de tri des signaux : critique > alerte > surveillance */
const GRAVITE_ORDER: Record<SignalGravite, number> = {
  critique: 0,
  alerte: 1,
  surveillance: 2,
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function monthsBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso);
  const b = new Date(bIso);
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

/** Filtre les interventions liees a un equipement par numero de serie
 *  (idem que la logique deja utilisee dans computeStatus). */
function interventionsDeLEquipement(
  equipement: StoredEquipement,
  interventions: StoredIntervention[]
): StoredIntervention[] {
  const target = equipement.numeroSerie.toLowerCase().trim();
  return interventions
    .filter((i) => i.numeroSerieEquipement?.toLowerCase().trim() === target)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // chronologique asc
}

// ─── Signal 1 : Fuite recurrente ────────────────────────────────────────
//
// Critere : ≥2 interventions de RECUPERATION/recharge dans les 12 derniers
// mois. Une fuite isolee = aleas normal. Une fuite repetee = circuit malade.

function detecterFuiteRecurrente(
  interventionsEq: StoredIntervention[]
): SignalPredictif | null {
  const now = new Date();
  const seuilJours = 365;

  // On compte les interventions "rechargement de fluide" recentes :
  // recuperation (fluide retire pour reparation) + maintenance/modification
  // avec un poids declare > 0 (= une recharge a eu lieu).
  const recharges = interventionsEq.filter((i) => {
    const days = daysBetween(new Date(i.createdAt), now);
    if (days > seuilJours) return false;
    const isRecharge =
      i.typeIntervention === "recuperation" ||
      i.typeIntervention === "maintenance" ||
      i.typeIntervention === "modification";
    return isRecharge && (i.weight ?? 0) > 0;
  });

  if (recharges.length < 2) return null;

  const totalKg = recharges.reduce((s, i) => s + (i.weight ?? 0), 0);
  const moisEntreFirstEtNow =
    monthsBetween(recharges[0].createdAt, new Date().toISOString());

  return {
    id: "fuite-recurrente",
    titre: "Fuite recurrente detectee",
    description: `${recharges.length} interventions de recharge/recuperation en ${Math.max(1, Math.round(moisEntreFirstEtNow))} mois (${totalKg.toFixed(2)} kg cumules). Circuit probablement defaillant.`,
    actionRecommandee:
      "Programmer une recherche de fuite approfondie (azote + savon, detecteur electronique). Tracer le point de fuite et reparer avant la prochaine recharge.",
    gravite: recharges.length >= 3 ? "critique" : "alerte",
    evidence: {
      interventionIds: recharges.map((i) => i.id),
    },
  };
}

// ─── Signal 2 : Charge cumulee excessive ────────────────────────────────
//
// Critere : recharges cumulees > 30% de la charge nominale en 24 mois.
// Au-dela de ce seuil, le pro est en train de "pisser" du fluide dans
// l'atmosphere a chaque visite — risque reglementaire ET financier.

function detecterChargeCumuleeExcessive(
  equipement: StoredEquipement,
  interventionsEq: StoredIntervention[]
): SignalPredictif | null {
  if (equipement.chargeKg <= 0) return null;

  const now = new Date();
  const seuilJours = 730;

  const recharges = interventionsEq.filter((i) => {
    const days = daysBetween(new Date(i.createdAt), now);
    if (days > seuilJours) return false;
    return (
      (i.typeIntervention === "recuperation" ||
        i.typeIntervention === "maintenance" ||
        i.typeIntervention === "modification") &&
      (i.weight ?? 0) > 0
    );
  });

  if (recharges.length === 0) return null;

  const totalKg = recharges.reduce((s, i) => s + (i.weight ?? 0), 0);
  const ratio = totalKg / equipement.chargeKg;

  if (ratio < 0.3) return null;

  const pct = Math.round(ratio * 100);
  const gravite: SignalGravite =
    ratio >= 1.0 ? "critique" : ratio >= 0.5 ? "alerte" : "surveillance";

  return {
    id: "charge-cumulee-excessive",
    titre: `${pct}% de la charge nominale rechargee en 24 mois`,
    description: `${totalKg.toFixed(2)} kg ajoutes sur une charge initiale de ${equipement.chargeKg} kg. Le circuit a perdu ${pct}% de sa charge — non conforme au reglement UE 2024/573 art. 5 (etancheite).`,
    actionRecommandee:
      "Stop aux recharges palliatives. Mettre en place une recherche de fuite reglementaire, reparer, et redocumenter le CERFA. Si fuite irreparable, programmer la depose et le retrofit.",
    gravite,
    evidence: {
      interventionIds: recharges.map((i) => i.id),
    },
  };
}

// ─── Signal 3 : Defaut chronique (vu plusieurs fois en diagnostic IA) ───
//
// Critere : le meme composant + meme nom de defaut apparait dans ≥2
// diagnostics IA distincts. Le composant a un probleme structurel non
// resolu par les reparations precedentes.

function detecterDefautChronique(
  equipement: StoredEquipement,
  diagnostics: StoredDiagnostic[]
): SignalPredictif | null {
  // Les diagnostics ne portent pas encore d'equipementId — pour la V1 on
  // regarde tous les diagnostics du pro et on filtre ceux qui mentionnent
  // le modele de l'equipement dans le contexte ou le composant. C'est
  // imparfait, sera ameliore quand StoredDiagnostic aura un equipementId.

  const modeleMatch = equipement.modele.toLowerCase();
  const diagsCandidat = diagnostics.filter((d) => {
    const haystack = `${d.contexteNote ?? ""} ${d.result.composantIdentifie ?? ""}`.toLowerCase();
    return modeleMatch && haystack.includes(modeleMatch.slice(0, 8));
  });

  if (diagsCandidat.length < 2) return null;

  // Comptage : (composant + nom defaut) -> nb d'occurrences
  const compteur = new Map<string, { count: number; ids: string[]; gravite: string }>();
  for (const d of diagsCandidat) {
    const composant = d.result.composantIdentifie ?? "?";
    for (const def of d.result.defautsDetectes) {
      const key = `${composant}::${def.nom.toLowerCase()}`;
      const prev = compteur.get(key);
      if (prev) {
        prev.count++;
        prev.ids.push(d.id);
      } else {
        compteur.set(key, { count: 1, ids: [d.id], gravite: def.gravite });
      }
    }
  }

  // On garde uniquement les patterns vus ≥2 fois
  const chroniques = Array.from(compteur.entries()).filter(([, v]) => v.count >= 2);
  if (chroniques.length === 0) return null;

  // On prend le pattern le plus eleve en gravite et le plus frequent
  const [worstKey, worst] = chroniques.sort((a, b) => {
    const gravScore: Record<string, number> = { critique: 0, urgent: 1, surveiller: 2, info: 3 };
    const g = (gravScore[a[1].gravite] ?? 4) - (gravScore[b[1].gravite] ?? 4);
    if (g !== 0) return g;
    return b[1].count - a[1].count;
  })[0];

  const [composant, defautNom] = worstKey.split("::");

  return {
    id: "defaut-chronique",
    titre: `Defaut chronique : ${defautNom} sur ${composant}`,
    description: `Detecte ${worst.count} fois en diagnostic IA sur cet equipement (ou un equipement de meme modele). Le composant n'a vraisemblablement pas ete correctement repare lors des interventions precedentes.`,
    actionRecommandee:
      "Remplacer le composant defaillant plutot que de tenter une nieme reparation. Documenter le remplacement dans le CERFA et le rapport client pour acter la resolution.",
    gravite: worst.gravite === "critique" ? "critique" : "alerte",
    evidence: {
      diagnosticIds: worst.ids,
    },
  };
}

// ─── Signal 4 : Equipement avec fluide en phase-out reglementaire ───────
//
// Critere : le fluide installe est en phase-out UE 2024/573. La maintenance
// devient interdite (R-22) ou les rechargements sont restreints (R-404A,
// R-507A). Il faut prevenir le pro avant qu'il rentre dans l'illegalite.

const FLUIDES_PHASE_OUT: Record<
  string,
  {
    statut: "interdit_total" | "interdit_recharge" | "phase_out" | "GWP_eleve";
    detail: string;
    retrofit?: string;
    gravite: SignalGravite;
  }
> = {
  "R-22": {
    statut: "interdit_total",
    detail: "HCFC interdit totalement depuis 2015 (UE 1005/2009). Recharge et maintenance illegales.",
    retrofit: "R-422D, R-407C ou R-407F selon application. Verifier compatibilite huile.",
    gravite: "critique",
  },
  "R-404A": {
    statut: "phase_out",
    detail: "GWP 3922. Interdit dans les equipements neufs depuis 2020 (≥40 tCO2eq). Recharge avec recyclage uniquement.",
    retrofit: "R-449A, R-452A, R-448A. Drop-in possible sur la plupart des installations existantes.",
    gravite: "alerte",
  },
  "R-507A": {
    statut: "phase_out",
    detail: "GWP 3985. Memes restrictions que R-404A.",
    retrofit: "R-449A, R-452A, R-448A.",
    gravite: "alerte",
  },
  "R-410A": {
    statut: "GWP_eleve",
    detail: "GWP 2088. Interdit dans les nouvelles climatisations split monobloc < 3 kg depuis 2025.",
    retrofit: "R-32 sur installations PAC et clim residentielles. Plus de retrofit possible (pression et compresseur differents).",
    gravite: "surveillance",
  },
  "R-134a": {
    statut: "GWP_eleve",
    detail: "GWP 1430. Interdit dans les frigos commerciaux mono-bloc depuis 2022. Maintenance autorisee.",
    retrofit: "R-513A, R-450A, R-1234yf selon application. Penser au remplacement pour les neufs.",
    gravite: "surveillance",
  },
};

function detecterFluidePhaseOut(
  equipement: StoredEquipement
): SignalPredictif | null {
  const code = equipement.fluide.code.toUpperCase().trim();
  const info = FLUIDES_PHASE_OUT[code] ?? FLUIDES_PHASE_OUT[code.replace(/^R/, "R-")];
  if (!info) return null;

  return {
    id: `fluide-phase-out-${code}`,
    titre: `Fluide ${code} concerne par le phase-out`,
    description: info.detail,
    actionRecommandee: info.retrofit
      ? `Proposer un retrofit au client. Alternatives : ${info.retrofit}`
      : "Programmer la depose et le remplacement de l'installation.",
    gravite: info.gravite,
    evidence: {},
  };
}

// ─── Signal 5 : Tendance fuite croissante ───────────────────────────────
//
// Critere : sur les 3 dernieres recharges, la quantite de fluide ajoutee
// augmente strictement. Le circuit "fuit de plus en plus" — la fuite
// progresse, le timing de panne approche.

function detecterTendanceCroissante(
  interventionsEq: StoredIntervention[]
): SignalPredictif | null {
  const recharges = interventionsEq
    .filter(
      (i) =>
        (i.typeIntervention === "recuperation" ||
          i.typeIntervention === "maintenance" ||
          i.typeIntervention === "modification") &&
        (i.weight ?? 0) > 0
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (recharges.length < 3) return null;

  const last3 = recharges.slice(-3);
  const [a, b, c] = [last3[0].weight ?? 0, last3[1].weight ?? 0, last3[2].weight ?? 0];

  // Tendance strictement croissante
  if (!(a < b && b < c)) return null;

  const ratio = c / a;
  if (ratio < 1.5) return null; // tendance trop faible pour alerter

  return {
    id: "tendance-fuite-croissante",
    titre: "Fuite qui s'aggrave",
    description: `Recharges successives : ${a.toFixed(2)} kg → ${b.toFixed(2)} kg → ${c.toFixed(2)} kg. La quantite de fluide perdu augmente a chaque visite (×${ratio.toFixed(1)}).`,
    actionRecommandee:
      "Intervenir AVANT la prochaine alerte client. Localiser et reparer la fuite par recherche reglementaire. Sans reparation, la prochaine recharge sera plus volumineuse et la panne complete approche.",
    gravite: "alerte",
    evidence: {
      interventionIds: last3.map((i) => i.id),
    },
  };
}

// ─── Signal 6 : Equipement jamais controle alors qu'il est sur le terrain ─
//
// Critere : equipement cree > 6 mois sans aucun controle (saisi ou auto).
// On differe du statut "jamais" qui peut etre legitime (eq tout neuf installe
// hier).

function detecterControleJamaisFait(
  equipement: StoredEquipement,
  interventionsEq: StoredIntervention[]
): SignalPredictif | null {
  const age = daysBetween(new Date(equipement.createdAt), new Date());
  if (age < 180) return null;

  const aControle = interventionsEq.some(
    (i) =>
      i.typeIntervention === "controle_periodique" ||
      i.typeIntervention === "controle_non_periodique"
  );
  if (aControle) return null;
  if (equipement.dernierControleISO) return null;

  return {
    id: "controle-jamais-fait",
    titre: "Equipement jamais controle",
    description: `Cree il y a ${Math.floor(age / 30)} mois, aucun controle d'etancheite reglementaire enregistre. Risque d'amende DREAL et de mise en cause de votre attestation de capacite.`,
    actionRecommandee:
      "Programmer un controle d'etancheite initial maintenant. Generer le CERFA 15497*04 + remettre au detenteur.",
    gravite: "alerte",
    evidence: {},
  };
}

/**
 * Calcule TOUS les signaux predictifs sur un equipement. Renvoie une liste
 * triee par gravite (critique > alerte > surveillance). Vide si l'equipement
 * va bien et ne demande aucune intervention preventive.
 */
export function detectPredictiveSignals(
  equipement: StoredEquipement,
  allInterventions: StoredIntervention[],
  allDiagnostics: StoredDiagnostic[] = []
): SignalPredictif[] {
  const interventionsEq = interventionsDeLEquipement(equipement, allInterventions);

  const signals: SignalPredictif[] = [];

  const s1 = detecterFuiteRecurrente(interventionsEq);
  if (s1) signals.push(s1);

  const s2 = detecterChargeCumuleeExcessive(equipement, interventionsEq);
  if (s2) signals.push(s2);

  const s3 = detecterDefautChronique(equipement, allDiagnostics);
  if (s3) signals.push(s3);

  const s4 = detecterFluidePhaseOut(equipement);
  if (s4) signals.push(s4);

  const s5 = detecterTendanceCroissante(interventionsEq);
  if (s5) signals.push(s5);

  const s6 = detecterControleJamaisFait(equipement, interventionsEq);
  if (s6) signals.push(s6);

  signals.sort((a, b) => GRAVITE_ORDER[a.gravite] - GRAVITE_ORDER[b.gravite]);
  return signals;
}

/** Helper de styling pour affichage UI. Garde la palette coherente avec
 *  les autres badges Vertxia (GRAVITE_STYLES dans vision-diagnostic). */
export const SIGNAL_STYLES: Record<
  SignalGravite,
  { bg: string; text: string; ring: string; dot: string; label: string }
> = {
  critique: {
    bg: "bg-red-50",
    text: "text-red-700",
    ring: "ring-red-200",
    dot: "bg-red-600",
    label: "CRITIQUE",
  },
  alerte: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    ring: "ring-orange-200",
    dot: "bg-orange-500",
    label: "ALERTE",
  },
  surveillance: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    ring: "ring-amber-200",
    dot: "bg-amber-500",
    label: "SURVEILLER",
  },
};

/**
 * Pour la vue parc/dashboard : compte le nombre d'equipements qui ont au
 * moins un signal predictif d'alerte ou critique. Surveillance seul ne
 * compte pas (trop bruyant).
 */
export function countEquipementsARisque(
  equipements: StoredEquipement[],
  interventions: StoredIntervention[],
  diagnostics: StoredDiagnostic[] = []
): number {
  let count = 0;
  for (const eq of equipements) {
    const sigs = detectPredictiveSignals(eq, interventions, diagnostics);
    if (sigs.some((s) => s.gravite === "critique" || s.gravite === "alerte")) {
      count++;
    }
  }
  return count;
}
