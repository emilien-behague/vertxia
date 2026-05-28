"use client";

/**
 * Vertxia Lite — Template "Documentary Story".
 *
 * RADICALEMENT different des 2 autres templates :
 *  - Long-form vertical (pas snap, smooth scroll fluide pour la lecture)
 *  - Body text en colonne ETROITE centree (~640px) — lisibilite article
 *  - Reading progress bar fine top fixed (signature documentary)
 *  - Drop cap sur le 1er paragraphe de chaque chapitre
 *  - Photos en pleine largeur OU asymetriques (alternance) — pas full-bleed 100vh
 *  - Pull quotes massifs centres en italique serif
 *  - Numerotation chapitres en serif italique
 *  - Produits integres dans le narratif (pas un grid separe)
 *  - End mark + signature (pas un footer commercial)
 *
 * Stack : Framer Motion useScroll/useTransform pour parallax leger,
 * whileInView pour fade-in/up paragraphes, scrollYProgress global pour
 * reading bar.
 */

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
} from "framer-motion";

import type { Brief, FeaturedProduct } from "@/lib/brief";
import { paletteColor } from "@/lib/brief";

type Props = { brief: Brief };

/** Photo avec parallax leger (target = elle-meme). Lisse via useSpring. */
function ParallaxPhoto({
  src,
  alt,
  caption,
  className = "",
  imgClassName = "",
}: {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
  imgClassName?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const yRaw = useTransform(scrollYProgress, [0, 1], [-40, 40]);
  const y = useSpring(yRaw, { stiffness: 60, damping: 20, mass: 0.3 });

  return (
    <figure ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.img
        src={src}
        alt={alt}
        style={{ y: shouldReduceMotion ? 0 : y }}
        className={`w-full h-full object-cover ${imgClassName}`}
      />
      {caption && (
        <figcaption className="mt-3 text-[11px] tracking-[0.2em] uppercase italic opacity-60 max-w-md">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/** Paragraph qui fade-up au scroll (whileInView). */
function FadeInParagraph({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.p>
  );
}

export function DocumentaryStory({ brief }: Props) {
  const {
    brand,
    visual_system,
    creative_direction,
    site_structure,
    featured_products,
    hero,
    footer,
  } = brief;
  const palette = visual_system.palette;

  const bg = paletteColor(palette, "background", "#F5F0E8");
  const fg = paletteColor(palette, "foreground", "#1A1A1A");
  const accent = paletteColor(palette, "accent", "#8B7355");
  const muted = paletteColor(palette, "muted", "#8F9E82");

  const serif = visual_system.fonts.serif || "Cormorant";
  const sans = visual_system.fonts.sans || "Inter";

  // Reading progress global (fixed top bar)
  const { scrollYProgress } = useScroll();
  const progressScaleX = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 25,
    skipInitialAnimation: true,
  });

  // Chapitres = sections du brief filtrees, mappees a featured_products en interleave
  const chapters = site_structure
    .filter((s) => /manifest|story|material|values|engage|process/i.test(s.section))
    .slice(0, Math.max(2, featured_products.length));

  // Pull quote globale (prend la 1ere trouvee)
  const heroPullQuote = site_structure.find((s) => s.pull_quote)?.pull_quote;

  const fontsHref = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(serif).replace(/%20/g, "+")}:wght@300;400;500;600;700&family=${encodeURIComponent(sans).replace(/%20/g, "+")}:wght@300;400;500&display=swap`;

  return (
    <main
      className="antialiased relative"
      style={{
        background: bg,
        color: fg,
        fontFamily: `'${sans}', system-ui, -apple-system, sans-serif`,
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={fontsHref} rel="stylesheet" />

      {/* Reading progress bar — 1px fixed top, signature documentary */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[2px] z-50 origin-left"
        style={{
          scaleX: progressScaleX,
          background: accent,
        }}
      />

      {/* Mini header transparent — juste brand mark + signature Vertxia */}
      <div className="fixed top-6 left-8 z-40 text-[10px] tracking-[0.3em] uppercase mix-blend-difference" style={{ color: "#FFFFFF" }}>
        {brand.name}
      </div>
      <div className="fixed top-6 right-8 z-40 text-[10px] tracking-[0.3em] uppercase mix-blend-difference" style={{ color: "#FFFFFF" }}>
        Une histoire Vertxia
      </div>

      {/* ============ TITLE PAGE ============ */}
      <section className="pt-28 pb-20 md:pt-40 md:pb-32 px-6 md:px-12">
        <div className="max-w-3xl mx-auto">
          {hero?.kicker && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="text-[11px] tracking-[0.4em] uppercase mb-10"
              style={{ color: muted, fontFamily: `'${sans}', sans-serif` }}
            >
              {hero.kicker}
            </motion.p>
          )}
          <motion.h1
            initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl md:text-7xl lg:text-8xl font-light leading-[1.05] tracking-tight mb-12 whitespace-pre-line"
            style={{ fontFamily: `'${serif}', serif` }}
          >
            {hero?.headline || brand.positioning_one_liner}
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-6 mb-12 text-[11px] tracking-[0.3em] uppercase"
            style={{ color: `${fg}80` }}
          >
            <span>{brand.name}</span>
            <span style={{ color: accent }}>·</span>
            <span>{brand.category}</span>
            <span style={{ color: accent }}>·</span>
            <span>Lecture {Math.max(4, featured_products.length * 2)} min</span>
          </motion.div>
          {hero?.subheadline && (
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-xl md:text-2xl leading-relaxed font-light max-w-2xl"
              style={{
                color: `${fg}c0`,
                fontFamily: `'${serif}', serif`,
                fontStyle: "italic",
              }}
            >
              {hero.subheadline}
            </motion.p>
          )}
        </div>
      </section>

      {/* ============ HERO PHOTO FULL-BLEED ============ */}
      {featured_products[0]?.hero_image_url && (
        <section className="px-0 md:px-12 mb-24">
          <ParallaxPhoto
            src={featured_products[0].hero_image_url}
            alt={featured_products[0].title}
            className="w-full h-[55vh] md:h-[75vh] mx-auto max-w-7xl"
            imgClassName="scale-110"
          />
          <p
            className="mt-4 text-[11px] tracking-[0.25em] uppercase italic max-w-7xl mx-auto px-6 md:px-0"
            style={{ color: `${fg}70` }}
          >
            — {featured_products[0].title} · {creative_direction.reference_style}
          </p>
        </section>
      )}

      {/* ============ CHAPTERS interlaced with PRODUCT FEATURES ============ */}
      {chapters.map((chapter, chapterIdx) => {
        const product = featured_products[chapterIdx];
        const romanNumerals = ["I", "II", "III", "IV", "V", "VI"];
        const isPhotoLeft = chapterIdx % 2 === 0;

        return (
          <div key={`chapter-${chapterIdx}`}>
            {/* Chapter intro */}
            <section className="px-6 md:px-12 py-20 md:py-32">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-baseline gap-8 mb-10">
                  <span
                    className="text-5xl md:text-6xl font-light italic"
                    style={{
                      color: accent,
                      fontFamily: `'${serif}', serif`,
                    }}
                  >
                    {romanNumerals[chapterIdx] || `${chapterIdx + 1}`}
                  </span>
                  <span
                    className="text-[11px] tracking-[0.4em] uppercase"
                    style={{ color: muted }}
                  >
                    Chapitre {chapterIdx + 1}
                  </span>
                </div>
                {chapter.headline && (
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    className="text-3xl md:text-5xl font-light leading-[1.15] tracking-tight mb-12 max-w-2xl"
                    style={{ fontFamily: `'${serif}', serif` }}
                  >
                    {chapter.headline}
                  </motion.h2>
                )}

                {/* Body paragraphs : drop cap sur le 1er */}
                <div
                  className="space-y-7 text-lg md:text-xl leading-[1.65] font-light"
                  style={{
                    color: `${fg}c8`,
                    fontFamily: `'${serif}', serif`,
                  }}
                >
                  {(chapter.body_paragraphs || (chapter.content_hint ? [chapter.content_hint] : [])).map((para, pIdx) => (
                    <FadeInParagraph
                      key={pIdx}
                      delay={pIdx * 0.08}
                      className={pIdx === 0 ? "first-letter:text-7xl first-letter:font-medium first-letter:float-left first-letter:mr-3 first-letter:leading-[0.85] first-letter:mt-1" : ""}
                    >
                      {para}
                    </FadeInParagraph>
                  ))}
                </div>

                {/* Pull quote massive si presente sur le chapitre */}
                {chapter.pull_quote && (
                  <motion.blockquote
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="my-20 text-3xl md:text-5xl font-light italic leading-[1.25] tracking-tight text-center max-w-3xl mx-auto"
                    style={{
                      color: fg,
                      fontFamily: `'${serif}', serif`,
                    }}
                  >
                    <span style={{ color: accent }}>«</span> {chapter.pull_quote}{" "}
                    <span style={{ color: accent }}>»</span>
                  </motion.blockquote>
                )}
              </div>
            </section>

            {/* Product feature attache au chapitre (asymetrique alterne) */}
            {product && (
              <section
                className="px-6 md:px-12 py-20 md:py-32"
                style={{ background: chapterIdx % 2 === 0 ? `${fg}06` : "transparent" }}
              >
                <div
                  className={`max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 items-center ${isPhotoLeft ? "" : "md:[direction:rtl]"}`}
                >
                  {/* Photo (gauche par defaut, droite si !isPhotoLeft via rtl) */}
                  <div className="md:col-span-7 md:[direction:ltr]">
                    {product.video_url ? (
                      <motion.video
                        initial={{ opacity: 0, scale: 0.98 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                        src={product.video_url}
                        poster={product.hero_image_url}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full aspect-[4/5] object-cover"
                      />
                    ) : product.hero_image_url ? (
                      <ParallaxPhoto
                        src={product.hero_image_url}
                        alt={product.title}
                        className="w-full aspect-[4/5]"
                      />
                    ) : null}
                  </div>

                  {/* Texte side */}
                  <div className="md:col-span-5 md:[direction:ltr]">
                    <p
                      className="text-[11px] tracking-[0.3em] uppercase mb-4"
                      style={{ color: muted }}
                    >
                      Piece n° {String(chapterIdx + 1).padStart(2, "0")}
                    </p>
                    <h3
                      className="text-3xl md:text-4xl font-light leading-tight tracking-tight mb-6"
                      style={{ fontFamily: `'${serif}', serif` }}
                    >
                      {product.title}
                    </h3>
                    {product.editorial_caption && (
                      <p
                        className="text-base md:text-lg italic leading-relaxed mb-8"
                        style={{
                          color: `${fg}b0`,
                          fontFamily: `'${serif}', serif`,
                        }}
                      >
                        {product.editorial_caption}
                      </p>
                    )}
                    <div
                      className="flex items-baseline justify-between pt-6 border-t"
                      style={{ borderColor: `${fg}20` }}
                    >
                      {product.price_eur && (
                        <span
                          className="text-2xl font-light"
                          style={{ fontFamily: `'${serif}', serif` }}
                        >
                          {product.price_eur} €
                        </span>
                      )}
                      <a
                        href="#"
                        className="text-[11px] tracking-[0.3em] uppercase pb-1"
                        style={{
                          color: fg,
                          borderBottom: `1px solid ${fg}40`,
                        }}
                      >
                        Voir →
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        );
      })}

      {/* Si plus de produits que de chapitres, ajoute en feature simple */}
      {featured_products.slice(chapters.length).map((product, idx) => {
        const realIdx = chapters.length + idx;
        const isPhotoLeft = realIdx % 2 === 0;
        return (
          <section
            key={`extra-product-${realIdx}`}
            className="px-6 md:px-12 py-20 md:py-32"
            style={{ background: realIdx % 2 === 0 ? `${fg}06` : "transparent" }}
          >
            <div
              className={`max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 items-center ${isPhotoLeft ? "" : "md:[direction:rtl]"}`}
            >
              <div className="md:col-span-7 md:[direction:ltr]">
                {product.video_url ? (
                  <motion.video
                    initial={{ opacity: 0, scale: 0.98 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                    src={product.video_url}
                    poster={product.hero_image_url}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full aspect-[4/5] object-cover"
                  />
                ) : product.hero_image_url ? (
                  <ParallaxPhoto
                    src={product.hero_image_url}
                    alt={product.title}
                    className="w-full aspect-[4/5]"
                  />
                ) : null}
              </div>
              <div className="md:col-span-5 md:[direction:ltr]">
                <p
                  className="text-[11px] tracking-[0.3em] uppercase mb-4"
                  style={{ color: muted }}
                >
                  Piece n° {String(realIdx + 1).padStart(2, "0")}
                </p>
                <h3
                  className="text-3xl md:text-4xl font-light leading-tight tracking-tight mb-6"
                  style={{ fontFamily: `'${serif}', serif` }}
                >
                  {product.title}
                </h3>
                {product.editorial_caption && (
                  <p
                    className="text-base md:text-lg italic leading-relaxed mb-8"
                    style={{
                      color: `${fg}b0`,
                      fontFamily: `'${serif}', serif`,
                    }}
                  >
                    {product.editorial_caption}
                  </p>
                )}
                {product.price_eur && (
                  <div
                    className="pt-6 border-t"
                    style={{ borderColor: `${fg}20` }}
                  >
                    <span
                      className="text-2xl font-light"
                      style={{ fontFamily: `'${serif}', serif` }}
                    >
                      {product.price_eur} €
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}

      {/* ============ GLOBAL PULL QUOTE (mid-article climax) ============ */}
      {heroPullQuote && (
        <section className="py-32 md:py-48 px-6 md:px-12">
          <motion.blockquote
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl md:text-6xl lg:text-7xl font-light italic leading-[1.1] tracking-tight text-center max-w-5xl mx-auto"
            style={{
              color: fg,
              fontFamily: `'${serif}', serif`,
            }}
          >
            <span style={{ color: accent }}>«</span> {heroPullQuote}{" "}
            <span style={{ color: accent }}>»</span>
          </motion.blockquote>
        </section>
      )}

      {/* ============ END MARK + POSTFACE ============ */}
      <section className="py-32 md:py-48 px-6 md:px-12 text-center">
        <div className="max-w-2xl mx-auto">
          {/* End mark — symbole decoratif typographique */}
          <div
            className="text-3xl mb-12 tracking-[2em]"
            style={{ color: accent }}
          >
            ◆ ◆ ◆
          </div>
          {footer?.tagline && (
            <p
              className="text-2xl md:text-3xl font-light italic leading-[1.4] mb-10"
              style={{ fontFamily: `'${serif}', serif`, color: fg }}
            >
              {footer.tagline}
            </p>
          )}
          {footer?.closing_line && (
            <p
              className="text-base md:text-lg leading-relaxed max-w-xl mx-auto mb-16"
              style={{ color: `${fg}90` }}
            >
              {footer.closing_line}
            </p>
          )}
          <div className="pt-12 border-t flex flex-col items-center gap-3" style={{ borderColor: `${fg}14` }}>
            <p
              className="text-[10px] tracking-[0.4em] uppercase"
              style={{ color: `${fg}60` }}
            >
              {brand.domain}
            </p>
            <a
              href="/lite"
              className="text-[11px] tracking-[0.3em] uppercase pb-1 mt-4"
              style={{
                color: fg,
                borderBottom: `1px solid ${fg}40`,
              }}
            >
              Autres histoires Vertxia →
            </a>
            <p
              className="text-[9px] tracking-[0.3em] uppercase mt-12"
              style={{ color: `${fg}40` }}
            >
              Article généré par Vertxia Lite
              {brief._meta && ` · ${brief._meta.model}`}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
