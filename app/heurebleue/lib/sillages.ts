/**
 * Les 6 sillages de L'Heure Bleue.
 *
 * Chaque sillage = sa propre identité visuelle (palette + géométrie signature
 * + particules signature) + sa propre signature audio (fréquence du chime).
 *
 * Référence : note culturelle française. Numen = présence sacrée (Rudolf Otto),
 * Vespre = vêpres / soir, Lumiel = lumière + Uriel, Solène = solennité,
 * Cendre = résidu sacré, Orée = lisière forestière.
 */

export type Sillage = {
  no: string; // numéro romain
  nom: string; // avec accents — pour HTML
  nomPlain: string; // sans accents — pour WordParticles (helvetiker_bold ne supporte pas È/É)
  accord: string; // les 3 notes principales
  citation: string;
  // identité visuelle
  palette: {
    bg: string; // teinte du ciel à cette chambre
    accent: string; // couleur des particules signature
    glow: string; // halo lumineux
  };
  // identité audio (Hz)
  chime: number;
  // signature 3D
  geometry: "sphere" | "torus" | "disc" | "lotus" | "stone" | "crystal";
};

export const SILLAGES: Sillage[] = [
  {
    no: "I",
    nom: "NUMEN",
    nomPlain: "NUMEN",
    accord: "Iris poudré · Encens · Cuir blanc",
    citation: "L'épiphanie d'une présence sacrée à l'aube.",
    palette: {
      bg: "#0A1A3A", // bleu nuit + nuance argent
      accent: "#E8DCC4", // ivoire sacré
      glow: "#B8A878",
    },
    chime: 880, // A5 — lumineux sacré
    geometry: "sphere",
  },
  {
    no: "II",
    nom: "VESPRE",
    nomPlain: "VESPRE",
    accord: "Rose noire · Tabac blond · Ambre gris",
    citation: "Le rite intime de la dernière heure.",
    palette: {
      bg: "#1A1028", // pourpre nuit
      accent: "#C97A4E", // ambre chaud
      glow: "#8B4513",
    },
    chime: 587, // D5 — chaud bas
    geometry: "torus",
  },
  {
    no: "III",
    nom: "LUMIEL",
    nomPlain: "LUMIEL",
    accord: "Néroli · Cire d'abeille · Vanille Madagascar",
    citation: "L'éclat doré d'un dimanche d'enfance.",
    palette: {
      bg: "#0A1B40", // bleu nuit + reflet doré
      accent: "#F5D580", // or vif
      glow: "#E8B452",
    },
    chime: 1046, // C6 — éclat doré
    geometry: "disc",
  },
  {
    no: "IV",
    nom: "SOLÈNE",
    nomPlain: "SOLENE",
    accord: "Jasmin Sambac · Bois de santal · Musc blanc",
    citation: "La promenade nue d'une nuit d'été.",
    palette: {
      bg: "#102035", // bleu glacier nuit
      accent: "#EFE8E0", // blanc lait
      glow: "#A8C4D8",
    },
    chime: 783, // G5 — cristal blanc
    geometry: "lotus",
  },
  {
    no: "V",
    nom: "CENDRE",
    nomPlain: "CENDRE",
    accord: "Vétiver fumé · Cuir russe · Oud Laos",
    citation: "Ce qui reste après que tout a brûlé.",
    palette: {
      bg: "#0F0808", // noir braise
      accent: "#A33820", // rouge braise
      glow: "#5C1A0E",
    },
    chime: 466, // Bb4 — sourd brûlé
    geometry: "stone",
  },
  {
    no: "VI",
    nom: "ORÉE",
    nomPlain: "OREE",
    accord: "Mousse de chêne · Fève tonka · Bergamote",
    citation: "La lisière exacte entre la forêt et soi.",
    palette: {
      bg: "#0A1A14", // vert nuit forêt
      accent: "#A8B878", // mousse dorée
      glow: "#5A6840",
    },
    chime: 622, // Eb5 — mousse verte
    geometry: "crystal",
  },
];

/**
 * Couleurs globales du site (entre les sillages, ciel par défaut).
 */
export const PALETTE = {
  cielBase: "#050B1F", // bleu nuit profond — couleur dominante
  cielHaut: "#0A1230", // bleu indigo plus clair en haut
  or: "#C9A668", // or vieilli (pas vif)
  orChaud: "#E8B452", // or chaud d'accent
  creme: "#EDE4D3", // texte principal
  cremeTiede: "#F4EFE5", // texte sur fond très sombre
  // texte secondaire
  cremeOmbre: "rgba(244, 239, 229, 0.45)",
  orOmbre: "rgba(201, 166, 104, 0.35)",
};

/**
 * Position Z des chambres dans la scène 3D.
 *
 * Convention : 0 = entrée, négatif = avancée dans le tunnel olfactif.
 * Espacement de 28 entre chambres pour respiration cinématique.
 */
/**
 * 12 chambres alignées 1:1 avec 12 sections HTML.
 * Spacing rigoureusement constant : -28 unités entre chambres.
 *
 * Avec startZ=0, TOTAL_DEPTH=308, SCROLL_HEIGHT_VH=1200, max scroll=1100vh,
 *   scrollRef à section X top = X/11
 *   camera_z(X/11) = -X*308/11 = -28X = CHAMBRES_Z[X]
 *
 * → la caméra LANDE EXACTEMENT sur la Z de chaque chambre au top de section.
 */
export const CHAMBRES_Z = {
  HERO: 0,
  MANIFESTO: -28,
  SILLAGE_I: -56, // NUMEN
  SILLAGE_II: -84, // VESPRE
  SILLAGE_III: -112, // LUMIEL
  SILLAGE_IV: -140, // SOLÈNE
  SILLAGE_V: -168, // CENDRE
  SILLAGE_VI: -196, // ORÉE
  PARFUMEUR: -224,
  ATELIER: -252,
  COMMANDE: -280,
  RDV: -308,
};

export const TOTAL_DEPTH = 308;
export const SCROLL_HEIGHT_VH = 1200; // 12 sections × 100vh

/**
 * Mots qui s'affichent en particules au-dessus de chaque chambre.
 * 12 entries alignées avec les 12 sections HTML.
 * IMPORTANT : sans accents (helvetiker_bold ne supporte pas È/É).
 * Apostrophe OK.
 */
export const SCROLL_WORDS = [
  "L'HEURE BLEUE", // section 0 — hero
  "L'INSTANT", // section 1 — manifesto
  "NUMEN", // section 2 — sillage I
  "VESPRE", // section 3 — sillage II
  "LUMIEL", // section 4 — sillage III
  "SOLENE", // section 5 — sillage IV
  "CENDRE", // section 6 — sillage V
  "OREE", // section 7 — sillage VI
  "ANTOINE", // section 8 — parfumeur
  "L'ATELIER", // section 9 — atelier
  "MMXXVI", // section 10 — commande
  "VENEZ", // section 11 — RDV
];

/**
 * Citation littéraire affichée au loading selon l'heure réelle de la visite.
 * Référence : Christian Bobin, Pascal Quignard, Sylvie Germain.
 */
export function getIntroByHour(hour: number): string {
  if (hour >= 0 && hour < 5) return "Tu marches dans le silence après l'heure. Reste, je te raconte.";
  if (hour >= 5 && hour < 9) return "L'aube vient. Tout commence par un silence.";
  if (hour >= 9 && hour < 16) return "Patientez. Il reste quelques heures avant que la lumière ne change de nom.";
  if (hour >= 16 && hour < 19) return "L'heure approche. Le ciel hésite déjà.";
  if (hour >= 19 && hour < 22) return "Tu arrives exactement à l'heure. Je t'attendais.";
  return "L'heure bleue est passée. Mais la maison reste ouverte aux silencieux.";
}
