/**
 * Anti-CSRF defense-in-depth : verifie que les requetes POST/PUT/DELETE
 * proviennent de notre origine (vs un domaine attaquant).
 *
 * Strategie :
 *  - Si Origin header present : doit matcher l'origine attendue.
 *  - Si Origin absent (cas form classique avec Referrer-Policy strict) :
 *    on fallback sur Referer si present.
 *  - Si ni Origin ni Referer : on REJETTE (paranoia mode).
 *
 * iron-session est deja sameSite:"lax" -> protege deja contre la plupart des
 * scenarios CSRF, mais defense-in-depth ne coute rien.
 */

import type { NextRequest } from "next/server";
import { allowedOrigins } from "./env";

export type OriginCheckResult =
  | { ok: true }
  | { ok: false; reason: string };

export function checkOrigin(req: NextRequest): OriginCheckResult {
  let allowed: string[];
  try {
    allowed = allowedOrigins();
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }

  const origin = req.headers.get("origin");
  if (origin) {
    if (allowed.includes(origin)) return { ok: true };
    return { ok: false, reason: `Origin mismatch: ${origin} not in [${allowed.join(", ")}]` };
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (allowed.includes(refOrigin)) return { ok: true };
      return {
        ok: false,
        reason: `Referer mismatch: ${refOrigin} not in [${allowed.join(", ")}]`,
      };
    } catch {
      return { ok: false, reason: "Referer malformed" };
    }
  }

  return { ok: false, reason: "No Origin or Referer header" };
}
