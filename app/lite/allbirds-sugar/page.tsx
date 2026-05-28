/**
 * Vertxia Lite — POC site généré pour Allbirds collection Sugar.
 *
 * Pipeline qui a produit cette page :
 *   1. Scrape Allbirds → 30 produits (déjà fait, output/www.allbirds.com_scored.json)
 *   2. Prompt client simulé : "Site éditorial premium minimaliste, focus
 *      collection Sugar, ambiance contemplative lumineuse"
 *   3. Creative brief LLM (palette crème/sauge/orange, serif éditorial,
 *      structure hero / manifeste / collection)
 *   4. 2 vidéos Kling 2.0 image-to-video générées (~$1, ~10min)
 *   5. Cette page composée à partir du brief
 *
 * Vidéos servies depuis /lite/*.mp4 (copiées de output/vertxia-lite/
 * vers public/lite/ après génération).
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sugar — Allbirds | by Vertxia Lite",
  description:
    "La collection Sugar. Une mousse née d'un champ de canne à sucre. Pour vos pieds.",
};

const PRODUCTS = [
  {
    handle: "sugar-zeffers-lux-beige",
    title: "Sugar Zeffer 2",
    color: "Lux Beige",
    price: "24 €",
    video: "/lite/sugar-zeffer-beige.mp4",
    poster:
      "https://cdn.shopify.com/s/files/1/1104/4168/files/AB005UU_SHOE_LEFT_GLOBAL_MENS_SUGAR_ZEFFER_LUX_BEIGE.png?v=1776183979",
    note: "Sneaker minimaliste. Semelle SweetFoam™.",
  },
  {
    handle: "sugar-sliders-buoyant-orange",
    title: "Sugar Slider",
    color: "Buoyant Orange",
    price: "30 €",
    video: "/lite/sugar-slider-orange.mp4",
    poster:
      "https://cdn.shopify.com/s/files/1/1104/4168/files/AB0049U_SHOE_LEFT_GLOBAL_MENS_SUGAR_SLIDER_BUOYANT_ORANGE.png?v=1776804395",
    note: "Slide d'été. 100 % bio-sourcée.",
  },
];

export default function AllbirdsSugarLite() {
  return (
    <main
      className="min-h-screen antialiased"
      style={{
        background: "#F5F0E8",
        color: "#1A1A1A",
        // Serif éditorial pour titres via web-safe fallback + Google Fonts inline
        fontFamily:
          "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Google Fonts : Cormorant pour les titres éditoriaux */}
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin=""
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant:wght@300;400;500&family=Inter:wght@300;400;500&display=swap"
        rel="stylesheet"
      />

      {/* ────────── NAV ────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[#F5F0E8]/70 border-b border-[#1A1A1A]/[0.06]">
        <nav className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <span
            className="text-lg tracking-[0.15em] uppercase font-light"
            style={{ fontFamily: "'Cormorant', serif" }}
          >
            Allbirds
          </span>
          <div className="hidden md:flex gap-10 text-[12px] tracking-[0.2em] uppercase text-[#1A1A1A]/60">
            <a href="#manifeste" className="hover:text-[#1A1A1A]">Manifeste</a>
            <a href="#collection" className="hover:text-[#1A1A1A]">Collection</a>
            <a href="#" className="hover:text-[#1A1A1A]">Boutique</a>
          </div>
          <span className="text-[10px] tracking-[0.25em] uppercase text-[#9CAA8E] font-mono">
            Site généré par Vertxia
          </span>
        </nav>
      </header>

      {/* ────────── HERO ────────── */}
      <section className="relative min-h-screen flex flex-col justify-center px-8 pt-32 pb-20 overflow-hidden">
        {/* Vidéo hero plein écran */}
        <div className="absolute inset-0 z-0">
          <video
            src={PRODUCTS[0].video}
            poster={PRODUCTS[0].poster}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {/* Overlay subtil pour lisibilité du texte */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(245,240,232,0.4) 0%, rgba(245,240,232,0.1) 40%, rgba(245,240,232,0.85) 100%)",
            }}
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto w-full">
          <p
            className="text-[11px] tracking-[0.3em] uppercase mb-10 text-[#9CAA8E]"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            — Nouvelle collection · Sugar
          </p>
          <h1
            className="text-6xl md:text-8xl lg:text-9xl font-light leading-[0.95] tracking-tight mb-8"
            style={{ fontFamily: "'Cormorant', serif" }}
          >
            De la canne à<br />
            <em className="italic text-[#9CAA8E]">sucre</em>.<br />
            Pour vos pieds.
          </h1>
          <p className="text-base md:text-lg text-[#1A1A1A]/70 max-w-xl leading-relaxed mt-12">
            Une mousse née d'un champ. Le SweetFoam™ remplace le pétrole par
            la canne à sucre brésilienne. Confort identique. Empreinte
            divisée.
          </p>
          <div className="mt-14 flex items-center gap-6">
            <a
              href="#collection"
              className="inline-flex items-center justify-center px-9 py-3.5 bg-[#1A1A1A] text-[#F5F0E8] text-[11px] tracking-[0.25em] uppercase hover:bg-[#9CAA8E] transition-colors duration-500"
            >
              Voir la collection
            </a>
            <a
              href="#manifeste"
              className="text-[11px] tracking-[0.25em] uppercase text-[#1A1A1A]/60 hover:text-[#1A1A1A] underline underline-offset-4 decoration-1"
            >
              Lire le manifeste
            </a>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.3em] uppercase text-[#1A1A1A]/40 animate-pulse">
          ↓ Scroll
        </div>
      </section>

      {/* ────────── MANIFESTE ────────── */}
      <section
        id="manifeste"
        className="px-8 py-40 border-t border-[#1A1A1A]/[0.08]"
      >
        <div className="max-w-3xl mx-auto">
          <p
            className="text-[11px] tracking-[0.3em] uppercase mb-12 text-[#9CAA8E]"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            — Le matériau
          </p>
          <h2
            className="text-4xl md:text-6xl font-light leading-[1.1] tracking-tight mb-16"
            style={{ fontFamily: "'Cormorant', serif" }}
          >
            Une mousse née d'un champ.<br />
            <em className="italic text-[#1A1A1A]/50">Pas d'un baril.</em>
          </h2>
          <div className="space-y-7 text-lg md:text-xl text-[#1A1A1A]/75 leading-relaxed font-light">
            <p>
              Le SweetFoam™ est dérivé de la canne à sucre brésilienne. À
              chaque pousse, elle capte plus de CO₂ qu'elle n'en émet. Ce que
              nous en faisons n'est pas une chaussure légère. C'est une
              chaussure qui pèse moins sur le monde.
            </p>
            <p>
              Même densité que la mousse pétrochimique. Même rebond. Même
              durée. Ce que vous gagnez n'est pas un compromis — c'est un
              changement d'origine.
            </p>
          </div>
          <div className="mt-20 flex items-baseline gap-12 pt-12 border-t border-[#1A1A1A]/[0.08]">
            <div>
              <div
                className="text-5xl font-light tracking-tight"
                style={{ fontFamily: "'Cormorant', serif" }}
              >
                100<span className="text-2xl text-[#1A1A1A]/50">%</span>
              </div>
              <div className="text-[10px] tracking-[0.25em] uppercase text-[#1A1A1A]/50 mt-2">
                Bio-sourcé
              </div>
            </div>
            <div>
              <div
                className="text-5xl font-light tracking-tight"
                style={{ fontFamily: "'Cormorant', serif" }}
              >
                −94<span className="text-2xl text-[#1A1A1A]/50">%</span>
              </div>
              <div className="text-[10px] tracking-[0.25em] uppercase text-[#1A1A1A]/50 mt-2">
                D'émission CO₂
              </div>
            </div>
            <div>
              <div
                className="text-5xl font-light tracking-tight"
                style={{ fontFamily: "'Cormorant', serif" }}
              >
                0
              </div>
              <div className="text-[10px] tracking-[0.25em] uppercase text-[#1A1A1A]/50 mt-2">
                Goutte de pétrole
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────── COLLECTION ────────── */}
      <section
        id="collection"
        className="px-8 py-32 border-t border-[#1A1A1A]/[0.08]"
        style={{ background: "#EFE9DF" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-20 flex-wrap gap-8">
            <div>
              <p
                className="text-[11px] tracking-[0.3em] uppercase mb-6 text-[#9CAA8E]"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                — La collection
              </p>
              <h3
                className="text-4xl md:text-5xl font-light tracking-tight"
                style={{ fontFamily: "'Cormorant', serif" }}
              >
                Sugar.<br />
                <em className="italic text-[#9CAA8E]">Deux silhouettes.</em>
              </h3>
            </div>
            <p className="max-w-md text-base text-[#1A1A1A]/60 leading-relaxed">
              La sneaker pour la ville. La slide pour les jours longs. Toutes
              deux conçues à partir de la même matière brute. Toutes deux
              destinées à disparaître proprement.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {PRODUCTS.map((p) => (
              <article
                key={p.handle}
                className="group"
              >
                <div
                  className="relative aspect-[4/5] mb-6 overflow-hidden bg-[#F5F0E8]"
                >
                  <video
                    src={p.video}
                    poster={p.poster}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                  />
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <h4
                      className="text-2xl md:text-3xl font-light tracking-tight"
                      style={{ fontFamily: "'Cormorant', serif" }}
                    >
                      {p.title}
                    </h4>
                    <p className="text-[11px] tracking-[0.25em] uppercase text-[#1A1A1A]/50 mt-1">
                      {p.color}
                    </p>
                  </div>
                  <div
                    className="text-xl font-light"
                    style={{ fontFamily: "'Cormorant', serif" }}
                  >
                    {p.price}
                  </div>
                </div>
                <p className="text-sm text-[#1A1A1A]/60 mt-4 leading-relaxed">
                  {p.note}
                </p>
                <a
                  href="#"
                  className="inline-flex items-center mt-6 text-[10px] tracking-[0.3em] uppercase text-[#1A1A1A] border-b border-[#1A1A1A]/30 pb-1 hover:border-[#1A1A1A] transition-colors"
                >
                  Découvrir →
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ────────── FOOTER ────────── */}
      <footer
        className="px-8 py-20 border-t border-[#1A1A1A]/[0.08]"
        style={{ background: "#1A1A1A", color: "#F5F0E8" }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div>
            <p
              className="text-3xl font-light leading-[1.1] mb-4 max-w-md"
              style={{ fontFamily: "'Cormorant', serif" }}
            >
              <em className="italic">Naturellement,</em> pour longtemps.
            </p>
            <p className="text-[10px] tracking-[0.3em] uppercase opacity-50">
              Allbirds · Collection Sugar
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <p className="text-[10px] tracking-[0.3em] uppercase opacity-40">
              Site démo généré par
            </p>
            <a
              href="/v3"
              className="text-2xl tracking-[0.15em] uppercase font-light hover:text-[#9CAA8E] transition-colors"
              style={{ fontFamily: "'Cormorant', serif" }}
            >
              Vertxia Lite
            </a>
            <p className="text-[10px] opacity-40 mt-2 max-w-sm text-right leading-relaxed">
              Pipeline auto : Shopify → brief créatif IA → vidéos cinematic
              Kling → site unique. Coût total : ~$1.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
