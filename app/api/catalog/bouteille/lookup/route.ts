// Lookup dans le catalogue partagé des bouteilles fluide frigorigène.
//
// Appelé depuis :
//  - /api/vision/bouteille : AVANT d'appeler Claude Vision, on vérifie si
//    le code-barres est déjà connu par d'autres pros Vertxia.
//  - /m/bouteilles/nouvelle (lookup direct client si scan offline).
//
// Pattern aligné sur /api/catalog/lookup (équipements).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Normalise un code-barres pour la clé naturelle : trim, uppercase, sans espaces. */
function normalizeCodeBarre(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, "");
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }

    const url = new URL(req.url);
    const codeRaw = url.searchParams.get("code");

    if (!codeRaw) {
      return NextResponse.json(
        { error: "code requis (query param)" },
        { status: 400 }
      );
    }
    const codeKey = normalizeCodeBarre(codeRaw);
    if (codeKey.length < 4) {
      return NextResponse.json(
        { error: "code trop court (min 4 chars)" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("shared_bouteille_catalog")
      .select(
        "code_barre, gtin_14, gs1_serial, date_embouteillage_iso, marque, fluide_code, capacite_max_kg, tare_kg, type_bouteille, notes, nombre_scans, confiance_score, first_seen_at, last_updated_at"
      )
      .eq("code_barre_key", codeKey)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    return NextResponse.json(
      {
        found: true,
        fiche: {
          codeBarre: data.code_barre,
          gtin14: data.gtin_14,
          gs1Serial: data.gs1_serial,
          dateEmbouteillageISO: data.date_embouteillage_iso,
          marque: data.marque,
          fluideCode: data.fluide_code,
          capaciteMaxKg: data.capacite_max_kg ? Number(data.capacite_max_kg) : null,
          tareKg: data.tare_kg ? Number(data.tare_kg) : null,
          typeBouteille: data.type_bouteille,
          notes: data.notes,
          nombreScans: data.nombre_scans,
          confianceScore: data.confiance_score,
          firstSeenAt: data.first_seen_at,
          lastUpdatedAt: data.last_updated_at,
        },
      },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
