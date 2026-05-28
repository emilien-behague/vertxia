/**
 * POST /api/upscale/start
 *
 * Crée une prediction Real-ESRGAN sur Replicate à partir d'une URL d'image.
 * Si l'image source est trop grosse (>2.1M pixels), Replicate refusera —
 * dans ce cas on retourne directement l'imageUrl source sans upscale (skip).
 *
 * Retourne : { predictionId, status, source } pour que le client puisse poll.
 * Si l'image source est déjà >= 1400px, on skip Real-ESRGAN entièrement et
 * on retourne { skipped: true, output: imageUrl }.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateExternalUrl } from "@/lib/ssrf-guard";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const REPLICATE_API = "https://api.replicate.com/v1";
const REPLICATE_VERSION =
  "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa";

// Seuil : si source < 1400px, Real-ESRGAN apporte du gain. Sinon Lanczos
// suffit côté client (et Replicate refuse les sources > 2.1M pixels).
const RESRGAN_MIN_DIM_THRESHOLD = 1400;

async function getImageDimensions(
  url: string
): Promise<{ width: number; height: number } | null> {
  try {
    // SSRF check avant fetch (l'URL vient du user)
    const guard = await validateExternalUrl(url);
    if (!guard.ok) return null;
    // Récupère les 64 KB premiers pour parser le header JPEG/PNG/WebP
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(url, {
      headers: { Range: "bytes=0-65535", "User-Agent": "Vertxia/1.0" },
      redirect: "error",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok && res.status !== 206) return null;
    const buffer = Buffer.from(await res.arrayBuffer());

    // JPEG SOF marker pour dimensions
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let i = 2;
      while (i < buffer.length - 9) {
        if (buffer[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = buffer[i + 1];
        // SOF markers : C0, C1, C2 = baseline + progressive JPEG
        if (
          marker === 0xc0 ||
          marker === 0xc1 ||
          marker === 0xc2 ||
          marker === 0xc3
        ) {
          const height = buffer.readUInt16BE(i + 5);
          const width = buffer.readUInt16BE(i + 7);
          return { width, height };
        }
        const segLen = buffer.readUInt16BE(i + 2);
        i += 2 + segLen;
      }
    }
    // PNG IHDR : 8 bytes signature + 4 length + 4 "IHDR" + 4 width + 4 height
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  // Rate limit Replicate : 10/min/IP (chaque appel = ~$0.005 + temps GPU)
  const rl = checkRateLimit(getClientIp(req), "upscale", { max: 10, windowMs: 60_000 });
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Trop de requêtes — réessaie dans ${rl.retryAfterSec}s` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN manquant côté serveur" },
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

  // SSRF guard sur l'imageUrl avant de l'envoyer à Replicate (et avant
  // notre propre getImageDimensions). Replicate va aussi fetch l'URL → on
  // ne veut pas leur faire scrap nos endpoints internes non plus.
  const guard = await validateExternalUrl(imageUrl);
  if (!guard.ok) {
    return NextResponse.json(
      { error: `imageUrl bloquée : ${guard.reason}` },
      { status: 400 },
    );
  }

  // Détection taille source : si déjà sharp, skip Real-ESRGAN
  const dims = await getImageDimensions(imageUrl);
  if (dims && Math.min(dims.width, dims.height) >= RESRGAN_MIN_DIM_THRESHOLD) {
    return NextResponse.json({
      skipped: true,
      reason: `Source déjà sharp (${dims.width}x${dims.height} >= ${RESRGAN_MIN_DIM_THRESHOLD}px)`,
      output: imageUrl,
    });
  }

  // Lancer Real-ESRGAN sur Replicate
  const res = await fetch(`${REPLICATE_API}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: REPLICATE_VERSION,
      input: {
        image: imageUrl,
        scale: 4,
        face_enhance: false,
      },
    }),
  });

  if (res.status !== 201) {
    const errText = await res.text();
    return NextResponse.json(
      { error: `Replicate ${res.status}: ${errText.slice(0, 200)}` },
      { status: 502 }
    );
  }

  const data = await res.json();
  return NextResponse.json({
    skipped: false,
    predictionId: data.id,
    status: data.status,
    source: { dims },
  });
}
