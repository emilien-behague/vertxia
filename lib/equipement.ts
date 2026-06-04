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
import { uuid } from "./uuid";

export type UniteInterieureType =
  | "cassette_plafond"
  | "cassette_4_voies"
  | "cassette_1_voie"
  | "murale"
  | "gainable"
  | "plafonnier"
  | "console"
  | "vitrine_murale"
  | "chambre_froide_positive"
  | "chambre_froide_negative";

export const UNITE_INTERIEURE_LABELS: Record<UniteInterieureType, string> = {
  cassette_plafond: "Cassette plafond",
  cassette_4_voies: "Cassette 4 voies",
  cassette_1_voie: "Cassette 1 voie",
  murale: "Murale (split)",
  gainable: "Gainable",
  plafonnier: "Plafonnier",
  console: "Console",
  vitrine_murale: "Vitrine murale",
  chambre_froide_positive: "Chambre froide +",
  chambre_froide_negative: "Chambre froide –",
};

export type UniteInterieure = {
  type: UniteInterieureType;
  modele: string;
  numeroSerie: string;
  /** Localisation optionnelle (ex: "Chambre 12", "Cuisine froid+") */
  emplacement?: string;
};

export type StoredEquipement = {
  id: string;
  createdAt: string;
  clientName: string;
  /** Email du client final — utilisé pour les emails de relance avant échéance contrôle */
  clientEmail?: string;
  /** Téléphone du client final — affiché dans la fiche pour rappel rapide */
  clientTelephone?: string;
  siteAdresse?: string;
  /** Modèle de l'unité extérieure (le compresseur qui porte la charge fluide) */
  modele: string;
  /** N°série de l'unité extérieure (identifiant principal de l'installation) */
  numeroSerie: string;
  fluide: { code: string; label: string; gwp: number };
  chargeKg: number;
  /** Détecteur fixe de fuites installé → divise par 2 la fréquence requise */
  detecteurFixe: boolean;
  /** Date du dernier contrôle d'étanchéité (ISO). Si vide : jamais contrôlé. */
  dernierControleISO?: string;
  /** Unités intérieures rattachées au système (split multi, VRV/VRF, centrale commerciale).
   *  La charge fluide est globale au circuit, mais chaque unité a son propre n°série
   *  important pour le SAV et le suivi garantie (info terrain frigo pro). */
  unitesInterieures?: UniteInterieure[];
  notes?: string;
  /** Présent uniquement pour les équipements PARTAGÉS via lien magique d'un
   *  confrère. ISO date d'expiration du grant (= eq disparaît du parc local
   *  une fois expiré). Absent pour les équipements créés par l'owner. */
  sharedExpiresAt?: string;
};

/** Fenêtre par défaut pour la relance client avant le prochain contrôle réglementaire.
 *  Validée 02/06/2026 par retour terrain frigo pro (père d'Emilien). */
export const RELANCE_WINDOW_DAYS = 30;

export type ControleStatut =
  | "exempt"
  | "ok"
  | "a_programmer"
  | "a_relancer"
  | "en_retard"
  | "jamais";

export type EquipementWithStatus = StoredEquipement & {
  tCO2eq: number;
  frequenceMois: number | null;
  prochainControleISO: string | null;
  statut: ControleStatut;
  joursAvantControle: number | null;
  isHFO: boolean;
};

import { scopedKey } from "@/lib/user-scope";

const STORAGE_KEY_BASE = "vertxia:equipements";
function storageKey(): string {
  return scopedKey(STORAGE_KEY_BASE);
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function listEquipements(): StoredEquipement[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredEquipement[];
    if (!Array.isArray(parsed)) return [];
    // Auto-cleanup : retire les eq partagés dont le grant a expiré.
    // L'eq disparaît du parc du confrère sans action manuelle.
    const now = Date.now();
    const filtered = parsed.filter((e) => {
      if (!e.sharedExpiresAt) return true; // pas un partagé → on garde
      return new Date(e.sharedExpiresAt).getTime() > now;
    });
    if (filtered.length !== parsed.length) {
      // Persiste le nettoyage pour éviter de refiltrer à chaque appel
      localStorage.setItem(storageKey(), JSON.stringify(filtered));
    }
    return filtered;
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
    id: uuid(),
    createdAt: new Date().toISOString(),
  };
  const all = listEquipements();
  all.unshift(entry);
  localStorage.setItem(storageKey(), JSON.stringify(all));
  // Sync background vers Supabase pour partage public (scan QR)
  // Import dynamique pour éviter cycles d'import + lazy load Supabase client
  import("@/lib/public-sync")
    .then((m) => m.syncEquipementToSupabase(entry))
    .catch(() => {});
  return entry;
}

export function updateEquipement(id: string, patch: Partial<StoredEquipement>): void {
  if (!isBrowser()) return;
  const all = listEquipements().map((e) => (e.id === id ? { ...e, ...patch } : e));
  localStorage.setItem(storageKey(), JSON.stringify(all));
  const updated = all.find((e) => e.id === id);
  if (updated) {
    import("@/lib/public-sync")
      .then((m) => m.syncEquipementToSupabase(updated))
      .catch(() => {});
  }
}

export function deleteEquipement(id: string): void {
  if (!isBrowser()) return;
  const filtered = listEquipements().filter((e) => e.id !== id);
  localStorage.setItem(storageKey(), JSON.stringify(filtered));
}

/**
 * Insère un équipement EXISTANT (avec son ID original) dans le parc local
 * du visiteur. Utilisé quand un confrère redeem un lien magique : l'équipement
 * apparaît alors dans son /m/equipements sans dupliquer l'ID dans Supabase.
 *
 * Si l'eq existe déjà localement (même ID) → met à jour les champs.
 * Sinon → l'ajoute.
 *
 * Ne déclenche PAS le sync Supabase (le visiteur n'est pas owner, l'upsert
 * Supabase serait refusé par RLS de toute façon).
 */
export function upsertEquipementInPark(eq: StoredEquipement): void {
  if (!isBrowser()) return;
  const all = listEquipements();
  const idx = all.findIndex((e) => e.id === eq.id);
  if (idx >= 0) {
    all[idx] = eq;
  } else {
    all.unshift(eq);
  }
  localStorage.setItem(storageKey(), JSON.stringify(all));
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
    else if (jours <= RELANCE_WINDOW_DAYS) statut = "a_relancer";
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
      // Tri : en_retard → a_relancer → a_programmer → jamais → ok → exempt
      const order: Record<ControleStatut, number> = {
        en_retard: 0,
        a_relancer: 1,
        a_programmer: 2,
        jamais: 3,
        ok: 4,
        exempt: 5,
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
  aRelancer: number;
  aProgrammer: number;
  ok: number;
  jamais: number;
  exempt: number;
};

export function getEquipementStats(items: EquipementWithStatus[]): EquipementStats {
  return {
    total: items.length,
    enRetard: items.filter((i) => i.statut === "en_retard").length,
    aRelancer: items.filter((i) => i.statut === "a_relancer").length,
    aProgrammer: items.filter((i) => i.statut === "a_programmer").length,
    ok: items.filter((i) => i.statut === "ok").length,
    jamais: items.filter((i) => i.statut === "jamais").length,
    exempt: items.filter((i) => i.statut === "exempt").length,
  };
}

// ─── Détection des infractions réglementaires F-Gas ────────────────────
// Liste les équipements en non-conformité avec le règlement UE 2024/573 et
// le décret F-Gas FR. Critères V1 :
//  - Contrôle d'étanchéité dépassé (statut "en_retard")
//  - Équipement ≥ 5 tCO2eq jamais contrôlé (statut "jamais")
//
// Évolutions V2 envisagées : R-22 rechargé (interdit), R-410A neuf < 12 kW
// post-2025, R-404A neuf ≥ 40 tCO2eq post-2020, attestation cat I-V expirée.

export type InfractionSeverite = "critique" | "haute" | "moyenne";

export type Infraction = {
  equipement: EquipementWithStatus;
  raison: string;
  /** Action concrète à mener pour résoudre l'infraction */
  actionRecommandee: string;
  severite: InfractionSeverite;
  /** Référence textuelle de l'article réglementaire violé */
  articleRef: string;
};

/**
 * Retourne la liste des équipements en infraction réglementaire, classée
 * par sévérité (critique > haute > moyenne) puis par ancienneté du retard.
 */
export function getInfractions(equipements: EquipementWithStatus[]): Infraction[] {
  const out: Infraction[] = [];

  for (const eq of equipements) {
    if (eq.statut === "en_retard") {
      const jours =
        eq.joursAvantControle !== null ? Math.abs(eq.joursAvantControle) : 0;
      const severite: InfractionSeverite =
        jours > 180 ? "critique" : jours > 90 ? "haute" : "moyenne";
      out.push({
        equipement: eq,
        raison: `Contrôle d'étanchéité en retard de ${jours} jour${jours > 1 ? "s" : ""}`,
        actionRecommandee:
          "Programmer un contrôle d'étanchéité immédiat + remettre le CERFA 15497*04 au détenteur",
        severite,
        articleRef: "Règlement UE 2024/573 art. 5",
      });
    } else if (eq.statut === "jamais") {
      out.push({
        equipement: eq,
        raison: `Jamais contrôlé — équipement soumis à contrôle obligatoire (${eq.tCO2eq.toFixed(1)} tCO2eq)`,
        actionRecommandee:
          "Réaliser un contrôle d'étanchéité initial + démarrer le suivi périodique",
        severite: "haute",
        articleRef: "Règlement UE 2024/573 art. 5",
      });
    }
  }

  const severiteOrder: Record<InfractionSeverite, number> = {
    critique: 0,
    haute: 1,
    moyenne: 2,
  };
  out.sort((a, b) => {
    const diff = severiteOrder[a.severite] - severiteOrder[b.severite];
    if (diff !== 0) return diff;
    // À sévérité égale, on remonte les retards les plus anciens
    const ja = a.equipement.joursAvantControle ?? 0;
    const jb = b.equipement.joursAvantControle ?? 0;
    return ja - jb;
  });

  return out;
}

/**
 * Génère un mailto: URL pour relancer le client avant l'échéance du contrôle.
 * Pré-rempli avec destinataire (clientEmail), CC technicien, objet, et corps complet.
 * L'utilisateur clique → app Mail iPhone s'ouvre → tap Envoyer.
 */
export function buildRelanceMailto(args: {
  eq: EquipementWithStatus;
  technicienEmail?: string;
  technicienRaisonSociale?: string;
  technicienNumeroAttestation?: string;
  technicienTelephone?: string;
}): string {
  const { eq, technicienEmail, technicienRaisonSociale, technicienNumeroAttestation, technicienTelephone } = args;

  const fmtFR = (iso: string | null | undefined): string => {
    if (!iso) return "non renseigné";
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const to = eq.clientEmail ?? "";
  const cc = technicienEmail ?? "";

  const subject = `Rappel : contrôle d'étanchéité réglementaire de votre installation ${eq.modele} à programmer`;

  const lines = [
    `Bonjour,`,
    ``,
    `Conformément au règlement UE 2024/573 (anciennement règlement 517/2014), votre installation de réfrigération nécessite un contrôle d'étanchéité réglementaire.`,
    ``,
    `Référence de l'installation :`,
    `• Modèle : ${eq.modele}`,
    `• N° de série : ${eq.numeroSerie}`,
    `• Fluide : ${eq.fluide.code} (GWP ${eq.fluide.gwp.toLocaleString("fr-FR")})`,
    `• Charge nominale : ${eq.chargeKg.toFixed(2).replace(".", ",")} kg (${eq.tCO2eq.toFixed(2).replace(".", ",")} tonnes éq. CO₂)`,
    eq.siteAdresse ? `• Site : ${eq.siteAdresse}` : "",
    eq.unitesInterieures && eq.unitesInterieures.length > 0
      ? `• Unités intérieures rattachées : ${eq.unitesInterieures.length}`
      : "",
    ``,
    `Historique :`,
    `• Dernier contrôle : ${fmtFR(eq.dernierControleISO)}`,
    `• Prochain contrôle requis avant le : ${fmtFR(eq.prochainControleISO)}`,
    `• Fréquence : tous les ${eq.frequenceMois} mois`,
    ``,
    `Je vous remercie de me recontacter pour planifier cette intervention dans les meilleurs délais. Vous pouvez me joindre directement${technicienTelephone ? ` au ${technicienTelephone}` : ""}${technicienEmail ? ` ou par retour de mail` : ""}.`,
    ``,
    `Cordialement,`,
    technicienRaisonSociale ?? "",
    technicienNumeroAttestation ? `Attestation F-Gas n° ${technicienNumeroAttestation}` : "",
    technicienTelephone ?? "",
    technicienEmail ?? "",
  ].filter(Boolean);

  const body = lines.join("\n");

  const params = new URLSearchParams();
  if (cc) params.set("cc", cc);
  params.set("subject", subject);
  params.set("body", body);

  return `mailto:${encodeURIComponent(to)}?${params.toString().replace(/\+/g, "%20")}`;
}

const STATUT_LABELS: Record<ControleStatut, string> = {
  en_retard: "EN RETARD",
  a_relancer: "RELANCE CLIENT",
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
    "Modele unite exterieure",
    "N° serie unite exterieure",
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
    "Nb unites interieures",
    "Detail unites interieures",
    "Notes",
    "Date d'ajout",
  ];

  const lines = [headers.join(sep)];

  for (const eq of items) {
    const unites = eq.unitesInterieures ?? [];
    const unitesDetail = unites
      .map((u) => {
        const label = UNITE_INTERIEURE_LABELS[u.type];
        const emp = u.emplacement ? ` ${u.emplacement}` : "";
        return `${label} ${u.modele} (SN:${u.numeroSerie}${emp})`;
      })
      .join(" | ");
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
      unites.length.toString(),
      escapeCsv(unitesDetail),
      escapeCsv(eq.notes ?? ""),
      fmtIsoDateFR(eq.createdAt),
    ];
    lines.push(row.join(sep));
  }

  // BOM UTF-8 pour qu'Excel ouvre directement en UTF-8 (évite les é cassés)
  return "﻿" + lines.join("\n") + "\n";
}
