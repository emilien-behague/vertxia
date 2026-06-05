// Lookup dans le catalogue partagé des pannes pour un modèle d'équipement.
// Retourne la liste agrégée des pannes connues, triée par fréquence desc.
//
// Utilisé par la fiche /eq/[id] pour afficher "Pannes connues sur ce modèle
// dans Vertxia" et par les flux diagnostic IA pour enrichir le prompt.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
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
    const marqueRaw = url.searchParams.get("marque");
    const modeleRaw = url.searchParams.get("modele");

    if (!marqueRaw || !modeleRaw) {
      return NextResponse.json(
        { error: "marque et modele requis (query params)" },
        { status: 400 }
      );
    }
    const marqueKey = normalizeKey(marqueRaw);
    const modeleKey = normalizeKey(modeleRaw);

    const { data, error } = await supabase
      .from("shared_failure_catalog")
      .select("marque, modele, type_panne, localisation, nombre_occurrences, last_seen_at")
      .eq("marque_key", marqueKey)
      .eq("modele_key", modeleKey)
      .order("nombre_occurrences", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        pannes: (data ?? []).map((row) => ({
          typePanne: row.type_panne,
          localisation: row.localisation,
          nombreOccurrences: row.nombre_occurrences,
          lastSeenAt: row.last_seen_at,
        })),
        totalOccurrences: (data ?? []).reduce(
          (sum, row) => sum + (row.nombre_occurrences || 0),
          0
        ),
      },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
