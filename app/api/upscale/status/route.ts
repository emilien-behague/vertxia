/**
 * GET /api/upscale/status?id=PREDICTION_ID
 *
 * Interroge Replicate pour le status d'une prediction Real-ESRGAN.
 * Retourne { status, output?, error? } pour que le client poll.
 *
 * Statuts Replicate :
 *   - starting    : task créée, en attente
 *   - processing  : inférence en cours (Real-ESRGAN ~15-30s)
 *   - succeeded   : prêt, output contient l'URL du PNG upscalé
 *   - failed      : erreur, error contient le message
 *   - canceled    : annulée
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const REPLICATE_API = "https://api.replicate.com/v1";

export async function GET(req: NextRequest) {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN manquant côté serveur" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Paramètre id manquant" },
      { status: 400 }
    );
  }

  const res = await fetch(`${REPLICATE_API}/predictions/${id}`, {
    headers: { Authorization: `Token ${apiKey}` },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Replicate ${res.status}` },
      { status: 502 }
    );
  }

  const data = await res.json();
  // L'output de nightmareai/real-esrgan est une string URL (PNG)
  return NextResponse.json({
    status: data.status,
    output: typeof data.output === "string" ? data.output : null,
    error: data.error || null,
  });
}
