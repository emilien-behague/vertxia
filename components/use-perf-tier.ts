"use client";

/**
 * useIsMobile + useCanvasPerfTier — détecte le device et propose des params
 * Canvas R3F adaptés pour viser 60 FPS partout.
 *
 * Stratégie :
 *   - Mobile (largeur < 768px OU touch only) :
 *       dpr=[1, 1.5]       // au lieu de [1, 2]
 *       shadows=false      // les shadow maps 2048² flinguent les iPhones
 *       frameloop="always" // garde les anims fluides
 *   - Desktop : params max qualité (dpr=[1, 2], shadows on)
 *
 * Le hook retourne aussi les classes Tailwind pour faciliter les conditionals
 * (utile pour les Sparkles / heavy effects à désactiver mobile).
 *
 * SSR-safe : default à "desktop" tant qu on est server-side ou pre-hydratation.
 */

import { useEffect, useState } from "react";

export type PerfTier = "low" | "high";

export type CanvasPerfProps = {
  tier: PerfTier;
  dpr: [number, number];
  shadows: boolean;
  isMobile: boolean;
};

/**
 * Détecte si on est sur mobile (largeur < 768 ou touch device).
 * Re-evalue au resize. SSR returns false par défaut.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const check = () => {
      const isSmall = window.innerWidth < 768;
      const isTouch =
        "ontouchstart" in window || navigator.maxTouchPoints > 0;
      // Considere mobile si small OU (touch ET pas hover-capable)
      const hasNoHover =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(hover: none)").matches;
      setIsMobile(isSmall || (isTouch && hasNoHover));
    };

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile;
}

/**
 * Retourne les props Canvas adaptés au device.
 * Usage :
 *   const perf = useCanvasPerfTier();
 *   <Canvas dpr={perf.dpr} shadows={perf.shadows}>
 */
export function useCanvasPerfTier(): CanvasPerfProps {
  const isMobile = useIsMobile();
  return {
    tier: isMobile ? "low" : "high",
    dpr: isMobile ? [1, 1.5] : [1, 2],
    shadows: !isMobile,
    isMobile,
  };
}
