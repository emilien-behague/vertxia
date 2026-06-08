// Scanner code-barres via html5-qrcode — librairie wrapper qui choisit auto
// le meilleur engine selon le navigateur :
//  - Chrome Android / Edge : utilise l'API BarcodeDetector native (rapide)
//  - Safari iOS / Firefox  : utilise son propre engine ZXing optimise
//
// On a teste ZXing-js seul le 08/06/2026 : sur Safari iOS la detection
// echouait sur les Code-128 GTIN-14 industriels (bouteilles Linde 14 chiffres)
// meme avec TRY_HARDER. html5-qrcode resout ce probleme avec un pipeline
// d'analyse mieux calibre pour les codes industriels.
//
// Formats supportes : Code-128, Code-39, EAN-13, EAN-8, UPC-A/E, ITF, QR,
// Data Matrix. Couvre tous les codes-barres bouteilles gaz observes terrain.

import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
  type Html5QrcodeResult,
} from "html5-qrcode";

export type BarcodeFormat =
  | "ean_13"
  | "ean_8"
  | "code_128"
  | "code_39"
  | "code_93"
  | "codabar"
  | "itf"
  | "qr_code"
  | "data_matrix"
  | "upc_a"
  | "upc_e"
  | "unknown";

/** Indique si l'API BarcodeDetector native est disponible (info debug). */
export function isBarcodeDetectorSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector !== "undefined";
}

/** Le scan est toujours possible si on a getUserMedia (camera). */
export function isScannerAvailable(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return !!navigator.mediaDevices?.getUserMedia;
}

export type ScannerConfig = {
  /** ID d'un DIV vide ou html5-qrcode injectera son video + canvas. */
  containerElementId: string;
  /** Callback declenche au premier code detecte. Le scanner s'arrete apres. */
  onDetect: (code: string, format: BarcodeFormat) => void;
  /** Callback erreur (permission refusee, etc.). */
  onError?: (err: Error) => void;
  /** Callback debug : appele frequemment pendant l'analyse pour montrer
   *  un compteur frames a l'utilisateur. Permet de diagnostiquer un scan
   *  bloque (frames=0) vs un scan qui tourne sans detecter (frames=100+). */
  onProgress?: (info: { framesAnalyzed: number; engine: string }) => void;
};

// Formats reduits AU STRICT MINIMUM pour eviter les faux positifs :
// Code-39 / Code-93 / Codabar produisent souvent un decodage faux sur un
// Code-128 GS1 (Linde 14 chiffres) car leurs grammaires sont laxistes.
// Test terrain 08/06/2026 sur Linde 25031101776806 : avec Code-39 dans la
// liste, html5-qrcode renvoyait "9#+U[FNC1]&" au lieu du vrai code.
const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

/** Nettoie un code scanne : strip les caracteres non-printables (FNC1 GS1,
 *  control chars Code-128) et valide une longueur minimale.
 *  Retourne null si le code est trop suspect (= faux positif probable,
 *  on continue de scanner). */
function cleanAndValidateScannedCode(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  // Strip tout ce qui n'est pas ASCII printable (chars 0x20-0x7E)
  // Code-128 GS1 injecte FNC1 (0xE8/0xF1 selon encoding) en prefixe, on l'enleve.
  const cleaned = raw.replace(/[^\x20-\x7E]/g, "").trim();
  if (cleaned.length < 4) return null;
  // Heuristique : un code-barres reel a au moins 4 chars printables.
  // Les faux positifs Code-39 sur Code-128 GS1 donnent souvent < 4 chars
  // utiles ou des symboles "#$%&*+-." melanges. Plus restrictif si besoin.
  return cleaned;
}

function html5FormatToOurs(formatName: string | undefined): BarcodeFormat {
  if (!formatName) return "unknown";
  // html5-qrcode renvoie typiquement "CODE_128", "EAN_13", "QR_CODE", etc.
  const key = formatName.toLowerCase();
  switch (key) {
    case "code_128": return "code_128";
    case "code_39": return "code_39";
    case "code_93": return "code_93";
    case "ean_13": return "ean_13";
    case "ean_8": return "ean_8";
    case "upc_a": return "upc_a";
    case "upc_e": return "upc_e";
    case "itf": return "itf";
    case "qr_code": return "qr_code";
    case "data_matrix": return "data_matrix";
    case "codabar": return "codabar";
    default: return "unknown";
  }
}

/** Demarre la camera arriere + boucle de detection.
 *  Retourne une fonction stop() async qui libere proprement la camera. */
export async function startBarcodeScanner(
  config: ScannerConfig
): Promise<() => Promise<void>> {
  const { containerElementId, onDetect, onError, onProgress } = config;

  if (!isScannerAvailable()) {
    const err = new Error("Camera (getUserMedia) non disponible sur ce navigateur");
    onError?.(err);
    throw err;
  }

  // Verifie que le div container existe (sinon html5-qrcode crash)
  const container = typeof document !== "undefined"
    ? document.getElementById(containerElementId)
    : null;
  if (!container) {
    const err = new Error(`Element #${containerElementId} introuvable dans le DOM`);
    onError?.(err);
    throw err;
  }

  const scanner = new Html5Qrcode(containerElementId, {
    formatsToSupport: SUPPORTED_FORMATS,
    verbose: false,
    useBarCodeDetectorIfSupported: true,
  });

  const engineName = isBarcodeDetectorSupported() ? "native" : "html5-qrcode";
  let framesAnalyzed = 0;
  let stopped = false;

  try {
    await scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        // qrbox undefined = scanne tout le viewport (mieux pour codes-barres
        // 1D longs comme les GTIN-14 Linde). Si on met une qrbox carree
        // type {width:250, height:150}, ZXing peut louper les bords du code.
        qrbox: undefined,
        aspectRatio: 1.7777, // 16:9 standard
      },
      (decodedText: string, result: Html5QrcodeResult) => {
        if (stopped) return;
        // Validation anti-faux-positif : strip non-printables + verif longueur
        const cleaned = cleanAndValidateScannedCode(decodedText);
        if (!cleaned) {
          // Decodage suspect (faux positif probable), on ignore et continue
          // a scanner sans arreter le moteur ni declencher onDetect.
          return;
        }
        stopped = true;
        const format = html5FormatToOurs(
          result.result?.format?.formatName
        );
        onDetect(cleaned, format);
      },
      (_errorMessage: string) => {
        // Appele tres souvent (= a chaque frame ou aucun code n'est trouve).
        // Sert juste a montrer un compteur de frames a l'utilisateur.
        framesAnalyzed++;
        if (onProgress && framesAnalyzed % 5 === 0) {
          onProgress({ framesAnalyzed, engine: engineName });
        }
      }
    );
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
    throw err;
  }

  return async () => {
    stopped = true;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      /* ignore */
    }
  };
}
