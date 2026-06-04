// Helper partage pour embed les polices Unicode NotoSans dans un PDF pdf-lib.
//
// Sert a tous les PDFs F-Gas (CERFA, rapport client, registre, etiquette) qui
// ont besoin de supporter les caracteres Unicode (fleches, exposants ², smart
// quotes, emoji légers, etc.) — les StandardFonts.Helvetica de pdf-lib sont
// limitees a WinAnsi (256 caracteres latins) et crashent avec une erreur
// "WinAnsi cannot encode <U+XXXX>" des qu'un caractere etendu apparait dans
// les notes / nom client / observations.
//
// Avec subset:true, le PDF final n'inclut que les glyphes effectivement
// utilises (~50-100KB final pour des fichiers source de 556KB) -> support
// Unicode complet sans exploser le poids du PDF.

import type { PDFDocument, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Cache module-level pour eviter de relire le fichier sur chaque PDF
// (gain ~150ms par PDF apres le 1er appel cold start).
let cachedRegular: Uint8Array | null = null;
let cachedBold: Uint8Array | null = null;

async function loadFontFile(filename: string): Promise<Uint8Array | null> {
  try {
    const fontPath = path.join(process.cwd(), "public", "fonts", filename);
    const buf = await readFile(fontPath);
    return new Uint8Array(buf);
  } catch (e) {
    console.warn(`[pdf-fonts] could not load ${filename}:`, e);
    return null;
  }
}

/** Embed NotoSans Regular + Bold dans le PDF avec fontkit + subset.
 *  Retourne la regular en fallback si Bold n'est pas disponible (le
 *  rendu visuel sera moins marque mais lisible). */
export async function embedUnicodeFonts(
  pdf: PDFDocument
): Promise<{ regular: PDFFont; bold: PDFFont }> {
  pdf.registerFontkit(fontkit);

  if (!cachedRegular) cachedRegular = await loadFontFile("NotoSans-Regular.ttf");
  if (!cachedRegular) {
    throw new Error(
      "NotoSans-Regular.ttf introuvable dans public/fonts/. Verifie que le fichier est commit + present dans le bundle Vercel."
    );
  }
  const regular = await pdf.embedFont(cachedRegular, { subset: true });

  if (!cachedBold) cachedBold = await loadFontFile("NotoSans-Bold.ttf");
  const bold = cachedBold
    ? await pdf.embedFont(cachedBold, { subset: true })
    : regular;

  return { regular, bold };
}
