// Fetch le profil de l'user connecte depuis Supabase.
//
// Sert au multi-device : quand l'user ouvre l'app sur un nouveau navigateur,
// son localStorage est vide. Cette route re-hydrate le profil localement
// depuis la BDD (push via /api/public/profil/upsert effectue a chaque
// saveProfil + au mount /m via hydrate-on-login).
//
// Retourne TOUS les champs supportes par la table profils — raison sociale,
// SIRET, adresse, attestation, signature, logo, immatriculation vehicule —
// pour que le passage iPhone -> ordi (ou inverse) ne perde rien.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }

    // SELECT * (au lieu de lister les colonnes) pour etre robuste si la
    // BDD prod n'a pas EXACTEMENT toutes les colonnes du schema.sql (ex:
    // signature_data_url ajoutee plus tard dans une migration manuelle).
    // On map en safe avec defaults cote serveur.
    const { data, error } = await supabase
      .from("profils")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ data: null }, { status: 200 });
    }

    // Map snake_case BDD -> camelCase client (aligne sur le type Profil
    // dans lib/profil.ts).
    return NextResponse.json(
      {
        data: {
          raisonSociale: data.raison_sociale ?? "",
          siret: data.siret ?? "",
          adresseRue: data.adresse ?? "",
          adresseCp: data.code_postal ?? "",
          adresseVille: data.ville ?? "",
          telephone: data.telephone ?? "",
          email: data.email ?? "",
          categorieAttestation: data.categorie_attestation ?? "",
          numeroAttestation: data.numero_attestation ?? "",
          immatriculationVehicule: data.immatriculation_vehicule ?? "",
          signatureDataUrl: data.signature_data_url ?? undefined,
          logoDataUrl: data.logo_data_url ?? undefined,
        },
      },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
