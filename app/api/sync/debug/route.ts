// Endpoint de diagnostic sync — utilise par /m/sync-debug pour montrer en
// clair pourquoi les donnees ne sont pas presentes sur ce device.
//
// Retourne :
//   - auth : statut connexion + user_id + email
//   - counts : nb equipements + interventions + diagnostics en BDD pour cet
//              user (via RLS, donc reflete ce que le client peut voir aussi)
//   - profil : true/false (rempli au moins partiellement en BDD)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          auth: { connected: false, error: authError?.message || "Pas de session" },
          counts: { equipements: 0, interventions: 0, diagnostics: 0 },
          profil: { exists: false },
        },
        { status: 200 }
      );
    }

    // Counts en parallele (chacun retourne {count} via head:true)
    const [eqRes, interRes, diagRes, profilRes] = await Promise.all([
      supabase.from("equipements").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("interventions").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("diagnostics").select("*", { count: "exact", head: true }).eq("user_id", user.id).then(
        (r) => r,
        () => ({ count: null, error: { message: "table diagnostics absente" } } as { count: number | null; error: { message: string } })
      ),
      supabase.from("profils").select("raison_sociale, telephone, email, numero_attestation").eq("user_id", user.id).maybeSingle(),
    ]);

    const profilHasData = Boolean(
      profilRes.data &&
        (profilRes.data.raison_sociale ||
          profilRes.data.telephone ||
          profilRes.data.email ||
          profilRes.data.numero_attestation)
    );

    return NextResponse.json(
      {
        auth: {
          connected: true,
          userId: user.id,
          email: user.email ?? null,
        },
        counts: {
          equipements: eqRes.count ?? 0,
          interventions: interRes.count ?? 0,
          diagnostics: diagRes.count ?? 0,
        },
        errors: {
          equipements: eqRes.error?.message ?? null,
          interventions: interRes.error?.message ?? null,
          diagnostics: diagRes.error?.message ?? null,
          profil: profilRes.error?.message ?? null,
        },
        profil: {
          exists: Boolean(profilRes.data),
          hasData: profilHasData,
          raisonSociale: profilRes.data?.raison_sociale ?? null,
          telephone: profilRes.data?.telephone ?? null,
          email: profilRes.data?.email ?? null,
          numeroAttestation: profilRes.data?.numero_attestation ?? null,
        },
      },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
