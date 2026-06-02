"use client";

/**
 * Vertxia Lite — Template "Noir Magazine".
 *
 * Mood : magazine luxe noir. Inspirations :
 *  - Voyager Press (travel magazine) — fond noir total + énorme wordmark serif display
 *  - Wallpaper magazine — typography heavy + photos accent couleur underneath
 *  - Mr Porter Journal — éditorial noir premium
 *  - Cabana magazine — luxury underground
 *
 * Principes :
 *  - Fond noir TOTAL (#0A0A0A) + texte blanc + 1 accent couleur (orange/rouge/cyan)
 *  - Hero = GIGANTESQUE wordmark serif (Fraunces / Newsreader) centré 22vw
 *  - Photos en accent couleur saturée (pas noir/blanc) — contraste max sur fond noir
 *  - 2-3 photos teasers sous wordmark hero (pattern Voyager Press)
 *  - Sections : article magazine avec drop caps + colonnes texte + photos pleine largeur
 *  - Footer : énorme tagline + colophon catalog-style
 *  - ZERO glitch, ZERO scanlines (c'est noir MAGAZINE, pas cyberpunk)
 *
 * Animations actives (regle 23) :
 *  1. SplitMaskedReveal char-par-char wordmark hero GIGANT
 *  2. FadeInUp kicker hero
 *  3. MaskedReveal subhead hero
 *  4. FadeInUp stagger teaser cards (entrée)
 *  5. ParallaxImage teaser photos (scroll-driven)
 *  6. SplitMaskedReveal article title
 *  7. FadeInUp article paragraphes stagger
 *  8. MaskedReveal pull_quote serif italique
 *  9. ParallaxBg photos pleine largeur entre sections
 * 10. SplitMaskedReveal section section titles
 * 11. MagneticButton CTA et footer link
 * 12. data-cursor variants
 * 13. Hover scale photos cards
 */

import type { Brief } from "@/lib/brief";
import { paletteColor } from "@/lib/brief";
import {
  FadeInUp,
  MaskedReveal,
  SplitMaskedReveal,
  MagneticButton,
  ParallaxBg,
} from "@/components/motion-primitives";

type Props = { brief: Brief };

export function NoirMagazine({ brief }: Props) {
  const { brand, visual_system, creative_direction, site_structure, featured_products, hero, footer } = brief;
  const palette = visual_system.palette;

  // Forcer fond noir total + 1 accent couleur du brief
  const bg = "#0A0A0A";
  const fg = "#F5F1E8";
  const accentFromBrief = paletteColor(palette, "accent", "#E8521A");
  const accent = accentFromBrief; // garde l'accent du brief (orange/rouge/cyan)
  const muted = "#888880";
  const hairline = "#252520";

  const serif = visual_system.fonts.serif || "Fraunces";
  const sans = visual_system.fonts.sans || "Geist";

  // Hero teasers : prendre les 3 premiers produits
  const teasers = featured_products.slice(0, 3);
  const heroProduct = featured_products[0];

  const articleSection =
    site_structure.find((s) => /manifest|story|philosophy|article/i.test(s.section));
  const collectionSection =
    site_structure.find((s) => /collection|product|gallery|catalog/i.test(s.section));

  const fontFamilies = [
    `${encodeURIComponent(serif).replace(/%20/g, "+")}:wght@300;400;500;700;900`,
    `${encodeURIComponent(sans).replace(/%20/g, "+")}:wght@300;400;500`,
  ];
  const fontsHref = `https://fonts.googleapis.com/css2?family=${fontFamilies.join("&family=")}&display=swap`;

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

      {/* NAV — discret tight magazine masthead */}
      <header
        className="fixed top-0 left-0 right-0 z-50"
        style={{ background: `${bg}d0`, backdropFilter: "blur(12px)" }}
      >
        <nav className="max-w-[1800px] mx-auto px-8 py-5 flex items-center justify-between">
          <span
            className="text-[11px] tracking-[0.4em] uppercase"
            style={{ fontFamily: `'${sans}', sans-serif`, color: muted, fontWeight: 500 }}
          >
            ◇ Issue N° 01
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
                  className="text-[11px] tracking-[0.35em] uppercase transition-colors"
                  style={{ color: muted, fontFamily: `'${sans}', sans-serif`, fontWeight: 500 }}
                >
                  {s.section}
                </a>
              ))}
          </div>
          <span
            className="text-[10px] tracking-[0.4em] uppercase hidden md:block"
            style={{ color: accent, fontFamily: `'${sans}', sans-serif`, fontWeight: 600 }}
          >
            ◇ VERTXIA
          </span>
        </nav>
      </header>

      {/* HERO — wordmark GIGANTESQUE centré */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-32 pb-20">
        <FadeInUp delay={0.2}>
          <p
            className="text-[11px] tracking-[0.5em] uppercase mb-12 text-center"
            style={{ color: muted, fontFamily: `'${sans}', sans-serif`, fontWeight: 500 }}
          >
            {hero?.kicker || `${brand.category} · 2026`}
          </p>
        </FadeInUp>

        {/* Wordmark GIGANT centré */}
        <h1
          className="text-center leading-[0.85] tracking-[-0.05em] mb-16 mx-auto"
          style={{
            fontFamily: `'${serif}', serif`,
            color: fg,
            fontSize: "clamp(4rem, 22vw, 22rem)",
            fontWeight: 400,
            fontStyle: "normal",
          }}
        >
          <SplitMaskedReveal
            text={brand.name}
            delay={0.4}
            duration={1.1}
            delayStep={0.07}
            splitBy="char"
          />
        </h1>

        {/* Tagline italique sous wordmark */}
        <FadeInUp delay={1.4}>
          <p
            className="max-w-2xl text-center text-base md:text-lg leading-relaxed italic mb-3"
            style={{
              color: `${fg}b0`,
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
          <FadeInUp delay={1.6}>
            <p
              className="max-w-xl text-center text-sm leading-relaxed mt-4"
              style={{ color: muted, fontFamily: `'${sans}', sans-serif`, fontWeight: 400 }}
            >
              {hero.subheadline}
            </p>
          </FadeInUp>
        )}

        {/* Indicateur scroll */}
        <div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.4em] uppercase hidden md:block"
          style={{ color: muted, fontFamily: `'${sans}', sans-serif`, fontWeight: 500 }}
        >
          ↓ Continue ↓
        </div>
      </section>

      {/* HERO TEASERS — 3 photos couleur saturée sous wordmark (pattern Voyager Press) */}
      <section className="px-6 md:px-12 pb-32" style={{ borderBottom: `1px solid ${hairline}` }}>
        <div className="max-w-[1800px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {teasers.map((p, i) => (
              <FadeInUp key={p.handle} delay={0.1 + i * 0.15} duration={1.0}>
                <a
                  href={collectionSection ? `#${collectionSection.section}` : "#collection"}
                  data-cursor="view"
                  data-cursor-label="View"
                  className="group block"
                >
                  <div
                    className="relative aspect-[3/4] overflow-hidden mb-5"
                    style={{ background: hairline }}
                  >
                    {p.video_url ? (
                      <video
                        src={p.video_url}
                        poster={p.hero_image_url}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : p.hero_image_url ? (
                      <div
                        className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                        style={{
                          backgroundImage: `url(${p.hero_image_url})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                    ) : null}
                    {/* Numéro feature en accent overlay coin haut */}
                    <div
                      className="absolute top-3 left-3 text-[10px] tracking-[0.35em] uppercase px-2.5 py-1"
                      style={{
                        background: accent,
                        color: bg,
                        fontFamily: `'${sans}', sans-serif`,
                        fontWeight: 700,
                      }}
                    >
                      Feature {String(i + 1).padStart(2, "0")}
                    </div>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <h3
                      className="text-xl md:text-2xl leading-tight tracking-tight"
                      style={{ fontFamily: `'${serif}', serif`, fontWeight: 400, color: fg }}
                    >
                      {p.title}
                    </h3>
                    {p.price_eur && (
                      <span
                        className="text-xs tracking-[0.2em] uppercase"
                        style={{ color: accent, fontFamily: `'${sans}', sans-serif`, fontWeight: 600 }}
                      >
                        {p.price_eur} €
                      </span>
                    )}
                  </div>
                  {p.editorial_caption && (
                    <p
                      className="text-sm italic leading-relaxed"
                      style={{
                        color: `${fg}88`,
                        fontFamily: `'${serif}', serif`,
                        fontWeight: 300,
                      }}
                    >
                      {p.editorial_caption}
                    </p>
                  )}
                </a>
              </FadeInUp>
            ))}
          </div>
        </div>
      </section>

      {/* ARTICLE — format magazine avec drop cap + colonnes */}
      {articleSection && (
        <section
          id={articleSection.section}
          className="px-6 md:px-12 py-32 md:py-48"
          style={{ borderBottom: `1px solid ${hairline}` }}
        >
          <div className="max-w-4xl mx-auto">
            <FadeInUp>
              <p
                className="text-[11px] tracking-[0.4em] uppercase mb-12 text-center"
                style={{ color: accent, fontFamily: `'${sans}', sans-serif`, fontWeight: 600 }}
              >
                ◇ {articleSection.section_role || "Article"} ◇
              </p>
            </FadeInUp>

            {articleSection.headline && (
              <h2
                className="text-center leading-[1.05] tracking-[-0.02em] mb-20 whitespace-pre-line"
                style={{
                  fontFamily: `'${serif}', serif`,
                  fontSize: "clamp(2rem, 4.5vw, 3.8rem)",
                  fontWeight: 400,
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

            <div className="max-w-2xl mx-auto">
              {(articleSection.body_paragraphs?.length
                ? articleSection.body_paragraphs
                : [articleSection.content_hint || creative_direction.narrative_arc]
              ).map((para, i) => (
                <FadeInUp key={i} delay={0.2 + i * 0.15}>
                  <p
                    className="text-base md:text-lg leading-[1.9] mb-8"
                    style={{
                      color: `${fg}c0`,
                      fontFamily: `'${serif}', serif`,
                      fontWeight: 400,
                    }}
                  >
                    {i === 0 && (
                      <span
                        className="float-left mr-4 leading-[0.9]"
                        style={{
                          fontFamily: `'${serif}', serif`,
                          fontSize: "5rem",
                          fontWeight: 700,
                          color: accent,
                          marginTop: "0.5rem",
                        }}
                      >
                        {para.charAt(0)}
                      </span>
                    )}
                    {i === 0 ? para.slice(1) : para}
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
                  }}
                >
                  <MaskedReveal duration={1.0}>« {articleSection.pull_quote} »</MaskedReveal>
                </blockquote>
                <p
                  className="text-center mt-6 text-[10px] tracking-[0.4em] uppercase"
                  style={{ color: accent, fontFamily: `'${sans}', sans-serif`, fontWeight: 600 }}
                >
                  — {brand.name}
                </p>
              </FadeInUp>
            )}
          </div>
        </section>
      )}

      {/* SPREAD PHOTO PLEINE LARGEUR — feature image */}
      {heroProduct?.hero_image_url && (
        <section
          className="relative w-full h-[80vh] overflow-hidden"
          style={{ borderBottom: `1px solid ${hairline}` }}
        >
          <ParallaxBg
            src={heroProduct.hero_image_url}
            className="absolute inset-0 w-full h-full"
            distance={140}
            scale={1.2}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${bg}50 0%, transparent 30%, transparent 70%, ${bg}cc 100%)`,
            }}
          />
          <div className="relative z-10 h-full flex flex-col justify-end px-6 md:px-12 pb-16">
            <FadeInUp>
              <p
                className="text-[10px] tracking-[0.4em] uppercase mb-3"
                style={{ color: accent, fontFamily: `'${sans}', sans-serif`, fontWeight: 600 }}
              >
                Spread N° 01
              </p>
            </FadeInUp>
            <FadeInUp delay={0.2}>
              <p
                className="max-w-2xl text-2xl md:text-3xl italic leading-snug"
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

      {/* COLLECTION — index magazine type "Featured in this issue" */}
      {collectionSection && (
        <section
          id={collectionSection.section}
          className="px-6 md:px-12 py-32 md:py-48"
          style={{ borderBottom: `1px solid ${hairline}` }}
        >
          <div className="max-w-[1800px] mx-auto">
            <div className="text-center mb-24">
              <FadeInUp>
                <p
                  className="text-[11px] tracking-[0.4em] uppercase mb-10"
                  style={{ color: accent, fontFamily: `'${sans}', sans-serif`, fontWeight: 600 }}
                >
                  ◇ {collectionSection.section_role || "Featured in this issue"} ◇
                </p>
              </FadeInUp>
              <h3
                className="leading-[0.95] tracking-[-0.03em] whitespace-pre-line"
                style={{
                  fontFamily: `'${serif}', serif`,
                  fontSize: "clamp(2.5rem, 6vw, 5.5rem)",
                  fontWeight: 400,
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

            {/* Liste type index magazine */}
            <div className="max-w-4xl mx-auto">
              {featured_products.map((p, i) => (
                <FadeInUp key={p.handle} delay={i * 0.08}>
                  <a
                    href="#"
                    data-cursor="hover"
                    className="group flex items-center justify-between gap-8 py-10 transition-all"
                    style={{
                      borderTop: i === 0 ? `1px solid ${hairline}` : "none",
                      borderBottom: `1px solid ${hairline}`,
                    }}
                  >
                    {/* Numéro page */}
                    <span
                      className="text-sm tracking-[0.3em] hidden md:block"
                      style={{ color: muted, fontFamily: `'${sans}', sans-serif`, fontWeight: 500 }}
                    >
                      P. {String(i + 1).padStart(3, "0")}
                    </span>

                    {/* Mini thumb couleur */}
                    {p.hero_image_url && (
                      <div
                        className="w-16 h-20 md:w-20 md:h-24 flex-shrink-0 overflow-hidden"
                        style={{
                          backgroundImage: `url(${p.hero_image_url})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          background: hairline,
                        }}
                      />
                    )}

                    {/* Title + caption */}
                    <div className="flex-1 min-w-0">
                      <h4
                        className="text-2xl md:text-4xl leading-tight tracking-tight mb-2 transition-colors group-hover:opacity-80"
                        style={{ fontFamily: `'${serif}', serif`, fontWeight: 400, color: fg }}
                      >
                        {p.title}
                      </h4>
                      {p.editorial_caption && (
                        <p
                          className="text-sm italic leading-relaxed truncate"
                          style={{ color: muted, fontFamily: `'${serif}', serif` }}
                        >
                          {p.editorial_caption}
                        </p>
                      )}
                    </div>

                    {/* Price + arrow */}
                    <div className="flex items-center gap-6 flex-shrink-0">
                      {p.price_eur && (
                        <span
                          className="text-base"
                          style={{ color: accent, fontFamily: `'${serif}', serif`, fontWeight: 500 }}
                        >
                          {p.price_eur} €
                        </span>
                      )}
                      <span
                        className="text-lg transition-transform group-hover:translate-x-2"
                        style={{ color: fg }}
                        aria-hidden
                      >
                        →
                      </span>
                    </div>
                  </a>
                </FadeInUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FOOTER — masthead style magazine */}
      <footer className="px-6 md:px-12 py-32" style={{ background: bg, color: fg }}>
        <div className="max-w-[1800px] mx-auto">
          {/* Tagline GIGANT serif italique */}
          <h2
            className="leading-[0.95] tracking-[-0.03em] mb-20 italic"
            style={{
              fontFamily: `'${serif}', serif`,
              fontSize: "clamp(3rem, 10vw, 11rem)",
              fontWeight: 300,
              color: fg,
            }}
          >
            <SplitMaskedReveal
              text={footer?.tagline || brand.name}
              delay={0.1}
              duration={1.0}
              delayStep={0.05}
              splitBy="word"
            />
          </h2>

          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-12 pt-12"
            style={{ borderTop: `1px solid ${hairline}` }}
          >
            {/* Colophon */}
            <FadeInUp>
              <p
                className="text-[10px] tracking-[0.4em] uppercase mb-3"
                style={{ color: muted, fontFamily: `'${sans}', sans-serif`, fontWeight: 600 }}
              >
                Colophon
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: `${fg}a0`, fontFamily: `'${serif}', serif`, fontWeight: 300 }}
              >
                {footer?.closing_line || creative_direction.reference_style}
              </p>
            </FadeInUp>

            {/* Contact */}
            <FadeInUp delay={0.15}>
              <p
                className="text-[10px] tracking-[0.4em] uppercase mb-3"
                style={{ color: muted, fontFamily: `'${sans}', sans-serif`, fontWeight: 600 }}
              >
                Address
              </p>
              <p
                className="text-sm leading-relaxed"
                style={{ color: `${fg}a0`, fontFamily: `'${sans}', sans-serif`, fontWeight: 400 }}
              >
                {brand.domain}
                <br />
                {brand.category}
              </p>
            </FadeInUp>

            {/* Publisher */}
            <FadeInUp delay={0.3}>
              <p
                className="text-[10px] tracking-[0.4em] uppercase mb-3"
                style={{ color: muted, fontFamily: `'${sans}', sans-serif`, fontWeight: 600 }}
              >
                Published by
              </p>
              <MagneticButton as="a" href="/v3" strength={0.3} hitboxScale={1.5}>
                <span
                  data-cursor="hover"
                  className="text-2xl leading-tight italic border-b transition-colors"
                  style={{
                    fontFamily: `'${serif}', serif`,
                    fontWeight: 400,
                    color: accent,
                    borderColor: accent,
                  }}
                >
                  Vertxia
                </span>
              </MagneticButton>
              {brief._meta && (
                <p
                  className="text-[10px] mt-3"
                  style={{ color: muted, fontFamily: `'${sans}', sans-serif` }}
                >
                  Issue composed in {brief._meta.generated_in_seconds}s
                </p>
              )}
            </FadeInUp>
          </div>
        </div>
      </footer>
    </main>
  );
}
