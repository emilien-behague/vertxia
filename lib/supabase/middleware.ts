// Middleware Supabase pour rafraîchir la session utilisateur sur chaque requête.
//
// À appeler depuis le middleware Next.js global (middleware.ts à la racine)
// avant tout autre traitement, pour garantir que les cookies de session sont
// toujours frais (sinon refresh_token expire et l'utilisateur est déconnecté).

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Si env vars Supabase absentes (mode démo pur sans backend),
  // on skip silencieusement sans casser le middleware.
  if (!url || !key) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

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
    // Ne pas supprimer même si on n'utilise pas la valeur retournée.
    await supabase.auth.getUser();
  } catch (e) {
    // Ne JAMAIS faire crasher le middleware (sinon MIDDLEWARE_INVOCATION_FAILED
    // sur toutes les pages). Log et continue.
    console.warn("[supabase/middleware] updateSession error:", e);
  }

  return supabaseResponse;
}
