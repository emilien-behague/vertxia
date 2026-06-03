// Liste agrégée des interventions sur les équipements de l'utilisateur.
//
// GET /api/public/my-interventions
// → { data: [...] }
//
// Retourne TOUTES les interventions sur les équipements dont l'user est owner,
// peu importe qui (lui-même ou un confrère via lien magique) a réalisé
// l'intervention. Permet à l'owner de voir un historique complet dans
// /m/historique (suivi réglementaire + facturation).

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
    // 1. IDs des équipements dont l'user est owner
    const { data: myEqs, error: eqError } = await anon
      .from("equipements")
      .select("id")
      .eq("user_id", user.id);

    if (eqError) {
      return NextResponse.json({ error: eqError.message }, { status: 500 });
    }
    const eqIds = (myEqs ?? []).map((e) => e.id as string);
    if (eqIds.length === 0) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    // 2. Toutes les interventions sur ces équipements (incluant celles des confrères)
    const { data, error } = await anon
      .from("interventions")
      .select("*")
      .in("equipement_id", eqIds)
      .order("date_iso", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [] }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
