// Middleware Supabase pour rafraîchir la session utilisateur sur chaque requête.
//
// À appeler depuis le middleware Next.js global (middleware.ts à la racine)
// avant tout autre traitement, pour garantir que les cookies de session sont
// toujours frais (sinon refresh_token expire et l'utilisateur est déconnecté).

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type SessionResult = {
  response: NextResponse;
  /** User Supabase si connecté, null sinon, undefined si Supabase non configuré */
  user: { id: string; email?: string } | null | undefined;
};

export async function updateSession(request: NextRequest): Promise<SessionResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Si env vars Supabase absentes (mode démo pur sans backend),
  // on skip silencieusement sans casser le middleware.
  if (!url || !key) {
    return { response: NextResponse.next({ request }), user: undefined };
  }

  let supabaseResponse = NextResponse.next({ request });
  let user: { id: string; email?: string } | null = null;

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    // IMPORTANT : appel obligatoire pour rafraîchir la session.
    const { data } = await supabase.auth.getUser();
    user = data.user ? { id: data.user.id, email: data.user.email } : null;

    // Écrit le user_id dans un cookie NON-httpOnly pour que le client puisse
    // le lire de façon SYNCHRONE (via document.cookie). Sans ça, les pages
    // /m/* qui appellent listEquipements() etc. au mount lisaient le mauvais
    // namespace localStorage tant que useUser() n'avait pas résolu async →
    // race condition → données partagées entre comptes.
    if (user) {
      supabaseResponse.cookies.set("vertxia-uid", user.id, {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 jours
        secure: process.env.NODE_ENV === "production",
      });
    } else {
      supabaseResponse.cookies.set("vertxia-uid", "", {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }
  } catch (e) {
    // Ne JAMAIS faire crasher le middleware (sinon MIDDLEWARE_INVOCATION_FAILED
    // sur toutes les pages). Log et continue.
    console.warn("[supabase/middleware] updateSession error:", e);
  }

  return { response: supabaseResponse, user };
}
