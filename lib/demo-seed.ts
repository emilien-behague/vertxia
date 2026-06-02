"use client";

// Seed démo CAPEB — population complète du localStorage avec un parc client crédible
// pour les démonstrations terrain (RDV CAPEB 65/64 25 juin, JL, prospects).
//
// Couvre les 5 statuts visuels (en_retard, a_programmer, jamais, ok, exempt),
// 5 fluides différents et 5 typologies de clients HVAC français pour montrer
// l'étendue du produit en une seule vue.

import { saveEquipement, type StoredEquipement } from "@/lib/equipement";
import { saveIntervention } from "@/lib/intervention-storage";
import { saveProfil, EMPTY_PROFIL } from "@/lib/profil";

const STORAGE_KEYS = [
  "vertxia:equipements",
  "vertxia:interventions",
  "vertxia:profil",
  "vertxia:syderep:manualInputs",
];

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function yearsAgoIso(years: number, extraDays = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() - extraDays);
  return d.toISOString();
}

// Vide tout localStorage Vertxia — pratique pour reset avant démo.
export function clearAllVertxiaData(): void {
  if (typeof localStorage === "undefined") return;
  for (const key of STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}

// Profil entreprise démo — réaliste mais générique (pas de SIRET/numéros réels).
const DEMO_PROFIL = {
  raisonSociale: "Vertxia Frigorifique",
  siret: "12345678901234",
  adresseRue: "12 avenue de la République",
  adresseCp: "83000",
  adresseVille: "Toulon",
  telephone: "04 94 00 00 00",
  email: "contact@vertxia-demo.fr",
  siteWeb: "https://vertxia.com",
  numeroAttestation: "FR-CAT1-DEMO-2026",
  categorieAttestation: "I" as const,
  organismeAgree: "Dekra" as const,
  dateExpirationAttestation: yearsAgoIso(-3),
  numeroRecepisseTransport: "TVD-83-2026-0042",
  logoDataUrl: undefined,
  signatureDataUrl: undefined,
};

// 5 équipements couvrant tous les statuts + 5 typologies métier HVAC.
type SeedEquipement = Omit<StoredEquipement, "id" | "createdAt">;

const DEMO_EQUIPEMENTS: SeedEquipement[] = [
  // 1. HÔTELLERIE — VRV grosse charge, contrôle en retard (cas rouge prioritaire)
  {
    clientName: "Hôtel Le Provençal",
    clientEmail: "direction@hotel-leprovencal.fr",
    clientTelephone: "04 94 41 23 45",
    siteAdresse: "8 boulevard de la Plage, 83000 Toulon",
    modele: "Daikin VRV V RWEYQ16T7Y1B",
    numeroSerie: "DK24VRV16001",
    fluide: { code: "R-410A", label: "R-410A (HFC)", gwp: 2088 },
    chargeKg: 16,
    detecteurFixe: false,
    dernierControleISO: daysAgoIso(420),
    unitesInterieures: [
      { type: "cassette_plafond", modele: "Daikin FXFA32A", numeroSerie: "DK24F32A101", emplacement: "Chambre 12" },
      { type: "cassette_plafond", modele: "Daikin FXFA32A", numeroSerie: "DK24F32A102", emplacement: "Chambre 14" },
      { type: "cassette_plafond", modele: "Daikin FXFA32A", numeroSerie: "DK24F32A103", emplacement: "Chambre 18" },
      { type: "cassette_plafond", modele: "Daikin FXFA32A", numeroSerie: "DK24F32A104", emplacement: "Chambre 22" },
      { type: "cassette_plafond", modele: "Daikin FXFA40A", numeroSerie: "DK24F40A201", emplacement: "Suite 30" },
      { type: "cassette_plafond", modele: "Daikin FXFA40A", numeroSerie: "DK24F40A202", emplacement: "Suite 32" },
      { type: "cassette_4_voies", modele: "Daikin FXFQ50A", numeroSerie: "DK24F50A301", emplacement: "Salon réception" },
      { type: "gainable", modele: "Daikin FXSQ50A", numeroSerie: "DK24SQ50A001", emplacement: "Couloir étage 1" },
    ],
    notes: "Climatisation centralisée 48 chambres — installation 2018",
  },
  // 2. RESTAURATION — froid négatif, RELANCE CLIENT à programmer dans ~15 jours (orange clair)
  // Cas démo pour la feature "1 mois avant contrôle" — alimente le bouton mailto
  {
    clientName: "Restaurant Marius",
    clientEmail: "contact@restaurant-marius-hyeres.fr",
    clientTelephone: "04 94 65 78 12",
    siteAdresse: "Port d'Hyères, 83400 Hyères",
    modele: "Frigopol PG-FNB-080",
    numeroSerie: "FP25NB080034",
    fluide: { code: "R-404A", label: "R-404A (HFC)", gwp: 3922 },
    chargeKg: 8,
    detecteurFixe: false,
    dernierControleISO: daysAgoIso(165),
    notes: "Chambre froide négative cuisine — produits de la mer",
  },
  // 3. MÉDICAL — PAC R-32 faible charge, EXEMPTÉ (gris, pédagogique)
  {
    clientName: "Cabinet Médical Saint-Roch",
    clientEmail: "secretariat@cabinet-saintroch.fr",
    clientTelephone: "04 94 92 11 47",
    siteAdresse: "27 rue Saint-Roch, 83000 Toulon",
    modele: "Mitsubishi PUHZ-ZRP100YKA",
    numeroSerie: "MS25PUHZ100012",
    fluide: { code: "R-32", label: "R-32 (HFC)", gwp: 675 },
    chargeKg: 2.8,
    detecteurFixe: false,
    dernierControleISO: undefined,
    unitesInterieures: [
      { type: "murale", modele: "Mitsubishi MSZ-AP25VG", numeroSerie: "MS25AP25001", emplacement: "Salle d'attente" },
      { type: "murale", modele: "Mitsubishi MSZ-AP25VG", numeroSerie: "MS25AP25002", emplacement: "Cabinet Dr. Martin" },
      { type: "murale", modele: "Mitsubishi MSZ-AP25VG", numeroSerie: "MS25AP25003", emplacement: "Cabinet Dr. Dubois" },
      { type: "murale", modele: "Mitsubishi MSZ-AP25VG", numeroSerie: "MS25AP25004", emplacement: "Cabinet Dr. Leclerc" },
    ],
    notes: "Climatisation salle d'attente + 3 cabinets de consultation",
  },
  // 4. ARTISANAT — contrôle À JOUR (vert)
  {
    clientName: "Boulangerie Pain & Co",
    clientEmail: "boulangerie.painco@gmail.com",
    clientTelephone: "04 94 87 23 09",
    siteAdresse: "14 cours Louis Blanc, 83500 La Seyne-sur-Mer",
    modele: "Carrier 38VYX-040",
    numeroSerie: "CR25VYX040018",
    fluide: { code: "R-407C", label: "R-407C (HFC)", gwp: 1774 },
    chargeKg: 5.5,
    detecteurFixe: true,
    dernierControleISO: daysAgoIso(45),
    notes: "Climatisation laboratoire fabrication — détecteur fixe NH3 secondaire",
  },
  // 5. GMS — JAMAIS contrôlé (bleu, urgence absolue)
  {
    clientName: "Supermarché Spar — Cap Couronne",
    clientEmail: "direction.spar-capcouronne@franchise.fr",
    clientTelephone: "04 94 75 30 88",
    siteAdresse: "Avenue du 8 Mai 1945, 83130 La Garde",
    modele: "Bitzer 4PES-15Y centrale froid commercial",
    numeroSerie: "BZ26FCC15022",
    fluide: { code: "R-449A", label: "R-449A (HFC)", gwp: 1397 },
    chargeKg: 22,
    detecteurFixe: false,
    dernierControleISO: undefined,
    unitesInterieures: [
      { type: "vitrine_murale", modele: "Costan Tortuga V2", numeroSerie: "CO26TV2001", emplacement: "Rayon BOF — allée 1" },
      { type: "vitrine_murale", modele: "Costan Tortuga V2", numeroSerie: "CO26TV2002", emplacement: "Rayon BOF — allée 2" },
      { type: "vitrine_murale", modele: "Costan Tortuga V2", numeroSerie: "CO26TV2003", emplacement: "Charcuterie" },
      { type: "vitrine_murale", modele: "Costan Mirage L", numeroSerie: "CO26ML001", emplacement: "Boissons fraîches" },
      { type: "chambre_froide_positive", modele: "Profroid Hubbard E18", numeroSerie: "PF26E18001", emplacement: "Chambre fruits/légumes" },
      { type: "chambre_froide_positive", modele: "Profroid Hubbard E18", numeroSerie: "PF26E18002", emplacement: "Chambre laitages" },
      { type: "chambre_froide_negative", modele: "Profroid Hubbard N12", numeroSerie: "PF26N12001", emplacement: "Chambre surgelés" },
    ],
    notes: "Nouveau client (mai 2026) — centrale rayon frais + meubles vitrines",
  },
];

// Quelques interventions historiques pour que /historique et /syderep ne soient pas vides.
const DEMO_INTERVENTIONS = [
  // Contrôle étanchéité réussi chez la boulangerie (lié auto via numeroSerie)
  {
    typeIntervention: "controle_periodique" as const,
    fluide: { code: "R-407C", label: "R-407C (HFC)", gwp: 1774 },
    weight: 0,
    packagingNumero: "",
    clientName: "Boulangerie Pain & Co",
    modeleEquipement: "Carrier 38VYX-040",
    numeroSerieEquipement: "CR25VYX040018",
    lieuIntervention: "14 cours Louis Blanc, 83500 La Seyne-sur-Mer",
    attestation: "FR-CAT1-DEMO-2026",
    controleDetails: {
      detecteurId: "DTC-T1-007",
      detecteurPermanent: true,
      fuiteDetectee: false,
    },
  },
  // Récupération fluide R-22 chez ancien client (démantèlement réglementaire)
  {
    typeIntervention: "recuperation" as const,
    fluide: { code: "R-22", label: "R-22 (HCFC — interdit)", gwp: 1810 },
    weight: 3.2,
    packagingNumero: "B112026047",
    clientName: "Garage Auto Central — Toulon",
    modeleEquipement: "Climatisation atelier (matériel 1998)",
    numeroSerieEquipement: "OLD22-001",
    lieuIntervention: "5 rue de l'Artisanat, 83000 Toulon",
    attestation: "FR-CAT1-DEMO-2026",
    bsffId: "BSFF-DEMO-001",
    bsffSignedAt: daysAgoIso(15),
  },
];

// Seed complet — appelable avant une démo CAPEB pour repartir d'un état propre + crédible.
export function seedDemoCapeb(): { equipements: number; interventions: number } {
  clearAllVertxiaData();

  // Profil entreprise
  saveProfil({ ...EMPTY_PROFIL, ...DEMO_PROFIL });

  // Équipements
  let countEq = 0;
  for (const eq of DEMO_EQUIPEMENTS) {
    saveEquipement(eq);
    countEq += 1;
  }

  // Interventions
  let countInt = 0;
  for (const i of DEMO_INTERVENTIONS) {
    saveIntervention(i);
    countInt += 1;
  }

  return { equipements: countEq, interventions: countInt };
}
