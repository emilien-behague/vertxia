// Rapport d'intervention F-Gas pour le client final.
//
// Différent du BSFF (technique TrackDéchets) et du CERFA (réglementaire ADEME) :
// c'est un PDF "humain" que le frigoriste remet à son client final (hôtel,
// restaurant, usine) après une intervention. Avec entête entreprise + logo +
// signature manuscrite du frigoriste.
//
// Génère un PDF A4 from-scratch via pdf-lib (pas de template officiel ici).

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { CerfaInput, TypeIntervention } from "./cerfa";
import type { Profil } from "./profil";

export type RapportInput = CerfaInput & {
  profil: Profil;
};

const TYPE_LABELS: Record<TypeIntervention, string> = {
  recuperation: "Récupération de fluide frigorigène",
  demantelement: "Démantèlement de l'équipement",
  controle_periodique: "Contrôle d'étanchéité périodique",
  controle_non_periodique: "Contrôle d'étanchéité non périodique",
  mise_service: "Mise en service / Première charge",
  maintenance: "Maintenance / Recharge",
};

// Couleurs Vertxia
const COLOR_TEXT = rgb(0.067, 0.067, 0.067); // #111
const COLOR_MUTED = rgb(0.4, 0.4, 0.4);
const COLOR_LIGHT = rgb(0.6, 0.6, 0.6);
const COLOR_LINE = rgb(0.85, 0.85, 0.85);
const COLOR_ACCENT = rgb(0.067, 0.067, 0.067);

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

function fmtDateFR(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function fmtKg(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

function fmtTeqCO2(weight: number, gwp: number): string {
  const t = (weight * gwp) / 1000;
  if (t < 1) return `${(t * 1000).toFixed(0)} kg`;
  return `${t.toFixed(3).replace(".", ",")} t`;
}

function generateRapportNumber(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const time = `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  return `VTX-${yy}${mm}${dd}-${time}`;
}

type DrawCtx = {
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  y: number;
};

function drawText(ctx: DrawCtx, text: string, opts: {
  size?: number;
  bold?: boolean;
  color?: ReturnType<typeof rgb>;
  x?: number;
}) {
  const size = opts.size ?? 10;
  const font = opts.bold ? ctx.fontBold : ctx.font;
  const color = opts.color ?? COLOR_TEXT;
  const x = opts.x ?? MARGIN;
  ctx.page.drawText(text, { x, y: ctx.y, size, font, color });
}

function drawLine(ctx: DrawCtx, opts?: { thickness?: number; color?: ReturnType<typeof rgb> }) {
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.y },
    thickness: opts?.thickness ?? 0.5,
    color: opts?.color ?? COLOR_LINE,
  });
}

function drawSectionTitle(ctx: DrawCtx, title: string) {
  drawText(ctx, title.toUpperCase(), {
    size: 8,
    bold: true,
    color: COLOR_LIGHT,
  });
  ctx.y -= 4;
  drawLine(ctx, { color: COLOR_LINE });
  ctx.y -= 16;
}

function drawField(ctx: DrawCtx, label: string, value: string | undefined | null) {
  if (!value) return;
  drawText(ctx, label, { size: 9, color: COLOR_MUTED });
  ctx.y -= 13;
  drawText(ctx, value, { size: 11, bold: true });
  ctx.y -= 20;
}

export async function generateRapportPdf(input: RapportInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ctx: DrawCtx = {
    page,
    font,
    fontBold,
    y: PAGE_HEIGHT - MARGIN,
  };

  const { profil } = input;
  const rapportNumber = generateRapportNumber();
  const dateFR = fmtDateFR();

  // ─── EN-TÊTE — logo gauche + identité entreprise droite ────────────────
  const headerStartY = ctx.y;

  // Logo (si présent dans profil)
  if (profil.logoDataUrl) {
    try {
      let logoImg;
      if (profil.logoDataUrl.startsWith("data:image/png")) {
        const base64 = profil.logoDataUrl.replace(/^data:image\/png;base64,/, "");
        logoImg = await pdf.embedPng(Buffer.from(base64, "base64"));
      } else if (profil.logoDataUrl.startsWith("data:image/jpeg") || profil.logoDataUrl.startsWith("data:image/jpg")) {
        const base64 = profil.logoDataUrl.replace(/^data:image\/jpe?g;base64,/, "");
        logoImg = await pdf.embedJpg(Buffer.from(base64, "base64"));
      }
      if (logoImg) {
        const logoScaled = logoImg.scaleToFit(70, 50);
        page.drawImage(logoImg, {
          x: MARGIN,
          y: ctx.y - logoScaled.height,
          width: logoScaled.width,
          height: logoScaled.height,
        });
      }
    } catch (err) {
      // Logo en mauvais format — on continue sans
      console.error("[rapport] logo embed failed:", err);
    }
  }

  // Identité entreprise (droite)
  const entrepriseX = MARGIN + 90;
  ctx.y = headerStartY;
  if (profil.raisonSociale) {
    drawText(ctx, profil.raisonSociale, { size: 14, bold: true, x: entrepriseX });
    ctx.y -= 16;
  }
  const entrepriseLines: string[] = [];
  if (profil.adresseRue) entrepriseLines.push(profil.adresseRue);
  if (profil.adresseCp && profil.adresseVille) {
    entrepriseLines.push(`${profil.adresseCp} ${profil.adresseVille}`);
  }
  if (profil.siret) entrepriseLines.push(`SIRET ${profil.siret}`);
  const contactLine = [profil.telephone, profil.email].filter(Boolean).join(" · ");
  if (contactLine) entrepriseLines.push(contactLine);
  for (const line of entrepriseLines) {
    drawText(ctx, line, { size: 9, color: COLOR_MUTED, x: entrepriseX });
    ctx.y -= 12;
  }

  // Aligner la suite sous la zone header (la plus basse entre logo et identité)
  ctx.y = Math.min(ctx.y, headerStartY - 60) - 20;

  // Ligne séparatrice
  drawLine(ctx, { thickness: 1, color: COLOR_ACCENT });
  ctx.y -= 28;

  // ─── TITRE PRINCIPAL ───────────────────────────────────────────────────
  drawText(ctx, "RAPPORT D'INTERVENTION F-GAS", { size: 18, bold: true });
  ctx.y -= 22;
  drawText(ctx, `N° ${rapportNumber}  ·  ${dateFR}`, {
    size: 10,
    color: COLOR_MUTED,
  });
  ctx.y -= 30;

  // ─── CLIENT ────────────────────────────────────────────────────────────
  if (input.clientName || input.lieuIntervention) {
    drawSectionTitle(ctx, "Client");
    if (input.clientName) {
      drawText(ctx, input.clientName, { size: 12, bold: true });
      ctx.y -= 16;
    }
    if (input.lieuIntervention) {
      drawText(ctx, input.lieuIntervention, { size: 10, color: COLOR_MUTED });
      ctx.y -= 14;
    }
    ctx.y -= 16;
  }

  // ─── ÉQUIPEMENT ────────────────────────────────────────────────────────
  drawSectionTitle(ctx, "Équipement");
  if (input.modeleEquipement) {
    drawText(ctx, input.modeleEquipement, { size: 12, bold: true });
    ctx.y -= 16;
  }
  const equipLines: string[] = [];
  if (input.numeroSerieEquipement) {
    equipLines.push(`N° de série : ${input.numeroSerieEquipement}`);
  }
  equipLines.push(
    `Fluide frigorigène : ${input.fluide.code} (GWP ${input.fluide.gwp.toLocaleString("fr-FR")})`
  );
  if (input.weight > 0) {
    equipLines.push(`Charge manipulée : ${fmtKg(input.weight)} kg`);
  }
  for (const line of equipLines) {
    drawText(ctx, line, { size: 10, color: COLOR_MUTED });
    ctx.y -= 14;
  }
  ctx.y -= 12;

  // ─── INTERVENTION ──────────────────────────────────────────────────────
  drawSectionTitle(ctx, "Intervention");
  const interventionLabel = TYPE_LABELS[input.typeIntervention ?? "recuperation"];
  drawText(ctx, interventionLabel, { size: 12, bold: true });
  ctx.y -= 18;

  if (input.weight > 0) {
    drawField(
      ctx,
      "Équivalent CO2",
      fmtTeqCO2(input.weight, input.fluide.gwp)
    );
  }

  // Détails contrôle d'étanchéité si applicable
  if (input.controleDetails) {
    const d = input.controleDetails;
    if (d.detecteurId) {
      drawField(ctx, "Détecteur de fuite utilisé", d.detecteurId);
    }
    drawField(
      ctx,
      "Détecteur permanent installé",
      d.detecteurPermanent ? "Oui" : "Non"
    );
    drawField(
      ctx,
      "Fuite détectée",
      d.fuiteDetectee ? "Oui" : "Non"
    );
    if (d.fuiteDetectee) {
      if (d.fuiteLocalisation) drawField(ctx, "Localisation", d.fuiteLocalisation);
      if (d.fuiteReparee) {
        drawField(
          ctx,
          "Fuite réparée",
          d.fuiteReparee === "realisee"
            ? "Oui, sur place"
            : "Non, intervention ultérieure prévue"
        );
      }
    }
  }

  if (input.bsffId) {
    drawField(ctx, "N° BSFF officiel TrackDéchets", input.bsffId);
  }
  if (input.destination) {
    drawField(
      ctx,
      "Centre de destination du fluide",
      `${input.destination.name} · ${input.destination.address}`
    );
  }

  // Espacement avant le bloc conformité
  ctx.y -= 10;

  // ─── BLOC CONFORMITÉ + SIGNATURE ───────────────────────────────────────
  drawLine(ctx, { color: COLOR_LINE });
  ctx.y -= 18;

  drawText(
    ctx,
    "Intervention effectuée conformément au Règlement (UE) 2024/573 dit F-Gas",
    { size: 9, color: COLOR_MUTED }
  );
  ctx.y -= 12;
  drawText(
    ctx,
    "et au Code de l'environnement (art. R543-75 à R543-123).",
    { size: 9, color: COLOR_MUTED }
  );
  ctx.y -= 30;

  // Bloc signature
  drawText(ctx, "Le frigoriste opérateur :", { size: 9, color: COLOR_LIGHT });
  ctx.y -= 18;

  // Signature manuscrite (si présente dans profil)
  if (profil.signatureDataUrl) {
    try {
      let sigImg;
      if (profil.signatureDataUrl.startsWith("data:image/png")) {
        const base64 = profil.signatureDataUrl.replace(/^data:image\/png;base64,/, "");
        sigImg = await pdf.embedPng(Buffer.from(base64, "base64"));
      } else if (profil.signatureDataUrl.startsWith("data:image/jpeg") || profil.signatureDataUrl.startsWith("data:image/jpg")) {
        const base64 = profil.signatureDataUrl.replace(/^data:image\/jpe?g;base64,/, "");
        sigImg = await pdf.embedJpg(Buffer.from(base64, "base64"));
      }
      if (sigImg) {
        const sigScaled = sigImg.scaleToFit(180, 50);
        page.drawImage(sigImg, {
          x: MARGIN,
          y: ctx.y - sigScaled.height,
          width: sigScaled.width,
          height: sigScaled.height,
        });
        ctx.y -= sigScaled.height + 8;
      }
    } catch (err) {
      console.error("[rapport] signature embed failed:", err);
    }
  } else {
    ctx.y -= 50; // espace réservé pour signature manuscrite si pas dans profil
  }

  if (profil.raisonSociale) {
    drawText(ctx, profil.raisonSociale, { size: 11, bold: true });
    ctx.y -= 14;
  }
  if (profil.categorieAttestation) {
    drawText(ctx, `Frigoriste — Attestation de capacité Catégorie ${profil.categorieAttestation}`, {
      size: 9,
      color: COLOR_MUTED,
    });
    ctx.y -= 12;
  }
  if (profil.numeroAttestation) {
    drawText(ctx, `N° d'attestation : ${profil.numeroAttestation}`, {
      size: 9,
      color: COLOR_MUTED,
    });
    ctx.y -= 12;
  }

  // ─── PIED DE PAGE ──────────────────────────────────────────────────────
  const footerY = 30;
  page.drawLine({
    start: { x: MARGIN, y: footerY + 14 },
    end: { x: PAGE_WIDTH - MARGIN, y: footerY + 14 },
    thickness: 0.3,
    color: COLOR_LINE,
  });
  page.drawText("Document généré via Vertxia — vertxia.com", {
    x: MARGIN,
    y: footerY,
    size: 8,
    font,
    color: COLOR_LIGHT,
  });
  const numeroTxt = `Rapport ${rapportNumber}`;
  const numeroWidth = font.widthOfTextAtSize(numeroTxt, 8);
  page.drawText(numeroTxt, {
    x: PAGE_WIDTH - MARGIN - numeroWidth,
    y: footerY,
    size: 8,
    font,
    color: COLOR_LIGHT,
  });

  return await pdf.save();
}
