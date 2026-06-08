// Scanner code-barres dual : utilise l'API BarcodeDetector native si dispo
// (Chrome Android/desktop, Edge) et fallback ZXing-js sinon (Safari iOS
// principalement, Firefox).
//
// Safari NE SUPPORTE PAS BarcodeDetector (toutes versions iOS confondues).
// On a teste sur iPhone iOS 18 le 08/06/2026, ecran "non supporte". D'ou
// le fallback ZXing-js obligatoire pour que ca marche en prod.
//
// Formats supportes : EAN-13, EAN-8, Code-128, Code-39, UPC-A/E, ITF, QR,
// Data Matrix. Couvre tous les codes-barres bouteilles gaz Linde, Climalife,
// Tereva observes sur photos terrain.

import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";

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

type NativeDetectedBarcode = {
  rawValue: string;
  format: BarcodeFormat;
  boundingBox?: DOMRectReadOnly;
};

type BarcodeDetectorCtor = new (options?: { formats?: BarcodeFormat[] }) => {
  detect(source: ImageBitmapSource | HTMLVideoElement): Promise<NativeDetectedBarcode[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

const NATIVE_FORMATS: BarcodeFormat[] = [
  "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e",
  "itf", "qr_code", "data_matrix",
];

/** Indique si l'API BarcodeDetector native est disponible cote client.
 *  Utile pour les logs/debug ; n'est PLUS un pre-requis pour scanner
 *  (ZXing prend le relais sinon). */
export function isBarcodeDetectorSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.BarcodeDetector !== "undefined";
}

/** Le scan est toujours possible si on a getUserMedia (camera). ZXing
 *  marche partout — Safari iOS inclus. */
export function isScannerAvailable(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return !!navigator.mediaDevices?.getUserMedia;
}

export type ScannerConfig = {
  /** Element video sur lequel afficher le flux camera. */
  video: HTMLVideoElement;
  /** Callback declenche au premier code detecte. Le scanner s'arrete apres. */
  onDetect: (code: string, format: BarcodeFormat) => void;
  /** Callback erreur (permission refusee, etc.). */
  onError?: (err: Error) => void;
};

/** Demarre la camera + boucle de detection.
 *  Retourne une fonction stop() qui libere proprement la camera.
 *  Choisit automatiquement entre API native et ZXing selon le navigateur. */
export async function startBarcodeScanner(
  config: ScannerConfig
): Promise<() => void> {
  if (isBarcodeDetectorSupported()) {
    return startNativeScanner(config);
  }
  return startZxingScanner(config);
}

// ─── Scanner natif (Chrome / Edge) ────────────────────────────────────────────

async function startNativeScanner(
  config: ScannerConfig
): Promise<() => void> {
  const { video, onDetect, onError } = config;
  let stream: MediaStream | null = null;
  let stopped = false;
  let rafId: number | null = null;

  function stop() {
    stopped = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (video.srcObject) video.srcObject = null;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    await video.play();
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
    stop();
    throw err;
  }

  const detector = new window.BarcodeDetector!({ formats: NATIVE_FORMATS });

  async function tick() {
    if (stopped) return;
    if (video.readyState >= 2) {
      try {
        const codes = await detector.detect(video);
        if (codes.length > 0) {
          const c = codes[0];
          onDetect(c.rawValue, c.format);
          stop();
          return;
        }
      } catch {
        // detect() peut throw temporairement si la video n'est pas prete
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
  return stop;
}

// ─── Scanner ZXing (Safari iOS, Firefox, fallback universel) ──────────────────

function zxingFormatToOur(formatStr: string): BarcodeFormat {
  // ZXing retourne ex "EAN_13", "CODE_128", "QR_CODE", "DATA_MATRIX"
  switch (formatStr) {
    case "EAN_13": return "ean_13";
    case "EAN_8": return "ean_8";
    case "CODE_128": return "code_128";
    case "CODE_39": return "code_39";
    case "CODE_93": return "code_93";
    case "CODABAR": return "codabar";
    case "ITF": return "itf";
    case "QR_CODE": return "qr_code";
    case "DATA_MATRIX": return "data_matrix";
    case "UPC_A": return "upc_a";
    case "UPC_E": return "upc_e";
    default: return "unknown";
  }
}

async function startZxingScanner(
  config: ScannerConfig
): Promise<() => void> {
  const { video, onDetect, onError } = config;

  if (!isScannerAvailable()) {
    const err = new Error("Camera (getUserMedia) non disponible sur ce navigateur");
    onError?.(err);
    throw err;
  }

  const reader = new BrowserMultiFormatReader();
  let controls: IScannerControls | null = null;
  let stopped = false;

  function stop() {
    stopped = true;
    if (controls) {
      try { controls.stop(); } catch { /* ignore */ }
      controls = null;
    }
    if (video.srcObject) {
      const s = video.srcObject as MediaStream;
      s.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
  }

  try {
    // playsinline + muted obligatoires pour iOS Safari (autoplay video)
    video.setAttribute("playsinline", "true");
    video.muted = true;

    controls = await reader.decodeFromConstraints(
      {
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      },
      video,
      (result, error) => {
        if (stopped) return;
        if (result) {
          const text = result.getText();
          const format = zxingFormatToOur(result.getBarcodeFormat().toString());
          onDetect(text, format);
          stop();
        }
        // Les "NotFoundException" sont normales (= pas de code dans le frame)
        // ZXing les ignore en interne ; on log uniquement les autres
        if (error && error.name && error.name !== "NotFoundException" && error.name !== "ChecksumException" && error.name !== "FormatException") {
          // erreur reelle (ex: video stream lost)
          // pas onError car on veut pas casser le scan en boucle
          // console.warn("ZXing error:", error.name, error.message);
        }
      }
    );
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
    stop();
    throw err;
  }

  return stop;
}
