// Route de diagnostic complète server-side.
// Retourne TOUT ce dont le client a besoin pour comprendre pourquoi un
// équipement n'est pas trouvable : env vars, count anon, user visiteur,
// erreur Supabase exacte.

import { NextResponse } from "next/server";
import { createClient as createCookieClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const probeId = url.searchParams.get("id");

  const diag: Record<string, unknown> = {};

  // 1. Env vars
  diag.env = {
    SUPABASE_URL_set: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_PUBLISHABLE_KEY_set: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    SUPABASE_SERVICE_ROLE_KEY_set: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    SUPABASE_URL_host: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : null,
  };

  // 2. Lecture anon — count + un sample
  try {
    const anon = createAnonClient();
    const { count, error: countError } = await anon
      .from("equipements")
      .select("id", { count: "exact", head: true });
    diag.anonCount = count;
    diag.anonCountError = countError?.message ?? null;

    const { data: sample, error: sampleError } = await anon
      .from("equipements")
      .select("id, user_id, modele")
      .limit(3);
    diag.anonSample = sample;
    diag.anonSampleError = sampleError?.message ?? null;

    if (probeId) {
      const { data: probe, error: probeError } = await anon
        .from("equipements")
        .select("id, user_id, modele")
        .eq("id", probeId)
        .maybeSingle();
      diag.anonProbe = probe;
      diag.anonProbeError = probeError?.message ?? null;
    }
  } catch (e) {
    diag.anonClientCrash = e instanceof Error ? e.message : String(e);
  }

  // 3. Identité visiteur via cookies
  try {
    const cookie = await createCookieClient();
    const { data: { user } } = await cookie.auth.getUser();
    diag.visitor = user
      ? { id: user.id, email: user.email ?? null }
      : null;
  } catch (e) {
    diag.visitorError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(diag, { status: 200 });
}
