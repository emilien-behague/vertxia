// Registre des mouvements de fluides frigorigènes — PDF audit.
//
// Format inspiré du standard métier AFCE (pas de format légal imposé selon
// l'article R543-82 et l'arrêté du 29 février 2016). Lisible pour audit par
// les organismes certifiants l'attestation de capacité F-Gas.
//
// Contenu :
//  - En-tête : opérateur + N° attestation + période + récap volumes
//  - Tableau chronologique des mouvements (landscape A4)
//  - Récap par bouteille (entrées / sorties / solde final)
//  - Récap par fluide (volumes totaux par type)
//  - Pied de page avec signature opérateur

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Bouteille, Mouvement, MouvementType } from "./bouteille";
import {
  computeChargeActuelle,
  estEntree,
  estSortie,
  labelMouvementCourt,
} from "./bouteille";
import type { Profil } from "./profil";

export type RegistreInput = {
  bouteilles: Bouteille[];
  mouvements: Mouvement[];
  /** Période couverte (ISO) */
  periodeDebutISO: string;
  periodeFinISO: string;
  profil: Profil;
};

// Page A4 LANDSCAPE
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 40;

const COLOR_TEXT = rgb(0.067, 0.067, 0.067);
const COLOR_MUTED = rgb(0.45, 0.45, 0.45);
const COLOR_LIGHT = rgb(0.65, 0.65, 0.65);
const COLOR_LINE = rgb(0.85, 0.85, 0.85);
const COLOR_HEADER_BG = rgb(0.95, 0.95, 0.95);
const COLOR_ENTREE = rgb(0.05, 0.45, 0.25);
const COLOR_SORTIE = rgb(0.6, 0.15, 0.15);

function fmtDateISO(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtKg(n: number): string {
  return n.toFixed(3).replace(".", ",");
}

// ─── Génération PDF ───────────────────────────────────────────────────────────

export async function generateRegistrePdf(input: RegistreInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Filtrer mouvements dans la période
  const tStart = new Date(input.periodeDebutISO).getTime();
  const tEnd = new Date(input.periodeFinISO).getTime();
  const mouvements = input.mouvements
    .filter((m) => {
      const t = new Date(m.dateMouvementISO).getTime();
      return t >= tStart && t <= tEnd;
    })
    .sort(
      (a, b) =>
        new Date(a.dateMouvementISO).getTime() - new Date(b.dateMouvementISO).getTime()
    );

  // Index bouteilles par id
  const bouteilleById = new Map(input.bouteilles.map((b) => [b.id, b]));

  // Page 1 : header + début du tableau
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  // En-tête : titre principal
  page.drawText("REGISTRE DES MOUVEMENTS DE FLUIDES FRIGORIGÈNES", {
    x: MARGIN,
    y,
    size: 14,
    font: fontBold,
    color: COLOR_TEXT,
  });
  y -= 18;

  page.drawText("Traçabilité conforme attestation de capacité F-Gas (article R.543-82 du Code de l'environnement)", {
    x: MARGIN,
    y,
    size: 8,
    font,
    color: COLOR_MUTED,
  });
  y -= 18;

  // Bloc opérateur + période
  const blocLines = [
    `Opérateur : ${input.profil.raisonSociale || "Non renseigné"}`,
    input.profil.siret ? `SIRET : ${input.profil.siret}` : null,
    input.profil.categorieAttestation ? `Attestation de capacité : Catégorie ${input.profil.categorieAttestation}` : null,
    `Période : du ${fmtDateISO(input.periodeDebutISO)} au ${fmtDateISO(input.periodeFinISO)}`,
    `Édité le ${fmtDateISO(new Date().toISOString())} · ${mouvements.length} mouvement${mouvements.length > 1 ? "s" : ""}`,
  ].filter(Boolean) as string[];

  for (const line of blocLines) {
    page.drawText(line, { x: MARGIN, y, size: 9, font, color: COLOR_TEXT });
    y -= 12;
  }
  y -= 8;

  // En-têtes colonnes
  const cols = [
    { label: "Date", x: MARGIN, w: 60 },
    { label: "Type", x: MARGIN + 60, w: 70 },
    { label: "Bouteille", x: MARGIN + 130, w: 90 },
    { label: "Fluide", x: MARGIN + 220, w: 60 },
    { label: "Quantité", x: MARGIN + 280, w: 60 },
    { label: "Méthode", x: MARGIN + 340, w: 60 },
    { label: "Client / équipement", x: MARGIN + 400, w: 180 },
    { label: "Notes", x: MARGIN + 580, w: PAGE_WIDTH - MARGIN - 580 - MARGIN },
  ];

  function drawHeaderRow(p: PDFPage, yh: number) {
    // Fond gris
    p.drawRectangle({
      x: MARGIN - 2,
      y: yh - 4,
      width: PAGE_WIDTH - 2 * MARGIN + 4,
      height: 16,
      color: COLOR_HEADER_BG,
    });
    for (const c of cols) {
      p.drawText(c.label, { x: c.x, y: yh, size: 8, font: fontBold, color: COLOR_TEXT });
    }
  }

  drawHeaderRow(page, y);
  y -= 18;

  // Lignes mouvements
  function drawMouvementRow(p: PDFPage, m: Mouvement, yr: number) {
    const b = bouteilleById.get(m.bouteilleId);
    const fluideCode = b?.fluide?.code ?? (b?.fluideMix ? "Mix" : "?");
    const signe = estEntree(m.type) ? "+" : estSortie(m.type) ? "−" : "=";
    const colorQte = estEntree(m.type) ? COLOR_ENTREE : estSortie(m.type) ? COLOR_SORTIE : COLOR_MUTED;
    const client = m.clientName ?? "";
    const notes = m.notes ?? "";

    p.drawText(fmtDateISO(m.dateMouvementISO), { x: cols[0].x, y: yr, size: 8, font, color: COLOR_TEXT });
    p.drawText(labelMouvementCourt(m.type), { x: cols[1].x, y: yr, size: 8, font, color: COLOR_TEXT });
    p.drawText(b ? `#${b.numeroSerie}` : "(?)", { x: cols[2].x, y: yr, size: 8, font, color: COLOR_TEXT });
    p.drawText(fluideCode, { x: cols[3].x, y: yr, size: 8, font, color: COLOR_TEXT });
    p.drawText(`${signe} ${fmtKg(m.quantiteKg)} kg`, { x: cols[4].x, y: yr, size: 8, font: fontBold, color: colorQte });
    p.drawText(m.methode === "balance" ? "Balance" : "Décl.", { x: cols[5].x, y: yr, size: 8, font, color: COLOR_MUTED });
    p.drawText(truncate(client, 28), { x: cols[6].x, y: yr, size: 8, font, color: COLOR_TEXT });
    p.drawText(truncate(notes, 35), { x: cols[7].x, y: yr, size: 8, font, color: COLOR_MUTED });
  }

  // Pagination
  for (const m of mouvements) {
    if (y < MARGIN + 30) {
      // Nouvelle page
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      page.drawText("Registre fluides — suite", {
        x: MARGIN,
        y,
        size: 9,
        font: fontBold,
        color: COLOR_MUTED,
      });
      y -= 20;
      drawHeaderRow(page, y);
      y -= 18;
    }
    drawMouvementRow(page, m, y);
    y -= 12;
  }

  if (mouvements.length === 0) {
    page.drawText("Aucun mouvement enregistré sur cette période.", {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: COLOR_MUTED,
    });
    y -= 20;
  }

  // ─── RÉCAP par fluide ──────────────────────────────────────
  if (y < 180) {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  } else {
    y -= 20;
  }

  page.drawText("RÉCAPITULATIF PAR FLUIDE", {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: COLOR_TEXT,
  });
  y -= 16;

  const parFluide = new Map<string, { entrees: number; sorties: number }>();
  for (const m of mouvements) {
    const b = bouteilleById.get(m.bouteilleId);
    const code = b?.fluide?.code ?? (b?.fluideMix ? "Mix" : "?");
    const cur = parFluide.get(code) ?? { entrees: 0, sorties: 0 };
    if (estEntree(m.type)) cur.entrees += m.quantiteKg;
    else if (estSortie(m.type)) cur.sorties += m.quantiteKg;
    parFluide.set(code, cur);
  }

  page.drawText("Fluide", { x: MARGIN, y, size: 8, font: fontBold, color: COLOR_TEXT });
  page.drawText("Entrées (récupéré ou reçu) kg", { x: MARGIN + 80, y, size: 8, font: fontBold, color: COLOR_TEXT });
  page.drawText("Sorties (chargé ou cédé) kg", { x: MARGIN + 280, y, size: 8, font: fontBold, color: COLOR_TEXT });
  page.drawText("Solde net (entrées − sorties) kg", { x: MARGIN + 480, y, size: 8, font: fontBold, color: COLOR_TEXT });
  y -= 14;

  for (const [code, { entrees, sorties }] of parFluide) {
    page.drawText(code, { x: MARGIN, y, size: 9, font, color: COLOR_TEXT });
    page.drawText(fmtKg(entrees), { x: MARGIN + 80, y, size: 9, font, color: COLOR_ENTREE });
    page.drawText(fmtKg(sorties), { x: MARGIN + 280, y, size: 9, font, color: COLOR_SORTIE });
    const solde = entrees - sorties;
    page.drawText(`${solde >= 0 ? "+" : ""}${fmtKg(solde)}`, {
      x: MARGIN + 480,
      y,
      size: 9,
      font: fontBold,
      color: solde >= 0 ? COLOR_ENTREE : COLOR_SORTIE,
    });
    y -= 12;
  }
  y -= 10;

  // ─── RÉCAP par bouteille ──────────────────────────────────
  if (y < 200) {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  } else {
    y -= 10;
  }

  page.drawText("ÉTAT DES BOUTEILLES À LA FIN DE PÉRIODE", {
    x: MARGIN,
    y,
    size: 11,
    font: fontBold,
    color: COLOR_TEXT,
  });
  y -= 16;

  page.drawText("Bouteille", { x: MARGIN, y, size: 8, font: fontBold, color: COLOR_TEXT });
  page.drawText("Type", { x: MARGIN + 120, y, size: 8, font: fontBold, color: COLOR_TEXT });
  page.drawText("Fluide", { x: MARGIN + 180, y, size: 8, font: fontBold, color: COLOR_TEXT });
  page.drawText("Charge actuelle (kg)", { x: MARGIN + 240, y, size: 8, font: fontBold, color: COLOR_TEXT });
  page.drawText("Capacité max (kg)", { x: MARGIN + 380, y, size: 8, font: fontBold, color: COLOR_TEXT });
  page.drawText("% rempli", { x: MARGIN + 500, y, size: 8, font: fontBold, color: COLOR_TEXT });
  page.drawText("Statut", { x: MARGIN + 580, y, size: 8, font: fontBold, color: COLOR_TEXT });
  y -= 14;

  // Index mouvements par bouteille (sur toute la période — pour solde)
  const mvParBout = new Map<string, Mouvement[]>();
  for (const m of mouvements) {
    const arr = mvParBout.get(m.bouteilleId) ?? [];
    arr.push(m);
    mvParBout.set(m.bouteilleId, arr);
  }

  for (const b of input.bouteilles) {
    if (y < MARGIN + 40) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    const mvs = mvParBout.get(b.id) ?? [];
    const charge = computeChargeActuelle(b, mvs);
    const pct = b.capaciteMaxKg > 0 ? (charge / b.capaciteMaxKg) * 100 : 0;

    page.drawText(`#${b.numeroSerie}`, { x: MARGIN, y, size: 9, font, color: COLOR_TEXT });
    page.drawText(b.type === "recharge" ? "Recharge" : "Récup.", { x: MARGIN + 120, y, size: 9, font, color: COLOR_TEXT });
    page.drawText(b.fluide?.code ?? "Mix", { x: MARGIN + 180, y, size: 9, font, color: COLOR_TEXT });
    page.drawText(fmtKg(charge), { x: MARGIN + 240, y, size: 9, font: fontBold, color: COLOR_TEXT });
    page.drawText(fmtKg(b.capaciteMaxKg), { x: MARGIN + 380, y, size: 9, font, color: COLOR_MUTED });
    page.drawText(`${pct.toFixed(0)} %`, {
      x: MARGIN + 500,
      y,
      size: 9,
      font: fontBold,
      color: pct >= 80 ? COLOR_SORTIE : pct >= 70 ? rgb(0.8, 0.5, 0.05) : COLOR_TEXT,
    });
    page.drawText(b.statut === "active" ? "Active" : b.statut === "transit_retour" ? "Transit" : "Archivée", {
      x: MARGIN + 580,
      y,
      size: 9,
      font,
      color: COLOR_MUTED,
    });
    y -= 12;
  }

  // ─── Pied de page : signature opérateur ──────────────────
  if (y < MARGIN + 80) {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  } else {
    y -= 30;
  }

  page.drawText("Certification opérateur :", { x: MARGIN, y, size: 10, font: fontBold, color: COLOR_TEXT });
  y -= 14;
  page.drawText(
    "Je soussigné(e) certifie l'exactitude des mouvements ci-dessus, manipulés conformément au règlement (UE) 2024/573",
    { x: MARGIN, y, size: 9, font, color: COLOR_TEXT }
  );
  y -= 11;
  page.drawText(
    "et à l'article R.543-78 et suivants du Code de l'environnement.",
    { x: MARGIN, y, size: 9, font, color: COLOR_TEXT }
  );
  y -= 30;

  page.drawText(`Opérateur : ${input.profil.raisonSociale || "________________"}`, {
    x: MARGIN,
    y,
    size: 9,
    font,
    color: COLOR_TEXT,
  });
  page.drawText(`Date : ${fmtDateISO(new Date().toISOString())}`, {
    x: MARGIN + 400,
    y,
    size: 9,
    font,
    color: COLOR_TEXT,
  });
  y -= 30;
  page.drawText("Signature :", { x: MARGIN, y, size: 9, font, color: COLOR_MUTED });

  // Si signature stockée dans profil → embed
  if (input.profil.signatureDataUrl) {
    try {
      const sig = input.profil.signatureDataUrl;
      const match = sig.match(/^data:image\/(png|jpeg);base64,(.+)$/);
      if (match) {
        const [, fmt, base64] = match;
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const img = fmt === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const w = 120;
        const h = (img.height / img.width) * w;
        page.drawImage(img, { x: MARGIN + 70, y: y - h + 8, width: w, height: h });
      }
    } catch {
      // Silent fail si l'image plante
    }
  }

  return await doc.save();
}

function truncate(s: string, max: number): string {
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
