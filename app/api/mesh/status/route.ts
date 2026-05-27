/**
 * GET /api/mesh/status?id=TASK_ID
 *
 * Interroge Meshy pour le status d'une tâche image-to-3D.
 * Retourne { status, progress, modelUrls?, error? }.
 *
 * Statuts Meshy :
 *   - PENDING / IN_PROGRESS : en cours (3-4 min typique pour UHQ 300k)
 *   - SUCCEEDED : prêt, model_urls.glb contient l'URL du GLB
 *   - FAILED / EXPIRED : erreur
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MESHY_API = "https://api.meshy.ai/openapi/v1";

export async function GET(req: NextRequest) {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "MESHY_API_KEY manquant côté serveur" },
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

  const res = await fetch(`${MESHY_API}/image-to-3d/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Meshy ${res.status}` },
      { status: 502 }
    );
  }

  const data = await res.json();
  return NextResponse.json({
    status: data.status,
    progress: typeof data.progress === "number" ? data.progress : 0,
    modelUrls: data.model_urls || null,
    error: data.task_error || null,
  });
}
