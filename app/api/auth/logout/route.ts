/**
 * POST /api/auth/logout
 *
 * Detruit la session courante. Redirect /login.
 */

import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/session";
import { checkOrigin } from "@/lib/origin-check";
import { appUrl } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // [SECURITY M3] CSRF defense-in-depth
  const oc = checkOrigin(req);
  if (!oc.ok) {
    return NextResponse.json({ error: "Origin invalide" }, { status: 403 });
  }
  await destroySession();
  // [SECURITY L2] APP_URL pin
  return NextResponse.redirect(`${appUrl()}/login`, { status: 303 });
}
