// Memoire contextuelle Vertxia — apprend des patterns du pro et de ses clients
// pour enrichir les diagnostics IA, suggerer des pre-remplissages, et eviter
// au pro de "redecouvrir" un equipement qu'il a deja vu.
//
// Brief Vertxia : "L'IA apprend des patterns du pro et de ses clients
// (memoire contextuelle)". Track A (sans embeddings) — on filtre l'historique
// deja stocke par criteres structures (n° serie, modele, fluide, composant
// identifie, gravite). Aucune nouvelle stack technique (Voyage AI / pgvector
// arriveront en V2 pour le RAG semantique).
//
// Principe : tout ce qui est utile DEJA stocke localement (interventions +
// diagnostics + equipements scopes par user_id) → filtre intelligent →
// blocs "Tu as deja vu" en UI + texte de contexte injecte dans les prompts
// Claude pour enrichir les analyses.

import type { StoredIntervention } from "@/lib/intervention/intervention-storage";
import type { StoredDiagnostic } from "@/lib/intervention/diagnostic-storage";
import type { StoredEquipement } from "@/lib/equipement/equipement";
import type { DefautGravite } from "@/lib/intervention/vision-diagnostic";

export type SimilarPastDiagnostic = {
  id: string;
  createdAt: string;
  composant: string;
  defautsNoms: string[];
  graviteMax: DefautGravite | null;
  contexteNote?: string;
  /** Score de similarite [0..1] — plus haut = plus pertinent */
  matchScore: number;
  /** Raison du match pour explicabilite UI */
  matchReason: string;
};

export type PastInterventionOnEquipement = {
  id: string;
  createdAt: string;
  typeIntervention: string;
  typeLabel: string;
  weight: number;
  fluideCode: string;
  notes?: string;
  detenteurName?: string;
  detenteurQuality?: string;
};

export type SimilarEquipement = {
  id: string;
  modele: string;
  clientName: string;
  fluideCode: string;
  chargeKg: number;
  /** Combien d'interventions ont ete faites sur celui-ci dans le parc */
  interventionsCount: number;
};

export type DefautRecurrent = {
  composant: string;
  defautNom: string;
  occurrences: number;
  gravitePlusHaute: DefautGravite;
};

export type ContextMemory = {
  /** Diagnostics passes du meme composant OU contexte text similaire */
  similarPastDiagnostics: SimilarPastDiagnostic[];
  /** Interventions deja realisees sur le meme n° de serie (chronologique desc) */
  pastInterventionsOnSameEquipement: PastInterventionOnEquipement[];
  /** Equipements du parc avec le meme modele (pour cross-reference) */
  similarEquipementsInPark: SimilarEquipement[];
  /** Patterns recurrents : memes composants + defauts vus plusieurs fois */
  recurringDefauts: DefautRecurrent[];
  /** Resume textuel ready-to-inject dans un prompt LLM. Vide si aucun
   *  contexte pertinent trouve. */
  formattedForPrompt: string;
};

const GRAVITE_ORDER: Record<DefautGravite, number> = {
  critique: 0,
  urgent: 1,
  surveiller: 2,
  info: 3,
};

const TYPE_INTERVENTION_LABELS: Record<string, string> = {
  recuperation: "Recuperation",
  demantelement: "Demantelement",
  controle_periodique: "Controle d'etancheite",
  controle_non_periodique: "Controle suite fuite",
  mise_service: "Mise en service",
  maintenance: "Maintenance",
  assemblage: "Assemblage",
  modification: "Modification",
};

function fmtDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function maxGraviteOf(diag: StoredDiagnostic): DefautGravite | null {
  if (diag.result.defautsDetectes.length === 0) return null;
  const order: DefautGravite[] = ["critique", "urgent", "surveiller", "info"];
  for (const g of order) {
    if (diag.result.defautsDetectes.some((d) => d.gravite === g)) return g;
  }
  return null;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // retire accents
      .split(/[^a-z0-9-]+/)
      .filter((t) => t.length >= 3) // ignore stopwords courts
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return intersection / union;
}

// ─── Recherche de diagnostics passes similaires ────────────────────────
//
// Critere 1 (le plus fort) : composant identifie identique (case-insensitive,
// match sur les 8 premiers chars pour tolerer "Compresseur scroll" vs
// "Compresseur scroll hermetique").
//
// Critere 2 : similarite Jaccard sur les tokens (composant + contexte +
// noms de defauts). Seuil 0.15 pour conserver une marge.
//
// Retourne top 5 trie par score decroissant.

function findSimilarPastDiagnostics(
  current: { composant?: string | null; contexteNote?: string },
  allDiagnostics: StoredDiagnostic[]
): SimilarPastDiagnostic[] {
  const currentComposant = (current.composant ?? "").toLowerCase().trim();
  const currentTokens = tokenize(
    `${current.composant ?? ""} ${current.contexteNote ?? ""}`
  );

  const candidates: SimilarPastDiagnostic[] = [];

  for (const d of allDiagnostics) {
    const composant = (d.result.composantIdentifie ?? "").toLowerCase().trim();
    if (!composant) continue;

    // Score base sur match composant
    let score = 0;
    let reason = "";

    if (currentComposant && composant === currentComposant) {
      score = 1.0;
      reason = "Meme composant identifie";
    } else if (
      currentComposant &&
      composant.length >= 8 &&
      currentComposant.length >= 8 &&
      (composant.startsWith(currentComposant.slice(0, 8)) ||
        currentComposant.startsWith(composant.slice(0, 8)))
    ) {
      score = 0.8;
      reason = "Composant similaire";
    } else {
      const pastTokens = tokenize(
        `${d.result.composantIdentifie ?? ""} ${d.contexteNote ?? ""} ${d.result.defautsDetectes.map((x) => x.nom).join(" ")}`
      );
      const jaccard = jaccardSimilarity(currentTokens, pastTokens);
      if (jaccard >= 0.15) {
        score = jaccard;
        reason = "Contexte similaire";
      } else {
        continue;
      }
    }

    candidates.push({
      id: d.id,
      createdAt: d.createdAt,
      composant: d.result.composantIdentifie ?? "Composant",
      defautsNoms: d.result.defautsDetectes.map((x) => x.nom),
      graviteMax: maxGraviteOf(d),
      contexteNote: d.contexteNote,
      matchScore: score,
      matchReason: reason,
    });
  }

  candidates.sort((a, b) => {
    if (Math.abs(a.matchScore - b.matchScore) > 0.01) {
      return b.matchScore - a.matchScore;
    }
    return b.createdAt.localeCompare(a.createdAt); // tie-break : plus recent
  });

  return candidates.slice(0, 5);
}

// ─── Interventions deja realisees sur le meme n° de serie ──────────────

function findPastInterventionsOnEquipement(
  numeroSerie: string | undefined,
  allInterventions: StoredIntervention[]
): PastInterventionOnEquipement[] {
  if (!numeroSerie) return [];
  const target = numeroSerie.toLowerCase().trim();
  return allInterventions
    .filter((i) => i.numeroSerieEquipement?.toLowerCase().trim() === target)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((i) => ({
      id: i.id,
      createdAt: i.createdAt,
      typeIntervention: i.typeIntervention,
      typeLabel: TYPE_INTERVENTION_LABELS[i.typeIntervention] ?? i.typeIntervention,
      weight: i.weight,
      fluideCode: i.fluide.code,
      notes: i.notes,
      detenteurName: i.detenteurName,
      detenteurQuality: i.detenteurQuality,
    }));
}

// ─── Equipements similaires du parc (meme modele) ─────────────────────

function findSimilarEquipementsInPark(
  currentModele: string | undefined,
  currentId: string | undefined,
  allEquipements: StoredEquipement[],
  allInterventions: StoredIntervention[]
): SimilarEquipement[] {
  if (!currentModele) return [];
  const modeleSlug = currentModele.toLowerCase().trim();
  // Compte interventions par n° serie
  const counts = new Map<string, number>();
  for (const i of allInterventions) {
    if (i.numeroSerieEquipement) {
      const key = i.numeroSerieEquipement.toLowerCase().trim();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return allEquipements
    .filter((eq) => {
      if (currentId && eq.id === currentId) return false;
      const candidateSlug = eq.modele.toLowerCase().trim();
      // Match exact, ou prefix sur 6 chars (tolerance modeles type SCM-XXX)
      if (candidateSlug === modeleSlug) return true;
      if (modeleSlug.length >= 6 && candidateSlug.includes(modeleSlug.slice(0, 6))) return true;
      if (candidateSlug.length >= 6 && modeleSlug.includes(candidateSlug.slice(0, 6))) return true;
      return false;
    })
    .map((eq) => ({
      id: eq.id,
      modele: eq.modele,
      clientName: eq.clientName,
      fluideCode: eq.fluide.code,
      chargeKg: eq.chargeKg,
      interventionsCount: counts.get(eq.numeroSerie.toLowerCase().trim()) ?? 0,
    }))
    .sort((a, b) => b.interventionsCount - a.interventionsCount)
    .slice(0, 10);
}

// ─── Defauts recurrents (composant + defaut vus 2+ fois) ───────────────

function findRecurringDefauts(
  allDiagnostics: StoredDiagnostic[]
): DefautRecurrent[] {
  type Bucket = { occurrences: number; gravites: DefautGravite[] };
  const map = new Map<string, Bucket>();
  for (const d of allDiagnostics) {
    const composant = d.result.composantIdentifie?.toLowerCase().trim() ?? "?";
    for (const def of d.result.defautsDetectes) {
      const key = `${composant}::${def.nom.toLowerCase().trim()}`;
      const prev = map.get(key);
      if (prev) {
        prev.occurrences++;
        prev.gravites.push(def.gravite);
      } else {
        map.set(key, { occurrences: 1, gravites: [def.gravite] });
      }
    }
  }

  const out: DefautRecurrent[] = [];
  for (const [key, bucket] of map.entries()) {
    if (bucket.occurrences < 2) continue;
    const [composant, defautNom] = key.split("::");
    const gravitePlusHaute = bucket.gravites.sort(
      (a, b) => GRAVITE_ORDER[a] - GRAVITE_ORDER[b]
    )[0];
    out.push({
      composant,
      defautNom,
      occurrences: bucket.occurrences,
      gravitePlusHaute,
    });
  }

  out.sort((a, b) => {
    const g = GRAVITE_ORDER[a.gravitePlusHaute] - GRAVITE_ORDER[b.gravitePlusHaute];
    if (g !== 0) return g;
    return b.occurrences - a.occurrences;
  });

  return out.slice(0, 5);
}

// ─── API publique ───────────────────────────────────────────────────────

export type ContextMemoryInput = {
  /** Composant que le pro est en train de diagnostiquer (depuis vision/diagnostic ou note libre) */
  currentComposant?: string | null;
  /** Note libre du pro sur la situation actuelle */
  currentContexteNote?: string;
  /** Equipement concerne (si on est dans un workflow lie a un eq) */
  currentEquipement?: { id?: string; modele?: string; numeroSerie?: string; fluide?: { code: string } };
  /** Historique complet du pro */
  allInterventions: StoredIntervention[];
  allDiagnostics: StoredDiagnostic[];
  allEquipements: StoredEquipement[];
};

export function buildContextMemory(input: ContextMemoryInput): ContextMemory {
  const {
    currentComposant,
    currentContexteNote,
    currentEquipement,
    allInterventions,
    allDiagnostics,
    allEquipements,
  } = input;

  const similarPastDiagnostics = findSimilarPastDiagnostics(
    { composant: currentComposant, contexteNote: currentContexteNote },
    allDiagnostics
  );

  const pastInterventionsOnSameEquipement = findPastInterventionsOnEquipement(
    currentEquipement?.numeroSerie,
    allInterventions
  );

  const similarEquipementsInPark = findSimilarEquipementsInPark(
    currentEquipement?.modele,
    currentEquipement?.id,
    allEquipements,
    allInterventions
  );

  const recurringDefauts = findRecurringDefauts(allDiagnostics);

  // Texte ready-to-inject dans prompt LLM. Si rien de pertinent → string vide,
  // l'API caller peut conditionner facilement avec `if (ctx.formattedForPrompt) ...`.
  const lines: string[] = [];

  if (pastInterventionsOnSameEquipement.length > 0) {
    lines.push(
      `## Historique sur ce meme equipement (n° de serie identique)`
    );
    for (const i of pastInterventionsOnSameEquipement.slice(0, 3)) {
      const w = i.weight > 0 ? `, ${i.weight.toFixed(2)} kg ${i.fluideCode}` : "";
      const notes = i.notes ? ` — Notes: ${i.notes.slice(0, 120)}` : "";
      lines.push(`- ${fmtDateShort(i.createdAt)} : ${i.typeLabel}${w}${notes}`);
    }
  }

  if (similarPastDiagnostics.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push(`## Diagnostics passes similaires sur le parc du pro`);
    for (const d of similarPastDiagnostics.slice(0, 3)) {
      const defauts = d.defautsNoms.slice(0, 3).join(", ") || "Aucun defaut";
      const grav = d.graviteMax ? ` [gravite max: ${d.graviteMax}]` : "";
      lines.push(
        `- ${fmtDateShort(d.createdAt)} sur "${d.composant}" — defauts: ${defauts}${grav} (match: ${d.matchReason})`
      );
    }
  }

  if (recurringDefauts.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push(`## Defauts recurrents observes dans le parc de ce pro`);
    for (const r of recurringDefauts.slice(0, 3)) {
      lines.push(
        `- "${r.defautNom}" sur ${r.composant}, vu ${r.occurrences}× (gravite max: ${r.gravitePlusHaute})`
      );
    }
  }

  if (similarEquipementsInPark.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push(`## Equipements similaires (meme modele) dans le parc`);
    for (const eq of similarEquipementsInPark.slice(0, 3)) {
      lines.push(
        `- "${eq.modele}" chez ${eq.clientName} (${eq.chargeKg} kg ${eq.fluideCode}, ${eq.interventionsCount} interventions enregistrees)`
      );
    }
  }

  const formattedForPrompt = lines.length > 0
    ? `${lines.join("\n")}

Utilise ce contexte pour affiner ton analyse : si tu detectes un defaut deja vu precedemment sur ce composant ou cet equipement, cite-le explicitement et indique s'il s'aggrave/se confirme/se resout. Si un defaut recurrent du parc est present sur cette photo, mentionne-le comme pattern connu du pro.`
    : "";

  return {
    similarPastDiagnostics,
    pastInterventionsOnSameEquipement,
    similarEquipementsInPark,
    recurringDefauts,
    formattedForPrompt,
  };
}

/** Helper synchrone pour les composants UI qui ont deja les listes en main. */
export function buildContextMemoryFromCurrentState(
  current: {
    composant?: string | null;
    contexteNote?: string;
    equipement?: { id?: string; modele?: string; numeroSerie?: string; fluide?: { code: string } };
  },
  data: {
    interventions: StoredIntervention[];
    diagnostics: StoredDiagnostic[];
    equipements: StoredEquipement[];
  }
): ContextMemory {
  return buildContextMemory({
    currentComposant: current.composant ?? null,
    currentContexteNote: current.contexteNote,
    currentEquipement: current.equipement,
    allInterventions: data.interventions,
    allDiagnostics: data.diagnostics,
    allEquipements: data.equipements,
  });
}
