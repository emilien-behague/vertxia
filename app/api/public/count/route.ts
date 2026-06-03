// Proxy server-side : compte le nombre d'équipements visibles dans Supabase.
// Sert au diagnostic dans /eq/[id] quand un équipement est introuvable.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("equipements")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ count: count ?? 0 }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
