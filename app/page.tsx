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
            · Build in public · Pivot F-Gas · 1er juin 2026
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
            La paperasse F-Gas.<br />
            <span className="text-black/40">Finie en quelques secondes.</span><br />
            Depuis votre téléphone.
          </h1>

          <p
            className="text-base md:text-lg text-black/50 max-w-xl mb-10 leading-relaxed"
            style={{
              opacity: heroReady ? 1 : 0,
              transform: heroReady ? "translateY(0px)" : "translateY(16px)",
              transition: "opacity 1s cubic-bezier(0.16,1,0.3,1) 250ms, transform 1s cubic-bezier(0.16,1,0.3,1) 250ms",
            }}
          >
            Photo + voix → l&apos;application génère votre BSFF officiel signé Ministère, votre CERFA d&apos;intervention, et votre déclaration annuelle SYDEREP. Pour les frigoristes, techniciens froid, climaticiens et installateurs PAC qui veulent en finir avec la paperasse F-Gas.
          </p>

          {/* 3 metrics */}
          <div className="flex gap-8 sm:gap-12 mb-12">
            {[
              { value: "Direct", label: "BSFF via API officielle" },
              { value: "Officiel", label: "Signature Ministère" },
              { value: "Pré-rempli", label: "Plaque + voix" },
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
              href="/start"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#111] text-white text-sm rounded-xl hover:bg-[#333] transition-colors tracking-widest font-medium whitespace-nowrap"
            >
              ESSAYER L&apos;APPLI
            </a>
            <a
              href="mailto:emilien@vertxia.com?subject=Beta-test Vertxia F-Gas&body=Salut Emilien, je suis frigoriste / technicien froid / climaticien / installateur PAC et je veux tester Vertxia en beta privée. Mon contexte : "
              className="inline-flex items-center justify-center gap-2 px-8 py-3 border border-black/10 text-black/70 text-sm rounded-xl hover:border-black/25 hover:bg-black/[0.04] transition-colors tracking-widest whitespace-nowrap"
            >
              DEVENIR BETA-TESTEUR
            </a>
            <a
              href="https://instagram.com/vertxia.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center justify-center gap-2 px-8 py-3 border border-black/10 text-black/70 text-sm rounded-xl hover:border-black/25 hover:bg-black/[0.04] transition-colors tracking-widest whitespace-nowrap"
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
              {"De l'intervention au BSFF,\nen quelques secondes."}
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
                <h3 className="text-2xl font-light mb-3">Photo de la plaque + commande vocale</h3>
                <p className="text-sm text-black/45 leading-relaxed max-w-md">
                  Une photo de la plaque pré-remplit l&apos;équipement (modèle, n° de série, fluide, charge). Vous précisez l&apos;intervention à la voix, le client signe à l&apos;écran. Champs administratifs pré-remplis depuis votre profil et l&apos;équipement. N&apos;importe quel smartphone, sans installation — PWA en V1, app native en V2.
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
              <h3 className="text-lg font-light mb-2">Vision IA + reconnaissance fluide</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                L&apos;IA lit la plaque signalétique (modèle, fluide, charge) et comprend votre dictée vocale. Elle pré-remplit BSFF, CERFA et registre — vous validez et signez.
              </p>
            </BentoCard>

            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[200px]" delay={160}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Connecté à TrackDéchets</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Génération du BSFF via l&apos;API officielle du Ministère de la Transition écologique. Signature électronique, PDF officiel téléchargeable directement depuis l&apos;appli.
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
              <h3 className="text-lg font-light mb-2">Archive interventions année</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Toutes vos interventions stockées par équipement, prêtes pour générer automatiquement la déclaration annuelle SYDEREP à l&apos;ADEME.
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
              <h3 className="text-lg font-light mb-2">PDF officiel signé Ministère</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                BSFF, CERFA 15497*04, étiquette TFE post-intervention. PDF officiel téléchargeable, partageable client, archivable.
              </p>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ── INTELLIGENCE EMBARQUÉE (nouveautés) ─────────────────────────── */}
      <section id="intelligence" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-16">
            <div>
              <Tag>INTELLIGENCE EMBARQUÉE</Tag>
              <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
                {"L'IA terrain qui pense\ncomme un frigoriste senior."}
              </RevealText>
            </div>
            <p className="text-sm text-black/45 leading-relaxed max-w-xs">
              Au-delà de la paperasse, Vertxia diagnostique, alerte, conseille et relance — comme un collègue expert qui ne dort jamais.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-3">
            {/* Big card — Diagnostic visuel IA */}
            <BentoCard className="col-span-12 md:col-span-8 p-8 min-h-[280px] flex flex-col justify-between" delay={0}>
              <div>
                <div className="w-10 h-10 rounded-xl border border-black/10 bg-white flex items-center justify-center mb-6">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="11" y1="8" x2="11" y2="14" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </div>
                <h3 className="text-2xl font-light mb-3">Diagnostic visuel d&apos;un composant</h3>
                <p className="text-sm text-black/45 leading-relaxed max-w-md">
                  Photo d&apos;un compresseur, échangeur, brasure ou raccord suspect → Vertxia identifie le composant, détecte les défauts (corrosion, traces d&apos;huile, encrassement, soudure défectueuse), donne la cause probable, l&apos;action recommandée, le délai et une fourchette de devis. En 3 à 5 secondes.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-3 flex-wrap">
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-black text-white">Corrosion</span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-black text-white">Fuite suspectée</span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-black/[0.04] text-black/55">Calorifuge dégradé</span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-black/[0.04] text-black/55">Encrassement</span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-black/[0.04] text-black/55">Soudure défectueuse</span>
              </div>
            </BentoCard>

            {/* Chat F-Gas expert */}
            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[280px]" delay={120}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Assistant F-Gas, 24/7 dans votre poche</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Une question terrain — délai de contrôle pour 8 tCO2eq, substitut R-410A, lecture d&apos;un manomètre, validité d&apos;une recharge — réponse experte en français, en moins de 3 secondes. Réglementation UE 2024/573 + fluides HFC/HFO + diagnostic terrain.
              </p>
            </BentoCard>

            {/* Alerte infractions */}
            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[220px]" delay={160}>
              <div className="w-10 h-10 rounded-xl border border-red-200 bg-red-50 flex items-center justify-center mb-5 text-red-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Alerte infractions réglementaires</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Vertxia compare en continu vos équipements aux délais imposés par le règlement UE 2024/573 et signale les contrôles en retard, classés par sévérité — pour vous protéger des sanctions DREAL et de l&apos;art. L173-12 du Code de l&apos;environnement.
              </p>
            </BentoCard>

            {/* Relance client 30j */}
            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[220px]" delay={200}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Relance client 30 jours avant échéance</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                30 jours avant le contrôle obligatoire d&apos;un client, Vertxia bascule l&apos;équipement en « à relancer » et prépare un email personnalisé prêt à envoyer en un tap. Vous ne perdez plus un client par oubli.
              </p>
            </BentoCard>

            {/* Dictée vocale intervention complète */}
            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[220px]" delay={240}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Dictée vocale 30 secondes</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Parlez votre intervention comme à un collègue (« contrôle annuel, R-410A 12 kg, fuite côté évaporateur, réparée, détecteur fixe »). L&apos;IA range tout dans les bonnes cases du CERFA. Confiance affichée par champ.
              </p>
            </BentoCard>

            {/* Lookup SIRET */}
            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[220px]" delay={280}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 21l-4.35-4.35" />
                  <circle cx="11" cy="11" r="8" />
                  <path d="M11 7v4l3 2" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Lookup SIRET client automatique</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Tapez les 3 premières lettres du client ou son SIRET → raison sociale, SIRET, adresse postale et code NAF récupérés en direct depuis l&apos;INSEE / data.gouv. Plus de saisie manuelle, plus de fautes de frappe.
              </p>
            </BentoCard>

            {/* Multi-unités */}
            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[220px]" delay={320}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Multi-unités : 1 extérieure + N intérieures</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Pour les VRV, splits multi-zones, chambres froides modulaires : une seule charge fluide côté extérieur, mais chaque unité intérieure suivie avec son propre n° de série. Indispensable pour le SAV.
              </p>
            </BentoCard>

            {/* Historique diagnostics */}
            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[220px]" delay={360}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <circle cx="9" cy="14" r="1.5" />
                  <path d="M10.5 15.5L13 18" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Historique des diagnostics IA</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Chaque photo diagnostiquée est rangée dans un dossier dédié. Re-consultable, partageable, transformable en intervention pré-remplie en un tap — la photo et le défaut détecté restent attachés à la fiche d&apos;intervention.
              </p>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ── VERTXIA A UN CERVEAU (mémoire prédictive + contextuelle + collective + cross) ─ */}
      <section id="cerveau" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-16">
            <div>
              <Tag>MÉMOIRE & PRÉDICTIF</Tag>
              <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
                {"Vertxia a un cerveau.\nIl apprend de toi.\nIl apprend des autres."}
              </RevealText>
            </div>
            <p className="text-sm text-black/45 leading-relaxed max-w-xs">
              Pendant que tu travailles, Vertxia construit une mémoire vivante de tes équipements, de ton parc, et croise ce que les autres techniciens ont vu. Avec le temps, ça devient un copilote SAV.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-3">
            {/* Big card — Maintenance prédictive */}
            <BentoCard className="col-span-12 md:col-span-8 p-8 min-h-[300px] flex flex-col justify-between" delay={0}>
              <div>
                <div className="w-10 h-10 rounded-xl border border-orange-200 bg-orange-50 flex items-center justify-center mb-6 text-orange-600">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="9" />
                    <polyline points="12 7 12 12 15 14" />
                    <path d="M3.5 9.5h2M18.5 9.5h2M3.5 14.5h2M18.5 14.5h2" />
                  </svg>
                </div>
                <h3 className="text-2xl font-light mb-3">Maintenance prédictive — 6 signaux qui voient venir les pannes</h3>
                <p className="text-sm text-black/45 leading-relaxed max-w-md">
                  Pour chaque équipement, Vertxia analyse en continu l&apos;historique des interventions et des diagnostics. Quand un pattern suspect émerge — fuites qui reviennent, charge cumulée qui dépasse, défaut chronique non résolu, fluide en phase-out — un signal apparaît sur la fiche avec l&apos;action recommandée concrète.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-red-600 text-white">Fuite récurrente</span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-orange-500 text-white">Charge cumulée &gt; 30 %</span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-orange-500 text-white">Tendance croissante</span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-amber-500 text-white">Défaut chronique</span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-black/[0.04] text-black/55">Phase-out fluide</span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-black/[0.04] text-black/55">Jamais contrôlé</span>
              </div>
            </BentoCard>

            {/* Mémoire contextuelle */}
            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[300px]" delay={120}>
              <div className="w-10 h-10 rounded-xl border border-amber-200 bg-amber-50 flex items-center justify-center mb-5 text-amber-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 2a10 10 0 1 0 10 10" />
                  <path d="M22 2 12 12" />
                  <circle cx="12" cy="12" r="2.5" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Mémoire contextuelle — Vertxia connaît ton parc</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Sur chaque équipement scanné, Vertxia rappelle : interventions précédentes sur le même N° de série, équipements similaires dans ton parc, défauts récurrents observés. Tu n&apos;as plus à redécouvrir une machine que tu as déjà vue.
              </p>
            </BentoCard>

            {/* Mémoire collective */}
            <BentoCard className="col-span-12 md:col-span-6 p-8 min-h-[240px]" delay={160}>
              <div className="w-10 h-10 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center justify-center mb-5 text-emerald-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="9" cy="7" r="3.5" />
                  <circle cx="17" cy="7" r="2.5" />
                  <path d="M3 21v-1a6 6 0 0 1 12 0v1" />
                  <path d="M16 21v-1a4.5 4.5 0 0 1 5-4.5" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Mémoire collective — chaque technicien rend les autres meilleurs</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Quand un confrère documente une panne récurrente sur un modèle, tu en bénéficies sur ta propre fiche. Plus la communauté Vertxia s&apos;étend, plus chacun gagne en précision SAV. Effet réseau pur — invisible pour Excel, impossible pour la concurrence.
              </p>
            </BentoCard>

            {/* Signal croisé */}
            <BentoCard className="col-span-12 md:col-span-6 p-8 min-h-[240px]" delay={200}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 text-white shadow shadow-violet-900/15" style={{ background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 2L4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Signal croisé — Vertxia recommande</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Pendant l&apos;intervention, Vertxia confronte ton diagnostic local au pattern collectif et te suggère : « tu interviens sur le compresseur — pendant que tu y es, jette un œil au détendeur, 12 cas confrères sur ce modèle. » L&apos;intelligence devient actionnable, pas juste affichée.
              </p>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ── SUR LE TERRAIN (carte, QR, mode présentation, partage, statuts, offline) ─ */}
      <section id="terrain" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-16">
            <div>
              <Tag>TERRAIN</Tag>
              <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
                {"Pensé pour le quotidien\ndu technicien."}
              </RevealText>
            </div>
            <p className="text-sm text-black/45 leading-relaxed max-w-xs">
              On a refondu l&apos;interface mobile avec un pro frigoriste sur le terrain. Règle d&apos;or : utilisable d&apos;une main, sur une échelle, avec des gants gras. Zéro jargon, gros boutons, 1 tap par action.
            </p>
          </div>

          <div className="grid grid-cols-12 gap-3">
            {/* Big card — Carte interactive + planning */}
            <BentoCard className="col-span-12 md:col-span-8 p-8 min-h-[300px] flex flex-col justify-between" delay={0}>
              <div>
                <div className="w-10 h-10 rounded-xl border border-blue-200 bg-blue-50 flex items-center justify-center mb-6 text-blue-700">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <h3 className="text-2xl font-light mb-3">Carte interactive + planning du jour</h3>
                <p className="text-sm text-black/45 leading-relaxed max-w-md">
                  Toute ta tournée sur une seule carte. Les pins sont colorés selon le statut F-Gas de chaque équipement (en retard rouge, à relancer orange, à jour vert). Tu vois ton chemin, tu ouvres la fiche en un tap, tu lances la navigation Apple Maps / Google Maps en deux.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-black text-white">Leaflet open source</span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-black/[0.04] text-black/55">Géocodage adresse</span>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono bg-black/[0.04] text-black/55">Itinéraire 1-tap</span>
              </div>
            </BentoCard>

            {/* QR unique */}
            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[300px]" delay={120}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <path d="M14 14h3v3M21 17v4M17 21h-3v-3" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">QR unique par équipement</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Une étiquette QR adhésive à coller sur la machine. N&apos;importe quel smartphone scanne et ouvre la fiche : statut F-Gas, dernière intervention, historique complet, photos. Pas d&apos;app à installer.
              </p>
            </BentoCard>

            {/* Mode présentation */}
            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[220px]" delay={160}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Mode présentation client</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Bascule la fiche en plein écran pour montrer au client : son équipement, son statut réglementaire, l&apos;historique de tes interventions. Argument commercial visuel, sans PowerPoint.
              </p>
            </BentoCard>

            {/* Partage confrère */}
            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[220px]" delay={200}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Partage confrère — lien magique 7 jours</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Tu sous-traites une intervention à un confrère ? Génère un lien d&apos;accès temporaire à la fiche. Il intervient à ta place, l&apos;historique reste propre, l&apos;accès expire automatiquement.
              </p>
            </BentoCard>

            {/* Statut drapeau XL */}
            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[220px]" delay={240}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 text-white text-base font-bold" style={{ background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)" }}>
                <span aria-hidden>🚨</span>
              </div>
              <h3 className="text-lg font-light mb-2">Statut drapeau XL — un coup d&apos;œil suffit</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Bandeau coloré en haut de fiche selon le statut réglementaire : EN RETARD (rouge), À RELANCER (orange), À PROGRAMMER (ambre), JAMAIS CONTRÔLÉ (bleu), À JOUR (vert), EXEMPTÉ (gris). Tu sais où tu vas en 2 secondes.
              </p>
            </BentoCard>

            {/* Offline-first */}
            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[220px]" delay={280}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                  <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Offline-first — fonctionne sans 4G</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Sous-sol parking, chambre froide encastrée, plein champ — Vertxia continue. PWA service worker, tout est cached. Dès que le réseau revient, la synchro vers la base centrale est silencieuse.
              </p>
            </BentoCard>

            {/* Contribuer à la mémoire collective */}
            <BentoCard className="col-span-12 md:col-span-6 p-8 min-h-[200px]" delay={320}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Documenter une panne en 1 tap</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Un bouton sur chaque signal prédictif : « documenter cette panne dans la mémoire collective ». Tu contribues anonymement. Les confrères qui croisent ce modèle demain en bénéficient. C&apos;est ainsi que le réseau grandit.
              </p>
            </BentoCard>

            {/* Score de conformité */}
            <BentoCard className="col-span-12 md:col-span-6 p-8 min-h-[200px]" delay={360}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Score de conformité global</h3>
              <p className="text-sm text-black/45 leading-relaxed">
                Badge flottant qui agrège l&apos;état réglementaire de tout ton parc : % d&apos;équipements à jour, nombre d&apos;en retard, nombre à relancer. Tu connais ton risque DREAL en temps réel.
              </p>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ── DOCUMENTS GÉNÉRÉS ─────────────────────────────────────────────── */}
      <section id="categories" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-16">
            <div>
              <Tag>DOCUMENTS GÉNÉRÉS</Tag>
              <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
                {"Toute la paperasse F-Gas,\nautomatique."}
              </RevealText>
            </div>
            <p className="text-sm text-black/45 leading-relaxed max-w-xs">
              Le règlement UE 2024/573 est entré en vigueur en mars 2024. La transition des catégories d&apos;attestation s&apos;achève fin 2026. Vertxia s&apos;occupe de tous les documents obligatoires.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { name: "BSFF", pct: "API officielle", desc: "Bordereau de Suivi des Fluides Frigorigènes signé électroniquement via TrackDéchets, Ministère de la Transition écologique." },
              { name: "CERFA 15497*04", pct: "Obligatoire", desc: "Fiche d'intervention F-Gas exigée à chaque manipulation de fluide frigorigène. Pré-remplie depuis la plaque signalétique." },
              { name: "Déclaration SYDEREP", pct: "ADEME", desc: "Déclaration annuelle obligatoire avant le 31 mars de l'année suivante. Agrégation automatique de toutes vos interventions." },
              { name: "Étiquette TFE", pct: "Post-intervention", desc: "Étiquette à apposer sur l'équipement après chaque intervention, conforme aux exigences du règlement UE." },
              { name: "Registre par équipement", pct: "10 ans", desc: "Registre obligatoire des interventions par équipement, archivé 10 ans. Recherche par client, par fluide, par date." },
              { name: "Récap volumes annuel", pct: "Auto", desc: "Bilan annuel des fluides chargés, récupérés, recyclés. Prêt pour la déclaration SYDEREP en un clic." },
              { name: "Attestation client", pct: "PDF", desc: "Attestation d'intervention conforme remise au client après chaque passage. Personnalisable à votre logo." },
              { name: "Récap mensuel", pct: "Email", desc: "Synthèse mensuelle de votre activité F-Gas envoyée par email. Pour vous, pour votre comptable, pour vos partenaires." },
              { name: "Archivage cloud", pct: "Sécurisé", desc: "Toutes vos pièces archivées en France, accessibles depuis n'importe quel appareil. Aucune donnée perdue." },
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

      {/* ── DÉMO LIVE ─────────────────────────────────────────────────────── */}
      <section id="demo" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-3xl mx-auto text-center">
          <Tag>DÉMO LIVE · APPLI MOBILE</Tag>
          <RevealText className="mt-5 text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]">
            {"Ouvre l'appli sur ton iPhone.\nMaintenant."}
          </RevealText>
          <p className="mt-8 text-base text-black/50 max-w-xl mx-auto leading-relaxed">
            Scan de plaque, saisie vocale, signature client, génération CERFA + BSFF officiel signé Ministère. L&apos;appli PWA s&apos;installe sur ton écran d&apos;accueil. Aucune inscription, aucun engagement.
          </p>
          <p className="mt-4 text-sm text-black/40 max-w-md mx-auto leading-relaxed">
            Les données restent sur ton téléphone. Compatible iPhone &amp; Android. Démo sandbox TrackDéchets — pas de BSFF de production envoyé.
          </p>
          <div className="mt-12">
            <a
              href="/start"
              className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#111] text-white text-sm rounded-xl hover:bg-[#333] transition-colors tracking-widest font-medium"
            >
              OUVRIR L&apos;APPLI MOBILE
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </a>
          </div>
          <p className="mt-6 font-mono text-[10px] tracking-[0.2em] uppercase text-black/35">
            ou{" "}
            <a href="/bsff" className="underline underline-offset-4 hover:text-black/70 transition-colors">
              tester juste la sandbox BSFF
            </a>
          </p>
        </div>
      </section>

      {/* ── BETA / WAITLIST ──────────────────────────────────────────────── */}
      <section id="beta" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <Tag>BETA PRIVÉE — RECRUTEMENT</Tag>
            <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
              {"10 techniciens beta-testeurs.\nGratuit. À vie."}
            </RevealText>
            <p className="mt-6 text-base text-black/50 leading-relaxed max-w-2xl mx-auto">
              On cherche 10 frigoristes, techniciens froid, climaticiens ou installateurs PAC pour calibrer Vertxia sur de vraies interventions. En échange : accès gratuit à vie au produit final, mention au lancement, et ton retour qui shape directement le produit.
            </p>
          </div>

          <BentoCard className="p-10 text-center" delay={0}>
            <div className="text-xs font-mono tracking-widest text-black/40 mb-4">CRITÈRES BETA</div>
            <ul className="space-y-3 text-sm text-black/65 mb-8 max-w-lg mx-auto text-left">
              <li className="flex items-start gap-3">
                <span className="text-black/35 mt-1">·</span>
                <span>Frigoriste, technicien froid, climaticien ou installateur PAC en activité</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-black/35 mt-1">·</span>
                <span>Attestation de capacité Catégorie I (ou en cours d&apos;obtention)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-black/35 mt-1">·</span>
                <span>3+ interventions F-Gas par mois (résidentiel, tertiaire, agroalim)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-black/35 mt-1">·</span>
                <span>Visio 30 min / semaine pour debrief retour produit</span>
              </li>
            </ul>
            <a
              href="mailto:emilien@vertxia.com?subject=Beta-test Vertxia F-Gas&body=Salut Emilien,%0D%0A%0D%0AJe veux rejoindre la beta privée Vertxia F-Gas.%0D%0A%0D%0AMon contexte :%0D%0A- Métier (frigoriste / technicien froid / climaticien / installateur PAC) : %0D%0A- Statut juridique : %0D%0A- Région : %0D%0A- Catégorie d'attestation F-Gas : %0D%0A- Interventions F-Gas / mois : %0D%0A- Type d'installations (résidentiel / tertiaire / agroalim) : %0D%0A%0D%0AContact : "
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
                "Règlement UE 2024/573",
                "ADEME SYDEREP",
                "TrackDéchets",
                "Cemafroid",
                "AFCE",
                "CAPEB Adour-Pyrénées",
                "FFB UMGCCP",
                "Climalife",
                "Stripe Billing",
                "Vercel Edge",
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
        <div className="max-w-3xl mx-auto text-center">
          <Tag>PRICING</Tag>
          <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
            {"Beta gratuite à vie.\nPricing dévoilé plus tard."}
          </RevealText>
          <p className="mt-8 text-base text-black/50 max-w-xl mx-auto leading-relaxed">
            Vertxia est en phase de construction avec ses premiers beta-testeurs. Les 10 techniciens qui rejoignent maintenant gardent un accès gratuit à vie au produit final, sans condition de durée.
          </p>
          <p className="mt-4 text-sm text-black/40 max-w-xl mx-auto leading-relaxed">
            Le pricing public sera annoncé après la phase beta. Nous construisons d&apos;abord un produit qui résout vraiment vos problèmes, puis nous parlerons argent.
          </p>
          <div className="mt-12">
            <a
              href="#beta"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#111] text-white text-sm rounded-xl hover:bg-[#333] transition-colors tracking-widest font-medium"
            >
              REJOINDRE LA BETA GRATUITE
            </a>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section id="cta" className="relative py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06] overflow-hidden">
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05] mb-6">
            Ton premier BSFF,<br />en quelques secondes.
          </h2>
          <p className="text-sm text-black/45 leading-relaxed mb-10 max-w-md mx-auto">
            Plus de soirées à remplir des CERFA. Plus de week-ends à préparer la déclaration SYDEREP. Vertxia s&apos;en occupe pour vous.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto justify-center">
            <a
              href="/start"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-[#111] text-white text-sm rounded-xl hover:bg-[#333] transition-colors tracking-widest font-medium"
            >
              ESSAYER L&apos;APPLI
            </a>
            <a
              href="mailto:emilien@vertxia.com?subject=Beta-test Vertxia F-Gas"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 border border-black/10 text-black/70 text-sm rounded-xl hover:border-black/25 hover:bg-black/[0.04] transition-colors tracking-widest"
            >
              BETA-TESTEUR
            </a>
            <a
              href="https://instagram.com/vertxia.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center justify-center gap-2 px-8 py-3 border border-black/10 text-black/70 text-sm rounded-xl hover:border-black/25 hover:bg-black/[0.04] transition-colors tracking-widest"
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
                Solo Builder · Indie Hacker · France
              </p>

              <p className="text-base md:text-lg text-black/65 leading-relaxed mb-6">
                Je construis Vertxia seul, en transparence totale.
              </p>

              <p className="text-sm text-black/50 leading-relaxed mb-5">
                L&apos;idée vient d&apos;un constat simple : les frigoristes, techniciens froid, climaticiens et installateurs PAC passent un temps considérable sur la paperasse F-Gas. Bordereaux BSFF à remplir à chaque intervention, CERFA d&apos;intervention obligatoire, déclaration annuelle SYDEREP en fin d&apos;année. Tout ça à la main, en double saisie, le soir ou le week-end. Pendant ce temps, leur métier — la technique, le terrain, les clients — passe au second plan.
              </p>

              <p className="text-sm text-black/50 leading-relaxed mb-5">
                Avec le règlement UE 2024/573 entré en vigueur en mars 2024 et la transition des catégories d&apos;attestation qui s&apos;achève fin 2026, la charge administrative ne fait qu&apos;augmenter. Et avec les modèles vision et vocaux IA de 2026, automatiser cette paperasse devient enfin possible. C&apos;est exactement ce que Vertxia construit : une application qui transforme une photo de plaque signalétique et une commande vocale en BSFF officiel signé Ministère, en quelques secondes.
              </p>

              <p className="text-sm text-black/50 leading-relaxed mb-10">
                Je documente chaque ligne de code, chaque décision, chaque échec et chaque learning sur Instagram et LinkedIn. Build in public, sans filtre. Si tu aimes les marathons techniques en solo, suis le build.
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
              { label: "Intelligence", href: "#intelligence" },
              { label: "Cerveau", href: "#cerveau" },
              { label: "Terrain", href: "#terrain" },
              { label: "Documents", href: "#categories" },
              { label: "Démo", href: "#demo" },
              { label: "Beta", href: "#beta" },
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
          <span className="text-xs text-black/20">© 2026 Vertxia · Paperasse F-Gas automatisée · Built solo in public.</span>
        </div>
      </footer>
    </div>
  );
}
