"use client";

import { ReactNode } from "react";

/**
 * AuroraGlow — halo conic-gradient rotatif derrière un CTA.
 *
 * Technique : conic-gradient animé + blur, pattern courant dans la communauté
 * web design. Implémentation Vertxia (palette violet/bleu/rose/ambre).
 *
 * Usage :
 *   <AuroraGlow>
 *     <a href="..." className="...">SUIVRE LE BUILD</a>
 *   </AuroraGlow>
 */
export function AuroraGlow({
  children,
  speed = 4,
  intensity = 0.7,
  blur = 12,
  inset = 3,
  radius = "0.75rem",
  className = "",
}: {
  children: ReactNode;
  /** Durée d'une rotation complète en secondes. Plus haut = plus calme. */
  speed?: number;
  /** Opacité du halo (0-1). */
  intensity?: number;
  /** Blur du halo en pixels. Plus haut = halo plus diffus. */
  blur?: number;
  /** Débordement du halo autour de l'enfant en pixels. */
  inset?: number;
  /** Border-radius du halo (doit matcher celui de l'enfant). */
  radius?: string;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <span
        aria-hidden
        className="aurora-glow-halo absolute pointer-events-none"
        style={{
          top: `-${inset}px`,
          left: `-${inset}px`,
          right: `-${inset}px`,
          bottom: `-${inset}px`,
          borderRadius: radius,
          background:
            "conic-gradient(from 0deg, #a78bfa, #60a5fa, #ec4899, #f59e0b, #a78bfa)",
          opacity: intensity,
          filter: `blur(${blur}px)`,
          animation: `auroraGlowSpin ${speed}s linear infinite`,
        }}
      />
      <span className="relative inline-flex">{children}</span>

      <style jsx>{`
        @keyframes auroraGlowSpin {
          to {
            transform: rotate(360deg);
          }
        }
        .aurora-glow-halo {
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .aurora-glow-halo {
            animation: none !important;
          }
        }
      `}</style>
    </span>
  );
}
