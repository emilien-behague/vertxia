// Upsert du profil entreprise vers Supabase, server-side.
//
// Pour que le bloc "Technicien referent" s'affiche sur la fiche publique
// /eq/[id] (raison sociale + telephone + email + numero attestation), il
// faut que le profil soit en BDD. Avant : profil local-only -> bloc vide.
//
// L'endpoint upsert dans la table `profiles` keyed par user_id (1 row par
// user). Appele en background depuis lib/profil.ts saveProfil().

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  raisonSociale?: string;
  siret?: string;
  adresseRue?: string;
  adresseCp?: string;
  adresseVille?: string;
  telephone?: string;
  email?: string;
  siteWeb?: string;
  numeroAttestation?: string;
  categorieAttestation?: string;
  organismeAgree?: string;
  dateExpirationAttestation?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }

    // Champs partages publiquement quand un visiteur scanne un QR :
    // raison_sociale, telephone, email, numero_attestation.
    // On reste conservateur sur les colonnes : seulement celles dont on est
    // sur qu'elles existent (lues par /api/public/equipement/[id]) +
    // updated_at standard. Si tu veux pousser aussi siret/adresse/etc.,
    // verifie d'abord que les colonnes existent dans la table profiles.
    const { error } = await supabase.from("profils").upsert(
      {
        user_id: user.id,
        raison_sociale: body.raisonSociale?.trim() || null,
        telephone: body.telephone?.trim() || null,
        email: body.email?.trim() || null,
        numero_attestation: body.numeroAttestation?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
