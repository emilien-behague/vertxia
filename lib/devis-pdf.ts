// Generation PDF d'un devis structure depuis lib/devis.
//
// Approche : un seul template A4 marque blanche (logo + identite du pro).
// On reutilise les helpers existants embedUnicodeFonts (NotoSans subset)
// et embedDataUrl (PNG/JPEG auto-detect) pour eviter les bugs encoding.
//
// V1 : 1 page suffit pour la plupart des devis simples (4-6 lignes max).
// Si overflow > 1 page, on tronque le tableau lignes — V2 fera multi-page.

import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { embedUnicodeFonts } from "@/lib/pdf-fonts";
import { embedDataUrl } from "@/lib/pdf-image";
import { fmtEUR, type Devis } from "@/lib/devis";

// ── Palette + constantes design alignees avec rapport.ts ────────────────

const COLOR_ACCENT = rgb(0.631, 0.384, 0.027); // #A16207 ocre Vertxia
const COLOR_TEXT = rgb(0.067, 0.067, 0.067); // #111
const COLOR_MUTED = rgb(0.42, 0.42, 0.42);
const COLOR_LIGHT = rgb(0.6, 0.6, 0.6);
const COLOR_LINE = rgb(0.9, 0.9, 0.9);
const COLOR_BG_HEADER = rgb(0.961, 0.957, 0.941); // #F5F4F0 cream
const COLOR_WHITE = rgb(1, 1, 1);

// A4 portrait en points (1 inch = 72 points)
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 45;
const CONTENT_W = PAGE_W - 2 * MARGIN;

function fmtDateFR(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// Helper : draw line of text avec wrap simple (espace-based)
function drawWrappedText(
  page: PDFPage,
  text: string,
  opts: {
    x: number;
    y: number;
    maxWidth: number;
    font: PDFFont;
    size: number;
    color?: ReturnType<typeof rgb>;
    lineHeight?: number;
  }
): number {
  const { x, y, maxWidth, font, size, color = COLOR_TEXT, lineHeight = size * 1.35 } = opts;
  const words = text.split(/\s+/);
  let line = "";
  let currentY = y;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    const w = font.widthOfTextAtSize(test, size);
    if (w > maxWidth && line) {
      page.drawText(line, { x, y: currentY, font, size, color });
      line = word;
      currentY -= lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    page.drawText(line, { x, y: currentY, font, size, color });
    currentY -= lineHeight;
  }
  return currentY;
}

/** Compte le nombre de lignes qu'un texte prendra apres wrap dans une
 *  largeur donnee. Sert a pre-calculer la hauteur d'une ligne du tableau
 *  AVANT de dessiner son fond (bg alterne). */
function countWrappedLines(
  text: string,
  opts: { font: PDFFont; size: number; maxWidth: number }
): number {
  if (!text) return 0;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  let line = "";
  let count = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (opts.font.widthOfTextAtSize(test, opts.size) > opts.maxWidth && line) {
      count++;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) count++;
  return count;
}

export async function generateDevisPdf(devis: Devis): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const { regular, bold } = await embedUnicodeFonts(pdf);
  const page = pdf.addPage([PAGE_W, PAGE_H]);

  let y = PAGE_H - MARGIN;

  // ── HEADER : bandeau ocre fin + numero + dates ────────────────────────
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 5,
    width: PAGE_W,
    height: 5,
    color: COLOR_ACCENT,
  });

  // ── BLOC EMETTEUR (gauche) + DEVIS LABEL (droite) ─────────────────────
  y -= 10;
  const emetteur = devis.emetteur;

  // Logo si present, sinon raison sociale grosse
  const logoMaxH = 50;
  let textStartY = y;
  if (emetteur.logoDataUrl) {
    try {
      const logoImg = await embedDataUrl(pdf, emetteur.logoDataUrl);
      if (logoImg) {
        const scaled = logoImg.scaleToFit(140, logoMaxH);
        page.drawImage(logoImg, {
          x: MARGIN,
          y: y - scaled.height,
          width: scaled.width,
          height: scaled.height,
        });
        textStartY = y - scaled.height - 8;
      }
    } catch {
      // fallback : texte
    }
  }

  // Raison sociale (taille selon presence logo)
  const rsSize = emetteur.logoDataUrl ? 11 : 16;
  page.drawText(emetteur.raisonSociale || "Entreprise", {
    x: MARGIN,
    y: textStartY,
    font: bold,
    size: rsSize,
    color: COLOR_TEXT,
  });
  let yLeft = textStartY - 14;

  // Adresse + contact pro (sous le logo / raison sociale)
  const linesEmetteur: string[] = [];
  if (emetteur.adresseRue) {
    linesEmetteur.push(emetteur.adresseRue);
  }
  if (emetteur.adresseCp || emetteur.adresseVille) {
    linesEmetteur.push([emetteur.adresseCp, emetteur.adresseVille].filter(Boolean).join(" "));
  }
  if (emetteur.telephone) linesEmetteur.push(`Tél : ${emetteur.telephone}`);
  if (emetteur.email) linesEmetteur.push(emetteur.email);
  if (emetteur.siret) linesEmetteur.push(`SIRET : ${emetteur.siret}`);
  if (emetteur.numeroAttestation) {
    linesEmetteur.push(`Attestation F-Gas n° ${emetteur.numeroAttestation}`);
  }
  for (const ln of linesEmetteur) {
    page.drawText(ln, { x: MARGIN, y: yLeft, font: regular, size: 9, color: COLOR_MUTED });
    yLeft -= 11;
  }

  // Bloc "DEVIS" + numero + date a droite
  const rightX = PAGE_W - MARGIN;
  page.drawText("DEVIS", {
    x: rightX - bold.widthOfTextAtSize("DEVIS", 28),
    y: y - 6,
    font: bold,
    size: 28,
    color: COLOR_ACCENT,
  });
  const numLabel = devis.numero || "—";
  page.drawText(numLabel, {
    x: rightX - regular.widthOfTextAtSize(numLabel, 11),
    y: y - 30,
    font: regular,
    size: 11,
    color: COLOR_TEXT,
  });
  const dateLabel = `Date : ${fmtDateFR(devis.dateISO)}`;
  page.drawText(dateLabel, {
    x: rightX - regular.widthOfTextAtSize(dateLabel, 9),
    y: y - 44,
    font: regular,
    size: 9,
    color: COLOR_MUTED,
  });
  const validiteLabel = `Valable jusqu'au : ${fmtDateFR(devis.validiteISO)}`;
  page.drawText(validiteLabel, {
    x: rightX - regular.widthOfTextAtSize(validiteLabel, 9),
    y: y - 56,
    font: regular,
    size: 9,
    color: COLOR_MUTED,
  });

  y = Math.min(yLeft, y - 70) - 10;

  // ── BLOC DESTINATAIRE ─────────────────────────────────────────────────
  page.drawRectangle({
    x: MARGIN,
    y: y - 56,
    width: CONTENT_W,
    height: 56,
    color: COLOR_BG_HEADER,
  });
  page.drawText("DEVIS ÉTABLI POUR", {
    x: MARGIN + 12,
    y: y - 14,
    font: bold,
    size: 8,
    color: COLOR_MUTED,
  });
  page.drawText(devis.destinataire.nom || "(Client)", {
    x: MARGIN + 12,
    y: y - 28,
    font: bold,
    size: 12,
    color: COLOR_TEXT,
  });
  let yDest = y - 41;
  if (devis.destinataire.adresse) {
    page.drawText(devis.destinataire.adresse, {
      x: MARGIN + 12,
      y: yDest,
      font: regular,
      size: 9,
      color: COLOR_MUTED,
    });
    yDest -= 11;
  }
  const destContactParts: string[] = [];
  if (devis.destinataire.telephone) destContactParts.push(devis.destinataire.telephone);
  if (devis.destinataire.email) destContactParts.push(devis.destinataire.email);
  if (destContactParts.length > 0) {
    page.drawText(destContactParts.join("  ·  "), {
      x: MARGIN + 12,
      y: yDest,
      font: regular,
      size: 9,
      color: COLOR_MUTED,
    });
  }
  y -= 70;

  // ── NOTE INTRO (justification) ────────────────────────────────────────
  if (devis.noteIntro) {
    y = drawWrappedText(page, devis.noteIntro, {
      x: MARGIN,
      y: y - 4,
      maxWidth: CONTENT_W,
      font: regular,
      size: 10,
      color: COLOR_TEXT,
      lineHeight: 14,
    });
    y -= 8;
  }

  // ── TABLEAU LIGNES ────────────────────────────────────────────────────
  // Colonnes : Designation (mid) | Qte (40) | Unit (60) | PU HT (60) | Total HT (70)
  const COL_DESIGN_X = MARGIN;
  const COL_QTE_X = MARGIN + 280;
  const COL_UNIT_X = MARGIN + 320;
  const COL_PU_X = MARGIN + 380;
  const COL_TOTAL_X = MARGIN + CONTENT_W;

  // Header tableau
  page.drawRectangle({
    x: MARGIN,
    y: y - 22,
    width: CONTENT_W,
    height: 22,
    color: COLOR_ACCENT,
  });
  const headerY = y - 15;
  page.drawText("DÉSIGNATION", { x: COL_DESIGN_X + 8, y: headerY, font: bold, size: 8, color: COLOR_WHITE });
  page.drawText("QTÉ", { x: COL_QTE_X, y: headerY, font: bold, size: 8, color: COLOR_WHITE });
  page.drawText("UNITÉ", { x: COL_UNIT_X, y: headerY, font: bold, size: 8, color: COLOR_WHITE });
  // PU HT et Total HT alignes a droite
  const puHeader = "PU HT";
  page.drawText(puHeader, { x: COL_PU_X + 60 - bold.widthOfTextAtSize(puHeader, 8), y: headerY, font: bold, size: 8, color: COLOR_WHITE });
  const totalHeader = "TOTAL HT";
  page.drawText(totalHeader, {
    x: COL_TOTAL_X - bold.widthOfTextAtSize(totalHeader, 8),
    y: headerY,
    font: bold,
    size: 8,
    color: COLOR_WHITE,
  });
  y -= 22;

  // Lignes — wrap propre du texte designation + detail, hauteur dynamique
  // selon le contenu reel. Evite le debordement sur la colonne QTE.
  const DESIGN_MAX_W = COL_QTE_X - COL_DESIGN_X - 16; // 8 pad gauche + 8 marge droite
  const DESIGN_SIZE = 9.5;
  const DESIGN_LINE_H = 12;
  const DETAIL_SIZE = 8;
  const DETAIL_LINE_H = 10;
  const PAD_VERT = 8;
  const MIN_LINE_H = 22;

  for (let i = 0; i < devis.lignes.length; i++) {
    const ligne = devis.lignes[i];

    // Pre-calcule la hauteur reelle de la ligne en simulant le wrap
    const designLines = countWrappedLines(ligne.designation, {
      font: bold,
      size: DESIGN_SIZE,
      maxWidth: DESIGN_MAX_W,
    });
    const detailLines = ligne.detail
      ? countWrappedLines(ligne.detail, {
          font: regular,
          size: DETAIL_SIZE,
          maxWidth: DESIGN_MAX_W,
        })
      : 0;
    const contentH =
      designLines * DESIGN_LINE_H +
      (detailLines > 0 ? 2 + detailLines * DETAIL_LINE_H : 0);
    const lineH = Math.max(MIN_LINE_H, contentH + PAD_VERT * 2);

    // bg alterne tres leger
    if (i % 2 === 0) {
      page.drawRectangle({
        x: MARGIN,
        y: y - lineH,
        width: CONTENT_W,
        height: lineH,
        color: rgb(0.985, 0.98, 0.97),
      });
    }

    // Designation (wrap, bold)
    const designY = y - PAD_VERT - 2;
    drawWrappedText(page, ligne.designation, {
      x: COL_DESIGN_X + 8,
      y: designY,
      maxWidth: DESIGN_MAX_W,
      font: bold,
      size: DESIGN_SIZE,
      color: COLOR_TEXT,
      lineHeight: DESIGN_LINE_H,
    });

    // Detail sous la designation (wrap, regular, plus petit, gris)
    if (ligne.detail) {
      const detailY = designY - designLines * DESIGN_LINE_H;
      drawWrappedText(page, ligne.detail, {
        x: COL_DESIGN_X + 8,
        y: detailY,
        maxWidth: DESIGN_MAX_W,
        font: regular,
        size: DETAIL_SIZE,
        color: COLOR_LIGHT,
        lineHeight: DETAIL_LINE_H,
      });
    }

    // Colonnes QTE / UNITE / PU / TOTAL — alignees verticalement avec la
    // PREMIERE ligne de la designation (centre visuel).
    const valueY = y - PAD_VERT - 2;
    page.drawText(String(ligne.quantite), {
      x: COL_QTE_X,
      y: valueY,
      font: regular,
      size: DESIGN_SIZE,
      color: COLOR_TEXT,
    });
    page.drawText(ligne.unite, {
      x: COL_UNIT_X,
      y: valueY,
      font: regular,
      size: DESIGN_SIZE,
      color: COLOR_TEXT,
    });
    const puText = fmtEUR(ligne.prixUnitaireHT);
    page.drawText(puText, {
      x: COL_PU_X + 60 - regular.widthOfTextAtSize(puText, DESIGN_SIZE),
      y: valueY,
      font: regular,
      size: DESIGN_SIZE,
      color: COLOR_TEXT,
    });
    const totalText = fmtEUR(ligne.montantHT);
    page.drawText(totalText, {
      x: COL_TOTAL_X - bold.widthOfTextAtSize(totalText, DESIGN_SIZE),
      y: valueY,
      font: bold,
      size: DESIGN_SIZE,
      color: COLOR_TEXT,
    });
    y -= lineH;
  }

  // Ligne separation
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_W, y },
    color: COLOR_LINE,
    thickness: 1,
  });

  // ── TOTAUX ────────────────────────────────────────────────────────────
  y -= 16;
  const totauxBoxX = MARGIN + CONTENT_W - 220;

  function drawTotalLine(label: string, value: string, opts?: { bold?: boolean; size?: number; accent?: boolean }) {
    const size = opts?.size ?? 10;
    const font = opts?.bold ? bold : regular;
    const color = opts?.accent ? COLOR_ACCENT : COLOR_TEXT;
    page.drawText(label, {
      x: totauxBoxX,
      y,
      font,
      size,
      color: opts?.accent ? color : COLOR_MUTED,
    });
    page.drawText(value, {
      x: MARGIN + CONTENT_W - font.widthOfTextAtSize(value, size),
      y,
      font,
      size,
      color,
    });
    y -= size * 1.6;
  }

  drawTotalLine("Total HT", fmtEUR(devis.totaux.totalHT));
  drawTotalLine(`TVA ${devis.tauxTVA}%`, fmtEUR(devis.totaux.montantTVA));
  page.drawLine({
    start: { x: totauxBoxX, y: y + 6 },
    end: { x: MARGIN + CONTENT_W, y: y + 6 },
    color: COLOR_LINE,
    thickness: 1,
  });
  drawTotalLine("TOTAL TTC", fmtEUR(devis.totaux.totalTTC), { bold: true, size: 12, accent: true });

  // ── CONDITIONS / PIED DE PAGE ─────────────────────────────────────────
  y -= 12;
  page.drawText("CONDITIONS DE PAIEMENT", {
    x: MARGIN,
    y,
    font: bold,
    size: 8,
    color: COLOR_MUTED,
  });
  y -= 12;
  y = drawWrappedText(page, devis.conditionsPaiement, {
    x: MARGIN,
    y,
    maxWidth: CONTENT_W - 160,
    font: regular,
    size: 9,
    color: COLOR_TEXT,
    lineHeight: 12,
  });

  // Signature pro (en bas a droite)
  if (devis.emetteur.signatureDataUrl) {
    try {
      const sigImg = await embedDataUrl(pdf, devis.emetteur.signatureDataUrl);
      if (sigImg) {
        const scaled = sigImg.scaleToFit(120, 50);
        const sigX = MARGIN + CONTENT_W - scaled.width - 8;
        const sigY = y - 40;
        page.drawImage(sigImg, {
          x: sigX,
          y: sigY,
          width: scaled.width,
          height: scaled.height,
        });
        page.drawText("Signature de l'émetteur", {
          x: sigX,
          y: sigY - 10,
          font: regular,
          size: 7,
          color: COLOR_LIGHT,
        });
      }
    } catch {
      // ignore
    }
  }

  // Footer ultra-bas — mention legale + reference diagnostic source
  const footerY = MARGIN - 12;
  page.drawLine({
    start: { x: MARGIN, y: footerY + 14 },
    end: { x: MARGIN + CONTENT_W, y: footerY + 14 },
    color: COLOR_LINE,
    thickness: 0.5,
  });
  const footerParts: string[] = [];
  if (devis.diagnosticRef) {
    footerParts.push(
      `Diagnostic source du ${fmtDateFR(devis.diagnosticRef.dateDiagnosticISO)} sur ${devis.diagnosticRef.composant}`
    );
  }
  if (devis.emetteur.email) footerParts.push(devis.emetteur.email);
  if (devis.emetteur.telephone) footerParts.push(devis.emetteur.telephone);
  page.drawText(footerParts.join("  ·  ").slice(0, 130), {
    x: MARGIN,
    y: footerY,
    font: regular,
    size: 7,
    color: COLOR_LIGHT,
  });

  return await pdf.save();
}
