import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type TypeIntervention =
  | "recuperation"
  | "demantelement"
  | "controle_periodique"
  | "controle_non_periodique"
  | "mise_service"
  | "maintenance";

export type ControleDetails = {
  /** N° du détecteur de fuite manuel utilisé pendant le contrôle */
  detecteurId?: string;
  /** Équipement équipé d'un système de détection permanente de fuite ? */
  detecteurPermanent: boolean;
  /** Au moins une fuite détectée lors du contrôle ? */
  fuiteDetectee: boolean;
  /** Si fuite : localisation décrite par l'opérateur */
  fuiteLocalisation?: string;
  /** Si fuite : réparation déjà réalisée ou à faire ? */
  fuiteReparee?: "realisee" | "a_faire";
};

export type Destination = {
  name: string;
  siret: string;
  address: string;
};

export type SignatureDetenteur = {
  /** Nom complet du détenteur signataire */
  name: string;
  /** Qualité du signataire (Propriétaire, Gérant, etc.) */
  quality?: string;
  /** Image PNG de la signature en data URL (canvas tactile). */
  dataUrl: string;
};

export type CerfaInput = {
  fluide: { code: string; label: string; gwp: number };
  weight: number;
  packagingNumero: string;
  clientName: string | null;
  modeleEquipement?: string;
  numeroSerieEquipement?: string;
  attestation?: string;
  lieuIntervention?: string;
  bsffId?: string;
  /** Type d'intervention — wizard /bsff. Par défaut "recuperation". */
  typeIntervention?: TypeIntervention;
  /** Détails du contrôle d'étanchéité — uniquement si typeIntervention ≠ "recuperation" */
  controleDetails?: ControleDetails;
  /** Centre de traitement du fluide récupéré (case 13 du CERFA).
   *  Récupéré depuis TrackDéchets après création du BSFF. */
  destination?: Destination | null;
  /** Signature du détenteur capturée sur canvas tactile (Approche C).
   *  Si présente : remplit Sign_Detenteur_Nom/Qualite/Date + embed l'image
   *  PNG dans la zone signature détenteur du PDF officiel. */
  detenteurSignature?: SignatureDetenteur | null;
};

// Famille chimique du fluide (paliers HFC/HFO/HCFC du Règlement UE 2024/573).
type Famille = "HFC" | "HFO" | "HCFC" | "Naturel";
const FAMILLE: Record<string, Famille> = {
  "R-32": "HFC",
  "R-410A": "HFC",
  "R-134a": "HFC",
  "R-407C": "HFC",
  "R-449A": "HFC",
  "R-1234yf": "HFO",
  "R-22": "HCFC",
  "R-290": "Naturel",
};

const VERTXIA_OPERATEUR = {
  raisonSociale: "Vertxia TEST",
  siret: "00000091982033",
  attestation: "FR-CAT1-TEST-2026",
  adresse: "Adresse test, 65000 TARBES",
  contact: "Emilien Behague — 06 52 09 98 85 — emilien@vertxia.com",
};

// R-290 (propane) = inflammable → UN3161 + déchet 16 05 04
// Les autres (HFC/HFO/HCFC) → UN1078 + déchet 14 06 01
function isInflammable(code: string): boolean {
  return code === "R-290";
}

function fmtDateFR(d: Date) {
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function ficheNumber(d: Date) {
  // Format compact pour tenir dans la case "Fiche N°" du CERFA officiel.
  // YYMMDD-HHmm = 11 caractères max.
  const yy = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}${m}${day}-${h}${mi}`;
}

export async function fillCerfaPdf(input: CerfaInput): Promise<Uint8Array> {
  const templatePath = path.join(
    process.cwd(),
    "public",
    "cerfa_15497_04_template.pdf"
  );
  const bytes = await readFile(templatePath);
  const pdf = await PDFDocument.load(bytes);
  const form = pdf.getForm();

  const now = new Date();
  const dateFR = fmtDateFR(now);
  const dayStr = String(now.getDate()).padStart(2, "0");
  const monthStr = String(now.getMonth() + 1).padStart(2, "0");
  const yearStr = String(now.getFullYear());

  const teqCO2 = ((input.weight * input.fluide.gwp) / 1000).toFixed(2);
  const teqCO2Num = parseFloat(teqCO2);
  const famille = FAMILLE[input.fluide.code] ?? "HFC";
  const attestation = input.attestation?.trim() || VERTXIA_OPERATEUR.attestation;
  const typeIntervention = input.typeIntervention ?? "recuperation";
  const controle = input.controleDetails;
  const hasControle =
    (typeIntervention === "controle_periodique" ||
      typeIntervention === "controle_non_periodique") &&
    controle !== undefined;
  // Récupération de fluide effective dans cette intervention (=> remplir
  // section 11 manipulation + section 12 code déchet).
  const hasRecuperation =
    typeIntervention === "recuperation" || typeIntervention === "demantelement";

  const setText = (name: string, value: string, fontSize?: number) => {
    try {
      const f = form.getTextField(name);
      f.setText(value);
      if (fontSize !== undefined) f.setFontSize(fontSize);
    } catch {
      // champ absent : on ignore silencieusement
    }
  };
  const check = (name: string) => {
    try {
      form.getCheckBox(name).check();
    } catch {
      /* */
    }
  };
  const selectRadio = (name: string, option: string) => {
    try {
      form.getRadioGroup(name).select(option);
    } catch {
      /* */
    }
  };

  // ─── En-tête ──────────────────────────────────────────────────────────────
  // Case "Fiche N°" très étroite → fontSize réduite pour éviter le truncate.
  setText("Fiche_no", ficheNumber(now), 9);

  // ─── 1. Opérateur ─────────────────────────────────────────────────────────
  setText(
    "Operateur",
    [
      VERTXIA_OPERATEUR.raisonSociale,
      `SIRET ${VERTXIA_OPERATEUR.siret}`,
      VERTXIA_OPERATEUR.adresse,
      VERTXIA_OPERATEUR.contact,
    ].join(" — "),
    7
  );
  setText("Attestation_no", attestation, 9);

  // ─── 2. Détenteur ─────────────────────────────────────────────────────────
  setText(
    "Detenteur",
    [
      input.clientName?.trim() || "Client à compléter",
      input.lieuIntervention?.trim() || "Adresse à compléter sur site",
    ].join(" — "),
    8
  );

  // ─── 3. Équipement ────────────────────────────────────────────────────────
  setText(
    "Equipement_ID",
    [
      input.modeleEquipement?.trim() || "Modèle à compléter",
      `N° série ${input.numeroSerieEquipement?.trim() || "—"}`,
      input.lieuIntervention?.trim() || "Lieu à compléter sur site",
    ].join(" — "),
    7
  );
  setText("Equipement_Fluide", input.fluide.code);
  // Unités "kg" et "t.éq.CO2" déjà imprimées APRÈS les champs dans le PDF officiel.
  setText("Equipement_Charge", String(input.weight));
  setText("Equipement_teqCO2", teqCO2);

  // ─── 4. Type d'intervention ───────────────────────────────────────────────
  // Notice 52064*04 : 8 cases possibles, on coche celle(s) qui correspond(ent).
  switch (typeIntervention) {
    case "controle_periodique":
      check("Case_CtrlPerio");
      break;
    case "controle_non_periodique":
      check("Case_CtrlNonPerio");
      break;
    case "mise_service":
      check("Case_MiseService");
      break;
    case "maintenance":
      check("Case_Maintenance");
      break;
    case "demantelement":
      check("Case_Demantel");
      break;
    case "recuperation":
    default:
      // Pas de case "Récupération" dans le CERFA officiel → Case_Autre + libellé.
      // Champ "Autre" très étroit → texte raccourci + fontSize 7.
      check("Case_Autre");
      setText("Autre", "Récupération de fluide", 7);
      break;
  }

  // ─── 5-10. Contrôle d'étanchéité + fuite ──────────────────────────────────
  // CONDITIONNEL : rempli UNIQUEMENT si l'opérateur a effectivement effectué
  // un contrôle d'étanchéité dans cette intervention (wizard /bsff).
  if (hasControle && controle) {
    // Section 5 — détecteur manuel utilisé
    if (controle.detecteurId) setText("Detecteur_ID", controle.detecteurId, 8);

    // Date du contrôle (jour / mois / année séparés dans le CERFA officiel)
    setText("Controle_Jour", dayStr);
    setText("Controle_Mois", monthStr);
    setText("Controle_Annee", yearStr);

    // Section 6 — Bouton_Oui : radio à 2 options (1 = Oui, 2 = Non)
    selectRadio("Bouton_Oui", controle.detecteurPermanent ? "1" : "2");

    // Sections 8/9 — Palier de charge selon famille + tonnage éq. CO2.
    // Paliers : HFC 5/50/500 t — HFO 1/10/100 t — HCFC 2/30/300 t.
    if (famille === "HFC") {
      if (teqCO2Num >= 500) check("Case_HFC_500");
      else if (teqCO2Num >= 50) check("Case_HFC_50");
      else check("Case_HFC_5");
    } else if (famille === "HFO") {
      if (teqCO2Num >= 100) check("Case_HFO_100");
      else if (teqCO2Num >= 10) check("Case_HFO_10");
      else check("Case_HFO_1");
    } else if (famille === "HCFC") {
      if (teqCO2Num >= 300) check("Case_HCFC_300");
      else if (teqCO2Num >= 30) check("Case_HCFC_30");
      else check("Case_HCFC_2");
    }

    // Périodicité du contrôle d'étanchéité :
    //   AVEC détecteur permanent (section 9) : 6m / 12m / 24m
    //   SANS détecteur permanent (section 8) : 3m / 6m / 12m
    //   Sous 5 t éq. CO2 : aucune périodicité réglementaire imposée.
    if (controle.detecteurPermanent) {
      if (teqCO2Num >= 500) check("Case_Avec_6m");
      else if (teqCO2Num >= 50) check("Case_Avec_12m");
      else if (teqCO2Num >= 5) check("Case_Avec_24m");
    } else {
      if (teqCO2Num >= 500) check("Case_Sans_3m");
      else if (teqCO2Num >= 50) check("Case_Sans_6m");
      else if (teqCO2Num >= 5) check("Case_Sans_12m");
    }

    // Section 10 — Fuite détectée
    if (controle.fuiteDetectee) {
      check("Case_Fuite_Oui");
      if (controle.fuiteLocalisation) {
        setText("Fuite_Loca_1", controle.fuiteLocalisation, 8);
      }
      if (controle.fuiteReparee === "realisee") check("Case_Rep_Fuite1_realisee");
      else if (controle.fuiteReparee === "a_faire") check("Case_Rep_Fuite1_AFaire");
    } else {
      check("Case_Fuite_Non");
    }
  }

  // ─── 11. Fluide manipulé ──────────────────────────────────────────────────
  // CONDITIONNEL : section remplie uniquement si récupération effective
  // (recuperation, demantelement). Pour les contrôles d'étanchéité, la mise
  // en service et la maintenance préventive, aucune quantité n'est manipulée.
  if (hasRecuperation) {
    setText("11_Quantite", String(input.weight), 8);
    setText("11_Denom", input.fluide.code, 8);
    // BSFF ID : ~21 chars (FF-YYYYMMDD-XXXXXXXXX) → case TRÈS étroite, fontSize 6.
    setText("11_BSFF", input.bsffId ?? "", 6);
    setText("11_Contenant_ID", input.packagingNumero, 8);
    // QE = quantité récupérée transmise pour destruction/régénération
    setText("11_QE", String(input.weight), 8);
  }

  // ─── 12. Dénomination ADR/RID ─────────────────────────────────────────────
  // CONDITIONNEL : section remplie uniquement si récupération de déchet en
  // contenant (notice 52064*04). Tous les fluides du formulaire sont classés
  // UN 1078 sauf R-290 (UN 3161, inflammable).
  if (hasRecuperation) {
    if (isInflammable(input.fluide.code)) {
      check("Case_12_UN3161");
    } else {
      check("Case_12_UN1078");
    }
  }

  // ─── 13. Installation de destination ──────────────────────────────────────
  // Centre de traitement où le fluide récupéré est envoyé. Récupéré côté
  // serveur via une query GraphQL TrackDéchets sur l'identifiant du BSFF
  // qu'on vient de créer — source de vérité officielle.
  if (hasRecuperation && input.destination) {
    const d = input.destination;
    setText(
      "13_Instal",
      [d.name, `SIRET ${d.siret}`, d.address]
        .filter(s => s && s.trim().length > 0)
        .join(" — "),
      7
    );
  }

  // ─── 14. Observations ─────────────────────────────────────────────────────
  const observationsParts: string[] = [];
  if (hasRecuperation) {
    observationsParts.push(
      "Récupération de fluide pour traitement par centre agréé."
    );
    if (input.bsffId) {
      observationsParts.push(
        `BSFF (TrackDéchets - Ministère Transition écologique) : ${input.bsffId}.`
      );
    }
    observationsParts.push(
      `Quantité teq. CO2 : ${teqCO2} t (GWP ${input.fluide.gwp}).`
    );
  } else if (typeIntervention === "controle_periodique") {
    observationsParts.push(
      "Contrôle périodique d'étanchéité réalisé conformément au Règlement UE 2024/573."
    );
  } else if (typeIntervention === "controle_non_periodique") {
    observationsParts.push(
      "Contrôle non périodique d'étanchéité (suite à fuite signalée ou réparation)."
    );
  } else if (typeIntervention === "mise_service") {
    observationsParts.push("Mise en service de l'équipement.");
  } else if (typeIntervention === "maintenance") {
    observationsParts.push(
      "Maintenance préventive sans manipulation de fluide."
    );
  }
  observationsParts.push(
    "Fiche générée automatiquement par Vertxia · vertxia.com"
  );
  setText("14_Observations", observationsParts.join(" "), 7);

  // ─── 15. Signatures ───────────────────────────────────────────────────────
  setText("Sign_Operateur_Nom", "Emilien Behague", 8);
  setText("Sign_Operateur_Qualite", "Frigoriste Cat. I", 8);
  setText("Sign_Operateur_Date", dateFR, 8);
  if (input.detenteurSignature) {
    setText("Sign_Detenteur_Nom", input.detenteurSignature.name, 8);
    setText("Sign_Detenteur_Qualite", input.detenteurSignature.quality ?? "", 8);
    setText("Sign_Detenteur_Date", dateFR, 8);
  } else {
    setText("Sign_Detenteur_Nom", "");
    setText("Sign_Detenteur_Qualite", "");
    setText("Sign_Detenteur_Date", "");
  }

  // Re-générer les appearances pour appliquer les setFontSize() personnalisés.
  // Sans ça, pdf-lib garde l'apparence d'origine (fontSize auto du PDF source).
  form.updateFieldAppearances();

  // Flatten = rend tous les champs non-éditables et imprime les valeurs
  // dans le document (PDF "officiel rempli", pas un formulaire à éditer).
  form.flatten();

  // ─── Signature détenteur (Approche C — canvas tactile) ───────────────────
  // Embed après flatten pour que l'image apparaisse PAR-DESSUS la zone signature.
  //
  // Coords des 3 champs détenteur (inspection acroField) :
  //   Nom    : x=345.2, y=92.9,  w=208.0, h=9.5
  //   Qualité: x=345.2, y=73.8,  w=208.0, h=9.5
  //   Date   : x=345.2, y=43.7,  w=208.3, h=19.7
  //
  // Le PDF officiel n'a PAS de case signature dédiée séparée — la convention
  // est d'apposer la signature manuscrite à droite de la Date (effet "signé le").
  // Position : moitié droite de la zone Date, taille réduite pour ne pas masquer
  // le texte de date (aligné à gauche).
  if (input.detenteurSignature?.dataUrl) {
    const base64 = input.detenteurSignature.dataUrl.replace(
      /^data:image\/png;base64,/,
      ""
    );
    const pngBytes = Buffer.from(base64, "base64");
    const sigImg = await pdf.embedPng(pngBytes);
    const scaled = sigImg.scaleToFit(120, 18);
    const page = pdf.getPage(0);
    page.drawImage(sigImg, {
      x: 440,
      y: 45,
      width: scaled.width,
      height: scaled.height,
    });
  }

  return await pdf.save();
}
