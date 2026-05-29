/**
 * Storage utilities pour le pipeline Vertxia Lite.
 *
 * Stocke les artefacts de chaque etape dans `data/` (gitignore) :
 *   data/scrapes/{slug}.json
 *   data/briefs/{slug}.json
 *   data/sites/{slug}.json
 *
 * Atomic write (tmp + rename) pour eviter les lectures partielles.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const SCRAPES_DIR = path.join(DATA_DIR, "scrapes");
const BRIEFS_DIR = path.join(DATA_DIR, "briefs");
const SITES_DIR = path.join(DATA_DIR, "sites");

const SLUG_REGEX = /^[a-z0-9][a-z0-9_-]{1,62}[a-z0-9]$/;

function assertSlug(slug: string) {
  if (!SLUG_REGEX.test(slug)) {
    throw new Error(`Invalid slug: "${slug}"`);
  }
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWrite(target: string, data: string) {
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, data, "utf-8");
  await fs.rename(tmp, target);
}

async function saveJson<T>(dir: string, slug: string, data: T): Promise<void> {
  assertSlug(slug);
  await ensureDir(dir);
  const target = path.join(dir, `${slug}.json`);
  await atomicWrite(target, JSON.stringify(data, null, 2));
}

async function readJson<T>(dir: string, slug: string): Promise<T | null> {
  assertSlug(slug);
  try {
    const raw = await fs.readFile(path.join(dir, `${slug}.json`), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/* ---------- API publique ---------- */

import type { ScrapeResult, CreativeBrief, SiteManifest } from "./types";

export const saveScrape = (slug: string, data: ScrapeResult) =>
  saveJson(SCRAPES_DIR, slug, data);
export const readScrape = (slug: string) =>
  readJson<ScrapeResult>(SCRAPES_DIR, slug);

export const saveBrief = (slug: string, data: CreativeBrief) =>
  saveJson(BRIEFS_DIR, slug, data);
export const readBrief = (slug: string) =>
  readJson<CreativeBrief>(BRIEFS_DIR, slug);

export const saveSite = (slug: string, data: SiteManifest) =>
  saveJson(SITES_DIR, slug, data);
export const readSite = (slug: string) =>
  readJson<SiteManifest>(SITES_DIR, slug);
