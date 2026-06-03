"use client";

// Force le scroll au TOP de la page à chaque changement de pathname.
// Next.js App Router est censé le faire automatiquement, mais Safari iOS
// + animations + middleware redirects gardent parfois la position du
// scroll de la page précédente → header tronqué, contenu masqué.
//
// On force le reset via 3 mécanismes (belt-and-suspenders) :
//  1. window.scrollTo() en sync
//  2. window.scrollTo() en requestAnimationFrame (après le paint)
//  3. document.documentElement.scrollTop = 0 (fallback Safari iOS)

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ScrollToTopOnNav() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reset = () => {
      try {
        window.scrollTo(0, 0);
      } catch {
        /* fallback */
      }
      try {
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
      } catch {
        /* */
      }
    };
    // Sync — avant le paint
    reset();
    // Après le paint — couvre les cas où Safari iOS restaure le scroll
    // après notre première tentative
    const raf = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(raf);
  }, [pathname]);
  return null;
}
