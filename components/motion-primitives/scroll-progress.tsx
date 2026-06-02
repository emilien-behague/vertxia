"use client";

/**
 * ScrollProgress — barre fine en haut qui montre la progression de scroll.
 *
 * Position fixed top, height 2px, scaleX 0->1 via useScroll().
 * Couleur via prop ou defaut accent.
 */

import { m, useScroll, useSpring } from "motion/react";

export function ScrollProgress({ color = "#E8521A" }: { color?: string }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <m.div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: color,
        transformOrigin: "0%",
        scaleX,
        zIndex: 9998,
        willChange: "transform",
      }}
    />
  );
}
