/**
 * GET /api/auth/verify?token=xxx
 *
 * Verifie le magic link, set la session, redirect vers /app.
 *
 * En cas d'erreur : redirect /login?error=expired|invalid|already_used
 */

import { NextRequest, NextResponse } from "next/server";
import {
  consumeMagicLink,
  upsertUserByEmail,
  AuthError,
} from "@/lib/auth/auth";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectTo(origin: string, path: string) {
  return NextResponse.redirect(`${origin}${path}`);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const origin = req.nextUrl.origin;

  // [SECURITY C3] Rate limit IP (anti brute-force du token)
  const ipLimit = checkRateLimit(getClientIp(req), "auth-verify-ip", {
    max: 20,
    windowMs: 60_000,
  });
  if (ipLimit.blocked) {
    return redirectTo(origin, "/login?error=rate");
  }

  if (!token || token.length < 16) {
    return redirectTo(origin, "/login?error=invalid");
  }

  let email: string;
  try {
    email = await consumeMagicLink(token);
  } catch (err) {
    if (err instanceof AuthError) {
      const code = err.code.toLowerCase();
      return redirectTo(origin, `/login?error=${code}`);
    }
    // eslint-disable-next-line no-console
    console.error("[auth/verify] unknown error:", err);
    return redirectTo(origin, "/login?error=invalid");
  }

  const user = await upsertUserByEmail(email);

  // Set session (cookie seale par iron-session — pose dans la response NextResponse)
  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  await session.save();

  return redirectTo(origin, "/app");
}
