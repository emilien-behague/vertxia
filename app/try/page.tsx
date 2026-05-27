"use client";

/**
 * Page /try — démo interactive Vertxia.
 *
 * MVP Phase 1a (27/05/2026) : scraping Shopify live + display produits + CTA waitlist.
 * Pas de génération 3D dans cette phase (5-6 min de pipeline, demande Phase 1b).
 *
 * Flow utilisateur :
 *   1. Colle URL Shopify
 *   2. ~3-5s : scraping live via /api/scrape
 *   3. Affichage : boutique détectée, vendor, count, 5 premiers produits
 *   4. CTA "Je veux ce site pour ma boutique" → form email mailto
 */

import { useState } from "react";
import Link from "next/link";

type Product = {
  id: number;
  title: string;
  handle: string;
  image: string | null;
  price: string | null;
  url: string;
};

type ScrapeResult = {
  shop: string;
  vendor: string;
  count: number;
  products: Product[];
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; data: ScrapeResult }
  | { kind: "error"; message: string };

export default function TryPage() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === "loading") return;
    if (!url || url.length < 5) return;

    setState({ kind: "loading" });

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
        setState({ kind: "error", message: err.error || `HTTP ${res.status}` });
        return;
      }

      const data: ScrapeResult = await res.json();
      setState({ kind: "result", data });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur réseau",
      });
    }
  }

  function reset() {
    setState({ kind: "idle" });
    setUrl("");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top nav */}
      <nav className="fixed top-0 inset-x-0 z-50 flex justify-between items-center p-6 md:p-10 bg-black/40 backdrop-blur-sm">
        <Link
          href="/"
          className="font-mono text-[10px] md:text-xs tracking-[0.3em] text-white/60 hover:text-white transition"
        >
          ← VERTXIA
        </Link>
        <span className="font-mono text-[10px] md:text-xs tracking-[0.3em] text-white/40">
          DÉMO LIVE
        </span>
      </nav>

      {/* Hero + input */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
        <div className="max-w-2xl w-full text-center">
          <span className="font-mono text-[10px] md:text-xs tracking-[0.4em] text-white/40 block mb-6">
            ESSAYE MAINTENANT
          </span>

          <h1 className="text-4xl md:text-6xl font-light tracking-tighter leading-[1.05] mb-6">
            Colle ton URL Shopify.
            <br />
            <span className="text-white/60 italic">On te montre ton site 3D.</span>
          </h1>

          <p className="text-white/50 text-sm md:text-base max-w-md mx-auto mb-10">
            Scraping en direct. Aperçu des produits. Demande de génération en
            5 minutes.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto">
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://ta-boutique.myshopify.com"
                disabled={state.kind === "loading"}
                className="flex-1 px-5 py-4 bg-white/5 border border-white/10 rounded-lg font-mono text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40 transition disabled:opacity-50"
                autoFocus
              />
              <button
                type="submit"
                disabled={state.kind === "loading" || url.length < 5}
                className="px-8 py-4 bg-white text-black font-mono text-xs tracking-[0.3em] rounded-lg hover:bg-white/90 transition disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {state.kind === "loading" ? "ANALYSE..." : "GÉNÉRER →"}
              </button>
            </div>

            <p className="mt-4 font-mono text-[10px] tracking-widest text-white/30">
              EXEMPLES : loom.fr · allbirds.com · tikamoon.fr · buu-koff-2.myshopify.com
            </p>
          </form>
        </div>

        {/* Loading state */}
        {state.kind === "loading" && (
          <div className="mt-16 flex flex-col items-center gap-4 animate-pulse">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border border-white/10" />
              <div className="absolute inset-0 rounded-full border border-t-white/70 border-r-white/20 border-b-transparent border-l-transparent animate-spin" />
            </div>
            <span className="font-mono text-[10px] tracking-[0.4em] text-white/50">
              SCRAPING DE TA BOUTIQUE
            </span>
          </div>
        )}

        {/* Error state */}
        {state.kind === "error" && (
          <div className="mt-12 max-w-md w-full text-center">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-5">
              <div className="font-mono text-[10px] tracking-[0.4em] text-red-400 mb-2">
                ERREUR
              </div>
              <div className="text-white/80 text-sm">{state.message}</div>
            </div>
            <button
              onClick={reset}
              className="mt-4 font-mono text-[10px] tracking-[0.3em] text-white/40 hover:text-white/80 transition"
            >
              ← ESSAYER UNE AUTRE URL
            </button>
          </div>
        )}
      </section>

      {/* Result state */}
      {state.kind === "result" && (
        <section className="px-6 pb-32 max-w-5xl mx-auto">
          <div className="mb-12 text-center">
            <span className="font-mono text-[10px] md:text-xs tracking-[0.4em] text-emerald-400 block mb-3">
              ✓ BOUTIQUE DÉTECTÉE
            </span>
            <h2 className="text-2xl md:text-4xl font-light tracking-tight mb-3">
              {state.data.vendor}
            </h2>
            <p className="text-white/40 font-mono text-xs tracking-widest">
              {state.data.shop} · {state.data.count} produits analysés
            </p>
          </div>

          {/* Produits grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-16">
            {state.data.products.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block aspect-square rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden hover:border-white/30 transition"
              >
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image}
                    alt={p.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs">
                    Pas d&apos;image
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/60 to-transparent">
                  <div className="font-mono text-[9px] tracking-widest text-white/60 truncate">
                    {p.title}
                  </div>
                  {p.price && (
                    <div className="font-mono text-[10px] text-white/90 mt-0.5">
                      {p.price} €
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>

          {/* Aperçu site 3D : lien vers Jiraya en exemple */}
          <div className="text-center mb-16">
            <span className="font-mono text-[10px] md:text-xs tracking-[0.4em] text-white/40 block mb-4">
              VOILÀ À QUOI RESSEMBLERA TON SITE
            </span>
            <Link
              href="/preview/jiraya"
              className="inline-block px-8 py-3 border border-white/30 text-white font-mono text-xs tracking-[0.3em] hover:bg-white hover:text-black transition rounded"
            >
              VOIR UN EXEMPLE 3D →
            </Link>
          </div>

          {/* CTA waitlist */}
          <div className="max-w-md mx-auto bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 rounded-2xl p-8 text-center">
            <span className="font-mono text-[10px] tracking-[0.4em] text-white/40 block mb-4">
              GÉNÈRE MON SITE
            </span>
            <h3 className="text-xl md:text-2xl font-light tracking-tight mb-3">
              On te le construit en 5 minutes.
            </h3>
            <p className="text-white/50 text-sm mb-6">
              Real-ESRGAN AI · Meshy-6 · React Three Fiber. On t&apos;envoie le
              lien dès que c&apos;est prêt.
            </p>
            <a
              href={`mailto:emilien@vertxia.com?subject=Génération%20site%203D%20pour%20${encodeURIComponent(
                state.data.shop
              )}&body=Salut%20Emilien,%0A%0AJe%20veux%20mon%20site%203D%20Vertxia%20pour%20:%0A${encodeURIComponent(
                state.data.shop
              )}%0A%0AVoilà%20mon%20email%20pour%20recevoir%20le%20lien%20:%0A%5BMETS%20TON%20EMAIL%20ICI%5D%0A%0AMerci%20!`}
              className="inline-block px-8 py-3 bg-white text-black font-mono text-xs tracking-[0.3em] rounded hover:bg-white/90 transition"
            >
              JE VEUX MON SITE 3D →
            </a>
            <p className="mt-4 text-white/30 font-mono text-[9px] tracking-widest">
              Réponse sous 24h · build in public
            </p>
          </div>

          {/* Reset */}
          <div className="text-center mt-12">
            <button
              onClick={reset}
              className="font-mono text-[10px] tracking-[0.3em] text-white/30 hover:text-white/70 transition"
            >
              ← TESTER UNE AUTRE BOUTIQUE
            </button>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-white/10 p-8 text-center">
        <span className="font-mono text-[10px] tracking-[0.4em] text-white/30">
          VERTXIA · BUILD IN PUBLIC · 2026
        </span>
      </footer>
    </div>
  );
}
