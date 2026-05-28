/**
 * Rate limit in-memory per-IP pour les routes API coûteuses (Meshy / Replicate).
 *
 * Limites :
 *   - Mémoire = par instance serverless (cold start = reset). Pas partagé
 *     entre régions Vercel. Pour rate limit distribué utiliser
 *     @upstash/ratelimit + Redis Edge Config.
 *   - Suffisant pour bloquer un script kiddie en boucle depuis une seule IP.
 *     Insuffisant pour bloquer un attaquant rotatif (botnet, proxies).
 *
 * Usage :
 *   const limited = checkRateLimit(getClientIp(req), "mesh", { max: 5, windowMs: 60_000 });
 *   if (limited.blocked) return NextResponse.json(
 *     { error: "Trop de requêtes", retryAfter: limited.retryAfterSec },
 *     { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
 *   );
 */

import type { NextRequest } from "next/server";

type Bucket = number[]; // timestamps des requêtes dans la fenêtre

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = { max: number; windowMs: number };

export type RateLimitResult =
  | { blocked: false; remaining: number }
  | { blocked: true; retryAfterSec: number };

export function checkRateLimit(
  ip: string,
  scope: string,
  opts: RateLimitOptions,
): RateLimitResult {
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  const prev = buckets.get(key) ?? [];
  const recent = prev.filter((t) => t > cutoff);

  if (recent.length >= opts.max) {
    const oldest = recent[0];
    const retryAfterMs = oldest + opts.windowMs - now;
    return {
      blocked: true,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  recent.push(now);
  buckets.set(key, recent);

  // Nettoyage opportuniste : si > 5000 keys, purger les anciennes
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.length === 0 || b[b.length - 1] < cutoff) buckets.delete(k);
    }
  }

  return { blocked: false, remaining: opts.max - recent.length };
}

export function getClientIp(req: NextRequest): string {
  // Vercel met l'IP cliente dans x-forwarded-for (premier dans la liste)
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
