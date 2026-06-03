// Callback OAuth Supabase — récupère le code retourné par le provider
// (Google, magic link) et l'échange contre une session.
//
// URL config dans Supabase Auth → Providers → Google :
//   Authorized redirect URI : https://vertxia.com/auth/callback
//
// Param `next` permet de rediriger vers la page d'origine après login
// (ex: /auth/callback?next=/m/bouteilles).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Construit l'URL de redirection en respectant le vrai hostname public.
// Sur Vercel, `origin` peut pointer vers un hostname interne (lambda) au
// lieu du hostname public (vertxia.com ou *.vercel.app) — ce qui fait
// que les cookies sb-* sont set pour le mauvais domain et la session
// n'est pas reconnue côté navigateur après le redirect. Le header
// x-forwarded-host (set par le proxy Vercel) donne le vrai hostname.
function buildRedirectUrl(request: Request, path: string): string {
  const { origin } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (!isLocalEnv && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}${path}`;
  }
  return `${origin}${path}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/m";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(buildRedirectUrl(request, next));
    }
    console.error("[auth/callback] exchange error:", error);
    return NextResponse.redirect(
      buildRedirectUrl(
        request,
        `/m/login?error=${encodeURIComponent("Échec de connexion : " + error.message)}`
      )
    );
  }

  return NextResponse.redirect(
    buildRedirectUrl(
      request,
      `/m/login?error=${encodeURIComponent("Code OAuth manquant — réessaie")}`
    )
  );
}
