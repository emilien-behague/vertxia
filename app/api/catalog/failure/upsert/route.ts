// Upsert dans le catalogue partagé des pannes par modèle d'équipement.
//
// À chaque intervention où une fuite/panne est détectée, on incrémente
// la fiche (marque, modèle, type_panne, localisation). Données anonymes,
// aucun n° série ni client.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";

export const runtime = "nodejs";

type TypePanne =
  | "fuite"
  | "panne_compresseur"
  | "encrassement"
  | "defaut_ventilateur"
  | "givrage_excessif"
  | "bruit_anormal"
  | "autre";

const VALID_TYPES: TypePanne[] = [
  "fuite",
  "panne_compresseur",
  "encrassement",
  "defaut_ventilateur",
  "givrage_excessif",
  "bruit_anormal",
  "autre",
];

type Body = {
  marque: string;
  modele: string;
  typePanne: TypePanne;
  localisation: string;
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
    const modeleClean = clean(body.modele);
    const localisationClean = clean(body.localisation);
    if (!marqueClean || !modeleClean || !localisationClean) {
      return NextResponse.json(
        { error: "marque, modele, localisation requis" },
        { status: 400 }
      );
    }
    if (
      !body.typePanne ||
      !VALID_TYPES.includes(body.typePanne)
    ) {
      return NextResponse.json(
        { error: "typePanne invalide", validTypes: VALID_TYPES },
        { status: 400 }
      );
    }
    if (marqueClean.length < 2 || marqueClean.length > 60) {
      return NextResponse.json(
        { error: "marque longueur invalide" },
        { status: 400 }
      );
    }
    if (modeleClean.length < 2 || modeleClean.length > 80) {
      return NextResponse.json(
        { error: "modele longueur invalide" },
        { status: 400 }
      );
    }
    if (localisationClean.length < 2 || localisationClean.length > 80) {
      return NextResponse.json(
        { error: "localisation longueur invalide" },
        { status: 400 }
      );
    }

    const marqueKey = normalizeKey(marqueClean);
    const modeleKey = normalizeKey(modeleClean);
    const localisationKey = normalizeKey(localisationClean);

    const supabase = createAnonClient();

    // Lookup pour savoir si la fiche existe
    const { data: existing, error: lookupError } = await supabase
      .from("shared_failure_catalog")
      .select("*")
      .eq("marque_key", marqueKey)
      .eq("modele_key", modeleKey)
      .eq("type_panne", body.typePanne)
      .eq("localisation_key", localisationKey)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json(
        { error: lookupError.message, code: lookupError.code },
        { status: 500 }
      );
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from("shared_failure_catalog")
        .update({
          nombre_occurrences: existing.nombre_occurrences + 1,
          last_seen_at: new Date().toISOString(),
          marque: marqueClean,
          modele: modeleClean,
          localisation: localisationClean,
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
      .from("shared_failure_catalog")
      .insert({
        marque_key: marqueKey,
        modele_key: modeleKey,
        type_panne: body.typePanne,
        localisation_key: localisationKey,
        marque: marqueClean,
        modele: modeleClean,
        localisation: localisationClean,
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
