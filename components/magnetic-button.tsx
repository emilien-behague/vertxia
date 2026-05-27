"use client";

/**
 * MagneticButton — lien CTA qui :
 *   - Attire visuellement le contenu vers le curseur (translation 0-12px max)
 *     selon la distance au centre du bouton
 *   - Joue un sound hover quand le curseur entre, click quand on click
 *   - Set data-cursor="magnetic" pour que le CustomCursor sache être attiré
 *
 * Effet combo : le curseur lerp vers le bouton ET le bouton lerp vers le
 * curseur, créant une attraction mutuelle qui se ressent comme "premium".
 *
 * Toujours rendu en <a>. Pour un onClick pur, utiliser <a href="#"> + onClick
 * + e.preventDefault dans le handler.
 *
 * Variants :
 *   - "solid"  (default) : bg blanc, texte noir, hover invert
 *   - "ghost"  : border-only, transparent
 *   - "accent" : gradient emerald pour CTA principale
 */

import { useRef, ReactNode, MouseEvent } from "react";
import { SoundEngine } from "@/components/audio/sound-engine";

type Variant = "solid" | "ghost" | "accent";

type Props = {
  children: ReactNode;
  href: string;
  variant?: Variant;
  className?: string;
  strength?: number; // intensité magnetic (0-1), default 0.35
  innerStrength?: number; // contenu interne (label) intensité, default 0.5
  target?: string;
  rel?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
};

// Variants alignées sur le design system ui-ux-pro-max v1 :
//   solid  = primary CTA gold (#A16207) — bouton dominant
//   ghost  = secondary action, border cream subtil
//   accent = soft gold tint avec border + gradient (highlights non-primaires)
// Variants tokenisées (cf. design-system/vertxia/tokens.json) :
//   solid  = primary CTA gold (--color-accent → #A16207) — bouton dominant
//   ghost  = secondary action, border cream subtil
//   accent = soft gold tint avec border + gradient (highlights non-primaires)
const VARIANT_CLASSES: Record<Variant, string> = {
  solid:
    "bg-accent text-accent-foreground hover:bg-accent-hover border border-accent",
  ghost:
    "bg-transparent text-foreground border border-foreground/15 hover:border-foreground/40",
  accent:
    "bg-gradient-to-r from-accent/25 to-accent/10 border border-accent/40 text-foreground hover:from-accent/40 hover:to-accent/20",
};

export function MagneticButton({
  children,
  href,
  variant = "solid",
  className = "",
  strength = 0.35,
  innerStrength = 0.5,
  target,
  rel,
  onClick,
}: Props) {
  const outerRef = useRef<HTMLAnchorElement | null>(null);
  const innerRef = useRef<HTMLSpanElement>(null);

  function handleMove(e: MouseEvent<HTMLAnchorElement>) {
    const el = outerRef.current;
    const inner = innerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) * strength;
    const dy = (e.clientY - cy) * strength;

    el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    if (inner) {
      // Inner contenu suit plus fort pour effet 3D-ish
      inner.style.transform = `translate3d(${dx * innerStrength}px, ${
        dy * innerStrength
      }px, 0)`;
    }
  }

  function handleEnter() {
    SoundEngine.hover();
  }

  function handleLeave() {
    const el = outerRef.current;
    const inner = innerRef.current;
    if (el) {
      // Lerp reset au release via transition CSS
      el.style.transition = "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
      el.style.transform = "translate3d(0,0,0)";
      setTimeout(() => {
        if (el) el.style.transition = "";
      }, 520);
    }
    if (inner) {
      inner.style.transition = "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
      inner.style.transform = "translate3d(0,0,0)";
      setTimeout(() => {
        if (inner) inner.style.transition = "";
      }, 520);
    }
  }

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    SoundEngine.click();
    onClick?.(e);
  }

  return (
    <a
      ref={outerRef}
      href={href}
      target={target}
      rel={rel}
      data-cursor="magnetic"
      className={`inline-flex items-center justify-center px-8 py-4 font-mono text-xs tracking-[0.3em] rounded-lg transition-colors duration-300 pointer-events-auto ${VARIANT_CLASSES[variant]} ${className}`}
      style={{ willChange: "transform" }}
      onMouseMove={handleMove}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={handleClick}
    >
      <span
        ref={innerRef}
        className="inline-block"
        style={{ willChange: "transform" }}
      >
        {children}
      </span>
    </a>
  );
}
