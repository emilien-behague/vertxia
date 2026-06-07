// Lookup memoire collective des codes erreur.
//
// GET /api/catalog/error-code/lookup?marque=daikin&code=U4
//   → renvoie nb total d'occurrences + repartition par modele (si dispo).
//
// GET /api/catalog/error-code/lookup?marque=daikin&code=U4&modele=RXS35
//   → renvoie nb d'occurrences PRECISES pour ce trio.

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
    const codeRaw = url.searchParams.get("code");
    const modeleRaw = url.searchParams.get("modele");

    if (!marqueRaw || !codeRaw) {
      return NextResponse.json(
        { error: "marque et code requis (query params)" },
        { status: 400 }
      );
    }
    const marqueKey = normalizeKey(marqueRaw);
    const codeKey = normalizeKey(codeRaw);

    if (modeleRaw) {
      // Cas precis : un modele specifique
      const modeleKey = normalizeKey(modeleRaw);
      const { data, error } = await supabase
        .from("shared_error_code_occurrences")
        .select("marque, code, modele, nombre_occurrences, last_seen_at")
        .eq("marque_key", marqueKey)
        .eq("code_key", codeKey)
        .eq("modele_key", modeleKey)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: 500 }
        );
      }

      return NextResponse.json({
        totalOccurrences: data?.nombre_occurrences ?? 0,
        lastSeenAt: data?.last_seen_at ?? null,
        modeles: data
          ? [
              {
                modele: data.modele,
                occurrences: data.nombre_occurrences,
                lastSeenAt: data.last_seen_at,
              },
            ]
          : [],
      });
    }

    // Cas general : toutes les occurrences pour ce (marque, code)
    const { data, error } = await supabase
      .from("shared_error_code_occurrences")
      .select("marque, code, modele, modele_key, nombre_occurrences, last_seen_at")
      .eq("marque_key", marqueKey)
      .eq("code_key", codeKey)
      .order("nombre_occurrences", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 }
      );
    }

    const rows = data ?? [];
    const total = rows.reduce(
      (sum, r) => sum + (r.nombre_occurrences || 0),
      0
    );
    const lastSeen = rows.reduce<string | null>((acc, r) => {
      if (!r.last_seen_at) return acc;
      if (!acc) return r.last_seen_at;
      return r.last_seen_at > acc ? r.last_seen_at : acc;
    }, null);

    return NextResponse.json({
      totalOccurrences: total,
      lastSeenAt: lastSeen,
      modeles: rows
        .filter((r) => r.modele_key && r.modele_key.length > 0)
        .map((r) => ({
          modele: r.modele,
          occurrences: r.nombre_occurrences,
          lastSeenAt: r.last_seen_at,
        })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
