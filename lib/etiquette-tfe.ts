// Genere l'etiquette d'intervention F-Gas obligatoire a apposer sur
// l'equipement apres chaque manipulation de fluide frigorigene.
//
// Reference reglementaire :
//   Decret n° 2015-1790 art. R543-83 du Code de l'environnement
//   Reglement (UE) 2024/573 du 7 fevrier 2024
//
// Format : PDF A6 portrait (105x148mm), 1 etiquette par page.
// Le pro l'imprime sur autocollant A6 (Avery 6219, Tesa) ou la decoupe
// sur du A4 standard.
//
// Usage :
//   const blob = await generateEtiquetteTfe(intervention, profil, origin);
//   const url = URL.createObjectURL(blob);
//   <a href={url} download="etiquette-fgas.pdf">...</a>

import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { StoredIntervention } from "@/lib/intervention-storage";
import type { Profil } from "@/lib/profil";

const A6_WIDTH = 297.64;
const A6_HEIGHT = 419.53;

const TYPE_LABELS: Record<string, string> = {
  recuperation: "Recuperation de fluide",
  demantelement: "Demantelement",
  controle_periodique: "Controle d'etancheite (periodique)",
  controle_non_periodique: "Controle d'etancheite (suite fuite)",
  mise_service: "Mise en service",
  maintenance: "Maintenance",
  assemblage: "Assemblage",
  modification: "Modification",
};

function fmtDateFR(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function nextControleDate(intervention: StoredIntervention): string | null {
  // Le controle d'etancheite obligatoire revient :
  // - 12 mois si charge < 50 tCO2eq (cas le plus frequent)
  // - 6 mois si charge >= 50 tCO2eq sans detecteur fixe
  // - 24 mois si detecteur fixe present
  // On affiche la date simple +12 mois (cas standard) uniquement si
  // c'est un controle. Pour les autres types d'intervention, pas de date
  // "prochain controle" affichee (depend de la charge nominale).
  if (
    intervention.typeIntervention !== "controle_periodique" &&
    intervention.typeIntervention !== "controle_non_periodique"
  ) {
    return null;
  }
  try {
    const d = new Date(intervention.createdAt);
    const detecteurFixe = intervention.controleDetails?.detecteurPermanent;
    d.setMonth(d.getMonth() + (detecteurFixe ? 24 : 12));
    return fmtDateFR(d.toISOString());
  } catch {
    return null;
  }
}

export async function generateEtiquetteTfe(
  intervention: StoredIntervention,
  profil: Profil,
  origin: string
): Promise<Blob> {
  // QR code pointe vers la fiche intervention publique (a defaut, l'historique
  // qui demande login). Le scan d'un futur technicien ouvre Vertxia.
  const targetUrl = `${origin.replace(/\/$/, "")}/m/historique/${intervention.id}`;
  const qrDataUrl = await QRCode.toDataURL(targetUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 600,
    color: { dark: "#111111", light: "#FFFFFF" },
  });
  const qrBytes = Uint8Array.from(
    atob(qrDataUrl.split(",")[1]),
    (c) => c.charCodeAt(0)
  );

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([A6_WIDTH, A6_HEIGHT]);
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvMono = await pdfDoc.embedFont(StandardFonts.Courier);

  // Fond blanc casse Vertxia
  page.drawRectangle({
    x: 0,
    y: 0,
    width: A6_WIDTH,
    height: A6_HEIGHT,
    color: rgb(0.96, 0.96, 0.94),
  });

  // Cadre exterieur pour decoupe (1pt)
  page.drawRectangle({
    x: 4,
    y: 4,
    width: A6_WIDTH - 8,
    height: A6_HEIGHT - 8,
    borderColor: rgb(0.07, 0.07, 0.07),
    borderWidth: 1,
  });

  // Header bandeau noir
  const headerHeight = 36;
  page.drawRectangle({
    x: 4,
    y: A6_HEIGHT - headerHeight - 4,
    width: A6_WIDTH - 8,
    height: headerHeight,
    color: rgb(0.07, 0.07, 0.07),
  });
  page.drawText("VERTXIA  ETIQUETTE F-GAS", {
    x: 14,
    y: A6_HEIGHT - 22,
    size: 9,
    font: helvBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("art. R543-83 C. env.", {
    x: A6_WIDTH - 95,
    y: A6_HEIGHT - 22,
    size: 6.5,
    font: helv,
    color: rgb(0.7, 0.7, 0.7),
  });

  // Curseur de mise en page
  let y = A6_HEIGHT - headerHeight - 14;
  const padX = 14;

  // Section helper
  function sectionHeader(label: string) {
    y -= 6;
    page.drawText(label, {
      x: padX,
      y,
      size: 7,
      font: helvBold,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 4;
    page.drawLine({
      start: { x: padX, y },
      end: { x: A6_WIDTH - padX, y },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 9;
  }

  function row(label: string, value: string, mono = false) {
    page.drawText(label, {
      x: padX,
      y,
      size: 7,
      font: helv,
      color: rgb(0.55, 0.55, 0.55),
    });
    page.drawText(value, {
      x: padX + 55,
      y,
      size: 8.5,
      font: mono ? helvMono : helvBold,
      color: rgb(0.07, 0.07, 0.07),
      maxWidth: A6_WIDTH - padX - 55 - padX,
    });
    y -= 12;
  }

  // OPERATEUR
  sectionHeader("OPERATEUR");
  row(
    "Societe",
    (profil.raisonSociale || "—").slice(0, 38),
  );
  if (profil.siret) row("SIRET", profil.siret, true);
  if (profil.numeroAttestation) {
    const cat = profil.categorieAttestation
      ? `Cat. ${profil.categorieAttestation} - ${profil.numeroAttestation}`
      : profil.numeroAttestation;
    row("Attestation", cat.slice(0, 32), true);
  }

  // INTERVENTION
  sectionHeader("INTERVENTION");
  row("Date", fmtDateFR(intervention.createdAt));
  row(
    "Type",
    (TYPE_LABELS[intervention.typeIntervention] || intervention.typeIntervention).slice(0, 32),
  );
  row(
    "Fluide",
    `${intervention.fluide.code} (PRG ${intervention.fluide.gwp})`,
  );
  if (intervention.weight > 0) {
    const teq = (intervention.weight * intervention.fluide.gwp / 1000).toFixed(2);
    row("Quantite", `${intervention.weight.toFixed(2)} kg / ${teq} t.eq.CO2`);
  }
  if (intervention.packagingNumero) {
    row("N° contenant", intervention.packagingNumero, true);
  }
  if (intervention.bsffId) {
    row("BSFF", intervention.bsffId.slice(0, 22), true);
  }

  // EQUIPEMENT
  if (intervention.modeleEquipement || intervention.numeroSerieEquipement || intervention.lieuIntervention || intervention.clientName) {
    sectionHeader("EQUIPEMENT");
    if (intervention.modeleEquipement) {
      row("Modele", intervention.modeleEquipement.slice(0, 32));
    }
    if (intervention.numeroSerieEquipement) {
      row("N° serie", intervention.numeroSerieEquipement.slice(0, 28), true);
    }
    if (intervention.clientName) {
      row("Client", intervention.clientName.slice(0, 32));
    }
    if (intervention.lieuIntervention) {
      row("Site", intervention.lieuIntervention.slice(0, 38));
    }
  }

  // PROCHAIN CONTROLE (uniquement si controle)
  const nextDate = nextControleDate(intervention);
  if (nextDate) {
    sectionHeader("PROCHAIN CONTROLE");
    row("Au plus tard", nextDate);
  }

  // QR code en bas
  const qrSize = 70;
  const qrX = padX;
  const qrY = 28;
  const qrImage = await pdfDoc.embedPng(qrBytes);
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  // Texte cote QR
  page.drawText("Scannez pour", {
    x: qrX + qrSize + 8,
    y: qrY + qrSize - 12,
    size: 7,
    font: helv,
    color: rgb(0.5, 0.5, 0.5),
  });
  page.drawText("voir l'historique", {
    x: qrX + qrSize + 8,
    y: qrY + qrSize - 22,
    size: 7,
    font: helv,
    color: rgb(0.5, 0.5, 0.5),
  });
  page.drawText("complet de cet", {
    x: qrX + qrSize + 8,
    y: qrY + qrSize - 32,
    size: 7,
    font: helv,
    color: rgb(0.5, 0.5, 0.5),
  });
  page.drawText("equipement.", {
    x: qrX + qrSize + 8,
    y: qrY + qrSize - 42,
    size: 7,
    font: helv,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Footer
  page.drawText("Conforme Reglement UE 2024/573", {
    x: padX,
    y: 12,
    size: 6,
    font: helv,
    color: rgb(0.5, 0.5, 0.5),
  });
  page.drawText("vertxia.com", {
    x: A6_WIDTH - padX - 50,
    y: 12,
    size: 6,
    font: helvBold,
    color: rgb(0.07, 0.07, 0.07),
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes as unknown as ArrayBuffer], { type: "application/pdf" });
}
