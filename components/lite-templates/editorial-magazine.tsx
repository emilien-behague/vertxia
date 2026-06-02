"use client";

/**
 * Vertxia Lite — Template "Editorial Magazine" (motion edition).
 *
 * Hero pattern Loewe (logo overlay) + Aesop (bloc texte bottom-left).
 *
 * Animations actives (regle 23) :
 *  1. SplitMaskedReveal brand wordmark giant (char par char)
 *  2. FadeInUp kicker hero
 *  3. MaskedReveal headline hero
 *  4. MagneticButton CTA hero
 *  5. ParallaxBg hero photo
 *  6. FadeInUp manifesto kicker
 *  7. MaskedReveal manifesto headline
 *  8. FadeInUp stagger manifesto paragraphes
 *  9. MaskedReveal pull_quote
 * 10. FadeInUp collection header
 * 11. FadeInUp stagger product cards
 * 12. ParallaxImage product cards (scroll-driven)
 * 13. MaskedReveal footer tagline
 * 14. MagneticButton footer link Vertxia Lite
 * 15. data-cursor="hover" sur tous les liens
 * 16. data-cursor="view" sur images produits
 */

import type { Brief } from "@/lib/brief";
import { paletteColor } from "@/lib/brief";
import { BalancedHeading } from "@/components/lite-templates/balanced-heading";
import { AutoAnimateGrid } from "@/components/lite-templates/auto-animate-grid";
import {
  FadeInUp,
  MaskedReveal,
  SplitMaskedReveal,
  MagneticButton,
  ParallaxBg,
} from "@/components/motion-primitives";

type Props = { brief: Brief };

export function EditorialMagazine({ brief }: Props) {
  const { brand, visual_system, creative_direction, site_structure, featured_products, hero, footer } = brief;
  const palette = visual_system.palette;

  const bg = paletteColor(palette, "background", "#F5F0E8");
  const fg = paletteColor(palette, "foreground", "#1A1A1A");
  const accent = paletteColor(palette, "accent", "#E8521A");
  const muted = paletteColor(palette, "muted", "#8F9E82");
  const shadow = paletteColor(palette, "shadow", "#3D3028");

  const serif = visual_system.fonts.serif || "Cormorant";
  const sans = visual_system.fonts.sans || "Inter";

  const heroProduct = featured_products[0];
  const heroVideo = heroProduct?.video_url;
  const heroImage = heroProduct?.hero_image_url;

  const manifestoSection =
    site_structure.find((s) => s.section.toLowerCase() === "manifesto") ||
    site_structure.find((s) => /manifest|values|material|story/i.test(s.section));
  const collectionSection =
    site_structure.find((s) => s.section.toLowerCase() === "collection") ||
    site_structure.find((s) => /collection|product|gallery/i.test(s.section));

  const fontFamilies = [
    `${encodeURIComponent(serif).replace(/%20/g, "+")}:wght@300;400;500;600`,
    `${encodeURIComponent(sans).replace(/%20/g, "+")}:wght@300;400;500`,
  ];
  const fontsHref = `https://fonts.googleapis.com/css2?family=${fontFamilies.join("&family=")}&display=swap`;

  return (
    <main
      className="min-h-screen antialiased"
      style={{
        background: bg,
        color: fg,
        fontFamily: `'${sans}', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`,
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={fontsHref} rel="stylesheet" />

      {/* NAV */}
      <header
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b"
        style={{
          background: `${bg}b3`,
          borderColor: `${fg}10`,
        }}
      >
        <nav className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <span
            className="text-lg tracking-[0.15em] uppercase font-light"
            style={{ fontFamily: `'${serif}', serif` }}
          >
            {brand.name}
          </span>
          <div
            className="hidden md:flex gap-10 text-[12px] tracking-[0.2em] uppercase"
            style={{ color: `${fg}99` }}
          >
            {site_structure
              .filter((s) => /manifest|material|collection|product/i.test(s.section))
              .slice(0, 4)
              .map((s) => (
                <a
                  key={s.section}
                  href={`#${s.section}`}
                  data-cursor="hover"
                  className="hover:opacity-100 transition-opacity"
                  style={{ opacity: 0.6 }}
                >
                  {s.section}
                </a>
              ))}
          </div>
          <span
            className="text-[10px] tracking-[0.25em] uppercase font-mono"
            style={{ color: muted }}
          >
            Site généré par Vertxia
          </span>
        </nav>
      </header>

      {/* HERO Loewe+Aesop */}
      <section className="relative min-h-screen overflow-hidden">
        {/* Photo plein écran avec parallax */}
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
              distance={100}
              scale={1.18}
            />
          ) : null}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, transparent 0%, transparent 45%, ${bg}80 75%, ${bg}f5 100%)`,
            }}
          />
        </div>

        {/* Brand wordmark giant overlay top-left */}
        <div className="absolute top-0 left-0 z-10 pt-20 md:pt-24 pl-6 md:pl-12 pointer-events-none">
          <span
            className="block font-light leading-none uppercase"
            style={{
              fontFamily: `'${sans}', sans-serif`,
              color: accent,
              fontSize: "clamp(2.8rem, 8.5vw, 8.5rem)",
              letterSpacing: "-0.04em",
              fontWeight: 300,
              opacity: 0.95,
            }}
          >
            <SplitMaskedReveal
              text={brand.name}
              delay={0.2}
              duration={1.0}
              delayStep={0.05}
              splitBy="char"
            />
          </span>
        </div>

        {/* Bloc texte bottom-left */}
        <div className="absolute bottom-12 md:bottom-16 left-0 right-0 z-10 px-6 md:px-12">
          <div className="max-w-5xl">
            <FadeInUp delay={0.5}>
              <p
                className="text-[10px] md:text-[11px] tracking-[0.3em] uppercase mb-5 md:mb-7"
                style={{ color: `${fg}b3`, fontFamily: `'${sans}', sans-serif` }}
              >
                — {hero?.kicker || brand.category}
              </p>
            </FadeInUp>
            <h1
              className="font-light leading-[0.95] tracking-tight mb-7 md:mb-10 whitespace-pre-line"
              style={{
                fontFamily: `'${serif}', serif`,
                color: fg,
                fontSize: "clamp(2.2rem, 5.5vw, 4.8rem)",
              }}
            >
              <MaskedReveal delay={0.7} duration={1.1}>
                {hero?.headline || brand.positioning_one_liner}
              </MaskedReveal>
            </h1>
            <FadeInUp delay={1.3}>
              <MagneticButton
                as="a"
                href={collectionSection ? `#${collectionSection.section}` : "#collection"}
                strength={0.4}
                hitboxScale={1.5}
              >
                <span
                  data-cursor="hover"
                  className="inline-flex items-center gap-3 px-7 py-3 text-[11px] tracking-[0.25em] uppercase border rounded-full transition-colors duration-500 hover:bg-white/5"
                  style={{
                    borderColor: `${fg}55`,
                    color: fg,
                    fontFamily: `'${sans}', sans-serif`,
                  }}
                >
                  {hero?.primary_cta_label || "Voir la collection"}
                  <span aria-hidden style={{ fontSize: "1.1em" }}>→</span>
                </span>
              </MagneticButton>
            </FadeInUp>
          </div>
        </div>

        <div
          className="absolute bottom-12 right-6 md:right-12 z-10 text-[10px] tracking-[0.3em] uppercase animate-pulse hidden md:block"
          style={{ color: `${fg}55` }}
        >
          ↓ Scroll
        </div>
      </section>

      {/* MANIFESTO */}
      {manifestoSection && (
        <section
          id={manifestoSection.section}
          className="px-8 py-40 border-t"
          style={{ borderColor: `${fg}14` }}
        >
          <div className="max-w-3xl mx-auto">
            <FadeInUp>
              <p
                className="text-[11px] tracking-[0.3em] uppercase mb-12"
                style={{ color: muted, fontFamily: `'${sans}', sans-serif` }}
              >
                — {manifestoSection.section_role || "Manifeste"}
              </p>
            </FadeInUp>
            <h2
              className="text-4xl md:text-6xl font-light leading-[1.1] tracking-tight mb-16 whitespace-pre-line"
              style={{ fontFamily: `'${serif}', serif` }}
            >
              <MaskedReveal delay={0.1} duration={1.1}>
                <BalancedHeading ratio={0.5}>
                  {manifestoSection.headline ||
                    brand.positioning_one_liner.split(/[.,]/)[0] + "."}
                </BalancedHeading>
              </MaskedReveal>
            </h2>
            <div
              className="space-y-7 text-lg md:text-xl leading-relaxed font-light"
              style={{ color: `${fg}c0` }}
            >
              {(manifestoSection.body_paragraphs?.length
                ? manifestoSection.body_paragraphs
                : [
                    manifestoSection.content_hint ||
                      creative_direction.narrative_arc,
                  ]
              ).map((para, i) => (
                <FadeInUp key={i} delay={0.2 + i * 0.15}>
                  <p>{para}</p>
                </FadeInUp>
              ))}
            </div>
            {manifestoSection.pull_quote && (
              <FadeInUp delay={0.5}>
                <blockquote
                  className="mt-16 pl-6 border-l-2 text-2xl md:text-3xl italic font-light leading-snug"
                  style={{
                    borderColor: accent,
                    color: `${fg}d0`,
                    fontFamily: `'${serif}', serif`,
                  }}
                >
                  <MaskedReveal duration={1.0}>
                    {manifestoSection.pull_quote}
                  </MaskedReveal>
                </blockquote>
              </FadeInUp>
            )}
          </div>
        </section>
      )}

      {/* COLLECTION */}
      {collectionSection && (
        <section
          id={collectionSection.section}
          className="px-8 py-32 border-t"
          style={{
            borderColor: `${fg}14`,
            background: `${fg}06`,
          }}
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-20 flex-wrap gap-8">
              <div>
                <FadeInUp>
                  <p
                    className="text-[11px] tracking-[0.3em] uppercase mb-6"
                    style={{ color: muted, fontFamily: `'${sans}', sans-serif` }}
                  >
                    — {collectionSection.section_role || "Collection"}
                  </p>
                </FadeInUp>
                <h3
                  className="text-4xl md:text-5xl font-light tracking-tight whitespace-pre-line"
                  style={{ fontFamily: `'${serif}', serif` }}
                >
                  <MaskedReveal delay={0.1}>
                    {collectionSection.headline || `${brand.name}.`}
                  </MaskedReveal>
                </h3>
              </div>
              <FadeInUp delay={0.3}>
                <div
                  className="max-w-md text-base leading-relaxed space-y-4"
                  style={{ color: `${fg}99` }}
                >
                  {(collectionSection.body_paragraphs?.length
                    ? collectionSection.body_paragraphs
                    : [collectionSection.content_hint || ""]
                  ).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </FadeInUp>
            </div>

            <AutoAnimateGrid className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {featured_products.map((p, i) => (
                <FadeInUp key={p.handle} delay={i * 0.1} duration={0.9}>
                  <article className="group">
                    <div
                      className="relative aspect-[4/5] mb-6 overflow-hidden"
                      style={{ background: bg }}
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
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                        />
                      ) : p.hero_image_url ? (
                        <div
                          className="absolute inset-0 transition-transform duration-1000 group-hover:scale-105"
                          style={{
                            backgroundImage: `url(${p.hero_image_url})`,
                            backgroundSize: "contain",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "center",
                            backgroundColor: bg,
                          }}
                        />
                      ) : null}
                      {!p.video_url && (
                        <div
                          className="absolute top-3 right-3 text-[9px] tracking-[0.25em] uppercase px-2.5 py-1 rounded-sm"
                          style={{
                            background: `${shadow}cc`,
                            color: bg,
                          }}
                        >
                          Vidéo en cours
                        </div>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <div>
                        <h4
                          className="text-2xl md:text-3xl font-light tracking-tight"
                          style={{ fontFamily: `'${serif}', serif` }}
                        >
                          {p.title}
                        </h4>
                        <p
                          className="text-[11px] tracking-[0.25em] uppercase mt-1"
                          style={{ color: `${fg}80` }}
                        >
                          {p.handle.replace(/-/g, " ")}
                        </p>
                      </div>
                      {p.price_eur && (
                        <div
                          className="text-xl font-light"
                          style={{ fontFamily: `'${serif}', serif` }}
                        >
                          {p.price_eur} €
                        </div>
                      )}
                    </div>
                    <p
                      className="text-sm mt-4 leading-relaxed italic"
                      style={{ color: `${fg}99`, fontFamily: `'${serif}', serif` }}
                    >
                      {p.editorial_caption}
                    </p>
                  </article>
                </FadeInUp>
              ))}
            </AutoAnimateGrid>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer
        className="px-8 py-20 border-t"
        style={{
          borderColor: `${fg}14`,
          background: fg,
          color: bg,
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div>
            <p
              className="text-3xl font-light leading-[1.1] mb-4 max-w-md"
              style={{ fontFamily: `'${serif}', serif`, color: bg }}
            >
              <MaskedReveal duration={1.1}>
                <em className="italic">{brand.name}.</em>
                {" "}
                {footer?.tagline || creative_direction.reference_style}
              </MaskedReveal>
            </p>
            {footer?.closing_line && (
              <FadeInUp delay={0.3}>
                <p
                  className="text-sm opacity-60 mt-4 max-w-md leading-relaxed"
                  style={{ color: bg }}
                >
                  {footer.closing_line}
                </p>
              </FadeInUp>
            )}
            <FadeInUp delay={0.5}>
              <p
                className="text-[10px] tracking-[0.3em] uppercase opacity-50 mt-6"
                style={{ color: bg }}
              >
                {brand.domain}
              </p>
            </FadeInUp>
          </div>
          <div className="flex flex-col items-end gap-3">
            <FadeInUp delay={0.2}>
              <p
                className="text-[10px] tracking-[0.3em] uppercase opacity-40"
                style={{ color: bg }}
              >
                Site démo généré par
              </p>
            </FadeInUp>
            <MagneticButton as="a" href="/v3" strength={0.4} hitboxScale={1.5}>
              <span
                data-cursor="hover"
                className="text-2xl tracking-[0.15em] uppercase font-light transition-colors"
                style={{
                  fontFamily: `'${serif}', serif`,
                  color: bg,
                }}
              >
                Vertxia Lite
              </span>
            </MagneticButton>
            <FadeInUp delay={0.6}>
              <p
                className="text-[10px] opacity-40 mt-2 max-w-sm text-right leading-relaxed"
                style={{ color: bg }}
              >
                Pipeline auto : Shopify → brief créatif IA → vidéos cinematic → site unique.
                {brief._meta && (
                  <>
                    {" "}
                    Brief généré en {brief._meta.generated_in_seconds}s par{" "}
                    {brief._meta.model}.
                  </>
                )}
              </p>
            </FadeInUp>
          </div>
        </div>
      </footer>
    </main>
  );
}
