// Proxy server-side vers Supabase pour la lecture publique des interventions
// liées à un équipement. Client anon (sans cookies) pour bypass RLS user-scope.

import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const equipementId = url.searchParams.get("equipementId");
  if (!equipementId) {
    return NextResponse.json({ error: "missing equipementId" }, { status: 400 });
  }

  try {
    const anon = createAnonClient();
    const { data, error } = await anon
      .from("interventions")
      .select("*")
      .eq("equipement_id", equipementId)
      .order("date_iso", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [] }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
