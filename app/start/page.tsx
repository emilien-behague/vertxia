"use client";

/**
 * Page /start — Présentation guidée du flow mobile Vertxia.
 *
 * Cible : frigoristes / climaticiens qui arrivent via lien WhatsApp/SMS/mail.
 * Objectif : en 30s comprendre ce que fait l'appli + cliquer sur "OUVRIR L'APPLI" → /m.
 *
 * URL à partager pour démos rapides et verbatims.
 * Pas d'inscription, pas de friction, direct au but.
 */

import Link from "next/link";
import { MotionProvider, FadeInUp } from "@/components/motion-primitives";

const STEPS = [
  {
    n: "01",
    title: "Photo de la plaque",
    desc: "Tu prends une photo de la plaque signalétique. L'IA lit le modèle, le n° de série, le fluide et la charge. Aucune saisie manuelle.",
    mockup: "PHOTO",
  },
  {
    n: "02",
    title: "Saisie guidée à la voix",
    desc: "Type d'intervention, fuites, fluide récupéré. Tu dictes, l'appli remplit. Champs administratifs CERFA pré-remplis depuis l'équipement.",
    mockup: "VOIX",
  },
  {
    n: "03",
    title: "Signature client",
    desc: "Le client signe directement sur ton écran. Pas de papier, pas d'impression, pas de scanner.",
    mockup: "SIGN",
  },
  {
    n: "04",
    title: "CERFA + BSFF auto",
    desc: "L'appli génère le CERFA 15497*04, le BSFF officiel via TrackDéchets, et une étiquette QR à coller sur l'unité. PDF prêts, envoyés au client par email.",
    mockup: "DOCS",
  },
] as const;

function MockupCard({ kind }: { kind: string }) {
  const icons = {
    PHOTO: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
    VOIX: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
    SIGN: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l6-6 3 3 7-7" />
        <path d="M3 21h18" />
      </svg>
    ),
    DOCS: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="13" x2="15" y2="13" />
        <line x1="9" y1="17" x2="15" y2="17" />
      </svg>
    ),
  } as const;

  return (
    <div className="relative w-full aspect-[3/4] max-w-[180px] mx-auto rounded-[28px] border-[7px] border-[#111] bg-[#F5F4F0] overflow-hidden shadow-[0_20px_50px_-20px_rgba(0,0,0,0.25)]">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-[#111] rounded-b-2xl" />
      <div className="absolute inset-0 flex items-center justify-center text-[#111]">
        {icons[kind as keyof typeof icons]}
      </div>
    </div>
  );
}

export default function StartPage() {
  return (
    <MotionProvider>
      <div className="min-h-screen bg-[#F5F4F0] text-[#111] antialiased">
        {/* Header */}
        <header
          className="sticky top-0 z-30 bg-[#F5F4F0]/85 backdrop-blur-xl border-b border-black/[0.04]"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="max-w-md mx-auto h-12 flex items-center justify-between px-5">
            <Link href="/" className="font-mono text-[11px] tracking-[0.25em] text-black/60 hover:text-black transition-colors">
              VERTXIA
            </Link>
            <Link
              href="/m"
              className="text-[12px] font-medium text-[#A16207] hover:text-[#7c4a06] transition-colors"
            >
              Ouvrir l&apos;appli →
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="max-w-md mx-auto px-6 pt-12 pb-10">
          <FadeInUp>
            <p className="text-[11px] tracking-[0.25em] text-black/40 uppercase mb-4">
              · L&apos;appli, en deux minutes
            </p>
          </FadeInUp>
          <FadeInUp delay={0.08}>
            <h1 className="text-[40px] font-light leading-[1.05] tracking-tight text-[#111] mb-6">
              Ton intervention F-Gas.
              <br />
              <span className="text-black/40">Du scan plaque au BSFF, sur ton iPhone.</span>
            </h1>
          </FadeInUp>
          <FadeInUp delay={0.16}>
            <p className="text-[15px] text-black/55 leading-relaxed">
              L&apos;appli te guide à chaque étape : photo de la plaque pour pré-remplir l&apos;équipement, saisie vocale pour l&apos;intervention, signature client à l&apos;écran. À la fin, CERFA 15497*04, BSFF officiel TrackDéchets et étiquette QR générés automatiquement.
            </p>
          </FadeInUp>
        </section>

        {/* Étapes */}
        <section className="max-w-md mx-auto px-6 pb-10">
          <FadeInUp>
            <div className="text-[10px] tracking-[0.25em] text-black/40 uppercase font-mono mb-6">
              · Comment ça marche
            </div>
          </FadeInUp>

          <div className="space-y-12">
            {STEPS.map((step, i) => (
              <FadeInUp key={step.n} delay={i * 0.08}>
                <div className="grid grid-cols-[1fr_140px] gap-5 items-start">
                  <div>
                    <div className="font-mono text-[10px] tracking-[0.2em] text-[#A16207] mb-2">
                      ÉTAPE {step.n}
                    </div>
                    <h2 className="text-[22px] font-light leading-tight mb-3 text-[#111]">
                      {step.title}
                    </h2>
                    <p className="text-[13.5px] text-black/55 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                  <div className="pt-4">
                    <MockupCard kind={step.mockup} />
                  </div>
                </div>
              </FadeInUp>
            ))}
          </div>
        </section>

        {/* Ce qui sort */}
        <section className="max-w-md mx-auto px-6 py-10">
          <FadeInUp>
            <div className="text-[10px] tracking-[0.25em] text-black/40 uppercase font-mono mb-4">
              · Ce que tu repars avec
            </div>
          </FadeInUp>
          <FadeInUp delay={0.06}>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: "CERFA 15497*04", tag: "Officiel" },
                { name: "BSFF signé", tag: "TrackDéchets" },
                { name: "Étiquette QR", tag: "Sur l’unité" },
                { name: "Historique 10 ans", tag: "Auto-classé" },
              ].map((doc) => (
                <div
                  key={doc.name}
                  className="rounded-2xl border border-black/[0.07] bg-white p-4"
                >
                  <div className="text-[14px] font-medium text-[#111]">{doc.name}</div>
                  <div className="text-[10px] tracking-widest uppercase text-black/35 font-mono mt-1">{doc.tag}</div>
                </div>
              ))}
            </div>
          </FadeInUp>
        </section>

        {/* CTA principal */}
        <section className="max-w-md mx-auto px-6 pt-10 pb-6">
          <FadeInUp>
            <div className="rounded-3xl bg-[#111] text-white p-7 text-center">
              <div className="text-[10px] tracking-[0.25em] text-white/45 uppercase font-mono mb-3">
                · Démo sandbox · aucune inscription
              </div>
              <h2 className="text-[26px] font-light leading-tight mb-3">
                Teste-la depuis ton iPhone maintenant.
              </h2>
              <p className="text-[13px] text-white/55 leading-relaxed mb-7">
                L&apos;appli s&apos;installe sur ton écran d&apos;accueil. Pas de compte, pas d&apos;engagement. Les données restent sur ton téléphone.
              </p>
              <Link
                href="/m"
                className="inline-flex items-center justify-center gap-2 w-full px-8 py-4 bg-white text-[#111] text-[14px] rounded-2xl tracking-widest font-medium active:opacity-80 transition-opacity"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                OUVRIR L&apos;APPLI
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7" />
                  <polyline points="7 7 17 7 17 17" />
                </svg>
              </Link>
              <p className="mt-5 text-[10px] tracking-widest uppercase font-mono text-white/35">
                Compatible iPhone & Android
              </p>
            </div>
          </FadeInUp>
        </section>

        {/* Soupape — contact direct */}
        <section className="max-w-md mx-auto px-6 pb-16">
          <FadeInUp delay={0.05}>
            <div className="text-center">
              <p className="text-[13px] text-black/55 leading-relaxed mb-4">
                Tu préfères qu&apos;on en parle de vive voix ? Je prends 15 min pour te montrer.
              </p>
              <a
                href="mailto:emilien@vertxia.com?subject=Vertxia — j'aimerais en parler&body=Salut Emilien,%0D%0A%0D%0AJ'ai vu Vertxia et j'aimerais qu'on en parle.%0D%0A%0D%0AMoi : (frigoriste / climaticien / installateur PAC)%0D%0ARégion : %0D%0AIntervention F-Gas / mois : %0D%0A%0D%0ATéléphone : "
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-black/15 bg-white text-[13px] text-[#111] hover:border-black/30 transition-colors"
              >
                emilien@vertxia.com
              </a>
              <p className="mt-3 text-[10px] tracking-widest uppercase font-mono text-black/30">
                Réponse sous 24h · Emilien, fondateur
              </p>
            </div>
          </FadeInUp>
        </section>

        {/* Footer mini */}
        <footer className="border-t border-black/[0.06] py-6">
          <div className="max-w-md mx-auto px-6 flex items-center justify-between text-[10px] tracking-widest font-mono text-black/30 uppercase">
            <Link href="/" className="hover:text-black/60 transition-colors">
              ← Site
            </Link>
            <span>© 2026 Vertxia</span>
          </div>
        </footer>
      </div>
    </MotionProvider>
  );
}
