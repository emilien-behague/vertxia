// Wrapper minimal autour de l'API BarcodeDetector native (Safari iOS 17+,
// Chrome Android, Chrome desktop). Pas de dependency externe : si l'API
// n'est pas dispo (Firefox principalement), on retourne null et le caller
// affiche un fallback "saisie manuelle".
//
// Formats supportes : EAN-13, EAN-8, Code-128, Code-39, QR, Data Matrix
// (couvre tous les codes-barres bouteilles gaz Linde/Climalife/Tereva).

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
  | "upc_e";

type DetectedBarcode = {
  rawValue: string;
  format: BarcodeFormat;
  boundingBox?: DOMRectReadOnly;
};

type BarcodeDetectorCtor = new (options?: { formats?: BarcodeFormat[] }) => {
  detect(source: ImageBitmapSource | HTMLVideoElement): Promise<DetectedBarcode[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

/** Indique si l'API BarcodeDetector est disponible cote client. */
export function isBarcodeDetectorSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.BarcodeDetector !== "undefined";
}

export type ScannerConfig = {
  /** Element video sur lequel afficher le flux camera. */
  video: HTMLVideoElement;
  /** Callback declenche au premier code detecte. Le scanner s'arrete apres. */
  onDetect: (code: string, format: BarcodeFormat) => void;
  /** Callback erreur (permission refusee, etc.). */
  onError?: (err: Error) => void;
  /** Formats acceptes (par defaut : tout ce qu'on voit sur les bouteilles). */
  formats?: BarcodeFormat[];
};

const DEFAULT_FORMATS: BarcodeFormat[] = [
  "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e",
  "itf", "qr_code", "data_matrix",
];

/** Demarre la camera + boucle de detection. Retourne une fonction stop()
 *  qui libere proprement la camera. */
export async function startBarcodeScanner(
  config: ScannerConfig
): Promise<() => void> {
  const { video, onDetect, onError, formats = DEFAULT_FORMATS } = config;

  if (!isBarcodeDetectorSupported()) {
    const err = new Error("BarcodeDetector API non supportee sur ce navigateur");
    onError?.(err);
    throw err;
  }

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
    // Camera arriere par defaut (environment), fallback any si pas dispo
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    video.srcObject = stream;
    video.setAttribute("playsinline", "true"); // iOS Safari : empeche fullscreen forcé
    await video.play();
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
    stop();
    throw err;
  }

  const detector = new window.BarcodeDetector!({ formats });

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
        // detect() peut throw temporairement si la video n'est pas prete, on retente
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
  return stop;
}
