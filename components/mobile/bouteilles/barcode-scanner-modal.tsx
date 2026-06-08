"use client";

import { useEffect, useRef, useState } from "react";
import {
  isBarcodeDetectorSupported,
  startBarcodeScanner,
  type BarcodeFormat,
} from "@/lib/equipement/barcode-detect";

// Modal plein ecran pour scanner un code-barres avec la camera arriere.
// Reuses le pattern de "Activer la camera" pour respecter la regle iOS
// Safari user-gesture (cf. memory [[feedback-ios-safari-camera-user-gesture]]).
//
// Workflow :
//  1. Ouverture modal -> ecran avec gros bouton "Activer la camera"
//  2. Tap utilisateur -> demande permission camera -> lance scan
//  3. Code detecte -> callback onDetect + fermeture auto
//  4. Annuler -> stop camera + ferme modal

type Props = {
  open: boolean;
  onClose: () => void;
  onDetect: (code: string, format: BarcodeFormat) => void;
};

export function BarcodeScannerModal({ open, onClose, onDetect }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!open) return;
    setSupported(isBarcodeDetectorSupported());
    setError(null);
    setActive(false);
    return () => {
      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
      }
    };
  }, [open]);

  async function handleStart() {
    if (!videoRef.current) return;
    setError(null);
    try {
      const stop = await startBarcodeScanner({
        video: videoRef.current,
        onDetect: (code, format) => {
          stopRef.current = null;
          setActive(false);
          // Vibration retour haptique (Android/Chrome — iOS Safari ignore)
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(100);
          }
          onDetect(code, format);
          onClose();
        },
        onError: (err) => {
          setError(formatCameraError(err));
          setActive(false);
        },
      });
      stopRef.current = stop;
      setActive(true);
    } catch (err) {
      setError(formatCameraError(err instanceof Error ? err : new Error(String(err))));
      setActive(false);
    }
  }

  function handleClose() {
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
    setActive(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/55">
          Scan code-barres bouteille
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="w-10 h-10 rounded-full bg-white/10 active:bg-white/20 flex items-center justify-center"
          style={{ WebkitTapHighlightColor: "transparent" }}
          aria-label="Fermer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Zone video / placeholder */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${active ? "opacity-100" : "opacity-0"}`}
          playsInline
          muted
        />

        {/* Viewfinder overlay */}
        {active && (
          <>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 aspect-[3/2] border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
              </div>
            </div>
            <div className="absolute bottom-8 left-0 right-0 text-center text-white/90 text-[13px] font-medium px-6">
              Centrez le code-barres dans le cadre
            </div>
          </>
        )}

        {/* Etat initial : bouton "Activer la camera" */}
        {!active && !error && supported && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
            <div className="text-[60px] mb-4">📷</div>
            <div className="text-white text-[16px] font-semibold mb-2">
              Scanner un code-barres
            </div>
            <div className="text-white/70 text-[13px] text-center mb-8 max-w-xs leading-snug">
              Visez l&apos;étiquette code-barres collée sur votre bouteille (Linde, Climalife, Tereva...).
            </div>
            <button
              type="button"
              onClick={handleStart}
              className="px-8 py-4 rounded-2xl bg-emerald-500 active:bg-emerald-600 text-white text-[15px] font-semibold transition-colors"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              🎥 Activer la caméra
            </button>
          </div>
        )}

        {/* Erreur (permission refusee, etc.) */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
            <div className="text-[50px] mb-4">⚠️</div>
            <div className="text-white text-[15px] font-semibold mb-2 text-center">
              Caméra inaccessible
            </div>
            <div className="text-white/70 text-[12.5px] text-center mb-6 max-w-xs leading-snug">
              {error}
            </div>
            <button
              type="button"
              onClick={handleStart}
              className="px-6 py-3 rounded-xl bg-white/10 active:bg-white/20 text-white text-[13px] font-medium"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Pas supporte (Firefox principalement) */}
        {!supported && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
            <div className="text-[50px] mb-4">🚫</div>
            <div className="text-white text-[15px] font-semibold mb-2 text-center">
              Navigateur non supporté
            </div>
            <div className="text-white/70 text-[12.5px] text-center max-w-xs leading-snug">
              Le scan code-barres nécessite Safari (iOS 17+), Chrome ou Edge.
              Saisissez le code à la main pour le moment.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatCameraError(err: Error): string {
  const msg = err.message || String(err);
  if (/NotAllowedError|Permission/i.test(msg)) {
    return "Permission caméra refusée. Autorisez l'accès dans Réglages → Safari → Caméra.";
  }
  if (/NotFoundError|DevicesNotFound/i.test(msg)) {
    return "Aucune caméra détectée sur cet appareil.";
  }
  if (/NotReadableError|TrackStart/i.test(msg)) {
    return "Caméra utilisée par une autre application. Fermez les autres apps et réessayez.";
  }
  if (/non supportee/i.test(msg)) {
    return "Cette fonction nécessite un navigateur récent (Safari 17+, Chrome).";
  }
  return msg.slice(0, 200);
}
