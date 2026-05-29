/**
 * POST /api/auth/login
 *
 * Body : { email: string }
 * Cree un magic link et envoie l'email via Resend.
 * Retourne 200 meme si l'email n'existe pas (anti-enumeration) — la promesse
 * "On t'a envoye un lien" est volontairement neutre.
 *
 * Rate limit V0.8 : aucun. A ajouter quand on aura > qq users.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  isValidEmail,
  normalizeEmail,
  createMagicLink,
  sendMagicLinkEmail,
} from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkOrigin } from "@/lib/origin-check";
import { appUrl } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // [SECURITY M3] CSRF defense-in-depth
  const origin = checkOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: "Origin invalide" }, { status: 403 });
  }

  // [SECURITY C3] Rate limit IP (anti-spray)
  const ip = getClientIp(req);
  const ipLimit = checkRateLimit(ip, "auth-login-ip", {
    max: 10,
    windowMs: 60 * 60_000,
  });
  if (ipLimit.blocked) {
    return NextResponse.json(
      { error: "Trop de tentatives, reessaie plus tard", retryAfter: ipLimit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const emailRaw = (body as { email?: unknown })?.email;
  if (typeof emailRaw !== "string" || !isValidEmail(emailRaw)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }
  const email = normalizeEmail(emailRaw);

  // [SECURITY C3] Rate limit per-email (anti email-bomb)
  const emailLimit = checkRateLimit(email, "auth-login-email", {
    max: 3,
    windowMs: 10 * 60_000,
  });
  if (emailLimit.blocked) {
    // Reponse identique a un success -> anti-enumeration
    return NextResponse.json({ ok: true });
  }

  try {
    const token = await createMagicLink(email);
    // [SECURITY L1] APP_URL pin (pas de fallback Host header)
    await sendMagicLinkEmail({ email, token, appUrl: appUrl() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    // eslint-disable-next-line no-console
    console.error("[auth/login] error:", msg);
    // On masque l'erreur a l'utilisateur — anti-enumeration. Mais on log.
    return NextResponse.json(
      { error: "Envoi du lien impossible — reessaie dans qq instants" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
