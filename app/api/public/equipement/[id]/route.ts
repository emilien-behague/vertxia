// Proxy server-side vers Supabase pour la lecture publique d'un équipement.
// Évite les blocages Safari iOS (ITP, CORS) en passant par le serveur Next.js.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const supabase = await createClient();
    const { data, error } = await supabase
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
      return NextResponse.json({ data: null, isReadOnly: true }, { status: 200 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    const isReadOnly = !user || user.id !== data.user_id;

    return NextResponse.json({ data, isReadOnly }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
