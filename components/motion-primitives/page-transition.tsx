"use client";

/**
 * PageTransition — overlay qui swipe la page a chaque mount.
 *
 * Effet : un panneau colore monte (initial y=0) et redescend (animate y=-100%)
 * en 0.9s avec ease cinematic. Donne une transition cinema entre les routes.
 *
 * Usage : wrap le contenu de la route. Au mount, l'overlay couvre puis se retire.
 */

import { m } from "motion/react";
import type { PropsWithChildren } from "react";

export function PageTransition({
  children,
  color = "#000000",
}: PropsWithChildren<{ color?: string }>) {
  return (
    <>
      <m.div
        aria-hidden
        initial={{ y: 0 }}
        animate={{ y: "-100%" }}
        transition={{ duration: 1.0, ease: [0.85, 0, 0.15, 1], delay: 0.05 }}
        style={{
          position: "fixed",
          inset: 0,
          background: color,
          zIndex: 9997,
          pointerEvents: "none",
          willChange: "transform",
        }}
      />
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.7 }}
      >
        {children}
      </m.div>
    </>
  );
}
