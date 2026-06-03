// Proxy server-side vers Supabase pour la lecture publique d'un équipement.
//
// IMPORTANT — Stratégie de visibilité :
// Le propriétaire authentifié voit TOUT (mode "full"). Les visiteurs
// (client, concurrent, contrôleur) voient une VUE ÉPURÉE (mode "public") :
//   ✓ Modèle, n°série, fluide (code uniquement)
//   ✓ Statut du contrôle (à jour / à programmer / en retard)
//   ✓ Coordonnées du frigoriste référent (raison sociale + tel + email)
//   ✗ Coordonnées client, historique interventions, charge exacte, GWP, notes
//
// Objectif business : viralité (le client scan → il voit qu'un pro s'occupe
// de lui) SANS donner gratuit la donnée commerciale. Un concurrent qui
// scanne voit "installation déjà suivie par X" et ne peut pas voler.

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
    const isReadOnly = !user || user.id !== data.user_id;

    if (!isReadOnly) {
      // Mode FULL : owner authentifié → toutes les données
      return NextResponse.json({ data, mode: "full", isReadOnly: false }, { status: 200 });
    }

    // Mode PUBLIC : visiteur non-owner → vue épurée + contact du frigoriste owner
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
      { data: publicData, mode: "public", isReadOnly: true, ownerPublic },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
