"use client";

/**
 * MotionProvider — LazyMotion wrapper.
 *
 * Pattern Matt Perry recommande : `motion` (4.6KB) + `domAnimation` features
 * au lieu de `motion` full (34KB). Wrap toute l'app pour activer les animations
 * avec `<m.div>` au lieu de `<motion.div>`.
 *
 * Usage :
 *   <MotionProvider>
 *     <m.div animate={{ opacity: 1 }}>...</m.div>
 *   </MotionProvider>
 */

import { LazyMotion, domAnimation, MotionConfig } from "motion/react";
import type { PropsWithChildren } from "react";

export function MotionProvider({ children }: PropsWithChildren) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={{ ease: [0.22, 1, 0.36, 1] }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
