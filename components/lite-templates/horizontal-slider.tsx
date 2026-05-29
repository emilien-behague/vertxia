"use client";

/**
 * Vertxia Lite — Template "Horizontal Slider".
 *
 * Le plus MECANIQUEMENT RADICAL des 4 templates : axe de scroll horizontal.
 *
 *  - Container scroll-x avec snap-x mandatory
 *  - 1 slide = 100vw × 100vh (cover, manifesto, 1 produit, contact)
 *  - Navigation : mouse wheel intercepte (deltaY → scrollLeft), keyboard ← / →
 *    Home / End, boutons arrows UI, dots indicator clic
 *  - Counter "02 / 05" en top-right
 *  - Brand mark + signature Vertxia en top-left, mix-blend-difference
 *  - Hint "↔ Defile" anime en bottom-center sur slide 1 (apprend la mecanique)
 *  - Body scroll-lock (overflow hidden sur html) — sinon page parent scroll
 *
 * Inspirations exa : Wodniack.dev, Yota.aagency, Quechua new collection,
 * Rottefella Your Majesty, Vogue 80s Fever.
 */

import { useEffect, useRef, useState, useCallback } from "react";

import type { Brief } from "@/lib/brief";
import { paletteColor } from "@/lib/brief";

type Props = { brief: Brief };

export function HorizontalSlider({ brief }: Props) {
  const {
    brand,
    visual_system,
    creative_direction,
    featured_products,
    hero,
    footer,
    site_structure,
  } = brief;
  const palette = visual_system.palette;

  const bg = paletteColor(palette, "background", "#F5F0E8");
  const fg = paletteColor(palette, "foreground", "#1A1A1A");
  const accent = paletteColor(palette, "accent", "#E8521A");
  const muted = paletteColor(palette, "muted", "#8F9E82");

  const serif = visual_system.fonts.serif || "Cormorant";
  const sans = visual_system.fonts.sans || "Inter";

  // Manifesto pull quote (premier qu'on trouve)
  const heroPullQuote = site_structure.find((s) => s.pull_quote)?.pull_quote;
  const manifestoHeadline =
    site_structure.find((s) => /manifest/i.test(s.section))?.headline ||
    creative_direction.narrative_arc;

  // Slides = cover + manifesto + N produits + contact
  // (manifesto seulement si on a un pull quote ou headline)
  const hasManifesto = Boolean(heroPullQuote || manifestoHeadline);
  const slideCount = 1 + (hasManifesto ? 1 : 0) + featured_products.length + 1;

  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const goToSlide = useCallback(
    (idx: number) => {
      if (!containerRef.current) return;
      const clamped = Math.max(0, Math.min(slideCount - 1, idx));
      containerRef.current.scrollTo({
        left: clamped * window.innerWidth,
        behavior: "smooth",
      });
    },
    [slideCount]
  );

  // Mouse wheel : deltaY (vertical wheel) → scrollLeft (horizontal)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const onWheel = (e: WheelEvent) => {
      // Si la majorite du delta est vertical, on le redirige sur horizontal
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.scrollLeft += e.deltaY * 1.4;
        });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Scroll listener pour update currentSlide
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const idx = Math.round(el.scrollLeft / window.innerWidth);
        setCurrentSlide((prev) => (prev !== idx ? idx : prev));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Keyboard nav : ← / → / Home / End / Space
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goToSlide(currentSlide + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goToSlide(currentSlide - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goToSlide(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goToSlide(slideCount - 1);
      } else if (e.key === " ") {
        // Space = slide suivante
        e.preventDefault();
        goToSlide(currentSlide + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentSlide, slideCount, goToSlide]);

  // Body scroll lock pendant que ce template est mounted
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const fontsHref = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(serif).replace(/%20/g, "+")}:wght@300;400;500;600&family=${encodeURIComponent(sans).replace(/%20/g, "+")}:wght@300;400;500&display=swap`;

  const slideBaseClass =
    "snap-start snap-always shrink-0 relative w-screen h-screen overflow-hidden flex items-center justify-center";

  // Pre-compute slide index pour chaque type
  const coverIdx = 0;
  const manifestoIdx = hasManifesto ? 1 : -1;
  const firstProductIdx = hasManifesto ? 2 : 1;
  const contactIdx = slideCount - 1;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={fontsHref} rel="stylesheet" />

      {/* Container scrollable horizontal */}
      <main
        ref={containerRef}
        className="flex h-screen w-screen overflow-x-scroll overflow-y-hidden snap-x snap-mandatory antialiased"
        style={{
          background: bg,
          color: fg,
          fontFamily: `'${sans}', system-ui, -apple-system, sans-serif`,
          scrollBehavior: "smooth",
          scrollbarWidth: "none",
        }}
      >
        {/* ============ SLIDE 0 — COVER ============ */}
        <section className={slideBaseClass} style={{ background: bg }}>
          <div className="px-8 md:px-16 w-full max-w-6xl">
            {hero?.kicker && (
              <p
                className="text-[11px] tracking-[0.4em] uppercase mb-12"
                style={{ color: muted }}
              >
                — {hero.kicker}
              </p>
            )}
            <h1
              className="text-5xl md:text-8xl lg:text-9xl font-light leading-[0.95] tracking-tight mb-12 whitespace-pre-line"
              style={{ fontFamily: `'${serif}', serif` }}
            >
              {hero?.headline || brand.positioning_one_liner}
            </h1>
            {hero?.subheadline && (
              <p
                className="text-base md:text-xl max-w-xl leading-relaxed font-light italic"
                style={{
                  color: `${fg}b0`,
                  fontFamily: `'${serif}', serif`,
                }}
              >
                {hero.subheadline}
              </p>
            )}
          </div>
        </section>

        {/* ============ SLIDE 1 — MANIFESTO (pull quote) ============ */}
        {hasManifesto && (
          <section
            className={slideBaseClass}
            style={{ background: `${fg}08` }}
          >
            <div className="px-12 md:px-32 text-center max-w-5xl">
              <div
                className="text-3xl mb-12 tracking-[1.5em]"
                style={{ color: accent }}
              >
                §
              </div>
              <blockquote
                className="text-4xl md:text-6xl lg:text-7xl font-light italic leading-[1.15] tracking-tight"
                style={{ fontFamily: `'${serif}', serif`, color: fg }}
              >
                {(() => {
                  const text = (heroPullQuote || manifestoHeadline || "").trim();
                  // Detecte si la string contient deja des guillemets typographiques
                  const hasQuotes = /[«»""]/.test(text);
                  if (hasQuotes) return text;
                  return (
                    <>
                      <span style={{ color: accent }}>«</span> {text}{" "}
                      <span style={{ color: accent }}>»</span>
                    </>
                  );
                })()}
              </blockquote>
              <p
                className="mt-16 text-[11px] tracking-[0.4em] uppercase"
                style={{ color: muted }}
              >
                {brand.voice}
              </p>
            </div>
          </section>
        )}

        {/* ============ SLIDES 2..N — PRODUITS ============ */}
        {featured_products.map((p, i) => {
          const slideIdx = firstProductIdx + i;
          return (
            <section
              key={p.handle}
              className={slideBaseClass}
              style={{
                background: i % 2 === 0 ? bg : `${fg}08`,
              }}
            >
              {/* Layout : video/image centree 60vh + meta autour */}
              <div className="relative w-full h-full flex flex-col items-center justify-center px-8 md:px-16">
                {/* Numero piece — top left */}
                <p
                  className="absolute top-1/2 left-8 md:left-16 -translate-y-1/2 text-[10px] tracking-[0.4em] uppercase rotate-[-90deg] origin-left"
                  style={{ color: muted }}
                >
                  Piece n° {String(i + 1).padStart(2, "0")}
                </p>

                {/* Media (video preferee, sinon image) */}
                <div className="relative w-full max-w-3xl mx-auto" style={{ height: "55vh" }}>
                  {p.video_url ? (
                    <video
                      src={p.video_url}
                      poster={p.hero_image_url}
                      autoPlay={slideIdx === currentSlide}
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : p.hero_image_url ? (
                    <div
                      className="w-full h-full"
                      style={{
                        backgroundImage: `url(${p.hero_image_url})`,
                        backgroundSize: "contain",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center",
                      }}
                    />
                  ) : null}
                </div>

                {/* Caption en bas */}
                <div className="mt-8 max-w-2xl text-center">
                  <h2
                    className="text-3xl md:text-5xl font-light leading-tight tracking-tight mb-4"
                    style={{ fontFamily: `'${serif}', serif` }}
                  >
                    {p.title}
                  </h2>
                  {p.editorial_caption && (
                    <p
                      className="text-sm md:text-base italic leading-relaxed max-w-xl mx-auto mb-6"
                      style={{
                        color: `${fg}b0`,
                        fontFamily: `'${serif}', serif`,
                      }}
                    >
                      {p.editorial_caption}
                    </p>
                  )}
                  {p.price_eur && (
                    <p
                      className="text-xl font-light"
                      style={{ fontFamily: `'${serif}', serif` }}
                    >
                      {p.price_eur} €
                    </p>
                  )}
                </div>
              </div>
            </section>
          );
        })}

        {/* ============ SLIDE FINAL — CONTACT ============ */}
        <section
          className={slideBaseClass}
          style={{
            background: fg,
            color: bg,
          }}
        >
          <div className="px-8 md:px-16 max-w-3xl text-center">
            <div
              className="text-3xl mb-12 tracking-[1.5em]"
              style={{ color: accent }}
            >
              §
            </div>
            <h2
              className="text-4xl md:text-6xl lg:text-7xl font-light italic leading-[1.1] tracking-tight mb-12"
              style={{ fontFamily: `'${serif}', serif`, color: bg }}
            >
              {footer?.tagline || `${brand.name}.`}
            </h2>
            {footer?.closing_line && (
              <p
                className="text-base md:text-lg max-w-xl mx-auto mb-16 leading-relaxed font-light"
                style={{ color: `${bg}b0` }}
              >
                {footer.closing_line}
              </p>
            )}
            <div className="flex flex-col items-center gap-6">
              <p
                className="text-[10px] tracking-[0.4em] uppercase"
                style={{ color: `${bg}80` }}
              >
                {brand.domain}
              </p>
              <a
                href="/lite"
                className="text-[11px] tracking-[0.3em] uppercase pb-1"
                style={{
                  color: bg,
                  borderBottom: `1px solid ${bg}40`,
                }}
              >
                Autres sites Vertxia →
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ============ UI OVERLAYS — fixed ============ */}

      {/* Brand mark + signature (top corners, mix-blend-difference) */}
      <div
        className="fixed top-6 left-8 z-50 text-[11px] tracking-[0.3em] uppercase mix-blend-difference pointer-events-none"
        style={{ color: "#FFFFFF" }}
      >
        {brand.name}
      </div>
      <div
        className="fixed top-6 right-8 z-50 text-[10px] tracking-[0.3em] uppercase mix-blend-difference pointer-events-none"
        style={{ color: "#FFFFFF" }}
      >
        Site généré par Vertxia
      </div>

      {/* Counter "02 / 05" — middle-right */}
      <div
        className="fixed right-8 top-1/2 -translate-y-1/2 z-50 flex flex-col items-end gap-1 pointer-events-none mix-blend-difference"
        style={{ color: "#FFFFFF" }}
      >
        <span
          className="text-5xl md:text-6xl font-light tabular-nums"
          style={{ fontFamily: `'${serif}', serif` }}
        >
          {String(currentSlide + 1).padStart(2, "0")}
        </span>
        <span className="text-[10px] tracking-[0.3em] uppercase opacity-60">
          / {String(slideCount).padStart(2, "0")}
        </span>
      </div>

      {/* Dots indicator — bottom-center */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
        {Array.from({ length: slideCount }).map((_, i) => (
          <button
            key={i}
            onClick={() => goToSlide(i)}
            aria-label={`Aller à la slide ${i + 1}`}
            className="group p-2"
          >
            <span
              className="block w-6 h-px transition-all duration-500"
              style={{
                background: i === currentSlide ? fg : `${fg}30`,
                transform: i === currentSlide ? "scaleX(2)" : "scaleX(1)",
                transformOrigin: "center",
              }}
            />
          </button>
        ))}
      </div>

      {/* Arrows nav — bottom corners */}
      {currentSlide > 0 && (
        <button
          onClick={() => goToSlide(currentSlide - 1)}
          aria-label="Slide précédente"
          className="fixed bottom-8 left-8 z-50 flex items-center gap-3 text-[11px] tracking-[0.3em] uppercase pb-1 transition-opacity duration-300 hover:opacity-100"
          style={{
            color: fg,
            opacity: 0.7,
            borderBottom: `1px solid ${fg}40`,
          }}
        >
          <span>←</span>
          Préc
        </button>
      )}
      {currentSlide < slideCount - 1 && (
        <button
          onClick={() => goToSlide(currentSlide + 1)}
          aria-label="Slide suivante"
          className="fixed bottom-8 right-8 z-50 flex items-center gap-3 text-[11px] tracking-[0.3em] uppercase pb-1 transition-opacity duration-300 hover:opacity-100"
          style={{
            color: fg,
            opacity: 0.7,
            borderBottom: `1px solid ${fg}40`,
          }}
        >
          Suiv
          <span>→</span>
        </button>
      )}

      {/* Hint sur slide 0 (apprend la mecanique horizontale) */}
      {currentSlide === 0 && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 text-[10px] tracking-[0.4em] uppercase animate-pulse pointer-events-none"
          style={{ color: `${fg}80` }}
        >
          ↔ &nbsp; Défile horizontalement
        </div>
      )}
    </>
  );
}
