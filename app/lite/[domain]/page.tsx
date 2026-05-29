/**
 * Vertxia Lite — Site genere dynamiquement depuis un brief JSON.
 *
 * Route : /lite/[domain]
 * Source : data/briefs/<domain>.json (produit par brief_llm.py)
 * Videos : public/lite/videos/<domain>/<handle>.mp4 (produites par vertxia_lite_kling.py)
 *
 * V0.1 : compose hero + manifesto + collection + footer a partir du brief.
 * Pour les produits sans video, fallback sur hero_image_url (animation CSS subtile).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadBrief, listBriefs } from "@/lib/brief-loader";
import { paletteColor } from "@/lib/brief";
import { CinematicNarrative } from "@/components/lite-templates/cinematic-narrative";
import { DocumentaryStory } from "@/components/lite-templates/documentary-story";
import { HorizontalSlider } from "@/components/lite-templates/horizontal-slider";
import { BrutalistTech } from "@/components/lite-templates/brutalist-tech";
import { VisualSignature } from "@/components/lite-templates/visual-signature";

type PageProps = {
  params: Promise<{ domain: string }>;
};

export async function generateStaticParams() {
  const briefs = await listBriefs();
  return briefs.map((domain) => ({ domain }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { domain } = await params;
  const brief = await loadBrief(domain);
  if (!brief) {
    return { title: "Site non trouvé · Vertxia Lite" };
  }
  return {
    title: `${brief.brand.name} · ${brief.creative_direction.mood.split(/[.——]/)[0].trim().slice(0, 60)}`,
    description: brief.brand.positioning_one_liner,
  };
}

export default async function LiteDynamicPage({ params }: PageProps) {
  const { domain } = await params;
  const brief = await loadBrief(domain);

  if (!brief) {
    notFound();
  }

  // Accent + signature au niveau routeur — wrappe TOUS les retours pour multiplier les variations
  const signature = brief.visual_signature ?? "none";
  const routerAccent = paletteColor(brief.visual_system.palette, "accent", "#E8521A");

  // Route selon template_id — squelettes structurellement differents
  if (brief.template_id === "cinematic-narrative") {
    return (
      <VisualSignature signature={signature} accent={routerAccent}>
        <CinematicNarrative brief={brief} />
      </VisualSignature>
    );
  }
  if (brief.template_id === "documentary-story") {
    return (
      <VisualSignature signature={signature} accent={routerAccent}>
        <DocumentaryStory brief={brief} />
      </VisualSignature>
    );
  }
  if (brief.template_id === "horizontal-slider") {
    return (
      <VisualSignature signature={signature} accent={routerAccent}>
        <HorizontalSlider brief={brief} />
      </VisualSignature>
    );
  }
  if (brief.template_id === "brutalist-tech") {
    return (
      <VisualSignature signature={signature} accent={routerAccent}>
        <BrutalistTech brief={brief} />
      </VisualSignature>
    );
  }

  // Default = editorial-magazine (squelette grid + manifesto + collection)
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

  // Google Fonts URL avec les 2 familles du brief
  const fontFamilies = [
    `${encodeURIComponent(serif).replace(/%20/g, "+")}:wght@300;400;500;600`,
    `${encodeURIComponent(sans).replace(/%20/g, "+")}:wght@300;400;500`,
  ];
  const fontsHref = `https://fonts.googleapis.com/css2?family=${fontFamilies.join("&family=")}&display=swap`;

  return (
    <VisualSignature signature={signature} accent={accent}>
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

      {/* ────────── NAV ────────── */}
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
              .filter((s) =>
                /manifest|material|collection|product/i.test(s.section)
              )
              .slice(0, 4)
              .map((s) => (
                <a
                  key={s.section}
                  href={`#${s.section}`}
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

      {/* ────────── HERO ────────── */}
      <section className="relative min-h-screen flex flex-col justify-center px-8 pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          {heroVideo ? (
            <video
              src={heroVideo}
              poster={heroImage}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : heroImage ? (
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `url(${heroImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          ) : null}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${bg}66 0%, ${bg}1a 40%, ${bg}d9 100%)`,
            }}
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto w-full">
          <p
            className="text-[11px] tracking-[0.3em] uppercase mb-10"
            style={{ color: muted, fontFamily: `'${sans}', sans-serif` }}
          >
            — {hero?.kicker || brand.category}
          </p>
          <h1
            className="text-6xl md:text-8xl lg:text-9xl font-light leading-[0.95] tracking-tight mb-8 whitespace-pre-line"
            style={{ fontFamily: `'${serif}', serif` }}
          >
            {hero?.headline || brand.positioning_one_liner}
          </h1>
          <p
            className="text-base md:text-lg max-w-xl leading-relaxed mt-12"
            style={{ color: `${fg}b3` }}
          >
            {hero?.subheadline || creative_direction.mood}
          </p>
          <div className="mt-14 flex items-center gap-6 flex-wrap">
            <a
              href={collectionSection ? `#${collectionSection.section}` : "#collection"}
              className="inline-flex items-center justify-center px-9 py-3.5 text-[11px] tracking-[0.25em] uppercase transition-colors duration-500"
              style={{
                background: fg,
                color: bg,
              }}
            >
              {hero?.primary_cta_label || "Voir la collection"}
            </a>
            {manifestoSection && (
              <a
                href={`#${manifestoSection.section}`}
                className="text-[11px] tracking-[0.25em] uppercase underline underline-offset-4 decoration-1 transition-colors"
                style={{ color: `${fg}99` }}
              >
                {hero?.secondary_cta_label || "Lire le manifeste"}
              </a>
            )}
          </div>
        </div>

        <div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.3em] uppercase animate-pulse"
          style={{ color: `${fg}66` }}
        >
          ↓ Scroll
        </div>
      </section>

      {/* ────────── MANIFESTO ────────── */}
      {manifestoSection && (
        <section
          id={manifestoSection.section}
          className="px-8 py-40 border-t"
          style={{ borderColor: `${fg}14` }}
        >
          <div className="max-w-3xl mx-auto">
            <p
              className="text-[11px] tracking-[0.3em] uppercase mb-12"
              style={{ color: muted, fontFamily: `'${sans}', sans-serif` }}
            >
              — {manifestoSection.section_role || "Manifeste"}
            </p>
            <h2
              className="text-4xl md:text-6xl font-light leading-[1.1] tracking-tight mb-16 whitespace-pre-line"
              style={{ fontFamily: `'${serif}', serif` }}
            >
              {manifestoSection.headline ||
                brand.positioning_one_liner.split(/[.,]/)[0] + "."}
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
                <p key={i}>{para}</p>
              ))}
            </div>
            {manifestoSection.pull_quote && (
              <blockquote
                className="mt-16 pl-6 border-l-2 text-2xl md:text-3xl italic font-light leading-snug"
                style={{
                  borderColor: accent,
                  color: `${fg}d0`,
                  fontFamily: `'${serif}', serif`,
                }}
              >
                {manifestoSection.pull_quote}
              </blockquote>
            )}
          </div>
        </section>
      )}

      {/* ────────── COLLECTION ────────── */}
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
                <p
                  className="text-[11px] tracking-[0.3em] uppercase mb-6"
                  style={{ color: muted, fontFamily: `'${sans}', sans-serif` }}
                >
                  — {collectionSection.section_role || "Collection"}
                </p>
                <h3
                  className="text-4xl md:text-5xl font-light tracking-tight whitespace-pre-line"
                  style={{ fontFamily: `'${serif}', serif` }}
                >
                  {collectionSection.headline || `${brand.name}.`}
                </h3>
              </div>
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {featured_products.map((p) => (
                <article key={p.handle} className="group">
                  <div
                    className="relative aspect-[4/5] mb-6 overflow-hidden"
                    style={{ background: bg }}
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
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ────────── FOOTER ────────── */}
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
              style={{ fontFamily: `'${serif}', serif` }}
            >
              <em className="italic">{brand.name}.</em>
              <br />
              {footer?.tagline || creative_direction.reference_style}
            </p>
            {footer?.closing_line && (
              <p
                className="text-sm opacity-60 mt-4 max-w-md leading-relaxed"
                style={{ color: bg }}
              >
                {footer.closing_line}
              </p>
            )}
            <p
              className="text-[10px] tracking-[0.3em] uppercase opacity-50 mt-6"
              style={{ color: bg }}
            >
              {brand.domain}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <p
              className="text-[10px] tracking-[0.3em] uppercase opacity-40"
              style={{ color: bg }}
            >
              Site démo généré par
            </p>
            <a
              href="/v3"
              className="text-2xl tracking-[0.15em] uppercase font-light transition-colors"
              style={{
                fontFamily: `'${serif}', serif`,
                color: bg,
              }}
            >
              Vertxia Lite
            </a>
            <p
              className="text-[10px] opacity-40 mt-2 max-w-sm text-right leading-relaxed"
              style={{ color: bg }}
            >
              Pipeline auto : Shopify → brief créatif IA → vidéos cinematic →
              site unique.
              {brief._meta && (
                <>
                  {" "}
                  Brief généré en {brief._meta.generated_in_seconds}s par{" "}
                  {brief._meta.model}.
                </>
              )}
            </p>
          </div>
        </div>
      </footer>
    </main>
    </VisualSignature>
  );
}
