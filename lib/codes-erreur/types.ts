// Types pour la base de codes erreur multi-marques HVAC.
//
// Couvre les codes constructeur les plus courants sur le marche FR/europeen
// (residentiel + tertiaire) : Daikin, Mitsubishi, Carrier, Trane, LG,
// Samsung, Toshiba, Hitachi.
//
// Chaque code est documente avec :
//  - libelle court (affichable en liste)
//  - description complete
//  - causes probables (ordonnees de la plus frequente a la plus rare)
//  - etapes de reparation (workflow simple)
//  - gravite (info | alerte | critique)
//  - systemes concernes (VRV, Split, Multi-split, PAC, etc.)
//  - sources publiques (URL constructeur ou doc technique)
//
// Source primaire = manuels constructeurs publics + sites techniques
// reconnus (coolautomation, hvactoolkit). Liste enrichie progressivement
// avec les retours frigoristes terrain.

export type CodeErreurMarque =
  | "daikin"
  | "mitsubishi"
  | "carrier"
  | "trane"
  | "lg"
  | "samsung"
  | "toshiba"
  | "hitachi"
  | "panasonic"
  | "atlantic"
  | "saunier-duval"
  | "vaillant"
  | "de-dietrich"
  | "elm-leblanc"
  | "frisquet"
  | "mitsubishi-heavy"
  | "fujitsu"
  | "bosch"
  | "chaffoteaux"
  | "stiebel-eltron";

export const CODE_ERREUR_MARQUE_LABELS: Record<CodeErreurMarque, string> = {
  daikin: "Daikin",
  mitsubishi: "Mitsubishi Electric",
  carrier: "Carrier",
  trane: "Trane",
  lg: "LG",
  samsung: "Samsung",
  toshiba: "Toshiba",
  hitachi: "Hitachi",
  panasonic: "Panasonic",
  atlantic: "Atlantic",
  "saunier-duval": "Saunier Duval",
  vaillant: "Vaillant",
  "de-dietrich": "De Dietrich",
  "elm-leblanc": "ELM Leblanc",
  frisquet: "Frisquet",
  "mitsubishi-heavy": "Mitsubishi Heavy Industries",
  fujitsu: "Fujitsu / General",
  bosch: "Bosch / Buderus",
  chaffoteaux: "Chaffoteaux",
  "stiebel-eltron": "Stiebel Eltron",
};

export type CodeErreurGravite = "info" | "alerte" | "critique";

export const CODE_ERREUR_GRAVITE_LABELS: Record<CodeErreurGravite, string> = {
  info: "Info",
  alerte: "Alerte",
  critique: "Critique",
};

export const CODE_ERREUR_GRAVITE_STYLES: Record<
  CodeErreurGravite,
  { bg: string; text: string; ring: string; dot: string }
> = {
  info: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200", dot: "bg-blue-500" },
  alerte: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", dot: "bg-amber-500" },
  critique: { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200", dot: "bg-red-600" },
};

export type CodeErreur = {
  marque: CodeErreurMarque;
  /** Code tel qu'affiche par l'unite (ex: "U4", "P1", "CH05"). Stocke en
   *  uppercase canonique. */
  code: string;
  /** Libelle court (~60 chars max) pour affichage en liste. */
  libelle: string;
  /** Description detaillee (1-3 phrases) du symptome. */
  description: string;
  /** Causes probables ordonnees de la plus frequente a la plus rare. */
  causesProbables: string[];
  /** Etapes de reparation dans l'ordre. */
  etapesReparation: string[];
  gravite: CodeErreurGravite;
  /** Systemes concernes (ex: ["VRV", "Multi-split"]). Vide = tous. */
  systemes?: string[];
  /** Modeles constructeur precis ou prefixes de gamme (ex: ["RXYSQ4T",
   *  "EHVH08", "FXFQ20A"]). Vide = code applicable a toute la marque.
   *  Matching = prefix bidirectionnel insensible casse/espaces. */
  modeles?: string[];
  /** Sources URL publiques constructeur ou doc technique. */
  sources: string[];
};

export type CodeErreurSearchHit = CodeErreur & {
  /** Score de pertinence 0-1 (1 = match exact code). */
  score: number;
  /** Type de match : exact, prefix, contains, fuzzy. */
  matchType: "exact" | "prefix" | "contains" | "fuzzy";
};
