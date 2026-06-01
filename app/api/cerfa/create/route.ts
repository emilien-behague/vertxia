import { NextResponse } from "next/server";
import { fillCerfaPdf, type CerfaInput } from "@/lib/cerfa";

// pdf-lib lit le PDF officiel depuis le disque (fs) → runtime Node.
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: CerfaInput;
  try {
    body = (await req.json()) as CerfaInput;
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  // Le fluide est requis dans tous les cas (l'équipement contient toujours
  // un fluide, même si aucune récupération n'est faite). weight = 0 est OK
  // pour les interventions sans manipulation (contrôle, mise en service).
  if (!body.fluide?.code || typeof body.weight !== "number" || body.weight < 0) {
    return NextResponse.json(
      { error: "Champs requis manquants : fluide.code, weight (>= 0)" },
      { status: 400 }
    );
  }

  try {
    const pdfBytes = await fillCerfaPdf(body);
    const filename = `CERFA_15497-04_${Date.now()}.pdf`;
    return new NextResponse(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[CERFA] échec génération :", err);
    return NextResponse.json(
      {
        error: "Échec génération CERFA",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
