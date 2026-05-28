/**
 * Brief loader pour route dynamique /lite/[domain].
 * Charge le JSON brief + detecte quelles videos existent localement.
 * Server-side only (uses node:fs).
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import type { Brief, FeaturedProduct } from "./brief";

const PROJECT_ROOT = process.cwd();
const BRIEFS_DIR = path.join(PROJECT_ROOT, "data", "briefs");
const VIDEOS_DIR = path.join(PROJECT_ROOT, "public", "lite", "videos");

export async function loadBrief(domainSlug: string): Promise<Brief | null> {
  // Sanitize : seul des [a-z0-9_-] autorise (anti path traversal)
  if (!/^[a-z0-9_-]+$/i.test(domainSlug)) {
    return null;
  }

  const briefPath = path.join(BRIEFS_DIR, `${domainSlug}.json`);
  let raw: string;
  try {
    raw = await fs.readFile(briefPath, "utf-8");
  } catch {
    return null;
  }

  let brief: Brief;
  try {
    brief = JSON.parse(raw) as Brief;
  } catch {
    return null;
  }

  // Detecte les videos disponibles pour ce domaine
  const videoDir = path.join(VIDEOS_DIR, domainSlug);
  let availableVideos = new Set<string>();
  try {
    const files = await fs.readdir(videoDir);
    availableVideos = new Set(
      files
        .filter((f) => f.endsWith(".mp4"))
        .map((f) => f.replace(/\.mp4$/, ""))
    );
  } catch {
    // pas de dossier video = OK, on fallback sur images
  }

  // Enrichit les featured products avec video_url quand disponible
  brief.featured_products = brief.featured_products.map(
    (p: FeaturedProduct): FeaturedProduct => {
      const hasVideo = availableVideos.has(p.handle);
      if (hasVideo) {
        return {
          ...p,
          video_url: `/lite/videos/${domainSlug}/${p.handle}.mp4`,
        };
      }
      return p;
    }
  );

  return brief;
}

export async function listBriefs(): Promise<string[]> {
  try {
    const files = await fs.readdir(BRIEFS_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}
