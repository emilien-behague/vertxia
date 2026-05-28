/**
 * Vertxia Lite — Template "Cinematic Narrative".
 *
 * Squelette RADICALEMENT different de editorial-magazine :
 *  - scroll-snap mandatory : 1 section = 1 fullscreen
 *  - chaque produit = 1 ecran dedie (pas de grid)
 *  - video full-bleed en background + overlay caption alterne gauche/droite
 *  - manifesto split en "interludes" (pull quotes) entre les produits
 *  - footer = derniere section pleine page (pas un strip en bas)
 *
 * Aucun container max-width fixe, aucune grid produit, pas de header fixed
 * (juste un compteur de section + dot indicator a droite).
 */

import type { Brief } from "@/lib/brief";
import { paletteColor } from "@/lib/brief";

type Props = { brief: Brief };

export function CinematicNarrative({ brief }: Props) {
  const { brand, visual_system, creative_direction, site_structure, featured_products, hero, footer } = brief;
  const palette = visual_system.palette;

  const bg = paletteColor(palette, "background", "#F5F0E8");
  const fg = paletteColor(palette, "foreground", "#1A1A1A");
  const accent = paletteColor(palette, "accent", "#E8521A");
  const muted = paletteColor(palette, "muted", "#8F9E82");

  const serif = visual_system.fonts.serif || "Cormorant";
  const sans = visual_system.fonts.sans || "Inter";

  // Manifeste split : on prend les pull_quotes des sections + les headlines comme interludes
  const interludes: string[] = [];
  for (const s of site_structure) {
    if (s.pull_quote) interludes.push(s.pull_quote);
    else if (s.headline && /manifest|values|material/i.test(s.section)) {
      interludes.push(s.headline);
    }
  }
  // Fallback : au moins 1 interlude depuis le narrative_arc
  if (interludes.length === 0 && creative_direction.narrative_arc) {
    interludes.push(creative_direction.narrative_arc);
  }

  // Compose la liste finale de sections : hero -> interlude -> produit -> interlude -> produit -> ... -> footer
  type Block =
    | { kind: "hero" }
    | { kind: "interlude"; text: string }
    | { kind: "product"; product: typeof featured_products[number]; index: number }
    | { kind: "footer" };

  const blocks: Block[] = [{ kind: "hero" }];

  // Intercale interludes entre produits
  featured_products.forEach((p, i) => {
    // Interlude avant chaque produit, en cyclant
    if (interludes.length > 0) {
      const interlude = interludes[i % interludes.length];
      // Pas 2 interludes consecutifs
      if (i === 0 || (i > 0 && interludes[i % interludes.length] !== interludes[(i - 1) % interludes.length])) {
        blocks.push({ kind: "interlude", text: interlude });
      }
    }
    blocks.push({ kind: "product", product: p, index: i });
  });

  blocks.push({ kind: "footer" });

  const fontsHref = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(serif).replace(/%20/g, "+")}:wght@300;400;500;600&family=${encodeURIComponent(sans).replace(/%20/g, "+")}:wght@300;400;500&display=swap`;

  return (
    <main
      className="antialiased h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth"
      style={{
        background: bg,
        color: fg,
        fontFamily: `'${sans}', system-ui, -apple-system, sans-serif`,
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={fontsHref} rel="stylesheet" />

      {/* Brand mark fixe top-left + dot indicator a droite */}
      <div
        className="fixed top-6 left-8 z-50 text-[11px] tracking-[0.3em] uppercase mix-blend-difference"
        style={{ color: "#FFFFFF", fontFamily: `'${sans}', sans-serif` }}
      >
        {brand.name}
      </div>
      <div
        className="fixed top-6 right-8 z-50 text-[10px] tracking-[0.3em] uppercase mix-blend-difference"
        style={{ color: "#FFFFFF" }}
      >
        Site généré par Vertxia
      </div>

      {/* Blocks render */}
      {blocks.map((block, blockIdx) => {
        const key = `block-${blockIdx}`;

        if (block.kind === "hero") {
          const heroVideo = featured_products[0]?.video_url;
          const heroImage = featured_products[0]?.hero_image_url;
          return (
            <section
              key={key}
              className="snap-start relative w-full h-screen overflow-hidden flex items-end"
            >
              {heroVideo ? (
                <video
                  src={heroVideo}
                  poster={heroImage}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : heroImage ? (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${heroImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              ) : null}
              {/* Dark gradient bottom for text legibility */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 35%, transparent 60%, rgba(0,0,0,0.55) 100%)",
                }}
              />
              <div className="relative z-10 px-8 md:px-16 pb-24 max-w-5xl">
                {hero?.kicker && (
                  <p
                    className="text-[11px] tracking-[0.3em] uppercase mb-8"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  >
                    — {hero.kicker}
                  </p>
                )}
                <h1
                  className="text-5xl md:text-7xl lg:text-8xl font-light leading-[1.05] tracking-tight mb-8 whitespace-pre-line"
                  style={{
                    color: "#FFFFFF",
                    fontFamily: `'${serif}', serif`,
                    textShadow: "0 2px 24px rgba(0,0,0,0.3)",
                  }}
                >
                  {hero?.headline || brand.positioning_one_liner}
                </h1>
                {hero?.subheadline && (
                  <p
                    className="text-base md:text-lg max-w-xl leading-relaxed font-light"
                    style={{ color: "rgba(255,255,255,0.85)" }}
                  >
                    {hero.subheadline}
                  </p>
                )}
              </div>
              {/* Scroll cue */}
              <div
                className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.4em] uppercase z-10"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                ↓ &nbsp; Défile
              </div>
            </section>
          );
        }

        if (block.kind === "interlude") {
          return (
            <section
              key={key}
              className="snap-start relative w-full h-screen flex items-center justify-center px-12 md:px-24"
              style={{ background: bg }}
            >
              {/* Decorative line */}
              <div
                className="absolute top-1/3 left-1/2 -translate-x-1/2 w-20 h-px"
                style={{ background: accent }}
              />
              <blockquote
                className="text-3xl md:text-5xl lg:text-6xl font-light italic leading-[1.15] tracking-tight text-center max-w-4xl"
                style={{
                  color: fg,
                  fontFamily: `'${serif}', serif`,
                }}
              >
                <span style={{ color: accent }}>«</span> {block.text}{" "}
                <span style={{ color: accent }}>»</span>
              </blockquote>
              <div
                className="absolute bottom-12 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.3em] uppercase"
                style={{ color: `${fg}60` }}
              >
                {brand.voice}
              </div>
            </section>
          );
        }

        if (block.kind === "product") {
          const p = block.product;
          const isLeft = block.index % 2 === 0; // overlay alterne gauche/droite
          return (
            <section
              key={key}
              className="snap-start relative w-full h-screen overflow-hidden"
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
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              ) : (
                <div className="absolute inset-0" style={{ background: bg }} />
              )}

              {/* Side overlay : gauche pour pair, droite pour impair */}
              <div
                className={`absolute inset-y-0 ${isLeft ? "left-0" : "right-0"} w-full md:w-2/5 flex items-end px-8 md:px-12 pb-16`}
                style={{
                  background: `linear-gradient(${isLeft ? "90deg" : "270deg"}, ${bg}f5 0%, ${bg}d0 60%, transparent 100%)`,
                }}
              >
                <div className="max-w-md">
                  {/* Numero produit */}
                  <p
                    className="text-[10px] tracking-[0.4em] uppercase mb-6"
                    style={{ color: muted }}
                  >
                    {String(block.index + 1).padStart(2, "0")} / {String(featured_products.length).padStart(2, "0")}
                  </p>

                  <h2
                    className="text-4xl md:text-5xl lg:text-6xl font-light leading-tight tracking-tight mb-6"
                    style={{
                      color: fg,
                      fontFamily: `'${serif}', serif`,
                    }}
                  >
                    {p.title}
                  </h2>

                  {p.editorial_caption && (
                    <p
                      className="text-base md:text-lg italic leading-relaxed mb-8"
                      style={{
                        color: `${fg}c0`,
                        fontFamily: `'${serif}', serif`,
                      }}
                    >
                      {p.editorial_caption}
                    </p>
                  )}

                  <div
                    className="flex items-baseline justify-between pt-6 border-t"
                    style={{ borderColor: `${fg}20` }}
                  >
                    <div>
                      {p.price_eur && (
                        <span
                          className="text-3xl font-light"
                          style={{
                            color: fg,
                            fontFamily: `'${serif}', serif`,
                          }}
                        >
                          {p.price_eur} €
                        </span>
                      )}
                    </div>
                    <a
                      href="#"
                      className="text-[11px] tracking-[0.3em] uppercase pb-1"
                      style={{
                        color: fg,
                        borderBottom: `1px solid ${fg}50`,
                      }}
                    >
                      Découvrir →
                    </a>
                  </div>
                </div>
              </div>
            </section>
          );
        }

        // Footer = derniere section pleine page
        if (block.kind === "footer") {
          return (
            <section
              key={key}
              className="snap-start relative w-full h-screen flex flex-col items-center justify-center px-8 text-center"
              style={{
                background: fg,
                color: bg,
              }}
            >
              <p
                className="text-[11px] tracking-[0.3em] uppercase mb-10"
                style={{ color: `${bg}80`, fontFamily: `'${sans}', sans-serif` }}
              >
                — {brand.domain}
              </p>
              <h2
                className="text-5xl md:text-7xl lg:text-8xl font-light leading-[1.05] tracking-tight italic mb-12"
                style={{ fontFamily: `'${serif}', serif`, color: bg }}
              >
                {footer?.tagline || `${brand.name}.`}
              </h2>
              {footer?.closing_line && (
                <p
                  className="text-base md:text-lg max-w-xl leading-relaxed font-light mb-16"
                  style={{ color: `${bg}b0` }}
                >
                  {footer.closing_line}
                </p>
              )}
              <a
                href="/lite"
                className="inline-flex items-center gap-3 px-9 py-3.5 text-[11px] tracking-[0.3em] uppercase transition-colors duration-500"
                style={{
                  border: `1px solid ${bg}40`,
                  color: bg,
                }}
              >
                Voir d&apos;autres sites Vertxia
                <span>→</span>
              </a>
              <p
                className="absolute bottom-8 text-[10px] tracking-[0.3em] uppercase"
                style={{ color: `${bg}40` }}
              >
                Site généré par Vertxia Lite
                {brief._meta && ` · ${brief._meta.generated_in_seconds}s · ${brief._meta.model}`}
              </p>
            </section>
          );
        }

        return null;
      })}
    </main>
  );
}
