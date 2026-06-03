// Upsert d'une intervention vers Supabase, server-side.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  id: string;
  createdAt: string;
  equipementId?: string;
  typeIntervention: string;
  fluide: { code: string; label: string; gwp: number };
  weight: number;
  packagingNumero?: string;
  clientName?: string | null;
  modeleEquipement?: string;
  numeroSerieEquipement?: string;
  lieuIntervention?: string;
  bsffId?: string;
  controleDetails?: unknown;
  notes?: string;
  hasDetenteurSignature?: boolean;
  detenteurName?: string;
  detenteurQuality?: string;
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
    const { error } = await supabase.from("interventions").upsert(
      {
        id: body.id,
        user_id: user.id,
        equipement_id: body.equipementId ?? null,
        date_iso: body.createdAt,
        type_intervention: body.typeIntervention,
        fluide_code: body.fluide.code,
        fluide_label: body.fluide.label,
        fluide_gwp: body.fluide.gwp,
        weight_kg: body.weight,
        packaging_numero: body.packagingNumero ?? null,
        client_name: body.clientName ?? null,
        modele_equipement: body.modeleEquipement ?? null,
        numero_serie_equipement: body.numeroSerieEquipement ?? null,
        lieu_intervention: body.lieuIntervention ?? null,
        bsff_id: body.bsffId ?? null,
        controle_details: body.controleDetails ?? null,
        notes: body.notes ?? null,
        has_detenteur_signature: body.hasDetenteurSignature ?? false,
        detenteur_name: body.detenteurName ?? null,
        detenteur_quality: body.detenteurQuality ?? null,
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
