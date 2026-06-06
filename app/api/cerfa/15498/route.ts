import { NextResponse } from "next/server";
import { generateCerfa15498PDF, type Cerfa15498Input } from "@/lib/cerfa/cerfa-15498";

// pdf-lib lit la fonte Noto depuis le disque (fs) → runtime Node.
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Cerfa15498Input;
  try {
    body = (await req.json()) as Cerfa15498Input;
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  // Validation minimale des champs vraiment requis.
  if (!body.acheteur?.nomOuRaisonSociale) {
    return NextResponse.json(
      { error: "Champs requis : acheteur.nomOuRaisonSociale" },
      { status: 400 }
    );
  }
  if (!body.installateur?.raisonSociale || !body.installateur?.numeroAttestation) {
    return NextResponse.json(
      { error: "Profil installateur incomplet (raison sociale + n° attestation requis). Complete ton profil Vertxia." },
      { status: 400 }
    );
  }
  if (!body.equipement?.modele || !body.equipement?.fluideCode || typeof body.equipement?.chargeKg !== "number") {
    return NextResponse.json(
      { error: "Equipement incomplet : modele + fluide + chargeKg requis" },
      { status: 400 }
    );
  }
  if (!body.dateLivraisonISO || !body.dateMiseEnServiceISO) {
    return NextResponse.json(
      { error: "Dates requises : livraison + mise en service" },
      { status: 400 }
    );
  }

  try {
    const pdfBytes = await generateCerfa15498PDF(body);
    const safeModele = (body.equipement.modele || "equipement")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);
    const filename = `CERFA_15498-02_${safeModele}_${Date.now()}.pdf`;
    return new NextResponse(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const stack = err instanceof Error ? err.stack || err.message : String(err);
    console.error("[CERFA 15498] echec generation :", stack);
    return NextResponse.json(
      {
        error: "Echec generation CERFA 15498",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
