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
    // Logge la stack + un snapshot de l'input pour pouvoir reproduire offline.
    // Les champs lourds (signature dataUrl, notes très longues) sont remplacés
    // par leur taille pour éviter de spammer les logs Vercel.
    const stack = err instanceof Error ? err.stack || err.message : String(err);
    const inputSnapshot = {
      typeIntervention: body.typeIntervention,
      fluide: body.fluide,
      weight: body.weight,
      hasBsffId: Boolean(body.bsffId),
      hasOperateurSig: Boolean(body.operateur?.signatureDataUrl),
      operateurSigLen: body.operateur?.signatureDataUrl?.length ?? 0,
      hasDetenteurSig: Boolean(body.detenteurSignature?.dataUrl),
      detenteurSigLen: body.detenteurSignature?.dataUrl?.length ?? 0,
      observationsLen: body.observationsLibres?.length ?? 0,
      hasFluideManipule: Boolean(body.fluideManipule),
      hasControleDetails: Boolean(body.controleDetails),
      clientNameLen: body.clientName?.length ?? 0,
      modeleEqLen: body.modeleEquipement?.length ?? 0,
      lieuLen: body.lieuIntervention?.length ?? 0,
    };
    console.error(
      "[CERFA] échec génération :",
      JSON.stringify(inputSnapshot),
      "\n",
      stack
    );
    return NextResponse.json(
      {
        error: "Échec génération CERFA",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
