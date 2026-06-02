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
  | { type: "loading" }
  | { type: "ready" }
  | { type: "scanning" }
  | { type: "found"; id: string }
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
  const [state, setState] = useState<State>({ type: "loading" });

  useEffect(() => {
    // Check secure context : sur HTTP IP locale Safari iOS bloque la caméra.
    if (typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost") {
      setState({ type: "insecure_context" });
      return;
    }

    let mounted = true;

    async function startScanner() {
      const video = videoRef.current;
      if (!video) return;

      try {
        const { default: QrScanner } = await import("qr-scanner");

        const hasCamera = await QrScanner.hasCamera();
        if (!hasCamera) {
          if (mounted) setState({ type: "no_camera" });
          return;
        }

        const scanner = new QrScanner(
          video,
          (result) => {
            const id = extractEquipementId(result.data);
            if (!id) return;
            setState({ type: "found", id });
            scanner.stop();
            // Petit délai pour montrer le ✓ avant de naviguer
            setTimeout(() => router.push(`/eq/${id}`), 350);
          },
          {
            preferredCamera: "environment", // caméra arrière
            highlightScanRegion: true,
            highlightCodeOutline: true,
            returnDetailedScanResult: true,
            maxScansPerSecond: 5,
          }
        );

        scannerRef.current = scanner;

        try {
          await scanner.start();
          if (mounted) setState({ type: "scanning" });
        } catch (e) {
          // Permission refusée par l'utilisateur ou bloquée par Safari
          if (mounted) {
            const msg = e instanceof Error ? e.message.toLowerCase() : String(e);
            if (msg.includes("denied") || msg.includes("permission")) {
              setState({ type: "denied" });
            } else {
              setState({ type: "error", message: e instanceof Error ? e.message : String(e) });
            }
          }
        }
      } catch (e) {
        if (mounted) {
          setState({ type: "error", message: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    startScanner();

    return () => {
      mounted = false;
      const s = scannerRef.current;
      if (s) {
        s.stop();
        s.destroy();
      }
    };
  }, [router]);

  return (
    <>
      <MobileHeader title="Scanner QR" backHref="/m/intervention" />

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
        <span className="inline-block px-3 py-1.5 rounded-full bg-black/60 backdrop-blur text-white text-[11px] font-mono tracking-widest uppercase">
          Recherche QR…
        </span>
      </div>
    </div>
  );
}
