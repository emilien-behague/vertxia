"use client";

/**
 * SplitHeadline — anim hero headline cascade au mount via SplitType.
 *
 * Drop-in remplacement open-source de GSAP SplitText (payant).
 * Decompose le texte en chars + anime chaque char avec stagger CSS.
 *
 * Usage :
 *   <SplitHeadline as="h1" className="text-9xl">
 *     L'effort n'attend pas la perfection.
 *   </SplitHeadline>
 *
 * L'animation utilise des CSS variables (--char-index) + keyframes
 * pour rester perf-friendly (pas de JS frame).
 */

import { useEffect, useRef } from "react";
import SplitType from "split-type";

type Props = {
  children: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  style?: React.CSSProperties;
  /** Delay avant le start de l'anim (ms). Defaut 0. */
  delay?: number;
  /** Stagger entre chars (ms). Defaut 16. */
  stagger?: number;
};

export function SplitHeadline({
  children,
  as: Tag = "h1",
  className,
  style,
  delay = 0,
  stagger = 16,
}: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const split = new SplitType(ref.current, {
      types: "chars",
      tagName: "span",
    });

    if (split.chars) {
      split.chars.forEach((char, i) => {
        const el = char as HTMLElement;
        el.style.display = "inline-block";
        el.style.opacity = "0";
        el.style.transform = "translateY(100%)";
        el.style.transition = `opacity 700ms cubic-bezier(0.22, 1, 0.36, 1) ${
          delay + i * stagger
        }ms, transform 900ms cubic-bezier(0.22, 1, 0.36, 1) ${
          delay + i * stagger
        }ms`;
      });

      // Lance l'anim au prochain frame
      requestAnimationFrame(() => {
        if (split.chars) {
          split.chars.forEach((char) => {
            const el = char as HTMLElement;
            el.style.opacity = "1";
            el.style.transform = "translateY(0%)";
          });
        }
      });
    }

    return () => {
      split.revert();
    };
  }, [children, delay, stagger]);

  return (
    <Tag ref={ref as React.RefObject<HTMLHeadingElement>} className={className} style={style}>
      {children}
    </Tag>
  );
}
