/**
 * Analyse le message user pour classifier les intent(s) d'edit Vertxia.
 *
 * Pattern d'Open-Lovable (Firecrawl) edit-intent-analyzer.ts adapte :
 * - Vertxia n'edite pas des fichiers, donc pas de file resolution.
 * - On classifie en N types d'edit possibles + on extract le contexte.
 * - Support multi-intent : un seul message peut declencher 2-3 edits.
 *
 * V1 : UPDATE_PALETTE, UPDATE_COPY, UPDATE_MOOD, UPDATE_SECTION, CHANGE_TEMPLATE.
 */

import type {
  EditIntent,
  EditType,
  BriefSection,
  MultiIntent,
} from "./types";

const PALETTE_KEYWORDS = [
  "palette", "couleur", "couleurs", "color", "colors", "teinte",
  "plus sombre", "plus clair", "darker", "lighter",
  "plus chaud", "plus froid", "warmer", "cooler",
  "plus vif", "plus desature", "plus muted", "plus pastel", "plus contraste",
  "monochrome", "noir et blanc", "black and white", "neutre",
  "dark mode", "light mode",
];

const COPY_KEYWORDS = [
  "headline", "titre", "title", "copy", "texte",
  "manifesto", "manifeste",
  "phrase", "slogan", "tagline",
  "subhead", "subheadline", "sous-titre",
  "reecris", "reecrire", "rewrite",
  "plus court", "plus long", "shorter", "longer",
  "plus direct", "plus poetique", "plus punchy",
  "footer",
  "rends", "change le", "remplace le", "modifie le",
];

const MOOD_KEYWORDS = [
  "mood", "ambiance", "atmosphere", "vibe", "vibration",
  "luxe", "luxury", "premium",
  "tech", "futuriste", "minimaliste", "minimal",
  "rustique", "naturel", "organique", "natural",
  "editorial", "magazine",
  "brutalist", "brut",
  "y2k", "retro", "vintage",
  "sportif", "athletic",
  "feminin", "masculin",
  "energie", "energique", "calme",
];

const TEMPLATE_KEYWORDS = [
  "template", "layout", "structure", "modele", "model",
  "change la structure", "autre template", "autre layout",
  "redesign", "refonte",
  // Verbes d'action declenchant un switch
  "passe en", "switch en", "bascule en", "transforme en",
  // Noms de templates eux-memes (sans le mot "template")
  "magazine editorial", "editorial magazine",
  "brutalist tech", "brutalist", "brut",
  "minimal grid", "minimal",
  "cinematic narrative", "recit cinematique", "cinematique narrative", "cinematique",
  "documentary story", "style documentaire", "documentaire",
  "horizontal slider", "slider horizontal", "slider",
];

const SECTION_NAMES: Array<{ patterns: string[]; section: BriefSection }> = [
  { patterns: ["hero", "haut de page", "premier ecran", "premiere section"], section: "hero" },
  { patterns: ["manifesto", "manifeste", "philosophie"], section: "manifesto" },
  { patterns: ["collection", "catalogue", "produits ensemble"], section: "collection" },
  { patterns: ["process", "demarche", "fabrication", "comment c'est fait"], section: "process" },
  { patterns: ["editorial-close", "closing", "bas de page edito", "conclusion", "ferme"], section: "editorial-close" },
  { patterns: ["footer", "pied de page", "fin de page"], section: "footer" },
  { patterns: ["produit", "products", "items", "articles"], section: "products" },
];

const COLOR_NAMES = [
  "rouge", "red", "bleu", "blue", "vert", "green",
  "jaune", "yellow", "orange",
  "violet", "purple", "rose", "pink",
  "noir", "black", "blanc", "white",
  "gris", "gray", "grey", "marron", "brown", "beige",
  "carmin", "carmine", "indigo", "turquoise",
  "or", "gold", "argent", "silver",
  "ivoire", "ivory", "creme", "cream",
  "sauge", "sage", "olive",
];

const DIRECTION_KEYWORDS: Record<string, string> = {
  "plus sombre": "darker",
  "plus clair": "lighter",
  "darker": "darker",
  "lighter": "lighter",
  "plus chaud": "warmer",
  "plus froid": "cooler",
  "warmer": "warmer",
  "cooler": "cooler",
  "plus vif": "more-saturated",
  "plus desature": "less-saturated",
  "plus muted": "less-saturated",
  "plus pastel": "pastel",
  "plus contraste": "high-contrast",
};

const TONE_SHIFTS: Record<string, string> = {
  "plus court": "shorter",
  "plus long": "longer",
  "shorter": "shorter",
  "longer": "longer",
  "plus direct": "more-direct",
  "plus poetique": "more-poetic",
  "plus punchy": "more-punchy",
  "plus impactant": "more-impactful",
  "plus chaleureux": "warmer-tone",
  "plus froid": "cooler-tone",
  "plus serieux": "more-serious",
  "plus fun": "more-playful",
  "plus premium": "more-premium",
};

const MOOD_KEYWORDS_MAP: Record<string, string> = {
  "luxe": "luxe",
  "luxury": "luxe",
  "premium": "premium",
  "tech": "tech",
  "futuriste": "tech",
  "minimal": "minimal",
  "minimaliste": "minimal",
  "rustique": "natural",
  "naturel": "natural",
  "organique": "natural",
  "natural": "natural",
  "editorial": "editorial",
  "magazine": "editorial",
  "brutalist": "brutalist",
  "brut": "brutalist",
  "y2k": "y2k",
  "retro": "retro",
  "vintage": "retro",
  "sportif": "sportif",
  "athletic": "sportif",
  "calme": "calm",
  "energique": "energetic",
};

/**
 * Detecte un seul intent (le plus probable).
 * Compatible avec l'ancienne signature.
 */
export function analyzeEditIntent(message: string): EditIntent {
  const lower = message.toLowerCase().trim();

  // Order matters : on teste du plus precis au plus large.
  // CHANGE_TEMPLATE (mot "template" + noms de templates + verbes "passe en")
  if (hasAny(lower, TEMPLATE_KEYWORDS)) {
    return {
      type: "CHANGE_TEMPLATE",
      description: `Changement de template : "${message.slice(0, 80)}"`,
      confidence: 0.85,
      extracted: {
        template_hint: extractTemplateHint(lower),
        mood: extractMoodValue(lower),
      },
    };
  }

  // UPDATE_SECTION (section explicite + verbe copy-ish)
  const targetedSection = extractSection(lower);
  if (targetedSection && hasAny(lower, COPY_KEYWORDS)) {
    return {
      type: "UPDATE_SECTION",
      description: `Reecriture de la section ${targetedSection} : "${message.slice(0, 80)}"`,
      confidence: 0.85,
      extracted: {
        section: targetedSection,
        tone_shift: extractToneShift(lower),
        mood: extractMoodValue(lower),
      },
    };
  }

  // UPDATE_MOOD (mood keywords sans demande explicite de copy ou palette)
  if (
    hasAny(lower, MOOD_KEYWORDS) &&
    !hasAny(lower, PALETTE_KEYWORDS) &&
    !hasAny(lower, COPY_KEYWORDS)
  ) {
    return {
      type: "UPDATE_MOOD",
      description: `Changement de mood : "${message.slice(0, 80)}"`,
      confidence: 0.75,
      extracted: {
        mood: extractMoodValue(lower),
        direction: extractDirection(lower),
      },
    };
  }

  // UPDATE_PALETTE
  if (hasAny(lower, PALETTE_KEYWORDS)) {
    return {
      type: "UPDATE_PALETTE",
      description: `Changement de palette : "${message.slice(0, 80)}"`,
      confidence: 0.85,
      extracted: extractPaletteContext(lower),
    };
  }

  // UPDATE_COPY (copy keywords sans section explicite => global)
  if (hasAny(lower, COPY_KEYWORDS)) {
    return {
      type: "UPDATE_COPY",
      description: `Reecriture copy : "${message.slice(0, 80)}"`,
      confidence: 0.75,
      extracted: {
        section: targetedSection ?? "global",
        tone_shift: extractToneShift(lower),
        mood: extractMoodValue(lower),
      },
    };
  }

  return {
    type: "UNKNOWN",
    description: `Intent non reconnu : "${message.slice(0, 80)}"`,
    confidence: 0.1,
    extracted: {},
  };
}

/**
 * Decoupe le message en plusieurs intents si l'user demande plusieurs choses.
 * Pattern Open-Lovable : on detecte des conjonctions ("et", "+", "puis", "aussi").
 */
export function analyzeMultiIntent(message: string): MultiIntent {
  // Heuristique simple : on coupe sur " et ", " + ", " puis ", " aussi ".
  const conjunctions = /\s+(?:et|\+|puis|aussi|en plus|with|and|then)\s+/i;
  const parts = message.split(conjunctions).map((p) => p.trim()).filter(Boolean);

  if (parts.length === 1) {
    return {
      intents: [analyzeEditIntent(message)],
      shouldChain: false,
    };
  }

  // Plusieurs parts => analyse chacune
  const intents = parts.map((part) => analyzeEditIntent(part));
  const validIntents = intents.filter((i) => i.type !== "UNKNOWN");

  if (validIntents.length === 0) {
    return {
      intents: [analyzeEditIntent(message)],
      shouldChain: false,
    };
  }

  return {
    intents: validIntents,
    shouldChain: validIntents.length > 1,
  };
}

// === Helpers ===

function hasAny(lower: string, keywords: string[]): boolean {
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function extractSection(lower: string): BriefSection | undefined {
  for (const { patterns, section } of SECTION_NAMES) {
    if (patterns.some((p) => lower.includes(p))) {
      return section;
    }
  }
  return undefined;
}

function extractDirection(lower: string): string | undefined {
  for (const [keyword, direction] of Object.entries(DIRECTION_KEYWORDS)) {
    if (lower.includes(keyword)) return direction;
  }
  return undefined;
}

function extractToneShift(lower: string): string | undefined {
  for (const [keyword, tone] of Object.entries(TONE_SHIFTS)) {
    if (lower.includes(keyword)) return tone;
  }
  return undefined;
}

function extractMoodValue(lower: string): string | undefined {
  for (const [keyword, mood] of Object.entries(MOOD_KEYWORDS_MAP)) {
    if (lower.includes(keyword)) return mood;
  }
  return undefined;
}

function extractTemplateHint(lower: string): string | undefined {
  if (lower.includes("magazine") || lower.includes("editorial")) return "editorial-magazine";
  if (lower.includes("brutalist") || lower.includes("brut")) return "brutalist-tech";
  if (lower.includes("cinematique") || lower.includes("cinematic") || lower.includes("recit")) return "cinematic-narrative";
  if (lower.includes("documentaire") || lower.includes("documentary")) return "documentary-story";
  if (lower.includes("slider") || lower.includes("horizontal")) return "horizontal-slider";
  if (lower.includes("minimal")) return "minimal-grid";
  return undefined;
}

function extractPaletteContext(lower: string): EditIntent["extracted"] {
  const ctx: EditIntent["extracted"] = {};

  ctx.direction = extractDirection(lower);

  for (const color of COLOR_NAMES) {
    if (lower.includes(color)) {
      ctx.color = color;
      break;
    }
  }

  ctx.mood = extractMoodValue(lower);

  return ctx;
}
