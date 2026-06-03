"use client";

/**
 * FadeInUp — scroll-triggered fade-in + translateY.
 *
 * Defaults :
 *  - distance 32px
 *  - duration 0.8s ease-out cubic
 *  - se declenche quand 20% visible
 *  - une seule fois (once)
 *
 * Stagger : passer `delay={index * 0.08}` pour cascade.
 */

import { m, useInView } from "motion/react";
import { useRef, type PropsWithChildren } from "react";

type Props = PropsWithChildren<{
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
  as?: "div" | "section" | "article" | "header" | "footer" | "h1" | "h2" | "h3" | "p" | "span";
  once?: boolean;
  amount?: number;
}>;

export function FadeInUp({
  children,
  delay = 0,
  duration = 0.8,
  distance = 32,
  className,
  as = "div",
  once = true,
  amount = 0.2,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once, amount });
  const Tag = m[as];

  return (
    <Tag
      ref={ref as never}
      initial={{ opacity: 0, y: distance }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: distance }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </Tag>
  );
}

/**
 * StaggerGroup — wrapper qui propage un delay incrementiel a ses enfants.
 * Marche avec FadeInUp.delay calcule via index.
 */
export function StaggerGroup({
  children,
  delayStep = 0.08,
  className,
}: PropsWithChildren<{ delayStep?: number; className?: string }>) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className={className}>
      {items.map((child, i) =>
        // eslint-disable-next-line react/no-array-index-key
        <FadeInUp key={i} delay={i * delayStep}>{child}</FadeInUp>
      )}
    </div>
  );
}
