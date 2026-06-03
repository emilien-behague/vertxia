/**
 * Video Engine Router — types partagés.
 *
 * Architecture modulaire :
 *  - Chaque engine implemente `VideoEngine` interface
 *  - Le `VideoRouter` choisit l'engine selon : hint + mood + budget tier
 *  - Fallback en cascade si engine choisi échoue
 *
 * Engines supportés :
 *  - kling      : cinematic luxe, $0.30 / 5s, via Replicate
 *  - hailuo     : volume cheap, $0.10-0.20 / 5s, via Replicate
 *  - runway     : mouvement complex, $0.50 / 5s, via Replicate
 *  - higgsfield : cinematic narrative, $0.50 / 5s, via API direct (V1)
 *  - veo        : photoréalisme top, $1-2 / 5s, via Vertex AI (V2)
 */

export type EngineName = "kling" | "hailuo" | "runway" | "higgsfield" | "veo";

export type EngineGenerateInput = {
  prompt: string;
  startImageUrl: string;
  durationSec: number;
  slug: string;
  handle: string;
};

export type EngineGenerateOutput = {
  /** URL locale servable (ex: /lite/videos/{slug}/{handle}.mp4) */
  localUrl: string;
  /** Engine effectivement utilisé (peut différer du hint si fallback) */
  engine: EngineName;
  /** Coût estimé en USD pour cette génération */
  costUsd: number;
  /** Temps total de génération en secondes */
  generationSec: number;
};

export interface VideoEngine {
  name: EngineName;
  /** Coût indicatif par 5s vidéo, en USD */
  costPer5s: number;
  /** Le mood pour lequel cet engine excelle (utilisé par auto-select) */
  bestFor: ReadonlyArray<MoodTag>;
  /** Génère la vidéo et retourne l'URL locale */
  generate(input: EngineGenerateInput): Promise<EngineGenerateOutput>;
  /** Vérifie que l'env est OK (clé API présente) */
  isAvailable(): boolean;
}

export type MoodTag =
  | "cinematic_luxe"      // luxe minimaliste, premium
  | "narrative_story"      // documentaire, heritage
  | "pop_punchy"          // saturé, énergique
  | "tech_brutalist"      // dark, performance
  | "outdoor_organic"     // nature, craft
  | "complex_motion"      // sport, action, mouvement camera
  | "photorealism"        // réalisme maximal
  | "volume_cheap";       // bulk generation, budget tight

export type RouterOptions = {
  /** Hint explicite dans le brief (video_engine_hint) — priorité absolue */
  hint?: EngineName;
  /** Tag de mood déduit du brief.creative_direction (pour auto-select) */
  mood?: MoodTag;
  /** Budget tier : free = hailuo only, paid = kling/runway, premium = veo */
  budgetTier?: "free" | "paid" | "premium";
  /** Liste d'engines à exclure (rate limit / API down) */
  exclude?: ReadonlyArray<EngineName>;
};

export type RouterDecision = {
  primary: EngineName;
  fallbacks: ReadonlyArray<EngineName>;
  reason: string;
};
