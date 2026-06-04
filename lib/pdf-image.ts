// Helper partage pour embed une image (data URL base64) dans un PDF pdf-lib
// en detectant automatiquement le format PNG vs JPEG.
//
// Pourquoi : les composants canvas signature exportent tantot en PNG
// (signature client iPhone Safari avec transparence), tantot en JPEG
// (signature operateur post-fix quota localStorage — JPEG 60% compresse).
// Quand le PDF appelle embedPng en dur sur un JPEG, pdf-lib crash avec
// "The input is not a PNG file". Idem inverse pour embedJpg sur PNG.
//
// Ce helper fait le tri tout seul : detection du prefix data:image/... pour
// router vers embedPng ou embedJpg. Wrap try/catch pour ne pas planter le
// PDF si la dataUrl est mal formee ou corrompue.

import type { PDFDocument, PDFImage } from "pdf-lib";

/** Embed une dataURL image (PNG ou JPEG) dans le PDF. Retourne null si la
 *  dataUrl n'est pas reconnue ou si l'embed echoue. Le caller doit checker
 *  null avant d'utiliser la PDFImage retournee. */
export async function embedDataUrl(
  pdf: PDFDocument,
  dataUrl: string
): Promise<PDFImage | null> {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  try {
    if (dataUrl.startsWith("data:image/png")) {
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
      return await pdf.embedPng(Buffer.from(base64, "base64"));
    }
    if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) {
      const base64 = dataUrl.replace(/^data:image\/jpe?g;base64,/, "");
      return await pdf.embedJpg(Buffer.from(base64, "base64"));
    }
    if (dataUrl.startsWith("data:image/webp")) {
      // pdf-lib n'a pas d'embedWebp. On laisse null et le caller peut
      // logger ou skip.
      console.warn("[pdf-image] WebP non supporte par pdf-lib, dataUrl skip");
      return null;
    }
    console.warn("[pdf-image] format non reconnu dans la dataUrl:", dataUrl.slice(0, 60));
    return null;
  } catch (e) {
    console.warn("[pdf-image] embed echec:", e);
    return null;
  }
}
