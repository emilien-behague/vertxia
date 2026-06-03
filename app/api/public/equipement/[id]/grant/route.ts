// Génération d'un lien magique pour donner accès à un confrère Vertxia.
//
// POST /api/public/equipement/[id]/grant
// → { token, expiresAt, url }
//
// Seul l'owner de l'équipement peut générer un grant. Validité 24h.

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient as createCookieClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";

export const runtime = "nodejs";

const GRANT_DURATION_MS = 24 * 60 * 60 * 1000; // 24h

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  try {
    const cookie = await createCookieClient();
    const { data: { user } } = await cookie.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }

    const anon = createAnonClient();
    const { data: eq, error: eqError } = await anon
      .from("equipements")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();
    if (eqError || !eq) {
      return NextResponse.json({ error: "equipement not found" }, { status: 404 });
    }
    if (eq.user_id !== user.id) {
      return NextResponse.json({ error: "only owner can grant access" }, { status: 403 });
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + GRANT_DURATION_MS).toISOString();

    const { error: insertError } = await anon.from("equipement_grants").insert({
      equipement_id: id,
      owner_user_id: user.id,
      token,
      expires_at: expiresAt,
    });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Construit l'URL absolue à partager
    const origin = new URL(req.url).origin;
    const url = `${origin}/eq/${encodeURIComponent(id)}?grant=${encodeURIComponent(token)}`;

    return NextResponse.json({ token, expiresAt, url }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
