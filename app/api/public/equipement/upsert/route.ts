// Upsert d'un équipement vers Supabase, server-side.
// Le client browser POSTe son objet StoredEquipement, le serveur résout
// user_id via la session cookie (créée par Google OAuth callback) et insert.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  id: string;
  createdAt?: string;
  clientName: string;
  clientEmail?: string;
  clientTelephone?: string;
  siteAdresse?: string;
  modele: string;
  numeroSerie: string;
  fluide: { code: string; label: string; gwp: number };
  chargeKg: number;
  detecteurFixe: boolean;
  dernierControleISO?: string;
  unitesInterieures?: unknown[];
  notes?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.id) {
      return NextResponse.json({ error: "missing id" }, { status: 400 });
    }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "not authenticated" }, { status: 401 });
    }
    const { error } = await supabase.from("equipements").upsert(
      {
        id: body.id,
        user_id: user.id,
        client_name: body.clientName,
        client_email: body.clientEmail ?? null,
        client_telephone: body.clientTelephone ?? null,
        site_adresse: body.siteAdresse ?? null,
        modele: body.modele,
        numero_serie: body.numeroSerie,
        fluide_code: body.fluide.code,
        fluide_label: body.fluide.label,
        fluide_gwp: body.fluide.gwp,
        charge_kg: body.chargeKg,
        detecteur_fixe: body.detecteurFixe,
        dernier_controle_iso: body.dernierControleISO ?? null,
        unites_interieures: body.unitesInterieures ?? [],
        notes: body.notes ?? null,
      },
      { onConflict: "id" }
    );
    if (error) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
