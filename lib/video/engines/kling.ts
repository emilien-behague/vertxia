/**
 * Engine adapter — Kling v2.1 via Replicate.
 *
 * Caractéristiques :
 *  - Cinematic luxe, minimaliste
 *  - 5 ou 10s (on hard-cap 5s pour cost)
 *  - $0.30 / 5s standard
 *  - Bouche/visages : moyens
 *  - Mouvement camera fluide : top
 */

import Replicate from "replicate";
import type {
  VideoEngine,
  EngineGenerateInput,
  EngineGenerateOutput,
  MoodTag,
} from "../types";
import { downloadVideo, extractReplicateFileUrl } from "../download";

const MODEL_ID = "kwaivgi/kling-v2.1";
const COST_PER_5S = 0.30;
const BEST_FOR: ReadonlyArray<MoodTag> = [
  "cinematic_luxe",
  "narrative_story",
  "outdoor_organic",
];

export const klingEngine: VideoEngine = {
  name: "kling",
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
    const duration = 5; // hard-cap cost

    const output = await replicate.run(MODEL_ID, {
      input: {
        prompt: input.prompt,
        start_image: input.startImageUrl,
        duration,
        negative_prompt: "",
        cfg_scale: 0.5,
      },
    });

    const fileUrl = await extractReplicateFileUrl(output);
    const localUrl = await downloadVideo(fileUrl, input.slug, input.handle);

    return {
      localUrl,
      engine: "kling",
      costUsd: COST_PER_5S,
      generationSec: Math.round((Date.now() - start) / 100) / 10,
    };
  },
};
