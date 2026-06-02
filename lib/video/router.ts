/**
 * Video Engine Router — orchestration multi-vendor avec auto-select.
 *
 * Logique de décision :
 *  1. Si `hint` explicite (depuis brief.featured_products[].video_engine_hint) → priorité absolue
 *  2. Sinon, auto-select selon mood tag (déduit du brief.creative_direction.mood)
 *  3. Filtre par budgetTier (free = hailuo only, paid = kling/runway, premium = veo)
 *  4. Exclusion des engines down (rate limit, API key absente)
 *  5. Génère une cascade fallback : primary → fallback1 → fallback2
 *
 * Si ALL engines fail → throw avec liste des erreurs.
 *
 * Marketing punchline activée : "Vertxia choisit automatiquement le meilleur
 * modèle vidéo IA pour ton mood — Kling, Runway, Hailuo, Veo, Higgsfield."
 */

import type {
  VideoEngine,
  EngineName,
  EngineGenerateInput,
  EngineGenerateOutput,
  RouterOptions,
  RouterDecision,
  MoodTag,
} from "./types";

import { klingEngine } from "./engines/kling";
import { hailuoEngine } from "./engines/hailuo";
import { runwayEngine } from "./engines/runway";
import { higgsfieldEngine } from "./engines/higgsfield";
import { veoEngine } from "./engines/veo";

/* =========================================================
 *  Registry — 5 engines (S2 V1.1, 30/05/2026)
 * ========================================================= */

const REGISTRY: Record<EngineName, VideoEngine> = {
  kling: klingEngine,           // cinematic luxe, $0.30/5s, Replicate
  hailuo: hailuoEngine,         // volume cheap, $0.15/5s, Replicate
  runway: runwayEngine,         // mouvement complex, $0.50/5s, Replicate
  higgsfield: higgsfieldEngine, // narrative cinematic, $0.50/5s, API direct
  veo: veoEngine,               // photoréalisme top, $1.50/5s, Replicate (premium tier)
};

const TIER_ALLOWED: Record<"free" | "paid" | "premium", ReadonlyArray<EngineName>> = {
  free: ["hailuo"],
  paid: ["kling", "hailuo", "runway"],
  premium: ["kling", "hailuo", "runway", "higgsfield", "veo"],
};

/* =========================================================
 *  Mood deduction
 * ========================================================= */

/**
 * Déduit un MoodTag depuis le mood string libre du brief.
 * Heuristique simple : matche mots-clés.
 */
export function deduceMoodTag(moodStr: string): MoodTag {
  const s = moodStr.toLowerCase();

  if (/(sport|action|run|gym|movement|kinetic|fast|dynamic|race)/.test(s)) {
    return "complex_motion";
  }
  if (/(brutalist|tech|industrial|dark|noir|cyber|matrix)/.test(s)) {
    return "tech_brutalist";
  }
  if (/(outdoor|mountain|nature|craft|heritage|wild|wood|earth|organic|farm)/.test(s)) {
    return "outdoor_organic";
  }
  if (/(pop|punchy|saturé|colorful|joyful|fanzine|maximalist|fun|playful)/.test(s)) {
    return "pop_punchy";
  }
  if (/(documentary|story|narrative|long-form|essay|article)/.test(s)) {
    return "narrative_story";
  }
  if (/(photoreal|hyperreal|cinematic real)/.test(s)) {
    return "photorealism";
  }
  // Default : luxe minimaliste
  return "cinematic_luxe";
}

/* =========================================================
 *  Decision logic
 * ========================================================= */

export function decideEngine(opts: RouterOptions = {}): RouterDecision {
  const exclude = new Set(opts.exclude || []);
  const tier = opts.budgetTier ?? "paid";
  const allowed = TIER_ALLOWED[tier].filter((e) => !exclude.has(e));

  // 1. Hint explicite — priorité
  if (opts.hint && allowed.includes(opts.hint) && REGISTRY[opts.hint].isAvailable()) {
    return {
      primary: opts.hint,
      fallbacks: buildFallbackCascade(opts.hint, allowed),
      reason: `hint explicite "${opts.hint}" depuis brief`,
    };
  }

  // 2. Auto-select selon mood
  const mood: MoodTag = opts.mood ?? "cinematic_luxe";
  const matchedByMood = allowed
    .filter((name) => REGISTRY[name].bestFor.includes(mood))
    .filter((name) => REGISTRY[name].isAvailable());

  if (matchedByMood.length > 0) {
    // Trier par cost croissant (plus cheap d'abord parmi ceux qui matchent le mood)
    matchedByMood.sort((a, b) => REGISTRY[a].costPer5s - REGISTRY[b].costPer5s);
    const primary = matchedByMood[0];
    return {
      primary,
      fallbacks: buildFallbackCascade(primary, allowed),
      reason: `auto-select mood "${mood}" → "${primary}" (cheapest of ${matchedByMood.length} matching)`,
    };
  }

  // 3. Fallback final : engine le moins cher dispo
  const availableSorted = allowed
    .filter((name) => REGISTRY[name].isAvailable())
    .sort((a, b) => REGISTRY[a].costPer5s - REGISTRY[b].costPer5s);

  if (availableSorted.length === 0) {
    throw new Error(
      `No video engine available (excluded=${[...exclude].join(",")}, tier=${tier})`
    );
  }

  const primary = availableSorted[0];
  return {
    primary,
    fallbacks: availableSorted.slice(1),
    reason: `no engine matches mood "${mood}", fallback cheapest available`,
  };
}

function buildFallbackCascade(
  primary: EngineName,
  allowed: ReadonlyArray<EngineName>
): ReadonlyArray<EngineName> {
  // Fallbacks = tous les autres engines allowed et available, triés par cost
  return allowed
    .filter((e) => e !== primary)
    .filter((e) => REGISTRY[e].isAvailable())
    .sort((a, b) => REGISTRY[a].costPer5s - REGISTRY[b].costPer5s);
}

/* =========================================================
 *  Public API : router.dispatch()
 * ========================================================= */

export type DispatchResult = EngineGenerateOutput & {
  decision: RouterDecision;
  attempts: Array<{ engine: EngineName; success: boolean; error?: string }>;
};

export async function dispatch(
  input: EngineGenerateInput,
  opts: RouterOptions = {}
): Promise<DispatchResult> {
  const decision = decideEngine(opts);
  const cascade = [decision.primary, ...decision.fallbacks];
  const attempts: Array<{ engine: EngineName; success: boolean; error?: string }> = [];

  for (const engineName of cascade) {
    const engine = REGISTRY[engineName];
    try {
      const result = await engine.generate(input);
      attempts.push({ engine: engineName, success: true });
      return { ...result, decision, attempts };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      attempts.push({ engine: engineName, success: false, error: msg });
      // eslint-disable-next-line no-console
      console.warn(`[video-router] ${engineName} fail for ${input.handle}: ${msg}`);
    }
  }

  throw new Error(
    `All video engines failed for ${input.handle}. Attempts: ${attempts
      .map((a) => `${a.engine}=${a.success ? "OK" : "FAIL"}`)
      .join(", ")}`
  );
}

/* =========================================================
 *  Exports
 * ========================================================= */

export { REGISTRY as ENGINE_REGISTRY };
