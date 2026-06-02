/**
 * Video generation — etape 3 du pipeline Vertxia Lite.
 *
 * V0.5 : Kling mono-engine via Replicate
 * V0.6 (S2 30/05/2026) : Video Engine Router multi-vendor avec auto-select intelligent
 *   - Engines : kling, hailuo, runway (+ higgsfield, veo en V1)
 *   - Auto-select selon brief.featured_products[].video_engine_hint + mood déduit
 *   - Cascade fallback : si engine fail, essai engine suivant moins cher
 *
 * Sécurité cout :
 *  - DEFAULT max 3 vidéos par job (override via param maxVideos)
 *  - Tier "paid" par defaut (kling/hailuo/runway, pas veo)
 *  - Si pas de REPLICATE_API_TOKEN ou si toutes les vidéos failent : skip silencieux,
 *    le template fallback sur hero_image_url (static product photo)
 *
 * Concurrence : sequentiel (pas de parallel) pour eviter rate limit Replicate.
 */

import type { Brief } from "@/lib/brief";
import type { VideoAsset } from "./types";
import { dispatch as videoDispatch, deduceMoodTag } from "@/lib/video/router";
import type { EngineName, MoodTag } from "@/lib/video/types";

const DEFAULT_MAX_VIDEOS = 3;

/* =========================================================
 *  Entry point
 * ========================================================= */

export type VideoGenOptions = {
  /** Max videos per job (default 3 pour POC, limite cost). */
  maxVideos?: number;
  /** Tier de budget : free (hailuo only) / paid (kling/runway) / premium (+ veo) */
  budgetTier?: "free" | "paid" | "premium";
  /** Callback progress apres chaque video : await pour update job state. */
  onProgress?: (current: number, total: number) => Promise<void>;
};

export async function runVideoGen(
  slug: string,
  brief: Brief,
  opts: VideoGenOptions = {}
): Promise<VideoAsset[]> {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN absent de .env.local");
  }

  const max = opts.maxVideos ?? DEFAULT_MAX_VIDEOS;
  const tier = opts.budgetTier ?? "paid";

  // Déduit le mood global du brief une seule fois
  const moodTag: MoodTag = deduceMoodTag(brief.creative_direction?.mood || "");

  const candidates = brief.featured_products
    .filter((p) => p.hero_image_url && p.video_prompt)
    .slice(0, max);

  const total = candidates.length;
  await opts.onProgress?.(0, total);

  if (total === 0) return [];

  const results: VideoAsset[] = [];
  let totalCost = 0;

  // Sequential — evite de cramer le rate limit Replicate (~3 concurrent par defaut)
  for (let i = 0; i < candidates.length; i++) {
    const p = candidates[i];
    try {
      const hintRaw = p.video_engine_hint as EngineName | undefined;
      const validHints: EngineName[] = ["kling", "hailuo", "runway", "higgsfield", "veo"];
      const hint = hintRaw && validHints.includes(hintRaw) ? hintRaw : undefined;

      const result = await videoDispatch(
        {
          prompt: p.video_prompt,
          startImageUrl: p.hero_image_url!,
          durationSec: p.video_duration_s || 5,
          slug,
          handle: p.handle,
        },
        {
          hint,
          mood: moodTag,
          budgetTier: tier,
        }
      );

      // eslint-disable-next-line no-console
      console.log(
        `[video-router] ${p.handle} OK via ${result.engine} (decision: ${result.decision.reason}, $${result.costUsd}, ${result.generationSec}s)`
      );

      results.push({
        productId: p.handle,
        url: result.localUrl,
        durationSec: 5,
        engine: result.engine,
        generatedAt: Date.now(),
      });
      totalCost += result.costUsd;
    } catch (err) {
      // Log + continue avec les autres produits
      // eslint-disable-next-line no-console
      console.warn(
        `[video-router] FAIL product=${p.handle}:`,
        err instanceof Error ? err.message : err
      );
    }
    await opts.onProgress?.(i + 1, total);
  }

  // eslint-disable-next-line no-console
  console.log(
    `[video-router] ${slug} done : ${results.length}/${total} videos generated, total cost ~$${totalCost.toFixed(2)}`
  );

  return results;
}
