// Parser GS1 pour codes-barres bouteilles fluide frigorigene.
//
// Probleme adresse : la lib gs1-barcode-parser-mod (1.0.7) parse aveuglement
// les chiffres en cherchant n'importe quel AI matching. Sur des codes
// PROPRIETAIRES non-GS1 (Linde Sentry 14 chiffres, Air Liquide SERVITRAX,
// codes courts type "490229"), ca produit des faux positifs (ex : 25031101776806
// parse comme AI 250 SECONDARY SERIAL = "31101776806" — totalement faux,
// Linde Sentry n'utilise PAS GS1).
//
// Notre approche : DETECTER d'abord le format reel avant de parser :
//  - format "gs1-standard" : commence par AI 01 (GTIN-14) avec MOD10 valide
//                            -> on parse avec la lib, on extrait les AIs utiles
//  - format "gs1-sscc"     : commence par AI 00 (SSCC, 18 chiffres apres)
//  - format "proprietaire" : tout le reste (Linde Sentry, codes courts...)
//                            -> on stocke brut + heuristique date YYMMDD
//
// Source rapport recherche 10 agents 08/06/2026 :
// - GS1 standards : ref.gs1.org/ai/
// - Linde Sentry pattern : codes 14 chiffres invalides MOD10, format
//   YYMMDD + serial proprietaire (cf. linde-gaz.pl/icc-system.html).

import { parseBarcode } from "gs1-barcode-parser-mod";

export type ParsedBarcodeFormat =
  | "gs1-standard"  // AI 01 GTIN valide MOD10 + AIs additionnels
  | "gs1-sscc"      // AI 00 SSCC
  | "proprietary"   // Code fournisseur non-GS1 (Linde Sentry, SERVITRAX...)
  | "invalid";      // Code trop court ou non-numerique

export type ParsedBarcodeResult = {
  format: ParsedBarcodeFormat;
  raw: string;
  /** GTIN-14 valide MOD10 si format gs1-standard, sinon null */
  gtin: string | null;
  /** Lot/batch (AI 10) — variable, alphanum jusqu'a 20 chars */
  lot: string | null;
  /** Date d'expiration (AI 17) ISO YYYY-MM-DD */
  dateExpirationISO: string | null;
  /** Date de production (AI 11) ISO YYYY-MM-DD */
  dateProductionISO: string | null;
  /** Serial bouteille (AI 21) */
  serial: string | null;
  /** Poids net en kg (AI 3100-3109) — c'est la charge fluide actuelle */
  poidsNetKg: number | null;
  /** Code pays origine (AI 422) — code ISO numerique 3 chiffres */
  paysOrigineISO: string | null;
  /** Si format = proprietaire : date probable extraite par heuristique YYMMDD */
  dateProbableISO: string | null;
  /** Si format = proprietaire : numero de serie devine (partie apres date) */
  serialProbable: string | null;
  /** Si GS1 standard, validation MOD10 du GTIN */
  validMOD10: boolean;
};

const AI_WHITELIST = new Set([
  "00",   // SSCC
  "01",   // GTIN-14
  "10",   // BATCH/LOT
  "11",   // PROD DATE
  "13",   // PACK DATE
  "15",   // BEST BEFORE
  "17",   // USE BY / EXPIRY
  "21",   // SERIAL
  "240",  // ADDITIONAL ITEM
  "310",  // NET WEIGHT (kg) base
  "320",  // NET WEIGHT (lb) base
  "330",  // GROSS WEIGHT (kg) base
  "3100", "3101", "3102", "3103", "3104", "3105", "3106", "3107", "3108", "3109",
  "3300", "3301", "3302", "3303", "3304", "3305", "3306", "3307", "3308", "3309",
  "422",  // COUNTRY OF ORIGIN
  "7003", // EXPIRY DATE/TIME
]);

/** Calcule le check digit MOD10 d'un GTIN-14 (sur les 13 premiers chiffres).
 *  Algorithme : somme ponderee 3-1-3-1-... a partir de la droite,
 *  check digit = (10 - somme % 10) % 10. */
function computeGtinCheckDigit(gtin13: string): number {
  if (!/^\d{13}$/.test(gtin13)) return -1;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const d = parseInt(gtin13[i], 10);
    // Position from right (1-indexed) : if odd from right, *3, else *1
    // gtin13[12] = position 1 from right = *3
    // gtin13[11] = position 2 from right = *1
    const posFromRight = 13 - i;
    sum += d * (posFromRight % 2 === 1 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** Valide qu'un GTIN-14 a un check digit correct. */
export function isValidGTIN14(gtin: string): boolean {
  if (!/^\d{14}$/.test(gtin)) return false;
  const expected = computeGtinCheckDigit(gtin.slice(0, 13));
  return expected === parseInt(gtin[13], 10);
}

/** Heuristique date YYMMDD : retourne YYYY-MM-DD si les 6 premiers chiffres
 *  forment une date plausible (AA = 20-29 => 2020-2029, MM = 01-12, JJ = 01-31). */
function tryExtractDateYYMMDD(raw: string): string | null {
  if (raw.length < 6) return null;
  const ymd = raw.slice(0, 6);
  if (!/^\d{6}$/.test(ymd)) return null;
  const yy = parseInt(ymd.slice(0, 2), 10);
  const mm = parseInt(ymd.slice(2, 4), 10);
  const dd = parseInt(ymd.slice(4, 6), 10);
  // Heuristique : annee 2020-2029 (sera a etendre apres 2030)
  if (yy < 20 || yy > 35) return null;
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  return `20${ymd.slice(0, 2)}-${ymd.slice(2, 4)}-${ymd.slice(4, 6)}`;
}

const EMPTY: Omit<ParsedBarcodeResult, "raw" | "format"> = {
  gtin: null,
  lot: null,
  dateExpirationISO: null,
  dateProductionISO: null,
  serial: null,
  poidsNetKg: null,
  paysOrigineISO: null,
  dateProbableISO: null,
  serialProbable: null,
  validMOD10: false,
};

type LibItem = {
  ai: string;
  data: string | number | Date;
  raw?: string;
};

/** Convertit la sortie de gs1-barcode-parser-mod en notre format structure. */
function applyParsedItems(
  items: LibItem[],
  out: ParsedBarcodeResult
): void {
  for (const item of items) {
    if (!AI_WHITELIST.has(item.ai)) continue; // Ignorer AIs hors whitelist
    switch (item.ai) {
      case "01":
        out.gtin = String(item.data);
        out.validMOD10 = typeof item.data === "string" && isValidGTIN14(item.data);
        break;
      case "10":
        out.lot = String(item.data);
        break;
      case "11": {
        const d = item.data instanceof Date ? item.data.toISOString().slice(0, 10) : null;
        out.dateProductionISO = d;
        break;
      }
      case "17": {
        const d = item.data instanceof Date ? item.data.toISOString().slice(0, 10) : null;
        out.dateExpirationISO = d;
        break;
      }
      case "21":
        out.serial = String(item.data);
        break;
      case "422":
        out.paysOrigineISO = String(item.data);
        break;
      default:
        // AI 3100-3109 (poids net kg avec decimales implicites)
        if (item.ai.startsWith("310") && typeof item.data === "number") {
          out.poidsNetKg = item.data;
        }
        break;
    }
  }
}

/** Parse un code-barres brut. Retourne TOUJOURS un objet structure
 *  (jamais d'exception, fallback gracieux sur "invalid"). */
export function parseGS1Barcode(raw: string): ParsedBarcodeResult {
  const clean = raw.trim();
  const out: ParsedBarcodeResult = {
    format: "invalid",
    raw: clean,
    ...EMPTY,
  };

  if (clean.length < 4) return out;

  // Cas 1 : commence par "01" + 14 chiffres = GS1 standard avec GTIN
  // (potentiellement suivi d'autres AIs)
  if (clean.startsWith("01") && clean.length >= 16 && /^\d{16}/.test(clean)) {
    const gtin = clean.slice(2, 16);
    if (isValidGTIN14(gtin)) {
      out.format = "gs1-standard";
      try {
        const parsed = parseBarcode(clean);
        applyParsedItems(parsed.parsedCodeItems as LibItem[], out);
      } catch {
        out.gtin = gtin;
        out.validMOD10 = true;
      }
      return out;
    }
  }

  // Cas 2 : commence par "00" + 18 chiffres = SSCC
  if (clean.startsWith("00") && clean.length === 20 && /^\d{20}$/.test(clean)) {
    out.format = "gs1-sscc";
    try {
      const parsed = parseBarcode(clean);
      applyParsedItems(parsed.parsedCodeItems as LibItem[], out);
    } catch {
      /* ignore */
    }
    return out;
  }

  // Cas 3 : pseudo-GTIN 14 chiffres sans AI prefix = code proprietaire
  // (ex Linde Sentry 25031101776806). On NE LE PARSE PAS comme GS1.
  if (/^\d{14}$/.test(clean)) {
    out.format = "proprietary";
    // Heuristique : si les 6 premiers chars forment une date YYMMDD plausible,
    // on l'extrait + le reste comme serial probable.
    const dateProbable = tryExtractDateYYMMDD(clean);
    if (dateProbable) {
      out.dateProbableISO = dateProbable;
      out.serialProbable = clean.slice(6); // les 8 derniers chiffres
    }
    return out;
  }

  // Cas 4 : code court (6-13 chiffres) = code proprietaire fournisseur
  // (ex Linde recup "490229", numero interne)
  if (/^\d{4,13}$/.test(clean)) {
    out.format = "proprietary";
    return out;
  }

  // Cas 5 : code alphanum (peut etre un serial gravé col, pas un code-barres)
  out.format = "proprietary";
  return out;
}
