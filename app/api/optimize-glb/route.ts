/**
 * POST /api/optimize-glb
 *
 * Pipeline complet :
 *   1. Télécharge le GLB depuis une URL (typiquement Meshy CDN, ~30-50 MB)
 *   2. Re-compresse avec Draco mesh compression (gain ~70%)
 *   3. Upload le GLB compressé vers Vercel Blob (storage persistant)
 *   4. Renvoie JSON avec { id, url, originalSize, compressedSize, ratio }
 *
 * L'URL Vercel Blob est PUBLIQUE et permanente — c'est elle qui sert
 * de "site démo partageable" via /demo/[id]?u=<blob-url>.
 *
 * Variables d'env requises (auto-injectées par Vercel Blob "Connect Project") :
 *   - BLOB_READ_WRITE_TOKEN
 *
 * Note timeout : Vercel hobby free = 10s, Pro = 60s. Compression d'un GLB
 * 50 MB prend ~5-10s en Node, upload Blob ~1-2s, total < 15s.
 */

import { NextRequest } from "next/server";
import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import { draco } from "@gltf-transform/functions";
import draco3d from "draco3d";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";
import path from "path";
import { validateExternalUrl } from "@/lib/ssrf-guard";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const MAX_GLB_BYTES = 100 * 1024 * 1024; // 100 MB cap (Meshy UHQ ~30-50 MB)

// Workaround Emscripten WASM path : draco3d cherche par défaut son .wasm
// dans un chemin Emscripten "C:\ROOT" virtuel qui n'existe pas. On lui dit
// explicitement de chercher dans node_modules/draco3d.
const dracoModulePath = path.join(
  process.cwd(),
  "node_modules",
  "draco3d"
);
const locateFile = (file: string) => path.join(dracoModulePath, file);

export const runtime = "nodejs";
export const maxDuration = 60; // 60s timeout (Pro). Free tier silencieusement caped à 10s.

export async function POST(req: NextRequest) {
  // Rate limit : 5/min/IP (optimize-glb = Vercel Blob storage cost + bandwidth)
  const rl = checkRateLimit(getClientIp(req), "optimize-glb", { max: 5, windowMs: 60_000 });
  if (rl.blocked) {
    return Response.json(
      { error: `Trop de requêtes — réessaie dans ${rl.retryAfterSec}s` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let glbUrl: string;
  try {
    const body = await req.json();
    if (typeof body.glbUrl !== "string" || !body.glbUrl.startsWith("http")) {
      return Response.json({ error: "glbUrl invalide" }, { status: 400 });
    }
    glbUrl = body.glbUrl;
  } catch {
    return Response.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  // SSRF guard : refuse URLs vers IPs internes / metadata cloud
  const guard = await validateExternalUrl(glbUrl);
  if (!guard.ok) {
    return Response.json({ error: `glbUrl bloquée : ${guard.reason}` }, { status: 400 });
  }

  // 1. Télécharger le GLB depuis Meshy CDN (peut être 30-50 MB).
  // Cap MAX_GLB_BYTES pour éviter qu'un attaquant nous fasse OOM avec une URL
  // pointée vers un fichier de 1 GB.
  let inputBuffer: Buffer;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout
    const res = await fetch(glbUrl, {
      headers: { "User-Agent": "Vertxia/1.0 GLB-optimizer" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!res.ok) {
      clearTimeout(timeout);
      return Response.json(
        { error: `Téléchargement GLB échoué : ${res.status}` },
        { status: 502 }
      );
    }
    // Check Content-Length avant le download complet
    const len = res.headers.get("content-length");
    if (len && parseInt(len, 10) > MAX_GLB_BYTES) {
      clearTimeout(timeout);
      return Response.json(
        { error: `GLB trop volumineux : ${len} bytes (max ${MAX_GLB_BYTES})` },
        { status: 400 }
      );
    }
    // Lecture streaming avec cap — au cas où Content-Length manque/ment
    const reader = res.body?.getReader();
    if (!reader) {
      clearTimeout(timeout);
      return Response.json({ error: "Pas de body GLB" }, { status: 502 });
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_GLB_BYTES) {
        await reader.cancel();
        clearTimeout(timeout);
        return Response.json(
          { error: `GLB dépasse ${MAX_GLB_BYTES} bytes pendant download` },
          { status: 400 }
        );
      }
      chunks.push(value);
    }
    clearTimeout(timeout);
    inputBuffer = Buffer.concat(chunks);
  } catch (err) {
    return Response.json(
      {
        error: `Erreur réseau Meshy : ${err instanceof Error ? err.message : "?"}`,
      },
      { status: 502 }
    );
  }

  const inputSize = inputBuffer.byteLength;

  // 2. Compression Draco mesh
  let outputBuffer: Uint8Array;
  try {
    const io = new NodeIO()
      .registerExtensions([KHRDracoMeshCompression])
      .registerDependencies({
        // draco3d encoder/decoder en WASM. Initialisé lazy au premier appel.
        "draco3d.encoder": await draco3d.createEncoderModule({ locateFile }),
        "draco3d.decoder": await draco3d.createDecoderModule({ locateFile }),
      });

    const doc = await io.readBinary(new Uint8Array(inputBuffer));
    await doc.transform(draco());
    outputBuffer = await io.writeBinary(doc);
  } catch (err) {
    return Response.json(
      {
        error: `Compression échouée : ${err instanceof Error ? err.message : "?"}`,
      },
      { status: 500 }
    );
  }

  const outputSize = outputBuffer.byteLength;
  const ratio = ((1 - outputSize / inputSize) * 100).toFixed(1);

  // 3. Upload vers Vercel Blob (storage public permanent)
  // ID court genre "V1StGXR8_Z" — assez random pour pas être devinable mais lisible.
  // Path date-prefixed pour /api/check-quota qui compte les gens du jour via list().
  const id = nanoid(10);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  let blobUrl: string;
  try {
    // Copy dans un ArrayBuffer "fresh" pour satisfaire le typing strict
    // (TS 5.x distingue ArrayBuffer vs SharedArrayBuffer dans BodyInit/BlobPart).
    const ab = new ArrayBuffer(outputBuffer.byteLength);
    new Uint8Array(ab).set(outputBuffer);

    const blob = await put(`demos/${today}/${id}.glb`, ab, {
      access: "public",
      contentType: "model/gltf-binary",
      cacheControlMaxAge: 31536000, // 1 an : le GLB d'une démo ne change jamais
      addRandomSuffix: false,
    });
    blobUrl = blob.url;
  } catch (err) {
    return Response.json(
      {
        error: `Upload Blob échoué : ${err instanceof Error ? err.message : "?"}`,
      },
      { status: 500 }
    );
  }

  return Response.json(
    {
      ok: true,
      id,
      url: blobUrl,
      originalSize: inputSize,
      compressedSize: outputSize,
      ratio,
    },
    { status: 200 }
  );
}
