/**
 * Jobs management — fichier-based status tracking pour le pipeline Vertxia Lite.
 *
 * V0.5 PHASE 2 : pipeline reel ecrit dans `data/jobs/{id}.json` a chaque etape.
 * deriveMockProgress() conserve uniquement comme fallback dev (non utilise en prod).
 *
 * Server-side only (uses node:fs).
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const JOBS_DIR = path.join(process.cwd(), "data", "jobs");
const BRIEFS_DIR = path.join(process.cwd(), "data", "briefs");

export type JobStatus =
  | "queued"
  | "scraping"
  | "briefing"
  | "generating_videos"
  | "composing"
  | "done"
  | "failed";

export type Job = {
  id: string;
  slug: string;
  url: string;
  prompt: string;
  startedAt: number;
  updatedAt: number;
  status: JobStatus;
  currentStep: number;
  totalSteps: number;
  videoProgress?: { current: number; total: number };
  error: string | null;
  redirectSlug: string | null;
  /** Si true, le brief existait deja avant le job (cas demo Allbirds/Loom) — skip rapide. */
  alreadyExists: boolean;
  /** Si true, runPipeline lance Kling generation sur les featured_products (cost ~$1/job). */
  withVideos: boolean;
  /** Limite max de vidéos Kling à generer (default 3 si withVideos). */
  maxVideos: number;
  /** Nombre de passes du briefer : 1 (rapide $0.30) ou 3 (multi-pass auto-critique $0.46). Default 1. */
  passCount?: 1 | 3;
};

const JOB_ID_REGEX = /^[a-f0-9-]{36}$/i;

export function isValidJobId(id: string): boolean {
  return JOB_ID_REGEX.test(id);
}

async function ensureJobsDir() {
  await fs.mkdir(JOBS_DIR, { recursive: true });
}

function jobPath(id: string) {
  if (!isValidJobId(id)) {
    throw new Error("invalid job id");
  }
  return path.join(JOBS_DIR, `${id}.json`);
}

/**
 * Atomic write : ecrit dans un .tmp puis rename. Evite que le reader voie du JSON partiel.
 */
async function atomicWrite(target: string, data: string) {
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, data, "utf-8");
  await fs.rename(tmp, target);
}

export async function createJob(input: {
  slug: string;
  url: string;
  prompt: string;
  withVideos?: boolean;
  maxVideos?: number;
  passCount?: 1 | 3;
}): Promise<Job> {
  await ensureJobsDir();

  // Detecte si un brief CURE existe deja (Allbirds, Loom, etc.).
  // Un brief simplement genere par un run precedent (non cure) ne compte pas — on regenere.
  const briefPath = path.join(BRIEFS_DIR, `${input.slug}.json`);
  let alreadyExists = false;
  try {
    const raw = await fs.readFile(briefPath, "utf-8");
    const parsed = JSON.parse(raw) as { curated?: boolean };
    alreadyExists = parsed.curated === true;
  } catch {
    alreadyExists = false;
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const job: Job = {
    id,
    slug: input.slug,
    url: input.url,
    prompt: input.prompt,
    startedAt: now,
    updatedAt: now,
    status: "queued",
    currentStep: 0,
    totalSteps: 5,
    error: null,
    redirectSlug: null,
    alreadyExists,
    withVideos: input.withVideos === true,
    maxVideos: Math.max(1, Math.min(6, input.maxVideos ?? 3)),
    passCount: input.passCount === 3 ? 3 : 1,
  };

  await atomicWrite(jobPath(id), JSON.stringify(job, null, 2));
  return job;
}

export async function readJob(id: string): Promise<Job | null> {
  if (!isValidJobId(id)) return null;
  try {
    const raw = await fs.readFile(jobPath(id), "utf-8");
    return JSON.parse(raw) as Job;
  } catch {
    return null;
  }
}

/**
 * Met a jour partiellement un job (merge avec l'existant).
 * Atomic write — pas de race condition si le reader lit pendant l'update.
 * `updatedAt` est force a Date.now() systematiquement.
 */
export async function updateJob(
  id: string,
  partial: Partial<Omit<Job, "id" | "slug" | "url" | "prompt" | "startedAt" | "alreadyExists">>
): Promise<Job | null> {
  const current = await readJob(id);
  if (!current) return null;
  const next: Job = {
    ...current,
    ...partial,
    updatedAt: Date.now(),
  };
  await atomicWrite(jobPath(id), JSON.stringify(next, null, 2));
  return next;
}

/**
 * Mock progress (PHASE 1 uniquement).
 *
 * Derive le statut de (Date.now - startedAt) pour simuler la progression du pipeline
 * sans cramer du budget Kling. A supprimer en PHASE 2 (wrapper Python ecrit reellement).
 *
 * Timing simule compresse :
 * - alreadyExists (cas demo) : done en 1.5s
 * - sinon : ~18s pour parcourir toutes les etapes
 */
export function deriveMockProgress(job: Job): Job {
  const elapsed = Date.now() - job.startedAt;

  // Cas demo : brief existe deja, on simule juste un mini-load (donne le temps au portail+page)
  if (job.alreadyExists) {
    if (elapsed < 1500) {
      return {
        ...job,
        status: "composing",
        currentStep: 4,
        updatedAt: Date.now(),
      };
    }
    return {
      ...job,
      status: "done",
      currentStep: 5,
      redirectSlug: job.slug,
      updatedAt: Date.now(),
    };
  }

  // Cas vrai pipeline : timing compresse pour mock UX
  if (elapsed < 3000) {
    return { ...job, status: "scraping", currentStep: 1, updatedAt: Date.now() };
  }
  if (elapsed < 6000) {
    return { ...job, status: "briefing", currentStep: 2, updatedAt: Date.now() };
  }
  if (elapsed < 15000) {
    const videoProgressRatio = (elapsed - 6000) / 9000;
    const current = Math.min(5, Math.floor(videoProgressRatio * 5));
    return {
      ...job,
      status: "generating_videos",
      currentStep: 3,
      videoProgress: { current, total: 5 },
      updatedAt: Date.now(),
    };
  }
  if (elapsed < 18000) {
    return {
      ...job,
      status: "composing",
      currentStep: 4,
      videoProgress: { current: 5, total: 5 },
      updatedAt: Date.now(),
    };
  }
  // Mock done : on n'a pas de vrai brief, donc on flag failed avec message clair
  return {
    ...job,
    status: "failed",
    currentStep: 5,
    error:
      "Mock pipeline termine. Le vrai pipeline Python sera branche en Phase 2 — utilise allbirds.com ou loom.fr pour tester avec un brief reel.",
    updatedAt: Date.now(),
  };
}
