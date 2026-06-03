"use client";

/**
 * Vertxia Lite — Template "Kinetic Typography".
 *
 * Mood : typographie monumentale en mouvement. Inspirations :
 *  - MINIMAL ARCHITECTURE (Arch Studio) — photo brutaliste full-bleed + huge typo overlay
 *  - Wodniack — kinetic text masks
 *  - Awwwards SOTD typo-heavy (Yota.aagency, Mathieu Lerouge)
 *  - Lululemon hero — bold sans-serif géant blanc sur shoot full bleed
 *
 * Principes :
 *  - Hero = photo PLEIN ECRAN + énorme titre sans-serif overlay weight 900
 *  - Sans-serif géométrique heavy : Archivo Black / Anton / Bebas Neue (Google Fonts)
 *  - Palette restreinte 2-3 couleurs, contraste max (B&W + 1 accent saturé)
 *  - Marquee horizontale scrolling text entre sections
 *  - Section titles : SplitMaskedReveal char-par-char GIANT
 *  - Product grid : 2 cols dense avec scale-on-hover
 *
 * Animations actives (regle 23) :
 *  1. SplitMaskedReveal char-par-char hero headline (GIANT)
 *  2. FadeInUp kicker hero
 *  3. MaskedReveal subhead hero
 *  4. ParallaxBg hero photo
 *  5. MagneticButton CTA hero (strength fort)
 *  6. Marquee horizontale entre sections (motion.x animate Infinity)
 *  7. SplitMaskedReveal section titles (manifesto + collection)
 *  8. FadeInUp manifesto paragraphes stagger
 *  9. ParallaxImage product cards (scroll-driven)
 * 10. FadeInUp product cards stagger
 * 11. MaskedReveal product titles
 * 12. data-cursor="view" images, "hover" links
 * 13. Hover scale 1.05 + zoom-in product photos
 * 14. SplitMaskedReveal footer tagline
 */

import type { Brief } from "@/lib/brief";
import { paletteColor } from "@/lib/brief";
import { m } from "motion/react";
import {
  FadeInUp,
  MaskedReveal,
  SplitMaskedReveal,
  MagneticButton,
  ParallaxBg,
} from "@/components/motion-primitives";

type Props = { brief: Brief };

export function KineticTypography({ brief }: Props) {
  const { brand, visual_system, creative_direction, site_structure, featured_products, hero, footer } = brief;
  const palette = visual_system.palette;

  // Kinetic = contraste max. Force palette B+N + 1 accent saturé du brief.
  const bg = paletteColor(palette, "background", "#0A0A0A");
  const fg = paletteColor(palette, "foreground", "#F5F5F5");
  const accent = paletteColor(palette, "accent", "#FF3300");
  const muted = paletteColor(palette, "muted", "#666666");

  // Force sans-serif heavy quoi qu'envoie le brief
  const display = "Archivo Black";
  const sans = visual_system.fonts.sans || "Inter";

  const heroProduct = featured_products[0];
  const heroImage = heroProduct?.hero_image_url;
  const heroVideo = heroProduct?.video_url;

  const manifestoSection = site_structure.find((s) => /manifest|values|story|philosophy/i.test(s.section));
  const collectionSection = site_structure.find((s) => /collection|product|gallery|catalog/i.test(s.section));

  const fontFamilies = [
    `Archivo+Black`,
    `${encodeURIComponent(sans).replace(/%20/g, "+")}:wght@400;500;700`,
  ];
  const fontsHref = `https://fonts.googleapis.com/css2?family=${fontFamilies.join("&family=")}&display=swap`;

  // Marquee : texte qui défile en boucle horizontale infinie
  const marqueeText = (hero?.kicker || creative_direction.reference_style || brand.category).toUpperCase();
  const marqueeRepeat = Array.from({ length: 8 }, () => marqueeText).join("  ◆  ");

  return (
    <main
      className="min-h-screen antialiased overflow-x-hidden"
      style={{
        background: bg,
        color: fg,
        fontFamily: `'${sans}', system-ui, sans-serif`,
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={fontsHref} rel="stylesheet" />

      {/* NAV — tight, uppercase mono-tone */}
      <header
        className="fixed top-0 left-0 right-0 z-50"
        style={{ background: `${bg}c0`, backdropFilter: "blur(10px)" }}
      >
        <nav className="max-w-[1800px] mx-auto px-8 py-5 flex items-center justify-between">
          <span
            className="text-[14px] tracking-[0.25em] uppercase"
            style={{ fontFamily: `'${display}', sans-serif`, color: fg }}
          >
            {brand.name}
          </span>
          <div className="hidden md:flex gap-10">
            {site_structure
              .filter((s) => /manifest|collection|product|philosophy|story/i.test(s.section))
              .slice(0, 4)
              .map((s) => (
                <a
                  key={s.section}
                  href={`#${s.section}`}
                  data-cursor="hover"
                  className="text-[11px] tracking-[0.3em] uppercase transition-colors"
                  style={{ color: muted, fontFamily: `'${sans}', sans-serif`, fontWeight: 500 }}
                >
                  {s.section}
                </a>
              ))}
          </div>
          <span
            className="text-[10px] tracking-[0.3em] uppercase hidden md:block"
            style={{ color: accent, fontFamily: `'${sans}', sans-serif`, fontWeight: 700 }}
          >
            ◆ VERTXIA
          </span>
        </nav>
      </header>

      {/* HERO — full-bleed photo + énorme typo overlay */}
      <section className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 z-0">
          {heroVideo ? (
            <video
              src={heroVideo}
              poster={heroImage}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover absolute inset-0"
              data-cursor="view"
              data-cursor-label="Play"
            />
          ) : heroImage ? (
            <ParallaxBg
              src={heroImage}
              className="absolute inset-0 w-full h-full"
              distance={120}
              scale={1.2}
            />
          ) : null}
          {/* Overlay sombre pour lisibilité typo */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${bg}80 0%, ${bg}40 35%, ${bg}10 60%, ${bg}90 100%)`,
            }}
          />
        </div>

        {/* Énorme titre overlay centré */}
        <div className="relative z-10 min-h-screen flex flex-col justify-center items-center px-6 pt-32 pb-20">
          <FadeInUp delay={0.2}>
            <p
              className="text-[11px] md:text-[13px] tracking-[0.4em] uppercase mb-10 text-center"
              style={{ color: accent, fontFamily: `'${sans}', sans-serif`, fontWeight: 700 }}
            >
              ◆ {hero?.kicker || brand.category} ◆
            </p>
          </FadeInUp>

          <h1
            className="text-center leading-[0.85] tracking-[-0.03em] uppercase mb-12 whitespace-pre-line"
            style={{
              fontFamily: `'${display}', sans-serif`,
              color: fg,
              fontSize: "clamp(3.5rem, 13vw, 14rem)",
              fontWeight: 900,
              textShadow: `0 4px 60px ${bg}cc`,
            }}
          >
            <SplitMaskedReveal
              text={hero?.headline || brand.positioning_one_liner.split(/[.,]/)[0]}
              delay={0.5}
              duration={1.0}
              delayStep={0.04}
              splitBy="word"
            />
          </h1>

          {hero?.subheadline && (
            <FadeInUp delay={1.2}>
              <p
                className="max-w-2xl text-center text-base md:text-lg leading-relaxed mb-12"
                style={{ color: `${fg}c0`, fontFamily: `'${sans}', sans-serif`, fontWeight: 400 }}
              >
                <MaskedReveal duration={0.9}>{hero.subheadline}</MaskedReveal>
              </p>
            </FadeInUp>
          )}

          {hero?.primary_cta_label && collectionSection && (
            <FadeInUp delay={1.5}>
              <MagneticButton
                as="a"
                href={`#${collectionSection.section}`}
                strength={0.5}
                hitboxScale={1.6}
              >
                <span
                  data-cursor="hover"
                  className="inline-flex items-center gap-3 px-10 py-4 text-[12px] tracking-[0.3em] uppercase transition-all duration-300 hover:scale-105"
                  style={{
                    background: accent,
                    color: bg,
                    fontFamily: `'${sans}', sans-serif`,
                    fontWeight: 700,
                    border: `2px solid ${accent}`,
                  }}
                >
                  {hero.primary_cta_label}
                  <span aria-hidden style={{ fontSize: "1.2em" }}>→</span>
                </span>
              </MagneticButton>
            </FadeInUp>
          )}
        </div>

        {/* Indicateur scroll */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 text-[10px] tracking-[0.35em] uppercase animate-pulse hidden md:block"
          style={{ color: `${fg}80`, fontFamily: `'${sans}', sans-serif`, fontWeight: 600 }}
        >
          ↓ SCROLL ↓
        </div>
      </section>

      {/* MARQUEE — texte défilant horizontal infini */}
      <section
        className="overflow-hidden py-8"
        style={{
          background: accent,
          color: bg,
          borderTop: `2px solid ${fg}`,
          borderBottom: `2px solid ${fg}`,
        }}
      >
        <m.div
          className="flex whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            duration: 40,
            ease: "linear",
            repeat: Infinity,
          }}
          style={{ willChange: "transform" }}
        >
          <span
            className="text-[clamp(3rem,6vw,5rem)] tracking-[-0.02em] uppercase pr-8"
            style={{ fontFamily: `'${display}', sans-serif`, fontWeight: 900 }}
          >
            {marqueeRepeat}  ◆  {marqueeRepeat}
          </span>
        </m.div>
      </section>

      {/* MANIFESTO — type slab geant */}
      {manifestoSection && (
        <section
          id={manifestoSection.section}
          className="px-6 md:px-12 py-32 md:py-48"
        >
          <div className="max-w-[1800px] mx-auto">
            <FadeInUp>
              <p
                className="text-[11px] tracking-[0.4em] uppercase mb-12"
                style={{ color: accent, fontFamily: `'${sans}', sans-serif`, fontWeight: 700 }}
              >
                ◆ {manifestoSection.section_role || "Manifesto"}
              </p>
            </FadeInUp>

            <h2
              className="leading-[0.9] tracking-[-0.03em] uppercase mb-20 whitespace-pre-line"
              style={{
                fontFamily: `'${display}', sans-serif`,
                color: fg,
                fontSize: "clamp(2.5rem, 8vw, 8rem)",
                fontWeight: 900,
              }}
            >
              <SplitMaskedReveal
                text={manifestoSection.headline || brand.positioning_one_liner.split(/[.,]/)[0]}
                delay={0.1}
                duration={0.9}
                delayStep={0.07}
                splitBy="word"
              />
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 max-w-5xl">
              {(manifestoSection.body_paragraphs?.length
                ? manifestoSection.body_paragraphs
                : [manifestoSection.content_hint || creative_direction.narrative_arc]
              ).map((para, i) => (
                <FadeInUp key={i} delay={0.2 + i * 0.15}>
                  <p
                    className="text-base md:text-lg leading-[1.7]"
                    style={{
                      color: `${fg}c8`,
                      fontFamily: `'${sans}', sans-serif`,
                      fontWeight: 400,
                    }}
                  >
                    <span
                      style={{ color: accent, fontWeight: 700, fontFamily: `'${display}', sans-serif` }}
                    >
                      {String(i + 1).padStart(2, "0")} —{" "}
                    </span>
                    {para}
                  </p>
                </FadeInUp>
              ))}
            </div>

            {manifestoSection.pull_quote && (
              <FadeInUp delay={0.6}>
                <blockquote
                  className="mt-24 max-w-4xl leading-[1.05] tracking-[-0.02em] uppercase"
                  style={{
                    fontFamily: `'${display}', sans-serif`,
                    fontSize: "clamp(1.8rem, 4vw, 3.5rem)",
                    fontWeight: 900,
                    color: fg,
                    borderLeft: `6px solid ${accent}`,
                    paddingLeft: "2rem",
                  }}
                >
                  <MaskedReveal duration={1.0}>
                    « {manifestoSection.pull_quote} »
                  </MaskedReveal>
                </blockquote>
              </FadeInUp>
            )}
          </div>
        </section>
      )}

      {/* Marquee #2 — autre direction */}
      <section
        className="overflow-hidden py-6"
        style={{
          background: bg,
          color: fg,
          borderTop: `2px solid ${fg}30`,
          borderBottom: `2px solid ${fg}30`,
        }}
      >
        <m.div
          className="flex whitespace-nowrap"
          animate={{ x: ["-50%", "0%"] }}
          transition={{
            duration: 50,
            ease: "linear",
            repeat: Infinity,
          }}
          style={{ willChange: "transform" }}
        >
          <span
            className="text-[clamp(2rem,4.5vw,3.5rem)] tracking-[-0.02em] uppercase pr-8"
            style={{ fontFamily: `'${display}', sans-serif`, fontWeight: 900, color: `${fg}40` }}
          >
            {brand.name} · {brand.name} · {brand.name} · {brand.name} · {brand.name} · {brand.name} · {brand.name} · {brand.name} · {brand.name} · {brand.name} · {brand.name} · {brand.name} ·
          </span>
        </m.div>
      </section>

      {/* COLLECTION — grid 2 col dense, hover scale + invert */}
      {collectionSection && (
        <section
          id={collectionSection.section}
          className="px-6 md:px-12 py-32 md:py-48"
        >
          <div className="max-w-[1800px] mx-auto">
            <div className="flex items-end justify-between mb-20 flex-wrap gap-8">
              <div>
                <FadeInUp>
                  <p
                    className="text-[11px] tracking-[0.4em] uppercase mb-8"
                    style={{ color: accent, fontFamily: `'${sans}', sans-serif`, fontWeight: 700 }}
                  >
                    ◆ {collectionSection.section_role || "Collection"}
                  </p>
                </FadeInUp>
                <h3
                  className="leading-[0.9] tracking-[-0.03em] uppercase whitespace-pre-line"
                  style={{
                    fontFamily: `'${display}', sans-serif`,
                    fontSize: "clamp(2.2rem, 6vw, 6rem)",
                    fontWeight: 900,
                    color: fg,
                  }}
                >
                  <SplitMaskedReveal
                    text={collectionSection.headline || brand.name.toUpperCase()}
                    delay={0.1}
                    duration={0.8}
                    delayStep={0.06}
                    splitBy="word"
                  />
                </h3>
              </div>
              {collectionSection.body_paragraphs?.[0] && (
                <FadeInUp delay={0.3}>
                  <p
                    className="max-w-md text-base leading-relaxed"
                    style={{ color: `${fg}99`, fontFamily: `'${sans}', sans-serif` }}
                  >
                    {collectionSection.body_paragraphs[0]}
                  </p>
                </FadeInUp>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
              {featured_products.map((p, i) => (
                <FadeInUp key={p.handle} delay={i * 0.1} duration={0.9}>
                  <article className="group relative">
                    <div
                      className="relative aspect-[4/5] mb-6 overflow-hidden"
                      style={{ background: `${fg}10` }}
                      data-cursor="view"
                      data-cursor-label="View"
                    >
                      {p.video_url ? (
                        <video
                          src={p.video_url}
                          poster={p.hero_image_url}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : p.hero_image_url ? (
                        <div
                          className="absolute inset-0 transition-transform duration-700 group-hover:scale-110"
                          style={{
                            backgroundImage: `url(${p.hero_image_url})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        />
                      ) : null}
                      {/* Numéro géant overlay coin */}
                      <div
                        className="absolute top-4 left-4 text-[clamp(3rem,5vw,5rem)] leading-none pointer-events-none"
                        style={{
                          fontFamily: `'${display}', sans-serif`,
                          fontWeight: 900,
                          color: accent,
                          mixBlendMode: "difference",
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between gap-4">
                      <h4
                        className="leading-tight tracking-tight uppercase"
                        style={{
                          fontFamily: `'${display}', sans-serif`,
                          fontSize: "clamp(1.4rem, 2.2vw, 2rem)",
                          fontWeight: 900,
                          color: fg,
                        }}
                      >
                        <MaskedReveal duration={0.6}>{p.title}</MaskedReveal>
                      </h4>
                      {p.price_eur && (
                        <span
                          className="text-lg tracking-tight"
                          style={{
                            fontFamily: `'${display}', sans-serif`,
                            fontWeight: 900,
                            color: accent,
                          }}
                        >
                          {p.price_eur}€
                        </span>
                      )}
                    </div>

                    {p.editorial_caption && (
                      <p
                        className="text-sm mt-3 leading-relaxed"
                        style={{
                          color: `${fg}90`,
                          fontFamily: `'${sans}', sans-serif`,
                          fontWeight: 400,
                        }}
                      >
                        {p.editorial_caption}
                      </p>
                    )}
                  </article>
                </FadeInUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Marquee #3 — tagline final avant footer */}
      <section
        className="overflow-hidden py-6"
        style={{
          background: accent,
          color: bg,
          borderTop: `2px solid ${fg}`,
          borderBottom: `2px solid ${fg}`,
        }}
      >
        <m.div
          className="flex whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            duration: 35,
            ease: "linear",
            repeat: Infinity,
          }}
          style={{ willChange: "transform" }}
        >
          <span
            className="text-[clamp(2rem,5vw,4rem)] tracking-[-0.02em] uppercase pr-8"
            style={{ fontFamily: `'${display}', sans-serif`, fontWeight: 900 }}
          >
            {(footer?.tagline || brand.positioning_one_liner).toUpperCase()}  ◆  {(footer?.tagline || brand.positioning_one_liner).toUpperCase()}  ◆
          </span>
        </m.div>
      </section>

      {/* FOOTER — type slab brut */}
      <footer
        className="px-6 md:px-12 py-24"
        style={{ background: bg, color: fg }}
      >
        <div className="max-w-[1800px] mx-auto">
          <h2
            className="leading-[0.85] tracking-[-0.04em] uppercase mb-16"
            style={{
              fontFamily: `'${display}', sans-serif`,
              fontSize: "clamp(4rem, 18vw, 22rem)",
              fontWeight: 900,
              color: fg,
            }}
          >
            <SplitMaskedReveal
              text={brand.name.toUpperCase()}
              delay={0.1}
              duration={0.9}
              delayStep={0.08}
              splitBy="char"
            />
          </h2>

          <div className="flex flex-col md:flex-row justify-between gap-12 pt-12" style={{ borderTop: `2px solid ${fg}30` }}>
            <FadeInUp>
              <p
                className="text-sm leading-relaxed max-w-md"
                style={{ color: `${fg}99`, fontFamily: `'${sans}', sans-serif` }}
              >
                {footer?.closing_line || creative_direction.reference_style}
              </p>
            </FadeInUp>

            <FadeInUp delay={0.2}>
              <div className="text-right">
                <p
                  className="text-[10px] tracking-[0.4em] uppercase mb-3"
                  style={{ color: muted, fontFamily: `'${sans}', sans-serif`, fontWeight: 600 }}
                >
                  {brand.domain}
                </p>
                <MagneticButton as="a" href="/v3" strength={0.4} hitboxScale={1.5}>
                  <span
                    data-cursor="hover"
                    className="text-[12px] tracking-[0.35em] uppercase border-b-2 pb-1"
                    style={{
                      fontFamily: `'${display}', sans-serif`,
                      color: accent,
                      borderColor: accent,
                      fontWeight: 900,
                    }}
                  >
                    ◆ VERTXIA
                  </span>
                </MagneticButton>
                {brief._meta && (
                  <p
                    className="text-[10px] mt-3"
                    style={{ color: muted, fontFamily: `'${sans}', sans-serif` }}
                  >
                    Brief généré en {brief._meta.generated_in_seconds}s
                  </p>
                )}
              </div>
            </FadeInUp>
          </div>
        </div>
      </footer>
    </main>
  );
}
