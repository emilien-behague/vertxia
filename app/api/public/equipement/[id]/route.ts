// Proxy server-side vers Supabase pour la lecture publique d'un équipement.
//
// IMPORTANT — Stratégie de visibilité (4 niveaux d'accès) :
//
// 1. Visiteur ANONYME (pas de compte) → mode "public"
//    = vue épurée : modèle, n°série, fluide (code SEUL), statut, contact pro.
//    ✗ Pas de charge, GWP, dernier contrôle, unités, client, notes, historique.
//
// 2. Confrère d'une AUTRE boîte (compte Vertxia, jamais intervenu) → mode "confrere"
//    = vue épurée + données TECHNIQUES OBJECTIVES de la machine :
//    ✓ modèle, n°série, fluide complet (code+GWP), charge, dernier contrôle,
//      détecteur, unités intérieures, contact pro
//    ✗ PAS de client (nom/email/tel/adresse), PAS de notes, PAS d'historique
//    Permet de reprendre une machine techniquement sans voler la donnée
//    commerciale du frigoriste précédent.
//
// 3. Technicien AYANT DÉJÀ INTERVENU sur cet eq → mode "full"
//    = vue complète (le pro a déjà été "admis" par une 1ère intervention).
//    Peut démarrer de nouvelles interventions.
//
// 4. Owner (créateur de l'eq) → mode "full" + isOwner=true
//    = vue complète + toutes actions (relance client, QR PDF, etc.).
//
// Objectif business : un concurrent qui scanne ne peut pas voler les clients
// du frigoriste owner. Mais il peut techniquement reprendre la machine si
// l'owner l'admet via une 1ère intervention.

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

    // Récupération du contact pro (owner Vertxia) — visible dans tous les
    // modes sauf "full owner" (l'owner connaît déjà ses propres coordonnées).
    const { data: ownerProfil } = await anon
      .from("profils")
      .select("raison_sociale, telephone, email, numero_attestation")
      .eq("user_id", data.user_id)
      .maybeSingle();

    const ownerPublic = ownerProfil
      ? {
          raisonSociale: ownerProfil.raison_sociale || null,
          telephone: ownerProfil.telephone || null,
          email: ownerProfil.email || null,
          numeroAttestation: ownerProfil.numero_attestation || null,
        }
      : null;

    if (isAuth) {
      // Vérification : ce visiteur a-t-il été ADMIS sur cet équipement ?
      // Il y a 2 voies d'admission :
      //   (a) Il a déjà fait au moins 1 intervention sur l'eq (mécanique
      //       automatique pour les techniciens en cours de mission).
      //   (b) Il a consommé un "grant" (lien magique) émis par l'owner.
      let hasIntervened = false;
      let hasGrant = false;
      if (!isOwner) {
        const { count: prevCount } = await anon
          .from("interventions")
          .select("id", { count: "exact", head: true })
          .eq("equipement_id", data.id)
          .eq("user_id", user!.id);
        hasIntervened = (prevCount ?? 0) > 0;

        const { count: grantCount } = await anon
          .from("equipement_grants")
          .select("id", { count: "exact", head: true })
          .eq("equipement_id", data.id)
          .eq("used_by_user_id", user!.id)
          .gte("expires_at", new Date().toISOString());
        hasGrant = (grantCount ?? 0) > 0;
      }

      const canCreateIntervention = isOwner || hasIntervened || hasGrant;

      // Debug payload pour comprendre pourquoi un visiteur est en
      // "confrere" alors qu'il devrait être en "full" via un grant.
      const debug = {
        userId: user!.id,
        isOwner,
        hasIntervened,
        hasGrant,
        ownerUserId: data.user_id,
      };

      if (isOwner || hasIntervened || hasGrant) {
        // Mode FULL : voit TOUT (client, notes, historique, etc.)
        return NextResponse.json(
          {
            data,
            mode: "full",
            isOwner,
            isReadOnly: !isOwner,
            canCreateIntervention,
            ownerPublic: isOwner ? null : ownerPublic, // owner connaît ses propres infos
            debug,
          },
          { status: 200 }
        );
      }

      // Mode CONFRERE : confrère authentifié d'une autre boîte qui n'a jamais
      // intervenu. Voit la donnée TECHNIQUE objective de la machine + contact
      // pro, MAIS pas la donnée commerciale (client, notes, historique).
      const confrereData = {
        id: data.id,
        created_at: data.created_at,
        modele: data.modele,
        numero_serie: data.numero_serie,
        fluide_code: data.fluide_code,
        fluide_label: data.fluide_label,
        fluide_gwp: data.fluide_gwp,
        charge_kg: data.charge_kg,
        detecteur_fixe: data.detecteur_fixe,
        dernier_controle_iso: data.dernier_controle_iso,
        unites_interieures: data.unites_interieures ?? [],
        user_id: data.user_id,
        // ❌ client_name, client_email, client_telephone, site_adresse, notes
      };
      return NextResponse.json(
        {
          data: confrereData,
          mode: "confrere",
          isOwner: false,
          isReadOnly: true,
          canCreateIntervention: false,
          ownerPublic,
          debug,
        },
        { status: 200 }
      );
    }

    // Mode PUBLIC : visiteur NON authentifié → vue épurée pure

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

/**
 * Suppression d'un équipement — owner uniquement.
 *
 * DELETE /api/public/equipement/[id]
 * → { ok: true } ou { error }
 *
 * Cascade :
 *   - Les interventions liées (equipement_id FK) sont supprimées si la
 *     contrainte ON DELETE CASCADE est posée (schema.sql).
 *   - Les grants liés (equipement_id FK) idem.
 * En l'absence de CASCADE, on les supprime explicitement avant l'eq.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  try {
    const cookieClient = await createCookieClient();
    const { data: { user } } = await cookieClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }

    const anon = createAnonClient();
    const { data: eq, error: eqError } = await anon
      .from("equipements")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();
    if (eqError) {
      return NextResponse.json({ error: eqError.message }, { status: 500 });
    }
    if (!eq) {
      // Idempotent : si déjà supprimé côté serveur, on renvoie OK
      return NextResponse.json({ ok: true, alreadyDeleted: true }, { status: 200 });
    }
    if (eq.user_id !== user.id) {
      return NextResponse.json(
        { error: "only owner can delete this equipement" },
        { status: 403 }
      );
    }

    // Suppression explicite des dépendances pour éviter les FK errors si
    // ON DELETE CASCADE n'est pas configuré côté schema. Idempotent.
    await anon.from("interventions").delete().eq("equipement_id", id);
    await anon.from("equipement_grants").delete().eq("equipement_id", id);

    const { error: deleteError } = await anon
      .from("equipements")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
