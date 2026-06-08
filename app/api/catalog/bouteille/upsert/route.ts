// Upsert dans le catalogue partagé des bouteilles fluide frigorigène.
//
// À chaque création/édition d'une bouteille dans Vertxia, on enrichit une
// fiche partagée indexée par code-barres normalisé. Le prochain pro qui
// scanne la même bouteille bénéficie automatiquement des données saisies.
//
// Logique :
//   - Si code_barre_key n'existe pas → INSERT avec nombre_scans=1
//   - Si existe → UPDATE nombre_scans++, merge intelligent (les valeurs
//     existantes sont conservées si le nouveau scan ne fournit rien)
//
// Sécurité :
//   - Auth utilisateur requise (anti-spam)
//   - createAnonClient bypass RLS car table sans policy INSERT publique
//   - Validation stricte (longueurs, plages numériques) anti-pollution
//
// Pattern aligné sur /api/catalog/upsert (équipements).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";

export const runtime = "nodejs";

type Body = {
  codeBarre: string;
  gtin14?: string | null;
  gs1Serial?: string | null;
  dateEmbouteillageISO?: string | null;
  marque?: string | null;
  fluideCode?: string | null;
  capaciteMaxKg?: number | null;
  tareKg?: number | null;
  typeBouteille?: "recharge" | "recuperation" | null;
  notes?: string | null;
};

function normalizeCodeBarre(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, "");
}

function clean(s: string | undefined | null): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

/** Valide un nombre dans une plage raisonnable (anti-pollution). */
function validNumberInRange(
  n: number | undefined | null,
  min: number,
  max: number
): number | null {
  if (typeof n !== "number") return null;
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
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

    const codeBarreClean = clean(body.codeBarre);
    if (!codeBarreClean) {
      return NextResponse.json(
        { error: "codeBarre requis" },
        { status: 400 }
      );
    }
    if (codeBarreClean.length < 4 || codeBarreClean.length > 50) {
      return NextResponse.json(
        { error: "codeBarre longueur invalide (4-50 chars)" },
        { status: 400 }
      );
    }

    // Validation des champs numériques (anti-pollution)
    const capaciteMaxKg = validNumberInRange(body.capaciteMaxKg, 0.1, 100);
    const tareKg = validNumberInRange(body.tareKg, 0.1, 100);

    // Validation type
    const typeBouteille =
      body.typeBouteille === "recharge" || body.typeBouteille === "recuperation"
        ? body.typeBouteille
        : null;

    // Validation date ISO
    let dateEmbouteillage: string | null = null;
    if (body.dateEmbouteillageISO) {
      const d = new Date(body.dateEmbouteillageISO);
      if (!isNaN(d.getTime())) {
        dateEmbouteillage = d.toISOString().slice(0, 10);
      }
    }

    const codeKey = normalizeCodeBarre(codeBarreClean);
    const supabase = createAnonClient();

    // 1. Lookup pour savoir si la fiche existe
    const { data: existing, error: lookupError } = await supabase
      .from("shared_bouteille_catalog")
      .select("*")
      .eq("code_barre_key", codeKey)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json(
        { error: lookupError.message, code: lookupError.code },
        { status: 500 }
      );
    }

    if (existing) {
      // 2a. UPDATE — merge intelligent : on garde l'ancien si le nouveau scan
      //     ne fournit pas la donnée. La casse d'affichage est mise à jour.
      const patch = {
        code_barre: codeBarreClean,
        gtin_14: clean(body.gtin14) ?? existing.gtin_14,
        gs1_serial: clean(body.gs1Serial) ?? existing.gs1_serial,
        date_embouteillage_iso: dateEmbouteillage ?? existing.date_embouteillage_iso,
        marque: clean(body.marque) ?? existing.marque,
        fluide_code: clean(body.fluideCode) ?? existing.fluide_code,
        capacite_max_kg: capaciteMaxKg ?? existing.capacite_max_kg,
        tare_kg: tareKg ?? existing.tare_kg,
        type_bouteille: typeBouteille ?? existing.type_bouteille,
        notes: clean(body.notes) ?? existing.notes,
        nombre_scans: existing.nombre_scans + 1,
        last_updated_at: new Date().toISOString(),
      };
      const { error: updateError } = await supabase
        .from("shared_bouteille_catalog")
        .update(patch)
        .eq("id", existing.id);
      if (updateError) {
        return NextResponse.json(
          { error: updateError.message, code: updateError.code },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { ok: true, action: "updated", nombreScans: patch.nombre_scans },
        { status: 200 }
      );
    }

    // 2b. INSERT — première fois qu'on voit ce code-barres
    const { error: insertError } = await supabase
      .from("shared_bouteille_catalog")
      .insert({
        code_barre_key: codeKey,
        code_barre: codeBarreClean,
        gtin_14: clean(body.gtin14),
        gs1_serial: clean(body.gs1Serial),
        date_embouteillage_iso: dateEmbouteillage,
        marque: clean(body.marque),
        fluide_code: clean(body.fluideCode),
        capacite_max_kg: capaciteMaxKg,
        tare_kg: tareKg,
        type_bouteille: typeBouteille,
        notes: clean(body.notes),
        nombre_scans: 1,
        confiance_score: 100,
      });
    if (insertError) {
      return NextResponse.json(
        { error: insertError.message, code: insertError.code },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: true, action: "created", nombreScans: 1 },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
