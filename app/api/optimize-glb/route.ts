/**
 * POST /api/optimize-glb
 *
 * Télécharge un GLB depuis une URL (typiquement Meshy CDN) et le re-compresse
 * avec Draco mesh compression. Renvoie le GLB optimisé en stream binaire.
 *
 * Gain attendu : 50 MB Meshy brut → ~15 MB Draco (-70%).
 * Pas de compression WebP textures ici (nécessite sharp, lourd au cold start).
 *
 * Usage côté client :
 *   const glbResponse = await fetch('/api/optimize-glb', {
 *     method: 'POST',
 *     body: JSON.stringify({ glbUrl: meshyUrl }),
 *   });
 *   const blob = await glbResponse.blob();
 *   const localUrl = URL.createObjectURL(blob);
 *   // Pass localUrl à useGLTF
 *
 * Note timeout : Vercel hobby free = 10s, Pro = 60s. La compression d'un GLB
 * 50 MB prend ~5-10s en Node sans WebP, devrait passer sur les 2 plans.
 */

import { NextRequest } from "next/server";
import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import { draco } from "@gltf-transform/functions";
import draco3d from "draco3d";
import path from "path";

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
  let glbUrl: string;
  try {
    const body = await req.json();
    if (typeof body.glbUrl !== "string" || !body.glbUrl.startsWith("http")) {
      return new Response(
        JSON.stringify({ error: "glbUrl invalide" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    glbUrl = body.glbUrl;
  } catch {
    return new Response(
      JSON.stringify({ error: "Body JSON invalide" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 1. Télécharger le GLB depuis Meshy CDN (peut être 30-50 MB)
  let inputBuffer: Buffer;
  try {
    const res = await fetch(glbUrl, {
      headers: { "User-Agent": "Vertxia/1.0 GLB-optimizer" },
    });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Téléchargement GLB échoué : ${res.status}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
    inputBuffer = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: `Erreur réseau Meshy : ${err instanceof Error ? err.message : "?"}`,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
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
    return new Response(
      JSON.stringify({
        error: `Compression échouée : ${err instanceof Error ? err.message : "?"}`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const outputSize = outputBuffer.byteLength;
  const ratio = ((1 - outputSize / inputSize) * 100).toFixed(1);

  // 3. Stream le binary en response avec metadata dans les headers
  return new Response(outputBuffer, {
    status: 200,
    headers: {
      "Content-Type": "model/gltf-binary",
      "Content-Length": String(outputSize),
      "Cache-Control": "public, max-age=3600", // 1h cache, ~= durée vie Meshy URL
      "X-Original-Size": String(inputSize),
      "X-Compressed-Size": String(outputSize),
      "X-Compression-Ratio": ratio,
    },
  });
}
