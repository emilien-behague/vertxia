// Client Supabase pour les Server Components, API Routes et Server Actions.
//
// Gère automatiquement les cookies de session via le helper Next.js.
// Refresh tokens sont rafraîchis en arrière-plan.
//
// Usage Server Component :
//   import { createClient } from "@/lib/supabase/server";
//   const supabase = await createClient();
//   const { data: { user } } = await supabase.auth.getUser();
//
// Usage API Route (route.ts) :
//   const supabase = await createClient();
//   const { data } = await supabase.from("equipements").select("*");

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Appelé depuis un Server Component — peut être ignoré si
            // un middleware rafraîchit déjà la session utilisateur.
          }
        },
      },
    }
  );
}
