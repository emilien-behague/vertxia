"use client";

/**
 * HeroStage — orchestrateur client de la main area /app.
 * Mouse parallax tres subtil (±12px) applique au mesh gradient + orbs.
 * Layers : MeshGradient (z-0, parallax) -> FloatingOrbs (z-1, parallax) -> Noise (z-2) -> HeroCenter (z-20).
 */

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import { MeshGradient } from "./mesh-gradient";
import { FloatingOrbs } from "./floating-orbs";
import { NoiseOverlay } from "./noise-overlay";
import { HeroCenter } from "./hero-center";

export function HeroStage() {
  const ref = useRef<HTMLDivElement>(null);

  // Mouse position centered to [-1, 1] range
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  // Smooth via spring pour eviter les saccades
  const smoothX = useSpring(mx, { stiffness: 50, damping: 20, mass: 0.5 });
  const smoothY = useSpring(my, { stiffness: 50, damping: 20, mass: 0.5 });

  // Translate gradient ±14px, orbs ±22px (parallax separe)
  const gradientX = useTransform(smoothX, [-1, 1], [-14, 14]);
  const gradientY = useTransform(smoothY, [-1, 1], [-14, 14]);
  const orbsX = useTransform(smoothX, [-1, 1], [-22, 22]);
  const orbsY = useTransform(smoothY, [-1, 1], [-22, 22]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    mx.set((e.clientX - cx) / (rect.width / 2));
    my.set((e.clientY - cy) / (rect.height / 2));
  }

  function handleMouseLeave() {
    mx.set(0);
    my.set(0);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="absolute inset-0 flex items-center justify-center"
    >
      <motion.div className="absolute inset-0" style={{ x: gradientX, y: gradientY }}>
        <MeshGradient />
      </motion.div>
      <motion.div className="absolute inset-0" style={{ x: orbsX, y: orbsY }}>
        <FloatingOrbs />
      </motion.div>
      <NoiseOverlay />
      <div className="relative z-20 w-full flex items-center justify-center">
        <HeroCenter />
      </div>
    </div>
  );
}
