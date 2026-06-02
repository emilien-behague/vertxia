/**
 * POST /api/lite/test-multipass — endpoint DEV ONLY pour tester briefer-v2.
 *
 * Usage : curl -X POST localhost:3000/api/lite/test-multipass \
 *   -H "Content-Type: application/json" \
 *   -d '{"slug":"fellowproducts_com","passCount":3}'
 *
 * Charge le scrape + le brief V1 existant, lance pass 2 (audit) + pass 3 (improve),
 * sauve le brief V2 dans data/briefs/{slug}_v2.json + audit dans data/audits/{slug}.json,
 * retourne audit + metrics.
 *
 * Pas d'auth — endpoint dev uniquement, a desactiver en prod.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { auditBrief, improveBrief } from "@/lib/pipeline/briefer-v2";
import type { CreativeBrief, ScrapeResult } from "@/lib/pipeline/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEB_ROOT = process.cwd();

export async function POST(req: NextRequest) {
  // Dev only — block en prod
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Dev endpoint disabled in prod" }, { status: 403 });
  }

  let body: { slug?: string; passCount?: 1 | 3 } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { slug, passCount = 3 } = body;
  if (!slug) {
    return NextResponse.json({ error: "Missing 'slug' in body" }, { status: 400 });
  }

  // Charge scrape + brief V1
  const scrapePath = resolve(WEB_ROOT, "data", "scrapes", `${slug}.json`);
  const briefPath = resolve(WEB_ROOT, "data", "briefs", `${slug}.json`);

  if (!existsSync(scrapePath)) {
    return NextResponse.json(
      { error: `Scrape not found: data/scrapes/${slug}.json` },
      { status: 404 }
    );
  }
  if (!existsSync(briefPath)) {
    return NextResponse.json(
      { error: `Brief V1 not found: data/briefs/${slug}.json` },
      { status: 404 }
    );
  }

  const scrape = JSON.parse(await readFile(scrapePath, "utf-8")) as ScrapeResult;
  const briefV1 = JSON.parse(await readFile(briefPath, "utf-8")) as CreativeBrief;

  if (passCount === 1) {
    return NextResponse.json({
      message: "passCount=1 not implemented for test endpoint (use regular pipeline)",
    });
  }

  // PASS 2 : Audit
  const startAudit = Date.now();
  let audit;
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY missing" },
        { status: 500 }
      );
    }
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    audit = await auditBrief(briefV1, scrape, client);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Audit pass failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
  const auditSec = (Date.now() - startAudit) / 1000;

  // Save audit
  const auditDir = resolve(WEB_ROOT, "data", "audits");
  if (!existsSync(auditDir)) await mkdir(auditDir, { recursive: true });
  await writeFile(
    resolve(auditDir, `${slug}.json`),
    JSON.stringify(audit, null, 2)
  );

  // PASS 3 : Improve
  const startImprove = Date.now();
  let briefV2;
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    briefV2 = await improveBrief(
      briefV1,
      audit,
      scrape,
      briefV1._meta?.client_prompt || "site cinematic premium",
      client
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "Improve pass failed",
        details: err instanceof Error ? err.message : String(err),
        audit,
      },
      { status: 500 }
    );
  }
  const improveSec = (Date.now() - startImprove) / 1000;

  // Save brief V2
  await writeFile(
    resolve(WEB_ROOT, "data", "briefs", `${slug}_v2.json`),
    JSON.stringify(briefV2, null, 2)
  );

  return NextResponse.json({
    slug,
    audit: {
      overall_score: audit.overall_score,
      verdict: audit.verdict,
      scores: audit.scores,
      priorities: audit.priorities,
      summary: audit.summary,
    },
    metrics: {
      pass2_audit_seconds: Math.round(auditSec * 10) / 10,
      pass3_improve_seconds: Math.round(improveSec * 10) / 10,
      total_seconds: Math.round((auditSec + improveSec) * 10) / 10,
    },
    diff: {
      template_id: { v1: briefV1.template_id, v2: briefV2.template_id },
      visual_signature: {
        v1: briefV1.visual_signature,
        v2: briefV2.visual_signature,
      },
      hero_headline: {
        v1: briefV1.hero?.headline,
        v2: briefV2.hero?.headline,
      },
      hero_kicker: {
        v1: briefV1.hero?.kicker,
        v2: briefV2.hero?.kicker,
      },
      brand_voice: {
        v1: briefV1.brand?.voice,
        v2: briefV2.brand?.voice,
      },
      mood: {
        v1: briefV1.creative_direction?.mood,
        v2: briefV2.creative_direction?.mood,
      },
    },
    saved_to: {
      audit: `data/audits/${slug}.json`,
      brief_v2: `data/briefs/${slug}_v2.json`,
    },
  });
}
