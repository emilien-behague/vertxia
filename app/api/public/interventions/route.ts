// Proxy server-side vers Supabase pour la lecture publique des interventions
// liées à un équipement.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const equipementId = url.searchParams.get("equipementId");
  if (!equipementId) {
    return NextResponse.json({ error: "missing equipementId" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
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
