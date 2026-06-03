/**
 * Middleware Vertxia.
 *
 * 1. Rafraîchit la session Supabase Auth sur CHAQUE requête (impératif SSR
 *    pour ne pas perdre le refresh_token).
 * 2. Protège les routes /app/* (ancien système v0.8 cookie maison) :
 *    redirige vers /login si pas de cookie `vertxia_session`.
 * 3. /m/* (app mobile démo) reste accessible SANS login (mode hybride :
 *    localStorage si pas connecté, sync DB si connecté).
 */

import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = ["/app"];

export async function middleware(req: NextRequest) {
  // 1. Rafraîchit la session Supabase Auth (toutes les routes)
  const supabaseResponse = await updateSession(req);

  // 2. Protection ancien système /app/* (cookie maison)
  const pathname = req.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (isProtected) {
    const sessionCookie = req.cookies.get("vertxia_session");
    if (!sessionCookie?.value) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match toutes les routes SAUF :
     * - _next/static (assets statiques)
     * - _next/image (optimisation images)
     * - favicon.ico, opengraph-image.png, apple-icon, manifest.webmanifest, sw.js
     * - fichiers avec extension (.png .jpg .svg .ico .webp .glb .mp4 .pdf etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|opengraph-image|apple-icon|manifest|sw.js|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
