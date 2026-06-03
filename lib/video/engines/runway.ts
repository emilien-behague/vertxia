/**
 * Engine adapter — Runway Gen-3 Alpha Turbo via Replicate.
 *
 * Caractéristiques :
 *  - Top du marché pour mouvement complexe (sport, action, transitions)
 *  - $0.50 / 5s
 *  - Bouche/visages : très bon
 *  - Lighting cinematic : excellent
 *  - Idéal pour : sport, action, premium e-comm avec movement
 *
 * NOTE : si Replicate ne sert plus runway via API, fallback Kling ou API runwayml.com direct.
 */

import Replicate from "replicate";
import type {
  VideoEngine,
  EngineGenerateInput,
  EngineGenerateOutput,
  MoodTag,
} from "../types";
import { downloadVideo, extractReplicateFileUrl } from "../download";

// Replicate model ID — peut changer selon disponibilité 2026
const MODEL_ID = "runwayml/gen3a-turbo";
const COST_PER_5S = 0.50;
const BEST_FOR: ReadonlyArray<MoodTag> = [
  "complex_motion",
  "tech_brutalist",
  "cinematic_luxe",
];

export const runwayEngine: VideoEngine = {
  name: "runway",
  costPer5s: COST_PER_5S,
  bestFor: BEST_FOR,

  isAvailable() {
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
        duration: 5,
        ratio: "16:9",
      },
    });

    const fileUrl = await extractReplicateFileUrl(output);
    const localUrl = await downloadVideo(fileUrl, input.slug, input.handle);

    return {
      localUrl,
      engine: "runway",
      costUsd: COST_PER_5S,
      generationSec: Math.round((Date.now() - start) / 100) / 10,
    };
  },
};
