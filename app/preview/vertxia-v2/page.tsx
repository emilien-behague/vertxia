"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useMotionValueEvent,
  useInView,
  useSpring,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
} from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  SMAA,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type * as THREE from "three";

// /preview/vertxia-v2 — Landing inspirée landonorris.com (SOTY 2025 OFF+BRAND)
// V1 = section HERO seule. Sections 2-6 ajoutées une par une après validation Emilien.
// Palette : cream #F5F2EA ↔ dark #0A0A0A + accent violet électrique #A78BFA
// Process règle #21 strict : screenshot chrome-devtools entre chaque incrément.

const palette = {
  cream: "#F5F2EA",
  dark: "#0A0A0A",
  violet: "#A78BFA",
  violetBright: "#C4B5FD",
} as const;

// ─── GLOBAL UX LAYER — Cursor + Progress + Chapter indicator + Magnetic ────
// Tous ces composants sont mountés au niveau page racine et restent persistants.

// SCROLL PROGRESS BAR : barre fine 2px en haut, fill violet, spring smooth
function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 45,
    restDelta: 0.001,
  });
  return (
    <motion.div
      style={{ scaleX, transformOrigin: "left" }}
      className="fixed top-0 left-0 right-0 h-[2px] bg-[#A78BFA] z-[60] pointer-events-none"
      aria-hidden
    />
  );
}

// CHAPTER INDICATOR : 6 dots fixés mid-right, clic = scroll to chambre
// Le dot actif s'élargit en bâton violet. Hover = label apparaît.
const CHAPTERS = [
  { num: "01", label: "Hero", anchor: "hero" },
  { num: "02", label: "Marquee", anchor: "marquee" },
  { num: "03", label: "Gallery", anchor: "gallery" },
  { num: "04", label: "Showcase", anchor: "showcase" },
  { num: "05", label: "Stack", anchor: "stack" },
  { num: "06", label: "Sign-off", anchor: "early-access" },
] as const;

function ChapterIndicator() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      // Le chapitre actif = celui dont le top est le plus proche au-dessus du milieu viewport
      const mid = window.innerHeight / 2;
      let best = 0;
      CHAPTERS.forEach((c, i) => {
        const el = document.getElementById(c.anchor);
        if (!el) return;
        const top = el.getBoundingClientRect().top;
        if (top <= mid) best = i;
      });
      setActive(best);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const jump = (anchor: string) => {
    const el = document.getElementById(anchor);
    if (!el) return;
    window.scrollTo({ top: el.offsetTop, behavior: "smooth" });
  };

  return (
    <nav
      aria-label="Chapter navigation"
      className="fixed top-1/2 -translate-y-1/2 right-5 z-[55] flex flex-col gap-3 pointer-events-auto"
    >
      {CHAPTERS.map((c, i) => {
        const isActive = i === active;
        return (
          <button
            key={c.anchor}
            onClick={() => jump(c.anchor)}
            className="group flex items-center gap-3 cursor-pointer"
            aria-label={`Go to chapter ${c.num} ${c.label}`}
            data-magnetic
          >
            <span
              className="text-[9px] font-mono tracking-[0.3em] uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[#F5F2EA] mix-blend-difference"
            >
              {c.num} · {c.label}
            </span>
            <motion.span
              animate={{
                width: isActive ? 22 : 6,
                backgroundColor: isActive ? "#A78BFA" : "rgba(245,242,234,0.4)",
              }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="block h-[2px] rounded-full"
            />
          </button>
        );
      })}
    </nav>
  );
}

// CUSTOM CURSOR : dot violet + ring outline, lerp smooth, mix-blend-difference
// Caché sur touch devices. Listener mousemove utilise motion values (pas de re-render).
function CustomCursor() {
  const dotX = useMotionValue(-100);
  const dotY = useMotionValue(-100);
  const ringX = useSpring(dotX, { damping: 30, stiffness: 280, mass: 0.5 });
  const ringY = useSpring(dotY, { damping: 30, stiffness: 280, mass: 0.5 });
  const [hovering, setHovering] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) return;
    setEnabled(true);

    const move = (e: MouseEvent) => {
      dotX.set(e.clientX);
      dotY.set(e.clientY);
      // e.target peut être un SVGElement sans .closest() — fallback sur elementFromPoint
      let t = e.target as Element | null;
      if (!t || typeof (t as Element).closest !== "function") {
        t = document.elementFromPoint(e.clientX, e.clientY);
      }
      if (!t || typeof t.closest !== "function") {
        setHovering(false);
        return;
      }
      const interactive = !!t.closest(
        "a, button, input, [data-magnetic], [data-cursor-hover]"
      );
      setHovering(interactive);
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [dotX, dotY]);

  if (!enabled) return null;
  return (
    <>
      {/* Dot central — instant, sans spring */}
      <motion.div
        style={{
          x: dotX,
          y: dotY,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{ scale: hovering ? 0 : 1 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 z-[100] w-[6px] h-[6px] rounded-full bg-[#A78BFA] pointer-events-none mix-blend-difference"
        aria-hidden
      />
      {/* Ring outline — lerp smooth */}
      <motion.div
        style={{
          x: ringX,
          y: ringY,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{
          width: hovering ? 56 : 28,
          height: hovering ? 56 : 28,
          borderColor: hovering ? "#A78BFA" : "rgba(245,242,234,0.55)",
          borderWidth: hovering ? 2 : 1,
        }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 z-[100] rounded-full border pointer-events-none mix-blend-difference"
        aria-hidden
      />
    </>
  );
}

// MAGNETIC BUTTON : wrapper qui attire le contenu vers le cursor au survol
// Distance = facteur 0.3 par défaut. Spring smooth, return-to-center on leave.
function MagneticButton({
  children,
  distance = 0.35,
  className = "",
}: {
  children: React.ReactNode;
  distance?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { damping: 18, stiffness: 220, mass: 0.3 });
  const sy = useSpring(y, { damping: 18, stiffness: 220, mass: 0.3 });
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (hover) {
        x.set((e.clientX - cx) * distance);
        y.set((e.clientY - cy) * distance);
      } else {
        x.set(0);
        y.set(0);
      }
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [hover, distance, x, y]);

  return (
    <motion.div
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ x: sx, y: sy }}
      className={className}
      data-magnetic
    >
      {children}
    </motion.div>
  );
}

// INFINITE MARQUEE : bande horizontale qui défile en boucle. Texte répété 6x
// pour garantir un seam invisible. Mode vélocité scroll-influenced.
// LOGO CLOUD : grille horizontale animée avec logos SVG + chips texte fallback
// Slider infini ininterrompu avec hover pause. Logos brightness-0 invert pour
// uniformiser en monochrome cream (s'inscrit dans la palette stricte).
type LogoEntry = {
  name: string;
  src?: string;
};

// Tous en wordmark texte stylés — cohérence visuelle parfaite + zero dépendance CDN externe.
const STACK_LOGOS: LogoEntry[] = [
  { name: "Shopify" },
  { name: "Next.js" },
  { name: "Three.js" },
  { name: "React" },
  { name: "R3F" },
  { name: "Meshy" },
  { name: "Flux BFL" },
  { name: "Higgsfield" },
  { name: "Vercel" },
  { name: "TypeScript" },
];

function LogoCloud({ logos = STACK_LOGOS }: { logos?: LogoEntry[] }) {
  // Duplication x2 pour seamless loop. Animation x: 0 → -50% en boucle linéaire.
  const sequence = [...logos, ...logos];

  return (
    <div className="relative overflow-hidden py-8 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <motion.div
        className="flex items-center gap-10 w-max"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ repeat: Infinity, ease: "linear", duration: 45 }}
      >
        {sequence.map((logo, i) => (
          <div
            key={i}
            className="flex items-center justify-center shrink-0"
            data-cursor-hover
          >
            <span className="border border-[#0A0A0A]/25 hover:border-[#A78BFA] text-[#0A0A0A]/80 hover:text-[#A78BFA] transition-colors text-[13px] md:text-[14px] font-black tracking-[-0.01em] px-5 py-2.5 rounded-md whitespace-nowrap">
              {logo.name}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function InfiniteMarquee({
  items,
  speed = 60,
  className = "",
  textClassName = "",
  separator = "·",
}: {
  items: string[];
  speed?: number;
  className?: string;
  textClassName?: string;
  separator?: string;
}) {
  // Duplication x4 pour assurer un loop seamless quel que soit le viewport
  const sequence = [...items, ...items, ...items, ...items];

  return (
    <div
      className={`overflow-hidden whitespace-nowrap ${className}`}
      aria-hidden
    >
      <motion.div
        className="flex whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration: speed,
        }}
      >
        {sequence.map((it, i) => (
          <span
            key={i}
            className={`inline-flex items-center mx-6 ${textClassName}`}
          >
            <span>{it}</span>
            <span className="mx-6 text-[#A78BFA] opacity-70">{separator}</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ─── TRANSITIONS ENTRE CHAMBRES (3 types distincts, scroll-trigger once) ────
// Chaque transition couvre la section au mount, anime quand viewport entre.
// z-40 au-dessus de tout le contenu, pointer-events-none, joue UNE seule fois.

// Type 1 — PORTAL CLOSE : rectangle plein écran → cercle 0 au centre, vanish
function TransitionPortal({ color }: { color: string }) {
  return (
    <motion.div
      initial={{ scale: 1, borderRadius: "0%" }}
      whileInView={{ scale: 0, borderRadius: "50%" }}
      viewport={{ once: true, margin: "-12%" }}
      transition={{ duration: 1.4, ease: [0.83, 0, 0.17, 1] }}
      className="absolute inset-0 z-40 pointer-events-none"
      style={{ backgroundColor: color, transformOrigin: "center" }}
      aria-hidden
    />
  );
}

// Type 2 — DIAGONAL SPLIT : 2 demi-triangles partent en coins opposés
function TransitionDiagonalSplit({ color }: { color: string }) {
  return (
    <>
      <motion.div
        initial={{ x: 0, y: 0 }}
        whileInView={{ x: "-110%", y: "-110%" }}
        viewport={{ once: true, margin: "-12%" }}
        transition={{ duration: 1.2, ease: [0.83, 0, 0.17, 1] }}
        className="absolute inset-0 z-40 pointer-events-none"
        style={{
          backgroundColor: color,
          clipPath: "polygon(0 0, 100% 0, 0 100%)",
        }}
        aria-hidden
      />
      <motion.div
        initial={{ x: 0, y: 0 }}
        whileInView={{ x: "110%", y: "110%" }}
        viewport={{ once: true, margin: "-12%" }}
        transition={{ duration: 1.2, ease: [0.83, 0, 0.17, 1] }}
        className="absolute inset-0 z-40 pointer-events-none"
        style={{
          backgroundColor: color,
          clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
        }}
        aria-hidden
      />
    </>
  );
}

// Type 4 — GRID REVEAL : grille N×M carrés rétractés en wave diagonal
function TransitionGridReveal({
  color,
  cols = 5,
  rows = 3,
}: {
  color: string;
  cols?: number;
  rows?: number;
}) {
  const cells = Array.from({ length: cols * rows });
  return (
    <div
      className="absolute inset-0 z-40 pointer-events-none grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
      aria-hidden
    >
      {cells.map((_, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return (
          <motion.div
            key={i}
            initial={{ scale: 1, opacity: 1 }}
            whileInView={{ scale: 0, opacity: 0 }}
            viewport={{ once: true, margin: "-12%" }}
            transition={{
              duration: 0.75,
              delay: 0.05 + (col + row) * 0.07,
              ease: [0.83, 0, 0.17, 1],
            }}
            style={{ backgroundColor: color, transformOrigin: "center" }}
          />
        );
      })}
    </div>
  );
}

// Type 5 — VERTICAL IRIS : 2 demi-écrans top/bottom s'écartent → ouverture cinéma
// Mécanique 100% GPU (transform translateY only). Thématique : iris caméra qui s'ouvre
// sur la signature finale du film.
function TransitionVerticalIris({ color }: { color: string }) {
  return (
    <>
      <motion.div
        initial={{ y: 0 }}
        whileInView={{ y: "-105%" }}
        viewport={{ once: true, margin: "-12%" }}
        transition={{ duration: 1.1, ease: [0.83, 0, 0.17, 1] }}
        className="absolute left-0 right-0 top-0 h-1/2 z-40 pointer-events-none"
        style={{ backgroundColor: color, willChange: "transform" }}
        aria-hidden
      />
      <motion.div
        initial={{ y: 0 }}
        whileInView={{ y: "105%" }}
        viewport={{ once: true, margin: "-12%" }}
        transition={{ duration: 1.1, ease: [0.83, 0, 0.17, 1] }}
        className="absolute left-0 right-0 bottom-0 h-1/2 z-40 pointer-events-none"
        style={{ backgroundColor: color, willChange: "transform" }}
        aria-hidden
      />
      {/* Filet violet horizontal central — barre de jonction qui se dilate pile au split */}
      <motion.div
        initial={{ scaleX: 0, opacity: 1 }}
        whileInView={{ scaleX: 1, opacity: 0 }}
        viewport={{ once: true, margin: "-12%" }}
        transition={{ duration: 1.1, ease: [0.83, 0, 0.17, 1] }}
        className="absolute left-0 right-0 top-1/2 h-px z-40 pointer-events-none bg-[#A78BFA]"
        style={{ transformOrigin: "center", willChange: "transform, opacity" }}
        aria-hidden
      />
    </>
  );
}

// Type 3 — VENETIAN SLATS : N lattes horizontales glissent en alternance
function TransitionSlats({
  color,
  count = 6,
}: {
  color: string;
  count?: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const fromLeft = i % 2 === 0;
        return (
          <motion.div
            key={i}
            initial={{ x: 0 }}
            whileInView={{ x: fromLeft ? "-105%" : "105%" }}
            viewport={{ once: true, margin: "-12%" }}
            transition={{
              duration: 0.95,
              delay: 0.05 + i * 0.075,
              ease: [0.83, 0, 0.17, 1],
            }}
            className="absolute left-0 right-0 z-40 pointer-events-none"
            style={{
              backgroundColor: color,
              top: `${(i / count) * 100}%`,
              height: `${100 / count + 0.6}%`,
            }}
            aria-hidden
          />
        );
      })}
    </>
  );
}

// ─── STAGGER 3D TEXT (apparition char by char, perspective CSS) ──────────────
// rotateY 90°→0 + translateZ -120→0 + blur 8px→0 + opacity 0→1
// Perspective sur le wrapper, transformStyle preserve-3d sur chaque char.
function Stagger3DText({
  text,
  className = "",
  delay = 0,
  staggerDelay = 0.045,
  duration = 0.7,
  perspective = 900,
  italic = false,
  color,
  splitByWord = false,
}: {
  text: string;
  className?: string;
  delay?: number;
  staggerDelay?: number;
  duration?: number;
  perspective?: number;
  italic?: boolean;
  color?: string;
  splitByWord?: boolean;
}) {
  // Split par mots pour préserver le wrapping naturel ; chaque mot anime
  // ses chars un à un. Espaces sont préservés entre les mots.
  const words = text.split(" ");

  return (
    <span
      className={`inline-block ${italic ? "italic" : ""} ${className}`}
      style={{ perspective: `${perspective}px` }}
    >
      {words.map((word, wi) => {
        // Index char global (compté à travers tous les mots) pour stagger continu
        const charOffsetBefore = words
          .slice(0, wi)
          .reduce((acc, w) => acc + w.length, 0);

        const wordChars = splitByWord ? [word] : Array.from(word);

        return (
          <span
            key={wi}
            className="inline-block whitespace-nowrap"
            style={{ marginRight: wi < words.length - 1 ? "0.28em" : 0 }}
          >
            {wordChars.map((char, ci) => {
              const i = splitByWord ? wi : charOffsetBefore + ci;
              return (
                <motion.span
                  key={ci}
                  initial={{
                    rotateY: 92,
                    z: -120,
                    opacity: 0,
                  }}
                  whileInView={{
                    rotateY: 0,
                    z: 0,
                    opacity: 1,
                  }}
                  viewport={{ once: true, margin: "-10%" }}
                  transition={{
                    duration,
                    delay: delay + i * staggerDelay,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{
                    display: "inline-block",
                    transformStyle: "preserve-3d",
                    transformOrigin: "left center",
                    color: color ?? "inherit",
                    willChange: "transform, opacity",
                  }}
                >
                  {char}
                </motion.span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}

// ─── BACKGROUND TOPOGRAPHIQUE (signature visuelle Lando) ────────────────────
function HeroBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke={palette.violet} strokeWidth="1" fill="none" opacity="0.12">
          <path d="M-100 200 Q400 100 800 250 T1700 200 T2500 250" />
          <path d="M-100 320 Q400 220 800 370 T1700 320 T2500 370" />
          <path d="M-100 500 Q400 380 800 530 T1700 480 T2500 520" />
          <path d="M-100 700 Q400 600 800 750 T1700 700 T2500 750" />
          <path d="M-100 880 Q400 780 800 930 T1700 880 T2500 930" />
        </g>
        <g stroke={palette.dark} strokeWidth="0.6" fill="none" opacity="0.08">
          <ellipse cx="960" cy="540" rx="780" ry="420" />
          <ellipse cx="960" cy="540" rx="620" ry="320" />
          <ellipse cx="960" cy="540" rx="460" ry="220" />
          <ellipse cx="960" cy="540" rx="300" ry="140" />
        </g>
      </svg>
    </div>
  );
}

// ─── HEADER (logo center + VERTXIA gauche + CTA droite) ─────────────────────
function HeroHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 grid grid-cols-3 items-start px-8 py-6 pointer-events-none">
      {/* VERTXIA logo top-left (cream sur vidéo dark) */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="leading-[0.85] text-[#F5F2EA]"
      >
        <div className="text-2xl md:text-3xl font-black tracking-[-0.02em] uppercase">
          Vertxia
        </div>
        <div className="text-[9px] font-mono tracking-[0.35em] uppercase opacity-60 mt-1">
          Shopify → 3D
        </div>
      </motion.div>

      {/* Monogram V top-center */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.6 }}
        className="text-center font-mono text-xs tracking-[0.3em] flex justify-center items-center gap-1 text-[#F5F2EA]"
      >
        <span className="text-base font-black">V</span>
        <span className="opacity-50">—</span>
      </motion.div>

      {/* CTA + menu top-right */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="flex justify-end gap-2 items-center pointer-events-auto"
      >
        <MagneticButton distance={0.4}>
          <a
            href="#early-access"
            className="bg-[#A78BFA] hover:bg-[#C4B5FD] text-[#0A0A0A] px-4 py-2.5 rounded-md text-[11px] font-bold tracking-[0.18em] uppercase transition-all flex items-center gap-2 shadow-lg hover:shadow-[0_0_30px_rgba(167,139,250,0.4)]"
          >
            Early Access
            <span aria-hidden>→</span>
          </a>
        </MagneticButton>
        <MagneticButton distance={0.3}>
          <button
            aria-label="Menu"
            className="border border-[#F5F2EA]/30 hover:border-[#F5F2EA]/80 hover:bg-[#F5F2EA]/10 w-10 h-10 rounded-md flex flex-col items-center justify-center gap-1.5 transition-colors"
          >
            <span className="block w-4 h-px bg-[#F5F2EA]" />
            <span className="block w-2.5 h-px bg-[#F5F2EA]" />
          </button>
        </MagneticButton>
      </motion.div>
    </header>
  );
}

// ─── HERO VIDEO (fullscreen scroll-driven) ──────────────────────────────────
// Plein écran à la place du cadre centré. Inversion palette : textes en crème.
const HeroVideo = ({
  videoRef,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
    className="absolute inset-0 w-full h-full overflow-hidden bg-[#0A0A0A]"
  >
    <video
      ref={videoRef}
      src="/videos/shopify-explosion-scroll.mp4"
      muted
      playsInline
      preload="auto"
      className="absolute inset-0 w-full h-full object-cover"
      aria-label="Vertxia Shopify to 3D cinematic transition"
    />
    {/* Halo violet subtil pour signature visuelle constante */}
    <div
      className="absolute inset-0 pointer-events-none mix-blend-soft-light opacity-40"
      style={{
        background:
          "radial-gradient(circle at 30% 40%, rgba(167,139,250,0.35) 0%, transparent 65%)",
      }}
    />
    {/* Overlay dégradé sombre pour lisibilité texte (top + bottom) */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          "linear-gradient(to bottom, rgba(8,8,8,0.55) 0%, rgba(8,8,8,0.2) 35%, rgba(8,8,8,0.25) 65%, rgba(8,8,8,0.7) 100%)",
      }}
    />
    {/* Metadata badges en coin (sur la vidéo direct, plus dans un cadre) */}
    <div className="absolute top-6 right-1/2 translate-x-[300px] text-[9px] font-mono tracking-[0.3em] uppercase text-[#F5F2EA]/60 pointer-events-none">
      [ VERTXIA RENDER 001 ]
    </div>
    <div className="absolute bottom-24 right-8 text-[9px] font-mono tracking-[0.3em] uppercase text-[#F5F2EA]/60 text-right pointer-events-none">
      16:9 · WebGL · 60fps
    </div>
    <div className="absolute bottom-24 left-8 text-[9px] font-mono tracking-[0.3em] uppercase text-[#A78BFA] pointer-events-none flex items-center gap-2">
      <span className="w-1.5 h-1.5 bg-[#A78BFA] rounded-full animate-pulse" />
      Scroll to play
    </div>
  </motion.div>
);

// ─── BUILD CARD bottom-left (équivalent NEXT RACE Lando) ────────────────────
function BuildCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-8 left-8 z-20 pointer-events-auto"
    >
      <a
        href="https://instagram.com/vertxia.fr"
        target="_blank"
        rel="noreferrer noopener"
        className="block border border-[#F5F2EA]/20 hover:border-[#F5F2EA]/60 transition-colors bg-[#0A0A0A]/40 backdrop-blur-md px-5 py-4 rounded-md min-w-[180px] text-[#F5F2EA]"
      >
        <div className="text-[9px] font-mono tracking-[0.3em] uppercase opacity-60 mb-2">
          Build —
        </div>
        <div className="text-3xl font-black leading-[0.9] tracking-[-0.02em]">
          DAY 03
        </div>
        <div className="text-[9px] font-mono tracking-[0.25em] uppercase mt-3 opacity-70">
          Toulon / France
        </div>
        <div className="text-[9px] font-mono tracking-[0.25em] uppercase mt-1 text-[#A78BFA] font-bold flex items-center gap-1">
          @vertxia.fr <span aria-hidden>↗</span>
        </div>
      </a>
    </motion.div>
  );
}

// ─── SCROLL INDICATOR bottom-right ──────────────────────────────────────────
function ScrollIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.7 }}
      transition={{ delay: 0.8, duration: 0.7 }}
      className="fixed bottom-8 right-8 z-20 text-[10px] font-mono tracking-[0.3em] uppercase pointer-events-none text-[#F5F2EA]"
    >
      <span className="opacity-90">Scroll to enter</span>{" "}
      <motion.span
        animate={{ y: [0, 4, 0] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
        className="inline-block"
      >
        ↓
      </motion.span>
    </motion.div>
  );
}

// ─── SECTION 2 : FULL 3D R3F SCENE ──────────────────────────────────────────
// Pattern validé KAGE V1 : Canvas alpha + Edges only + SMAA+Bloom+ACES+Vignette.
// TorusKnot central violet en rotation + 3 orbiteurs (icosa, octa, tetra).
// Cursor tilt lerp + auto-rotation continue. Aucun texte concurrence le 3D.

type CursorState = { nx: number; ny: number };

function MarqueeScene({
  cursorRef,
}: {
  cursorRef: React.MutableRefObject<CursorState>;
}) {
  const centerRef = useRef<THREE.Group>(null);
  const orbit1Ref = useRef<THREE.Mesh>(null);
  const orbit2Ref = useRef<THREE.Mesh>(null);
  const orbit3Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (centerRef.current) {
      const c = centerRef.current;
      // Cursor tilt + slow continuous Y-rotation
      const targetY = cursorRef.current.nx * 0.5 + t * 0.18;
      const targetX = cursorRef.current.ny * -0.3 + Math.sin(t * 0.4) * 0.08;
      c.rotation.y += (targetY - c.rotation.y) * 0.045;
      c.rotation.x += (targetX - c.rotation.x) * 0.045;
    }

    // Orbiteur 1 — icosahedron, orbit lent grande distance
    if (orbit1Ref.current) {
      const a = t * 0.55;
      const o = orbit1Ref.current;
      o.position.x = Math.cos(a) * 2.6;
      o.position.z = Math.sin(a) * 2.6;
      o.position.y = Math.sin(t * 0.8) * 0.4;
      o.rotation.x = t * 0.5;
      o.rotation.y = t * 0.4;
    }

    // Orbiteur 2 — octahedron, orbit moyen, phase décalée
    if (orbit2Ref.current) {
      const a = t * 0.38 + Math.PI * 0.7;
      const o = orbit2Ref.current;
      o.position.x = Math.cos(a) * 3.1;
      o.position.z = Math.sin(a) * 3.1;
      o.position.y = Math.cos(t * 0.6) * 0.3 + 0.6;
      o.rotation.x = -t * 0.3;
      o.rotation.y = t * 0.7;
    }

    // Orbiteur 3 — tetrahedron, contra-rotation
    if (orbit3Ref.current) {
      const a = -t * 0.48 + Math.PI;
      const o = orbit3Ref.current;
      o.position.x = Math.cos(a) * 2.9;
      o.position.z = Math.sin(a) * 2.9;
      o.position.y = -Math.sin(t * 0.7) * 0.5 - 0.4;
      o.rotation.y = t * 0.5;
      o.rotation.z = t * 0.35;
    }
  });

  return (
    <>
      {/* Centre — torusKnot crystalline (4 radial segments = ruban triangulé propre) */}
      <group ref={centerRef}>
        <mesh>
          <torusKnotGeometry args={[1.05, 0.34, 96, 4, 2, 3]} />
          <meshBasicMaterial color="#A78BFA" transparent opacity={0} />
          <Edges color="#A78BFA" threshold={1} />
        </mesh>
      </group>

      {/* Orbiteur 1 — icosahedron crème */}
      <mesh ref={orbit1Ref}>
        <icosahedronGeometry args={[0.34, 0]} />
        <meshBasicMaterial transparent opacity={0} />
        <Edges color="#F5F2EA" threshold={1} />
      </mesh>

      {/* Orbiteur 2 — octahedron violet clair */}
      <mesh ref={orbit2Ref}>
        <octahedronGeometry args={[0.3, 0]} />
        <meshBasicMaterial transparent opacity={0} />
        <Edges color="#C4B5FD" threshold={1} />
      </mesh>

      {/* Orbiteur 3 — tetrahedron violet */}
      <mesh ref={orbit3Ref}>
        <tetrahedronGeometry args={[0.4, 0]} />
        <meshBasicMaterial transparent opacity={0} />
        <Edges color="#A78BFA" threshold={1} />
      </mesh>
    </>
  );
}

function MarqueeSection() {
  const cursorRef = useRef<CursorState>({ nx: 0, ny: 0 });
  const sectionRef = useRef<HTMLElement>(null);
  // Pause complète du R3F hors viewport — élimine 40-60% GPU permanent
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      cursorRef.current.nx = (e.clientX / window.innerWidth) * 2 - 1;
      cursorRef.current.ny = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    if (!sectionRef.current) return;
    // rootMargin: pré-charge 1 viewport avant pour éviter pop-in à l'entrée
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0, rootMargin: "100% 0px 100% 0px" }
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="marquee"
      ref={sectionRef}
      className="relative w-full h-screen bg-[#0A0A0A] text-[#F5F2EA] overflow-hidden"
    >
      {/* TRANSITION 1 : Portal violet qui se rétracte (HERO → MARQUEE) */}
      <TransitionPortal color="#A78BFA" />

      {/* Canvas R3F full-screen — frameloop pausé hors viewport */}
      <div className="absolute inset-0">
        <Canvas
          frameloop={isInView ? "always" : "never"}
          camera={{ position: [0, 0.2, 5.5], fov: 50 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          }}
          dpr={[1, 1.5]}
        >
          <ambientLight intensity={0.45} />
          <pointLight position={[3, 3, 3]} intensity={0.9} color="#A78BFA" />
          <pointLight position={[-3, -2, 2]} intensity={0.4} color="#F5F2EA" />

          <Suspense fallback={null}>
            <MarqueeScene cursorRef={cursorRef} />
          </Suspense>

          <EffectComposer multisampling={0}>
            <SMAA />
            <Bloom
              intensity={0.7}
              luminanceThreshold={0.5}
              luminanceSmoothing={0.4}
              mipmapBlur
            />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <Vignette offset={0.25} darkness={0.55} />
          </EffectComposer>
        </Canvas>
      </div>

      {/* Halo violet subtle au centre pour signature visuelle */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-screen opacity-30"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(167,139,250,0.35) 0%, transparent 55%)",
        }}
      />

      {/* Overlay UI minimal (pas de gros titres — le 3D parle seul) */}
      <div className="absolute top-8 left-8 z-10 text-[10px] font-mono tracking-[0.4em] uppercase opacity-50">
        — Chapter 02
      </div>
      <div className="absolute top-8 right-8 z-10 text-[10px] font-mono tracking-[0.4em] uppercase opacity-50">
        In motion
      </div>

      {/* Subtitle bas-gauche, optionnel mais clean */}
      <div className="absolute bottom-24 left-8 z-10 max-w-[280px] text-[#F5F2EA] pointer-events-none">
        <div className="text-[9px] font-mono tracking-[0.35em] uppercase opacity-50 mb-2">
          // Manifesto
        </div>
        <div className="text-xl md:text-2xl font-black leading-[1.05] tracking-[-0.02em]">
          Speed is the{" "}
          <span className="italic text-[#A78BFA]">new luxury.</span>
        </div>
      </div>

      <div className="absolute bottom-8 left-8 z-10 text-[10px] font-mono tracking-[0.4em] uppercase opacity-50">
        Continue scrolling ↓
      </div>
      <div className="absolute bottom-8 right-8 z-10 text-[10px] font-mono tracking-[0.4em] uppercase opacity-50">
        02 / 06
      </div>
    </section>
  );
}

// ─── SECTION 3 : GALLERY moodboard Reels (équivalent "Off Track" Lando) ────
type ReelCard = {
  day: string;
  label: string;
  tone: "violet" | "dark" | "stripe";
  // Position relative en % (x, y, rotation, scale, zIndex)
  x: string;
  y: string;
  rotate: number;
  size: "sm" | "md" | "lg";
};

const REEL_CARDS: ReelCard[] = [
  { day: "01", label: "Pivot", tone: "dark", x: "8%", y: "18%", rotate: -3.5, size: "md" },
  { day: "02", label: "Higgsfield", tone: "violet", x: "30%", y: "8%", rotate: 1.8, size: "lg" },
  { day: "03", label: "Lando bench", tone: "stripe", x: "55%", y: "22%", rotate: -2, size: "md" },
  { day: "04", label: "Catalog API", tone: "dark", x: "12%", y: "62%", rotate: 2.5, size: "sm" },
  { day: "05", label: "First client", tone: "violet", x: "38%", y: "58%", rotate: -1.2, size: "md" },
  { day: "06", label: "Public beta", tone: "stripe", x: "65%", y: "65%", rotate: 3, size: "lg" },
];

function GalleryCard({ card, i }: { card: ReelCard; i: number }) {
  const sizes = {
    sm: "w-[180px] h-[230px]",
    md: "w-[220px] h-[280px]",
    lg: "w-[260px] h-[330px]",
  };

  const tones: Record<ReelCard["tone"], string> = {
    dark: "bg-[#0A0A0A]",
    violet: "bg-gradient-to-br from-[#A78BFA] via-[#7C6AD9] to-[#3E3464]",
    stripe:
      "bg-[#0A0A0A] [background-image:repeating-linear-gradient(45deg,transparent_0_10px,rgba(167,139,250,0.18)_10px_11px)]",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.94, rotate: card.rotate * 1.6 }}
      whileInView={{ opacity: 1, y: 0, scale: 1, rotate: card.rotate }}
      viewport={{ once: true, margin: "-12%" }}
      transition={{
        duration: 0.9,
        delay: i * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ scale: 1.04, rotate: 0, transition: { duration: 0.4 } }}
      className={`absolute ${sizes[card.size]} rounded-md overflow-hidden shadow-2xl cursor-pointer`}
      style={{ left: card.x, top: card.y, transformOrigin: "center" }}
    >
      {/* Visual placeholder (would be Reel screenshot in V2) */}
      <div className={`absolute inset-0 ${tones[card.tone]}`} />
      {/* Center number */}
      <div className="absolute inset-0 flex items-center justify-center text-[#F5F2EA]/90">
        <div className="text-center">
          <div className="text-[8px] font-mono tracking-[0.3em] uppercase opacity-60 mb-1">
            Reel
          </div>
          <div className="text-7xl font-black tracking-[-0.02em] leading-none">
            {card.day}
          </div>
        </div>
      </div>
      {/* Bottom label */}
      <div className="absolute bottom-3 left-3 right-3 text-[9px] font-mono tracking-[0.25em] uppercase text-[#F5F2EA]/80 flex justify-between items-center">
        <span>Day {card.day}</span>
        <span className="text-[#A78BFA]">{card.label}</span>
      </div>
      {/* Top-right tag */}
      <div className="absolute top-3 right-3 text-[7px] font-mono tracking-[0.3em] uppercase text-[#F5F2EA]/50">
        ↗
      </div>
    </motion.div>
  );
}

function GallerySection() {
  return (
    <section id="gallery" className="relative w-full min-h-[110vh] bg-[#F5F2EA] text-[#0A0A0A] overflow-hidden">
      {/* TRANSITION 2 : 2 slabs sombres en diagonal split (MARQUEE → GALLERY) */}
      <TransitionDiagonalSplit color="#0A0A0A" />

      {/* Background subtle topo */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.08]" aria-hidden>
        <svg
          className="w-full h-full"
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
        >
          <g stroke="#A78BFA" strokeWidth="1" fill="none">
            <path d="M-100 280 Q500 180 1000 320 T2100 280" />
            <path d="M-100 540 Q500 440 1000 580 T2100 540" />
            <path d="M-100 800 Q500 700 1000 840 T2100 800" />
          </g>
        </svg>
      </div>

      {/* Top label */}
      <div className="absolute top-8 left-8 z-10 text-[10px] font-mono tracking-[0.4em] uppercase opacity-50">
        — Chapter 03
      </div>
      <div className="absolute top-8 right-8 z-10 text-[10px] font-mono tracking-[0.4em] uppercase opacity-50">
        Off Build / Build in public
      </div>

      {/* Section title — top center */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-12%" }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 pt-32 px-8"
      >
        <div className="text-[10px] font-mono tracking-[0.4em] uppercase opacity-50 mb-3">
          // Behind the scenes
        </div>
        <h2 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-[-0.02em] max-w-[900px]">
          <Stagger3DText text="Built in" />{" "}
          <Stagger3DText text="public." italic color={palette.violet} delay={0.18} />
          <br />
          <Stagger3DText text="No hiding." delay={0.42} />
        </h2>
        <p className="mt-6 text-sm md:text-base opacity-70 max-w-[480px] leading-relaxed">
          Chaque journée de dev partagée. Chaque bug, chaque pivot, chaque
          décision. Vertxia se construit en transparent — pas en
          « stealth-mode ».
        </p>
      </motion.div>

      {/* Cards moodboard */}
      <div className="relative w-full h-[700px] mt-4">
        {REEL_CARDS.map((card, i) => (
          <GalleryCard key={card.day} card={card} i={i} />
        ))}
      </div>

      {/* Bottom CTA + script signature */}
      <div className="relative z-10 flex items-center justify-between px-8 pb-12">
        <a
          href="https://instagram.com/vertxia.fr"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-3 text-[10px] font-mono tracking-[0.3em] uppercase text-[#A78BFA] hover:text-[#7C6AD9] transition-colors"
        >
          Follow the build <span aria-hidden>→</span>
        </a>
        <div className="text-[10px] font-mono tracking-[0.4em] uppercase opacity-50">
          03 / 06
        </div>
      </div>
    </section>
  );
}

// ─── SECTION 4 : SHOWCASE grid (équivalent "Helmets" Lando) ─────────────────
type ShowcaseItem = {
  name: string;
  category: string;
  hueA: string;
  hueB: string;
  size: "tall" | "wide" | "square";
};

const SHOWCASE_ITEMS: ShowcaseItem[] = [
  { name: "ORBIT", category: "Sneakers", hueA: "#A78BFA", hueB: "#3E3464", size: "tall" },
  { name: "AURA", category: "Fragrance", hueA: "#1E1838", hueB: "#0A0A0A", size: "square" },
  { name: "VEIL", category: "Fashion", hueA: "#7C6AD9", hueB: "#1A1530", size: "wide" },
  { name: "MASS", category: "Sculpture", hueA: "#5B4ABE", hueB: "#0A0A0A", size: "square" },
  { name: "GLOW", category: "Beauty", hueA: "#C4B5FD", hueB: "#4C3F8E", size: "tall" },
  { name: "STILL", category: "Lifestyle", hueA: "#2A2348", hueB: "#0A0A0A", size: "wide" },
];

function ShowcaseCard({ item, i }: { item: ShowcaseItem; i: number }) {
  const sizes = {
    tall: "row-span-2 aspect-[3/5]",
    wide: "col-span-2 aspect-[5/3]",
    square: "aspect-square",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{
        duration: 0.8,
        delay: i * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ scale: 1.02, transition: { duration: 0.4 } }}
      className={`relative ${sizes[item.size]} rounded-md overflow-hidden bg-[#0A0A0A] border border-[#F5F2EA]/10 group cursor-pointer`}
    >
      {/* Background gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 30% 25%, ${item.hueA} 0%, ${item.hueB} 65%, #0A0A0A 100%)`,
        }}
      />
      {/* Halo overlay */}
      <div
        className="absolute inset-0 mix-blend-soft-light opacity-50"
        style={{
          background:
            "radial-gradient(circle at 70% 80%, rgba(255,255,255,0.18) 0%, transparent 55%)",
        }}
      />
      {/* Top-left tag */}
      <div className="absolute top-4 left-4 text-[8px] font-mono tracking-[0.3em] uppercase text-[#F5F2EA]/70 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-[#A78BFA] rounded-full" />
        AI-Generated
      </div>
      {/* Top-right corner cut style (matches Lando helmet cards angular) */}
      <div className="absolute top-4 right-4 w-3 h-3 border-t border-r border-[#F5F2EA]/30" />
      {/* Center brand name */}
      <div className="absolute inset-0 flex items-center justify-center">
        <h3 className="text-5xl md:text-6xl font-black tracking-[-0.02em] text-[#F5F2EA] leading-none">
          {item.name}
        </h3>
      </div>
      {/* Bottom-left category */}
      <div className="absolute bottom-4 left-4 text-[9px] font-mono tracking-[0.3em] uppercase text-[#F5F2EA]/80">
        {item.category}
      </div>
      {/* Bottom-right metadata */}
      <div className="absolute bottom-4 right-4 text-[9px] font-mono tracking-[0.3em] uppercase text-[#A78BFA] opacity-0 group-hover:opacity-100 transition-opacity">
        View ↗
      </div>
      {/* Subtle corner accent */}
      <div className="absolute bottom-4 right-4 w-3 h-3 border-b border-r border-[#F5F2EA]/30 group-hover:opacity-0 transition-opacity" />
    </motion.div>
  );
}

function ShowcaseSection() {
  return (
    <section id="showcase" className="relative w-full min-h-screen bg-[#0A0A0A] text-[#F5F2EA] overflow-hidden py-24">
      {/* TRANSITION 3 : 6 lattes crème venetian alternées (GALLERY → SHOWCASE) */}
      <TransitionSlats color="#F5F2EA" count={6} />

      {/* Top labels */}
      <div className="absolute top-8 left-8 z-10 text-[10px] font-mono tracking-[0.4em] uppercase opacity-50">
        — Chapter 04
      </div>
      <div className="absolute top-8 right-8 z-10 text-[10px] font-mono tracking-[0.4em] uppercase opacity-50">
        Showcase / From your URL
      </div>

      {/* Section title */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-12%" }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 pt-24 px-8 max-w-7xl mx-auto"
      >
        <div className="text-[10px] font-mono tracking-[0.4em] uppercase opacity-50 mb-3">
          // Each site, unique
        </div>
        <h2 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-[-0.02em] max-w-[900px]">
          <Stagger3DText text="From your URL." />
          <br />
          <Stagger3DText text="To this." italic color={palette.violet} delay={0.38} />
        </h2>
        <p className="mt-6 text-sm md:text-base opacity-70 max-w-[520px] leading-relaxed">
          Aucun template. Chaque site Vertxia est généré par IA selon ton
          catalogue Shopify et ton univers de marque. Le résultat sort en moins
          de 10 minutes.
        </p>
      </motion.div>

      {/* Grid showcase */}
      <div className="relative z-10 mt-16 px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-3 grid-rows-2 gap-4 md:gap-6 auto-rows-fr">
          {SHOWCASE_ITEMS.map((item, i) => (
            <ShowcaseCard key={item.name} item={item} i={i} />
          ))}
        </div>
      </div>

      {/* Bottom row */}
      <div className="relative z-10 mt-12 px-8 max-w-7xl mx-auto flex justify-between items-center text-[10px] font-mono tracking-[0.4em] uppercase">
        <span className="opacity-70">
          + 6 categories generated by AI
        </span>
        <span className="opacity-50">04 / 06</span>
      </div>
    </section>
  );
}

// ─── SECTION 5 : STACK / TOOLS éditorial split (équivalent "Partners" Lando) ─
type StackItem = {
  num: string;
  name: string;
  category: string;
  meta: string;
};

const STACK_ITEMS: StackItem[] = [
  { num: "01", name: "Shopify",    category: "Storefront API",  meta: "Source of truth" },
  { num: "02", name: "Next.js",    category: "Framework",        meta: "v15 · App Router" },
  { num: "03", name: "Three.js",   category: "3D Engine",        meta: "WebGL2" },
  { num: "04", name: "R3F",        category: "React 3D",         meta: "+ Drei + Post-FX" },
  { num: "05", name: "Meshy",      category: "3D Generation",    meta: "300k poly UHQ" },
  { num: "06", name: "Flux BFL",   category: "Image AI",         meta: "Textures + props" },
  { num: "07", name: "Higgsfield", category: "Video AI",         meta: "Cinematic motion" },
  { num: "08", name: "Vercel",     category: "Deploy",           meta: "Edge runtime" },
];

function StackRow({ item, i }: { item: StackItem; i: number }) {
  return (
    <motion.a
      href="#"
      onClick={(e) => e.preventDefault()}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8%" }}
      transition={{
        duration: 0.7,
        delay: 0.1 + i * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ paddingLeft: 14 }}
      className="group block border-t border-[#0A0A0A]/10 py-7 md:py-8 transition-colors"
    >
      <div className="flex items-baseline gap-6 md:gap-10">
        <span className="text-[10px] font-mono tracking-[0.3em] uppercase opacity-40 group-hover:opacity-80 group-hover:text-[#A78BFA] transition-colors w-8 shrink-0">
          {item.num}
        </span>
        <span className="text-3xl md:text-5xl font-black tracking-[-0.02em] leading-none group-hover:text-[#A78BFA] transition-colors">
          {item.name}
        </span>
        <span className="hidden md:block flex-1 border-t border-dashed border-[#0A0A0A]/20 group-hover:border-[#A78BFA]/60 transition-colors translate-y-[-4px]" />
        <span className="text-[10px] font-mono tracking-[0.3em] uppercase opacity-60 group-hover:opacity-100 group-hover:text-[#A78BFA] transition-colors text-right shrink-0">
          {item.category}
        </span>
        <span className="hidden lg:block text-[10px] font-mono tracking-[0.25em] uppercase opacity-40 text-right w-[160px] shrink-0">
          {item.meta}
        </span>
        <span className="text-[10px] font-mono opacity-0 group-hover:opacity-80 group-hover:text-[#A78BFA] transition-all -translate-x-2 group-hover:translate-x-0">
          ↗
        </span>
      </div>
    </motion.a>
  );
}

function StackSection() {
  return (
    <section id="stack" className="relative w-full min-h-screen bg-[#F5F2EA] text-[#0A0A0A] overflow-hidden py-24">
      {/* TRANSITION 4 : Grid reveal cream wave diagonal (SHOWCASE → STACK) */}
      <TransitionGridReveal color="#F5F2EA" cols={5} rows={3} />

      {/* Background subtle topo lignes (signature cohérente avec Gallery) */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.06]" aria-hidden>
        <svg
          className="w-full h-full"
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
        >
          <g stroke="#A78BFA" strokeWidth="1" fill="none">
            <path d="M-100 220 Q500 130 1000 280 T2100 240" />
            <path d="M-100 480 Q500 380 1000 540 T2100 500" />
            <path d="M-100 760 Q500 670 1000 820 T2100 780" />
          </g>
        </svg>
      </div>

      {/* Top labels */}
      <div className="absolute top-8 left-8 z-10 text-[10px] font-mono tracking-[0.4em] uppercase opacity-50">
        — Chapter 05
      </div>
      <div className="absolute top-8 right-8 z-10 text-[10px] font-mono tracking-[0.4em] uppercase opacity-50">
        Stack / Powered by
      </div>

      <div className="relative z-10 px-8 pt-24 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* LEFT — manifesto */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-12%" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5 lg:sticky lg:top-32 self-start"
          >
            <div className="text-[10px] font-mono tracking-[0.4em] uppercase opacity-50 mb-4">
              // The toolbox
            </div>
            <h2 className="text-5xl md:text-6xl font-black leading-[0.95] tracking-[-0.02em]">
              No magic.
              <br />
              Just the{" "}
              <span className="italic text-[#A78BFA]">right tools</span>,
              <br />
              wired right.
            </h2>
            <p className="mt-6 text-sm md:text-base opacity-70 max-w-[420px] leading-relaxed">
              Vertxia est un assemblage. Chaque outil de la stack a été choisi
              pour une raison : qualité, vitesse, ou inexistence d&apos;une
              alternative. Zéro vendor lock-in caché.
            </p>

            {/* Ornement signature */}
            <div className="mt-10 flex items-center gap-4">
              <span className="block w-12 h-px bg-[#A78BFA]" />
              <span className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#A78BFA] font-bold">
                08 tools · 0 vendor lock
              </span>
            </div>

            <div className="mt-8 text-[10px] font-mono tracking-[0.25em] uppercase opacity-50 leading-relaxed">
              Built &amp; maintained from
              <br />
              <span className="text-[#0A0A0A] opacity-80">Toulon, France</span> · 2026
            </div>
          </motion.div>

          {/* RIGHT — éditorial list */}
          <div className="lg:col-span-7">
            <div className="hidden md:flex items-baseline gap-6 md:gap-10 pb-3 text-[9px] font-mono tracking-[0.3em] uppercase opacity-40">
              <span className="w-8 shrink-0">N°</span>
              <span className="text-base">Tool</span>
              <span className="flex-1" />
              <span className="text-right shrink-0">Role</span>
              <span className="hidden lg:block text-right w-[160px] shrink-0">Notes</span>
              <span className="w-3" />
            </div>
            {STACK_ITEMS.map((item, i) => (
              <StackRow key={item.num} item={item} i={i} />
            ))}
            {/* Border-bottom finale pour fermer la liste */}
            <div className="border-t border-[#0A0A0A]/10" />
          </div>
        </div>
      </div>

      {/* LOGO CLOUD — défile infini en monochrome cohérent avec la palette */}
      <div className="relative z-10 mt-20 px-0 max-w-none mx-auto">
        <div className="px-8 max-w-7xl mx-auto mb-4">
          <div className="text-[10px] font-mono tracking-[0.4em] uppercase opacity-50 flex items-center gap-4">
            <span className="block w-12 h-px bg-[#0A0A0A]/30" />
            All ten layers in motion
          </div>
        </div>
        <LogoCloud />
      </div>

      {/* Bottom row */}
      <div className="relative z-10 mt-16 px-8 max-w-7xl mx-auto flex justify-between items-center text-[10px] font-mono tracking-[0.4em] uppercase">
        <span className="opacity-70">
          Modular by design — swap any layer at any time
        </span>
        <span className="opacity-50">05 / 06</span>
      </div>
    </section>
  );
}

// ─── SECTION 6 : FOOTER signature finale (équivalent "Sign-off" Lando) ──────
// Hero CTA early-access + 3-col info + mega-typo VERTXIA + copyright row.
// bg dark #0A0A0A — alternance crème→dark depuis Chambre 5.
// Transition d'entrée : VerticalIris (5e pattern unique).

const FOOTER_COLUMNS = [
  {
    title: "Le studio",
    items: [
      { label: "Vertxia est un studio IA." },
      { label: "Catalogue Shopify importé." },
      { label: "Site immersif 3D livré." },
      { label: "En moins d'une semaine." },
    ],
  },
  {
    title: "Connect",
    items: [
      { label: "Instagram @vertxia.fr", href: "https://instagram.com/vertxia.fr" },
      { label: "LinkedIn /emilien-behague", href: "https://linkedin.com/in/emilien-behague-9697a1364" },
      { label: "Email emilien@vertxia.com", href: "mailto:emilien@vertxia.com" },
    ],
  },
  {
    title: "Build",
    items: [
      { label: "Day 03 — Build in public" },
      { label: "Toulon, France" },
      { label: "v0.1 alpha — May 2026" },
      { label: "10 places · beta privée" },
    ],
  },
] as const;

// Mega-typo reveal pattern : wrapper observé (toujours dans viewport) + motion.h1
// animé via useInView. Le h1 translaté de 105% sort du viewport, donc whileInView
// direct ne trigger pas — on observe le PARENT visible à la place.
function MegaTypoVertxia() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapperRef, { once: true, amount: 0.2 });

  return (
    <div ref={wrapperRef} className="relative mt-12 mb-8">
      <div className="overflow-hidden leading-[0.85]">
        <motion.h1
          initial={{ y: "105%" }}
          animate={inView ? { y: 0 } : { y: "105%" }}
          transition={{ duration: 1.3, ease: [0.83, 0, 0.17, 1], delay: 0.2 }}
          className="text-[14vw] font-black leading-[0.85] tracking-[-0.06em] text-[#F5F2EA] select-none whitespace-nowrap text-center"
          aria-label="Vertxia"
        >
          VERTXIA
        </motion.h1>
      </div>
      {/* Underline violet final */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
        transition={{ duration: 1.4, ease: [0.83, 0, 0.17, 1], delay: 1.2 }}
        className="absolute left-0 right-0 -bottom-1 h-[3px] bg-[#A78BFA]"
        style={{ transformOrigin: "left" }}
      />
    </div>
  );
}

function EarlyAccessForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent">("idle");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("sent");
    setTimeout(() => {
      setStatus("idle");
      setEmail("");
    }, 2400);
  };

  return (
    <form onSubmit={submit} className="w-full max-w-[440px]">
      <div className="relative flex items-stretch border border-[#F5F2EA]/20 rounded-md overflow-hidden bg-[#F5F2EA]/5 focus-within:border-[#A78BFA] focus-within:ring-2 focus-within:ring-[#A78BFA]/30 transition-all">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@studio.com"
          aria-label="Email pour Early Access"
          disabled={status === "sent"}
          className="flex-1 bg-transparent text-[#F5F2EA] placeholder:text-[#F5F2EA]/30 text-sm font-mono tracking-wide px-4 py-4 focus:outline-none disabled:opacity-50"
        />
        <motion.button
          type="submit"
          disabled={status === "sent"}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          data-magnetic
          className="bg-[#A78BFA] hover:bg-[#C4B5FD] text-[#0A0A0A] px-5 text-[11px] font-bold tracking-[0.18em] uppercase transition-colors flex items-center gap-2 hover:shadow-[0_0_40px_rgba(167,139,250,0.5)] disabled:opacity-60"
        >
          <AnimatePresence mode="wait" initial={false}>
            {status === "sent" ? (
              <motion.span
                key="sent"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2"
              >
                Reçu <span aria-hidden>✓</span>
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2"
              >
                Early Access <span aria-hidden>→</span>
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
      <p className="mt-4 text-[10px] font-mono tracking-[0.25em] uppercase text-[#F5F2EA]/40">
        Aucun spam. Réponse sous 24h. 10 places.
      </p>
    </form>
  );
}

function FooterSection() {
  return (
    <section
      id="early-access"
      className="relative w-full bg-[#0A0A0A] text-[#F5F2EA] overflow-hidden pt-32 pb-12"
    >
      {/* TRANSITION 5 : Vertical Iris dark qui s'ouvre (STACK → FOOTER) */}
      <TransitionVerticalIris color="#0A0A0A" />

      {/* Background topo lignes violet subtil (signature visuelle cohérente) */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05]" aria-hidden>
        <svg
          className="w-full h-full"
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
        >
          <g stroke="#A78BFA" strokeWidth="1" fill="none">
            <path d="M-100 240 Q500 140 1000 300 T2100 260" />
            <path d="M-100 520 Q500 420 1000 580 T2100 540" />
            <path d="M-100 800 Q500 700 1000 860 T2100 820" />
          </g>
        </svg>
      </div>

      {/* Top labels — cohérence avec Chambres 2-5 */}
      <div className="absolute top-8 left-8 z-10 text-[10px] font-mono tracking-[0.4em] uppercase opacity-50">
        — Chapter 06
      </div>
      <div className="absolute top-8 right-8 z-10 text-[10px] font-mono tracking-[0.4em] uppercase opacity-50">
        Sign-off / Early Access
      </div>

      {/* HERO area — Title + Form */}
      <div className="relative z-10 px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* LEFT — title + form (col 7) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-12%" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-7"
          >
            <div className="text-[10px] font-mono tracking-[0.4em] uppercase opacity-50 mb-4">
              // Sign-off
            </div>
            <h2 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-[-0.02em] max-w-[700px]">
              <Stagger3DText text="Time to" />
              <br />
              <Stagger3DText
                text="take off."
                italic
                color={palette.violet}
                delay={0.32}
              />
            </h2>
            <p className="mt-6 text-sm md:text-base opacity-70 max-w-[480px] leading-relaxed">
              10 places dans la beta privée. Le moteur 3D, l&apos;import
              catalogue, l&apos;accès direct. Tu envoies ton URL Shopify, tu
              reçois ton site en moins d&apos;une semaine.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-12%" }}
              transition={{
                duration: 0.7,
                delay: 0.4,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-10"
            >
              <EarlyAccessForm />
            </motion.div>
          </motion.div>

          {/* RIGHT — 3 cols info (col 5) */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-8 lg:gap-6 xl:gap-8 self-end">
            {FOOTER_COLUMNS.map((col, ci) => (
              <motion.div
                key={col.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{
                  duration: 0.7,
                  delay: 0.2 + ci * 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <h4 className="text-[10px] font-mono tracking-[0.35em] uppercase text-[#A78BFA] mb-5 font-bold">
                  {col.title}
                </h4>
                <ul className="space-y-3">
                  {col.items.map((it, i) => {
                    const href = "href" in it ? it.href : undefined;
                    const content = (
                      <span
                        className={`block text-[12px] font-mono tracking-[0.05em] leading-relaxed ${href ? "text-[#F5F2EA]/70 hover:text-[#A78BFA] transition-colors" : "text-[#F5F2EA]/60"}`}
                      >
                        {it.label}
                        {href && <span aria-hidden className="ml-1.5">↗</span>}
                      </span>
                    );
                    return (
                      <li key={i}>
                        {href ? (
                          <a
                            href={href}
                            target={href.startsWith("http") ? "_blank" : undefined}
                            rel={href.startsWith("http") ? "noreferrer noopener" : undefined}
                          >
                            {content}
                          </a>
                        ) : (
                          content
                        )}
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Separator */}
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 1.2, ease: [0.83, 0, 0.17, 1], delay: 0.3 }}
          className="mt-28 h-px bg-[#F5F2EA]/20"
          style={{ transformOrigin: "left" }}
        />
      </div>

      {/* INFINITE MARQUEE — bande signature en pleine largeur (pas confinée au max-w-7xl) */}
      <div className="relative w-full overflow-hidden mt-16 mb-12 border-y border-[#F5F2EA]/10 py-6 bg-[#0A0A0A]">
        <InfiniteMarquee
          items={[
            "VERTXIA",
            "BUILD IN PUBLIC",
            "DAY 03",
            "TOULON · FRANCE",
            "10 PLACES",
            "EARLY ACCESS",
            "SHOPIFY → 3D",
            "06.06.2026",
          ]}
          speed={45}
          textClassName="text-[10vw] md:text-[8vw] font-black tracking-[-0.04em] text-[#F5F2EA] leading-none uppercase"
        />
      </div>

      {/* MEGA-TYPO VERTXIA — pleine largeur viewport (PAS confinée au max-w-7xl)
          Signature visuelle finale qui occupe la largeur entière du site. */}
      <div className="relative w-full px-6">
        <MegaTypoVertxia />
      </div>

      <div className="relative z-10 px-8 max-w-7xl mx-auto">
        {/* Copyright row */}
        <div className="mt-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-[10px] font-mono tracking-[0.3em] uppercase">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[#F5F2EA]/50">
            <span>© 2026 Vertxia</span>
            <span aria-hidden className="text-[#F5F2EA]/20">·</span>
            <span>Built in Toulon · France</span>
            <span aria-hidden className="text-[#F5F2EA]/20">·</span>
            <span className="text-[#A78BFA]">Day 03</span>
            <span aria-hidden className="text-[#F5F2EA]/20">·</span>
            <span>v0.1 alpha</span>
          </div>
          <div className="flex items-center gap-3 text-[#F5F2EA]/50">
            <span className="w-1.5 h-1.5 bg-[#A78BFA] rounded-full animate-pulse" />
            <span>06 / 06 — End of transmission</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── PAGE ───────────────────────────────────────────────────────────────────
export default function VertxiaV2Page() {
  const heroContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Scroll progress 0→1 sur la durée du container hero (200vh)
  const { scrollYProgress } = useScroll({
    target: heroContainerRef,
    offset: ["start start", "end end"],
  });

  // Pilote currentTime via rAF — throttle pour éliminer forced reflow
  // 1 seek par frame max, pas par event scroll (qui peut être 120Hz+)
  const pendingTargetRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const v = videoRef.current;
    if (!v || !v.duration || isNaN(v.duration)) return;
    pendingTargetRef.current = Math.max(
      0,
      Math.min(v.duration - 0.05, latest * v.duration)
    );
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const target = pendingTargetRef.current;
      if (target === null || !videoRef.current) return;
      const vid = videoRef.current;
      if (Math.abs(vid.currentTime - target) > 0.04) {
        vid.currentTime = target;
      }
    });
  });

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  return (
    <main className="relative w-full bg-[#F5F2EA] text-[#0A0A0A] overflow-x-clip font-sans antialiased cursor-none">
      {/* GLOBAL UX LAYER — scroll progress + chapter nav + custom cursor */}
      <ScrollProgressBar />
      <ChapterIndicator />
      <CustomCursor />
      {/* HERO — section haute (400vh) avec inner sticky 100vh.
          Sticky-active range = 300vh (~2640px), donne 1:1 scroll/vidéo cinéma. */}
      <section
        id="hero"
        ref={heroContainerRef}
        className="relative w-full"
        style={{ height: "400vh" }}
      >
        <div className="sticky top-0 h-screen w-full overflow-hidden bg-[#0A0A0A]">
          <HeroVideo videoRef={videoRef} />
          <HeroHeader />
          <BuildCard />
          <ScrollIndicator />
        </div>
      </section>

      {/* SECTION 2 — MARQUEE infinite scroll horizontal */}
      <MarqueeSection />

      {/* SECTION 3 — GALLERY moodboard Reels build-in-public */}
      <GallerySection />

      {/* SECTION 4 — SHOWCASE grid sites Vertxia générés par IA */}
      <ShowcaseSection />

      {/* SECTION 5 — STACK / Tools éditorial split */}
      <StackSection />

      {/* SECTION 6 — FOOTER signature finale + early access */}
      <FooterSection />
    </main>
  );
}
