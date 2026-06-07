// Moteur de recherche pour la base de codes erreur.
//
// Strategie de match (en cascade) :
//  1. EXACT — code identique apres normalisation (uppercase, sans espace)
//  2. PREFIX — le code commence par la query (ex: "U" → U0, U2, U4...)
//  3. CONTAINS — le code OU le libelle contient la query
//  4. FUZZY — distance Levenshtein <= 2 sur le code (typo tolerance)
//
// Filtre marque optionnel : si fourni, restreint a une seule marque.
// Filtre gravite optionnel : si fourni, restreint a "critique" / "alerte" / "info".
//
// Tri : score decroissant, puis ordre alphabetique du code.

import {
  CODES_ERREUR_DATABASE,
  CODES_ERREUR_COUNT_BY_MARQUE,
} from "./database";
import type {
  CodeErreur,
  CodeErreurGravite,
  CodeErreurMarque,
  CodeErreurSearchHit,
} from "./types";

function normalizeCode(s: string): string {
  return s.toUpperCase().replace(/\s+/g, "").trim();
}

function normalizeModele(s: string): string {
  // Modeles constructeur : uppercase, sans espaces, sans tirets/slashes parasites.
  // Ex: "rxysq 4t/9v-1b" → "RXYSQ4T9V1B"
  return s.toUpperCase().replace(/[\s\-/_.]+/g, "").trim();
}

/** Match prefix bidirectionnel : un code "matche" un modele cible si AU MOINS
 *  un de ses prefixes/famille est compatible. Si le code n'a pas de modeles[]
 *  defini, on considere qu'il s'applique a toute la marque (= match permissif). */
export function codeMatchesModele(
  modelesDuCode: string[] | undefined,
  modeleQuery: string
): boolean {
  const q = normalizeModele(modeleQuery);
  if (q.length === 0) return true;
  if (!modelesDuCode || modelesDuCode.length === 0) return true;
  return modelesDuCode.some((m) => {
    const mn = normalizeModele(m);
    if (mn.length === 0) return false;
    return mn.startsWith(q) || q.startsWith(mn);
  });
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Distance de Levenshtein bornee a 3 (early exit). */
function levenshteinBounded(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;

  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let minRow = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
      if (curr[j] < minRow) minRow = curr[j];
    }
    if (minRow > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export type SearchOptions = {
  marque?: CodeErreurMarque;
  gravite?: CodeErreurGravite;
  /** Reference modele constructeur. Si fourni, on garde uniquement les codes
   *  dont `modeles[]` matche (prefix bidirectionnel) OU qui n'ont pas de
   *  `modeles[]` defini (= codes generiques marque applicables a tout). */
  modele?: string;
  /** Limite du nombre de hits retournes (default 30). */
  limit?: number;
};

/** Recherche dans la base. Query vide = retourne tout (filtre marque/gravite). */
export function searchCodesErreur(
  query: string,
  opts: SearchOptions = {}
): CodeErreurSearchHit[] {
  const { marque, gravite, modele, limit = 30 } = opts;

  let pool = CODES_ERREUR_DATABASE;
  if (marque) pool = pool.filter((c) => c.marque === marque);
  if (gravite) pool = pool.filter((c) => c.gravite === gravite);
  if (modele && modele.trim().length > 0) {
    pool = pool.filter((c) => codeMatchesModele(c.modeles, modele));
  }

  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return pool
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code))
      .slice(0, limit)
      .map((c) => ({ ...c, score: 0, matchType: "exact" as const }));
  }

  const qCode = normalizeCode(trimmed);
  const qText = normalizeText(trimmed);

  const hits: CodeErreurSearchHit[] = [];

  for (const c of pool) {
    const codeNorm = normalizeCode(c.code);
    const libelleNorm = normalizeText(c.libelle);
    const descNorm = normalizeText(c.description);

    // 1. EXACT
    if (codeNorm === qCode) {
      hits.push({ ...c, score: 1.0, matchType: "exact" });
      continue;
    }
    // 2. PREFIX (sur code uniquement, pour favoriser tap rapide)
    if (codeNorm.startsWith(qCode) && qCode.length >= 1) {
      hits.push({ ...c, score: 0.85, matchType: "prefix" });
      continue;
    }
    // 3. CONTAINS sur libelle/description (recherche texte)
    if (qText.length >= 3) {
      if (libelleNorm.includes(qText)) {
        hits.push({ ...c, score: 0.7, matchType: "contains" });
        continue;
      }
      if (descNorm.includes(qText)) {
        hits.push({ ...c, score: 0.55, matchType: "contains" });
        continue;
      }
    }
    // 4. FUZZY sur code (typo tolerance — utile si tech tape "U2" vs "U02")
    if (qCode.length >= 2 && codeNorm.length >= 2) {
      const dist = levenshteinBounded(qCode, codeNorm, 2);
      if (dist <= 2) {
        const score = 0.4 - dist * 0.1;
        hits.push({ ...c, score, matchType: "fuzzy" });
      }
    }
  }

  hits.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.code.localeCompare(b.code);
  });

  return hits.slice(0, limit);
}

/** Trouve un code precis par marque + code exact. Utile pour deep-link. */
export function findCodeErreur(
  marque: CodeErreurMarque,
  code: string
): CodeErreur | null {
  const norm = normalizeCode(code);
  return (
    CODES_ERREUR_DATABASE.find(
      (c) => c.marque === marque && normalizeCode(c.code) === norm
    ) ?? null
  );
}

/** Stats globales — utile pour l'affichage UI / debug. */
export function getCodesErreurStats(): {
  total: number;
  parMarque: Record<string, number>;
} {
  return {
    total: CODES_ERREUR_DATABASE.length,
    parMarque: CODES_ERREUR_COUNT_BY_MARQUE,
  };
}
