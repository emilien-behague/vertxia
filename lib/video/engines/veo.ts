/**
 * Engine adapter — Veo 3 (Google DeepMind) via Replicate.
 *
 * Caractéristiques :
 *  - Photoréalisme top du marché 2026 (depasse Sora pour cinematic)
 *  - $1-2 / 5s (premium tier)
 *  - Bouche/visages : excellent
 *  - Compréhension prompt complexe : excellent
 *  - Audio natif sync (V3 only) : oui
 *  - Idéal pour : finales premium, hero shots agency-tier, demos investor-grade
 *
 * Reserved budget tier "premium" — n'est PAS dans la cascade par défaut paid.
 *
 * Replicate model : google/veo-3 (peut évoluer 2026 vers veo-4)
 * Env : REPLICATE_API_TOKEN (déjà partagé avec Kling/Hailuo/Runway)
 */

import Replicate from "replicate";
import type {
  VideoEngine,
  EngineGenerateInput,
  EngineGenerateOutput,
  MoodTag,
} from "../types";
import { downloadVideo, extractReplicateFileUrl } from "../download";

const MODEL_ID = "google/veo-3";
const COST_PER_5S = 1.50;
const BEST_FOR: ReadonlyArray<MoodTag> = [
  "photorealism",
  "cinematic_luxe",
  "narrative_story",
];

export const veoEngine: VideoEngine = {
  name: "veo",
  costPer5s: COST_PER_5S,
  bestFor: BEST_FOR,

  isAvailable() {
    // Veo via Replicate — meme token que Kling/Hailuo/Runway
    // Mais réservé au tier premium dans le router (TIER_ALLOWED)
    return !!process.env.REPLICATE_API_TOKEN;
  },

  async generate(input: EngineGenerateInput): Promise<EngineGenerateOutput> {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN absent");
    }

    const start = Date.now();
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

    const output = await replicate.run(MODEL_ID, {
      input: {
        prompt: input.prompt,
        image: input.startImageUrl,
        duration_seconds: 5,
        aspect_ratio: "16:9",
        generate_audio: false, // cost cap
      },
    });

    const fileUrl = await extractReplicateFileUrl(output);
    const localUrl = await downloadVideo(fileUrl, input.slug, input.handle);

    return {
      localUrl,
      engine: "veo",
      costUsd: COST_PER_5S,
      generationSec: Math.round((Date.now() - start) / 100) / 10,
    };
  },
};
