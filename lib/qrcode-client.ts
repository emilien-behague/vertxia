"use client";

import QRCode from "qrcode";

// QR Code helpers côté client — génère SVG (affichage net), PNG dataURL (download),
// et PDF stickers A4 (8 par feuille, prêts à découper et coller sur les équipements).
//
// L'URL encodée pointe vers /eq/<id> sur l'origine courante (window.location.origin),
// ce qui fonctionne aussi bien en dev (192.168.1.x:3000) qu'en prod (vertxia.com).

const QR_OPTIONS: QRCode.QRCodeRenderersOptions = {
  errorCorrectionLevel: "M",
  margin: 1,
  color: { dark: "#111111", light: "#FFFFFF" },
};

export function equipementUrl(equipementId: string): string {
  if (typeof window === "undefined") return `/eq/${equipementId}`;
  return `${window.location.origin}/eq/${equipementId}`;
}

export async function qrSvgFor(equipementId: string, scale = 8): Promise<string> {
  return QRCode.toString(equipementUrl(equipementId), {
    ...QR_OPTIONS,
    type: "svg",
    width: scale * 32,
  });
}

export async function qrPngDataUrl(equipementId: string, scale = 12): Promise<string> {
  return QRCode.toDataURL(equipementUrl(equipementId), {
    ...QR_OPTIONS,
    width: scale * 64,
  });
}

// Déclenche le download d'un PNG QR Code pour 1 équipement.
export async function downloadQrPng(equipementId: string, filename: string): Promise<void> {
  const dataUrl = await qrPngDataUrl(equipementId, 16);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Génère et déclenche le download d'un PDF A4 contenant 8 stickers QR (2 col × 4 lignes).
// Chaque sticker : QR Code 70mm × 70mm + texte "VERTXIA" + numéro de série.
// À découper sur les pointillés et coller sur l'équipement.
export async function downloadStickerSheet(
  equipements: Array<{ id: string; modele: string; numeroSerie: string }>
): Promise<void> {
  // Lazy load pdf-lib pour ne pas alourdir le bundle initial.
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  // Génère tous les QR en parallèle en PNG dataURL haute résolution.
  const qrDataUrls = await Promise.all(
    equipements.map((eq) => qrPngDataUrl(eq.id, 24))
  );

  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Format A4 en points (72pt = 1 inch ≈ 25.4mm)
  const A4_W = 595;
  const A4_H = 842;
  const COLS = 2;
  const ROWS = 4;
  const PER_PAGE = COLS * ROWS; // 8 stickers / page
  const MARGIN = 30;
  const CELL_W = (A4_W - MARGIN * 2) / COLS; // ~268pt
  const CELL_H = (A4_H - MARGIN * 2) / ROWS; // ~196pt

  for (let p = 0; p < equipements.length; p += PER_PAGE) {
    const page = doc.addPage([A4_W, A4_H]);
    const chunk = equipements.slice(p, p + PER_PAGE);

    for (let i = 0; i < chunk.length; i++) {
      const eq = chunk[i];
      const dataUrl = qrDataUrls[p + i];
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = MARGIN + col * CELL_W;
      const y = A4_H - MARGIN - (row + 1) * CELL_H;

      // QR Code image (carré centré dans la cellule, ~120pt = ~42mm).
      const pngBytes = Uint8Array.from(
        atob(dataUrl.split(",")[1]),
        (c) => c.charCodeAt(0)
      );
      const png = await doc.embedPng(pngBytes);
      const qrSize = 120;
      const qrX = x + (CELL_W - qrSize) / 2;
      const qrY = y + CELL_H - qrSize - 30;
      page.drawImage(png, { x: qrX, y: qrY, width: qrSize, height: qrSize });

      // Label "VERTXIA" au-dessus du QR
      page.drawText("VERTXIA", {
        x: qrX,
        y: qrY + qrSize + 8,
        size: 8,
        font: helvBold,
        color: rgb(0.067, 0.067, 0.067),
      });

      // Modèle équipement (sous le QR, tronqué si trop long)
      const modeleClean = eq.modele.length > 32 ? eq.modele.slice(0, 32) + "…" : eq.modele;
      page.drawText(modeleClean, {
        x: x + 10,
        y: qrY - 14,
        size: 8,
        font: helv,
        color: rgb(0.2, 0.2, 0.2),
        maxWidth: CELL_W - 20,
      });
      // N° série
      const snClean = `S/N ${eq.numeroSerie}`;
      page.drawText(snClean, {
        x: x + 10,
        y: qrY - 26,
        size: 7,
        font: helv,
        color: rgb(0.45, 0.45, 0.45),
        maxWidth: CELL_W - 20,
      });

      // Ligne de découpe en pointillés (bord de la cellule)
      const dashed = { dashArray: [3, 3], color: rgb(0.75, 0.75, 0.75), thickness: 0.5 };
      // top
      page.drawLine({ start: { x, y: y + CELL_H }, end: { x: x + CELL_W, y: y + CELL_H }, ...dashed });
      // bottom
      page.drawLine({ start: { x, y }, end: { x: x + CELL_W, y }, ...dashed });
      // left
      page.drawLine({ start: { x, y }, end: { x, y: y + CELL_H }, ...dashed });
      // right
      page.drawLine({ start: { x: x + CELL_W, y }, end: { x: x + CELL_W, y: y + CELL_H }, ...dashed });
    }
  }

  const bytes = await doc.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vertxia_stickers_qr_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
