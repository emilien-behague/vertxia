"use client";

/**
 * LenisProvider — smooth scroll signature Studio Freight.
 *
 * Active Lenis sur les routes /lite/[domain] pour donner un scroll
 * cinematic fluide qui matche le niveau perceptual des vraies brands
 * premium (Vercel, Apple, Polestar utilisent tous Lenis).
 *
 * Free upgrade — pas de modif visuelle dans les templates V1, juste
 * la mecanique de scroll.
 */

import { useEffect } from "react";
import Lenis from "lenis";

export function LenisProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      lerp: 0.1,
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
