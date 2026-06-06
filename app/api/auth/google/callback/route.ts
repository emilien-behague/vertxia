/**
 * GET /api/auth/google/callback?code=...&state=...
 *
 * Valide state vs cookie (CSRF), echange le code contre tokens, extrait email
 * du id_token, upsert user, set session, redirect /app.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGoogleProvider, verifyGoogleIdToken } from "@/lib/auth/oauth";
import { getSession } from "@/lib/auth/session";
import { upsertUserByEmail, normalizeEmail, isValidEmail } from "@/lib/auth/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "vertxia_oauth_state";
const VERIFIER_COOKIE = "vertxia_oauth_verifier";

function redirectError(origin: string, code: string) {
  return NextResponse.redirect(`${origin}/login?error=${code}`);
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const errorParam = req.nextUrl.searchParams.get("error");

  if (errorParam) {
    // L'utilisateur a refuse le consentement
    return redirectError(origin, "google_denied");
  }

  if (!code || !state) {
    return redirectError(origin, "google_invalid");
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE)?.value;
  const codeVerifier = cookieStore.get(VERIFIER_COOKIE)?.value;

  // Cleanup early — meme en cas d'erreur on veut les supprimer
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(VERIFIER_COOKIE);

  if (!storedState || !codeVerifier || storedState !== state) {
    return redirectError(origin, "google_state");
  }

  // [SECURITY C3] Rate limit IP (anti-spam callback)
  const ipLimit = checkRateLimit(getClientIp(req), "auth-google-cb-ip", {
    max: 20,
    windowMs: 60_000,
  });
  if (ipLimit.blocked) {
    return redirectError(origin, "rate");
  }

  let email: string;
  try {
    const google = getGoogleProvider();
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);
    const idToken = tokens.idToken();
    if (!idToken) throw new Error("id_token absent");

    // [SECURITY H1] Verifie signature JWKS + issuer + audience
    const payload = await verifyGoogleIdToken(idToken);

    if (!isValidEmail(payload.email)) {
      throw new Error("email format invalide");
    }
    if (payload.email_verified === false) {
      return redirectError(origin, "google_unverified");
    }
    email = normalizeEmail(payload.email);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[auth/google/callback] Token exchange/verify failed:", err);
    return redirectError(origin, "google_exchange");
  }

  const user = await upsertUserByEmail(email);

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  await session.save();

  return NextResponse.redirect(`${origin}/app`);
}
