// Proxy server-side vers Supabase pour la lecture publique d'un équipement.
//
// IMPORTANT — Stratégie de visibilité (3 niveaux) :
// 1. Visiteur NON authentifié (client, contrôleur, anonyme) → mode "public"
//    = vue épurée : modèle, n°série, fluide (code), statut, contact pro.
//    ✗ Pas de coordonnées client, charge, GWP, historique, notes.
// 2. Confrère AUTHENTIFIÉ non-owner → mode "full" mais isOwner=false
//    = vue complète (consultation pleine) MAIS pas d'actions d'édition.
//    Sert la collaboration inter-frigoristes (sous-traitance, dépannage).
// 3. Owner AUTHENTIFIÉ → mode "full" + isOwner=true
//    = vue complète + actions d'édition (démarrer intervention, relance, etc.).
//
// Objectif business : viralité préservée pour les visiteurs anonymes
// (client scan → il voit qu'un pro s'occupe) + collaboration entre pros
// Vertxia (création de compte = ticket d'entrée pour voir le détail).

import { NextResponse } from "next/server";
import { createClient as createCookieClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  try {
    const anon = createAnonClient();
    const { data, error } = await anon
      .from("equipements")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json({ data: null, mode: "public" }, { status: 200 });
    }

    const cookieClient = await createCookieClient();
    const { data: { user } } = await cookieClient.auth.getUser();
    const isAuth = Boolean(user);
    const isOwner = isAuth && user!.id === data.user_id;

    if (isAuth) {
      // Mode FULL : authentifié (owner OU confrère) → toutes les données.
      // isReadOnly = false uniquement pour le owner (= peut éditer la fiche).
      //
      // canCreateIntervention = peut démarrer une NOUVELLE intervention sur
      // cet équipement. Vrai si :
      //   - owner (toujours)
      //   - OU technicien ayant déjà fait au moins 1 intervention sur l'eq
      // (un frigoriste tiers qui n'a jamais touché à la machine ne peut pas
      //  créer une intervention dessus — il doit d'abord être "admis" via une
      //  première intervention de prise en charge initiée par l'owner).
      let canCreateIntervention = isOwner;
      if (!isOwner) {
        const { count: prevCount } = await anon
          .from("interventions")
          .select("id", { count: "exact", head: true })
          .eq("equipement_id", data.id)
          .eq("user_id", user!.id);
        canCreateIntervention = (prevCount ?? 0) > 0;
      }
      return NextResponse.json(
        { data, mode: "full", isOwner, isReadOnly: !isOwner, canCreateIntervention },
        { status: 200 }
      );
    }

    // Mode PUBLIC : visiteur NON authentifié → vue épurée + contact pro
    const { data: ownerProfil } = await anon
      .from("profils")
      .select("raison_sociale, telephone, email, numero_attestation")
      .eq("user_id", data.user_id)
      .maybeSingle();

    const publicData = {
      id: data.id,
      created_at: data.created_at,
      modele: data.modele,
      numero_serie: data.numero_serie,
      fluide_code: data.fluide_code,
      fluide_label: data.fluide_label,
      // On garde la date du dernier contrôle pour CALCULER le statut côté
      // client, mais on masquera la date exacte à l'affichage.
      dernier_controle_iso: data.dernier_controle_iso,
      detecteur_fixe: data.detecteur_fixe,
      // Charge approchée pour calc statut (tCO2eq) mais sera masquée à l'affichage
      charge_kg: data.charge_kg,
      fluide_gwp: data.fluide_gwp,
      // Nombre d'unités intérieures (pas le détail)
      unites_count: Array.isArray(data.unites_interieures) ? data.unites_interieures.length : 0,
      user_id: data.user_id,
      // ❌ Pas de client_name, client_email, client_telephone, site_adresse
      // ❌ Pas de notes
      // ❌ Pas de unites_interieures détaillées
    };

    const ownerPublic = ownerProfil
      ? {
          raisonSociale: ownerProfil.raison_sociale || null,
          telephone: ownerProfil.telephone || null,
          email: ownerProfil.email || null,
          numeroAttestation: ownerProfil.numero_attestation || null,
        }
      : null;

    return NextResponse.json(
      {
        data: publicData,
        mode: "public",
        isOwner: false,
        isReadOnly: true,
        canCreateIntervention: false,
        ownerPublic,
      },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
