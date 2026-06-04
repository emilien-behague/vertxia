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
    // On veut TOUTES les interventions visibles par l'user :
    //   a) celles qu'il a creees lui-meme (user_id = lui) — INCLUE les
    //      interventions sans equipement_id (creees avant le fix qui pushe
    //      l'id) ou pointant vers un equipement supprime / non-owned
    //   b) celles d'un confrere intervenu via lien magique sur l'un de
    //      ses equipements (= equipement_id IN mes_eq AND user_id != lui)
    //
    // Strategie : 2 queries en parallele + merge par id pour dedup.
    const { data: myEqs, error: eqError } = await anon
      .from("equipements")
      .select("id")
      .eq("user_id", user.id);

    if (eqError) {
      return NextResponse.json({ error: eqError.message }, { status: 500 });
    }
    const eqIds = (myEqs ?? []).map((e) => e.id as string);

    const [ownRes, confrereRes] = await Promise.all([
      // (a) Toutes mes interventions, sans filtre d'equipement
      anon
        .from("interventions")
        .select("*")
        .eq("user_id", user.id)
        .order("date_iso", { ascending: false }),
      // (b) Interventions d'autres users sur mes equipements
      eqIds.length > 0
        ? anon
            .from("interventions")
            .select("*")
            .in("equipement_id", eqIds)
            .neq("user_id", user.id)
            .order("date_iso", { ascending: false })
        : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
    ]);

    if (ownRes.error) {
      return NextResponse.json({ error: ownRes.error.message }, { status: 500 });
    }

    const ownRows = ownRes.data ?? [];
    const confrereRows = confrereRes.error ? [] : (confrereRes.data ?? []);

    // Merge par id
    const byId = new Map<string, Record<string, unknown>>();
    for (const r of ownRows) byId.set(r.id as string, r);
    for (const r of confrereRows) {
      if (!byId.has(r.id as string)) byId.set(r.id as string, r);
    }
    const merged = Array.from(byId.values()).sort((a, b) => {
      const da = (a.date_iso as string) ?? "";
      const db = (b.date_iso as string) ?? "";
      return db.localeCompare(da);
    });

    return NextResponse.json({ data: merged }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
