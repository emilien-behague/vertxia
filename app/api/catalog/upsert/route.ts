// Upsert dans le catalogue partagé d'équipements.
//
// À chaque scan de plaque signalétique, on enrichit une fiche modèle
// anonymisée (marque + modèle uniquement, aucun n° série ni client).
// Le prochain technicien qui scanne le même modèle bénéficie de la fiche.
//
// Logique :
//   - Si (marque_key, modele_key) n'existe pas → INSERT avec nombre_scans=1
//   - Si existe → UPDATE nombre_scans++, last_updated_at = now(),
//     et merge les champs (on garde les valeurs existantes si le nouveau
//     scan ne fournit rien sur ce champ).
//
// Sécurité :
//   - Utilise createAnonClient() qui privilégie service_role (bypass RLS)
//     car la table n'a pas de policy INSERT publique.
//   - Auth requise (un user connecté Vertxia, mais user_id non stocké :
//     les données sont anonymes pour la mutualisation).
//   - Validation stricte des inputs (longueurs, types) pour éviter
//     la pollution du catalogue par des scans bidons.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";

export const runtime = "nodejs";

type Body = {
  marque: string;
  modele: string;
  fluideCode?: string | null;
  fluideLabel?: string | null;
  fluideGwp?: number | null;
  chargeNominaleKg?: number | null;
  typeEquipement?: string | null;
};

/**
 * Normalise une marque/modèle pour la clé naturelle :
 * trim, lowercase, compacte les espaces multiples. Pas de suppression
 * d'accents (les marques principales n'en ont pas et un retrait pourrait
 * fusionner à tort des modèles distincts).
 */
function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Cleanup d'une valeur user-supplied : trim, evite chaines vides. */
function clean(s: string | undefined | null): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

export async function POST(req: Request) {
  try {
    // Auth requise — pas un endpoint anonyme. Empêche le spam external.
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
    if (!marqueClean || !modeleClean) {
      return NextResponse.json(
        { error: "marque et modele requis" },
        { status: 400 }
      );
    }
    // Garde-fou anti-pollution : longueurs raisonnables
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
    // Garde-fou charge : entre 0 et 500kg (au-delà = pollution)
    const chargeKg =
      typeof body.chargeNominaleKg === "number" &&
      body.chargeNominaleKg > 0 &&
      body.chargeNominaleKg < 500
        ? body.chargeNominaleKg
        : null;

    const marqueKey = normalizeKey(marqueClean);
    const modeleKey = normalizeKey(modeleClean);

    const supabase = createAnonClient();

    // 1. Lookup pour savoir si la fiche existe
    const { data: existing, error: lookupError } = await supabase
      .from("shared_equipment_catalog")
      .select("*")
      .eq("marque_key", marqueKey)
      .eq("modele_key", modeleKey)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json(
        { error: lookupError.message, code: lookupError.code },
        { status: 500 }
      );
    }

    if (existing) {
      // 2a. UPDATE — incrémente nombre_scans + merge intelligent (garde
      //     les valeurs existantes si le nouveau scan ne fournit rien)
      const patch = {
        // Mise à jour des affichables pour avoir la casse du plus récent
        marque: marqueClean,
        modele: modeleClean,
        // Merge fluide : si nouveau scan fournit un fluide, on prend
        // le nouveau. Sinon on garde l'ancien.
        fluide_code: clean(body.fluideCode) ?? existing.fluide_code,
        fluide_label: clean(body.fluideLabel) ?? existing.fluide_label,
        fluide_gwp: body.fluideGwp ?? existing.fluide_gwp,
        charge_nominale_kg: chargeKg ?? existing.charge_nominale_kg,
        type_equipement: clean(body.typeEquipement) ?? existing.type_equipement,
        nombre_scans: existing.nombre_scans + 1,
        last_updated_at: new Date().toISOString(),
      };
      const { error: updateError } = await supabase
        .from("shared_equipment_catalog")
        .update(patch)
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
          nombreScans: patch.nombre_scans,
        },
        { status: 200 }
      );
    }

    // 2b. INSERT — première fois qu'on voit ce modèle
    const { error: insertError } = await supabase
      .from("shared_equipment_catalog")
      .insert({
        marque_key: marqueKey,
        modele_key: modeleKey,
        marque: marqueClean,
        modele: modeleClean,
        fluide_code: clean(body.fluideCode),
        fluide_label: clean(body.fluideLabel),
        fluide_gwp: body.fluideGwp ?? null,
        charge_nominale_kg: chargeKg,
        type_equipement: clean(body.typeEquipement),
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
