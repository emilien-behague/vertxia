import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { embedDataUrl } from "@/lib/pdf/pdf-image";

// Fonte Unicode embarquee dans le PDF (NotoSans-Regular ~556KB).
// Avec { subset: true }, seuls les glyphes effectivement utilises sont embed
// dans le PDF final (~50-100KB). Resout les "WinAnsi cannot encode" pour
// fleches (->), smart quotes auto-iOS, exposants metier (degC, m2), etc.
//
// La fonte est cachee en module-level apres le 1er appel pour eviter de relire
// 556KB du disque sur chaque request (gain ~150ms par CERFA).
let cachedFontBytes: Uint8Array | null = null;
async function loadUnicodeFontBytes(): Promise<Uint8Array> {
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

export type TypeIntervention =
  | "recuperation"
  | "demantelement"
  | "controle_periodique"
  | "controle_non_periodique"
  | "mise_service"
  | "maintenance"
  | "assemblage"
  | "modification";

export type Fuite = {
  /** Localisation décrite par l'opérateur */
  localisation: string;
  /** Réparation déjà réalisée ou à faire ? */
  reparee?: "realisee" | "a_faire";
};

export type ControleDetails = {
  /** N° du détecteur de fuite manuel utilisé pendant le contrôle */
  detecteurId?: string;
  /** Équipement équipé d'un système de détection permanente de fuite ? */
  detecteurPermanent: boolean;
  /** Au moins une fuite détectée lors du contrôle ? */
  fuiteDetectee: boolean;
  /** Liste des fuites détectées (max 3 sur le CERFA officiel). Si vide
   *  alors qu'fuiteDetectee=true, on fallback sur fuiteLocalisation/fuiteReparee. */
  fuites?: Fuite[];
  /** [LEGACY rétrocompat] Si fuite : localisation décrite par l'opérateur */
  fuiteLocalisation?: string;
  /** [LEGACY rétrocompat] Si fuite : réparation déjà réalisée ou à faire ? */
  fuiteReparee?: "realisee" | "a_faire";
};

/** Décomposition de la manipulation du fluide (section [11] du CERFA) */
export type FluideManipule = {
  /** A — fluide vierge chargé (kg) */
  vierge?: number;
  /** B — fluide recyclé chargé (récupéré et réintroduit) (kg) */
  recycle?: number;
  /** C — fluide régénéré chargé (kg) */
  regenere?: number;
  /** D — fluide récupéré destiné au traitement (kg) */
  recupereTraitement?: number;
  /** E — fluide récupéré conservé pour réutilisation (kg) */
  recupereReutilisation?: number;
};

/** Détenteur (section [2] du CERFA) — info légale du client */
export type DetenteurInfo = {
  /** SIRET du détenteur (si entreprise) */
  siret?: string;
  /** Adresse postale complète du détenteur */
  adresse?: string;
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

export type OperateurInfo = {
  /** Nom du technicien / opérateur F-Gas (depuis le profil entreprise) */
  name: string;
  /** Qualité — typiquement "Technicien Cat. I/II/III/IV/V" */
  quality: string;
  /** Signature manuscrite de l'opérateur (data URL PNG, depuis le profil). Optionnel. */
  signatureDataUrl?: string;
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
  /** Info légale du détenteur (SIRET, adresse). Concaténé avec clientName dans la case [2]. */
  detenteur?: DetenteurInfo;
  /** Décomposition du fluide manipulé (sections [11A-E] du CERFA).
   *  Si absent : on remplit juste 11_Quantite (total) + 11_QE (assume tout réutilisé). */
  fluideManipule?: FluideManipule;
  /** Observations libres du technicien (notes terrain, dictée vocale, etc.).
   *  Concaténé après les observations auto-générées dans la case [14]. */
  observationsLibres?: string;
  /** Infos de l'opérateur (technicien) depuis son profil entreprise Vertxia.
   *  Si présent : remplit Sign_Operateur_Nom/Qualite/Date + appose la signature
   *  manuscrite du technicien si signatureDataUrl est fournie.
   *  Si absent : fallback "Emilien Behague / Technicien Cat. I" (mode démo). */
  operateur?: OperateurInfo | null;
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

// Remplace les caractères Unicode courants par leurs équivalents ASCII / Latin-1
// pour éviter "WinAnsi cannot encode" — pdf-lib utilise Helvetica WinAnsi par
// défaut sur les textfields du PDF officiel, qui ne supporte que ~190 glyphes.
//
// Si tu rencontres un nouveau caractère qui crash : ajoute-le dans la map.
// Alternative future : embed une fonte Unicode (NotoSans) ~500KB — pour l'instant
// on reste léger.
// Conserve uniquement les caracteres safes pour le rendu PDF :
// - retire les zero-width / BOM (largeur 0, polluent le layout)
// - normalise les NBSP variants en espace standard
// Le reste passe tel quel : on embed NotoSans-Regular en custom font sur
// updateFieldAppearances(), donc fleches, smart quotes, exposants, etc.
// sont rendus nativement (plus de "WinAnsi cannot encode").
function sanitizeForWinAnsi(s: string): string {
  if (!s) return s;
  return s
    .replace(/[​-‍﻿]/g, "")
    .replace(/[   ]/g, " ");
}
export async function fillCerfaPdf(input: CerfaInput): Promise<Uint8Array> {
  const templatePath = path.join(
    process.cwd(),
    "public",
    "cerfa_15497_04_template.pdf"
  );
  const bytes = await readFile(templatePath);
  const pdf = await PDFDocument.load(bytes);

  // Register fontkit + embed NotoSans-Regular comme fonte des appearances de
  // formulaire. Avec { subset: true }, le PDF final ne contient que les glyphes
  // effectivement utilises (~50-100KB embed sur ~556KB source) -> support
  // complet Unicode (fleches, smart quotes, exposants) sans exploser le poids.
  pdf.registerFontkit(fontkit);
  const unicodeFontBytes = await loadUnicodeFontBytes();
  const customFont = await pdf.embedFont(unicodeFontBytes, { subset: true });

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
      f.setText(sanitizeForWinAnsi(value));
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
  // Concatène : nom + SIRET (si fourni) + adresse postale (détenteur.adresse
  // prioritaire, sinon lieuIntervention en fallback).
  const detenteurParts: string[] = [
    input.clientName?.trim() || "Client à compléter",
  ];
  if (input.detenteur?.siret?.trim()) {
    detenteurParts.push(`SIRET ${input.detenteur.siret.trim()}`);
  }
  const adresseDetenteur =
    input.detenteur?.adresse?.trim() ||
    input.lieuIntervention?.trim() ||
    "";
  if (adresseDetenteur) detenteurParts.push(adresseDetenteur);
  setText("Detenteur", detenteurParts.join(" — "), 8);

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
    case "assemblage":
      check("Case_Assemblage");
      break;
    case "modification":
      check("Case_Modif");
      break;
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

    // Section 10 — Fuites détectées (jusqu'à 3 lignes dans le CERFA officiel)
    if (controle.fuiteDetectee) {
      check("Case_Fuite_Oui");
      // Construit la liste des fuites : priorité au tableau `fuites`, sinon
      // fallback rétrocompat sur le couple legacy (fuiteLocalisation + fuiteReparee).
      const fuitesList: Fuite[] =
        controle.fuites && controle.fuites.length > 0
          ? controle.fuites.slice(0, 3)
          : controle.fuiteLocalisation
            ? [{ localisation: controle.fuiteLocalisation, reparee: controle.fuiteReparee }]
            : [];
      const slots: Array<{ loca: string; rep_realisee: string; rep_afaire: string }> = [
        { loca: "Fuite_Loca_1", rep_realisee: "Case_Rep_Fuite1_realisee", rep_afaire: "Case_Rep_Fuite1_AFaire" },
        { loca: "Fuite_Loca_2", rep_realisee: "Case_Rep_Fuite2_realisee", rep_afaire: "Case_Rep_Fuite2_AFaire" },
        { loca: "Fuite_Loca_3", rep_realisee: "Case_Rep_Fuite3_realisee", rep_afaire: "Case_Rep_Fuite3_AFaire" },
      ];
      fuitesList.forEach((fuite, idx) => {
        const slot = slots[idx];
        if (!slot) return;
        if (fuite.localisation) setText(slot.loca, fuite.localisation, 8);
        if (fuite.reparee === "realisee") check(slot.rep_realisee);
        else if (fuite.reparee === "a_faire") check(slot.rep_afaire);
      });
    } else {
      check("Case_Fuite_Non");
    }
  }

  // ─── 11. Fluide manipulé ──────────────────────────────────────────────────
  // CONDITIONNEL : section remplie uniquement si récupération effective
  // (recuperation, demantelement). Pour les contrôles d'étanchéité, la mise
  // en service et la maintenance préventive, aucune quantité n'est manipulée.
  if (hasRecuperation) {
    const fm = input.fluideManipule;
    const qa = fm?.vierge;
    const qb = fm?.recycle;
    const qc = fm?.regenere;
    const totalCharge =
      typeof qa === "number" || typeof qb === "number" || typeof qc === "number"
        ? (qa ?? 0) + (qb ?? 0) + (qc ?? 0)
        : input.weight;
    setText("11_Quantite", String(totalCharge), 8);
    if (typeof qa === "number") setText("11_QA", qa.toFixed(2), 8);
    if (typeof qb === "number") setText("11_QB", qb.toFixed(2), 8);
    if (typeof qc === "number") setText("11_QC", qc.toFixed(2), 8);

    setText("11_Denom", input.fluide.code, 8);
    setText("11_BSFF", input.bsffId ?? "", 6);
    setText("11_Contenant_ID", input.packagingNumero, 8);

    const qd = fm?.recupereTraitement;
    const qe = fm?.recupereReutilisation;
    if (typeof qd === "number" || typeof qe === "number") {
      if (typeof qd === "number") setText("11_QD", qd.toFixed(2), 8);
      if (typeof qe === "number") setText("11_QE", qe.toFixed(2), 8);
      setText("11_QDE", ((qd ?? 0) + (qe ?? 0)).toFixed(2), 8);
    } else {
      setText("11_QE", String(input.weight), 8);
      setText("11_QDE", String(input.weight), 8);
    }
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
  } else if (typeIntervention === "assemblage") {
    observationsParts.push("Assemblage de l'équipement.");
  } else if (typeIntervention === "modification") {
    observationsParts.push("Modification de l'équipement.");
  }
  // Observations libres saisies par le technicien (notes terrain / dictée vocale).
  // Placées AVANT le footer "Fiche générée par Vertxia" pour rester lisibles
  // si jamais le texte total dépasse la zone et est tronqué.
  if (input.observationsLibres?.trim()) {
    observationsParts.push(input.observationsLibres.trim());
  }
  observationsParts.push(
    "Fiche générée automatiquement par Vertxia · vertxia.com"
  );
  setText("14_Observations", observationsParts.join(" "), 7);

  // ─── 15. Signatures ───────────────────────────────────────────────────────
  // Côté opérateur : valeurs issues du profil entreprise Vertxia si fourni,
  // sinon fallback démo (Emilien — c'est le compte SIRET sandbox).
  const opName = input.operateur?.name || "Emilien Behague";
  const opQuality = input.operateur?.quality || "Technicien Cat. I";
  setText("Sign_Operateur_Nom", opName, 8);
  setText("Sign_Operateur_Qualite", opQuality, 8);
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

  // Re-generer les appearances avec la fonte Unicode custom (NotoSans).
  // Sans le 2e arg, pdf-lib fallback sur Helvetica WinAnsi qui ne supporte
  // pas les fleches (->), smart quotes, exposants. Avec customFont, on
  // rend nativement quasi tout Unicode (fonte Google subsettee a la volee).
  form.updateFieldAppearances(customFont);

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
    // Auto-detect PNG / JPEG : le SignaturePad client exporte en PNG mais
    // d'autres canvas (post-fix quota localStorage) peuvent exporter en JPEG.
    const sigImg = await embedDataUrl(pdf, input.detenteurSignature.dataUrl);
    if (sigImg) {
      const scaled = sigImg.scaleToFit(120, 18);
      const page = pdf.getPage(0);
      page.drawImage(sigImg, {
        x: 440,
        y: 45,
        width: scaled.width,
        height: scaled.height,
      });
    }
  }

  // ─── Signature opérateur (technicien, depuis le profil Vertxia) ─────────
  // Même convention que côté détenteur, mais position miroir à GAUCHE.
  // Sign_Operateur_Date va de x=127.5 à x=337.3, y=44.9 à y=63.4.
  // Signature apposée moitié droite de cette zone.
  if (input.operateur?.signatureDataUrl) {
    // Auto-detect PNG / JPEG (signature profil operateur est en JPEG depuis
    // le fix quota localStorage du commit b824c7e).
    const sigImg = await embedDataUrl(pdf, input.operateur.signatureDataUrl);
    if (sigImg) {
      const scaled = sigImg.scaleToFit(120, 18);
      const page = pdf.getPage(0);
      page.drawImage(sigImg, {
        x: 220,
        y: 45,
        width: scaled.width,
        height: scaled.height,
      });
    }
  }

  return await pdf.save();
}
