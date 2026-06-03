/**
 * Middleware Vertxia.
 *
 * 1. Rafraîchit la session Supabase Auth sur CHAQUE requête (impératif SSR
 *    pour ne pas perdre le refresh_token).
 * 2. Protège les routes /app/* (ancien système v0.8 cookie maison) :
 *    redirige vers /login si pas de cookie `vertxia_session`.
 * 3. Protège les routes /m/* (app mobile) : redirige vers /m/login si
 *    pas de session Supabase. Connexion Google OAuth obligatoire.
 *    Exception : /m/login (sinon boucle).
 */

import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_LEGACY_PREFIXES = ["/app"];
const PROTECTED_MOBILE_PREFIXES = ["/m"];
const MOBILE_PUBLIC_PATHS = ["/m/login"];

/**
 * Copie les cookies set par Supabase (auth-token refresh) depuis le
 * response du middleware Supabase vers une nouvelle response (redirect).
 *
 * CRITIQUE : sans ça, quand le middleware redirect, les cookies sb-* fraîchement
 * refreshed sont PERDUS. L'utilisateur se retrouve avec une session morte
 * (ex: "le refresh me déconnecte").
 */
function preserveCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((c) => {
    target.cookies.set({
      name: c.name,
      value: c.value,
      path: c.path,
      domain: c.domain,
      maxAge: c.maxAge,
      expires: c.expires,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
      secure: c.secure,
    });
  });
  return target;
}

export async function middleware(req: NextRequest) {
  // 1. Rafraîchit la session Supabase Auth (toutes les routes)
  const { response: supabaseResponse, user } = await updateSession(req);

  const pathname = req.nextUrl.pathname;

  // 2. Protection ancien système /app/* (cookie maison legacy)
  const isLegacyProtected = PROTECTED_LEGACY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (isLegacyProtected) {
    const sessionCookie = req.cookies.get("vertxia_session");
    if (!sessionCookie?.value) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      return preserveCookies(supabaseResponse, NextResponse.redirect(loginUrl));
    }
  }

  // 3. Protection /m/* via Supabase Auth (Google OAuth obligatoire)
  // Skip si Supabase non configuré (user === undefined) : mode démo silencieux
  const isMobileProtected = PROTECTED_MOBILE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const isMobilePublic = MOBILE_PUBLIC_PATHS.includes(pathname);
  if (isMobileProtected && !isMobilePublic && user === null) {
    // Supabase configuré ET pas d'user → redirect vers /m/login
    const loginUrl = new URL("/m/login", req.url);
    if (pathname !== "/m") loginUrl.searchParams.set("from", pathname);
    return preserveCookies(supabaseResponse, NextResponse.redirect(loginUrl));
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
