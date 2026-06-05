// Lookup dans le catalogue partagé d'équipements.
//
// Le client (ScanPlaqueButton, formulaire création équipement) appelle
// cette route avec marque+modele. Si la fiche existe → renvoie les données
// agrégées (fluide, charge, type) + nombre_scans pour afficher le badge
// "Modèle vérifié par N frigoristes".
//
// Sécurité : la table a une policy SELECT pour les utilisateurs
// authentifiés, donc on utilise le client cookies-aware (auth requise).

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
      .from("shared_equipment_catalog")
      .select(
        "marque, modele, fluide_code, fluide_label, fluide_gwp, charge_nominale_kg, type_equipement, nombre_scans, confiance_score, first_seen_at, last_updated_at"
      )
      .eq("marque_key", marqueKey)
      .eq("modele_key", modeleKey)
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
          marque: data.marque,
          modele: data.modele,
          fluideCode: data.fluide_code,
          fluideLabel: data.fluide_label,
          fluideGwp: data.fluide_gwp,
          chargeNominaleKg: data.charge_nominale_kg
            ? Number(data.charge_nominale_kg)
            : null,
          typeEquipement: data.type_equipement,
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
