// Detection de la marque depuis une chaine modele libre (ex: "Daikin RXYSQ4T",
// "Saunier-Duval Themaplus", "MITSUBISHI MSZ-EF35VEW"). Renvoie le slug marque
// canonique + le modele "nettoye" (sans la marque devant).
//
// Utilise par la fiche equipement pour deep-link vers /m/codes-erreur avec
// ?marque=...&modele=... pre-rempli.

import type { CodeErreurMarque } from "./types";

// Map nom commercial (lowercase, sans tirets) -> slug canonique.
// Les variantes courantes sont listees pour matcher ce que les techs tapent.
const MARQUE_ALIASES: Record<string, CodeErreurMarque> = {
  daikin: "daikin",
  mitsubishi: "mitsubishi",
  mitsubishielectric: "mitsubishi",
  me: "mitsubishi",
  mitsubishiheavy: "mitsubishi-heavy",
  mitsubishiheavyindustries: "mitsubishi-heavy",
  mhi: "mitsubishi-heavy",
  carrier: "carrier",
  trane: "trane",
  lg: "lg",
  samsung: "samsung",
  toshiba: "toshiba",
  hitachi: "hitachi",
  panasonic: "panasonic",
  atlantic: "atlantic",
  saunierduval: "saunier-duval",
  saunier: "saunier-duval",
  vaillant: "vaillant",
  dedietrich: "de-dietrich",
  dietrich: "de-dietrich",
  elmleblanc: "elm-leblanc",
  elm: "elm-leblanc",
  leblanc: "elm-leblanc",
  frisquet: "frisquet",
  fujitsu: "fujitsu",
  fujitsugeneral: "fujitsu",
  general: "fujitsu",
  bosch: "bosch",
  buderus: "bosch",
  chaffoteaux: "chaffoteaux",
  ariston: "chaffoteaux",
  stiebel: "stiebel-eltron",
  stiebeleltron: "stiebel-eltron",
  // v3 — nouvelles marques (07/06/2026)
  aldes: "aldes",
  tflow: "aldes",
  unelvent: "unelvent",
  zehnder: "zehnder",
  comfoair: "zehnder",
  lennox: "lennox",
  york: "york",
  johnsoncontrols: "york",
  jci: "york",
  aermec: "aermec",
  haier: "haier",
  sanyo: "sanyo",
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s\-_./]+/g, "")
    .trim();
}

export type DetectedMarque = {
  /** Slug marque canonique, null si non identifiable. */
  marque: CodeErreurMarque | null;
  /** Modele nettoye (sans le prefixe marque) — ou string original si non detecte. */
  modeleClean: string;
};

/** Detecte la marque depuis une chaine libre du type "Daikin RXYSQ4T9V1B".
 *
 *  Strategie :
 *  1. Split sur espaces / tirets
 *  2. Tester les 1, 2 puis 3 premiers tokens fusionnes contre MARQUE_ALIASES
 *     (pour rattraper "Saunier Duval", "Mitsubishi Electric", etc.)
 *  3. Si match : retirer ces tokens du modele, garder le reste
 *  4. Si pas de match : marque null, modele = chaine originale
 */
export function detectMarqueFromModele(input: string): DetectedMarque {
  const raw = (input ?? "").trim();
  if (raw.length === 0) return { marque: null, modeleClean: "" };

  const tokens = raw.split(/[\s]+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return { marque: null, modeleClean: raw };

  // Tester en commencant par le plus long (3 tokens) pour favoriser
  // "Saunier Duval" sur "Saunier" seul, "Mitsubishi Heavy Industries" sur
  // "Mitsubishi" seul, etc.
  for (let len = Math.min(3, tokens.length); len >= 1; len--) {
    const prefix = tokens.slice(0, len).join("");
    const key = normalize(prefix);
    const slug = MARQUE_ALIASES[key];
    if (slug) {
      const rest = tokens.slice(len).join(" ").trim();
      return { marque: slug, modeleClean: rest.length > 0 ? rest : raw };
    }
  }

  return { marque: null, modeleClean: raw };
}
