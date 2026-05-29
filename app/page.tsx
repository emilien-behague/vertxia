"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { IntroAnimation, HERO_REVEAL_MS } from "@/components/intro-animation";
import { RevealText } from "@/components/reveal-text";
import { StickyNav } from "@/components/sticky-nav";
import { StackingTemplateCards } from "@/components/stacking-template-cards";
import { LivePipelineFeed, LiveCounter } from "@/components/live-pipeline-feed";
import { AnimatedSphere } from "@/components/animated-sphere";

// ─── Intersection Observer hook ───────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setInView(true);
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ─── Bento card ───────────────────────────────────────────────────────────────
function BentoCard({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, inView } = useInView(0.1);
  return (
    <div
      ref={ref}
      className={`group relative rounded-2xl border border-black/[0.07] bg-white overflow-hidden transition-all duration-700 hover:border-black/[0.15] hover:bg-[#fafaf8] ${className}`}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms, border-color 0.3s ease, background-color 0.3s ease`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Pill tag ─────────────────────────────────────────────────────────────────
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] tracking-widest font-mono text-black/40 bg-black/[0.04]">
      {children}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function VertxiaPage() {
  const [heroReady, setHeroReady] = useState(false);

  const handleIntroDone = useCallback(() => {
    setHeroReady(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setHeroReady(true), HERO_REVEAL_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="bg-[#F5F4F0] text-[#111] min-h-screen font-sans antialiased">
      {/* ── INTRO ANIMATION ───────────────────────────────────────────────── */}
      <IntroAnimation onDone={handleIntroDone} />

      {/* ── STICKY NAV ────────────────────────────────────────────────────── */}
      <StickyNav />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen overflow-hidden flex flex-col">
        {/* Animated sphere — discrète sur mobile, visible sur desktop ; bordures fadées dans le rendu canvas */}
        <div
          className={`absolute right-[-80px] md:right-[-80px] top-1/2 -translate-y-1/2 w-[320px] h-[320px] md:w-[700px] md:h-[700px] lg:w-[850px] lg:h-[850px] pointer-events-none z-0 transition-opacity duration-[1400ms] ease-out delay-[400ms] ${
            heroReady ? "opacity-20 md:opacity-75" : "opacity-0"
          }`}
          aria-hidden="true"
        >
          <AnimatedSphere />
        </div>

        {/* Spacer for nav */}
        <div className="relative z-10 h-20" />

        <div className="relative z-10 flex-1 flex flex-col justify-center md:justify-end px-6 md:px-12 pb-12 max-w-5xl">
          <p
            className="text-[11px] tracking-[0.25em] text-black/40 uppercase mb-6"
            style={{
              opacity: heroReady ? 1 : 0,
              transition: "opacity 800ms cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            · Build in public · Day 1 · 27 mai 2026
          </p>

          {/* Teaser /lite — démos live */}
          <a
            href="/lite"
            className="group inline-flex items-center gap-3 self-start mb-8 pl-2 pr-4 py-1.5 rounded-full border border-black/10 bg-white/60 backdrop-blur-sm hover:border-black/30 hover:bg-white transition-all"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0px)" : "translateY(8px)",
              transition: "opacity 800ms cubic-bezier(0.16,1,0.3,1) 120ms, transform 800ms cubic-bezier(0.16,1,0.3,1) 120ms, border-color 200ms, background-color 200ms",
            }}
          >
            <span className="relative flex items-center justify-center w-6 h-6">
              <span className="absolute inset-0 rounded-full bg-[#111] animate-ping opacity-30" />
              <span className="relative w-2 h-2 rounded-full bg-[#111]" />
            </span>
            <span className="text-[11px] font-mono tracking-[0.2em] text-black/70 uppercase">
              Live · 2 sites générés
            </span>
            <span className="text-[11px] font-mono tracking-widest text-black/40 group-hover:text-black/80 group-hover:translate-x-0.5 transition-all">
              →
            </span>
          </a>

          <h1
            className="text-5xl sm:text-7xl md:text-8xl font-light text-[#111] leading-[1.0] tracking-tight mb-10"
            style={{
              opacity: heroReady ? 1 : 0,
              filter: heroReady ? "blur(0px)" : "blur(24px)",
              transform: heroReady ? "translateY(0px)" : "translateY(32px)",
              transition:
                "opacity 1s cubic-bezier(0.16,1,0.3,1) 0ms, filter 1s cubic-bezier(0.16,1,0.3,1) 0ms, transform 1s cubic-bezier(0.16,1,0.3,1) 0ms",
            }}
          >
            URL Shopify.<br />
            <span className="text-black/40">Site cinematic complet.</span><br />
            En minutes.
          </h1>

          <p
            className="text-base md:text-lg text-black/50 max-w-xl mb-10 leading-relaxed"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0px)" : "translateY(16px)",
              transition: "opacity 1s cubic-bezier(0.16,1,0.3,1) 250ms, transform 1s cubic-bezier(0.16,1,0.3,1) 250ms",
            }}
          >
            Vertxia transforme n'importe quelle boutique Shopify en site éditorial avec vidéos cinematic IA auto par produit. Brief créatif rédigé par Claude, vidéos générées par Kling. Sans agence. Sans 4 mois d'attente.
          </p>

          {/* 3 metrics */}
          <div className="flex gap-8 sm:gap-12 mb-12">
            {[
              { value: "~10min", label: "Génération site" },
              { value: "~2€", label: "Coût IA / site" },
              { value: "Unique", label: "Chaque rendu" },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  opacity: heroReady ? 1 : 0,
                  filter: heroReady ? "blur(0px)" : "blur(16px)",
                  transform: heroReady ? "translateY(0px)" : "translateY(20px)",
                  transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${400 + i * 80}ms, filter 0.8s cubic-bezier(0.16,1,0.3,1) ${400 + i * 80}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${400 + i * 80}ms`,
                }}
              >
                <div className="text-3xl sm:text-4xl text-[#111] font-light tracking-tight">{stat.value}</div>
                <div className="text-xs text-black/40 tracking-widest uppercase mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* CTA inline — DM Insta + mail */}
          <div
            className="flex flex-col sm:flex-row gap-2 max-w-md"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0px)" : "translateY(16px)",
              transition: "opacity 1s cubic-bezier(0.16,1,0.3,1) 700ms, transform 1s cubic-bezier(0.16,1,0.3,1) 700ms",
            }}
          >
            <a
              href="https://instagram.com/vertxia.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#111] text-white text-sm rounded-xl hover:bg-[#333] transition-colors tracking-widest font-medium whitespace-nowrap"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
              SUIVRE LE BUILD
            </a>
            <a
              href="/app"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 border border-black/10 text-black/70 text-sm rounded-xl hover:border-black/25 hover:bg-black/[0.04] transition-colors tracking-widest whitespace-nowrap"
            >
              OUVRIR L'APP
            </a>
          </div>
        </div>
      </section>

      {/* ── PIPELINE OVERVIEW (BENTO) ─────────────────────────────────────── */}
      <section id="pipeline" className="py-32 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <Tag>PIPELINE</Tag>
            <RevealText className="mt-5 text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]">
              {"De l'URL au site cinematic,\nentièrement automatisé."}
            </RevealText>
          </div>

          <div className="grid grid-cols-12 gap-3">
            {/* Big card top — Scraper */}
            <BentoCard className="col-span-12 md:col-span-8 p-8 min-h-[260px] flex flex-col justify-between" delay={0}>
              <div>
                <div className="w-10 h-10 rounded-xl border border-black/10 bg-white flex items-center justify-center mb-6">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
                    <path d="M3 12h18M12 3a14.66 14.66 0 0 1 0 18M12 3a14.66 14.66 0 0 0 0 18" />
                  </svg>
                </div>
                <h3 className="text-2xl font-light mb-3">Scraper universel Shopify</h3>
                <p className="text-sm text-black/45 leading-relaxed max-w-md">
                  L'URL de ta boutique suffit. Vertxia scrape automatiquement ton catalogue produits, brand assets, palette colorimétrique. Aucune intégration technique. Aucune extension à installer.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-3">
                <div className="font-mono text-[10px] text-black/35 tracking-widest">SUPPORT</div>
                <div className="flex gap-2">
                  {["Shopify", "WooCommerce (bientôt)", "Magento (V2)"].map((p, i) => (
                    <span
                      key={p}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-mono ${i === 0 ? "bg-black text-white" : "bg-black/[0.04] text-black/40"}`}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </BentoCard>

            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[260px]" delay={120}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Brief créatif Claude</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Claude Sonnet analyse les images produits, extrait la palette, rédige copy + prompts vidéo, choisit l&apos;angle hero. Pas de template, brief unique.
              </p>
            </BentoCard>

            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[200px]" delay={160}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Vidéos cinematic Kling</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Chaque produit reçoit sa vidéo cinematic 5s — orbit, dolly, push-in — générée par Kling 2.0 depuis l&apos;image hero.
              </p>
            </BentoCard>

            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[200px]" delay={200}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="4 7 4 4 20 4 20 7" />
                  <line x1="9" y1="20" x2="15" y2="20" />
                  <line x1="12" y1="4" x2="12" y2="20" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Composition éditoriale</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Site composé dynamiquement depuis le brief — palette, fonts, sections, captions. Chaque rendu est unique.
              </p>
            </BentoCard>

            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[200px]" delay={240}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Livraison instantanée</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                URL partageable, déployée sur Vercel Edge. Site standalone ou intégrable en iframe.
              </p>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ── TEMPLATES (STACKING CARDS) ────────────────────────────────────── */}
      <section id="templates" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-16">
            <div>
              <Tag>5 TEMPLATES OPINIONATED</Tag>
              <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
                {"4 templates cinéma\nprêts à déployer."}
              </RevealText>
            </div>
            <p className="text-sm text-black/45 leading-relaxed max-w-xs">
              Chaque template est codé à la main en React Three Fiber, optimisé mobile, scroll-driven. L'IA choisit le template optimal selon ton produit.
            </p>
          </div>

          <StackingTemplateCards />
        </div>
      </section>

      {/* ── DEMOS / VITRINES LIVE — Vertxia Lite ──────────────────────────── */}
      <section id="demos" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-12">
            <div>
              <Tag>2 VITRINES LIVE</Tag>
              <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
                {"Pas des mockups.\nDes vraies pages live."}
              </RevealText>
            </div>
            <p className="text-sm text-black/45 leading-relaxed max-w-xs">
              Chaque démo ci-dessous a été générée automatiquement depuis l&apos;URL Shopify de la marque + un prompt créatif court. Brief Claude, vidéos Kling, site composé.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                brand: "ALLBIRDS",
                href: "/lite/allbirds_com",
                source: "allbirds.com",
                product: "Collection Sugar · sandales d'été",
                tag: "Manifeste sustainability",
                tagColor: "#E05A1E",
                video: "/lite/videos/allbirds_com/sugar-zeffers-lux-beige.mp4",
                bg: "#F5EFE0",
                fg: "#2C2416",
              },
              {
                brand: "LOOM",
                href: "/lite/loom_fr",
                source: "loom.fr",
                product: "Vestiaire essentiel homme",
                tag: "Manifeste anti-consommation",
                tagColor: "#8C8476",
                video: "/lite/videos/loom_fr/le-short-relax.mp4",
                bg: "#F2EDE6",
                fg: "#1E1E1A",
              },
            ].map((demo) => (
              <a
                key={demo.brand}
                href={demo.href}
                className="group relative block aspect-[4/5] md:aspect-[3/4] rounded-2xl border border-black/[0.08] overflow-hidden hover:border-black/30 transition-colors"
                style={{ background: demo.bg }}
              >
                <video
                  src={demo.video}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-[1.03]"
                />
                {/* Gradient bas pour lisibilité */}
                <div
                  className="absolute inset-x-0 bottom-0 h-2/3"
                  style={{
                    background: `linear-gradient(180deg, transparent 0%, ${demo.bg}c0 50%, ${demo.bg} 100%)`,
                  }}
                />
                <div className="absolute top-5 left-5 right-5 flex items-start justify-between z-10">
                  <span
                    className="font-mono text-[10px] tracking-[0.3em] uppercase px-2.5 py-1 rounded-sm backdrop-blur-md"
                    style={{
                      background: `${demo.bg}b3`,
                      color: demo.fg,
                      border: `1px solid ${demo.fg}20`,
                    }}
                  >
                    {demo.source}
                  </span>
                  <span
                    className="font-mono text-[9px] tracking-[0.2em] uppercase px-2.5 py-1 rounded-sm"
                    style={{ background: `${demo.tagColor}30`, color: demo.tagColor }}
                  >
                    {demo.tag}
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-8 z-10">
                  <p
                    className="font-mono text-[10px] tracking-[0.3em] uppercase mb-3"
                    style={{ color: `${demo.fg}99` }}
                  >
                    {demo.product}
                  </p>
                  <h3
                    className="text-4xl md:text-5xl font-light tracking-tight mb-4"
                    style={{ color: demo.fg, fontFamily: "'Cormorant', serif" }}
                  >
                    {demo.brand}
                  </h3>
                  <div
                    className="inline-flex items-center gap-3 text-[11px] tracking-[0.25em] uppercase pb-1"
                    style={{
                      color: demo.fg,
                      borderBottom: `1px solid ${demo.fg}40`,
                    }}
                  >
                    Visiter le site
                    <span className="transition-transform duration-500 group-hover:translate-x-1">→</span>
                  </div>
                </div>
              </a>
            ))}
          </div>

          <div className="mt-10 flex items-center justify-center gap-4">
            <a
              href="/lite"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-black/15 bg-white text-sm text-black/70 hover:border-black/30 hover:bg-black/[0.03] transition-all tracking-widest"
            >
              VOIR TOUTES LES DÉMOS
              <span>→</span>
            </a>
            <p className="text-xs text-black/40 font-mono tracking-wide">
              Nouvelles vitrines plusieurs fois par semaine
            </p>
          </div>
        </div>
      </section>

      {/* ── STACK ─────────────────────────────────────────────────────────── */}
      <section id="stack" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto text-center">
          <Tag>STACK TECHNIQUE</Tag>
          <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
            {"Construit sur du sérieux."}
          </RevealText>
          <p className="mt-6 text-sm text-black/45 max-w-2xl mx-auto leading-relaxed">
            Chaque brique est documentée, open source quand possible, choisie pour la performance long-terme.
          </p>
        </div>
      </section>

      {/* ── MARQUEE STACK ─────────────────────────────────────────────────── */}
      <section className="py-0 border-t border-black/[0.06] overflow-hidden select-none">
        <div className="flex border-b border-black/[0.06]" style={{ animation: "marqueeLeft 28s linear infinite" }}>
          {[...Array(3)].map((_, rep) => (
            <div key={rep} className="flex shrink-0">
              {[
                "Next.js 15",
                "React Three Fiber",
                "Three.js",
                "GSAP ScrollTrigger",
                "Lenis Smooth Scroll",
                "Claude Vision API",
                "Meshy AI",
                "TripoSR",
                "Tailwind CSS",
                "TypeScript",
              ].map((cap) => (
                <div key={cap} className="flex items-center gap-6 px-10 py-5 border-r border-black/[0.06] shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-black/20 shrink-0" />
                  <span className="text-sm text-black/45 whitespace-nowrap tracking-wide">{cap}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex" style={{ animation: "marqueeRight 22s linear infinite" }}>
          {[...Array(3)].map((_, rep) => (
            <div key={rep} className="flex shrink-0">
              {[
                "Supabase",
                "Cloudflare R2",
                "Vercel Edge",
                "Resend",
                "HasData Scraper",
                "Anthropic SDK",
                "Splitting.js",
                "Drei",
                "Stripe Billing",
                "GitHub Actions",
              ].map((cap) => (
                <div key={cap} className="flex items-center gap-6 px-10 py-5 border-r border-black/[0.06] shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-black/12 shrink-0" />
                  <span className="text-sm text-black/30 whitespace-nowrap tracking-wide">{cap}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── LIVE PIPELINE ─────────────────────────────────────────────────── */}
      <section id="live" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
              <Tag>LIVE — DONNÉES RÉELLES</Tag>
              <RevealText className="mt-5 text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]">
                {"Le pipeline tourne\ndéjà. En live."}
              </RevealText>
              <p className="mt-6 text-base text-black/40 leading-relaxed max-w-sm">
                Chaque produit passé par Vertxia est analysé, scoré pour qualité visuelle, modélisé en 3D, intégré dans un template. Coût IA et temps réel affichés. Build in public — tu vois tout ce qu'on fait.
              </p>
              <div className="mt-10 flex items-end gap-2">
                <LiveCounter />
                <span className="text-black/30 text-sm mb-1 tracking-wide">produits scrapés sur 25 brands DTC<br/>(FR + INTL)</span>
              </div>
            </div>
            <div className="relative">
              <LivePipelineFeed />
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 flex flex-col items-center">
            <Tag>PRICING</Tag>
            <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
              {"Pricing transparent.\nAucune surprise."}
            </RevealText>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                name: "Starter",
                price: "49€",
                period: "/mois HT",
                sub: "Pour solos Shopify qui démarrent",
                features: [
                  "3 sites cinematic / mois",
                  "20 vidéos AI Kling / mois",
                  "3 templates × 5 signatures",
                  "Direction artistique IA Claude",
                  "URL unique partageable",
                  "Support par email",
                ],
                delay: 0,
              },
              {
                name: "Studio",
                price: "149€",
                period: "/mois HT",
                sub: "Pour e-commerçants et marques DTC",
                features: [
                  "10 sites cinematic / mois",
                  "60 vidéos AI Kling / mois",
                  "5 templates × 5 signatures",
                  "Direction artistique IA Claude",
                  "URL unique partageable",
                  "Support par email",
                ],
                highlight: true,
                delay: 80,
              },
              {
                name: "Agency",
                price: "499€",
                period: "/mois HT",
                sub: "Pour agences digitales et équipes",
                features: [
                  "40 sites cinematic / mois",
                  "250 vidéos AI Kling / mois",
                  "White-label complet",
                  "5 utilisateurs inclus",
                  "Domaine personnalisé",
                  "Support prioritaire",
                ],
                delay: 140,
              },
            ].map((plan) => (
              <BentoCard
                key={plan.name}
                className={`p-8 flex flex-col ${plan.highlight ? "border-black/20 bg-[#F0EEE8]" : ""}`}
                delay={plan.delay}
              >
                <div className="mb-8">
                  <div className="font-mono text-[11px] tracking-widest text-black/40 mb-4">{plan.name.toUpperCase()}</div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-light">{plan.price}</span>
                    {plan.period && <span className="text-black/40 text-sm">{plan.period}</span>}
                  </div>
                  <p className="text-xs text-black/35 tracking-wide">{plan.sub}</p>
                </div>
                <ul className="space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-black/55">
                      <div className="w-1 h-1 rounded-full bg-black/25 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </BentoCard>
            ))}
          </div>

          <p className="mt-10 text-center text-xs text-black/35 tracking-wide">
            Paiement immédiat · Résiliable à tout moment · Sans engagement
          </p>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section id="cta" className="relative py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06] overflow-hidden">
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05] mb-6">
            Ton premier site cinematic,<br />en quelques minutes.
          </h2>
          <p className="text-sm text-black/45 leading-relaxed mb-10 max-w-md mx-auto">
            Pas d'agence. Pas de 4 mois d'attente. Connecte ton URL Shopify et Vertxia fait le reste.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto justify-center">
            <a
              href="/app"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#111] text-white text-sm rounded-xl hover:bg-[#333] transition-colors tracking-widest font-medium"
            >
              COMMENCER MAINTENANT
            </a>
            <a
              href="https://instagram.com/vertxia.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 border border-black/10 text-black/70 text-sm rounded-xl hover:border-black/25 hover:bg-black/[0.04] transition-colors tracking-widest"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
              SUIVRE @VERTXIA.FR
            </a>
          </div>
        </div>
      </section>

      {/* ── PRÉSENTATION / BUILDER ────────────────────────────────────────── */}
      <section id="builder" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <Tag>LE BUILDER</Tag>
            <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
              {"Qui construit Vertxia,\nseul et en public."}
            </RevealText>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-start">
            {/* Photo */}
            <div className="md:col-span-1">
              <div className="aspect-square w-full rounded-2xl overflow-hidden bg-white border border-black/[0.07] shadow-sm">
                <img
                  src="/emilien.jpg"
                  alt="Emilien Behague"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-black/40">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Online · Building
              </div>
            </div>

            {/* Texte */}
            <div className="md:col-span-2">
              <h3 className="text-2xl md:text-3xl font-light mb-2">Emilien Behague</h3>
              <p className="text-xs text-black/40 mb-8 tracking-[0.2em] uppercase font-mono">
                Solo Builder · Indie Hacker
              </p>

              <p className="text-base md:text-lg text-black/65 leading-relaxed mb-6">
                Je construis Vertxia seul, en transparence totale.
              </p>

              <p className="text-sm text-black/50 leading-relaxed mb-5">
                L&apos;idée est née d&apos;une frustration simple : un site e-commerce cinematic avec vidéos premium par produit demande plusieurs mois de prod avec une agence. C&apos;est inaccessible à 99 % des marques DTC.
              </p>

              <p className="text-sm text-black/50 leading-relaxed mb-5">
                Mais avec les modèles vidéo IA en 2026 (Kling, Runway, Veo), ce niveau de présentation produit devrait être à la portée de tout le monde. C&apos;est exactement ce que Vertxia construit : un pipeline où l&apos;URL Shopify devient un site éditorial avec vidéos cinematic auto-générées par produit en quelques minutes.
              </p>

              <p className="text-sm text-black/50 leading-relaxed mb-10">
                Je documente chaque ligne de code, chaque décision, chaque échec et chaque learning sur Instagram. Build in public, sans filtre. Si tu kiffes les marathons techniques en solo, suis le build.
              </p>

              {/* Liens sociaux */}
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://instagram.com/vertxia.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-black/10 bg-white text-sm text-black/70 hover:border-black/25 hover:bg-black/[0.03] transition-all"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                  @vertxia.fr
                </a>
                <a
                  href="https://www.linkedin.com/in/emilien-behague-9697a1364"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-black/10 bg-white text-sm text-black/70 hover:border-black/25 hover:bg-black/[0.03] transition-all"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                  LinkedIn
                </a>
                <a
                  href="mailto:emilien@vertxia.com"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-black/10 bg-white text-sm text-black/70 hover:border-black/25 hover:bg-black/[0.03] transition-all"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  emilien@vertxia.com
                </a>
              </div>

              {/* Stats personnels */}
              <div className="mt-12 pt-8 border-t border-black/[0.06] grid grid-cols-3 gap-6">
                <div>
                  <div className="text-2xl font-light">10</div>
                  <div className="text-[10px] tracking-widest uppercase text-black/35 mt-1">
                    Mois de runway
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-light">Solo</div>
                  <div className="text-[10px] tracking-widest uppercase text-black/35 mt-1">
                    + Claude Code
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-light">100 %</div>
                  <div className="text-[10px] tracking-widest uppercase text-black/35 mt-1">
                    Transparence
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <span className="font-mono text-xs tracking-[0.25em] text-black/50">VERTXIA</span>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {[
              { label: "Pipeline", href: "#pipeline" },
              { label: "Templates", href: "#templates" },
              { label: "Stack", href: "#stack" },
              { label: "Vitrine", href: "#demos" },
              { label: "Preview", href: "#live" },
              { label: "Pricing", href: "#pricing" },
            ].map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-xs text-black/35 hover:text-black/70 transition-colors tracking-widest"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://instagram.com/vertxia.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-black/25 hover:text-black/55 transition-colors tracking-widest"
            >
              Instagram
            </a>
            <a
              href="https://www.linkedin.com/in/emilien-behague-9697a1364"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-black/25 hover:text-black/55 transition-colors tracking-widest"
            >
              LinkedIn
            </a>
            <a
              href="mailto:emilien@vertxia.com"
              className="text-xs text-black/25 hover:text-black/55 transition-colors tracking-widest"
            >
              Contact
            </a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-black/[0.04]">
          <span className="text-xs text-black/20">© 2026 Vertxia · Built solo in public.</span>
        </div>
      </footer>
    </div>
  );
}
