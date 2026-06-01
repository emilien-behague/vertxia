import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";

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
};

const VERTXIA_OPERATEUR = {
  raisonSociale: "Vertxia TEST",
  siret: "00000091982033",
  attestation: "FR-CAT1-TEST-2026",
  adresse: "Adresse test, 65000 TARBES",
  contact: "Emilien Behague — 06 52 09 98 85 — emilien@vertxia.com",
};

// Famille chimique du fluide (détermine quelle case famille est cochée
// dans la section "périodicité de contrôle d'étanchéité").
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `VTX-${y}${m}${day}-${h}${mi}`;
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
  const famille = FAMILLE[input.fluide.code] ?? "HFC";
  const attestation = input.attestation?.trim() || VERTXIA_OPERATEUR.attestation;

  const setText = (name: string, value: string) => {
    try {
      const f = form.getTextField(name);
      f.setText(value);
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

  // ─── En-tête ──────────────────────────────────────────────────────────────
  setText("Fiche_no", ficheNumber(now));

  // ─── 1. Opérateur ─────────────────────────────────────────────────────────
  setText(
    "Operateur",
    [
      VERTXIA_OPERATEUR.raisonSociale,
      `SIRET ${VERTXIA_OPERATEUR.siret}`,
      VERTXIA_OPERATEUR.adresse,
      VERTXIA_OPERATEUR.contact,
    ].join(" — ")
  );
  setText("Attestation_no", attestation);

  // ─── 2. Détenteur ─────────────────────────────────────────────────────────
  setText(
    "Detenteur",
    [
      input.clientName?.trim() || "Client à compléter",
      input.lieuIntervention?.trim() || "Adresse à compléter sur site",
    ].join(" — ")
  );

  // ─── 3. Équipement ────────────────────────────────────────────────────────
  setText(
    "Equipement_ID",
    [
      input.modeleEquipement?.trim() || "Modèle à compléter",
      `N° série ${input.numeroSerieEquipement?.trim() || "—"}`,
      input.lieuIntervention?.trim() || "Lieu à compléter sur site",
    ].join(" — ")
  );
  setText("Equipement_Fluide", input.fluide.code);
  setText("Equipement_Charge", `${input.weight} kg`);
  setText("Equipement_teqCO2", `${teqCO2} t eq. CO2`);

  // ─── 4. Type d'intervention (récupération = maintenance/démantèlement) ───
  // On coche Maintenance par défaut — c'est le cas de figure le plus large
  // qui couvre une récupération de fluide en service après-vente.
  check("Case_Maintenance");

  // ─── 5-8. Contrôle d'étanchéité ───────────────────────────────────────────
  // Date du contrôle = date d'intervention
  setText("Controle_Jour", dayStr);
  setText("Controle_Mois", monthStr);
  setText("Controle_Annee", yearStr);

  // Périodicité par famille — seuil bas par défaut (réglementation min).
  // L'opérateur peut corriger sur site si charge ≥ seuil supérieur.
  if (famille === "HFC") check("Case_HFC_5");
  else if (famille === "HFO") check("Case_HFO_1");
  else if (famille === "HCFC") check("Case_HCFC_2");

  // Périodicité 12 mois (équipement avec système de détection)
  check("Case_Avec_12m");

  // Pas de fuite par défaut
  check("Case_Fuite_Non");

  // ─── 11. Fluide manipulé ──────────────────────────────────────────────────
  setText("11_Quantite", String(input.weight));
  setText("11_Denom", input.fluide.code);
  setText("11_BSFF", input.bsffId ?? "");
  setText("11_Contenant_ID", input.packagingNumero);
  // QE = quantité récupérée transmise pour destruction/régénération
  setText("11_QE", String(input.weight));

  // ─── 12. Code déchet ──────────────────────────────────────────────────────
  if (isInflammable(input.fluide.code)) {
    check("Case_12_UN3161");
    check("Case_12_Autre160504");
  } else {
    check("Case_12_UN1078");
    check("Case_12_Autre140601");
  }

  // ─── 13. Lieu d'installation ──────────────────────────────────────────────
  setText(
    "13_Instal",
    input.lieuIntervention?.trim() || "Lieu à compléter sur site"
  );

  // ─── 14. Observations ─────────────────────────────────────────────────────
  setText(
    "14_Observations",
    [
      "Récupération de fluide pour traitement par centre agréé.",
      input.bsffId
        ? `Bordereau de Suivi de Fluides Frigorigènes : ${input.bsffId} (plateforme TrackDéchets, Ministère de la Transition écologique).`
        : "",
      `Quantite teq. CO2 : ${teqCO2} t (GWP ${input.fluide.gwp}).`,
      "Fiche générée automatiquement par Vertxia · vertxia.com",
    ]
      .filter(Boolean)
      .join(" ")
  );

  // ─── 15. Signatures ───────────────────────────────────────────────────────
  setText("Sign_Operateur_Nom", "Emilien Behague");
  setText("Sign_Operateur_Qualite", "Frigoriste — Catégorie I");
  setText("Sign_Operateur_Date", dateFR);
  setText("Sign_Detenteur_Nom", "");
  setText("Sign_Detenteur_Qualite", "");
  setText("Sign_Detenteur_Date", "");

  // Flatten = rend tous les champs non-éditables et imprime les valeurs
  // dans le document (PDF "officiel rempli", pas un formulaire à éditer).
  form.flatten();

  return await pdf.save();
}
