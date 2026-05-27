/**
 * GET /api/check-quota
 *
 * Compte le nombre de générations Vertxia faites aujourd'hui via la liste
 * des GLBs présents dans Vercel Blob sous le préfixe `demos/<YYYY-MM-DD>/`.
 *
 * Sert de garde-fou contre le viral overrun : si une vidéo TikTok ramène
 * 500 visiteurs et qu'ils génèrent tous, on cape à MAX_DAILY_GENERATIONS
 * pour pas vider le compte Meshy/Replicate.
 *
 * Renvoie :
 *   { allowed: boolean, remaining: number, max: number, count: number, message: string | null }
 *
 * Variable d'env :
 *   - MAX_DAILY_GENERATIONS (défaut : 30)
 *   - BLOB_READ_WRITE_TOKEN (auto-injectée par Vercel Blob "Connect Project")
 *
 * Comportement fail-open : si Blob list() échoue (token manquant, panne),
 * on autorise la génération par défaut. Mieux vaut un over-spend qu'un
 * service cassé pour les visiteurs.
 */

import { list } from "@vercel/blob";

export const runtime = "nodejs";

const DEFAULT_MAX = 30;

export async function GET() {
  const max = parseInt(
    process.env.MAX_DAILY_GENERATIONS || String(DEFAULT_MAX),
    10
  );
  const today = new Date().toISOString().slice(0, 10); // UTC

  try {
    const { blobs } = await list({ prefix: `demos/${today}/` });
    const count = blobs.length;
    const remaining = Math.max(0, max - count);
    const allowed = count < max;

    return Response.json({
      allowed,
      remaining,
      max,
      count,
      message: allowed
        ? null
        : `Vertxia est complet pour aujourd'hui (${count}/${max} générations). Reviens demain ou DM emilien@vertxia.com.`,
    });
  } catch (err) {
    // Fail-open : autorise par défaut si on n'arrive pas à compter.
    // Mieux qu'un service cassé.
    console.warn("[check-quota] list failed :", err);
    return Response.json({
      allowed: true,
      remaining: max,
      max,
      count: 0,
      message: null,
    });
  }
}
