/**
 * Vertxia Lite — Template "Brutalist Tech".
 *
 * Squelette VISUELLEMENT le plus tranche : neubrutalism contemporain.
 *
 *  - Background NB force (palette override partiel — accent du brief garde)
 *  - Sans-serif chunky uppercase pour tout (override le serif du brief)
 *  - Bordures 2-3px solid noir, pas d'arrondi (radius 0)
 *  - Hard shadows offset zero blur (5px 5px 0 0 #000)
 *  - Hover physical : translate + shadow grandit
 *  - Transitions hard cut (100ms ease)
 *  - Typography data-driven : numbers gros en mono
 *  - Layout broken-but-not-random : asymetrique macro, aligne micro
 *
 * Inspirations exa : Bottega Veneta nouveau site, Storefront drop-culture
 * brutalist, neubrutalism.com guide, Marfa Journal, Linear.
 */

import type { Brief } from "@/lib/brief";
import { paletteColor } from "@/lib/brief";

type Props = { brief: Brief };

export function BrutalistTech({ brief }: Props) {
  const {
    brand,
    visual_system,
    creative_direction,
    site_structure,
    featured_products,
    hero,
    footer,
    _meta,
  } = brief;

  // PALETTE OVERRIDE BRUTAL : on force NB + accent saturé du brief
  const BG = "#FFFDF5"; // off-white (chalk) — signature neubrutalism
  const FG = "#000000"; // absolute black
  const accent = paletteColor(visual_system.palette, "accent", "#FF4D1F");
  const BORDER = "2px solid #000000";
  const HARD_SHADOW = "5px 5px 0 0 #000000";

  // Fonts override : on force chunky sans-serif (essence brutalist)
  // Inter/Helvetica au lieu du serif du brief
  const sansChunky = "'Inter', 'Helvetica Neue', sans-serif";
  const mono = "'JetBrains Mono', 'Courier New', monospace";

  const manifestoSection =
    site_structure.find((s) => /manifest|values|story/i.test(s.section)) ||
    site_structure[0];

  return (
    <main
      className="antialiased min-h-screen relative"
      style={{
        background: BG,
        color: FG,
        fontFamily: sansChunky,
      }}
    >
      {/* Force chunky inter from google fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap"
        rel="stylesheet"
      />

      {/* ============ TOP BAR — brutal status bar ============ */}
      <header
        className="sticky top-0 z-50 grid grid-cols-12 items-center px-0"
        style={{
          background: BG,
          borderBottom: BORDER,
        }}
      >
        <div
          className="col-span-3 px-6 py-4 text-[11px] tracking-[0.2em] uppercase font-bold"
          style={{ borderRight: BORDER, fontFamily: mono }}
        >
          {brand.name} <span className="opacity-40">// EST. {brand.category.slice(0, 12)}</span>
        </div>
        <div className="col-span-6 px-6 py-4 text-center text-[11px] tracking-[0.3em] uppercase font-bold">
          {hero?.kicker || brand.positioning_one_liner.slice(0, 40)}
        </div>
        <div
          className="col-span-3 px-6 py-4 text-right text-[11px] tracking-[0.2em] uppercase font-bold"
          style={{ borderLeft: BORDER, fontFamily: mono, color: accent }}
        >
          ● LIVE / {brand.voice.toUpperCase()}
        </div>
      </header>

      {/* ============ HERO GIANT TYPOGRAPHY ============ */}
      <section
        className="px-6 md:px-12 py-20 md:py-32"
        style={{ borderBottom: BORDER }}
      >
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-8">
            <p
              className="text-[11px] tracking-[0.4em] uppercase font-bold mb-8"
              style={{ fontFamily: mono, color: accent }}
            >
              [00] · {hero?.kicker || "MANIFESTE"}
            </p>
            <h1
              className="text-6xl md:text-8xl lg:text-[10rem] font-black leading-[0.9] tracking-[-0.03em] uppercase mb-12 whitespace-pre-line"
              style={{ fontFamily: sansChunky }}
            >
              {hero?.headline || brand.positioning_one_liner}
            </h1>
          </div>
          <div className="col-span-12 md:col-span-4 md:pt-8">
            <p
              className="text-sm md:text-base leading-snug font-medium mb-8 uppercase"
              style={{ fontFamily: sansChunky }}
            >
              {hero?.subheadline || creative_direction.mood}
            </p>
            {/* Brutal CTA buttons — box with hard shadow */}
            <div className="flex flex-col gap-4">
              <a
                href="#products"
                className="inline-flex items-center justify-between px-6 py-4 text-[11px] tracking-[0.3em] uppercase font-bold transition-all duration-100"
                style={{
                  border: BORDER,
                  background: accent,
                  color: FG,
                  boxShadow: HARD_SHADOW,
                  fontFamily: sansChunky,
                }}
              >
                <span>{hero?.primary_cta_label || "→ VOIR LE DROP"}</span>
                <span style={{ fontFamily: mono }}>[01]</span>
              </a>
              <a
                href="#manifesto"
                className="inline-flex items-center justify-between px-6 py-4 text-[11px] tracking-[0.3em] uppercase font-bold transition-all duration-100"
                style={{
                  border: BORDER,
                  background: BG,
                  color: FG,
                  boxShadow: HARD_SHADOW,
                  fontFamily: sansChunky,
                }}
              >
                <span>{hero?.secondary_cta_label || "READ MORE"}</span>
                <span style={{ fontFamily: mono }}>[02]</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ DATA SHEET — stats brand format brutaliste ============ */}
      <section
        className="grid grid-cols-2 md:grid-cols-4"
        style={{ borderBottom: BORDER }}
      >
        {[
          { label: "Catalogue", value: String(_meta?.product_count_total ?? "—") },
          { label: "Featured", value: String(_meta?.featured_count ?? featured_products.length) },
          { label: "Sections", value: String(site_structure.length) },
          { label: "Drop", value: "2025" },
        ].map((stat, i, arr) => (
          <div
            key={stat.label}
            className="px-6 md:px-12 py-12 md:py-16 overflow-hidden"
            style={{
              borderRight: i < arr.length - 1 ? BORDER : undefined,
            }}
          >
            <p
              className="text-[10px] tracking-[0.3em] uppercase font-bold opacity-50 mb-4"
              style={{ fontFamily: mono }}
            >
              [0{i + 1}] · {stat.label}
            </p>
            <div
              className="text-5xl md:text-7xl lg:text-8xl font-black leading-none tabular-nums truncate"
              style={{ fontFamily: sansChunky }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </section>

      {/* ============ MANIFESTO BLOCK — full-bleed brutal ============ */}
      {manifestoSection && (
        <section
          id="manifesto"
          className="px-6 md:px-12 py-24 md:py-40"
          style={{
            background: FG,
            color: BG,
            borderBottom: BORDER,
          }}
        >
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-3">
              <p
                className="text-[11px] tracking-[0.4em] uppercase font-bold mb-4"
                style={{ fontFamily: mono, color: accent }}
              >
                [03] MANIFESTO
              </p>
              <div className="text-sm tracking-[0.2em] uppercase font-bold opacity-50">
                {manifestoSection.section_role}
              </div>
            </div>
            <div className="col-span-12 md:col-span-9">
              {manifestoSection.headline && (
                <h2
                  className="text-4xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-[-0.02em] uppercase mb-12 whitespace-pre-line"
                  style={{ fontFamily: sansChunky }}
                >
                  {manifestoSection.headline}
                </h2>
              )}
              <div
                className="space-y-6 text-base md:text-lg leading-[1.5] font-medium max-w-3xl"
                style={{ color: `${BG}` }}
              >
                {(manifestoSection.body_paragraphs || []).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              {manifestoSection.pull_quote && (
                <div
                  className="mt-16 inline-block px-8 py-6 text-xl md:text-2xl font-black uppercase"
                  style={{
                    background: accent,
                    color: FG,
                    boxShadow: "8px 8px 0 0 #FFFDF5",
                    border: `2px solid ${BG}`,
                    fontFamily: sansChunky,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {manifestoSection.pull_quote.replace(/[«»""]/g, "").trim()}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ============ PRODUCT GRID — asymetric brutalist ============ */}
      <section
        id="products"
        className="px-0"
        style={{ borderBottom: BORDER }}
      >
        {/* Section label bar */}
        <div
          className="px-6 md:px-12 py-6 grid grid-cols-12 items-center"
          style={{ borderBottom: BORDER }}
        >
          <div className="col-span-6">
            <p
              className="text-[11px] tracking-[0.4em] uppercase font-bold"
              style={{ fontFamily: mono, color: accent }}
            >
              [04] · DROP / {featured_products.length} PIECES
            </p>
          </div>
          <div className="col-span-6 text-right">
            <p
              className="text-[11px] tracking-[0.3em] uppercase font-bold opacity-60"
              style={{ fontFamily: mono }}
            >
              ● IN STOCK · ÉDITION LIMITÉE
            </p>
          </div>
        </div>

        {/* Asymetric grid : alternance card grande / petite */}
        <div className="grid grid-cols-1 md:grid-cols-12">
          {featured_products.map((p, i) => {
            // Pattern asymetrique : large 7-col, narrow 5-col, alterne
            const isLarge = i % 3 === 0;
            const colSpan = isLarge ? "md:col-span-7" : "md:col-span-5";
            // Borders : right on all except last in row, bottom on all
            return (
              <article
                key={p.handle}
                className={`group relative ${colSpan}`}
                style={{
                  borderBottom: BORDER,
                  borderRight: i < featured_products.length - 1 ? BORDER : undefined,
                }}
              >
                {/* Image / video container — invert on hover */}
                <div
                  className="relative aspect-[4/5] overflow-hidden transition-all duration-100 group-hover:[filter:invert(1)]"
                  style={{ background: BG }}
                >
                  {p.video_url ? (
                    <video
                      src={p.video_url}
                      poster={p.hero_image_url}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : p.hero_image_url ? (
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url(${p.hero_image_url})`,
                        backgroundSize: "contain",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center",
                      }}
                    />
                  ) : null}

                  {/* Brutal label badge top-left */}
                  <div
                    className="absolute top-4 left-4 px-3 py-1.5 text-[10px] tracking-[0.3em] uppercase font-bold"
                    style={{
                      background: FG,
                      color: BG,
                      fontFamily: mono,
                    }}
                  >
                    REF. {String(i + 1).padStart(3, "0")}
                  </div>

                  {/* Stock pulse top-right */}
                  <div
                    className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 text-[10px] tracking-[0.2em] uppercase font-bold"
                    style={{
                      background: BG,
                      color: FG,
                      border: BORDER,
                      fontFamily: mono,
                    }}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full animate-pulse"
                      style={{ background: accent }}
                    />
                    LIVE
                  </div>
                </div>

                {/* Info bar bottom */}
                <div
                  className="px-6 py-6 grid grid-cols-12 gap-4 items-baseline"
                  style={{ borderTop: BORDER, background: BG }}
                >
                  <div className="col-span-7 md:col-span-8">
                    <h3
                      className="text-xl md:text-2xl font-black uppercase tracking-[-0.01em] mb-2"
                      style={{ fontFamily: sansChunky }}
                    >
                      {p.title}
                    </h3>
                    <p
                      className="text-xs leading-snug font-medium uppercase opacity-70"
                      style={{ fontFamily: sansChunky }}
                    >
                      {p.editorial_caption?.replace(/[«»""]/g, "").slice(0, 100)}
                      {(p.editorial_caption?.length || 0) > 100 ? "..." : ""}
                    </p>
                  </div>
                  <div className="col-span-5 md:col-span-4 text-right">
                    {p.price_eur ? (
                      <div
                        className="text-3xl md:text-4xl font-black tabular-nums"
                        style={{ fontFamily: sansChunky }}
                      >
                        {p.price_eur}
                        <span className="text-base font-medium opacity-50 ml-1">€</span>
                      </div>
                    ) : (
                      <span className="text-[10px] tracking-[0.3em] uppercase font-bold opacity-50">
                        Sur demande
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ============ CTA STRIP — brutal full-bleed ============ */}
      <section
        className="px-6 md:px-12 py-16 md:py-24 grid grid-cols-1 md:grid-cols-12 gap-8 items-center"
        style={{
          borderBottom: BORDER,
          background: accent,
          color: FG,
        }}
      >
        <div className="md:col-span-8">
          <p
            className="text-[11px] tracking-[0.4em] uppercase font-bold mb-4"
            style={{ fontFamily: mono }}
          >
            [05] · CONTACT
          </p>
          <h2
            className="text-3xl md:text-5xl font-black uppercase leading-[0.95] tracking-[-0.02em]"
            style={{ fontFamily: sansChunky }}
          >
            {footer?.tagline || `BUY → ${brand.name}.`}
          </h2>
        </div>
        <div className="md:col-span-4">
          <a
            href={`mailto:hello@${brand.domain}`}
            className="block w-full px-6 py-5 text-center text-[12px] tracking-[0.3em] uppercase font-black transition-all duration-100"
            style={{
              border: BORDER,
              background: FG,
              color: BG,
              boxShadow: "5px 5px 0 0 #FFFDF5",
              fontFamily: sansChunky,
            }}
          >
            → CONTACT DROP TEAM
          </a>
        </div>
      </section>

      {/* ============ FOOTER BRUTAL ============ */}
      <footer
        className="px-6 md:px-12 py-12 grid grid-cols-1 md:grid-cols-12 gap-6 items-center"
        style={{
          background: FG,
          color: BG,
        }}
      >
        <div className="md:col-span-4">
          <p
            className="text-2xl md:text-3xl font-black uppercase tracking-[-0.02em]"
            style={{ fontFamily: sansChunky }}
          >
            {brand.name.toUpperCase()}.
          </p>
          <p
            className="text-[10px] tracking-[0.3em] uppercase font-bold opacity-60 mt-2"
            style={{ fontFamily: mono }}
          >
            {brand.domain}
          </p>
        </div>
        <div className="md:col-span-4 text-center">
          <p
            className="text-[10px] tracking-[0.3em] uppercase font-bold opacity-60"
            style={{ fontFamily: mono }}
          >
            {footer?.closing_line?.slice(0, 80) || brand.positioning_one_liner.slice(0, 80)}
          </p>
        </div>
        <div className="md:col-span-4 text-right">
          <a
            href="/lite"
            className="inline-flex items-center gap-3 px-4 py-2 text-[10px] tracking-[0.3em] uppercase font-bold transition-all duration-100"
            style={{
              border: `2px solid ${BG}`,
              color: BG,
            }}
          >
            → AUTRES SITES VERTXIA
          </a>
          <p
            className="text-[9px] tracking-[0.3em] uppercase opacity-40 mt-4"
            style={{ fontFamily: mono }}
          >
            BUILT BY VERTXIA / {_meta?.model || "claude-sonnet"}
          </p>
        </div>
      </footer>
    </main>
  );
}
