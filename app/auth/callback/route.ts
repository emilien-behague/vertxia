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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/m";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] exchange error:", error);
    return NextResponse.redirect(
      `${origin}/m/login?error=${encodeURIComponent("Échec de connexion : " + error.message)}`
    );
  }

  return NextResponse.redirect(
    `${origin}/m/login?error=${encodeURIComponent("Code OAuth manquant — réessaie")}`
  );
}
