/**
 * Vertxia Lite — page index publique listant les sites generes.
 *
 * Sert de vitrine pour montrer ce que Vertxia Lite fait en production.
 * Chaque card pointe vers /lite/[domain] avec preview video du hero produit.
 */

import type { Metadata } from "next";
import Link from "next/link";
import path from "node:path";
import { promises as fs } from "node:fs";

import { loadBrief } from "@/lib/brief-loader";
import { paletteColor } from "@/lib/brief";

export const metadata: Metadata = {
  title: "Vertxia Lite — Sites générés",
  description:
    "URL Shopify. Site cinematic complet. En minutes. Démos live de Vertxia Lite — l'outil qui transforme un catalogue en site éditorial avec vidéos AI auto par produit.",
};

type DemoCard = {
  slug: string;
  brandName: string;
  positioning: string;
  bg: string;
  fg: string;
  accent: string;
  serif: string;
  sans: string;
  heroVideo: string | null;
  heroImage: string | null;
  productCount: number;
  featuredCount: number;
};

async function loadDemos(): Promise<DemoCard[]> {
  const briefsDir = path.join(process.cwd(), "data", "briefs");
  let files: string[] = [];
  try {
    files = await fs.readdir(briefsDir);
  } catch {
    return [];
  }
  const slugs = files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));

  const demos: DemoCard[] = [];
  for (const slug of slugs) {
    const brief = await loadBrief(slug);
    if (!brief) continue;
    const palette = brief.visual_system.palette;
    const heroP = brief.featured_products[0];
    demos.push({
      slug,
      brandName: brief.brand.name,
      positioning: brief.brand.positioning_one_liner,
      bg: paletteColor(palette, "background", "#F5F0E8"),
      fg: paletteColor(palette, "foreground", "#1A1A1A"),
      accent: paletteColor(palette, "accent", "#E8521A"),
      serif: brief.visual_system.fonts.serif || "Cormorant",
      sans: brief.visual_system.fonts.sans || "Inter",
      heroVideo: heroP?.video_url || null,
      heroImage: heroP?.hero_image_url || null,
      productCount: brief._meta?.product_count_total || 0,
      featuredCount: brief.featured_products.length,
    });
  }
  return demos;
}

export default async function LiteIndexPage() {
  const demos = await loadDemos();

  const PAGE_BG = "#0A0A0A";
  const PAGE_FG = "#F5F0E8";
  const ACCENT = "#9CAA8E";

  return (
    <main
      className="min-h-screen antialiased"
      style={{
        background: PAGE_BG,
        color: PAGE_FG,
        fontFamily:
          "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant:wght@300;400;500&family=Inter:wght@300;400;500&display=swap"
        rel="stylesheet"
      />

      {/* NAV */}
      <header
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md"
        style={{
          background: `${PAGE_BG}cc`,
          borderBottom: `1px solid ${PAGE_FG}14`,
        }}
      >
        <nav className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg tracking-[0.15em] uppercase font-light"
            style={{ fontFamily: "'Cormorant', serif" }}
          >
            Vertxia
          </Link>
          <div
            className="hidden md:flex gap-10 text-[12px] tracking-[0.2em] uppercase"
            style={{ color: `${PAGE_FG}99` }}
          >
            <Link href="/lite" className="hover:opacity-100" style={{ opacity: 0.6 }}>
              Sites générés
            </Link>
            <Link href="/v3" className="hover:opacity-100" style={{ opacity: 0.6 }}>
              Manifeste
            </Link>
            <a
              href="https://instagram.com/vertxia.fr"
              target="_blank"
              rel="noopener"
              className="hover:opacity-100"
              style={{ opacity: 0.6 }}
            >
              Instagram
            </a>
          </div>
          <span
            className="text-[10px] tracking-[0.25em] uppercase font-mono"
            style={{ color: ACCENT }}
          >
            V0.1 · build in public
          </span>
        </nav>
      </header>

      {/* HERO INDEX */}
      <section className="px-8 pt-44 pb-20">
        <div className="max-w-6xl mx-auto">
          <p
            className="text-[11px] tracking-[0.3em] uppercase mb-8"
            style={{ color: ACCENT }}
          >
            — Vertxia Lite · démonstrations live
          </p>
          <h1
            className="text-5xl md:text-7xl lg:text-8xl font-light leading-[1.05] tracking-tight mb-10 whitespace-pre-line"
            style={{ fontFamily: "'Cormorant', serif" }}
          >
            URL Shopify.{"\n"}
            <em className="italic" style={{ color: ACCENT }}>
              Site cinematic complet.
            </em>
            {"\n"}En minutes.
          </h1>
          <p
            className="text-base md:text-xl max-w-2xl leading-relaxed font-light"
            style={{ color: `${PAGE_FG}b3` }}
          >
            Chaque démo ci-dessous a été générée automatiquement à partir
            d&apos;une URL Shopify et d&apos;un prompt créatif court. Catalogue scrapé,
            palette extraite, copy rédigé, vidéos cinematic IA par produit, site
            composé — sans intervention manuelle.
          </p>
          <div className="mt-10 flex items-center gap-8 text-[11px] tracking-[0.25em] uppercase" style={{ color: `${PAGE_FG}80` }}>
            <span>~10 minutes par site</span>
            <span style={{ color: ACCENT }}>·</span>
            <span>~$2 par site</span>
            <span style={{ color: ACCENT }}>·</span>
            <span>Aucun template, chaque rendu est unique</span>
          </div>
        </div>
      </section>

      {/* DEMOS GRID */}
      <section className="px-8 pb-32">
        <div className="max-w-7xl mx-auto">
          {demos.length === 0 ? (
            <p
              className="text-center py-20 text-lg italic"
              style={{ color: `${PAGE_FG}80`, fontFamily: "'Cormorant', serif" }}
            >
              Aucune démo disponible pour l&apos;instant.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {demos.map((demo) => (
                <Link
                  key={demo.slug}
                  href={`/lite/${demo.slug}`}
                  className="group block"
                >
                  <article
                    className="relative aspect-[4/5] md:aspect-[3/4] overflow-hidden transition-all duration-700"
                    style={{ background: demo.bg }}
                  >
                    {/* Visual preview = brand hero (vidéo si dispo) */}
                    {demo.heroVideo ? (
                      <video
                        src={demo.heroVideo}
                        poster={demo.heroImage || undefined}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-[1.03]"
                      />
                    ) : demo.heroImage ? (
                      <div
                        className="absolute inset-0 transition-transform duration-1000 group-hover:scale-[1.03]"
                        style={{
                          backgroundImage: `url(${demo.heroImage})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                    ) : null}

                    {/* Bottom gradient pour lisibilité texte */}
                    <div
                      className="absolute inset-x-0 bottom-0 h-2/3"
                      style={{
                        background: `linear-gradient(180deg, transparent 0%, ${demo.bg}c0 60%, ${demo.bg} 100%)`,
                      }}
                    />

                    {/* Brand info en bottom-left */}
                    <div className="absolute inset-x-0 bottom-0 p-8">
                      <p
                        className="text-[10px] tracking-[0.3em] uppercase mb-3"
                        style={{ color: `${demo.fg}99` }}
                      >
                        {demo.productCount > 0
                          ? `${demo.productCount} produits · ${demo.featuredCount} featured`
                          : `${demo.featuredCount} featured`}
                      </p>
                      <h2
                        className="text-4xl md:text-5xl font-light leading-tight tracking-tight mb-3"
                        style={{
                          color: demo.fg,
                          fontFamily: `'${demo.serif}', serif`,
                        }}
                      >
                        {demo.brandName}
                      </h2>
                      <p
                        className="text-sm leading-relaxed max-w-md italic"
                        style={{
                          color: `${demo.fg}c0`,
                          fontFamily: `'${demo.serif}', serif`,
                        }}
                      >
                        {demo.positioning}
                      </p>
                      <div
                        className="mt-6 inline-flex items-center gap-3 text-[11px] tracking-[0.25em] uppercase transition-all duration-500"
                        style={{
                          color: demo.fg,
                          borderBottom: `1px solid ${demo.fg}40`,
                          paddingBottom: 2,
                        }}
                      >
                        Visiter le site
                        <span className="transition-transform duration-500 group-hover:translate-x-1">
                          →
                        </span>
                      </div>
                    </div>

                    {/* Tag domain en top-left */}
                    <div
                      className="absolute top-6 left-6 text-[10px] tracking-[0.3em] uppercase px-3 py-1.5 backdrop-blur-md"
                      style={{
                        background: `${demo.bg}99`,
                        color: demo.fg,
                        border: `1px solid ${demo.fg}20`,
                      }}
                    >
                      {demo.slug.replace(/_/g, ".")}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA SECTION */}
      <section
        className="px-8 py-32"
        style={{ borderTop: `1px solid ${PAGE_FG}14` }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <p
            className="text-[11px] tracking-[0.3em] uppercase mb-8"
            style={{ color: ACCENT }}
          >
            — Prochaine étape
          </p>
          <h2
            className="text-3xl md:text-5xl font-light leading-tight tracking-tight mb-10"
            style={{ fontFamily: "'Cormorant', serif" }}
          >
            <em className="italic">Soumets ton URL Shopify.</em>
            <br />
            Reçois ton site cinematic.
          </h2>
          <p
            className="text-base md:text-lg max-w-xl mx-auto mb-12 font-light"
            style={{ color: `${PAGE_FG}99` }}
          >
            Vertxia Lite est en bêta privée. Pour générer ton site, écris-nous
            sur Instagram ou par email — on lance la génération sous 24h.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <a
              href="https://instagram.com/vertxia.fr"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center px-9 py-3.5 text-[11px] tracking-[0.25em] uppercase transition-colors duration-500"
              style={{
                background: PAGE_FG,
                color: PAGE_BG,
              }}
            >
              Écrire sur Instagram
            </a>
            <a
              href="mailto:emilien@vertxia.com"
              className="text-[11px] tracking-[0.25em] uppercase underline underline-offset-4 decoration-1"
              style={{ color: `${PAGE_FG}99` }}
            >
              emilien@vertxia.com
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        className="px-8 py-12"
        style={{
          borderTop: `1px solid ${PAGE_FG}14`,
          color: `${PAGE_FG}50`,
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] tracking-[0.3em] uppercase">
          <span>Vertxia · Toulon, France</span>
          <span>Build in public · V0.1 · 2026</span>
        </div>
      </footer>
    </main>
  );
}
