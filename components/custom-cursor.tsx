"use client";

/**
 * CustomCursor — curseur perso style Active Theory / Locomotive.
 *
 * Comportement :
 *   - Cache le curseur natif (cursor: none) sur les éléments dans le container
 *   - Render 2 éléments : un petit dot (suit la souris instantanément) et un
 *     anneau plus grand (suit avec lerp 0.15 pour une trainée smooth)
 *   - Sur hover d'un élément interactif (a, button, [data-cursor="hover"]),
 *     l'anneau scale up et change de couleur (border accent)
 *   - Sur élément avec [data-cursor="magnetic"], l'anneau est attiré
 *     vers le centre du target (effet magnetic)
 *
 * Auto-disable sur touch devices (mobile/tablet : pas de hover, curseur perso
 * inutile et bloque les interactions).
 *
 * Usage :
 *   <CustomCursor />  // À mettre une fois par page immersive, au top level
 */

import { useEffect, useRef } from "react";

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip sur touch devices : pas de hover, le curseur perso n'a pas de sens
    const isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    // Position cible (où la souris est)
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    // Position actuelle de l'anneau (lerp)
    const current = { x: target.x, y: target.y };
    // Multiplicateurs visuels (animés au hover)
    let ringScale = 1;
    let ringScaleVel = 0;
    let isHover = false;
    let magneticTarget: HTMLElement | null = null;

    // Show les éléments dès qu'on bouge la souris (évite le flash de centre)
    let visible = false;

    const onMove = (e: MouseEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;

      if (!visible) {
        visible = true;
        dot.style.opacity = "1";
        ring.style.opacity = "1";
      }

      // Le dot suit instantanément (transform avec translate3d pour le GPU)
      dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;

      // Détection magnetic : si on est dans un élément data-cursor="magnetic"
      const elUnder = document.elementFromPoint(e.clientX, e.clientY);
      const magnetic = elUnder?.closest<HTMLElement>(
        '[data-cursor="magnetic"]'
      );
      magneticTarget = magnetic || null;
    };

    // Détection hover : interactive elements augmentent la taille de l'anneau
    const onMouseOver = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el || typeof el.closest !== "function") return;
      const interactive = el.closest(
        'a, button, [data-cursor="hover"], [data-cursor="magnetic"]'
      );
      if (interactive) {
        isHover = true;
      } else {
        isHover = false;
      }
    };

    // Hide quand la souris quitte le viewport (utile en mode developer ou border)
    const onMouseLeave = () => {
      dot.style.opacity = "0";
      ring.style.opacity = "0";
      visible = false;
    };

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseover", onMouseOver);
    document.documentElement.addEventListener("mouseleave", onMouseLeave);

    // Animation loop pour le lerp + magnetic + scale
    let rafId = 0;
    const animate = () => {
      const LERP = 0.18;
      const SCALE_LERP = 0.2;

      // Magnetic : si target magnetic présent, on lerp vers son centre
      let lerpX = target.x;
      let lerpY = target.y;
      if (magneticTarget) {
        const rect = magneticTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        // Force d'attraction 60% vers le centre
        lerpX = target.x + (centerX - target.x) * 0.5;
        lerpY = target.y + (centerY - target.y) * 0.5;
      }

      current.x += (lerpX - current.x) * LERP;
      current.y += (lerpY - current.y) * LERP;

      // Scale lerp : 1 par défaut, 2.2 au hover
      const targetScale = isHover ? 2.2 : 1;
      ringScaleVel += (targetScale - ringScale) * SCALE_LERP;
      ringScaleVel *= 0.6; // damping
      ringScale += ringScaleVel;

      ring.style.transform = `translate3d(${current.x}px, ${current.y}px, 0) translate(-50%, -50%) scale(${ringScale})`;
      // Changement de border quand hover
      ring.style.borderColor = isHover
        ? "rgba(255,255,255,0.95)"
        : "rgba(255,255,255,0.35)";
      ring.style.mixBlendMode = isHover ? "difference" : "normal";

      rafId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onMouseOver);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      {/* Style global pour cacher le curseur natif sur desktop (en gardant
          interactivité). Le `:hover` sur tout permet les events. */}
      <style jsx global>{`
        @media (hover: hover) and (pointer: fine) {
          html,
          html * {
            cursor: none !important;
          }
        }
      `}</style>

      {/* Dot central : suit instantanément */}
      <div
        ref={dotRef}
        className="pointer-events-none fixed top-0 left-0 z-[9999] w-1.5 h-1.5 rounded-full bg-white"
        style={{
          opacity: 0,
          willChange: "transform, opacity",
        }}
      />

      {/* Anneau : suit avec lerp + scale au hover */}
      <div
        ref={ringRef}
        className="pointer-events-none fixed top-0 left-0 z-[9998] w-8 h-8 rounded-full border"
        style={{
          opacity: 0,
          borderColor: "rgba(255,255,255,0.35)",
          willChange: "transform, opacity, border-color",
        }}
      />
    </>
  );
}
