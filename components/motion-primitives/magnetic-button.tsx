"use client";

/**
 * MagneticButton — bouton qui suit le curseur sur hover.
 *
 * Effet : a l'interieur d'une zone (hitbox) plus grande que le bouton,
 * le bouton se decale vers le curseur (offset attenue). Quand le curseur
 * sort, le bouton revient au centre avec un easing spring.
 *
 * Strength typique : 0.3-0.5 (0 = pas de magnetisme, 1 = colle au curseur).
 */

import { m, useMotionValue, useSpring } from "motion/react";
import {
  useRef,
  type PropsWithChildren,
  type MouseEventHandler,
  type CSSProperties,
} from "react";

type Props = PropsWithChildren<{
  strength?: number;
  hitboxScale?: number;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  style?: CSSProperties;
  ariaLabel?: string;
  as?: "button" | "a";
  href?: string;
}>;

export function MagneticButton({
  children,
  strength = 0.35,
  hitboxScale = 1.6,
  className,
  onClick,
  style,
  ariaLabel,
  as = "button",
  href,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 18, mass: 0.5 });
  const springY = useSpring(y, { stiffness: 200, damping: 18, mass: 0.5 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - rect.left - rect.width / 2;
    const relY = e.clientY - rect.top - rect.height / 2;
    x.set(relX * strength);
    y.set(relY * strength);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  const buttonInner = (
    <m.span
      style={{ x: springX, y: springY, display: "inline-flex" }}
      className={className}
    >
      {children}
    </m.span>
  );

  return (
    <div
      ref={wrapperRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        display: "inline-block",
        padding: `${(hitboxScale - 1) * 50}% 0`,
        margin: `${(hitboxScale - 1) * -50}% 0`,
        ...style,
      }}
    >
      {as === "a" && href ? (
        <a href={href} aria-label={ariaLabel} onClick={onClick as never}>
          {buttonInner}
        </a>
      ) : (
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={onClick}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          {buttonInner}
        </button>
      )}
    </div>
  );
}
