"use client";

/**
 * CustomCursor — curseur custom blob qui scale sur hover des elements
 * data-cursor="hover" | "view" | "drag".
 *
 * Inspiration : basement.studio, Studio Freight, awwwards SOTD.
 *
 * Caracteristiques :
 *  - blob 12px qui suit le curseur via useSpring (smooth lag)
 *  - scale 3x + opacity 0.3 sur hover de [data-cursor]
 *  - label optionnel via data-cursor-label="View"
 *  - se cache sur device tactile (matchMedia hover:none)
 */

import { m, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";

type CursorVariant = "default" | "hover" | "view" | "drag";

export function CustomCursor() {
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);
  const springX = useSpring(mouseX, { stiffness: 500, damping: 30, mass: 0.3 });
  const springY = useSpring(mouseY, { stiffness: 500, damping: 30, mass: 0.3 });

  const [variant, setVariant] = useState<CursorVariant>("default");
  const [label, setLabel] = useState<string>("");
  const [isTouch, setIsTouch] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: none) or (pointer: coarse)");
    setIsTouch(mq.matches);
    const update = () => setIsTouch(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (isTouch) return;
    const onMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    const onOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.("[data-cursor]");
      if (target) {
        const v = (target.getAttribute("data-cursor") || "hover") as CursorVariant;
        const l = target.getAttribute("data-cursor-label") || "";
        setVariant(v);
        setLabel(l);
      } else {
        setVariant("default");
        setLabel("");
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
    };
  }, [mouseX, mouseY, isTouch]);

  if (isTouch) return null;

  const size =
    variant === "view" ? 80 :
    variant === "drag" ? 64 :
    variant === "hover" ? 36 : 12;

  return (
    <m.div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        x: springX,
        y: springY,
        translateX: "-50%",
        translateY: "-50%",
        width: size,
        height: size,
        borderRadius: "50%",
        background:
          variant === "default"
            ? "rgba(255,255,255,0.85)"
            : "rgba(255,255,255,0.18)",
        backdropFilter: variant !== "default" ? "blur(2px)" : "none",
        border: variant !== "default" ? "1px solid rgba(255,255,255,0.5)" : "none",
        mixBlendMode: "difference",
        pointerEvents: "none",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#000",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        fontFamily: "system-ui, sans-serif",
        transition: "width 0.25s, height 0.25s, background 0.25s, border 0.25s",
        willChange: "transform, width, height",
      }}
    >
      {label && (variant === "view" || variant === "drag") ? label : null}
    </m.div>
  );
}
