"use client";

/**
 * Template Next.js 16 App Router : applique à CHAQUE route un fade-in
 * cinéma à chaque navigation.
 *
 * IMPORTANT — pourquoi PAS de filter/transform dans l'animation :
 * Un parent avec `filter:*` ou `transform:*` crée un CSS "containing block"
 * pour les descendants `position:fixed`. Donc les Canvas R3F en
 * `position:fixed inset-0` sont mal placés/clippés tant que le template
 * a un filter actif, le 3D devient invisible.
 *
 * Solution : opacity only. Le fade-in marche, et les Canvas restent
 * positionnés par rapport au viewport.
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

    // Animation d'entrée : opacity seulement (PAS de filter ni de transform
    // pour ne pas casser les position:fixed enfants — voir docstring).
    gsap.fromTo(
      el,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.5,
        ease: "power2.out",
        clearProps: "opacity",
      }
    );

    if (!isFirstMountRef.current) {
      SoundEngine.whoosh();
    }
    isFirstMountRef.current = false;
  }, []);

  return <div ref={rootRef}>{children}</div>;
}
