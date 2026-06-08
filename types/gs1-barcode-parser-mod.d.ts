// Declaration de module pour gs1-barcode-parser-mod (npm 1.0.7, MIT).
// La lib upstream n'a pas de types officiels. On declare uniquement la
// surface qu'on utilise dans web/lib/equipement/gs1-parser.ts.

declare module "gs1-barcode-parser-mod" {
  export type ParsedCodeItem = {
    /** Application Identifier GS1 (ex: "01" = GTIN, "10" = batch, "3103" = poids net kg) */
    ai: string;
    /** Titre humain de l'AI (ex: "GTIN", "BATCH/LOT", "NET WEIGHT (kg)") */
    dataTitle: string;
    /** Valeur decodee : string par defaut, number pour les poids, Date pour les dates */
    data: string | number | Date;
    /** Unite (ex: "KGM" pour kilogrammes) */
    unit: string;
    /** Valeur brute avant interpretation */
    raw: string;
  };

  export type ParseBarcodeResult = {
    codeName: string;
    parsedCodeItems: ParsedCodeItem[];
  };

  export function parseBarcode(barcode: string): ParseBarcodeResult;
}
