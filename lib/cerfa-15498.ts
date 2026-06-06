// Generateur PDF du CERFA 15498*02 — Contrat d'assemblage et de mise en
// service d'un equipement precharge en fluide frigorigene (R.543-84 du
// Code de l'environnement).
//
// CONTEXTE METIER : different du CERFA 15497*04 (qui trace l'intervention
// technique). Le 15498 est un CONTRAT CIVIL entre :
//   - l'ACHETEUR du materiel precharge (le detenteur final)
//   - l'INSTALLATEUR ATTESTE qui assemble + met en service
//
// Doit etre signe par les deux parties et conserve 5 ans min. Sans ce
// contrat, le distributeur ne peut PAS legalement vendre un equipement
// precharge a un non-pro.
//
// V0.5 (06/06/2026) : Vertxia genere un PDF Vertxia-flavored conforme au
// contenu legal mais avec son propre layout (pas le PDF officiel CERFA
// fillable). Les 2 zones signature sont vides pour signature manuelle
// hors-app (impression, Adobe Sign, etc.). V1 ulterieur : signature in-app
// comme pour le 15497.

import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";

let cachedFontBytes: Uint8Array | null = null;
let cachedFontBoldBytes: Uint8Array | null = null;

async function loadFontBytes(): Promise<Uint8Array> {
  if (cachedFontBytes) return cachedFontBytes;
  const fontPath = path.join(
    process.cwd(),
    "public",
    "fonts",
    "NotoSans-Regular.ttf"
  );
  const buf = await readFile(fontPath);
  cachedFontBytes = new Uint8Array(buf);
  return cachedFontBytes;
}

async function loadFontBoldBytes(): Promise<Uint8Array | null> {
  if (cachedFontBoldBytes) return cachedFontBoldBytes;
  try {
    const fontPath = path.join(
      process.cwd(),
      "public",
      "fonts",
      "NotoSans-Bold.ttf"
    );
    const buf = await readFile(fontPath);
    cachedFontBoldBytes = new Uint8Array(buf);
    return cachedFontBoldBytes;
  } catch {
    // Bold optionnel : si la fonte n'existe pas, on utilise Regular partout.
    return null;
  }
}

export type Cerfa15498Input = {
  // Acheteur (= detenteur final de l'equipement precharge)
  acheteur: {
    nomOuRaisonSociale: string;
    siret?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
  };
  // Installateur attestee (= pro Vertxia qui fait la mise en service)
  installateur: {
    raisonSociale: string;
    siret: string;
    adresse: string;
    telephone: string;
    email: string;
    numeroAttestation: string;
    categorieAttestation: string;
    organismeAgree?: string;
    dateExpirationAttestation?: string;
  };
  // Equipement precharge
  equipement: {
    marque?: string;
    modele: string;
    numeroSerie: string;
    typeMateriel?: string; // ex: "PAC air/eau", "Split mural", "Monobloc"
    fluideCode: string;
    fluideLabel?: string;
    chargeKg: number;
    gwp: number;
    tCO2eq?: number; // calcule = chargeKg * gwp / 1000
  };
  // Dates
  dateLivraisonISO: string;
  dateMiseEnServiceISO: string;
  lieuInstallation?: string; // souvent = adresse du site
};

function fmtDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtNum(n: number, dec = 2): string {
  return n.toFixed(dec).replace(".", ",");
}

/**
 * Genere le PDF du contrat 15498*02 pre-rempli a partir des donnees Vertxia.
 * Retourne le PDF en Uint8Array pret a etre stream vers le client.
 */
export async function generateCerfa15498PDF(input: Cerfa15498Input): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontRegularBytes = await loadFontBytes();
  const fontBoldBytes = await loadFontBoldBytes();
  const font = await pdfDoc.embedFont(fontRegularBytes, { subset: true });
  const fontBold = fontBoldBytes
    ? await pdfDoc.embedFont(fontBoldBytes, { subset: true })
    : font;

  const page = pdfDoc.addPage([595, 842]); // A4 portrait
  const { width, height } = page.getSize();

  const M = 50; // marge laterale
  let y = height - M;
  const lh = 13; // line height

  const black = rgb(0, 0, 0);
  const grey = rgb(0.42, 0.42, 0.42);
  const accent = rgb(0.63, 0.39, 0.03); // bronze Vertxia (#A16207)

  function text(t: string, x: number, yPos: number, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {}) {
    const f = opts.bold ? fontBold : font;
    page.drawText(t, {
      x,
      y: yPos,
      size: opts.size ?? 10,
      font: f,
      color: opts.color ?? black,
    });
  }

  function line(x1: number, y1: number, x2: number, y2: number, color = grey) {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color });
  }

  function rect(x: number, yPos: number, w: number, h: number, color = grey) {
    page.drawRectangle({ x, y: yPos - h, width: w, height: h, borderColor: color, borderWidth: 0.5 });
  }

  // ── EN-TETE ────────────────────────────────────────────────────────────
  text("CERFA 15498*02", M, y, { size: 9, color: grey });
  text("Vertxia", width - M - 50, y, { size: 9, bold: true, color: accent });
  y -= 18;
  text("CONTRAT D'ASSEMBLAGE ET DE MISE EN SERVICE", M, y, { size: 14, bold: true });
  y -= 16;
  text("D'UN EQUIPEMENT PRECHARGE EN FLUIDE FRIGORIGENE", M, y, { size: 11, bold: true });
  y -= 14;
  text("Article R.543-84 du Code de l'environnement", M, y, { size: 8, color: grey });
  y -= 18;
  line(M, y, width - M, y);
  y -= 16;

  // ── SECTION 1 : ACHETEUR (DETENTEUR) ───────────────────────────────────
  text("1. ACHETEUR (DETENTEUR DE L'EQUIPEMENT)", M, y, { size: 10, bold: true, color: accent });
  y -= 14;
  text("Nom ou raison sociale :", M, y, { size: 9, color: grey });
  text(input.acheteur.nomOuRaisonSociale || "_______________________________", M + 130, y);
  y -= lh;
  if (input.acheteur.siret) {
    text("SIRET :", M, y, { size: 9, color: grey });
    text(input.acheteur.siret, M + 130, y);
    y -= lh;
  }
  if (input.acheteur.adresse) {
    text("Adresse :", M, y, { size: 9, color: grey });
    text(input.acheteur.adresse, M + 130, y);
    y -= lh;
  }
  if (input.acheteur.telephone) {
    text("Telephone :", M, y, { size: 9, color: grey });
    text(input.acheteur.telephone, M + 130, y);
    y -= lh;
  }
  if (input.acheteur.email) {
    text("Email :", M, y, { size: 9, color: grey });
    text(input.acheteur.email, M + 130, y);
    y -= lh;
  }
  y -= 8;

  // ── SECTION 2 : INSTALLATEUR ATTESTE ───────────────────────────────────
  text("2. INSTALLATEUR ATTESTE", M, y, { size: 10, bold: true, color: accent });
  y -= 14;
  text("Raison sociale :", M, y, { size: 9, color: grey });
  text(input.installateur.raisonSociale, M + 130, y);
  y -= lh;
  text("SIRET :", M, y, { size: 9, color: grey });
  text(input.installateur.siret, M + 130, y);
  y -= lh;
  text("Adresse :", M, y, { size: 9, color: grey });
  text(input.installateur.adresse, M + 130, y);
  y -= lh;
  text("Telephone :", M, y, { size: 9, color: grey });
  text(input.installateur.telephone, M + 130, y);
  y -= lh;
  text("Email :", M, y, { size: 9, color: grey });
  text(input.installateur.email, M + 130, y);
  y -= lh;
  text("N° attestation de capacite :", M, y, { size: 9, color: grey });
  text(`${input.installateur.numeroAttestation} (cat. ${input.installateur.categorieAttestation})`, M + 130, y);
  y -= lh;
  if (input.installateur.organismeAgree) {
    text("Organisme agree :", M, y, { size: 9, color: grey });
    text(input.installateur.organismeAgree, M + 130, y);
    y -= lh;
  }
  if (input.installateur.dateExpirationAttestation) {
    text("Validite :", M, y, { size: 9, color: grey });
    text(`jusqu'au ${fmtDate(input.installateur.dateExpirationAttestation)}`, M + 130, y);
    y -= lh;
  }
  y -= 8;

  // ── SECTION 3 : EQUIPEMENT ─────────────────────────────────────────────
  text("3. DESIGNATION DE L'EQUIPEMENT PRECHARGE", M, y, { size: 10, bold: true, color: accent });
  y -= 14;
  if (input.equipement.typeMateriel) {
    text("Type :", M, y, { size: 9, color: grey });
    text(input.equipement.typeMateriel, M + 130, y);
    y -= lh;
  }
  if (input.equipement.marque) {
    text("Marque :", M, y, { size: 9, color: grey });
    text(input.equipement.marque, M + 130, y);
    y -= lh;
  }
  text("Modele :", M, y, { size: 9, color: grey });
  text(input.equipement.modele, M + 130, y);
  y -= lh;
  text("N° de serie :", M, y, { size: 9, color: grey });
  text(input.equipement.numeroSerie, M + 130, y);
  y -= lh;
  text("Fluide frigorigene :", M, y, { size: 9, color: grey });
  const fluideStr = input.equipement.fluideLabel
    ? `${input.equipement.fluideCode} (${input.equipement.fluideLabel})`
    : input.equipement.fluideCode;
  text(fluideStr, M + 130, y);
  y -= lh;
  text("Charge nominale :", M, y, { size: 9, color: grey });
  text(`${fmtNum(input.equipement.chargeKg)} kg`, M + 130, y);
  y -= lh;
  text("PRP (GWP) :", M, y, { size: 9, color: grey });
  text(input.equipement.gwp.toLocaleString("fr-FR"), M + 130, y);
  y -= lh;
  const tco2eq = input.equipement.tCO2eq ?? (input.equipement.chargeKg * input.equipement.gwp / 1000);
  text("Equivalent CO2 :", M, y, { size: 9, color: grey });
  text(`${fmtNum(tco2eq)} tCO2eq`, M + 130, y);
  y -= lh;
  if (input.lieuInstallation) {
    text("Lieu d'installation :", M, y, { size: 9, color: grey });
    text(input.lieuInstallation, M + 130, y);
    y -= lh;
  }
  text("Date de livraison :", M, y, { size: 9, color: grey });
  text(fmtDate(input.dateLivraisonISO), M + 130, y);
  y -= lh;
  text("Date de mise en service :", M, y, { size: 9, color: grey });
  text(fmtDate(input.dateMiseEnServiceISO), M + 130, y);
  y -= lh;
  y -= 8;

  // ── SECTION 4 : ENGAGEMENT INSTALLATEUR ────────────────────────────────
  text("4. ENGAGEMENT DE L'INSTALLATEUR", M, y, { size: 10, bold: true, color: accent });
  y -= 14;
  const engagement = `Je soussigne(e), representant legal de l'installateur ci-dessus, declare disposer de`
    + ` l'attestation de capacite en cours de validite requise par l'article R.543-99 du Code de`
    + ` l'environnement, et m'engage a realiser l'assemblage et la mise en service de l'equipement`
    + ` precharge designe ci-dessus dans le respect des regles relatives a la prevention des`
    + ` emissions de fluides frigorigenes (Reglement UE 2024/573 — F-Gas III).`;
  // Word-wrap manuel
  const maxCharsPerLine = 95;
  const words = engagement.split(/\s+/);
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > maxCharsPerLine) {
      text(current.trim(), M, y, { size: 9 });
      y -= lh;
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current) {
    text(current.trim(), M, y, { size: 9 });
    y -= lh;
  }
  y -= 12;

  // ── SECTION 5 : SIGNATURES ─────────────────────────────────────────────
  text("5. SIGNATURES", M, y, { size: 10, bold: true, color: accent });
  y -= 14;
  text("Fait en deux exemplaires, un pour chaque partie.", M, y, { size: 9, color: grey });
  y -= 18;

  const colW = (width - 2 * M - 20) / 2;
  const sigBoxHeight = 70;

  // Cadre signature acheteur
  text("L'ACHETEUR", M, y, { size: 9, bold: true });
  text(input.acheteur.nomOuRaisonSociale, M, y - 12, { size: 8 });
  text("Date : ___________________", M, y - 26, { size: 8, color: grey });
  text("Signature :", M, y - 40, { size: 8, color: grey });
  rect(M, y - 46, colW, sigBoxHeight);

  // Cadre signature installateur
  const x2 = M + colW + 20;
  text("L'INSTALLATEUR ATTESTE", x2, y, { size: 9, bold: true });
  text(input.installateur.raisonSociale, x2, y - 12, { size: 8 });
  text("Date : ___________________", x2, y - 26, { size: 8, color: grey });
  text("Signature :", x2, y - 40, { size: 8, color: grey });
  rect(x2, y - 46, colW, sigBoxHeight);

  y -= 46 + sigBoxHeight + 10;

  // ── PIED DE PAGE ───────────────────────────────────────────────────────
  line(M, y, width - M, y, grey);
  y -= 12;
  text(
    `Document genere par Vertxia le ${new Date().toLocaleString("fr-FR")} — A conserver 5 ans minimum.`,
    M,
    y,
    { size: 7, color: grey }
  );

  const bytes = await pdfDoc.save();
  return bytes;
}
