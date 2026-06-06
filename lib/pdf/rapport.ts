// Rapport d'intervention F-Gas — PDF "humain" remis au client final.
//
// Differe du BSFF (TrackDechets technique) et du CERFA (reglementaire ADEME) :
// c'est le livrable visible que le frigoriste remet a son client (hotel,
// restaurant, usine, syndic) apres une intervention. Vertxia branded, photo
// diagnostic IA, observations terrain, prochain controle reglementaire,
// signature avec cadre attestation.
//
// Charset : embed NotoSans Unicode via fontkit subset:true → ~50KB final +
// support fleches, exposants, smart quotes, sans erreur "WinAnsi cannot encode"
// que les StandardFonts Helvetica/Times renvoyaient sur "→ é ² CO2eq".
//
// Genere un A4 from-scratch via pdf-lib. Multi-page automatique si overflow.

import { PDFDocument, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CerfaInput, TypeIntervention } from "@/lib/cerfa/cerfa";
import type { Profil } from "@/lib/profil";

// ── Types entrée ──────────────────────────────────────────────────────────

/** Defaut detecte par la vision IA — calque sur DiagnosticResult.defautsDetectes.
 *  Valeurs alignees avec lib/vision-diagnostic.ts (DefautGravite). */
export type RapportDiagnosticGravite = "info" | "surveiller" | "urgent" | "critique";
export type RapportDiagnosticDelai = "preventif" | "1-3 mois" | "1 mois" | "urgent";

export type RapportDiagnosticDefaut = {
  nom: string;
  description: string;
  gravite: RapportDiagnosticGravite;
};

export type RapportDiagnostic = {
  /** JPEG/PNG data URL ~2000px qualite 80% (taille raisonnable pour embed) */
  imageDataUrl: string;
  composantIdentifie: string;
  defautsDetectes: RapportDiagnosticDefaut[];
  actionRecommandee?: string;
  delaiIntervention?: RapportDiagnosticDelai;
};

export type RapportInput = CerfaInput & {
  profil: Profil;
  /** Si l'intervention vient d'un diagnostic IA, on l'affiche dans le rapport
   *  pour montrer au client final que la decision technique est tracee. */
  diagnostic?: RapportDiagnostic | null;
  /** Date de l'intervention reelle (sinon today) */
  interventionDate?: string;
  /** Notes / observations terrain du technicien (libre) */
  observationsTerrain?: string;
  /** Prochain controle reglementaire calcule (ISO) — affiche si fourni */
  prochainControleISO?: string;
  /** Frequence reglementaire en mois (5/12/24…) — affiche avec le prochain */
  frequenceControleMois?: number;
};

// ── Constantes design ─────────────────────────────────────────────────────

const TYPE_LABELS: Record<TypeIntervention, string> = {
  recuperation: "Récupération de fluide frigorigène",
  demantelement: "Démantèlement de l'équipement",
  controle_periodique: "Contrôle d'étanchéité périodique",
  controle_non_periodique: "Contrôle d'étanchéité non périodique",
  mise_service: "Mise en service / Première charge",
  maintenance: "Maintenance / Recharge",
  assemblage: "Assemblage de l'équipement",
  modification: "Modification de l'équipement",
};

const GRAVITE_LABELS: Record<RapportDiagnosticGravite, string> = {
  info: "Info",
  surveiller: "À surveiller",
  urgent: "Urgent",
  critique: "Critique",
};

const DELAI_LABELS: Record<RapportDiagnosticDelai, string> = {
  preventif: "Préventif (prochain contrôle)",
  "1-3 mois": "Dans le trimestre",
  "1 mois": "Dans le mois",
  urgent: "Sous 7 jours",
};

// Palette Vertxia
const COLOR_ACCENT = rgb(0.631, 0.384, 0.027); // #A16207 ocre
const COLOR_ACCENT_DARK = rgb(0.541, 0.322, 0.024); // #8A5206
const COLOR_TEXT = rgb(0.067, 0.067, 0.067); // #111
const COLOR_MUTED = rgb(0.42, 0.42, 0.42); // #6B6B6B
const COLOR_LIGHT = rgb(0.6, 0.6, 0.6); // #999
const COLOR_LINE = rgb(0.9, 0.9, 0.9); // #E5E5E5
const COLOR_CREAM = rgb(0.961, 0.957, 0.941); // #F5F4F0
const COLOR_WHITE = rgb(1, 1, 1);

// Gravite -> couleurs (pastille + bg badge)
const GRAVITE_COLORS: Record<RapportDiagnosticGravite, { dot: ReturnType<typeof rgb>; bg: ReturnType<typeof rgb>; text: ReturnType<typeof rgb> }> = {
  info: { dot: rgb(0.4, 0.6, 0.9), bg: rgb(0.92, 0.96, 1), text: rgb(0.2, 0.4, 0.7) },
  surveiller: { dot: rgb(0.95, 0.74, 0.16), bg: rgb(1, 0.96, 0.86), text: rgb(0.55, 0.4, 0.05) },
  urgent: { dot: rgb(0.92, 0.45, 0.13), bg: rgb(1, 0.93, 0.85), text: rgb(0.7, 0.32, 0.05) },
  critique: { dot: rgb(0.85, 0.18, 0.18), bg: rgb(1, 0.91, 0.91), text: rgb(0.65, 0.1, 0.1) },
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const HEADER_BAND_HEIGHT = 90;
const FOOTER_HEIGHT = 35;

// ── Helpers ───────────────────────────────────────────────────────────────

let cachedFontBytes: Uint8Array | null = null;
async function loadUnicodeFontBytes(): Promise<Uint8Array> {
  if (cachedFontBytes) return cachedFontBytes;
  const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");
  const buf = await readFile(fontPath);
  cachedFontBytes = new Uint8Array(buf);
  return cachedFontBytes;
}

let cachedFontBoldBytes: Uint8Array | null = null;
async function loadUnicodeFontBoldBytes(): Promise<Uint8Array | null> {
  if (cachedFontBoldBytes) return cachedFontBoldBytes;
  try {
    const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf");
    const buf = await readFile(fontPath);
    cachedFontBoldBytes = new Uint8Array(buf);
    return cachedFontBoldBytes;
  } catch {
    return null; // pas de bold dispo → fallback regular
  }
}

function fmtDateFR(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function fmtDateTimeFR(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtKg(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

function fmtTeqCO2(weight: number, gwp: number): string {
  const t = (weight * gwp) / 1000;
  if (t < 1) return `${(t * 1000).toFixed(0)} kg eq. CO₂`;
  return `${t.toFixed(3).replace(".", ",")} t eq. CO₂`;
}

function generateRapportNumber(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const time = `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  return `VTX-${yy}${mm}${dd}-${time}`;
}

// Word-wrap basique sur la largeur de contenu donnée
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ── Embed image depuis data URL avec gestion erreur ───────────────────────

async function embedImageFromDataUrl(
  pdf: PDFDocument,
  dataUrl: string
): Promise<PDFImage | null> {
  try {
    if (dataUrl.startsWith("data:image/png")) {
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
      return await pdf.embedPng(Buffer.from(base64, "base64"));
    }
    if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) {
      const base64 = dataUrl.replace(/^data:image\/jpe?g;base64,/, "");
      return await pdf.embedJpg(Buffer.from(base64, "base64"));
    }
    return null;
  } catch (e) {
    console.warn("[rapport] image embed failed:", e);
    return null;
  }
}

// ── Drawing primitives ────────────────────────────────────────────────────

type DrawCtx = {
  pdf: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  y: number;
  rapportNumber: string;
  pageIndex: number;
};

function ensureSpace(ctx: DrawCtx, needed: number): void {
  if (ctx.y - needed < FOOTER_HEIGHT + 20) {
    drawFooter(ctx);
    addNewPage(ctx);
  }
}

function addNewPage(ctx: DrawCtx): void {
  ctx.page = ctx.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.pageIndex += 1;
  ctx.y = PAGE_HEIGHT - MARGIN;
  // Petit rappel d'identite en haut des pages suivantes
  ctx.page.drawText(`RAPPORT D'INTERVENTION  ·  ${ctx.rapportNumber}`, {
    x: MARGIN,
    y: PAGE_HEIGHT - 30,
    size: 8,
    font: ctx.fontBold,
    color: COLOR_ACCENT,
  });
  ctx.page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - 36 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 36 },
    thickness: 0.5,
    color: COLOR_LINE,
  });
  ctx.y = PAGE_HEIGHT - 60;
}

function drawSectionTitle(ctx: DrawCtx, title: string): void {
  ensureSpace(ctx, 30);
  // Petit carre accent + titre
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 1,
    width: 3,
    height: 11,
    color: COLOR_ACCENT,
  });
  ctx.page.drawText(title.toUpperCase(), {
    x: MARGIN + 10,
    y: ctx.y,
    size: 9,
    font: ctx.fontBold,
    color: COLOR_TEXT,
  });
  ctx.y -= 18;
}

function drawKeyValue(ctx: DrawCtx, label: string, value: string, opts?: { valueSize?: number; valueBold?: boolean }): void {
  if (!value) return;
  ensureSpace(ctx, 28);
  const labelSize = 8;
  const valueSize = opts?.valueSize ?? 11;
  ctx.page.drawText(label.toUpperCase(), {
    x: MARGIN,
    y: ctx.y,
    size: labelSize,
    font: ctx.font,
    color: COLOR_LIGHT,
  });
  ctx.y -= 12;
  const lines = wrapText(value, opts?.valueBold ? ctx.fontBold : ctx.font, valueSize, CONTENT_WIDTH);
  for (const line of lines) {
    ensureSpace(ctx, valueSize + 4);
    ctx.page.drawText(line, {
      x: MARGIN,
      y: ctx.y,
      size: valueSize,
      font: opts?.valueBold ? ctx.fontBold : ctx.font,
      color: COLOR_TEXT,
    });
    ctx.y -= valueSize + 3;
  }
  ctx.y -= 8;
}

function drawTwoColRow(
  ctx: DrawCtx,
  left: { label: string; value: string },
  right: { label: string; value: string }
): void {
  ensureSpace(ctx, 30);
  const col2X = MARGIN + CONTENT_WIDTH / 2 + 10;
  ctx.page.drawText(left.label.toUpperCase(), {
    x: MARGIN,
    y: ctx.y,
    size: 8,
    font: ctx.font,
    color: COLOR_LIGHT,
  });
  ctx.page.drawText(right.label.toUpperCase(), {
    x: col2X,
    y: ctx.y,
    size: 8,
    font: ctx.font,
    color: COLOR_LIGHT,
  });
  ctx.y -= 13;
  ctx.page.drawText(left.value, {
    x: MARGIN,
    y: ctx.y,
    size: 11,
    font: ctx.fontBold,
    color: COLOR_TEXT,
  });
  ctx.page.drawText(right.value, {
    x: col2X,
    y: ctx.y,
    size: 11,
    font: ctx.fontBold,
    color: COLOR_TEXT,
  });
  ctx.y -= 22;
}

async function drawHeader(ctx: DrawCtx, profil: Profil, dateFR: string): Promise<void> {
  // Band ocre full width tout en haut
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - HEADER_BAND_HEIGHT,
    width: PAGE_WIDTH,
    height: HEADER_BAND_HEIGHT,
    color: COLOR_ACCENT,
  });

  // Titre en blanc
  ctx.page.drawText("RAPPORT D'INTERVENTION", {
    x: MARGIN,
    y: PAGE_HEIGHT - 38,
    size: 20,
    font: ctx.fontBold,
    color: COLOR_WHITE,
  });
  ctx.page.drawText(`F-Gas  ·  ${ctx.rapportNumber}  ·  ${dateFR}`, {
    x: MARGIN,
    y: PAGE_HEIGHT - 58,
    size: 10,
    font: ctx.font,
    color: rgb(1, 1, 1),
    opacity: 0.85,
  });

  // Logo VERTXIA en haut droite (toujours, c'est le branding du document)
  const brandTxt = "VERTXIA";
  const brandSize = 14;
  const brandW = ctx.fontBold.widthOfTextAtSize(brandTxt, brandSize);
  ctx.page.drawText(brandTxt, {
    x: PAGE_WIDTH - MARGIN - brandW,
    y: PAGE_HEIGHT - 35,
    size: brandSize,
    font: ctx.fontBold,
    color: COLOR_WHITE,
  });
  const taglineTxt = "Conformité F-Gas augmentée par l'IA";
  const taglineSize = 8;
  const taglineW = ctx.font.widthOfTextAtSize(taglineTxt, taglineSize);
  ctx.page.drawText(taglineTxt, {
    x: PAGE_WIDTH - MARGIN - taglineW,
    y: PAGE_HEIGHT - 48,
    size: taglineSize,
    font: ctx.font,
    color: rgb(1, 1, 1),
    opacity: 0.85,
  });

  // Bande entreprise sous le band ocre.
  // Si logo present : logo a gauche (carré 55x55) + bloc texte decale de 70px.
  // Si pas de logo : tout aligne a gauche (comportement initial).
  const blockTopY = PAGE_HEIGHT - HEADER_BAND_HEIGHT - 20;
  let textStartX = MARGIN;

  if (profil.logoDataUrl) {
    const logoImg = await embedImageFromDataUrl(ctx.pdf, profil.logoDataUrl);
    if (logoImg) {
      const LOGO_BOX = 55;
      const scaled = logoImg.scaleToFit(LOGO_BOX, LOGO_BOX);
      ctx.page.drawImage(logoImg, {
        x: MARGIN,
        y: blockTopY - scaled.height + 8,
        width: scaled.width,
        height: scaled.height,
      });
      textStartX = MARGIN + LOGO_BOX + 15;
    }
  }

  ctx.y = blockTopY;
  if (profil.raisonSociale) {
    ctx.page.drawText(profil.raisonSociale, {
      x: textStartX,
      y: ctx.y,
      size: 13,
      font: ctx.fontBold,
      color: COLOR_TEXT,
    });
    ctx.y -= 16;
  }
  const entrepriseLines: string[] = [];
  if (profil.adresseRue) entrepriseLines.push(profil.adresseRue);
  if (profil.adresseCp && profil.adresseVille) {
    entrepriseLines.push(`${profil.adresseCp} ${profil.adresseVille}`);
  }
  const idLine: string[] = [];
  if (profil.siret) idLine.push(`SIRET ${profil.siret}`);
  if (profil.numeroAttestation) idLine.push(`Att. F-Gas ${profil.numeroAttestation}`);
  if (idLine.length) entrepriseLines.push(idLine.join("  ·  "));
  const contactLine = [profil.telephone, profil.email].filter(Boolean).join("  ·  ");
  if (contactLine) entrepriseLines.push(contactLine);
  for (const line of entrepriseLines) {
    ctx.page.drawText(line, {
      x: textStartX,
      y: ctx.y,
      size: 9,
      font: ctx.font,
      color: COLOR_MUTED,
    });
    ctx.y -= 12;
  }
  ctx.y -= 14;
}

function drawFooter(ctx: DrawCtx): void {
  const y = FOOTER_HEIGHT - 12;
  ctx.page.drawLine({
    start: { x: MARGIN, y: FOOTER_HEIGHT },
    end: { x: PAGE_WIDTH - MARGIN, y: FOOTER_HEIGHT },
    thickness: 0.3,
    color: COLOR_LINE,
  });
  ctx.page.drawText("Document généré par Vertxia  ·  vertxia.com", {
    x: MARGIN,
    y,
    size: 8,
    font: ctx.font,
    color: COLOR_LIGHT,
  });
  const numeroTxt = `Rapport ${ctx.rapportNumber}  ·  page ${ctx.pageIndex}`;
  const numeroWidth = ctx.font.widthOfTextAtSize(numeroTxt, 8);
  ctx.page.drawText(numeroTxt, {
    x: PAGE_WIDTH - MARGIN - numeroWidth,
    y,
    size: 8,
    font: ctx.font,
    color: COLOR_LIGHT,
  });
}

// ── Sections ──────────────────────────────────────────────────────────────

function drawClientSection(ctx: DrawCtx, input: RapportInput): void {
  if (!input.clientName && !input.lieuIntervention) return;
  drawSectionTitle(ctx, "Client / Détenteur");
  if (input.clientName) {
    ensureSpace(ctx, 18);
    ctx.page.drawText(input.clientName, {
      x: MARGIN,
      y: ctx.y,
      size: 13,
      font: ctx.fontBold,
      color: COLOR_TEXT,
    });
    ctx.y -= 16;
  }
  if (input.lieuIntervention) {
    ensureSpace(ctx, 14);
    ctx.page.drawText(input.lieuIntervention, {
      x: MARGIN,
      y: ctx.y,
      size: 10,
      font: ctx.font,
      color: COLOR_MUTED,
    });
    ctx.y -= 14;
  }
  ctx.y -= 14;
}

function drawEquipementSection(ctx: DrawCtx, input: RapportInput): void {
  drawSectionTitle(ctx, "Équipement");
  if (input.modeleEquipement) {
    ensureSpace(ctx, 18);
    ctx.page.drawText(input.modeleEquipement, {
      x: MARGIN,
      y: ctx.y,
      size: 13,
      font: ctx.fontBold,
      color: COLOR_TEXT,
    });
    ctx.y -= 16;
  }
  if (input.numeroSerieEquipement) {
    ensureSpace(ctx, 14);
    ctx.page.drawText(`N° de série · ${input.numeroSerieEquipement}`, {
      x: MARGIN,
      y: ctx.y,
      size: 10,
      font: ctx.font,
      color: COLOR_MUTED,
    });
    ctx.y -= 14;
  }
  ctx.y -= 4;

  // Tableau fluide / charge / CO2eq en 3 colonnes
  ensureSpace(ctx, 50);
  const colW = CONTENT_WIDTH / 3;
  const boxY = ctx.y - 38;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: boxY,
    width: CONTENT_WIDTH,
    height: 38,
    color: COLOR_CREAM,
  });
  const drawCol = (i: number, label: string, value: string) => {
    const x = MARGIN + i * colW + 12;
    ctx.page.drawText(label.toUpperCase(), {
      x,
      y: boxY + 24,
      size: 7,
      font: ctx.font,
      color: COLOR_LIGHT,
    });
    ctx.page.drawText(value, {
      x,
      y: boxY + 9,
      size: 11,
      font: ctx.fontBold,
      color: COLOR_TEXT,
    });
  };
  drawCol(0, "Fluide frigorigène", `${input.fluide.code} (GWP ${input.fluide.gwp.toLocaleString("fr-FR")})`);
  drawCol(1, "Charge manipulée", input.weight > 0 ? `${fmtKg(input.weight)} kg` : "—");
  drawCol(2, "Équivalent CO₂", input.weight > 0 ? fmtTeqCO2(input.weight, input.fluide.gwp) : "—");
  ctx.y = boxY - 14;
}

async function drawDiagnosticSection(
  ctx: DrawCtx,
  diagnostic: RapportDiagnostic
): Promise<void> {
  drawSectionTitle(ctx, "Diagnostic technique");

  // Polaroid de la photo a gauche (140x140 max, ~150 width incl. caption)
  const polaroidW = 150;
  const polaroidH = 165;
  ensureSpace(ctx, polaroidH + 10);
  const polaroidX = MARGIN;
  const polaroidY = ctx.y - polaroidH;

  // Cadre blanc avec ombre legere (un rect gris derriere)
  ctx.page.drawRectangle({
    x: polaroidX + 2,
    y: polaroidY - 2,
    width: polaroidW,
    height: polaroidH,
    color: rgb(0.88, 0.88, 0.88),
  });
  ctx.page.drawRectangle({
    x: polaroidX,
    y: polaroidY,
    width: polaroidW,
    height: polaroidH,
    color: COLOR_WHITE,
    borderColor: COLOR_LINE,
    borderWidth: 0.5,
  });

  // L'image dans le polaroid
  const img = await embedImageFromDataUrl(ctx.pdf, diagnostic.imageDataUrl);
  if (img) {
    const innerW = polaroidW - 14;
    const innerH = polaroidH - 38; // espace en bas pour caption
    const scale = img.scaleToFit(innerW, innerH);
    const imgX = polaroidX + (polaroidW - scale.width) / 2;
    const imgY = polaroidY + polaroidH - 7 - scale.height;
    ctx.page.drawImage(img, {
      x: imgX,
      y: imgY,
      width: scale.width,
      height: scale.height,
    });
  } else {
    // Placeholder si l'image n'a pas pu etre chargee
    ctx.page.drawText("Photo indisponible", {
      x: polaroidX + 30,
      y: polaroidY + polaroidH / 2,
      size: 9,
      font: ctx.font,
      color: COLOR_LIGHT,
    });
  }

  // Caption sous l'image dans le polaroid
  const captionY = polaroidY + 12;
  const captionTxt = "Photo terrain · IA Vertxia";
  ctx.page.drawText(captionTxt, {
    x: polaroidX + 10,
    y: captionY,
    size: 7,
    font: ctx.font,
    color: COLOR_MUTED,
  });

  // Colonne droite : composant + defauts
  const rightX = polaroidX + polaroidW + 18;
  const rightW = PAGE_WIDTH - MARGIN - rightX;
  let rightY = ctx.y;

  // Composant
  ctx.page.drawText("COMPOSANT IDENTIFIÉ", {
    x: rightX,
    y: rightY,
    size: 7,
    font: ctx.font,
    color: COLOR_LIGHT,
  });
  rightY -= 12;
  const compLines = wrapText(diagnostic.composantIdentifie || "—", ctx.fontBold, 12, rightW);
  for (const line of compLines) {
    ctx.page.drawText(line, {
      x: rightX,
      y: rightY,
      size: 12,
      font: ctx.fontBold,
      color: COLOR_TEXT,
    });
    rightY -= 14;
  }
  rightY -= 6;

  // Defauts
  if (diagnostic.defautsDetectes.length > 0) {
    ctx.page.drawText(`DÉFAUTS DÉTECTÉS  ·  ${diagnostic.defautsDetectes.length}`, {
      x: rightX,
      y: rightY,
      size: 7,
      font: ctx.font,
      color: COLOR_LIGHT,
    });
    rightY -= 12;
    for (const d of diagnostic.defautsDetectes) {
      const colors = GRAVITE_COLORS[d.gravite];
      // Pastille gravite
      ctx.page.drawCircle({
        x: rightX + 3,
        y: rightY + 4,
        size: 2.5,
        color: colors.dot,
      });
      // Nom defaut
      const nomLines = wrapText(d.nom, ctx.fontBold, 10, rightW - 20);
      ctx.page.drawText(nomLines[0] ?? d.nom, {
        x: rightX + 12,
        y: rightY,
        size: 10,
        font: ctx.fontBold,
        color: COLOR_TEXT,
      });
      // Badge gravite a la fin de la ligne
      const badgeTxt = GRAVITE_LABELS[d.gravite];
      const badgeW = ctx.font.widthOfTextAtSize(badgeTxt, 7) + 10;
      const nomW = ctx.fontBold.widthOfTextAtSize(nomLines[0] ?? d.nom, 10);
      const badgeX = Math.min(rightX + 12 + nomW + 6, PAGE_WIDTH - MARGIN - badgeW);
      ctx.page.drawRectangle({
        x: badgeX,
        y: rightY - 2,
        width: badgeW,
        height: 11,
        color: colors.bg,
      });
      ctx.page.drawText(badgeTxt, {
        x: badgeX + 5,
        y: rightY,
        size: 7,
        font: ctx.fontBold,
        color: colors.text,
      });
      rightY -= 13;
      // Description en plus petit
      const descLines = wrapText(d.description, ctx.font, 9, rightW - 12);
      for (const line of descLines.slice(0, 2)) {
        ctx.page.drawText(line, {
          x: rightX + 12,
          y: rightY,
          size: 9,
          font: ctx.font,
          color: COLOR_MUTED,
        });
        rightY -= 11;
      }
      rightY -= 4;
    }
  }

  // Action recommandee + delai
  if (diagnostic.actionRecommandee) {
    rightY -= 4;
    const delaiTxt = diagnostic.delaiIntervention
      ? `  ·  ${DELAI_LABELS[diagnostic.delaiIntervention]}`
      : "";
    ctx.page.drawText(`ACTION RECOMMANDÉE${delaiTxt.toUpperCase()}`, {
      x: rightX,
      y: rightY,
      size: 7,
      font: ctx.fontBold,
      color: COLOR_ACCENT,
    });
    rightY -= 12;
    const actionLines = wrapText(diagnostic.actionRecommandee, ctx.font, 10, rightW);
    for (const line of actionLines) {
      ctx.page.drawText(line, {
        x: rightX,
        y: rightY,
        size: 10,
        font: ctx.font,
        color: COLOR_TEXT,
      });
      rightY -= 12;
    }
  }

  // Aligner ctx.y sur la zone la plus basse entre polaroid et colonne droite
  ctx.y = Math.min(polaroidY - 12, rightY - 6);
}

function drawInterventionSection(ctx: DrawCtx, input: RapportInput): void {
  drawSectionTitle(ctx, "Intervention réalisée");
  const interventionLabel = TYPE_LABELS[input.typeIntervention ?? "recuperation"];
  ensureSpace(ctx, 18);
  ctx.page.drawText(interventionLabel, {
    x: MARGIN,
    y: ctx.y,
    size: 12,
    font: ctx.fontBold,
    color: COLOR_TEXT,
  });
  ctx.y -= 16;
  ctx.page.drawText(fmtDateTimeFR(input.interventionDate), {
    x: MARGIN,
    y: ctx.y,
    size: 10,
    font: ctx.font,
    color: COLOR_MUTED,
  });
  ctx.y -= 18;

  // Detail controle d'etancheite si applicable
  if (input.controleDetails) {
    const d = input.controleDetails;
    const items: string[] = [];
    if (d.detecteurId) items.push(`Détecteur utilisé : ${d.detecteurId}`);
    items.push(`Détecteur permanent installé : ${d.detecteurPermanent ? "Oui" : "Non"}`);
    items.push(`Fuite détectée : ${d.fuiteDetectee ? "Oui" : "Non"}`);
    if (d.fuiteDetectee && d.fuiteLocalisation) {
      items.push(`Localisation : ${d.fuiteLocalisation}`);
    }
    if (d.fuiteDetectee && d.fuiteReparee) {
      items.push(
        d.fuiteReparee === "realisee"
          ? "Réparation effectuée sur place"
          : "Réparation planifiée ultérieurement"
      );
    }
    for (const item of items) {
      ensureSpace(ctx, 14);
      ctx.page.drawText(`•  ${item}`, {
        x: MARGIN + 4,
        y: ctx.y,
        size: 10,
        font: ctx.font,
        color: COLOR_TEXT,
      });
      ctx.y -= 13;
    }
    ctx.y -= 4;
  }

  if (input.bsffId) {
    drawKeyValue(ctx, "BSFF officiel TrackDéchets", input.bsffId);
  }
  if (input.destination) {
    drawKeyValue(
      ctx,
      "Centre de destination du fluide",
      `${input.destination.name}  ·  ${input.destination.address}`
    );
  }
}

function drawObservationsSection(ctx: DrawCtx, text: string): void {
  drawSectionTitle(ctx, "Observations terrain");
  const lines = wrapText(text, ctx.font, 10, CONTENT_WIDTH - 16);
  // Bloc cream avec leading bar accent
  ensureSpace(ctx, lines.length * 13 + 18);
  const blockH = lines.length * 13 + 16;
  const blockY = ctx.y - blockH + 4;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: blockY,
    width: CONTENT_WIDTH,
    height: blockH,
    color: COLOR_CREAM,
  });
  ctx.page.drawRectangle({
    x: MARGIN,
    y: blockY,
    width: 3,
    height: blockH,
    color: COLOR_ACCENT,
  });
  let y = ctx.y - 8;
  for (const line of lines) {
    ctx.page.drawText(line, {
      x: MARGIN + 12,
      y,
      size: 10,
      font: ctx.font,
      color: COLOR_TEXT,
    });
    y -= 13;
  }
  ctx.y = blockY - 14;
}

function drawProchainControleSection(
  ctx: DrawCtx,
  prochainISO: string,
  frequenceMois: number | undefined
): void {
  drawSectionTitle(ctx, "Prochain contrôle réglementaire");
  ensureSpace(ctx, 55);
  // Encart accent ocre avec date
  const blockY = ctx.y - 50;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: blockY,
    width: CONTENT_WIDTH,
    height: 50,
    color: COLOR_ACCENT,
    opacity: 0.08,
    borderColor: COLOR_ACCENT,
    borderWidth: 0.6,
    borderOpacity: 0.4,
  });
  ctx.page.drawText("À programmer avant le", {
    x: MARGIN + 14,
    y: blockY + 32,
    size: 8,
    font: ctx.font,
    color: COLOR_ACCENT_DARK,
  });
  ctx.page.drawText(fmtDateFR(prochainISO), {
    x: MARGIN + 14,
    y: blockY + 12,
    size: 16,
    font: ctx.fontBold,
    color: COLOR_ACCENT_DARK,
  });
  if (frequenceMois) {
    const freqTxt = `Fréquence réglementaire · tous les ${frequenceMois} mois`;
    const freqW = ctx.font.widthOfTextAtSize(freqTxt, 9);
    ctx.page.drawText(freqTxt, {
      x: PAGE_WIDTH - MARGIN - 14 - freqW,
      y: blockY + 22,
      size: 9,
      font: ctx.font,
      color: COLOR_ACCENT_DARK,
    });
  }
  const refTxt = "Règlement (UE) 2024/573 — art. 5";
  const refW = ctx.font.widthOfTextAtSize(refTxt, 8);
  ctx.page.drawText(refTxt, {
    x: PAGE_WIDTH - MARGIN - 14 - refW,
    y: blockY + 10,
    size: 8,
    font: ctx.font,
    color: COLOR_ACCENT_DARK,
    opacity: 0.7,
  });
  ctx.y = blockY - 16;
}

async function drawSignatureSection(ctx: DrawCtx, profil: Profil): Promise<void> {
  drawSectionTitle(ctx, "Signature & attestation");

  ensureSpace(ctx, 110);
  const blockY = ctx.y - 95;
  // Encadre signature
  ctx.page.drawRectangle({
    x: MARGIN,
    y: blockY,
    width: CONTENT_WIDTH,
    height: 95,
    color: COLOR_WHITE,
    borderColor: COLOR_LINE,
    borderWidth: 0.5,
  });

  // Colonne gauche : signature manuscrite
  ctx.page.drawText("LE TECHNICIEN OPÉRATEUR", {
    x: MARGIN + 14,
    y: blockY + 75,
    size: 7,
    font: ctx.fontBold,
    color: COLOR_LIGHT,
  });
  if (profil.signatureDataUrl) {
    const sig = await embedImageFromDataUrl(ctx.pdf, profil.signatureDataUrl);
    if (sig) {
      const scaled = sig.scaleToFit(170, 45);
      ctx.page.drawImage(sig, {
        x: MARGIN + 14,
        y: blockY + 25,
        width: scaled.width,
        height: scaled.height,
      });
    }
  }
  if (profil.raisonSociale) {
    ctx.page.drawText(profil.raisonSociale, {
      x: MARGIN + 14,
      y: blockY + 15,
      size: 10,
      font: ctx.fontBold,
      color: COLOR_TEXT,
    });
  }

  // Colonne droite : cachet attestation
  const cachetX = MARGIN + CONTENT_WIDTH - 170;
  const cachetY = blockY + 15;
  const cachetW = 155;
  const cachetH = 65;
  ctx.page.drawRectangle({
    x: cachetX,
    y: cachetY,
    width: cachetW,
    height: cachetH,
    borderColor: COLOR_ACCENT,
    borderWidth: 1.2,
    color: COLOR_WHITE,
  });
  ctx.page.drawText("ATTESTATION DE CAPACITÉ", {
    x: cachetX + 8,
    y: cachetY + cachetH - 14,
    size: 7,
    font: ctx.fontBold,
    color: COLOR_ACCENT,
  });
  if (profil.categorieAttestation) {
    ctx.page.drawText(`Catégorie ${profil.categorieAttestation}`, {
      x: cachetX + 8,
      y: cachetY + cachetH - 30,
      size: 11,
      font: ctx.fontBold,
      color: COLOR_TEXT,
    });
  }
  if (profil.numeroAttestation) {
    ctx.page.drawText(`N° ${profil.numeroAttestation}`, {
      x: cachetX + 8,
      y: cachetY + cachetH - 46,
      size: 9,
      font: ctx.font,
      color: COLOR_MUTED,
    });
  }
  if (profil.organismeAgree) {
    const orgTxt = `Délivrée par ${profil.organismeAgree}`;
    const wrapped = wrapText(orgTxt, ctx.font, 7, cachetW - 16);
    let y = cachetY + 8;
    for (const line of wrapped.slice(0, 2)) {
      ctx.page.drawText(line, {
        x: cachetX + 8,
        y,
        size: 7,
        font: ctx.font,
        color: COLOR_LIGHT,
      });
      y -= 8;
    }
  }

  ctx.y = blockY - 14;

  // Mention conformite finale
  ensureSpace(ctx, 26);
  ctx.page.drawText(
    "Intervention effectuée conformément au Règlement (UE) 2024/573 dit F-Gas",
    {
      x: MARGIN,
      y: ctx.y,
      size: 9,
      font: ctx.font,
      color: COLOR_MUTED,
    }
  );
  ctx.y -= 12;
  ctx.page.drawText(
    "et au Code de l'environnement (art. R543-75 à R543-123).",
    {
      x: MARGIN,
      y: ctx.y,
      size: 9,
      font: ctx.font,
      color: COLOR_MUTED,
    }
  );
  ctx.y -= 16;
}

// ── Entry point ────────────────────────────────────────────────────────────

export async function generateRapportPdf(input: RapportInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  // Embed Unicode font (regular + tentative bold). Subset:true -> ~50KB final.
  const regularBytes = await loadUnicodeFontBytes();
  const font = await pdf.embedFont(regularBytes, { subset: true });
  // Bold dans un try/catch : si le fichier Bold existe mais est corrompu
  // (ex: HTML 404 telecharge par erreur — c'etait le cas le 04/06/2026),
  // on fallback sur regular au lieu de crash "Unknown font format".
  const boldBytes = await loadUnicodeFontBoldBytes();
  let fontBold: PDFFont = font;
  if (boldBytes) {
    try {
      fontBold = await pdf.embedFont(boldBytes, { subset: true });
    } catch (e) {
      console.warn("[rapport] bold embed failed, fallback to regular:", e);
    }
  }

  const rapportNumber = generateRapportNumber();
  const dateFR = fmtDateFR(input.interventionDate);

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const ctx: DrawCtx = {
    pdf,
    page,
    font,
    fontBold,
    y: PAGE_HEIGHT - MARGIN,
    rapportNumber,
    pageIndex: 1,
  };

  await drawHeader(ctx, input.profil, dateFR);
  drawClientSection(ctx, input);
  drawEquipementSection(ctx, input);
  drawInterventionSection(ctx, input);

  if (input.diagnostic) {
    await drawDiagnosticSection(ctx, input.diagnostic);
  }

  if (input.observationsTerrain && input.observationsTerrain.trim()) {
    drawObservationsSection(ctx, input.observationsTerrain.trim());
  } else if (input.observationsLibres && input.observationsLibres.trim()) {
    drawObservationsSection(ctx, input.observationsLibres.trim());
  }

  if (input.prochainControleISO) {
    drawProchainControleSection(ctx, input.prochainControleISO, input.frequenceControleMois);
  }

  await drawSignatureSection(ctx, input.profil);

  drawFooter(ctx);

  return await pdf.save();
}
