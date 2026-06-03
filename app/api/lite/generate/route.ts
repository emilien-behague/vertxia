/**
 * POST /api/lite/generate
 *
 * Cree un job de generation site Vertxia Lite et lance le pipeline reel async.
 * Body : { url: string, prompt: string }
 * Retourne : { jobId: string, slug: string }
 *
 * V0.5 : pipeline reel (scraping Shopify + brief stub + composer).
 *        Videos AI (Kling) viendront en V0.6.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractDomainAndSlug } from "@/lib/url-to-slug";
import { createJob } from "@/lib/jobs";
import { runPipeline } from "@/lib/pipeline";
import { getCurrentUser } from "@/lib/session";
import { hasActiveSubscription } from "@/lib/billing/active-sub";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkOrigin } from "@/lib/origin-check";

// Force runtime Node (pas Edge) — on a besoin de node:fs
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // [SECURITY C2] Auth obligatoire — endpoint declenche des appels Kling payants
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  // [BILLING] Abonnement Stripe actif obligatoire — sinon hemorragie cash
  // (chaque generation cout reel : Claude tokens + Kling videos + scrape).
  const subCheck = await hasActiveSubscription(user.stripe_customer_id);
  if (!subCheck.active) {
    return NextResponse.json(
      {
        error: "Abonnement Vertxia requis pour generer un site.",
        reason: subCheck.reason,
        redirectTo: "/pricing",
      },
      { status: 402 } // Payment Required
    );
  }

  // [SECURITY M3] CSRF defense-in-depth
  const origin = checkOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: "Origin invalide" }, { status: 403 });
  }

  // [SECURITY C2] Rate limit : 3 jobs / heure / user (par IP en fallback)
  const limited = checkRateLimit(
    `user:${user.id}`,
    "lite-gen",
    { max: 3, windowMs: 60 * 60_000 }
  );
  if (limited.blocked) {
    return NextResponse.json(
      { error: "Trop de generations sur la derniere heure", retryAfter: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }
  // 2eme rate-limit par IP pour eviter qu'un script kiddie ne shotgun depuis 1 IP
  const ipLimit = checkRateLimit(getClientIp(req), "lite-gen-ip", { max: 10, windowMs: 60 * 60_000 });
  if (ipLimit.blocked) {
    return NextResponse.json(
      { error: "Trop de requetes depuis cette IP", retryAfter: ipLimit.retryAfterSec },
      { status: 429 }
    );
  }

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
  const withVideos = (body as { withVideos?: unknown }).withVideos === true;
  const maxVideosRaw = (body as { maxVideos?: unknown }).maxVideos;
  const maxVideos =
    typeof maxVideosRaw === "number" && Number.isFinite(maxVideosRaw)
      ? Math.max(1, Math.min(6, Math.floor(maxVideosRaw)))
      : undefined;
  // Brief multi-pass auto-critique (V2) : passCount=3 active audit + improve (~+100s, ~$0.16)
  // Default 1 (single-pass classique).
  const passCountRaw = (body as { passCount?: unknown }).passCount;
  const passCount: 1 | 3 = passCountRaw === 3 ? 3 : 1;

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
      withVideos,
      maxVideos,
      passCount,
    });

    // Lance le pipeline en background (non-awaited).
    // Le job state est ecrit dans data/jobs/{id}.json a chaque etape, lu par /status.
    runPipeline(job).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[pipeline] unexpected:", err);
    });

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
