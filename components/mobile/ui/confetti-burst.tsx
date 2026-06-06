"use client";

// Animation de victoire — confetti CSS-only sans dependance externe.
// Se declenche au mount du composant et se nettoie automatiquement
// apres ~2.5s. Utilise pour celebrer les actions reussies de l'utilisateur
// (intervention validee, premier scan, etc.) — style Pokemon Go / Duolingo.
//
// Pas de framer-motion ici pour eviter le bug iOS hydration deja rencontre
// (cf. memory framer_motion_ios_hydration_bug). Que du CSS pur + Math.random
// statique au mount.

import { useEffect, useMemo, useState } from "react";

type Props = {
  /** Nombre de confettis (defaut 40 — plus = plus festif mais plus lourd) */
  count?: number;
  /** Duree de l'animation en ms (defaut 2500) */
  duration?: number;
};

const COLORS = [
  "#A16207", // ocre Vertxia
  "#dc2626", // rouge
  "#ea580c", // orange
  "#10b981", // vert
  "#3b82f6", // bleu
  "#a855f7", // violet
  "#eab308", // jaune
];

export function ConfettiBurst({ count = 40, duration = 2500 }: Props) {
  const [active, setActive] = useState(true);

  // Pre-genere les positions/couleurs/delais au mount. Une fois calcules,
  // on ne re-rend plus pour ne pas re-randomiser a chaque frame.
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100, // %
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 300, // ms
        rotate: Math.random() * 720 - 360, // deg
        size: 6 + Math.random() * 6, // px
        duration: 1500 + Math.random() * 1000, // ms
      })),
    [count]
  );

  useEffect(() => {
    const t = setTimeout(() => setActive(false), duration);
    return () => clearTimeout(t);
  }, [duration]);

  if (!active) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden z-[60]"
    >
      <style>{`
        @keyframes vertxia-confetti-fall {
          0% {
            transform: translateY(-10vh) translateX(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) translateX(var(--tx, 0)) rotate(var(--rot, 360deg));
            opacity: 1;
          }
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 rounded-sm"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 1.6}px`,
            background: p.color,
            animation: `vertxia-confetti-fall ${p.duration}ms ${p.delay}ms cubic-bezier(0.2, 0.6, 0.4, 1) forwards`,
            ["--tx" as string]: `${(Math.random() - 0.5) * 200}px`,
            ["--rot" as string]: `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}
