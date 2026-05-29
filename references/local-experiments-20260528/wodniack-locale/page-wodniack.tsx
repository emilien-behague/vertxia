"use client";

/**
 * VERTXIA homepage — V2 mai 2026.
 *
 * Clone direct du style wodniack.dev :
 *   - Palette EXACTE : bg #160000 (noir warm rouge) · accent #f40c3f (rouge vif)
 *     · text #fff0eb (crème). Toggle contraste inverse.
 *   - Typo EXACTE : PP Editorial New (serif) + PP Fraktion Mono (mono UI)
 *     + Bigger Display (titres géants). Fonts woff2 copiées dans /public/fonts/wodniack/.
 *   - Structure : header sticky avec console + nav + contrast toggle + availability + QR,
 *     hero, about, work gallery (vidéos en loop), my way (timeline), CTA kinetic, contact.
 *
 * Mécanique signature ajoutée par Emilien : **greeting + chapter qui change selon
 * l'heure de la journée** (cf. lib/use-time-of-day.ts).
 */

import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { useTimeOfDay } from "@/lib/use-time-of-day";

/* ═══════════════════════════════════════════════════════════════════════════
 * DATA — 5 templates Vertxia, présentés à la Wodniack (codes + captions)
 * ═══════════════════════════════════════════════════════════════════════════ */

const WORK = [
  { code: "#vtx1-0001/05", brand: "LOOM", product: "Les Derbies Femme", href: "/preview/loom" },
  { code: "#vtx2-0002/05", brand: "ALLBIRDS", product: "Wool Runner", href: "/preview/allbirds" },
  { code: "#vtx3-0003/05", brand: "TIKAMOON", product: "Coffee Tek Meuble TV", href: "/preview/tikamoon" },
  { code: "#vtx4-0004/05", brand: "BUU'KOFF", product: "DBZ Trunks Solid Edge", href: "/preview/buukoff" },
  { code: "#vtx5-0005/05", brand: "JIRAYA", product: "Naruto Ichiban Kuji Sage", href: "/preview/jiraya" },
];

const TIMELINE = [
  { year: "2019", text: "Premières lignes de code." },
  { year: "2021", text: "React, Next.js, TypeScript." },
  { year: "2024", text: "Three.js, WebGL. Design systems." },
  { year: "2026", text: "Vertxia. Solo. Toulon." },
];

/* ═══════════════════════════════════════════════════════════════════════════
 * COMPOSANTS
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Logo SVG "VTX" — équivalent du "AW" Wodniack, deux barres parallèles. */
function VtxLogo({ color }: { color: string }) {
  return (
    <svg width="44" height="44" viewBox="0 0 280 280" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Vertxia">
      {/* V */}
      <path d="M0 0L70 220L140 0H100L70 130L40 0H0Z" fill={color} />
      {/* T */}
      <path d="M150 0V35H180V280H220V35H250V0H150Z" fill={color} />
    </svg>
  );
}

/** Toggle contraste — cercle moitié rempli, copie de wodniack. */
function ContrastToggle({
  inverted,
  onToggle,
  color,
}: {
  inverted: boolean;
  onToggle: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onToggle}
      type="button"
      className="w-6 h-6 flex items-center justify-center transition-transform duration-300"
      style={{ color }}
      aria-label="Change contrast"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="9.5" stroke="currentColor" strokeWidth="1" />
        <path
          d={inverted ? "M10 0.5 A9.5 9.5 0 0 0 10 19.5 Z" : "M10 0.5 A9.5 9.5 0 0 1 10 19.5 Z"}
          fill="currentColor"
        />
      </svg>
    </button>
  );
}

/** Bande binaire décorative entre sections (signature Wodniack). */
function BinaryStrip({ density = 120 }: { density?: number }) {
  const pattern = Array.from({ length: density })
    .map((_, i) => (i * 7919 + 13) % 2)
    .join(" ");
  return (
    <div
      className="font-fraktion text-[10px] tracking-[0.25em] py-2 overflow-hidden whitespace-nowrap select-none"
      style={{ opacity: 0.18 }}
      aria-hidden
    >
      {pattern}
    </div>
  );
}

/** Reveal hook simple. */
function useReveal(threshold = 0.18) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PAGE
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function VertxiaPage() {
  const { mounted, palette, timestamp, hour } = useTimeOfDay();

  // Toggle contraste manuel — local au visual (override la palette time-of-day pour les couleurs principales)
  const [inverted, setInverted] = useState(false);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem("vertxia.inverted");
      if (v === "1") setInverted(true);
    } catch {}
  }, []);
  const toggleInverted = () => {
    setInverted((v) => {
      const next = !v;
      try {
        window.localStorage.setItem("vertxia.inverted", next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  // Palette EXACTE wodniack avec inversion contrastée
  const BG = inverted ? "#fff0eb" : "#160000";
  const FG = inverted ? "#160000" : "#fff0eb";
  const ACCENT = "#f40c3f";

  // Lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, []);

  // Détermine le greeting selon l'heure
  const greeting =
    hour < 5 ? "Bonne nuit." :
    hour < 12 ? "Bonjour." :
    hour < 17 ? "Bon après-midi." :
    hour < 21 ? "Bonsoir." :
    "Bonne nuit.";

  // Server-side initial render : color neutre crème pour éviter flash
  if (!mounted) {
    return <div style={{ background: "#fff0eb", minHeight: "100vh" }} aria-hidden />;
  }

  return (
    <div
      className="min-h-screen transition-colors duration-700"
      style={{
        background: BG,
        color: FG,
        fontFamily: '"Editorial New", serif',
      }}
    >
      {/* ───────────────────────────────── HEADER ────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 px-6 md:px-10 py-5 flex items-center justify-between border-b transition-colors duration-700"
        style={{
          background: `${BG}d8`,
          backdropFilter: "blur(12px)",
          borderColor: `${FG}1f`,
        }}
      >
        {/* Logo + console */}
        <div className="flex items-center gap-6">
          <a href="#hero" aria-label="Vertxia">
            <VtxLogo color={FG} />
          </a>
          <div className="hidden md:flex font-fraktion text-[11px] tracking-[0.22em] uppercase" style={{ opacity: 0.6 }}>
            <span>Vertxia · Toulon · {timestamp}</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-10 font-fraktion text-[11px] tracking-[0.22em] uppercase">
          <a href="#about" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.7, color: FG }}>
            About
          </a>
          <a href="#work" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.7, color: FG }}>
            Work
          </a>
          <a href="#contact" className="hover:opacity-100 transition-opacity" style={{ opacity: 0.7, color: FG }}>
            Contact
          </a>
        </nav>

        {/* Right block : availability + contrast + QR */}
        <div className="flex items-center gap-6">
          <aside className="hidden lg:block max-w-[14rem] text-right font-fraktion text-[10px] leading-[1.4] tracking-[0.12em] uppercase" style={{ opacity: 0.7 }}>
            <span>Coding solo depuis la France.</span>
            <br />
            <span>Available for clients →</span>{" "}
            <a href="mailto:emilien@vertxia.com" className="underline decoration-1 underline-offset-2" style={{ color: ACCENT }}>
              Hire me
            </a>
          </aside>
          <ContrastToggle inverted={inverted} onToggle={toggleInverted} color={FG} />
        </div>
      </header>

      {/* ───────────────────────────────── HERO ────────────────────── */}
      <section id="hero" className="relative min-h-screen flex flex-col justify-end px-6 md:px-10 pt-32 pb-12">
        {/* Greeting time-aware */}
        <div className="font-fraktion text-[11px] tracking-[0.3em] uppercase mb-10" style={{ opacity: 0.55 }}>
          <span style={{ color: ACCENT }}>·</span> {greeting} {palette.label}, {timestamp}.
        </div>

        {/* Titre massif Bigger Display */}
        <h1
          className="font-bigger leading-[0.85] tracking-[-0.02em] mb-12"
          style={{
            fontFamily: '"Bigger Display", sans-serif',
            fontSize: "clamp(80px, 16vw, 240px)",
            fontWeight: 700,
          }}
        >
          Solo
          <br />
          <span style={{ color: ACCENT }}>Creative</span>
          <br />
          Builder.
        </h1>

        {/* Sous-titre en Editorial */}
        <div className="max-w-3xl mb-10 grid md:grid-cols-12 gap-6">
          <div className="md:col-span-2 font-fraktion text-[10px] tracking-[0.3em] uppercase" style={{ opacity: 0.55 }}>
            #hero-0000/01
          </div>
          <div className="md:col-span-10 text-xl md:text-3xl leading-[1.3]" style={{ fontFamily: '"Editorial New", serif' }}>
            Je transforme n'importe quelle boutique Shopify en{" "}
            <span style={{ color: ACCENT, fontStyle: "italic" }}>site 3D cinéma</span>{" "}
            en 30 minutes. Seul. En public.{" "}
            <span style={{ opacity: 0.55 }}>Pipeline IA codé main pour les marques DTC qui ne peuvent pas se payer une agence à 50 000 €.</span>
          </div>
        </div>
      </section>

      <BinaryStrip />

      {/* ───────────────────────────────── ABOUT ────────────────────── */}
      <section id="about" className="px-6 md:px-10 py-32 md:py-48 border-t" style={{ borderColor: `${FG}1a` }}>
        <div className="font-fraktion text-[11px] tracking-[0.3em] uppercase mb-16" style={{ opacity: 0.55 }}>
          [ 01 ] — About / Le builder
        </div>

        <div className="grid md:grid-cols-12 gap-12 mb-16">
          <div className="md:col-span-2 font-fraktion text-[10px] tracking-[0.3em] uppercase" style={{ opacity: 0.55 }}>
            #abt-0000/01
          </div>
          <div className="md:col-span-10">
            <h2
              className="font-bigger leading-[0.92] tracking-[-0.02em] mb-12"
              style={{
                fontFamily: '"Bigger Display", sans-serif',
                fontSize: "clamp(48px, 9vw, 140px)",
              }}
            >
              Hi, je suis{" "}
              <span style={{ color: ACCENT, fontFamily: '"Editorial New", serif', fontStyle: "italic", fontWeight: 200 }}>
                Emilien
              </span>
              .
            </h2>

            <div
              className="max-w-2xl text-lg md:text-2xl leading-[1.4] space-y-6"
              style={{ fontFamily: '"Editorial New", serif' }}
            >
              <p>
                Solo creative builder basé à Toulon. <span style={{ opacity: 0.55 }}>Je code depuis 2019, en boucle de feedback en public depuis 2024.</span>
              </p>
              <p style={{ opacity: 0.75 }}>
                Vertxia est mon SaaS solo : pipeline IA qui transforme une URL Shopify en site 3D immersif type Adidas Chile 20 ou Apple Vision Pro. 30 minutes au lieu de 4 mois. 99 €/mois au lieu de 50 000 €.
              </p>
              <p style={{ opacity: 0.55 }}>
                Je documente chaque ligne de code, chaque échec, chaque learning sur Instagram. Sans filtre.
              </p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="grid md:grid-cols-12 gap-12 pt-16 border-t" style={{ borderColor: `${FG}1a` }}>
          <div className="md:col-span-2 font-fraktion text-[10px] tracking-[0.3em] uppercase" style={{ opacity: 0.55 }}>
            #way-0000/04
          </div>
          <div className="md:col-span-10 grid grid-cols-2 md:grid-cols-4 gap-8">
            {TIMELINE.map((t) => (
              <div key={t.year}>
                <div
                  className="font-bigger mb-3"
                  style={{
                    fontFamily: '"Bigger Display", sans-serif',
                    fontSize: "clamp(36px, 4vw, 64px)",
                    color: ACCENT,
                  }}
                >
                  {t.year}
                </div>
                <div className="font-fraktion text-[11px] leading-snug tracking-[0.14em] uppercase" style={{ opacity: 0.65 }}>
                  {t.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <BinaryStrip />

      {/* ───────────────────────────────── WORK ────────────────────── */}
      <section id="work" className="px-6 md:px-10 py-32 md:py-48 border-t" style={{ borderColor: `${FG}1a`, background: ACCENT, color: BG }}>
        <div className="font-fraktion text-[11px] tracking-[0.3em] uppercase mb-16" style={{ opacity: 0.7 }}>
          [ 02 ] — Work / 5 templates live
        </div>

        <h2
          className="font-bigger leading-[0.9] tracking-[-0.02em] mb-20"
          style={{
            fontFamily: '"Bigger Display", sans-serif',
            fontSize: "clamp(64px, 13vw, 200px)",
          }}
        >
          Selected
          <br />
          <span style={{ fontFamily: '"Editorial New", serif', fontStyle: "italic", fontWeight: 200 }}>
            Work
          </span>
          .
        </h2>

        <div className="space-y-0">
          {WORK.map((w, i) => (
            <WorkRow key={w.brand} item={w} index={i} bgColor={BG} fgColor={ACCENT} />
          ))}
        </div>
      </section>

      <BinaryStrip />

      {/* ───────────────────────────────── PIPELINE ────────────────────── */}
      <section className="px-6 md:px-10 py-32 md:py-48 border-t" style={{ borderColor: `${FG}1a` }}>
        <div className="font-fraktion text-[11px] tracking-[0.3em] uppercase mb-16" style={{ opacity: 0.55 }}>
          [ 03 ] — Pipeline / 5 étapes · 30 minutes
        </div>

        <div className="space-y-0">
          {[
            { n: "01", label: "Scraper Shopify", text: "URL → catalogue + brand assets + palette" },
            { n: "02", label: "Claude Vision IA", text: "Analyse couleurs, qualité 3D, choix template" },
            { n: "03", label: "Génération 3D", text: "Meshy + Real-ESRGAN → mesh PBR par produit" },
            { n: "04", label: "Templates R3F", text: "5 templates main · GSAP scroll · 60fps mobile" },
            { n: "05", label: "Livraison", text: "Standalone ou embed Shopify · update auto" },
          ].map((s, i) => (
            <PipelineRow key={s.n} step={s} index={i} fgColor={FG} accentColor={ACCENT} />
          ))}
        </div>
      </section>

      <BinaryStrip />

      {/* ───────────────────────────────── CTA HIRE ME ────────────────────── */}
      <section className="px-6 md:px-10 py-40 md:py-56 border-t text-center" style={{ borderColor: `${FG}1a` }}>
        <div className="font-fraktion text-[11px] tracking-[0.3em] uppercase mb-16" style={{ opacity: 0.55 }}>
          [ 04 ] — Available for client work · MMXXVI
        </div>

        <h2
          className="font-bigger leading-[0.85] tracking-[-0.02em]"
          style={{
            fontFamily: '"Bigger Display", sans-serif',
            fontSize: "clamp(120px, 22vw, 360px)",
          }}
        >
          <span style={{ fontFamily: '"Editorial New", serif', fontStyle: "italic", fontWeight: 200, color: ACCENT }}>
            Hire
          </span>
          <br />
          me.
        </h2>

        <div className="mt-16 flex flex-col items-center gap-6 font-fraktion text-[11px] tracking-[0.3em] uppercase" style={{ opacity: 0.6 }}>
          <span>↓ Tap below ↓</span>
          <a
            href="mailto:emilien@vertxia.com?subject=Vertxia%20%E2%80%94%20Demande"
            className="text-2xl md:text-4xl hover:opacity-70 transition-opacity"
            style={{ fontFamily: '"Editorial New", serif', color: ACCENT, fontStyle: "italic", letterSpacing: "0", textTransform: "none" }}
          >
            emilien@vertxia.com
          </a>
        </div>
      </section>

      {/* ───────────────────────────────── CONTACT / FOOTER ────────────────────── */}
      <footer id="contact" className="px-6 md:px-10 py-16 border-t" style={{ borderColor: `${FG}1a` }}>
        <BinaryStrip density={200} />
        <div className="mt-8 grid md:grid-cols-3 gap-8 font-fraktion text-[10px] tracking-[0.25em] uppercase" style={{ opacity: 0.55 }}>
          <div>
            <div className="mb-2">VERTXIA · MMXXVI</div>
            <div>Solo · Toulon, France</div>
          </div>
          <div className="md:text-center">
            <div className="mb-2">Chapter #{palette.chapter} — {palette.label}</div>
            <div>{timestamp} · Local time</div>
          </div>
          <div className="md:text-right space-y-1">
            <div>
              <a href="https://instagram.com/vertxia.fr" target="_blank" rel="noopener noreferrer" className="hover:opacity-100" style={{ color: FG }}>
                @vertxia.fr →
              </a>
            </div>
            <div>
              <a href="https://www.linkedin.com/in/emilien-behague-9697a1364" target="_blank" rel="noopener noreferrer" className="hover:opacity-100" style={{ color: FG }}>
                LinkedIn →
              </a>
            </div>
            <div>
              <a href="mailto:emilien@vertxia.com" className="hover:opacity-100" style={{ color: ACCENT }}>
                emilien@vertxia.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SOUS-COMPOSANTS
 * ═══════════════════════════════════════════════════════════════════════════ */

function WorkRow({
  item,
  index,
  bgColor,
  fgColor,
}: {
  item: (typeof WORK)[number];
  index: number;
  bgColor: string;
  fgColor: string;
}) {
  const { ref, inView } = useReveal(0.2);
  return (
    <a
      ref={ref}
      href={item.href}
      className="group grid grid-cols-12 gap-4 md:gap-8 items-baseline py-10 md:py-14 border-t transition-all duration-700"
      style={{
        borderColor: `${bgColor}1a`,
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(20px)",
        transitionDelay: `${index * 80}ms`,
        color: bgColor,
      }}
    >
      <div className="col-span-12 md:col-span-2 font-fraktion text-[10px] tracking-[0.25em] uppercase opacity-70">
        {item.code}
      </div>
      <div className="col-span-12 md:col-span-7">
        <h3
          className="leading-[0.92] tracking-[-0.02em] group-hover:translate-x-3 transition-transform duration-500"
          style={{
            fontFamily: '"Bigger Display", sans-serif',
            fontSize: "clamp(48px, 8vw, 128px)",
            fontWeight: 700,
          }}
        >
          {item.brand}
        </h3>
      </div>
      <div className="col-span-12 md:col-span-3 text-right">
        <div className="font-fraktion text-[11px] tracking-[0.2em] uppercase opacity-80">
          {item.product}
        </div>
        <div className="mt-2 font-fraktion text-[10px] tracking-[0.25em] uppercase flex items-center justify-end gap-2" style={{ opacity: 0.6 }}>
          <span>View</span>
          <span className="transition-transform duration-500 group-hover:translate-x-2">→</span>
        </div>
      </div>
    </a>
  );
}

function PipelineRow({
  step,
  index,
  fgColor,
  accentColor,
}: {
  step: { n: string; label: string; text: string };
  index: number;
  fgColor: string;
  accentColor: string;
}) {
  const { ref, inView } = useReveal(0.3);
  return (
    <div
      ref={ref}
      className="grid grid-cols-12 gap-4 md:gap-8 items-baseline py-8 md:py-12 border-t transition-all duration-700"
      style={{
        borderColor: `${fgColor}1a`,
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(20px)",
        transitionDelay: `${index * 80}ms`,
      }}
    >
      <div
        className="col-span-2 md:col-span-1 font-bigger text-3xl md:text-5xl"
        style={{ fontFamily: '"Bigger Display", sans-serif', color: accentColor }}
      >
        {step.n}
      </div>
      <div className="col-span-10 md:col-span-4 font-fraktion text-[11px] tracking-[0.25em] uppercase">
        {step.label}
      </div>
      <div
        className="col-span-12 md:col-span-7 text-lg md:text-2xl leading-[1.35]"
        style={{ fontFamily: '"Editorial New", serif', opacity: 0.75 }}
      >
        {step.text}
      </div>
    </div>
  );
}
