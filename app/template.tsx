"use client";

/**
 * Template Next.js 16 App Router : applique à CHAQUE route un fade-in
 * cinéma à chaque navigation. Différent de layout.tsx — un template
 * re-mount à chaque navigation (pas de state persistant), donc l'animation
 * de mount joue à chaque page.
 *
 * Effet : transitions entre / → /try → /preview/jiraya → /demo/xxx
 * deviennent fluides avec un blur+opacity 0→1 sur l'arrivée, plutôt qu'un
 * flash brutal.
 *
 * Note : pas de animation EXIT (Next.js App Router ne supporte pas nativement
 * les exit animations sans framer-motion AnimatePresence wrapper, et on évite
 * d'ajouter framer-motion pour 1 effet). L'entrée est ce qui compte le plus
 * perçu-cinema de toute façon.
 */

import { useEffect, useRef, ReactNode } from "react";
import gsap from "gsap";
import { SoundEngine } from "@/components/audio/sound-engine";

export default function Template({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const isFirstMountRef = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = rootRef.current;
    if (!el) return;

    // Animation d'entrée : fade-in + blur clear + slight y up
    gsap.fromTo(
      el,
      {
        opacity: 0,
        filter: "blur(12px)",
        y: 12,
      },
      {
        opacity: 1,
        filter: "blur(0px)",
        y: 0,
        duration: 0.7,
        ease: "power3.out",
        clearProps: "filter,y,opacity",
      }
    );

    // Whoosh sonore SEULEMENT sur navigations (pas sur le tout premier mount
    // qui aurait son loader cinema avec son propre whoosh)
    if (!isFirstMountRef.current) {
      SoundEngine.whoosh();
    }
    isFirstMountRef.current = false;
  }, []);

  return (
    <div ref={rootRef} style={{ willChange: "opacity, filter, transform" }}>
      {children}
    </div>
  );
}
