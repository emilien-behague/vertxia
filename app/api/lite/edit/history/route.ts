/**
 * GET /api/lite/edit/history?slug=... — recupere l'historique des edits.
 *
 * Retourne la liste chronologique des edits effectues sur ce slug
 * dans la session serveur courante (in-memory).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getHistory } from "@/lib/lite-edit/history-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug || !/^[a-z0-9_-]+$/i.test(slug)) {
    return NextResponse.json({ error: "Slug invalide" }, { status: 400 });
  }

  const history = getHistory(slug);

  return NextResponse.json({
    slug,
    count: history.length,
    edits: history.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      userMessage: e.userMessage,
      intentType: e.intent.type,
      changeDescription: e.changeDescription,
    })),
  });
}
