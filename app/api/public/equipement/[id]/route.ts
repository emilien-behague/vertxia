// Proxy server-side vers Supabase pour la lecture publique d'un équipement.
// Évite les blocages Safari iOS (ITP, CORS) en passant par le serveur Next.js.
//
// IMPORTANT : on utilise un client Supabase ANON (sans cookies) pour la
// lecture, sinon RLS filtre les rows par auth.uid() du visiteur → un
// utilisateur connecté ne pourrait pas voir les équipements créés par un
// autre compte. La policy "equipements_select_public USING (true)" autorise
// le rôle anon à tout lire ; c'est le partage Niveau 1 voulu.
//
// On utilise quand même createClient (cookies) en parallèle pour récupérer
// l'identité du visiteur si connecté → calcul du flag isReadOnly.

import { NextResponse } from "next/server";
import { createClient as createCookieClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  try {
    const anon = createAnonClient();
    const { data, error } = await anon
      .from("equipements")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json({ data: null, isReadOnly: true }, { status: 200 });
    }

    // Identité du visiteur (pour isReadOnly) — via cookies de session.
    const cookieClient = await createCookieClient();
    const { data: { user } } = await cookieClient.auth.getUser();
    const isReadOnly = !user || user.id !== data.user_id;

    return NextResponse.json({ data, isReadOnly }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
