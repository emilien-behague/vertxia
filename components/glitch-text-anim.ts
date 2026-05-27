"use client";

/**
 * Glitch text reveal animation — signature Active Theory.
 *
 * Pour chaque élément `.glitch-text` :
 *   1. Stage 0 (set) : chars éparpillés au hasard (x, y, rotation) avec couleurs
 *      cyan/magenta/jaune/blanc (RGB-split feel)
 *   2. Stage 1 (50ms) : chars apparaissent avec opacity 1 (frame "glitch")
 *   3. Stage 2 (120ms) : couleurs flickerent encore (scramble sustained)
 *   4. Stage 3 (550ms) : chars settle vers leur position finale en blanc
 *      avec ease expo.out (signature AT)
 *
 * Trigger : ScrollTrigger, start "top 75%", whoosh sonore à l entrée.
 *
 * Usage :
 *   import { buildGlitchTextAnimation } from "@/components/glitch-text-anim";
 *   // dans useEffect, après document.fonts.ready, dans gsap.context :
 *   buildGlitchTextAnimation(containerRef.current, splits);
 *
 * Et dans le JSX : <h2 className="glitch-text ...">...</h2>
 */

import gsap from "gsap";
import SplitText from "@activetheory/split-text";
import { SoundEngine } from "./audio/sound-engine";

type SplitTextDom = SplitText & {
  chars: HTMLElement[];
  words: HTMLElement[];
  lines: HTMLElement[];
};

const GLITCH_COLORS = ["#ff0080", "#00ffff", "#ffff00", "#ffffff"];
const FLICKER_COLORS = [
  "#ff0080",
  "#00ffff",
  "#ffffff",
  "#ffffff",
  "#ffffff",
];

/**
 * Construit les animations glitch-text dans le container donné.
 * Push les SplitText créés dans le tableau `splits` pour cleanup au unmount.
 */
export function buildGlitchTextAnimation(
  container: HTMLElement | null,
  splits: SplitText[]
) {
  if (!container) return;

  container
    .querySelectorAll<HTMLElement>(".glitch-text")
    .forEach((el) => {
      const split = new SplitText(el, { type: "chars" }) as SplitTextDom;
      splits.push(split);

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: "top 75%",
          toggleActions: "play none none reverse",
          onEnter: () => SoundEngine.whoosh(),
        },
      });

      // Stage 0 : éparpiller au hasard + colorier
      tl.set(split.chars, {
        opacity: 0,
        x: () => gsap.utils.random(-40, 40),
        y: () => gsap.utils.random(-15, 15),
        rotation: () => gsap.utils.random(-25, 25),
        color: () => gsap.utils.random(GLITCH_COLORS),
      });

      // Stage 1 : faire apparaître (frame glitch)
      tl.to(split.chars, {
        opacity: 1,
        duration: 0.05,
        stagger: { each: 0.015, from: "random" },
      });

      // Stage 2 : flicker couleurs (chars encore scrambled)
      tl.to(split.chars, {
        duration: 0.12,
        color: () => gsap.utils.random(FLICKER_COLORS),
        stagger: { each: 0.008, from: "random" },
      });

      // Stage 3 : settle vers position finale blanche
      tl.to(split.chars, {
        x: 0,
        y: 0,
        rotation: 0,
        color: "#ffffff",
        duration: 0.55,
        ease: "expo.out",
        stagger: { each: 0.02, from: "random" },
      });
    });
}
