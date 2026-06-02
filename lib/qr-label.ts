// Génération d'une étiquette PDF A6 (105×148mm) à coller sur l'équipement.
// QR code → URL publique /eq/[id] qui ouvre la fiche complète sur le téléphone
// du frigoriste qui scanne.
//
// Usage :
//   const blob = await generateQrLabel(equipement, window.location.origin);
//   const url = URL.createObjectURL(blob);
//   <a href={url} download="etiquette.pdf">…</a>

import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { StoredEquipement } from "@/lib/equipement";

// Format A6 portrait en points PDF (1 pt = 1/72 inch, 25.4 mm = 72 pt)
const A6_WIDTH = 297.64; // 105 mm
const A6_HEIGHT = 419.53; // 148 mm

export async function generateQrLabel(
  eq: StoredEquipement,
  origin: string
): Promise<Blob> {
  // 1. Génère le QR code en PNG haute résolution
  const targetUrl = `${origin.replace(/\/$/, "")}/eq/${eq.id}`;
  const qrDataUrl = await QRCode.toDataURL(targetUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 800,
    color: { dark: "#111111", light: "#FFFFFF" },
  });
  const qrBytes = Uint8Array.from(
    atob(qrDataUrl.split(",")[1]),
    (c) => c.charCodeAt(0)
  );

  // 2. Construit le PDF A6
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([A6_WIDTH, A6_HEIGHT]);
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvMono = await pdfDoc.embedFont(StandardFonts.Courier);

  // Background blanc cassé Vertxia
  page.drawRectangle({
    x: 0,
    y: 0,
    width: A6_WIDTH,
    height: A6_HEIGHT,
    color: rgb(0.96, 0.96, 0.94),
  });

  // Header bandeau noir
  const headerHeight = 36;
  page.drawRectangle({
    x: 0,
    y: A6_HEIGHT - headerHeight,
    width: A6_WIDTH,
    height: headerHeight,
    color: rgb(0.07, 0.07, 0.07),
  });
  page.drawText("VERTXIA · F-GAS", {
    x: 14,
    y: A6_HEIGHT - 22,
    size: 9,
    font: helvBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("FICHE EQUIPEMENT", {
    x: A6_WIDTH - 92,
    y: A6_HEIGHT - 22,
    size: 7,
    font: helv,
    color: rgb(0.7, 0.7, 0.7),
  });

  // QR code centré
  const qrImage = await pdfDoc.embedPng(qrBytes);
  const qrSize = 180;
  const qrX = (A6_WIDTH - qrSize) / 2;
  const qrY = A6_HEIGHT - headerHeight - qrSize - 18;
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  // Sous le QR : modèle (gros), client (medium), N° série (mono)
  let cursorY = qrY - 22;

  const modele = (eq.modele || "Équipement").trim();
  const modeleSize = modele.length > 28 ? 11 : modele.length > 18 ? 13 : 15;
  drawCentered(page, modele, A6_WIDTH, cursorY, modeleSize, helvBold, rgb(0.07, 0.07, 0.07));
  cursorY -= modeleSize + 6;

  if (eq.clientName) {
    drawCentered(page, eq.clientName, A6_WIDTH, cursorY, 10, helv, rgb(0.35, 0.35, 0.35));
    cursorY -= 14;
  }
  if (eq.siteAdresse) {
    drawCentered(page, truncate(eq.siteAdresse, 48), A6_WIDTH, cursorY, 8, helv, rgb(0.5, 0.5, 0.5));
    cursorY -= 11;
  }

  // Numéro de série en mono (étiquette physique = pas d'ambiguïté avec lettres/chiffres similaires)
  if (eq.numeroSerie) {
    cursorY -= 4;
    drawCentered(page, "N° SÉRIE", A6_WIDTH, cursorY, 6, helv, rgb(0.55, 0.55, 0.55));
    cursorY -= 11;
    drawCentered(page, eq.numeroSerie, A6_WIDTH, cursorY, 10, helvMono, rgb(0.07, 0.07, 0.07));
    cursorY -= 14;
  }

  // Fluide + charge (mini badge inline)
  if (eq.fluide?.code) {
    cursorY -= 6;
    const fluideText = `${eq.fluide.code}${eq.chargeKg > 0 ? " · " + eq.chargeKg.toFixed(2) + " kg" : ""}`;
    drawCentered(page, fluideText, A6_WIDTH, cursorY, 8, helv, rgb(0.45, 0.45, 0.45));
  }

  // Footer fixe en bas : URL + instruction scan
  page.drawText("Scannez pour ouvrir la fiche complète", {
    x: 14,
    y: 22,
    size: 7,
    font: helv,
    color: rgb(0.55, 0.55, 0.55),
  });
  page.drawText(truncate(targetUrl.replace(/^https?:\/\//, ""), 50), {
    x: 14,
    y: 10,
    size: 6,
    font: helvMono,
    color: rgb(0.4, 0.4, 0.4),
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as unknown as ArrayBuffer], { type: "application/pdf" });
}

function drawCentered(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  pageWidth: number,
  y: number,
  size: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  color: ReturnType<typeof rgb>
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: (pageWidth - width) / 2,
    y,
    size,
    font,
    color,
  });
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
