"use client";

/**
 * MaskedReveal — text reveal Awwwards-style avec clip-path.
 *
 * Effet : ligne par ligne (ou whole) qui apparait avec un "rideau" qui se leve.
 * Inspiration : Apple Vision Pro hero, Studio Freight, basement.studio.
 *
 * Implementation : on duplique le contenu derriere un overlay opacite=0, et on
 * anime clip-path inset(0 0 100% 0) -> inset(0 0 0% 0).
 *
 * Pour texte multi-ligne, wrap chaque ligne dans MaskedReveal separe avec delay.
 */

import { m, useInView } from "motion/react";
import { useRef, type PropsWithChildren } from "react";

type Props = PropsWithChildren<{
  delay?: number;
  duration?: number;
  className?: string;
  direction?: "up" | "down";
  amount?: number;
}>;

export function MaskedReveal({
  children,
  delay = 0,
  duration = 1.0,
  className,
  direction = "up",
  amount = 0.2,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount });

  const initial =
    direction === "up"
      ? { clipPath: "inset(0 0 100% 0)" }
      : { clipPath: "inset(100% 0 0 0)" };
  const target = { clipPath: "inset(0 0 0% 0)" };

  return (
    <div ref={ref} className={className} style={{ overflow: "hidden", display: "block" }}>
      <m.div
        initial={initial}
        animate={inView ? target : initial}
        transition={{ duration, delay, ease: [0.65, 0, 0.35, 1] }}
        style={{ willChange: "clip-path" }}
      >
        {children}
      </m.div>
    </div>
  );
}

/**
 * SplitMaskedReveal — split un texte en mots et anime chacun en cascade.
 *
 * useInView UNIQUE sur le wrapper parent (au lieu de viewport detection
 * sur chaque mot, qui foire en inline-block).
 */
export function SplitMaskedReveal({
  text,
  delay = 0,
  duration = 0.9,
  delayStep = 0.04,
  className,
  splitBy = "word",
  amount = 0.1,
}: {
  text: string;
  delay?: number;
  duration?: number;
  delayStep?: number;
  className?: string;
  splitBy?: "word" | "char";
  amount?: number;
}) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(wrapperRef, { once: true, amount });

  const parts =
    splitBy === "word"
      ? text.split(/(\s+)/)
      : text.split("");

  return (
    <span ref={wrapperRef} className={className}>
      {parts.map((part, i) => {
        if (/^\s+$/.test(part)) return <span key={i}>{part}</span>;
        return (
          <span
            key={i}
            style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top" }}
          >
            <m.span
              style={{ display: "inline-block", willChange: "transform" }}
              initial={{ y: "110%" }}
              animate={inView ? { y: "0%" } : { y: "110%" }}
              transition={{
                duration,
                delay: delay + i * delayStep,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {part}
            </m.span>
          </span>
        );
      })}
    </span>
  );
}
