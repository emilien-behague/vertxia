/**
 * POST /api/mesh/start
 *
 * Lance une tâche Meshy image-to-3D (UHQ : meshy-6, 300k poly quad, PBR).
 * Retourne le taskId pour que le client poll le status.
 *
 * Note : Meshy retourne soit 200 OK soit 202 Accepted selon la version d'API.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MESHY_API = "https://api.meshy.ai/openapi/v1";

export async function POST(req: NextRequest) {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "MESHY_API_KEY manquant côté serveur" },
      { status: 500 }
    );
  }

  let imageUrl: string;
  try {
    const body = await req.json();
    if (typeof body.imageUrl !== "string" || body.imageUrl.length < 10) {
      return NextResponse.json({ error: "imageUrl invalide" }, { status: 400 });
    }
    imageUrl = body.imageUrl;
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const res = await fetch(`${MESHY_API}/image-to-3d`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: imageUrl,
      ai_model: "meshy-6",
      topology: "quad",
      target_polycount: 300000,
      should_remesh: true,
      enable_pbr: true,
      symmetry_mode: "auto",
    }),
  });

  if (res.status !== 200 && res.status !== 202) {
    const errText = await res.text();

    // Détection erreurs Meshy "file pleine" : rate limit, concurrent tasks, quota.
    // Meshy renvoie typiquement 429 ou 400 avec un message du genre
    // "max concurrent tasks reached" / "rate limit exceeded" / "quota exceeded".
    // On les remappe en code error stable "queue_full" pour que /try affiche
    // un message d'attente plutôt qu'une erreur rouge.
    const isQueueFull =
      res.status === 429 ||
      /concurrent|rate.?limit|too.?many|quota|busy/i.test(errText);

    if (isQueueFull) {
      return NextResponse.json(
        {
          error: "queue_full",
          message:
            "Trop de générations Meshy en cours. Reviens dans 3-5 min, ta place est gardée.",
          meshyRaw: errText.slice(0, 200),
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Meshy ${res.status}: ${errText.slice(0, 200)}` },
      { status: 502 }
    );
  }

  const data = await res.json();
  return NextResponse.json({
    taskId: data.result,
  });
}
