"use client";

/**
 * Cinematic loading sequence pour les pages immersives Vertxia.
 *
 * Remplace l'ancien skeleton sobre par une intro orchestrée façon Active Theory :
 *   1. Au mount : fond noir total, logo VERTXIA letter-by-letter reveal (stagger
 *      0.06s, y 60→0, opacity 0→1) — perçu cinéma dès la 1ère frame
 *   2. Progress bar fine sous le logo, fill smooth basé sur useProgress (drei)
 *   3. Pourcentage live à droite de la bar
 *   4. Quand progress >= 100 + active=false : whoosh sonore + fade-out 800ms +
 *      scale du logo (1 → 1.08) pour un "envol" — puis unmount
 *
 * Hook le loading manager Three.js global via useProgress, donc on a le vrai
 * % de download des assets (GLB + textures + HDRI), pas un fake countdown.
 */

import { useProgress } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { SoundEngine } from "@/components/audio/sound-engine";

export function SceneLoader() {
  const { progress, active } = useProgress();
  const [unmounted, setUnmounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const hasPlayedExit = useRef(false);

  // ─── Mount animation : logo letter-by-letter reveal ──────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".loader-letter",
        { opacity: 0, y: 60, rotationX: -90 },
        {
          opacity: 1,
          y: 0,
          rotationX: 0,
          stagger: 0.06,
          duration: 1.0,
          ease: "power4.out",
          delay: 0.1,
        }
      );
      gsap.fromTo(
        ".loader-meta",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 1.0, delay: 0.7, ease: "power3.out" }
      );
    }, overlayRef);
    return () => ctx.revert();
  }, []);

  // ─── Exit sequence : whoosh + fade + scale up ────────────────────────────
  useEffect(() => {
    if (!overlayRef.current) return;
    if (!active && progress >= 100 && !hasPlayedExit.current) {
      hasPlayedExit.current = true;

      // Sound effect au moment du fade out
      SoundEngine.whoosh();

      const tl = gsap.timeline({
        onComplete: () => setUnmounted(true),
      });

      // Logo : scale up + fade subtil
      if (logoRef.current) {
        tl.to(
          logoRef.current,
          {
            scale: 1.08,
            duration: 0.8,
            ease: "power3.inOut",
          },
          0
        );
      }

      // Overlay : fade out total + un peu de blur pour effet "depart"
      tl.to(
        overlayRef.current,
        {
          opacity: 0,
          filter: "blur(8px)",
          duration: 0.8,
          ease: "power2.out",
        },
        0
      );
    }
  }, [active, progress]);

  if (unmounted) return null;

  return (
    <div
      ref={overlayRef}
      aria-hidden
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
      style={{ willChange: "opacity, filter" }}
    >
      {/* Logo VERTXIA letter-by-letter */}
      <div ref={logoRef} className="text-center" style={{ perspective: 600 }}>
        <h1 className="text-5xl md:text-7xl font-light tracking-[0.05em] text-white leading-none">
          {"VERTXIA".split("").map((letter, i) => (
            <span key={i} className="loader-letter inline-block">
              {letter}
            </span>
          ))}
        </h1>

        {/* Tagline mince sous le logo */}
        <p className="loader-meta mt-5 font-mono text-[9px] md:text-[10px] tracking-[0.5em] text-white/40">
          IMMERSIVE SHOPIFY · LOADING
        </p>
      </div>

      {/* Progress bar + % en bas */}
      <div className="loader-meta mt-16 w-48 md:w-64 flex items-center gap-4">
        {/* Bar */}
        <div className="flex-1 h-px bg-white/10 overflow-hidden">
          <div
            className="h-full bg-white/70 transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* % */}
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/40 tabular-nums w-8 text-right">
          {String(Math.round(progress)).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
