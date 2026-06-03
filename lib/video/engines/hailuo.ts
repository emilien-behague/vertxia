/**
 * Engine adapter — Hailuo (Minimax) via Replicate.
 *
 * Caractéristiques :
 *  - Volume cheap : ~$0.10-0.20 / 5s (2-3x moins cher que Kling)
 *  - Qualité moyenne mais correcte pour preview / bulk generation
 *  - Bouche/visages : faibles
 *  - Mouvement camera : basique
 *  - Idéal pour : free tier, premières previews, fallback budget tight
 */

import Replicate from "replicate";
import type {
  VideoEngine,
  EngineGenerateInput,
  EngineGenerateOutput,
  MoodTag,
} from "../types";
import { downloadVideo, extractReplicateFileUrl } from "../download";

const MODEL_ID = "minimax/hailuo-02";
const COST_PER_5S = 0.15;
const BEST_FOR: ReadonlyArray<MoodTag> = [
  "volume_cheap",
  "pop_punchy",
];

export const hailuoEngine: VideoEngine = {
  name: "hailuo",
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
        first_frame_image: input.startImageUrl,
        prompt_optimizer: true,
        duration: 6, // Hailuo natif 6s
      },
    });

    const fileUrl = await extractReplicateFileUrl(output);
    const localUrl = await downloadVideo(fileUrl, input.slug, input.handle);

    return {
      localUrl,
      engine: "hailuo",
      costUsd: COST_PER_5S,
      generationSec: Math.round((Date.now() - start) / 100) / 10,
    };
  },
};
