// Déclaration SYDEREP annuelle des opérateurs F-Gas.
//
// Source : ADEME — https://syderep.ademe.fr
// Période officielle de déclaration : 1er février → 31 mars (données année N-1)
// Référence : Art. R543-77 à R543-123 Code de l'environnement, Règlement UE 2024/573.
//
// Vertxia agrège les interventions stockées localement pour pré-remplir
// les rubriques que SYDEREP attend, par type de fluide :
//   - Stock initial (1er janvier) — saisie manuelle (Vertxia ne connaît pas l'inventaire d'avant)
//   - Achats à un fournisseur — saisie manuelle (Vertxia ne tracke pas encore les factures)
//   - Charges en équipement (mise en service + maintenance) — auto depuis interventions
//   - Récupérations d'équipement (récup + démantèlement) — auto
//   - Cessions à un centre de traitement — auto (interventions avec BSFF signé)
//   - Stock final (31 décembre) — calculé : init + achats + récupéré − chargé − cédé

import type { StoredIntervention } from "@/lib/intervention-storage";

export type SyderepManualInput = {
  stockInitialKg: number;
  achatsKg: number;
};

export type SyderepRow = {
  fluideCode: string;
  fluideLabel: string;
  gwp: number;
  stockInitialKg: number;
  achatsKg: number;
  chargeMiseServiceKg: number;
  chargeMaintenanceKg: number;
  recupereKg: number;
  cedeKg: number;
  stockFinalKg: number;
  nbInterventions: number;
  tonnesEqCO2: number;
};

export type SyderepDeclaration = {
  year: number;
  rows: SyderepRow[];
  totalChargeKg: number;
  totalRecupereKg: number;
  totalCedeKg: number;
  totalCO2eq: number;
  nbInterventions: number;
};

export type SyderepManualInputs = Record<string, SyderepManualInput>;

function emptyManual(): SyderepManualInput {
  return { stockInitialKg: 0, achatsKg: 0 };
}

export function aggregateForYear(
  interventions: StoredIntervention[],
  year: number,
  manualInputs: SyderepManualInputs = {}
): SyderepDeclaration {
  const yearStart = `${year}-01-01T00:00:00`;
  const yearEnd = `${year + 1}-01-01T00:00:00`;
  const inYear = interventions.filter(
    (i) => i.createdAt >= yearStart && i.createdAt < yearEnd
  );

  type Agg = {
    fluideLabel: string;
    gwp: number;
    chargeMiseService: number;
    chargeMaintenance: number;
    recupere: number;
    cede: number;
    nb: number;
  };
  const byFluide = new Map<string, Agg>();

  for (const i of inYear) {
    const code = i.fluide.code;
    let row = byFluide.get(code);
    if (!row) {
      row = {
        fluideLabel: i.fluide.label,
        gwp: i.fluide.gwp,
        chargeMiseService: 0,
        chargeMaintenance: 0,
        recupere: 0,
        cede: 0,
        nb: 0,
      };
      byFluide.set(code, row);
    }
    row.nb++;
    switch (i.typeIntervention) {
      case "mise_service":
        row.chargeMiseService += i.weight;
        break;
      case "maintenance":
        row.chargeMaintenance += i.weight;
        break;
      case "recuperation":
      case "demantelement":
        row.recupere += i.weight;
        // Cession effective vers un centre = BSFF signé avec destination connue.
        if (i.bsffId && i.destination) {
          row.cede += i.weight;
        }
        break;
      // Les contrôles d'étanchéité ne touchent pas au fluide (pas d'ajout/retrait).
      default:
        break;
    }
  }

  // Inclure aussi les fluides déclarés manuellement (stock/achat) même sans intervention.
  const codes = new Set<string>(byFluide.keys());
  for (const [code, manual] of Object.entries(manualInputs)) {
    if (manual.stockInitialKg > 0 || manual.achatsKg > 0) {
      codes.add(code);
    }
  }

  const rows: SyderepRow[] = [];
  for (const code of codes) {
    const agg = byFluide.get(code);
    const manual = manualInputs[code] ?? emptyManual();
    const fluideLabel = agg?.fluideLabel ?? code;
    const gwp = agg?.gwp ?? 0;
    const chargeMS = agg?.chargeMiseService ?? 0;
    const chargeM = agg?.chargeMaintenance ?? 0;
    const recupere = agg?.recupere ?? 0;
    const cede = agg?.cede ?? 0;
    const nb = agg?.nb ?? 0;

    // Stock final = init + achats + récupéré (réintégré au stock) − chargé en équipement − cédé
    const stockFinal =
      manual.stockInitialKg + manual.achatsKg + recupere - chargeMS - chargeM - cede;

    rows.push({
      fluideCode: code,
      fluideLabel,
      gwp,
      stockInitialKg: manual.stockInitialKg,
      achatsKg: manual.achatsKg,
      chargeMiseServiceKg: chargeMS,
      chargeMaintenanceKg: chargeM,
      recupereKg: recupere,
      cedeKg: cede,
      stockFinalKg: stockFinal,
      nbInterventions: nb,
      tonnesEqCO2: ((chargeMS + chargeM) * gwp) / 1000,
    });
  }

  rows.sort((a, b) => a.fluideCode.localeCompare(b.fluideCode));

  return {
    year,
    rows,
    totalChargeKg: rows.reduce((s, r) => s + r.chargeMiseServiceKg + r.chargeMaintenanceKg, 0),
    totalRecupereKg: rows.reduce((s, r) => s + r.recupereKg, 0),
    totalCedeKg: rows.reduce((s, r) => s + r.cedeKg, 0),
    totalCO2eq: rows.reduce((s, r) => s + r.tonnesEqCO2, 0),
    nbInterventions: rows.reduce((s, r) => s + r.nbInterventions, 0),
  };
}

/**
 * Export CSV format français (séparateur ; pour Excel FR).
 * Copy-paste direct dans le portail SYDEREP ou dans un tableau Excel.
 */
export function toCsv(decl: SyderepDeclaration): string {
  const sep = ";";
  const headers = [
    "Code fluide",
    "GWP",
    "Stock initial 01/01 (kg)",
    "Achats fournisseur (kg)",
    "Charge mise en service (kg)",
    "Charge maintenance (kg)",
    "Recupere equipement (kg)",
    "Cede centre de traitement (kg)",
    "Stock final 31/12 (kg)",
    "Nb interventions",
    "Eq. CO2 (tonnes)",
  ];
  const lines = [headers.join(sep)];
  for (const r of decl.rows) {
    lines.push(
      [
        r.fluideCode,
        r.gwp,
        r.stockInitialKg.toFixed(2),
        r.achatsKg.toFixed(2),
        r.chargeMiseServiceKg.toFixed(2),
        r.chargeMaintenanceKg.toFixed(2),
        r.recupereKg.toFixed(2),
        r.cedeKg.toFixed(2),
        r.stockFinalKg.toFixed(2),
        r.nbInterventions,
        r.tonnesEqCO2.toFixed(3),
      ].join(sep)
    );
  }
  // Total ligne en bas
  lines.push(
    [
      "TOTAL",
      "",
      "",
      "",
      decl.rows.reduce((s, r) => s + r.chargeMiseServiceKg, 0).toFixed(2),
      decl.rows.reduce((s, r) => s + r.chargeMaintenanceKg, 0).toFixed(2),
      decl.totalRecupereKg.toFixed(2),
      decl.totalCedeKg.toFixed(2),
      "",
      decl.nbInterventions,
      decl.totalCO2eq.toFixed(3),
    ].join(sep)
  );
  return lines.join("\n") + "\n";
}

const MANUAL_INPUTS_KEY_PREFIX = "vertxia:syderep:manual";

export function loadManualInputs(year: number): SyderepManualInputs {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${MANUAL_INPUTS_KEY_PREFIX}:${year}`);
    if (!raw) return {};
    return JSON.parse(raw) as SyderepManualInputs;
  } catch {
    return {};
  }
}

export function saveManualInputs(year: number, inputs: SyderepManualInputs): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(`${MANUAL_INPUTS_KEY_PREFIX}:${year}`, JSON.stringify(inputs));
}
