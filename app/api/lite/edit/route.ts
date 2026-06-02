/**
 * POST /api/lite/edit — iteration loop endpoint Vertxia Lite.
 *
 * Port d'Open-Lovable `apply-ai-code-stream` adapte au cas Vertxia :
 * on edite un BRIEF JSON via Haiku, on log dans history pour undo.
 *
 * Body : { slug: string, message: string }
 * Retourne : { success, intent, newBrief, changeDescription, editId }
 *
 * Dispatch sur intent.type :
 *  - UPDATE_PALETTE  -> palette-updater
 *  - UPDATE_COPY     -> copy-updater.updateGlobalCopy
 *  - UPDATE_SECTION  -> copy-updater.updateSection
 *  - UPDATE_MOOD     -> mood-updater
 *  - CHANGE_TEMPLATE -> template-switcher
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getCurrentUser } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkOrigin } from "@/lib/origin-check";
import { analyzeEditIntent } from "@/lib/lite-edit/intent-analyzer";
import { updatePalette } from "@/lib/lite-edit/palette-updater";
import { updateSection, updateGlobalCopy } from "@/lib/lite-edit/copy-updater";
import { updateMood } from "@/lib/lite-edit/mood-updater";
import { switchTemplate } from "@/lib/lite-edit/template-switcher";
import { appendEdit } from "@/lib/lite-edit/history-store";
import type { EditRequest, EditResult, EditIntent } from "@/lib/lite-edit/types";

export const runtime = "nodejs";

const BRIEFS_DIR = path.join(process.cwd(), "data", "briefs");

export async function POST(req: NextRequest) {
  // [SECURITY] Auth obligatoire
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  // [SECURITY] CSRF defense
  const origin = checkOrigin(req);
  if (!origin.ok) {
    return NextResponse.json({ error: "Origin invalide" }, { status: 403 });
  }

  // [SECURITY] Rate limit
  const limited = checkRateLimit(`user:${user.id}`, "lite-edit", {
    max: 20,
    windowMs: 60 * 60_000,
  });
  if (limited.blocked) {
    return NextResponse.json(
      { error: "Trop d'edits dans la derniere heure", retryAfter: limited.retryAfterSec },
      { status: 429 }
    );
  }
  const ipLimit = checkRateLimit(getClientIp(req), "lite-edit-ip", {
    max: 50,
    windowMs: 60 * 60_000,
  });
  if (ipLimit.blocked) {
    return NextResponse.json({ error: "Trop d'edits depuis cette IP" }, { status: 429 });
  }

  // Validation body
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
    !("message" in body) ||
    typeof (body as Record<string, unknown>).slug !== "string" ||
    typeof (body as Record<string, unknown>).message !== "string"
  ) {
    return NextResponse.json(
      { error: "Body doit contenir { slug, message } strings" },
      { status: 400 }
    );
  }

  const { slug, message } = body as EditRequest;
  const trimmedMessage = message.trim().slice(0, 500);

  // Sanitize slug
  if (!/^[a-z0-9_-]+$/i.test(slug)) {
    return NextResponse.json({ error: "Slug invalide" }, { status: 400 });
  }
  if (!trimmedMessage) {
    return NextResponse.json({ error: "Message vide" }, { status: 400 });
  }

  // Lit le brief
  const briefPath = path.join(BRIEFS_DIR, `${slug}.json`);
  let brief: Record<string, unknown>;
  try {
    const raw = await fs.readFile(briefPath, "utf-8");
    brief = JSON.parse(raw);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Brief ${slug} non trouve`,
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 404 }
    );
  }

  // Analyse intent
  const intent = analyzeEditIntent(trimmedMessage);

  if (intent.type === "UNKNOWN") {
    const result: EditResult = {
      success: false,
      intent,
      error:
        "Je ne sais pas encore faire ce type d'edit. Essaie : palette, copy/headline, mood, section (hero/manifesto/process/footer), ou template.",
    };
    return NextResponse.json(result, { status: 200 });
  }

  // Dispatch
  try {
    const patch = await dispatchEdit(intent, brief, trimmedMessage, slug);

    // Si patch vide (ex: template deja actif), on ne persiste pas
    if (Object.keys(patch.patch).length === 0) {
      const result: EditResult = {
        success: true,
        intent,
        newBrief: brief,
        changeDescription: patch.changeDescription,
      };
      return NextResponse.json(result, { status: 200 });
    }

    // Merge patch + brief
    const newBrief = { ...brief, ...patch.patch };

    // Persist
    await fs.writeFile(briefPath, JSON.stringify(newBrief, null, 2), "utf-8");

    // History (pour undo + context)
    const historyEntry = appendEdit({
      slug,
      timestamp: Date.now(),
      userMessage: trimmedMessage,
      intent,
      changeDescription: patch.changeDescription,
      prevBrief: brief,
    });

    const result: EditResult = {
      success: true,
      intent,
      newBrief,
      changeDescription: patch.changeDescription,
      editId: historyEntry.id,
    };
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        intent,
        error: `Edit failed: ${err instanceof Error ? err.message : "unknown"}`,
      } as EditResult,
      { status: 500 }
    );
  }
}

/**
 * Dispatch sur intent.type — retourne le patch a merger dans le brief.
 */
async function dispatchEdit(
  intent: EditIntent,
  brief: Record<string, unknown>,
  message: string,
  _slug: string
): Promise<{ patch: Record<string, unknown>; changeDescription: string }> {
  switch (intent.type) {
    case "UPDATE_PALETTE": {
      const currentPalette = extractPalette(brief);
      if (!currentPalette) {
        throw new Error("Palette actuelle non trouvee dans le brief");
      }
      const { palette, changeDescription } = await updatePalette(currentPalette, intent, message);
      return {
        patch: patchPalette(brief, palette),
        changeDescription,
      };
    }

    case "UPDATE_COPY": {
      // Si section ciblee + COPY => route vers updateSection
      if (intent.extracted.section && intent.extracted.section !== "global") {
        const sectionResult = await updateSection(brief, intent.extracted.section, intent, message);
        return sectionResult;
      }
      const globalResult = await updateGlobalCopy(brief, intent, message);
      return globalResult;
    }

    case "UPDATE_SECTION": {
      if (!intent.extracted.section) {
        throw new Error("Section non specifiee pour UPDATE_SECTION");
      }
      return updateSection(brief, intent.extracted.section, intent, message);
    }

    case "UPDATE_MOOD": {
      return updateMood(brief, intent, message);
    }

    case "CHANGE_TEMPLATE": {
      return switchTemplate(brief, intent, message);
    }

    case "REPLACE_VIDEO":
      throw new Error("REPLACE_VIDEO pas encore implemente (V2)");

    default:
      throw new Error(`Type d'edit non gere : ${intent.type}`);
  }
}

function extractPalette(
  brief: Record<string, unknown>
): Array<{ name: string; hex: string }> | null {
  const vs = brief.visual_system as Record<string, unknown> | undefined;
  if (!vs) return null;
  const palette = vs.palette as Array<{ name: string; hex: string }> | undefined;
  if (!Array.isArray(palette)) return null;
  return palette;
}

function patchPalette(
  brief: Record<string, unknown>,
  newPalette: Array<{ name: string; hex: string }>
): Record<string, unknown> {
  const vs = brief.visual_system as Record<string, unknown>;
  return {
    visual_system: {
      ...vs,
      palette: newPalette,
    },
  };
}
