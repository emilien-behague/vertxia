// Fetch le profil de l'user connecte depuis Supabase.
//
// Sert au multi-device : quand l'user ouvre l'app sur un nouveau navigateur,
// son localStorage est vide. Cette route permet de re-hydrater le profil
// localement depuis la BDD (push via /api/public/profil/upsert effectue a
// chaque saveProfil + une fois par session via hydrate-on-login).

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

    const { data, error } = await supabase
      .from("profils")
      .select("raison_sociale, telephone, email, numero_attestation")
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

    // Map snake_case BDD -> camelCase client
    return NextResponse.json(
      {
        data: {
          raisonSociale: data.raison_sociale ?? "",
          telephone: data.telephone ?? "",
          email: data.email ?? "",
          numeroAttestation: data.numero_attestation ?? "",
        },
      },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
