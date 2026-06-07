// Upsert dans le catalogue partage des codes erreur.
//
// Appele quand un user consulte un code erreur dans /m/codes-erreur ou que
// l'IA chat / vision-diagnostic detecte un code. On incremente le compteur
// pour (marque, code, modele?).
//
// Donnees anonymes : aucun n°serie, aucun client.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";

export const runtime = "nodejs";

type Body = {
  marque: string;
  code: string;
  /** Optionnel : si fourni, on track aussi par modele. */
  modele?: string;
};

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function clean(s: string | undefined | null): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

export async function POST(req: Request) {
  try {
    const supabaseUser = await createClient();
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }

    const body = (await req.json()) as Body;

    const marqueClean = clean(body.marque);
    const codeClean = clean(body.code);
    const modeleClean = clean(body.modele);

    if (!marqueClean || !codeClean) {
      return NextResponse.json(
        { error: "marque et code requis" },
        { status: 400 }
      );
    }
    if (marqueClean.length < 2 || marqueClean.length > 60) {
      return NextResponse.json(
        { error: "marque longueur invalide" },
        { status: 400 }
      );
    }
    if (codeClean.length < 1 || codeClean.length > 30) {
      return NextResponse.json(
        { error: "code longueur invalide" },
        { status: 400 }
      );
    }
    if (modeleClean && (modeleClean.length < 2 || modeleClean.length > 80)) {
      return NextResponse.json(
        { error: "modele longueur invalide" },
        { status: 400 }
      );
    }

    const marqueKey = normalizeKey(marqueClean);
    const codeKey = normalizeKey(codeClean);
    const modeleKey = modeleClean ? normalizeKey(modeleClean) : "";

    const supabase = createAnonClient();

    // Lookup
    const { data: existing, error: lookupError } = await supabase
      .from("shared_error_code_occurrences")
      .select("*")
      .eq("marque_key", marqueKey)
      .eq("code_key", codeKey)
      .eq("modele_key", modeleKey)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json(
        { error: lookupError.message, code: lookupError.code },
        { status: 500 }
      );
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from("shared_error_code_occurrences")
        .update({
          nombre_occurrences: existing.nombre_occurrences + 1,
          last_seen_at: new Date().toISOString(),
          marque: marqueClean,
          code: codeClean,
          modele: modeleClean,
        })
        .eq("id", existing.id);
      if (updateError) {
        return NextResponse.json(
          { error: updateError.message, code: updateError.code },
          { status: 500 }
        );
      }
      return NextResponse.json(
        {
          ok: true,
          action: "updated",
          nombreOccurrences: existing.nombre_occurrences + 1,
        },
        { status: 200 }
      );
    }

    const { error: insertError } = await supabase
      .from("shared_error_code_occurrences")
      .insert({
        marque_key: marqueKey,
        code_key: codeKey,
        modele_key: modeleKey,
        marque: marqueClean,
        code: codeClean,
        modele: modeleClean,
        nombre_occurrences: 1,
      });
    if (insertError) {
      return NextResponse.json(
        { error: insertError.message, code: insertError.code },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: true, action: "created", nombreOccurrences: 1 },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
