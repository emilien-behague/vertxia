// Liste de TOUS les equipements de l'utilisateur connecte.
//
// GET /api/public/my-equipements
// -> { data: [...] }
//
// Sert a hydrater le localStorage quand l'user se reconnecte sur un nouveau
// device (ex: telephone -> ordi). Le sync push (upsert) existe deja sur
// chaque save local. Cet endpoint est le pull manquant.

import { NextResponse } from "next/server";
import { createClient as createCookieClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookie = await createCookieClient();
    const { data: { user } } = await cookie.auth.getUser();
    if (!user) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    const anon = createAnonClient();
    const { data, error } = await anon
      .from("equipements")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [] }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
