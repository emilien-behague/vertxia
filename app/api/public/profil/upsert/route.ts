// Upsert du profil entreprise vers Supabase, server-side.
//
// Pour que le bloc "Technicien referent" s'affiche sur la fiche publique
// /eq/[id] (raison sociale + telephone + email + numero attestation), il
// faut que le profil soit en BDD. Avant : profil local-only -> bloc vide.
//
// L'endpoint upsert dans la table `profils` keyed par user_id (1 row par
// user). Appele en background depuis lib/profil.ts saveProfil() ET au
// mount /m via hydrate-on-login.

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
  immatriculationVehicule?: string;
  logoDataUrl?: string;
  signatureDataUrl?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }

    // La table profils a email NOT NULL. Si l'utilisateur n'a pas saisi
    // d'email business, on fallback sur l'email auth Google pour ne pas
    // violer la contrainte (le trigger handle_new_user a deja cree la row
    // a l'inscription avec cet email auth, on ne fait que update).
    const emailFinal = body.email?.trim() || user.email || "";

    // On push TOUS les champs supportes par la table profils — comme ca
    // un user qui remplit son profil sur iPhone retrouve TOUT sur ordi
    // (raison sociale, SIRET, adresse, attestation, signature, logo,
    // immatriculation vehicule pour BSFF transport). Les champs vides
    // sont passes comme empty string (default '' dans le schema), sauf
    // signature/logo qui sont nullable.
    const row = {
      user_id: user.id,
      email: emailFinal,
      raison_sociale: body.raisonSociale?.trim() ?? "",
      siret: body.siret?.trim() ?? "",
      adresse: body.adresseRue?.trim() ?? "",
      code_postal: body.adresseCp?.trim() ?? "",
      ville: body.adresseVille?.trim() ?? "",
      telephone: body.telephone?.trim() ?? "",
      categorie_attestation: body.categorieAttestation?.trim() ?? "",
      numero_attestation: body.numeroAttestation?.trim() ?? "",
      immatriculation_vehicule: body.immatriculationVehicule?.trim() ?? "",
      signature_data_url: body.signatureDataUrl?.trim() || null,
      logo_data_url: body.logoDataUrl?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profils").upsert(row, { onConflict: "user_id" });

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
