/**
 * Middleware Vertxia V0.8 — protection des routes authentifiees.
 *
 * Strategie : on check uniquement la PRESENCE du cookie `vertxia_session`
 * (sans valider le contenu — la validation se fait dans les routes server).
 * Si absent sur une route /app/*, redirect vers /login.
 *
 * On ne touche pas aux routes /api (chaque route fait son propre check via getSession).
 * On laisse /login et /pricing libres (sinon, infinite redirect / churn UX).
 */

import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/app"];

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!isProtected) return NextResponse.next();

  const sessionCookie = req.cookies.get("vertxia_session");
  if (sessionCookie?.value) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Match toutes les routes /app/* (UI). Exclus assets et routes API.
  matcher: ["/app/:path*"],
};
