"use client";

// Force window.scrollTo(0, 0) à chaque changement de pathname.
// Next.js App Router gère le scroll automatique, mais Safari iOS + transitions
// gardent parfois la position du scroll du parent → header tronqué à
// l'arrivée sur une page. On force le reset au top sur chaque navigation.

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ScrollToTopOnNav() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}
