/**
 * Engine adapter — Higgsfield AI via API directe.
 *
 * Caractéristiques :
 *  - Cinematic narrative, "Sora-tier" pour les hero shots
 *  - $0.50 / 5s
 *  - Camera moves cinematic dramatiques (dolly, crane, push-in)
 *  - Bouche/visages : très bon
 *  - Idéal pour : cinematic intro hero, b-roll mood, transitions narratives
 *
 * API : https://higgsfield.ai/api (auth Bearer + polling pattern)
 * Env : HIGGSFIELD_API_KEY
 *
 * NOTE : L'API Higgsfield n'est pas publiquement super documentée.
 * Si l'endpoint exact diffère, ajuster les URLs + champs body ici.
 */

import type {
  VideoEngine,
  EngineGenerateInput,
  EngineGenerateOutput,
  MoodTag,
} from "../types";
import { downloadVideo } from "../download";

const API_BASE = "https://api.higgsfield.ai/v1";
const COST_PER_5S = 0.50;
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 60; // 5 min max

const BEST_FOR: ReadonlyArray<MoodTag> = [
  "narrative_story",
  "cinematic_luxe",
  "outdoor_organic",
];

export const higgsfieldEngine: VideoEngine = {
  name: "higgsfield",
  costPer5s: COST_PER_5S,
  bestFor: BEST_FOR,

  isAvailable() {
    return !!process.env.HIGGSFIELD_API_KEY;
  },

  async generate(input: EngineGenerateInput): Promise<EngineGenerateOutput> {
    if (!process.env.HIGGSFIELD_API_KEY) {
      throw new Error("HIGGSFIELD_API_KEY absent");
    }

    const start = Date.now();
    const apiKey = process.env.HIGGSFIELD_API_KEY;

    // 1. POST generation
    const createRes = await fetch(`${API_BASE}/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: input.prompt,
        image_url: input.startImageUrl,
        duration: 5,
        model: "soul-id-v3", // cinematic premium model
        aspect_ratio: "16:9",
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "");
      throw new Error(
        `Higgsfield POST failed HTTP ${createRes.status}: ${errText.slice(0, 200)}`
      );
    }

    const createJson = (await createRes.json()) as { id?: string };
    const generationId = createJson.id;
    if (!generationId) {
      throw new Error(`Higgsfield POST returned no id: ${JSON.stringify(createJson).slice(0, 200)}`);
    }

    // 2. Poll status
    let videoUrl: string | null = null;
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);

      const pollRes = await fetch(`${API_BASE}/generations/${generationId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!pollRes.ok) {
        const errText = await pollRes.text().catch(() => "");
        throw new Error(
          `Higgsfield poll failed HTTP ${pollRes.status}: ${errText.slice(0, 200)}`
        );
      }

      const pollJson = (await pollRes.json()) as {
        status?: string;
        video_url?: string;
        output?: { url?: string };
        error?: string;
      };

      if (pollJson.status === "failed" || pollJson.error) {
        throw new Error(`Higgsfield generation failed: ${pollJson.error || "unknown"}`);
      }

      if (pollJson.status === "completed" || pollJson.status === "succeeded") {
        videoUrl = pollJson.video_url || pollJson.output?.url || null;
        if (videoUrl) break;
      }
    }

    if (!videoUrl) {
      throw new Error(
        `Higgsfield generation timeout after ${MAX_POLL_ATTEMPTS} attempts for ${input.handle}`
      );
    }

    const localUrl = await downloadVideo(videoUrl, input.slug, input.handle);

    return {
      localUrl,
      engine: "higgsfield",
      costUsd: COST_PER_5S,
      generationSec: Math.round((Date.now() - start) / 100) / 10,
    };
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
