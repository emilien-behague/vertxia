"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { IntroAnimation, HERO_REVEAL_MS } from "@/components/intro-animation";
import { RevealText } from "@/components/reveal-text";
import { StickyNav } from "@/components/sticky-nav";
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
        {/* Animated sphere — l'œil IA qui analyse */}
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
            · Build in public · Pivot · 31 mai 2026
          </p>

          {/* Teaser beta — waitlist */}
          <a
            href="#beta"
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
              Beta privée · Recrutement
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
            Conformité électrique.<br />
            <span className="text-black/40">Avant le contrôle Consuel.</span><br />
            En 5 minutes.
          </h1>

          <p
            className="text-base md:text-lg text-black/50 max-w-xl mb-10 leading-relaxed"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0px)" : "translateY(16px)",
              transition: "opacity 1s cubic-bezier(0.16,1,0.3,1) 250ms, transform 1s cubic-bezier(0.16,1,0.3,1) 250ms",
            }}
          >
            Photographie ton tableau. L&apos;IA détecte les non-conformités NF C 15-100 sur photo. Rapport PDF auto avec références normatives. Pour les 80&nbsp;000 électriciens artisans français qui veulent passer le contrôle Consuel au premier coup.
          </p>

          {/* 3 metrics */}
          <div className="flex gap-8 sm:gap-12 mb-12">
            {[
              { value: "63%", label: "Dossiers Consuel à lacunes" },
              { value: "5 min", label: "Photo → rapport PDF" },
              { value: "3-6 sem", label: "Délai évité par refus" },
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

          {/* CTA inline */}
          <div
            className="flex flex-col sm:flex-row gap-2 max-w-md"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0px)" : "translateY(16px)",
              transition: "opacity 1s cubic-bezier(0.16,1,0.3,1) 700ms, transform 1s cubic-bezier(0.16,1,0.3,1) 700ms",
            }}
          >
            <a
              href="mailto:emilien@vertxia.com?subject=Beta-test Vertxia&body=Salut Emilien, je suis électricien et je veux tester Vertxia en beta privée. Mon contexte : "
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#111] text-white text-sm rounded-xl hover:bg-[#333] transition-colors tracking-widest font-medium whitespace-nowrap"
            >
              DEVENIR BETA-TESTEUR
            </a>
            <a
              href="https://instagram.com/vertxia.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 border border-black/10 text-black/70 text-sm rounded-xl hover:border-black/25 hover:bg-black/[0.04] transition-colors tracking-widest whitespace-nowrap"
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
          </div>
        </div>
      </section>

      {/* ── PIPELINE OVERVIEW (BENTO) ─────────────────────────────────────── */}
      <section id="pipeline" className="py-32 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <Tag>PIPELINE</Tag>
            <RevealText className="mt-5 text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]">
              {"De la photo au rapport,\nen 5 minutes."}
            </RevealText>
          </div>

          <div className="grid grid-cols-12 gap-3">
            {/* Big card — Upload photos */}
            <BentoCard className="col-span-12 md:col-span-8 p-8 min-h-[260px] flex flex-col justify-between" delay={0}>
              <div>
                <div className="w-10 h-10 rounded-xl border border-black/10 bg-white flex items-center justify-center mb-6">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <h3 className="text-2xl font-light mb-3">Photographie depuis ton téléphone</h3>
                <p className="text-sm text-black/45 leading-relaxed max-w-md">
                  Tableau, prises salle de bain, mise à la terre, serrage tableau divisionnaire. N&apos;importe quel smartphone. EXIF préservés. Upload direct sans installation d&apos;app — PWA mobile en V1, app Expo en V2.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-3">
                <div className="font-mono text-[10px] text-black/35 tracking-widest">SUPPORT</div>
                <div className="flex gap-2">
                  {["iPhone", "Android", "Reflex (V2)"].map((p, i) => (
                    <span
                      key={p}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-mono ${i < 2 ? "bg-black text-white" : "bg-black/[0.04] text-black/40"}`}
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
                  <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m7.07 7.07l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m7.07-7.07l4.24-4.24" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Vision IA multi-tier</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Claude Haiku filtre les images, Gemini 2.5 Pro analyse, Claude Sonnet 4.6 tranche les cas complexes. Coût optimisé : ~$0.05 par rapport.
              </p>
            </BentoCard>

            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[200px]" delay={160}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Détection NF C 15-100</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Mise à la terre · Salle de bain volumes · Serrage connexions · Calibre protection · Différentiels 30mA · Sections câbles.
              </p>
            </BentoCard>

            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[200px]" delay={200}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Annotations sur image</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Bounding box précise sur chaque défaut + sévérité (info / warning / critical) + référence normative exacte.
              </p>
            </BentoCard>

            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[200px]" delay={240}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="13" x2="15" y2="13" />
                  <line x1="9" y1="17" x2="15" y2="17" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Rapport PDF Consuel-ready</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Téléchargeable, partageable client, marque blanche optionnelle. Stats agrégées par chantier.
              </p>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ── CATÉGORIES DÉTECTÉES ──────────────────────────────────────────── */}
      <section id="categories" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-16">
            <div>
              <Tag>CATÉGORIES DÉTECTÉES</Tag>
              <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
                {"On détecte ce qui fait\n63% des refus Consuel."}
              </RevealText>
            </div>
            <p className="text-sm text-black/45 leading-relaxed max-w-xs">
              Données sources : rapport activité Consuel 2024 + statistiques Promotelec ONSE 2024. Vertxia détecte les 9 catégories qui représentent 80% des non-conformités.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { name: "Mise à la terre absente", pct: "16.1%", desc: "Liaison équipotentielle, prise de terre, continuité conducteur." },
              { name: "Salle de bain (volumes)", pct: "23.5%", desc: "Prises en volume interdit, luminaires IP non conformes, distances." },
              { name: "Serrage connexions", pct: "22.3%", desc: "Dominos, bornes mal serrées, échauffements, traces de surchauffe." },
              { name: "Calibre protection", pct: "—", desc: "Surcalibre disjoncteur, ampérage incompatible section câble." },
              { name: "Différentiels 30mA", pct: "—", desc: "Absence DDR, mauvais raccordement, surcharge circuits." },
              { name: "Sections câbles", pct: "—", desc: "Section insuffisante, mélange sections, sertissage incorrect." },
              { name: "Gaines apparentes", pct: "—", desc: "Câbles non protégés, conduits ICTA absents, traversées non isolées." },
              { name: "Prises sans terre", pct: "—", desc: "Anciennes prises 2P sans contact terre, broche désactivée." },
              { name: "Cheminement câbles", pct: "—", desc: "Sépar courants forts/faibles, distances respect plinthes/sols." },
            ].map((cat, i) => (
              <BentoCard key={cat.name} className="p-6 min-h-[140px] flex flex-col justify-between" delay={i * 40}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-light text-[#111]">{cat.name}</h3>
                  {cat.pct !== "—" && (
                    <span className="text-xs font-mono text-black/35 tracking-wider whitespace-nowrap">{cat.pct}</span>
                  )}
                </div>
                <p className="text-xs text-black/45 leading-relaxed mt-3">{cat.desc}</p>
              </BentoCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── BETA / WAITLIST ──────────────────────────────────────────────── */}
      <section id="beta" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Tag>BETA PRIVÉE — RECRUTEMENT</Tag>
            <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
              {"5 électriciens beta-testeurs.\nGratuit. À vie."}
            </RevealText>
            <p className="mt-6 text-base text-black/50 leading-relaxed max-w-2xl mx-auto">
              On cherche 5 électriciens artisans pour calibrer la précision IA sur de vrais chantiers. En échange : accès gratuit à vie au produit final, mention au lancement, et ton retour qui shape directement le produit.
            </p>
          </div>

          <BentoCard className="p-10 text-center" delay={0}>
            <div className="text-xs font-mono tracking-widest text-black/40 mb-4">CRITÈRES BETA</div>
            <ul className="space-y-3 text-sm text-black/65 mb-8 max-w-lg mx-auto text-left">
              <li className="flex items-start gap-3">
                <span className="text-black/35 mt-1">·</span>
                <span>Électricien artisan en activité (SASU, EURL, micro-entreprise)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-black/35 mt-1">·</span>
                <span>3+ chantiers résidentiels / mois (neuf ou rénovation)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-black/35 mt-1">·</span>
                <span>Prêt à uploader 10-20 photos / semaine pendant 4 semaines</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-black/35 mt-1">·</span>
                <span>Visio 30 min / semaine pour debrief retour produit</span>
              </li>
            </ul>
            <a
              href="mailto:emilien@vertxia.com?subject=Beta-test Vertxia&body=Salut Emilien,%0D%0A%0D%0AJe suis électricien et je veux rejoindre la beta privée Vertxia.%0D%0A%0D%0AMon contexte :%0D%0A- Statut juridique : %0D%0A- Région : %0D%0A- Chantiers / mois : %0D%0A- Type d'installations (neuf/réno/tertiaire) : %0D%0A%0D%0AContact : "
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#111] text-white text-sm rounded-xl hover:bg-[#333] transition-colors tracking-widest font-medium"
            >
              POSTULER À LA BETA
            </a>
            <p className="mt-4 text-xs text-black/35 font-mono tracking-wide">
              emilien@vertxia.com · réponse sous 24h
            </p>
          </BentoCard>
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
            Stack moderne, open source quand possible, choisie pour la performance long-terme et la maîtrise des coûts IA.
          </p>
        </div>
      </section>

      {/* ── MARQUEE STACK ─────────────────────────────────────────────────── */}
      <section className="py-0 border-t border-black/[0.06] overflow-hidden select-none">
        <div className="flex border-b border-black/[0.06]" style={{ animation: "marqueeLeft 28s linear infinite" }}>
          {[...Array(3)].map((_, rep) => (
            <div key={rep} className="flex shrink-0">
              {[
                "Next.js 16",
                "Claude Sonnet 4.6",
                "Claude Haiku 4.5",
                "Gemini 2.5 Pro",
                "Voyage AI Embeddings",
                "Postgres + pgvector",
                "Trigger.dev v3",
                "React Native Expo",
                "Vision Camera v5",
                "@react-pdf/renderer",
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
                "NF C 15-100",
                "Promotelec",
                "CAPEB",
                "Qualifelec",
                "Consuel",
                "Guides fabricants RAG",
                "Stripe Billing",
                "Resend",
                "Vercel Edge",
                "Supabase Auth",
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

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 flex flex-col items-center">
            <Tag>PRICING — APRÈS BETA</Tag>
            <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
              {"Pricing transparent.\nÉconomise un refus = rentabilisé."}
            </RevealText>
            <p className="mt-6 text-sm text-black/45 max-w-xl mx-auto leading-relaxed">
              Pricing prévisionnel (lancement public sept 2026). Beta-testeurs accès gratuit à vie.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                name: "Solo",
                price: "49€",
                period: "/mois HT",
                sub: "Pour l'électricien artisan indépendant",
                features: [
                  "10 rapports IA / mois",
                  "Détection 9 catégories NF C 15-100",
                  "Rapport PDF marque personnelle",
                  "Historique chantiers illimité",
                  "Email support",
                ],
                delay: 0,
              },
              {
                name: "Team",
                price: "149€",
                period: "/mois HT",
                sub: "Pour entreprise 2-5 électriciens",
                features: [
                  "50 rapports IA / mois",
                  "Multi-utilisateurs (5 max)",
                  "Espace partagé chantiers",
                  "Rapports marque blanche",
                  "Support prioritaire",
                ],
                highlight: true,
                delay: 80,
              },
              {
                name: "Bureau Contrôle",
                price: "499€",
                period: "/mois HT",
                sub: "Pour bureaux COFRAC + 5 utilisateurs",
                features: [
                  "Rapports illimités",
                  "Multi-utilisateurs illimités",
                  "API d'intégration ERP",
                  "Marque blanche complète",
                  "Support dédié + SLA",
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
            Ton premier rapport,<br />en 5 minutes.
          </h2>
          <p className="text-sm text-black/45 leading-relaxed mb-10 max-w-md mx-auto">
            Pas de contrôle Consuel raté. Pas de 3-6 semaines d&apos;attente bloqué. Photographie, analyse, corrige avant.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto justify-center">
            <a
              href="mailto:emilien@vertxia.com?subject=Beta-test Vertxia"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#111] text-white text-sm rounded-xl hover:bg-[#333] transition-colors tracking-widest font-medium"
            >
              DEVENIR BETA-TESTEUR
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

            <div className="md:col-span-2">
              <h3 className="text-2xl md:text-3xl font-light mb-2">Emilien Behague</h3>
              <p className="text-xs text-black/40 mb-8 tracking-[0.2em] uppercase font-mono">
                Solo Builder · Indie Hacker · Toulon
              </p>

              <p className="text-base md:text-lg text-black/65 leading-relaxed mb-6">
                Je construis Vertxia seul, en transparence totale.
              </p>

              <p className="text-sm text-black/50 leading-relaxed mb-5">
                L&apos;idée est née d&apos;un constat brutal : 63% des dossiers Consuel présentent des lacunes au 1er contrôle. 25 à 40% sont refusés. Quand ça arrive, l&apos;électricien doit revenir corriger, repayer un contrôle (77€), et attendre 3 à 6 semaines pour la contre-visite. Pendant ce temps, le chantier est bloqué, le client râle, l&apos;artisan perd de l&apos;argent.
              </p>

              <p className="text-sm text-black/50 leading-relaxed mb-5">
                Avec les modèles vision IA en 2026 (Claude Sonnet 4.6, Gemini 2.5 Pro), détecter une non-conformité NF C 15-100 sur photo devient enfin possible et rentable. C&apos;est exactement ce que Vertxia construit : un copilote IA pour les 80 000 électriciens artisans français, qui détecte les défauts AVANT que Consuel passe.
              </p>

              <p className="text-sm text-black/50 leading-relaxed mb-10">
                Je documente chaque ligne de code, chaque décision, chaque échec et chaque learning sur Instagram et LinkedIn. Build in public, sans filtre. Si tu kiffes les marathons techniques en solo, suis le build.
              </p>

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

              <div className="mt-12 pt-8 border-t border-black/[0.06] grid grid-cols-3 gap-6">
                <div>
                  <div className="text-2xl font-light">3 ans</div>
                  <div className="text-[10px] tracking-widest uppercase text-black/35 mt-1">
                    Runway
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
              { label: "Catégories", href: "#categories" },
              { label: "Beta", href: "#beta" },
              { label: "Stack", href: "#stack" },
              { label: "Pricing", href: "#pricing" },
              { label: "Builder", href: "#builder" },
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
          <span className="text-xs text-black/20">© 2026 Vertxia · Conformité électrique IA · Built solo in public.</span>
        </div>
      </footer>
    </div>
  );
}
