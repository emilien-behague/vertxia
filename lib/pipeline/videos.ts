/**
 * Video generation (Kling v2.1 via Replicate) — etape 3 du pipeline Vertxia Lite.
 *
 * Genere des videos cinematic image-to-video pour les featured_products du brief :
 *   1. Pour chaque produit : call Replicate avec start_image + video_prompt + duration
 *   2. Download le MP4 result dans public/lite/videos/{slug}/{handle}.mp4
 *   3. Update job.videoProgress apres chaque generation
 *
 * Securite cout :
 *  - DEFAULT max 3 vidéos par job (override via param maxVideos)
 *  - Kling v2.1 standard : ~$0.30 / 5s vid (vs $1.50 pour master)
 *  - Si pas de REPLICATE_API_TOKEN ou si erreur sur une video : skip silencieux,
 *    le template fallback sur hero_image_url (static product photo)
 *
 * Concurrence : sequentiel (pas de parallel) pour eviter rate limit Replicate.
 */

import Replicate from "replicate";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Brief } from "@/lib/brief";
import type { VideoAsset } from "./types";

const REPLICATE_KLING_MODEL = "kwaivgi/kling-v2.1";
const DEFAULT_MAX_VIDEOS = 3;
const VIDEOS_PUBLIC_DIR = path.join(process.cwd(), "public", "lite", "videos");

/* =========================================================
 *  Entry point
 * ========================================================= */

export type VideoGenOptions = {
  /** Max videos per job (default 3 pour POC, limite cost). */
  maxVideos?: number;
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
  const candidates = brief.featured_products
    .filter((p) => p.hero_image_url && p.video_prompt)
    .slice(0, max);

  const total = candidates.length;
  await opts.onProgress?.(0, total);

  if (total === 0) return [];

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const results: VideoAsset[] = [];

  // Sequential — evite de cramer le rate limit Replicate (~3 concurrent par defaut)
  for (let i = 0; i < candidates.length; i++) {
    const p = candidates[i];
    try {
      const localUrl = await generateKlingVideo(
        replicate,
        slug,
        p.handle,
        p.video_prompt,
        p.hero_image_url!,
        p.video_duration_s
      );

      results.push({
        productId: p.handle,
        url: localUrl,
        durationSec: 5, // Hard-cap : voir generateKlingVideo()
        engine: "kling",
        generatedAt: Date.now(),
      });
    } catch (err) {
      // Log + continue avec les autres produits
      // eslint-disable-next-line no-console
      console.warn(
        `[videos] Kling fail product=${p.handle}:`,
        err instanceof Error ? err.message : err
      );
    }
    await opts.onProgress?.(i + 1, total);
  }

  return results;
}

/* =========================================================
 *  Single Kling call + download
 * ========================================================= */

async function generateKlingVideo(
  replicate: Replicate,
  slug: string,
  handle: string,
  prompt: string,
  startImageUrl: string,
  _durationSec: number
): Promise<string> {
  // Force 5s — cost cap. Kling supporte 5 ou 10s mais 10s coute ~2x plus cher.
  // Le brief peut contenir 5 ou 8, on ignore et hard-cap a 5.
  const duration = 5;

  // Replicate.run() blocks until the prediction completes (polling interne)
  const output = await replicate.run(REPLICATE_KLING_MODEL, {
    input: {
      prompt,
      start_image: startImageUrl,
      duration,
      negative_prompt: "",
      cfg_scale: 0.5,
    },
  });

  // L'output Replicate peut etre :
  //  - une URL string (modeles simples)
  //  - un FileOutput object avec .url() (modeles file-output, dont Kling)
  //  - un ReadableStream
  const fileUrl = await extractFileUrl(output);

  return await downloadVideo(fileUrl, slug, handle);
}

async function extractFileUrl(output: unknown): Promise<string> {
  // Cas 1 : string URL direct
  if (typeof output === "string") return output;

  // Cas 2 : objet avec .url() (Replicate FileOutput v1.x)
  if (
    output &&
    typeof output === "object" &&
    "url" in output &&
    typeof (output as { url: unknown }).url === "function"
  ) {
    const u = await (output as { url: () => URL | string | Promise<URL | string> }).url();
    return u instanceof URL ? u.toString() : u;
  }

  // Cas 3 : array de URLs (certains modeles retournent multi-output)
  if (Array.isArray(output) && output.length > 0 && typeof output[0] === "string") {
    return output[0];
  }

  throw new Error(
    `Replicate output format inattendu: ${typeof output} (${JSON.stringify(output).slice(0, 120)})`
  );
}

async function downloadVideo(
  remoteUrl: string,
  slug: string,
  handle: string
): Promise<string> {
  // Sanitize slug + handle (defense en profondeur path traversal)
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(slug)) {
    throw new Error(`slug invalide: "${slug}"`);
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,128}$/i.test(handle)) {
    throw new Error(`handle invalide: "${handle}"`);
  }

  const dir = path.join(VIDEOS_PUBLIC_DIR, slug);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${handle}.mp4`);

  const res = await fetch(remoteUrl);
  if (!res.ok) {
    throw new Error(`Download MP4 HTTP ${res.status} from ${remoteUrl}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  // URL servable publiquement par Next (public/ est mappe sur /)
  return `/lite/videos/${slug}/${handle}.mp4`;
}
