// Génère le rapport d'intervention F-Gas (PDF "client final").
// Différent du CERFA officiel et du BSFF TrackDéchets — c'est le livrable
// que le technicien remet à son client (hôtel, restaurant, usine) avec
// son entête entreprise, son logo et sa signature manuscrite.

import { NextResponse } from "next/server";
import { generateRapportPdf, type RapportInput } from "@/lib/pdf/rapport";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: RapportInput;
  try {
    body = (await req.json()) as RapportInput;
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  if (!body.fluide?.code || typeof body.weight !== "number" || body.weight < 0) {
    return NextResponse.json(
      { error: "Champs requis manquants : fluide.code, weight (>= 0)" },
      { status: 400 }
    );
  }

  if (!body.profil) {
    return NextResponse.json(
      { error: "Profil entreprise manquant. Remplis-le sur /profil." },
      { status: 400 }
    );
  }

  try {
    const pdfBytes = await generateRapportPdf(body);
    const filename = `Rapport_intervention_${Date.now()}.pdf`;
    return new NextResponse(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    // Log structure pour pouvoir debug via Vercel runtime logs. On stripe
    // les data URLs (logo/signature/photo diag) qui peuvent peser 2-4MB
    // et polluent les logs.
    const stripDataUrls = (obj: unknown): unknown => {
      if (typeof obj === "string" && obj.startsWith("data:")) {
        return `[dataUrl truncated, ${obj.length} chars]`;
      }
      if (Array.isArray(obj)) return obj.map(stripDataUrls);
      if (obj && typeof obj === "object") {
        const r: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          r[k] = stripDataUrls(v);
        }
        return r;
      }
      return obj;
    };
    console.error("[rapport] génération échouée :", err);
    console.error("[rapport] stack :", err instanceof Error ? err.stack : "(no stack)");
    console.error("[rapport] payload :", JSON.stringify(stripDataUrls(body)));
    return NextResponse.json(
      {
        error: "Échec génération rapport",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
