/**
 * POST /api/lite/edit/undo — annule le dernier edit pour un slug.
 *
 * Recupere le prevBrief depuis history-store et le persiste.
 * Si rien a undo, retourne { success: false }.
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getCurrentUser } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkOrigin } from "@/lib/origin-check";
import { popLastEdit } from "@/lib/lite-edit/history-store";

export const runtime = "nodejs";

const BRIEFS_DIR = path.join(process.cwd(), "data", "briefs");

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const origin = checkOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: "Origin invalide" }, { status: 403 });
  }

  const limited = checkRateLimit(`user:${user.id}`, "lite-edit-undo", {
    max: 30,
    windowMs: 60 * 60_000,
  });
  if (limited.blocked) {
    return NextResponse.json({ error: "Trop d'undos" }, { status: 429 });
  }
  const ipLimit = checkRateLimit(getClientIp(req), "lite-edit-undo-ip", {
    max: 60,
    windowMs: 60 * 60_000,
  });
  if (ipLimit.blocked) {
    return NextResponse.json({ error: "Trop d'undos depuis cette IP" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("slug" in body) ||
    typeof (body as Record<string, unknown>).slug !== "string"
  ) {
    return NextResponse.json({ error: "Body doit contenir { slug }" }, { status: 400 });
  }

  const slug = (body as { slug: string }).slug;
  if (!/^[a-z0-9_-]+$/i.test(slug)) {
    return NextResponse.json({ error: "Slug invalide" }, { status: 400 });
  }

  const last = popLastEdit(slug);
  if (!last) {
    return NextResponse.json(
      { success: false, error: "Rien a annuler" },
      { status: 200 }
    );
  }

  const briefPath = path.join(BRIEFS_DIR, `${slug}.json`);
  try {
    await fs.writeFile(briefPath, JSON.stringify(last.prevBrief, null, 2), "utf-8");
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: `Undo failed: ${err instanceof Error ? err.message : "unknown"}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    undoneEdit: {
      id: last.id,
      userMessage: last.userMessage,
      changeDescription: last.changeDescription,
      intentType: last.intent.type,
    },
  });
}
