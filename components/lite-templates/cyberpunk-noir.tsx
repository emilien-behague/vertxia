"use client";

/**
 * Vertxia Lite — Template "Cyberpunk Noir".
 *
 * Mood : tech cinematic moody + glitch subtil + accent néon. Inspirations :
 *  - SARAH MITCHELL portfolio — vidéo dark forêt fullscreen + serif italique centré
 *  - Triage (dev tool) — fond noir total + UI tech minimal
 *  - Blade Runner / Cyberpunk 2077 — palette noir + 1 accent néon vif
 *  - Awwwards SOTD agency dark
 *
 * Principes :
 *  - Vidéo dark fullscreen autoplay loop (b-roll moody)
 *  - Serif italique centré weight 300 (Fraunces italic)
 *  - Accent NÉON vif (cyan / magenta / lime / orange-red selon brief)
 *  - Scanlines CSS overlay constant (repeating linear-gradient)
 *  - Glitch hover sur CTA et titles (text-shadow chromatic aberration)
 *  - Marquee top "SYSTEM • SCANNING • READY"
 *  - Footer terminal-style avec status indicators
 *
 * Animations actives (regle 23) :
 *  1. SplitMaskedReveal char-par-char wordmark hero (serif italique)
 *  2. FadeInUp kicker tech avec pulse glow
 *  3. MaskedReveal subhead
 *  4. Vidéo background autoplay loop (visual)
 *  5. Scanlines overlay (background-image)
 *  6. Marquee top "SYSTEM ONLINE" tech tape
 *  7. SplitMaskedReveal section titles
 *  8. FadeInUp paragraphes stagger
 *  9. ParallaxBg secondary photos
 * 10. MagneticButton CTA neon glow
 * 11. Glitch hover effect sur produits (CSS keyframes)
 * 12. data-cursor crosshair sur images
 * 13. m.div marquee bottom "TRANSMISSION ENDS"
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

export function CyberpunkNoir({ brief }: Props) {
  const { brand, visual_system, creative_direction, site_structure, featured_products, hero, footer } = brief;
  const palette = visual_system.palette;

  // Forcer fond noir total + accent neon vif (garde l'accent brief mais boost saturation)
  const bg = "#050507";
  const fg = "#E8E8EC";
  const accentFromBrief = paletteColor(palette, "accent", "#00F5D4");
  const accent = accentFromBrief;
  const muted = "#5A5A65";
  const hairline = "#1A1A20";

  const serif = visual_system.fonts.serif || "Fraunces";
  const sans = visual_system.fonts.sans || "Geist Mono";

  const heroProduct = featured_products[0];
  const heroVideo = heroProduct?.video_url;
  const heroImage = heroProduct?.hero_image_url;

  const articleSection =
    site_structure.find((s) => /manifest|story|philosophy|article/i.test(s.section));
  const collectionSection =
    site_structure.find((s) => /collection|product|gallery|catalog/i.test(s.section));

  const fontFamilies = [
    `${encodeURIComponent(serif).replace(/%20/g, "+")}:ital,wght@0,300;0,400;1,300;1,400;1,500`,
    `Geist+Mono:wght@300;400;500;600`,
  ];
  const fontsHref = `https://fonts.googleapis.com/css2?family=${fontFamilies.join("&family=")}&display=swap`;

  // Scanlines pattern (CSS background)
  const scanlinesStyle = {
    backgroundImage: `repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 2px,
      ${fg}05 2px,
      ${fg}05 3px
    )`,
  };

  return (
    <main
      className="min-h-screen antialiased overflow-x-hidden relative"
      style={{
        background: bg,
        color: fg,
        fontFamily: `'Geist Mono', 'JetBrains Mono', ui-monospace, monospace`,
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={fontsHref} rel="stylesheet" />

      {/* Glitch keyframes + scanlines overlay global */}
      <style jsx global>{`
        @keyframes neon-pulse {
          0%, 100% { opacity: 0.85; text-shadow: 0 0 8px ${accent}80, 0 0 16px ${accent}40; }
          50% { opacity: 1; text-shadow: 0 0 12px ${accent}b0, 0 0 24px ${accent}60; }
        }
        @keyframes glitch-text {
          0%, 100% { transform: translate(0); text-shadow: -1px 0 ${accent}, 1px 0 #ff006e; }
          20% { transform: translate(-1px, 1px); }
          40% { transform: translate(1px, -1px); }
          60% { transform: translate(-1px, 0); }
          80% { transform: translate(1px, 1px); }
        }
        .neon-pulse {
          animation: neon-pulse 2.5s ease-in-out infinite;
        }
        .glitch-hover:hover {
          animation: glitch-text 0.4s linear;
        }
        .cn-scanlines::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(0deg, transparent 0px, transparent 2px, ${fg}06 2px, ${fg}06 3px);
          pointer-events: none;
          mix-blend-mode: overlay;
          z-index: 1;
        }
      `}</style>

      {/* Scanlines overlay global */}
      <div
        className="fixed inset-0 pointer-events-none z-[60]"
        style={{
          ...scanlinesStyle,
          mixBlendMode: "overlay",
          opacity: 0.4,
        }}
        aria-hidden
      />

      {/* MARQUEE TOP — system status tech tape */}
      <div
        className="fixed top-0 left-0 right-0 z-[55] overflow-hidden py-1"
        style={{ background: bg, borderBottom: `1px solid ${accent}40` }}
      >
        <m.div
          className="flex whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 60, ease: "linear", repeat: Infinity }}
        >
          <span
            className="text-[10px] tracking-[0.3em] uppercase pr-8"
            style={{ fontFamily: `'Geist Mono', monospace`, color: accent, fontWeight: 500 }}
          >
            {`◢ SYSTEM ONLINE  ◢  ${brand.name.toUpperCase()} // SCANNING  ◢  TRANSMISSION ACTIVE  ◢  READY  ◢  `.repeat(8)}
          </span>
        </m.div>
      </div>

      {/* NAV — terminal-style */}
      <header
        className="fixed top-6 left-0 right-0 z-50"
        style={{ background: `${bg}b0`, backdropFilter: "blur(10px)", borderBottom: `1px solid ${hairline}` }}
      >
        <nav className="max-w-[1800px] mx-auto px-8 py-4 flex items-center justify-between">
          <span
            className="text-[11px] tracking-[0.3em] uppercase"
            style={{ fontFamily: `'Geist Mono', monospace`, color: accent, fontWeight: 500 }}
          >
            ◢ {brand.name.toUpperCase()}
          </span>
          <div className="hidden md:flex gap-10">
            {site_structure
              .filter((s) => /manifest|collection|product|story|article/i.test(s.section))
              .slice(0, 4)
              .map((s) => (
                <a
                  key={s.section}
                  href={`#${s.section}`}
                  data-cursor="hover"
                  className="text-[10px] tracking-[0.3em] uppercase transition-colors glitch-hover"
                  style={{ color: muted, fontFamily: `'Geist Mono', monospace`, fontWeight: 500 }}
                >
                  {`// ${s.section}`}
                </a>
              ))}
          </div>
          <span
            className="text-[10px] tracking-[0.3em] uppercase hidden md:block"
            style={{ color: muted, fontFamily: `'Geist Mono', monospace` }}
          >
            VRTX/v0.1 ◢
          </span>
        </nav>
      </header>

      {/* HERO — vidéo dark fullscreen + serif italique centré */}
      <section className="relative min-h-screen overflow-hidden">
        {/* Vidéo / image fond dark */}
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
              style={{ filter: "brightness(0.55) contrast(1.15) saturate(0.85)" }}
            />
          ) : heroImage ? (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${heroImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "brightness(0.5) contrast(1.2) saturate(0.7)",
              }}
            />
          ) : null}
          {/* Overlay sombre dégradé */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at center, ${bg}40 0%, ${bg}b0 70%, ${bg}f0 100%)`,
            }}
          />
        </div>

        {/* Contenu centré */}
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 pt-32 pb-20">
          <FadeInUp delay={0.2}>
            <p
              className="text-[10px] tracking-[0.5em] uppercase mb-12 text-center neon-pulse"
              style={{
                fontFamily: `'Geist Mono', monospace`,
                color: accent,
                fontWeight: 600,
              }}
            >
              ◢ {hero?.kicker || `${brand.category} // PROTOCOL 01`} ◣
            </p>
          </FadeInUp>

          {/* Wordmark serif italique centré (style Sarah Mitchell) */}
          <h1
            className="text-center leading-[0.95] tracking-[-0.04em] italic mb-12 mx-auto"
            style={{
              fontFamily: `'${serif}', serif`,
              color: fg,
              fontSize: "clamp(3.5rem, 12vw, 12rem)",
              fontWeight: 300,
              textShadow: `0 0 40px ${bg}c0, 0 4px 80px ${accent}30`,
            }}
          >
            <SplitMaskedReveal
              text={brand.name}
              delay={0.5}
              duration={1.2}
              delayStep={0.08}
              splitBy="char"
            />
          </h1>

          {/* Crosshair separator */}
          <FadeInUp delay={1.3}>
            <div className="flex items-center gap-4 mb-12">
              <span
                style={{
                  width: "60px",
                  height: "1px",
                  background: accent,
                  display: "block",
                  boxShadow: `0 0 8px ${accent}`,
                }}
              />
              <span
                className="text-[10px] tracking-[0.4em] uppercase"
                style={{
                  fontFamily: `'Geist Mono', monospace`,
                  color: accent,
                  fontWeight: 600,
                }}
              >
                ◆
              </span>
              <span
                style={{
                  width: "60px",
                  height: "1px",
                  background: accent,
                  display: "block",
                  boxShadow: `0 0 8px ${accent}`,
                }}
              />
            </div>
          </FadeInUp>

          {/* Tagline + subhead */}
          <FadeInUp delay={1.5}>
            <p
              className="max-w-2xl text-center text-base md:text-lg leading-relaxed italic mb-8"
              style={{
                color: fg,
                fontFamily: `'${serif}', serif`,
                fontWeight: 300,
              }}
            >
              <MaskedReveal duration={0.9}>
                {hero?.headline || brand.positioning_one_liner}
              </MaskedReveal>
            </p>
          </FadeInUp>

          {hero?.subheadline && (
            <FadeInUp delay={1.7}>
              <p
                className="max-w-xl text-center text-xs leading-relaxed mb-12"
                style={{
                  color: muted,
                  fontFamily: `'Geist Mono', monospace`,
                  fontWeight: 400,
                  letterSpacing: "0.05em",
                }}
              >
                {`> ${hero.subheadline}`}
              </p>
            </FadeInUp>
          )}

          {hero?.primary_cta_label && collectionSection && (
            <FadeInUp delay={2.0}>
              <MagneticButton
                as="a"
                href={`#${collectionSection.section}`}
                strength={0.4}
                hitboxScale={1.5}
              >
                <span
                  data-cursor="hover"
                  className="inline-flex items-center gap-3 px-8 py-3 text-[11px] tracking-[0.35em] uppercase transition-all duration-300 glitch-hover"
                  style={{
                    border: `1px solid ${accent}`,
                    color: accent,
                    background: "transparent",
                    fontFamily: `'Geist Mono', monospace`,
                    fontWeight: 600,
                    boxShadow: `0 0 20px ${accent}30, inset 0 0 20px ${accent}10`,
                  }}
                >
                  ◢ {hero.primary_cta_label}
                  <span aria-hidden>→</span>
                </span>
              </MagneticButton>
            </FadeInUp>
          )}
        </div>

        {/* Status indicator bottom */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 hidden md:flex items-center gap-3"
          style={{ color: muted, fontFamily: `'Geist Mono', monospace`, fontSize: "10px" }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full neon-pulse"
            style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
          />
          <span className="tracking-[0.4em] uppercase">REC // SCROLL TO ENGAGE</span>
        </div>
      </section>

      {/* ARTICLE — terminal output style */}
      {articleSection && (
        <section
          id={articleSection.section}
          className="relative px-6 md:px-12 py-32 md:py-48"
          style={{ borderTop: `1px solid ${hairline}` }}
        >
          <div className="max-w-4xl mx-auto">
            <FadeInUp>
              <p
                className="text-[11px] tracking-[0.4em] uppercase mb-12 text-center"
                style={{
                  fontFamily: `'Geist Mono', monospace`,
                  color: accent,
                  fontWeight: 600,
                }}
              >
                ◢ {`// ${articleSection.section_role || "Manifesto"} // ◣`}
              </p>
            </FadeInUp>

            {articleSection.headline && (
              <h2
                className="text-center leading-[1.05] tracking-[-0.02em] italic mb-20 whitespace-pre-line"
                style={{
                  fontFamily: `'${serif}', serif`,
                  fontSize: "clamp(2rem, 5vw, 4rem)",
                  fontWeight: 300,
                  color: fg,
                }}
              >
                <SplitMaskedReveal
                  text={articleSection.headline}
                  delay={0.1}
                  duration={1.0}
                  delayStep={0.05}
                  splitBy="word"
                />
              </h2>
            )}

            <div className="max-w-2xl mx-auto space-y-8">
              {(articleSection.body_paragraphs?.length
                ? articleSection.body_paragraphs
                : [articleSection.content_hint || creative_direction.narrative_arc]
              ).map((para, i) => (
                <FadeInUp key={i} delay={0.2 + i * 0.15}>
                  <p
                    className="text-base leading-[1.9]"
                    style={{
                      color: `${fg}c0`,
                      fontFamily: `'${serif}', serif`,
                      fontWeight: 400,
                    }}
                  >
                    <span
                      className="mr-3"
                      style={{
                        color: accent,
                        fontFamily: `'Geist Mono', monospace`,
                        fontWeight: 600,
                        fontSize: "11px",
                      }}
                    >
                      {`[${String(i + 1).padStart(2, "0")}]`}
                    </span>
                    {para}
                  </p>
                </FadeInUp>
              ))}
            </div>

            {articleSection.pull_quote && (
              <FadeInUp delay={0.6}>
                <blockquote
                  className="mt-20 text-center max-w-3xl mx-auto italic"
                  style={{
                    fontFamily: `'${serif}', serif`,
                    fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
                    fontWeight: 300,
                    lineHeight: 1.3,
                    color: fg,
                    textShadow: `0 0 30px ${accent}30`,
                  }}
                >
                  <MaskedReveal duration={1.0}>« {articleSection.pull_quote} »</MaskedReveal>
                </blockquote>
              </FadeInUp>
            )}
          </div>
        </section>
      )}

      {/* SPREAD — parallax image dark */}
      {heroImage && (
        <section
          className="relative w-full h-[70vh] overflow-hidden"
          style={{ borderTop: `1px solid ${hairline}`, borderBottom: `1px solid ${hairline}` }}
        >
          <ParallaxBg
            src={heroImage}
            className="absolute inset-0 w-full h-full"
            distance={140}
            scale={1.2}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${bg}80 0%, ${bg}40 50%, ${bg}d0 100%)`,
            }}
          />
          <div className="relative z-10 h-full flex flex-col justify-end px-6 md:px-12 pb-16">
            <FadeInUp>
              <p
                className="text-[10px] tracking-[0.5em] uppercase mb-4"
                style={{
                  fontFamily: `'Geist Mono', monospace`,
                  color: accent,
                  fontWeight: 600,
                }}
              >
                ◢ FRAME 01 // SPREAD
              </p>
            </FadeInUp>
            <FadeInUp delay={0.2}>
              <p
                className="max-w-2xl text-xl md:text-2xl italic leading-snug"
                style={{
                  fontFamily: `'${serif}', serif`,
                  fontWeight: 300,
                  color: fg,
                }}
              >
                {creative_direction.reference_style}
              </p>
            </FadeInUp>
          </div>
        </section>
      )}

      {/* COLLECTION — grid dark avec hover glow neon */}
      {collectionSection && (
        <section
          id={collectionSection.section}
          className="px-6 md:px-12 py-32 md:py-48"
        >
          <div className="max-w-[1800px] mx-auto">
            <div className="text-center mb-24">
              <FadeInUp>
                <p
                  className="text-[11px] tracking-[0.4em] uppercase mb-10"
                  style={{
                    fontFamily: `'Geist Mono', monospace`,
                    color: accent,
                    fontWeight: 600,
                  }}
                >
                  ◢ {`// ${collectionSection.section_role || "Catalog"} //`} ◣
                </p>
              </FadeInUp>
              <h3
                className="leading-[0.95] tracking-[-0.03em] italic"
                style={{
                  fontFamily: `'${serif}', serif`,
                  fontSize: "clamp(2.5rem, 6vw, 5rem)",
                  fontWeight: 300,
                  color: fg,
                }}
              >
                <SplitMaskedReveal
                  text={collectionSection.headline || "The Collection"}
                  delay={0.1}
                  duration={0.9}
                  delayStep={0.06}
                  splitBy="word"
                />
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {featured_products.map((p, i) => (
                <FadeInUp key={p.handle} delay={i * 0.1} duration={0.9}>
                  <article
                    className="group relative"
                    style={{ border: `1px solid ${hairline}` }}
                  >
                    {/* Numéro frame en haut */}
                    <div
                      className="flex items-center justify-between px-3 py-2"
                      style={{
                        borderBottom: `1px solid ${hairline}`,
                        background: `${hairline}80`,
                      }}
                    >
                      <span
                        className="text-[9px] tracking-[0.3em] uppercase"
                        style={{
                          fontFamily: `'Geist Mono', monospace`,
                          color: accent,
                          fontWeight: 600,
                        }}
                      >
                        ◢ FRAME_{String(i + 1).padStart(3, "0")}
                      </span>
                      <span
                        className="text-[9px] tracking-[0.2em] uppercase"
                        style={{
                          fontFamily: `'Geist Mono', monospace`,
                          color: muted,
                        }}
                      >
                        ID:{p.handle.slice(0, 8).toUpperCase()}
                      </span>
                    </div>

                    {/* Image */}
                    <div
                      className="relative aspect-[4/5] overflow-hidden"
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
                          className="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                          style={{ filter: "brightness(0.85) saturate(0.9)" }}
                        />
                      ) : p.hero_image_url ? (
                        <div
                          className="absolute inset-0 transition-all duration-500 group-hover:scale-105"
                          style={{
                            backgroundImage: `url(${p.hero_image_url})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            filter: "brightness(0.85) saturate(0.9)",
                          }}
                        />
                      ) : null}
                      {/* Crosshair coin */}
                      <div
                        className="absolute top-3 right-3 pointer-events-none"
                        style={{
                          width: "14px",
                          height: "14px",
                          border: `1px solid ${accent}`,
                          opacity: 0.6,
                        }}
                      />
                      <div
                        className="absolute bottom-3 left-3 pointer-events-none"
                        style={{
                          width: "14px",
                          height: "14px",
                          border: `1px solid ${accent}`,
                          opacity: 0.6,
                        }}
                      />
                    </div>

                    {/* Footer card */}
                    <div
                      className="px-4 py-4"
                      style={{ borderTop: `1px solid ${hairline}` }}
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-2">
                        <h4
                          className="text-lg leading-tight italic"
                          style={{ fontFamily: `'${serif}', serif`, fontWeight: 400, color: fg }}
                        >
                          {p.title}
                        </h4>
                        {p.price_eur && (
                          <span
                            className="text-[11px] tracking-[0.2em] uppercase"
                            style={{
                              color: accent,
                              fontFamily: `'Geist Mono', monospace`,
                              fontWeight: 600,
                            }}
                          >
                            {p.price_eur}€
                          </span>
                        )}
                      </div>
                      {p.editorial_caption && (
                        <p
                          className="text-xs italic leading-relaxed"
                          style={{
                            color: muted,
                            fontFamily: `'${serif}', serif`,
                            fontWeight: 300,
                          }}
                        >
                          {p.editorial_caption}
                        </p>
                      )}
                    </div>
                  </article>
                </FadeInUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FOOTER — terminal-style status panel */}
      <footer
        className="px-6 md:px-12 py-24"
        style={{
          background: bg,
          color: fg,
          borderTop: `1px solid ${accent}40`,
        }}
      >
        <div className="max-w-[1800px] mx-auto">
          {/* Énorme tagline italique */}
          <h2
            className="leading-[0.95] tracking-[-0.03em] italic mb-16"
            style={{
              fontFamily: `'${serif}', serif`,
              fontSize: "clamp(2.5rem, 8vw, 9rem)",
              fontWeight: 300,
              color: fg,
              textShadow: `0 0 40px ${accent}20`,
            }}
          >
            <SplitMaskedReveal
              text={footer?.tagline || brand.name}
              delay={0.1}
              duration={1.0}
              delayStep={0.06}
              splitBy="word"
            />
          </h2>

          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-12"
            style={{ borderTop: `1px solid ${hairline}` }}
          >
            {/* Status */}
            <FadeInUp>
              <p
                className="text-[9px] tracking-[0.4em] uppercase mb-3"
                style={{ color: muted, fontFamily: `'Geist Mono', monospace`, fontWeight: 600 }}
              >
                // STATUS
              </p>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full neon-pulse"
                  style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
                />
                <span
                  className="text-xs tracking-[0.2em] uppercase"
                  style={{ color: fg, fontFamily: `'Geist Mono', monospace`, fontWeight: 500 }}
                >
                  ONLINE
                </span>
              </div>
            </FadeInUp>

            {/* Domain */}
            <FadeInUp delay={0.1}>
              <p
                className="text-[9px] tracking-[0.4em] uppercase mb-3"
                style={{ color: muted, fontFamily: `'Geist Mono', monospace`, fontWeight: 600 }}
              >
                // ADDRESS
              </p>
              <p
                className="text-xs leading-relaxed"
                style={{ color: fg, fontFamily: `'Geist Mono', monospace`, fontWeight: 400 }}
              >
                {brand.domain}
              </p>
            </FadeInUp>

            {/* Sector */}
            <FadeInUp delay={0.2}>
              <p
                className="text-[9px] tracking-[0.4em] uppercase mb-3"
                style={{ color: muted, fontFamily: `'Geist Mono', monospace`, fontWeight: 600 }}
              >
                // SECTOR
              </p>
              <p
                className="text-xs leading-relaxed"
                style={{ color: fg, fontFamily: `'Geist Mono', monospace`, fontWeight: 400 }}
              >
                {brand.category}
              </p>
            </FadeInUp>

            {/* Vertxia */}
            <FadeInUp delay={0.3}>
              <p
                className="text-[9px] tracking-[0.4em] uppercase mb-3"
                style={{ color: muted, fontFamily: `'Geist Mono', monospace`, fontWeight: 600 }}
              >
                // COMPILED BY
              </p>
              <MagneticButton as="a" href="/v3" strength={0.3} hitboxScale={1.5}>
                <span
                  data-cursor="hover"
                  className="text-xs tracking-[0.3em] uppercase glitch-hover"
                  style={{
                    fontFamily: `'Geist Mono', monospace`,
                    color: accent,
                    fontWeight: 600,
                  }}
                >
                  ◢ VERTXIA
                </span>
              </MagneticButton>
              {brief._meta && (
                <p
                  className="text-[9px] mt-2"
                  style={{ color: muted, fontFamily: `'Geist Mono', monospace` }}
                >
                  Build {brief._meta.generated_in_seconds}s
                </p>
              )}
            </FadeInUp>
          </div>

          {/* Bottom marquee */}
          <div
            className="mt-16 overflow-hidden py-3"
            style={{ borderTop: `1px solid ${hairline}` }}
          >
            <m.div
              className="flex whitespace-nowrap"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 80, ease: "linear", repeat: Infinity }}
            >
              <span
                className="text-[10px] tracking-[0.4em] uppercase pr-8"
                style={{ fontFamily: `'Geist Mono', monospace`, color: muted, fontWeight: 500 }}
              >
                {`◢ TRANSMISSION ENDS  ◢  ${brand.name.toUpperCase()} // 2026  ◢  END OF FILE  ◢  `.repeat(6)}
              </span>
            </m.div>
          </div>
        </div>
      </footer>
    </main>
  );
}
