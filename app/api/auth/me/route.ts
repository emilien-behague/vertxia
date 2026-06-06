/**
 * GET /api/auth/me
 *
 * Retourne le user courant si log-in, sinon { user: null }.
 * Utilise par la sidebar pour afficher l'email + menu logout.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { id: user.id, email: user.email },
  });
}
