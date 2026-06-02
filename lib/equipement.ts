// Parc d'équipements F-Gas + planning des contrôles d'étanchéité réglementaires.
//
// Référence : Règlement (UE) 2024/573 article 5 (anciennement 517/2014 art. 4)
// Source officielle : https://eur-lex.europa.eu/eli/reg/2024/573/oj
//
// Fréquences de contrôle pour les équipements contenant des HFC, calculées sur
// la charge exprimée en tonnes équivalent CO₂ (tCO₂eq = charge_kg × GWP / 1000) :
//
//   < 5 tCO₂eq      → pas de contrôle obligatoire (exempté)
//   5-50 tCO₂eq     → 12 mois sans détecteur fixe, 24 mois avec
//   50-500 tCO₂eq   → 6 mois sans détecteur fixe, 12 mois avec
//   ≥ 500 tCO₂eq    → 3 mois sans détecteur fixe, 6 mois avec
//
// Note : les seuils en kg pour les HFO (PRG < 150) sont différents et non
// gérés dans cette V1 — un équipement HFO retourne null pour la fréquence
// avec une note explicite à l'utilisateur.

import type { StoredIntervention } from "./intervention-storage";

export type StoredEquipement = {
  id: string;
  createdAt: string;
  clientName: string;
  siteAdresse?: string;
  modele: string;
  numeroSerie: string;
  fluide: { code: string; label: string; gwp: number };
  chargeKg: number;
  /** Détecteur fixe de fuites installé → divise par 2 la fréquence requise */
  detecteurFixe: boolean;
  /** Date du dernier contrôle d'étanchéité (ISO). Si vide : jamais contrôlé. */
  dernierControleISO?: string;
  notes?: string;
};

export type ControleStatut = "exempt" | "ok" | "a_programmer" | "en_retard" | "jamais";

export type EquipementWithStatus = StoredEquipement & {
  tCO2eq: number;
  frequenceMois: number | null;
  prochainControleISO: string | null;
  statut: ControleStatut;
  joursAvantControle: number | null;
  isHFO: boolean;
};

const STORAGE_KEY = "vertxia:equipements";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function listEquipements(): StoredEquipement[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredEquipement[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveEquipement(
  data: Omit<StoredEquipement, "id" | "createdAt">
): StoredEquipement {
  if (!isBrowser()) throw new Error("localStorage indisponible");
  const entry: StoredEquipement = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const all = listEquipements();
  all.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return entry;
}

export function updateEquipement(id: string, patch: Partial<StoredEquipement>): void {
  if (!isBrowser()) return;
  const all = listEquipements().map((e) => (e.id === id ? { ...e, ...patch } : e));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteEquipement(id: string): void {
  if (!isBrowser()) return;
  const filtered = listEquipements().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Calcule la fréquence de contrôle d'étanchéité en mois pour un équipement HFC.
 * Retourne null si :
 *  - charge en tCO₂eq < 5 (équipement exempté)
 *  - fluide HFO (PRG < 150, seuils en kg différents non implémentés en V1)
 */
export function frequenceControleMois(
  tCO2eq: number,
  hasDetecteur: boolean,
  isHFO: boolean
): number | null {
  if (isHFO) return null;
  if (tCO2eq < 5) return null;
  if (tCO2eq < 50) return hasDetecteur ? 24 : 12;
  if (tCO2eq < 500) return hasDetecteur ? 12 : 6;
  return hasDetecteur ? 6 : 3;
}

/** PRG < 150 = HFO (R-1234yf, R-1234ze…) — seuils en kg différents */
function detectHFO(gwp: number): boolean {
  return gwp > 0 && gwp < 150;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const diff = b.getTime() - a.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function computeStatus(
  equipement: StoredEquipement,
  interventions: StoredIntervention[] = []
): EquipementWithStatus {
  const tCO2eq = (equipement.chargeKg * equipement.fluide.gwp) / 1000;
  const isHFO = detectHFO(equipement.fluide.gwp);
  const frequenceMois = frequenceControleMois(tCO2eq, equipement.detecteurFixe, isHFO);

  // Recherche du dernier contrôle d'étanchéité réel dans les interventions Vertxia,
  // lié à cet équipement par numéro de série.
  const controlesReels = interventions.filter(
    (i) =>
      (i.typeIntervention === "controle_periodique" ||
        i.typeIntervention === "controle_non_periodique") &&
      i.numeroSerieEquipement?.toLowerCase().trim() ===
        equipement.numeroSerie.toLowerCase().trim()
  );
  const dernierControleAuto = controlesReels
    .map((i) => i.createdAt)
    .sort()
    .pop();

  // On prend la date la plus récente entre la saisie manuelle et l'auto-détection.
  const dernierControleISO =
    equipement.dernierControleISO && dernierControleAuto
      ? equipement.dernierControleISO > dernierControleAuto
        ? equipement.dernierControleISO
        : dernierControleAuto
      : (equipement.dernierControleISO ?? dernierControleAuto);

  let prochainControleISO: string | null = null;
  let statut: ControleStatut;
  let joursAvantControle: number | null = null;

  if (frequenceMois === null) {
    statut = "exempt";
  } else if (!dernierControleISO) {
    statut = "jamais";
  } else {
    const prochain = addMonths(new Date(dernierControleISO), frequenceMois);
    prochainControleISO = prochain.toISOString();
    const jours = daysBetween(new Date(), prochain);
    joursAvantControle = jours;
    if (jours < 0) statut = "en_retard";
    else if (jours <= 90) statut = "a_programmer";
    else statut = "ok";
  }

  return {
    ...equipement,
    tCO2eq,
    frequenceMois,
    prochainControleISO,
    statut,
    joursAvantControle,
    isHFO,
  };
}

export function computeAllStatus(
  equipements: StoredEquipement[],
  interventions: StoredIntervention[]
): EquipementWithStatus[] {
  return equipements
    .map((e) => computeStatus(e, interventions))
    .sort((a, b) => {
      // Tri : en_retard → a_programmer → jamais → ok → exempt
      const order: Record<ControleStatut, number> = {
        en_retard: 0,
        a_programmer: 1,
        jamais: 2,
        ok: 3,
        exempt: 4,
      };
      const diff = order[a.statut] - order[b.statut];
      if (diff !== 0) return diff;
      // À statut égal : urgence par jours restants
      if (a.joursAvantControle !== null && b.joursAvantControle !== null) {
        return a.joursAvantControle - b.joursAvantControle;
      }
      return a.clientName.localeCompare(b.clientName);
    });
}

export type EquipementStats = {
  total: number;
  enRetard: number;
  aProgrammer: number;
  ok: number;
  jamais: number;
  exempt: number;
};

export function getEquipementStats(items: EquipementWithStatus[]): EquipementStats {
  return {
    total: items.length,
    enRetard: items.filter((i) => i.statut === "en_retard").length,
    aProgrammer: items.filter((i) => i.statut === "a_programmer").length,
    ok: items.filter((i) => i.statut === "ok").length,
    jamais: items.filter((i) => i.statut === "jamais").length,
    exempt: items.filter((i) => i.statut === "exempt").length,
  };
}

const STATUT_LABELS: Record<ControleStatut, string> = {
  en_retard: "EN RETARD",
  a_programmer: "A PROGRAMMER",
  jamais: "JAMAIS CONTROLE",
  ok: "A JOUR",
  exempt: "EXEMPTE",
};

function escapeCsv(s: string): string {
  // Si la valeur contient ;, ", ou newline → wrap dans des guillemets et double les guillemets
  if (/[;"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmtIsoDateFR(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/**
 * Export CSV du parc équipements — format français (séparateur `;`).
 * Compatible Excel FR avec BOM UTF-8.
 * Inclut tous les champs métier + statut calculé + planning contrôles.
 */
export function equipementsToCsv(items: EquipementWithStatus[]): string {
  const sep = ";";
  const headers = [
    "Client",
    "Site / Adresse",
    "Modele",
    "N° de serie",
    "Fluide",
    "GWP",
    "Charge (kg)",
    "Eq. CO2 (tonnes)",
    "Detecteur fixe",
    "Frequence controle (mois)",
    "Dernier controle",
    "Prochain controle",
    "Jours avant controle",
    "Statut",
    "Notes",
    "Date d'ajout",
  ];

  const lines = [headers.join(sep)];

  for (const eq of items) {
    const row = [
      escapeCsv(eq.clientName),
      escapeCsv(eq.siteAdresse ?? ""),
      escapeCsv(eq.modele),
      escapeCsv(eq.numeroSerie),
      eq.fluide.code,
      eq.fluide.gwp.toString(),
      eq.chargeKg.toFixed(2).replace(".", ","),
      eq.tCO2eq.toFixed(3).replace(".", ","),
      eq.detecteurFixe ? "OUI" : "NON",
      eq.frequenceMois !== null ? eq.frequenceMois.toString() : "",
      fmtIsoDateFR(eq.dernierControleISO),
      fmtIsoDateFR(eq.prochainControleISO),
      eq.joursAvantControle !== null ? eq.joursAvantControle.toString() : "",
      STATUT_LABELS[eq.statut],
      escapeCsv(eq.notes ?? ""),
      fmtIsoDateFR(eq.createdAt),
    ];
    lines.push(row.join(sep));
  }

  // BOM UTF-8 pour qu'Excel ouvre directement en UTF-8 (évite les é cassés)
  return "﻿" + lines.join("\n") + "\n";
}
