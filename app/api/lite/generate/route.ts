/**
 * POST /api/lite/generate
 *
 * Cree un job de generation site Vertxia Lite.
 * Body : { url: string, prompt: string }
 * Retourne : { jobId: string, slug: string }
 *
 * V0.1 PHASE 1 (mock) : ne lance pas le vrai pipeline, juste cree le job file
 *                        — le mock progress est derive cote GET status.
 * V0.1 PHASE 2 (real) : ajoutera child_process.spawn('python', ['vertxia_lite_pipeline_wrapper.py', ...])
 *                        avec rate limit IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractDomainAndSlug } from "@/lib/url-to-slug";
import { createJob } from "@/lib/jobs";

// Force runtime Node (pas Edge) — on a besoin de node:fs
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body JSON invalide" },
      { status: 400 }
    );
  }

  // Validation stricte du body
  if (
    !body ||
    typeof body !== "object" ||
    !("url" in body) ||
    !("prompt" in body) ||
    typeof (body as Record<string, unknown>).url !== "string" ||
    typeof (body as Record<string, unknown>).prompt !== "string"
  ) {
    return NextResponse.json(
      { error: "Body doit contenir { url, prompt } strings" },
      { status: 400 }
    );
  }

  const url = ((body as { url: string }).url || "").trim().slice(0, 500);
  const prompt = ((body as { prompt: string }).prompt || "").trim().slice(0, 500);

  if (!url || !prompt) {
    return NextResponse.json(
      { error: "url et prompt requis (non vides)" },
      { status: 400 }
    );
  }

  // Validation URL cote serveur (defense en profondeur, deja fait cote client)
  const extracted = extractDomainAndSlug(url);
  if (!extracted.ok) {
    return NextResponse.json(
      { error: "URL Shopify invalide ou blacklistee" },
      { status: 400 }
    );
  }

  // TODO PHASE 2 : rate limit ici via Map<ip, lastJobAt> avec max 1 job/24h/IP
  //   Critique pour eviter epuisement budget Kling (~2€ par job).

  try {
    const job = await createJob({
      slug: extracted.slug,
      url: extracted.raw,
      prompt,
    });

    // TODO PHASE 2 : spawn child_process Python ici, detached + stdio ignore
    //   const { spawn } = await import("node:child_process");
    //   const proc = spawn("python", [
    //     "../vertxia_lite_pipeline_wrapper.py",
    //     "--url", extracted.raw,
    //     "--prompt", prompt,
    //     "--job-id", job.id,
    //   ], { detached: true, stdio: "ignore" });
    //   proc.unref();

    return NextResponse.json(
      { jobId: job.id, slug: job.slug },
      { status: 202 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Echec creation job : " +
          (err instanceof Error ? err.message : "unknown"),
      },
      { status: 500 }
    );
  }
}
