/**
 * GET /api/auth/google
 *
 * Redirige vers Google OAuth avec state cookie (CSRF) + code_verifier cookie (PKCE).
 * Apres consentement, Google redirige sur /api/auth/google/callback.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateCodeVerifier, generateState } from "arctic";
import { getGoogleProvider } from "@/lib/auth/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "vertxia_oauth_state";
const VERIFIER_COOKIE = "vertxia_oauth_verifier";

export async function GET(_req: NextRequest) {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const google = getGoogleProvider();
  const url = google.createAuthorizationURL(state, codeVerifier, [
    "openid",
    "email",
    "profile",
  ]);

  const cookieStore = await cookies();
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10, // 10 min — c'est le temps qu'on laisse a l'utilisateur sur Google
  };
  cookieStore.set(STATE_COOKIE, state, opts);
  cookieStore.set(VERIFIER_COOKIE, codeVerifier, opts);

  return NextResponse.redirect(url);
}
