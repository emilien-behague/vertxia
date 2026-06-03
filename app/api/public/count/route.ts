// Proxy server-side : compte le nombre d'équipements visibles dans Supabase.
// Client anon (sans cookies) → la policy "select_public" autorise le rôle
// anon, sans filtrer par auth.uid().

import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";

export const runtime = "nodejs";

export async function GET() {
  try {
    const anon = createAnonClient();
    const { count, error } = await anon
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
