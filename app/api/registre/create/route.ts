// Génère le PDF du Registre des mouvements de fluides frigorigènes.
//
// Reçoit en input : bouteilles + mouvements (depuis localStorage côté client)
// + période + profil. Retourne le PDF binary direct.

import { NextResponse } from "next/server";
import { generateRegistrePdf, type RegistreInput } from "@/lib/pdf/registre-pdf";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: RegistreInput;
  try {
    body = (await req.json()) as RegistreInput;
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  if (!Array.isArray(body.bouteilles) || !Array.isArray(body.mouvements)) {
    return NextResponse.json(
      { error: "bouteilles et mouvements doivent être des tableaux" },
      { status: 400 }
    );
  }

  if (!body.periodeDebutISO || !body.periodeFinISO) {
    return NextResponse.json(
      { error: "Période requise (periodeDebutISO + periodeFinISO)" },
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
    const pdfBytes = await generateRegistrePdf(body);
    const periodeLabel = body.periodeDebutISO.slice(0, 7); // YYYY-MM
    const filename = `Registre_fluides_${periodeLabel}.pdf`;
    return new NextResponse(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[registre] génération échouée :", err);
    return NextResponse.json(
      {
        error: "Échec génération registre",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
