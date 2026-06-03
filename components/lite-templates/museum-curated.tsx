"use client";

/**
 * Vertxia Lite — Template "Museum Curated".
 *
 * Mood : luxe ultra-minimaliste. Inspirations : Phoebe Philo, Maison Margiela,
 * Lemaire, Aesop, COS, Jil Sander, The Row.
 *
 * Principes :
 *  - Fond blanc OFF (#FAFAF7), texte presque noir
 *  - Photos petites centrées 55vw max, beaucoup d'espace vertical (py-48)
 *  - Typo serif weight 200-300, taille modeste (pas de gros titres)
 *  - Captions Geist Mono grise sous chaque produit
 *  - Pas de hero "punchy" — un statement centré, c'est tout
 *  - Footer ultra-discret
 *  - Animations : MaskedReveal subtiles + FadeInUp images. ZERO parallax, ZERO Canvas R3F.
 *
 * Animations actives (regle 23) :
 *  1. FadeInUp brand wordmark (entrée)
 *  2. MaskedReveal statement central
 *  3. FadeInUp manifesto kicker + paragraphes (stagger)
 *  4. MaskedReveal section title
 *  5. FadeInUp images produits (stagger très lent — type galerie)
 *  6. MaskedReveal captions
 *  7. MaskedReveal pull_quote
 *  8. data-cursor="view" images produits
 *  9. data-cursor="hover" tous les liens
 * 10. MagneticButton CTA hero (subtil, strength faible)
 */

import type { Brief } from "@/lib/brief";
import { paletteColor } from "@/lib/brief";
import {
  FadeInUp,
  MaskedReveal,
  MagneticButton,
} from "@/components/motion-primitives";

type Props = { brief: Brief };

export function MuseumCurated({ brief }: Props) {
  const { brand, visual_system, creative_direction, site_structure, featured_products, hero, footer } = brief;
  const palette = visual_system.palette;

  // Forcer une palette muted museum quoi qu'envoie la palette générée
  // (le mood museum exige le neutre — on ne suit pas la palette colorée)
  const bg = "#FAFAF7";
  const fg = "#171717";
  const muted = "#8A8A85";
  const hairline = "#E7E5DC";
  const accent = paletteColor(palette, "accent", "#171717"); // accent quasi-noir aussi

  const serif = visual_system.fonts.serif || "Instrument Serif";
  const mono = "Geist Mono";

  const heroProduct = featured_products[0];
  const manifestoSection =
    site_structure.find((s) => /manifest|values|story|philosophy/i.test(s.section));
  const collectionSection =
    site_structure.find((s) => /collection|product|gallery|catalog/i.test(s.section));

  const fontFamilies = [
    `${encodeURIComponent(serif).replace(/%20/g, "+")}:wght@200;300;400`,
    `Geist+Mono:wght@300;400`,
    `Geist:wght@300;400`,
  ];
  const fontsHref = `https://fonts.googleapis.com/css2?family=${fontFamilies.join("&family=")}&display=swap`;

  return (
    <main
      className="min-h-screen antialiased"
      style={{
        background: bg,
        color: fg,
        fontFamily: `'Geist', system-ui, -apple-system, sans-serif`,
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={fontsHref} rel="stylesheet" />

      {/* NAV — ultra discret */}
      <header
        className="fixed top-0 left-0 right-0 z-50"
        style={{ background: `${bg}f0`, backdropFilter: "blur(8px)" }}
      >
        <nav className="max-w-7xl mx-auto px-10 py-6 flex items-center justify-between">
          <FadeInUp duration={0.6}>
            <span
              className="text-[13px] tracking-[0.3em] uppercase"
              style={{ fontFamily: `'${mono}', monospace`, color: fg, fontWeight: 400 }}
            >
              {brand.name}
            </span>
          </FadeInUp>
          <div className="hidden md:flex gap-12">
            {site_structure
              .filter((s) => /manifest|collection|product|philosophy|story/i.test(s.section))
              .slice(0, 4)
              .map((s) => (
                <a
                  key={s.section}
                  href={`#${s.section}`}
                  data-cursor="hover"
                  className="text-[11px] tracking-[0.2em] uppercase transition-colors"
                  style={{
                    fontFamily: `'${mono}', monospace`,
                    color: muted,
                  }}
                >
                  {s.section}
                </a>
              ))}
          </div>
          <span
            className="text-[10px] tracking-[0.25em] uppercase hidden md:block"
            style={{ fontFamily: `'${mono}', monospace`, color: muted }}
          >
            Vertxia
          </span>
        </nav>
      </header>

      {/* HERO — statement centré, photo modeste */}
      <section className="min-h-screen flex flex-col items-center justify-center px-10 pt-40 pb-32">
        <div className="max-w-2xl text-center">
          <FadeInUp delay={0.2}>
            <p
              className="text-[10px] tracking-[0.35em] uppercase mb-16"
              style={{ fontFamily: `'${mono}', monospace`, color: muted }}
            >
              {hero?.kicker || brand.category}
            </p>
          </FadeInUp>
          <h1
            className="leading-[1.15] tracking-tight mb-20 whitespace-pre-line"
            style={{
              fontFamily: `'${serif}', serif`,
              fontWeight: 300,
              fontSize: "clamp(2.2rem, 4.2vw, 3.6rem)",
              color: fg,
            }}
          >
            <MaskedReveal delay={0.5} duration={1.2}>
              {hero?.headline || brand.positioning_one_liner}
            </MaskedReveal>
          </h1>
        </div>

        {/* Photo hero — modeste, centrée, 60vw max */}
        {heroProduct && (heroProduct.video_url || heroProduct.hero_image_url) && (
          <FadeInUp delay={1.0} duration={1.2}>
            <div
              className="w-full mx-auto"
              style={{ maxWidth: "min(60vw, 720px)" }}
              data-cursor="view"
              data-cursor-label="View"
            >
              <div
                className="relative aspect-[4/5] overflow-hidden"
                style={{ background: hairline }}
              >
                {heroProduct.video_url ? (
                  <video
                    src={heroProduct.video_url}
                    poster={heroProduct.hero_image_url}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover absolute inset-0"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${heroProduct.hero_image_url})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center",
                      backgroundColor: bg,
                    }}
                  />
                )}
              </div>
              <FadeInUp delay={0.3}>
                <p
                  className="text-center text-[10px] tracking-[0.3em] uppercase mt-6"
                  style={{ fontFamily: `'${mono}', monospace`, color: muted }}
                >
                  {heroProduct.title}
                  {heroProduct.price_eur ? ` — ${heroProduct.price_eur} €` : ""}
                </p>
              </FadeInUp>
            </div>
          </FadeInUp>
        )}

        {hero?.primary_cta_label && collectionSection && (
          <FadeInUp delay={1.4}>
            <div className="mt-24">
              <MagneticButton
                as="a"
                href={`#${collectionSection.section}`}
                strength={0.25}
                hitboxScale={1.4}
              >
                <span
                  data-cursor="hover"
                  className="inline-block text-[11px] tracking-[0.3em] uppercase pb-1 border-b transition-colors"
                  style={{
                    fontFamily: `'${mono}', monospace`,
                    color: fg,
                    borderColor: fg,
                  }}
                >
                  {hero.primary_cta_label}
                </span>
              </MagneticButton>
            </div>
          </FadeInUp>
        )}
      </section>

      {/* MANIFESTO — colonne étroite, beaucoup d'espace */}
      {manifestoSection && (
        <section
          id={manifestoSection.section}
          className="px-10 py-48"
          style={{ borderTop: `1px solid ${hairline}` }}
        >
          <div className="max-w-xl mx-auto">
            <FadeInUp>
              <p
                className="text-[10px] tracking-[0.35em] uppercase mb-16 text-center"
                style={{ fontFamily: `'${mono}', monospace`, color: muted }}
              >
                — {manifestoSection.section_role || manifestoSection.section}
              </p>
            </FadeInUp>
            {manifestoSection.headline && (
              <h2
                className="leading-[1.2] tracking-tight mb-20 text-center whitespace-pre-line"
                style={{
                  fontFamily: `'${serif}', serif`,
                  fontWeight: 300,
                  fontSize: "clamp(1.6rem, 2.8vw, 2.4rem)",
                }}
              >
                <MaskedReveal delay={0.1} duration={1.1}>
                  {manifestoSection.headline}
                </MaskedReveal>
              </h2>
            )}
            <div className="space-y-8">
              {(manifestoSection.body_paragraphs?.length
                ? manifestoSection.body_paragraphs
                : [manifestoSection.content_hint || creative_direction.narrative_arc]
              ).map((para, i) => (
                <FadeInUp key={i} delay={0.2 + i * 0.15}>
                  <p
                    className="text-[15px] leading-[1.85] text-center"
                    style={{
                      color: `${fg}b5`,
                      fontWeight: 300,
                      fontFamily: `'Geist', sans-serif`,
                    }}
                  >
                    {para}
                  </p>
                </FadeInUp>
              ))}
            </div>
            {manifestoSection.pull_quote && (
              <FadeInUp delay={0.5}>
                <blockquote
                  className="mt-24 text-center italic"
                  style={{
                    fontFamily: `'${serif}', serif`,
                    fontWeight: 300,
                    fontSize: "clamp(1.3rem, 2vw, 1.8rem)",
                    lineHeight: 1.4,
                    color: fg,
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

      {/* COLLECTION — galerie musée, 1 produit par "salle" */}
      {collectionSection && (
        <section
          id={collectionSection.section}
          className="px-10"
          style={{ borderTop: `1px solid ${hairline}` }}
        >
          {/* Section title */}
          <div className="max-w-xl mx-auto pt-48 pb-32 text-center">
            <FadeInUp>
              <p
                className="text-[10px] tracking-[0.35em] uppercase mb-14"
                style={{ fontFamily: `'${mono}', monospace`, color: muted }}
              >
                — {collectionSection.section_role || "Collection"}
              </p>
            </FadeInUp>
            <h3
              className="leading-[1.15] tracking-tight whitespace-pre-line"
              style={{
                fontFamily: `'${serif}', serif`,
                fontWeight: 300,
                fontSize: "clamp(1.8rem, 3.2vw, 2.6rem)",
              }}
            >
              <MaskedReveal delay={0.1}>
                {collectionSection.headline || `${brand.name}.`}
              </MaskedReveal>
            </h3>
          </div>

          {/* Une salle par produit — alternance alignement très subtile */}
          {featured_products.map((p, i) => {
            const alignLeft = i % 2 === 0;
            return (
              <article
                key={p.handle}
                className="py-32 md:py-40"
                style={{
                  borderTop: i === 0 ? `1px solid ${hairline}` : "none",
                  borderBottom: `1px solid ${hairline}`,
                }}
              >
                <div className="max-w-6xl mx-auto">
                  <div
                    className={`flex flex-col items-center md:items-${alignLeft ? "start" : "end"} gap-12 md:gap-16`}
                  >
                    {/* Numéro de pièce — type étiquette musée */}
                    <FadeInUp delay={0}>
                      <p
                        className="text-[10px] tracking-[0.4em] uppercase"
                        style={{ fontFamily: `'${mono}', monospace`, color: muted }}
                      >
                        N° {String(i + 1).padStart(2, "0")}
                      </p>
                    </FadeInUp>

                    {/* Image — modeste, max 55vw */}
                    <FadeInUp delay={0.15} duration={1.1}>
                      <div
                        className="w-full"
                        style={{ maxWidth: "min(55vw, 640px)" }}
                        data-cursor="view"
                        data-cursor-label="View"
                      >
                        <div
                          className="relative aspect-[4/5] overflow-hidden"
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
                              className="w-full h-full object-cover absolute inset-0"
                            />
                          ) : p.hero_image_url ? (
                            <div
                              className="absolute inset-0"
                              style={{
                                backgroundImage: `url(${p.hero_image_url})`,
                                backgroundSize: "contain",
                                backgroundRepeat: "no-repeat",
                                backgroundPosition: "center",
                                backgroundColor: bg,
                              }}
                            />
                          ) : null}
                        </div>
                      </div>
                    </FadeInUp>

                    {/* Caption type cartel musée */}
                    <div
                      className={`max-w-md text-${alignLeft ? "left md:text-left" : "right md:text-right"} w-full`}
                      style={{ maxWidth: "min(55vw, 640px)" }}
                    >
                      <FadeInUp delay={0.3}>
                        <h4
                          className="leading-tight tracking-tight mb-4"
                          style={{
                            fontFamily: `'${serif}', serif`,
                            fontWeight: 300,
                            fontSize: "clamp(1.4rem, 2.2vw, 2rem)",
                          }}
                        >
                          {p.title}
                        </h4>
                      </FadeInUp>
                      <FadeInUp delay={0.4}>
                        <p
                          className="text-[10px] tracking-[0.3em] uppercase mb-6"
                          style={{ fontFamily: `'${mono}', monospace`, color: muted }}
                        >
                          {p.handle.replace(/-/g, " · ")}
                          {p.price_eur ? `  ·  ${p.price_eur} €` : ""}
                        </p>
                      </FadeInUp>
                      {p.editorial_caption && (
                        <FadeInUp delay={0.55}>
                          <p
                            className="text-[14px] leading-[1.8] italic"
                            style={{
                              fontFamily: `'${serif}', serif`,
                              fontWeight: 300,
                              color: `${fg}b0`,
                            }}
                          >
                            {p.editorial_caption}
                          </p>
                        </FadeInUp>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* FOOTER — colophon discret type catalogue */}
      <footer
        className="px-10 py-32"
        style={{ background: bg, color: fg }}
      >
        <div className="max-w-3xl mx-auto text-center">
          <FadeInUp>
            <p
              className="leading-[1.4] mb-12"
              style={{
                fontFamily: `'${serif}', serif`,
                fontWeight: 300,
                fontSize: "clamp(1.2rem, 1.8vw, 1.5rem)",
                color: fg,
              }}
            >
              <MaskedReveal duration={1.0}>
                {footer?.tagline || `${brand.name}.`}
              </MaskedReveal>
            </p>
          </FadeInUp>

          {footer?.closing_line && (
            <FadeInUp delay={0.2}>
              <p
                className="text-[13px] leading-[1.8] max-w-md mx-auto mb-16"
                style={{
                  fontFamily: `'Geist', sans-serif`,
                  fontWeight: 300,
                  color: `${fg}90`,
                }}
              >
                {footer.closing_line}
              </p>
            </FadeInUp>
          )}

          <div
            className="pt-12"
            style={{ borderTop: `1px solid ${hairline}` }}
          >
            <FadeInUp delay={0.4}>
              <p
                className="text-[10px] tracking-[0.35em] uppercase mb-3"
                style={{ fontFamily: `'${mono}', monospace`, color: muted }}
              >
                {brand.domain}
              </p>
            </FadeInUp>
            <FadeInUp delay={0.6}>
              <p
                className="text-[9px] tracking-[0.3em] uppercase"
                style={{ fontFamily: `'${mono}', monospace`, color: muted }}
              >
                Site curaté par
                {" "}
                <MagneticButton as="a" href="/v3" strength={0.2} hitboxScale={1.4}>
                  <span
                    data-cursor="hover"
                    className="border-b transition-colors"
                    style={{ borderColor: muted, color: fg }}
                  >
                    Vertxia
                  </span>
                </MagneticButton>
                {brief._meta && (
                  <>
                    {" "}— Brief en {brief._meta.generated_in_seconds}s
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
