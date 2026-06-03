"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/mobile-header";

// Scanner QR Code Vertxia — utilise la lib qr-scanner (35KB, WASM fallback).
// Sur HTTPS / localhost : getUserMedia OK → scan caméra direct.
// Sur HTTP IP locale 192.168.x.x : Safari iOS bloque getUserMedia (secure context required)
//   → on affiche une instruction fallback vers l'app Appareil photo iPhone (qui scan en natif).

type State =
  | { type: "idle" } // En attente du tap utilisateur (user gesture iOS)
  | { type: "loading" }
  | { type: "scanning" }
  | { type: "found"; id: string }
  | { type: "unknown_qr"; content: string } // QR détecté mais format inconnu
  | { type: "denied" }
  | { type: "no_camera" }
  | { type: "insecure_context" }
  | { type: "error"; message: string };

function extractEquipementId(rawUrl: string): string | null {
  // Accepte plusieurs formats :
  //  - https://vertxia.com/eq/abc-123
  //  - http://192.168.1.42:3002/eq/abc-123
  //  - vertxia.com/eq/abc-123
  //  - /eq/abc-123
  //  - abc-123 (juste l'ID)
  try {
    const url = rawUrl.includes("://") ? new URL(rawUrl) : new URL(`https://x${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`);
    const match = url.pathname.match(/\/eq\/([a-zA-Z0-9-]+)/);
    if (match) return match[1];
  } catch {
    // pas une URL, peut être un ID brut
  }
  // Fallback : si la string ressemble à un UUID
  const uuidLike = /^[a-zA-Z0-9-]{8,}$/;
  if (uuidLike.test(rawUrl.trim())) return rawUrl.trim();
  return null;
}

export default function MobileScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<{ stop: () => void; destroy: () => void } | null>(null);
  const [state, setState] = useState<State>({ type: "idle" });

  // Check secure context au mount — sur HTTP IP locale Safari iOS bloque getUserMedia
  useEffect(() => {
    if (typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost") {
      setState({ type: "insecure_context" });
    }
    return () => {
      const s = scannerRef.current;
      if (s) {
        try {
          s.stop();
          s.destroy();
        } catch {
          /* */
        }
        scannerRef.current = null;
      }
    };
  }, []);

  // Debug overlay visible (utile pour iOS où on n'a pas la console)
  const [debug, setDebug] = useState<string[]>([]);
  const log = (msg: string) => setDebug((d) => [...d.slice(-8), `${new Date().toLocaleTimeString()} ${msg}`]);

  // Chemin natif via BarcodeDetector (iOS 17+, Chrome Android).
  // Boucle requestAnimationFrame qui appelle detector.detect(video) à chaque frame.
  async function startNative(video: HTMLVideoElement) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      log(`video ${video.videoWidth}x${video.videoHeight}`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      let stopped = false;
      const stop = () => {
        stopped = true;
        try { stream.getTracks().forEach((t) => t.stop()); } catch {}
      };
      scannerRef.current = { stop, destroy: stop };
      setState({ type: "scanning" });
      log("scanning (native)");

      let scanAttempts = 0;
      const loop = async () => {
        if (stopped) return;
        try {
          const codes = await detector.detect(video);
          scanAttempts++;
          if (scanAttempts % 30 === 0) log(`scan #${scanAttempts}`);
          if (codes && codes.length > 0) {
            const raw = codes[0].rawValue as string;
            log(`hit: ${raw.slice(0, 60)}`);
            const id = extractEquipementId(raw);
            if (!id) {
              setState({ type: "unknown_qr", content: raw });
              stop();
              return;
            }
            setState({ type: "found", id });
            stop();
            setTimeout(() => router.push(`/eq/${id}`), 350);
            return;
          }
        } catch (e) {
          log(`detect err: ${e instanceof Error ? e.message : String(e)}`);
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : String(e);
      log(`native err: ${msg}`);
      if (msg.includes("denied") || msg.includes("permission") || msg.includes("notallowed")) {
        setState({ type: "denied" });
      } else {
        setState({ type: "error", message: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  // Démarrage explicite via user gesture (iOS Safari l'exige pour getUserMedia)
  async function startScanner() {
    const video = videoRef.current;
    if (!video) return;
    setState({ type: "loading" });
    setDebug([]);
    log("start");

    // Tentative 1 : BarcodeDetector natif (Safari iOS 17+, Chrome Android)
    // Plus rapide, plus fiable, et pas de worker à charger.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BD = (typeof window !== "undefined" ? (window as any).BarcodeDetector : undefined);
    if (BD) {
      try {
        const formats = await BD.getSupportedFormats?.();
        log(`BarcodeDetector OK (${formats?.join(",") ?? "?"})`);
        if (formats?.includes("qr_code")) {
          await startNative(video);
          return;
        }
        log("qr_code pas supporté → fallback worker");
      } catch (e) {
        log(`BD throw : ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      log("BarcodeDetector indispo → worker");
    }

    // PATH FALLBACK : @zxing/browser (lib mature pour Safari iOS, pas de
    // worker externe, pas d'OffscreenCanvas qui pose problème sur certains iOS).
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      log("zxing importé");

      const codeReader = new BrowserQRCodeReader();

      // Acquisition caméra
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message.toLowerCase() : String(e);
        if (msg.includes("denied") || msg.includes("permission") || msg.includes("notallowed")) {
          setState({ type: "denied" });
        } else if (msg.includes("notreadable") || msg.includes("inuse")) {
          setState({
            type: "error",
            message: "La caméra est utilisée par une autre app. Ferme-la et réessaie.",
          });
        } else {
          setState({ type: "error", message: e instanceof Error ? e.message : String(e) });
        }
        return;
      }
      video.srcObject = stream;
      await video.play();
      log(`video ${video.videoWidth}x${video.videoHeight}`);

      // ZXing décode en continu via decodeFromVideoElement
      let stopped = false;
      let scanAttempts = 0;
      const controls = await codeReader.decodeFromVideoElement(video, (result, err) => {
        if (stopped) return;
        if (result) {
          const raw = result.getText();
          log(`zxing hit: ${raw.slice(0, 60)}`);
          const id = extractEquipementId(raw);
          if (!id) {
            setState({ type: "unknown_qr", content: raw });
            controls.stop();
            try { stream.getTracks().forEach((t) => t.stop()); } catch {}
            return;
          }
          setState({ type: "found", id });
          controls.stop();
          try { stream.getTracks().forEach((t) => t.stop()); } catch {}
          setTimeout(() => router.push(`/eq/${id}`), 350);
          return;
        }
        if (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // ZXing throw NotFoundException à chaque frame sans QR — normal
          if (msg.includes("NotFound") || msg.includes("No MultiFormat Readers")) {
            scanAttempts++;
            if (scanAttempts === 30 || scanAttempts === 100) {
              log(`scan vide #${scanAttempts} (cam OK)`);
            }
            return;
          }
          log(`zxing err: ${msg.slice(0, 80)}`);
        }
      });

      scannerRef.current = {
        stop: () => {
          stopped = true;
          try { controls.stop(); } catch {}
          try { stream.getTracks().forEach((t) => t.stop()); } catch {}
        },
        destroy: () => {
          stopped = true;
          try { controls.stop(); } catch {}
          try { stream.getTracks().forEach((t) => t.stop()); } catch {}
        },
      };
      log("zxing decode started");
      setState({ type: "scanning" });
    } catch (e) {
      log(`init err: ${e instanceof Error ? e.message : String(e)}`);
      setState({ type: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <>
      <MobileHeader title="Scanner QR" backHref="/m" />

      {/* Vidéo plein écran — visible seulement quand scanner actif */}
      <div className="relative mx-4 mt-2 rounded-3xl overflow-hidden bg-black aspect-[3/4]">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Overlay viseur stylé */}
        {state.type === "scanning" && <ViseurOverlay />}

        {/* État initial — bouton pour user gesture iOS */}
        {state.type === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white px-6">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-5">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <path d="M14 14h7v7h-7z" />
              </svg>
            </div>
            <div className="text-[16px] font-semibold text-center mb-1.5">
              Scanner un équipement
            </div>
            <div className="text-[12px] text-white/65 text-center leading-relaxed mb-6 max-w-[240px]">
              Pointez l&apos;étiquette QR Vertxia. La fiche s&apos;ouvre instantanément.
            </div>
            <button
              type="button"
              onClick={startScanner}
              className="px-6 py-3 rounded-2xl bg-white text-black text-[14px] font-medium active:bg-white/90"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              📷 Activer la caméra
            </button>
          </div>
        )}

        {/* Loading state */}
        {state.type === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center text-white/80 text-[13px]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <div>Initialisation caméra…</div>
            </div>
          </div>
        )}

        {/* Found state */}
        {state.type === "found" && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/85 text-white">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-white text-emerald-600 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="text-[15px] font-medium">Équipement détecté</div>
              <div className="text-[12px] opacity-80">Ouverture de la fiche…</div>
            </div>
          </div>
        )}

        {/* QR détecté mais pas un équipement Vertxia (URL externe, texte brut, etc.) */}
        {state.type === "unknown_qr" && (
          <div className="absolute inset-0 flex items-center justify-center bg-amber-500/90 text-white px-6">
            <div className="flex flex-col items-center gap-3 text-center max-w-xs">
              <div className="w-14 h-14 rounded-full bg-white text-amber-600 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="text-[14px] font-medium">QR détecté, mais pas un équipement Vertxia</div>
              <div className="text-[10px] font-mono bg-black/30 px-3 py-2 rounded break-all max-h-24 overflow-y-auto">
                {state.content}
              </div>
              <button
                type="button"
                onClick={startScanner}
                className="px-4 py-2 rounded-full bg-white text-amber-700 text-[13px] font-medium active:bg-white/90"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                Rescanner
              </button>
            </div>
          </div>
        )}

        {/* Error states inside the camera area */}
        {(state.type === "denied" || state.type === "no_camera" || state.type === "insecure_context" || state.type === "error") && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white px-6">
            <div className="text-center max-w-xs">
              <div className="text-4xl mb-3">
                {state.type === "denied" ? "🔒" : state.type === "no_camera" ? "📷" : state.type === "insecure_context" ? "🌐" : "⚠️"}
              </div>
              <div className="text-[14px] font-medium leading-snug">
                {state.type === "denied" && "Accès caméra refusé"}
                {state.type === "no_camera" && "Aucune caméra détectée"}
                {state.type === "insecure_context" && "Caméra indisponible en HTTP local"}
                {state.type === "error" && "Erreur du scanner"}
              </div>
              <div className="text-[12px] text-white/70 mt-2 leading-relaxed">
                {state.type === "denied" &&
                  "Autorise l'accès dans Réglages iPhone → Safari → Caméra, puis recharge la page."}
                {state.type === "no_camera" && "Connecte une caméra ou utilise un autre appareil."}
                {state.type === "insecure_context" &&
                  "Safari iOS bloque la caméra sur HTTP. Ouvre l'app Appareil photo iPhone et pointe le QR — iOS te proposera d'ouvrir le lien directement."}
                {state.type === "error" && state.message}
              </div>
              {state.type === "error" && (
                <button
                  type="button"
                  onClick={startScanner}
                  className="mt-4 px-4 py-2 rounded-2xl bg-white text-black text-[13px] font-medium active:bg-white/90"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  Réessayer
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Instructions et fallback */}
      <div className="px-5 mt-5">
        {state.type === "scanning" && (
          <div className="text-center">
            <div className="text-[14px] text-black/65 leading-relaxed">
              Pointe la caméra vers le QR Code collé sur l&apos;équipement.
            </div>
            <div className="text-[12px] text-black/45 mt-1">
              La fiche s&apos;ouvrira automatiquement dès détection.
            </div>
          </div>
        )}

        {state.type === "insecure_context" && (
          <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-4 text-[13px] text-amber-900 leading-relaxed">
            <strong>Mode démo HTTP local :</strong> sors de Safari, ouvre l&apos;app Appareil photo iPhone, pointe le QR. iOS détectera automatiquement et te proposera d&apos;ouvrir Vertxia.
            <br />
            <br />
            <em>En production HTTPS sur vertxia.com, le scanner caméra fonctionnera directement dans cette app.</em>
          </div>
        )}
      </div>

      {/* Debug overlay (visible iOS où on n'a pas la console) */}
      {debug.length > 0 && (
        <div className="px-4 mt-4">
          <details className="rounded-2xl bg-black/[0.04] ring-1 ring-black/10 px-4 py-3 text-[11px] font-mono text-black/70">
            <summary className="cursor-pointer text-[11px] font-medium text-black/65">
              · Debug scanner ({debug.length} logs)
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-all text-[10px] leading-relaxed">
              {debug.join("\n")}
            </pre>
          </details>
        </div>
      )}

      {/* Fallback : si scan impossible, accéder à la liste */}
      <div className="px-4 mt-6 space-y-2">
        <Link
          href="/m/equipements"
          className="block w-full px-5 py-3 ring-1 ring-black/10 text-black/70 text-[14px] font-medium rounded-xl text-center active:bg-black/[0.03] transition-colors"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          Choisir dans la liste du parc
        </Link>
        <Link
          href="/m/intervention/nouvelle"
          className="block w-full px-5 py-3 text-[13px] text-black/55 text-center"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          Saisir un équipement manuellement
        </Link>
      </div>
    </>
  );
}

function ViseurOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Coins de viseur en blanc */}
      <div className="absolute inset-12 sm:inset-16">
        <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
        <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
        <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
        <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />

        {/* Ligne scan animée */}
        <span className="absolute inset-x-4 top-1/2 h-0.5 bg-emerald-400/80 shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse" />
      </div>

      <div className="absolute bottom-4 left-0 right-0 text-center">
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur text-white text-[11px] font-mono tracking-widest uppercase">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-70 animate-ping" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </span>
          Caméra active · cherche QR
        </span>
      </div>
    </div>
  );
}
