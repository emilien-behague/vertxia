// Genere un devis PDF structure depuis un diagnostic IA Vertxia.
//
// Difference avec /api/rapport/create : le rapport est un livrable
// post-intervention (constate ce qui a ete fait). Le devis est un livrable
// pre-intervention (propose ce qu'on va faire au client) avec montants
// chiffres HT + TVA + TTC, conditions de paiement, et signature de
// l'emetteur.
//
// Brief Vertxia #7 : transforme un diagnostic en CA pour le pro.

import { NextResponse } from "next/server";
import { generateDevisPdf } from "@/lib/devis-pdf";
import type { Devis } from "@/lib/devis";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Devis;
  try {
    body = (await req.json()) as Devis;
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  if (!body.emetteur?.raisonSociale) {
    return NextResponse.json(
      { error: "Profil entreprise manquant ou raison sociale vide. Remplis-le sur /profil." },
      { status: 400 }
    );
  }
  if (!body.destinataire?.nom) {
    return NextResponse.json(
      { error: "Destinataire du devis (client) manquant." },
      { status: 400 }
    );
  }
  if (!Array.isArray(body.lignes) || body.lignes.length === 0) {
    return NextResponse.json(
      { error: "Au moins une ligne de devis est requise." },
      { status: 400 }
    );
  }

  try {
    const pdfBytes = await generateDevisPdf(body);
    const numeroSafe = (body.numero || "DEVIS").replace(/[^A-Z0-9-]/gi, "_");
    const filename = `${numeroSafe}.pdf`;
    return new NextResponse(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
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
    console.error("[devis/create] erreur generation :", {
      stack: err instanceof Error ? err.stack : undefined,
      message: err instanceof Error ? err.message : String(err),
      payload: stripDataUrls(body),
    });
    return NextResponse.json(
      {
        error: "Échec génération du devis",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
