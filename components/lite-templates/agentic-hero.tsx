"use client";

/**
 * Vertxia Lite — Template "Agentic Hero".
 *
 * Override explicite regle 22 CLAUDE.md — Emilien le 30/05/2026.
 * Mood : clichés IA générique Runable / Lovable / Bolt / v0 — fond clair,
 * gros titre centré "Qu'est-ce qui doit être fait ?", prompt input énorme,
 * badge social proof orange, boutons catégories, connecteurs visibles.
 *
 * Mais avec : showcase vidéos AI Vertxia du produit en dessous (= ce que les
 * autres outils n'ont PAS). Cliché en haut, signature Vertxia en bas.
 *
 * Animations actives (regle 23) :
 *  1. FadeInUp badge social proof
 *  2. SplitMaskedReveal titre central
 *  3. FadeInUp prompt input
 *  4. FadeInUp connecteurs row
 *  5. FadeInUp stagger boutons catégories
 *  6. SplitMaskedReveal section showcase title
 *  7. FadeInUp stagger vidéos grid
 *  8. data-cursor variants partout
 *  9. MagneticButton CTA hero
 * 10. Hover scale + lift sur cards vidéos
 */

import type { Brief } from "@/lib/brief";
import { paletteColor } from "@/lib/brief";
import {
  FadeInUp,
  MaskedReveal,
  SplitMaskedReveal,
  MagneticButton,
} from "@/components/motion-primitives";

type Props = { brief: Brief };

export function AgenticHero({ brief }: Props) {
  const { brand, visual_system, featured_products, hero, footer } = brief;
  const palette = visual_system.palette;

  // Palette clair Runable-like : fond off-white, texte sombre, accent vif
  const bg = "#FAFAF8";
  const fg = "#1A1A1F";
  const accentFromBrief = paletteColor(palette, "accent", "#FF6B35");
  const accent = accentFromBrief;
  const muted = "#6E6E76";
  const hairline = "#E8E6E0";
  const promptBg = "#FFFFFF";

  const sans = visual_system.fonts.sans || "Inter";

  const fontFamilies = [
    `${encodeURIComponent(sans).replace(/%20/g, "+")}:wght@400;500;600;700`,
    `Geist+Mono:wght@400;500`,
  ];
  const fontsHref = `https://fonts.googleapis.com/css2?family=${fontFamilies.join("&family=")}&display=swap`;

  const placeholderQuery = `Tapez vos idées ici… ex : "Créer un site comme ${brand.name}"`;

  // 6 connecteurs fictifs (icons type Gmail, Drive, Slack, GitHub, Notion, Calendar)
  const connectors = [
    { name: "Gmail", emoji: "📧" },
    { name: "Drive", emoji: "📂" },
    { name: "Calendar", emoji: "📅" },
    { name: "Slack", emoji: "💬" },
    { name: "GitHub", emoji: "🐙" },
    { name: "Notion", emoji: "📝" },
  ];

  // 5 catégories type Runable
  const categories = [
    { label: "Build Apps", icon: "📱" },
    { label: "Create Slides", icon: "📊" },
    { label: "Generate Videos", icon: "🎬", isNew: true },
    { label: "Build Websites", icon: "🌐" },
    { label: "Plus", icon: "+" },
  ];

  return (
    <main
      className="min-h-screen antialiased"
      style={{
        background: bg,
        color: fg,
        fontFamily: `'${sans}', system-ui, sans-serif`,
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href={fontsHref} rel="stylesheet" />

      {/* Bannière top promo */}
      <div
        className="w-full text-center py-3 px-4 text-xs"
        style={{
          background: `linear-gradient(90deg, ${accent}15, ${accent}30, ${accent}15)`,
          color: fg,
          fontFamily: `'${sans}', sans-serif`,
          fontWeight: 500,
        }}
      >
        <span style={{ color: accent, fontWeight: 700 }}>★</span>
        {" "}
        Try {brand.name} Studio at <strong>$1/mo</strong> — limited time
        <span style={{ marginLeft: "0.5rem" }}>→</span>
      </div>

      {/* NAV style Runable */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md"
        style={{ background: `${bg}d0`, borderBottom: `1px solid ${hairline}` }}
      >
        <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a
            href="#"
            className="flex items-center gap-2"
            data-cursor="hover"
            style={{ fontFamily: `'${sans}', sans-serif`, fontWeight: 700 }}
          >
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-sm"
              style={{ background: fg, color: bg }}
              aria-hidden
            >
              ✦
            </span>
            <span className="text-lg">{brand.name}</span>
          </a>

          <div className="hidden md:flex items-center gap-8">
            <button
              data-cursor="hover"
              className="text-sm transition-colors"
              style={{ color: muted, fontWeight: 500 }}
            >
              Capacités <span style={{ fontSize: "0.7em" }}>+</span>
            </button>
            <button
              data-cursor="hover"
              className="text-sm transition-colors"
              style={{ color: muted, fontWeight: 500 }}
            >
              Ressources <span style={{ fontSize: "0.7em" }}>+</span>
            </button>
            <a
              href="#pricing"
              data-cursor="hover"
              className="text-sm transition-colors"
              style={{ color: muted, fontWeight: 500 }}
            >
              Tarification
            </a>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#"
              data-cursor="hover"
              className="text-sm px-4 py-2 rounded-full transition-colors"
              style={{
                background: accent,
                color: "#FFFFFF",
                fontWeight: 600,
                fontFamily: `'${sans}', sans-serif`,
              }}
            >
              Se connecter
            </a>
            <a
              href="#"
              data-cursor="hover"
              className="text-sm px-4 py-2 rounded-full transition-colors border"
              style={{
                borderColor: fg,
                color: fg,
                fontWeight: 600,
                fontFamily: `'${sans}', sans-serif`,
              }}
            >
              S'inscrire
            </a>
          </div>
        </nav>
      </header>

      {/* HERO — cliché Runable */}
      <section className="px-6 pt-24 md:pt-40 pb-32">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge orange social proof */}
          <FadeInUp delay={0.1}>
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-12"
              style={{
                background: `${accent}15`,
                border: `1px solid ${accent}30`,
              }}
            >
              <span style={{ color: accent }}>♥</span>
              <span
                className="text-sm"
                style={{
                  color: accent,
                  fontFamily: `'${sans}', sans-serif`,
                  fontWeight: 600,
                }}
              >
                Apprécié par plus d'1M de clients
              </span>
            </div>
          </FadeInUp>

          {/* GROS TITRE CENTRÉ */}
          <h1
            className="leading-[1.1] tracking-tight mb-12"
            style={{
              fontFamily: `'${sans}', sans-serif`,
              fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)",
              fontWeight: 700,
              color: fg,
            }}
          >
            <SplitMaskedReveal
              text="Qu'est-ce qui doit être fait ?"
              delay={0.3}
              duration={0.9}
              delayStep={0.05}
              splitBy="word"
            />
          </h1>

          {/* PROMPT INPUT ÉNORME */}
          <FadeInUp delay={0.7}>
            <div
              className="relative rounded-2xl shadow-sm"
              style={{
                background: promptBg,
                border: `1px solid ${hairline}`,
                boxShadow: `0 8px 32px ${fg}10`,
              }}
            >
              <textarea
                placeholder={placeholderQuery}
                className="w-full px-6 py-5 pr-14 rounded-2xl resize-none focus:outline-none"
                rows={3}
                style={{
                  background: "transparent",
                  color: fg,
                  fontFamily: `'${sans}', sans-serif`,
                  fontSize: "1rem",
                  lineHeight: 1.6,
                }}
              />
              <button
                data-cursor="hover"
                className="absolute bottom-3 right-3 w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                style={{
                  background: fg,
                  color: bg,
                }}
                aria-label="Envoyer"
              >
                ↑
              </button>
            </div>
          </FadeInUp>

          {/* Connecteurs row */}
          <FadeInUp delay={0.9}>
            <div
              className="flex items-center justify-between mt-4 px-2 py-3 rounded-xl"
              style={{
                background: `${hairline}40`,
                border: `1px solid ${hairline}`,
              }}
            >
              <span
                className="text-xs flex items-center gap-2"
                style={{ color: muted, fontFamily: `'${sans}', sans-serif`, fontWeight: 500 }}
              >
                <span>🔗</span>
                Connectez vos outils à {brand.name}
              </span>
              <div className="flex items-center gap-2">
                {connectors.map((c) => (
                  <div
                    key={c.name}
                    title={c.name}
                    data-cursor="hover"
                    className="w-7 h-7 rounded-md flex items-center justify-center text-sm transition-transform hover:scale-110"
                    style={{ background: promptBg, border: `1px solid ${hairline}` }}
                  >
                    {c.emoji}
                  </div>
                ))}
                <button
                  data-cursor="hover"
                  className="text-xs ml-1"
                  style={{ color: muted, fontWeight: 600 }}
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>
            </div>
          </FadeInUp>

          {/* 5 BOUTONS CATÉGORIES */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-10">
            {categories.map((c, i) => (
              <FadeInUp key={c.label} delay={1.0 + i * 0.08}>
                <button
                  data-cursor="hover"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm transition-all hover:scale-105"
                  style={{
                    background: promptBg,
                    border: `1px solid ${hairline}`,
                    color: fg,
                    fontFamily: `'${sans}', sans-serif`,
                    fontWeight: 500,
                    position: "relative",
                  }}
                >
                  <span>{c.icon}</span>
                  {c.label}
                  {c.isNew && (
                    <span
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                      style={{ background: accent }}
                    />
                  )}
                </button>
              </FadeInUp>
            ))}
          </div>
        </div>
      </section>

      {/* SHOWCASE — c'est ICI que Vertxia se différencie : montrer les vraies vidéos AI */}
      <section
        className="px-6 py-32"
        style={{
          background: `${fg}05`,
          borderTop: `1px solid ${hairline}`,
        }}
      >
        <div className="max-w-6xl mx-auto">
          {/* Header showcase */}
          <div className="text-center mb-20">
            <FadeInUp>
              <p
                className="text-xs tracking-[0.3em] uppercase mb-6"
                style={{ color: accent, fontFamily: `'Geist Mono', monospace`, fontWeight: 600 }}
              >
                ★ Featured creations · Powered by {brand.name}
              </p>
            </FadeInUp>
            <h2
              className="leading-[1.05] tracking-tight mb-6"
              style={{
                fontFamily: `'${sans}', sans-serif`,
                fontSize: "clamp(2rem, 4vw, 3.5rem)",
                fontWeight: 700,
                color: fg,
              }}
            >
              <SplitMaskedReveal
                text="Voilà ce que les autres ont créé"
                delay={0.1}
                duration={0.9}
                delayStep={0.05}
                splitBy="word"
              />
            </h2>
            <FadeInUp delay={0.3}>
              <p
                className="max-w-2xl mx-auto text-base leading-relaxed"
                style={{ color: muted, fontFamily: `'${sans}', sans-serif` }}
              >
                <MaskedReveal duration={0.8}>
                  Des sites e-commerce générés en 70 secondes avec des vidéos IA cinematic par produit.
                  Une nouvelle façon de présenter ta marque.
                </MaskedReveal>
              </p>
            </FadeInUp>
          </div>

          {/* Grid vidéos AI 3 cols */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {featured_products.slice(0, 6).map((p, i) => (
              <FadeInUp key={p.handle} delay={i * 0.08} duration={0.7}>
                <article
                  className="group relative overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: promptBg,
                    border: `1px solid ${hairline}`,
                    boxShadow: `0 4px 16px ${fg}08`,
                  }}
                  data-cursor="view"
                  data-cursor-label="Play"
                >
                  {/* Vidéo */}
                  <div
                    className="relative aspect-[4/5] overflow-hidden"
                    style={{ background: `${fg}10` }}
                  >
                    {p.video_url ? (
                      <video
                        src={p.video_url}
                        poster={p.hero_image_url}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : p.hero_image_url ? (
                      <div
                        className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
                        style={{
                          backgroundImage: `url(${p.hero_image_url})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
                    ) : null}
                    {/* Badge "AI generated" en coin */}
                    <div
                      className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-md"
                      style={{
                        background: `${bg}d0`,
                        border: `1px solid ${hairline}80`,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: accent }}
                      />
                      <span
                        className="text-[10px] tracking-wider uppercase"
                        style={{
                          color: fg,
                          fontFamily: `'Geist Mono', monospace`,
                          fontWeight: 600,
                        }}
                      >
                        AI Generated
                      </span>
                    </div>
                  </div>

                  {/* Card footer */}
                  <div className="p-4">
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <h4
                        className="text-base leading-tight"
                        style={{
                          fontFamily: `'${sans}', sans-serif`,
                          fontWeight: 600,
                          color: fg,
                        }}
                      >
                        {p.title.length > 35 ? p.title.slice(0, 33) + "…" : p.title}
                      </h4>
                      {p.price_eur && (
                        <span
                          className="text-sm"
                          style={{
                            color: accent,
                            fontFamily: `'${sans}', sans-serif`,
                            fontWeight: 700,
                          }}
                        >
                          {p.price_eur}€
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs"
                      style={{
                        color: muted,
                        fontFamily: `'Geist Mono', monospace`,
                        fontWeight: 500,
                      }}
                    >
                      via {brand.name.toLowerCase()} · 5s
                    </p>
                  </div>
                </article>
              </FadeInUp>
            ))}
          </div>

          {/* CTA fin showcase */}
          <FadeInUp delay={0.6}>
            <div className="text-center mt-20">
              <MagneticButton as="a" href="#" strength={0.4} hitboxScale={1.5}>
                <span
                  data-cursor="hover"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm transition-transform"
                  style={{
                    background: fg,
                    color: bg,
                    fontFamily: `'${sans}', sans-serif`,
                    fontWeight: 600,
                  }}
                >
                  Générer ma boutique en 70 secondes
                  <span aria-hidden>→</span>
                </span>
              </MagneticButton>
              <p
                className="mt-4 text-xs"
                style={{ color: muted, fontFamily: `'${sans}', sans-serif`, fontWeight: 500 }}
              >
                <span style={{ color: accent }}>★</span> 1$ pour le premier site · pas de carte requise
              </p>
            </div>
          </FadeInUp>
        </div>
      </section>

      {/* FOOTER minimal */}
      <footer
        className="px-6 py-12"
        style={{ borderTop: `1px solid ${hairline}` }}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs" style={{ color: muted }}>
          <div className="flex items-center gap-2" style={{ fontFamily: `'${sans}', sans-serif`, fontWeight: 500 }}>
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px]"
              style={{ background: fg, color: bg }}
              aria-hidden
            >
              ✦
            </span>
            <span>{brand.name} · {brand.domain}</span>
            <span style={{ marginLeft: "0.75rem" }}>·</span>
            <span>{footer?.closing_line ? footer.closing_line.slice(0, 60) : "All rights reserved"}</span>
          </div>
          <div className="flex items-center gap-4" style={{ fontFamily: `'${sans}', sans-serif` }}>
            <a href="#" data-cursor="hover" className="hover:underline">Terms</a>
            <a href="#" data-cursor="hover" className="hover:underline">Privacy</a>
            <MagneticButton as="a" href="/v3" strength={0.3} hitboxScale={1.4}>
              <span
                data-cursor="hover"
                className="text-xs tracking-[0.2em] uppercase"
                style={{ color: accent, fontWeight: 700 }}
              >
                ★ by Vertxia
              </span>
            </MagneticButton>
          </div>
        </div>
      </footer>
    </main>
  );
}
