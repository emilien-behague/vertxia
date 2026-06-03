// Consommation d'un lien magique : le confrère ouvre l'URL avec ?grant=<token>.
//
// POST /api/public/equipement/[id]/grant/redeem
// Body: { token: string }
// → { ok: true } ou { error }
//
// Marque le grant comme utilisé par le visiteur authentifié.
// Idempotent : si déjà utilisé par CE même user → OK. Sinon → erreur.

import { NextResponse } from "next/server";
import { createClient as createCookieClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { token?: string };
    if (!body?.token) {
      return NextResponse.json({ error: "missing token" }, { status: 400 });
    }

    const cookie = await createCookieClient();
    const { data: { user } } = await cookie.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }

    const anon = createAnonClient();
    const { data: grant, error: grantError } = await anon
      .from("equipement_grants")
      .select("id, equipement_id, expires_at, used_by_user_id")
      .eq("token", body.token)
      .eq("equipement_id", id)
      .maybeSingle();

    if (grantError) {
      return NextResponse.json({ error: grantError.message }, { status: 500 });
    }
    if (!grant) {
      return NextResponse.json({ error: "grant introuvable ou révoqué" }, { status: 404 });
    }
    // Expiration
    if (new Date(grant.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "grant expiré" }, { status: 410 });
    }
    // Déjà utilisé par un AUTRE user
    if (grant.used_by_user_id && grant.used_by_user_id !== user.id) {
      return NextResponse.json({ error: "grant déjà utilisé par un autre compte" }, { status: 409 });
    }
    // Déjà utilisé par CE user → idempotent
    if (grant.used_by_user_id === user.id) {
      return NextResponse.json({ ok: true, alreadyRedeemed: true }, { status: 200 });
    }

    const { error: updateError } = await anon
      .from("equipement_grants")
      .update({
        used_by_user_id: user.id,
        used_at: new Date().toISOString(),
      })
      .eq("id", grant.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
