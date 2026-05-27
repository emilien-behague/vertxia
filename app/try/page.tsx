"use client";

/**
 * Page /try — démo interactive Vertxia avec génération 3D live.
 *
 * Phase 1b (27/05/2026 nuit) : génération 3D réelle via Replicate + Meshy
 * chaînés. Polling côté client pour éviter les timeouts Vercel.
 *
 * Flow utilisateur :
 *   1. Colle URL Shopify
 *   2. ~3-5s scraping live via /api/scrape
 *   3. Affiche produits + bouton "Générer mon site 3D"
 *   4. Clic -> orchestration :
 *      a. /api/upscale/start (Real-ESRGAN si petite source)
 *      b. Poll /api/upscale/status jusqu'à succeeded (15-30s)
 *      c. /api/mesh/start (Meshy image-to-3D)
 *      d. Poll /api/mesh/status jusqu'à SUCCEEDED (3-4 min)
 *   5. Rendu 3D inline dans la page (Canvas R3F)
 */

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, useGLTF, OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { CinematicEffects } from "@/components/cinematic-effects";
import { AnimatedSphere } from "@/components/animated-sphere";

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

type GenStep =
  | "upscale_start"
  | "upscale_poll"
  | "mesh_start"
  | "mesh_poll"
  | "optimize"
  | "done"
  | "error";

type State =
  | { kind: "idle" }
  | { kind: "scraping" }
  | { kind: "result"; data: ScrapeResult }
  | {
      kind: "generating";
      data: ScrapeResult;
      product: Product;
      step: GenStep;
      progress: number;
      message: string;
      glbUrl?: string;             // URL Meshy brute (download)
      optimizedBlobUrl?: string;   // blob URL local après /api/optimize-glb (viewer inline)
      error?: string;
      fallbackReason?: string;     // raison du fallback si Blob upload echoue
    }
  | { kind: "error"; message: string };

// ─── Helper : sleep async ────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Viewer 3D inline pour le GLB compressé ──────────────────────────────────
function GeneratedModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.4;
    }
  });

  return (
    <group ref={groupRef} scale={1.5} position={[0, -0.9, 0]}>
      <primitive object={scene} />
    </group>
  );
}

function GeneratedViewer({ url }: { url: string }) {
  return (
    <div className="relative w-full aspect-square md:aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-white/10">
      <Canvas
        camera={{ position: [3, 1.2, 6], fov: 28 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <Suspense
          fallback={
            <Html center>
              <span className="font-mono text-[10px] tracking-widest text-white/40">
                LOADING GLB…
              </span>
            </Html>
          }
        >
          <color attach="background" args={["#0c0a07"]} />
          <fog attach="fog" args={["#0c0a07", 8, 22]} />
          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 8, 5]} intensity={1.1} color="#ffd9a3" />
          <pointLight position={[-4, 3, -4]} intensity={1.2} color="#a855f7" />
          <pointLight position={[4, 5, -3]} intensity={0.6} color="#22d3ee" />
          <GeneratedModel url={url} />
          <Environment
            files="/hdri/studio_small_03_2k.hdr"
            environmentIntensity={0.6}
            background={false}
          />
          <CinematicEffects bloom={0.3} vignette={0.3} saturation={0.05} contrast={0.03} />
          <OrbitControls enablePan={false} enableZoom={true} minDistance={3} maxDistance={12} />
        </Suspense>
      </Canvas>
      <div className="absolute top-3 left-3 font-mono text-[9px] tracking-widest text-white/50 pointer-events-none">
        DRAG · ZOOM
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function TryPage() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  // Ref pour éviter les setState après navigation (cleanup)
  // Reset au mount : sur React 19 / Strict Mode, le component peut mount/unmount/remount,
  // si on ne reset pas, aborted.current reste true et tous les setState sont skippés.
  const aborted = useRef(false);
  useEffect(() => {
    aborted.current = false;
    return () => {
      aborted.current = true;
    };
  }, []);

  // Auto-scroll vers la section results quand le scraping est terminé ou
  // vers la section generating. Sans ça, l'utilisateur reste en haut et
  // ne voit pas que le résultat est apparu plus bas.
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.kind === "result" || state.kind === "generating") {
      // Smooth scroll vers le bas après le rendu
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [state.kind]);

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === "scraping" || state.kind === "generating") return;
    if (!url || url.length < 5) return;

    setState({ kind: "scraping" });

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

  async function handleGenerate(product: Product) {
    if (state.kind !== "result") return;
    if (!product.image) {
      alert("Produit sans image, impossible de générer.");
      return;
    }
    const scrapeData = state.data;

    // ─── STEP 0 : Vérifier le quota quotidien AVANT de payer Replicate/Meshy ──
    // Si on est au cap, on stoppe net avant de cramer 1€ de crédit pour rien.
    try {
      const quotaRes = await fetch("/api/check-quota");
      if (quotaRes.ok) {
        const quota = await quotaRes.json();
        if (!quota.allowed) {
          setState({
            kind: "error",
            message:
              quota.message ||
              "Vertxia est complet pour aujourd'hui. Reviens demain.",
          });
          return;
        }
      }
      // Si quotaRes pas ok, on ferme les yeux et on continue (fail-open).
    } catch {
      // Réseau down, on continue.
    }

    setState({
      kind: "generating",
      data: scrapeData,
      product,
      step: "upscale_start",
      progress: 0,
      message: "Préparation de l'image source…",
    });

    try {
      // ─── STEP 1 : Upscale (Real-ESRGAN si nécessaire) ─────────────────────
      const upscaleRes = await fetch("/api/upscale/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: product.image }),
      });
      if (!upscaleRes.ok) {
        const err = await upscaleRes.json().catch(() => ({}));
        throw new Error(`Upscale ${err.error || upscaleRes.status}`);
      }
      const upscaleData = await upscaleRes.json();

      let upscaledImageUrl: string;
      if (upscaleData.skipped) {
        // Source déjà sharp, on passe direct à Meshy
        upscaledImageUrl = upscaleData.output;
      } else {
        // Poll Replicate
        const predictionId = upscaleData.predictionId;
        if (!predictionId) throw new Error("Pas de predictionId Replicate");
        if (aborted.current) return;
        setState((s) =>
          s.kind === "generating"
            ? { ...s, step: "upscale_poll", progress: 10, message: "AI upscale en cours (Real-ESRGAN)…" }
            : s
        );

        let output: string | null = null;
        const tStart = Date.now();
        while (!output && Date.now() - tStart < 120_000) {
          await sleep(3000);
          if (aborted.current) return;
          const r = await fetch(`/api/upscale/status?id=${predictionId}`);
          const d = await r.json();
          if (d.status === "succeeded" && d.output) {
            output = d.output;
            break;
          }
          if (d.status === "failed" || d.status === "canceled") {
            throw new Error(`Upscale ${d.status} : ${d.error || "inconnu"}`);
          }
          const elapsed = (Date.now() - tStart) / 1000;
          setState((s) =>
            s.kind === "generating"
              ? { ...s, progress: Math.min(10 + (elapsed / 30) * 20, 30) }
              : s
          );
        }
        if (!output) throw new Error("Upscale timeout 120s");
        upscaledImageUrl = output;
      }

      // ─── STEP 2 : Meshy image-to-3D ───────────────────────────────────────
      if (aborted.current) return;
      setState((s) =>
        s.kind === "generating"
          ? { ...s, step: "mesh_start", progress: 30, message: "Génération du mesh 3D (Meshy-6 UHQ)…" }
          : s
      );
      const meshRes = await fetch("/api/mesh/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: upscaledImageUrl }),
      });
      if (!meshRes.ok) {
        const err = await meshRes.json().catch(() => ({}));
        // Cas spécifique : Meshy a refusé pour cause de file pleine.
        // On préfixe avec "QUEUE:" pour que le rendu d'erreur sache afficher
        // un message d'attente bleu plutôt qu'une erreur rouge.
        if (err.error === "queue_full") {
          throw new Error(
            `QUEUE:${err.message || "File Meshy pleine, ressaye dans 3-5 min."}`
          );
        }
        throw new Error(`Meshy ${err.error || meshRes.status}`);
      }
      const meshData = await meshRes.json();
      const taskId = meshData.taskId;
      if (!taskId) throw new Error("Pas de taskId Meshy");

      // Poll Meshy
      if (aborted.current) return;
      setState((s) =>
        s.kind === "generating"
          ? { ...s, step: "mesh_poll", progress: 35, message: "Sculpture du mesh 3D (peut prendre 2-4 min)…" }
          : s
      );

      let glbUrl: string | null = null;
      const tMeshStart = Date.now();
      while (!glbUrl && Date.now() - tMeshStart < 360_000) {
        await sleep(5000);
        if (aborted.current) return;
        const r = await fetch(`/api/mesh/status?id=${taskId}`);
        const d = await r.json();
        if (d.status === "SUCCEEDED" && d.modelUrls?.glb) {
          glbUrl = d.modelUrls.glb;
          break;
        }
        if (d.status === "FAILED" || d.status === "EXPIRED") {
          throw new Error(`Meshy ${d.status} : ${d.error || "inconnu"}`);
        }
        const meshyProgress = typeof d.progress === "number" ? d.progress : 0;
        // 30-95% : période Meshy
        const mapped = 35 + (meshyProgress / 100) * 60;
        setState((s) =>
          s.kind === "generating"
            ? {
                ...s,
                progress: Math.min(mapped, 95),
                message: `Sculpture du mesh 3D (${meshyProgress}%, peut prendre 2-4 min)…`,
              }
            : s
        );
      }
      if (!glbUrl) throw new Error("Meshy timeout 6 min");

      // ─── STEP 3 : Optimize + persiste sur Vercel Blob ─────────────────────
      if (aborted.current) return;
      setState((s) =>
        s.kind === "generating"
          ? {
              ...s,
              step: "optimize",
              progress: 95,
              message: "Compression + sauvegarde de ta démo (10-30s)…",
              glbUrl: glbUrl || undefined,
            }
          : s
      );

      let demoData: { id: string; url: string } | null = null;
      let fallbackReason: string | undefined;
      try {
        const optRes = await fetch("/api/optimize-glb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ glbUrl }),
        });
        if (!optRes.ok) {
          const errData = await optRes.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${optRes.status}`);
        }
        const json = await optRes.json();
        if (json.ok && json.id && json.url) {
          demoData = { id: json.id, url: json.url };
        } else {
          throw new Error(
            `Réponse Blob incomplète : ${JSON.stringify(json).slice(0, 200)}`
          );
        }
      } catch (err) {
        // Si l'optimisation/upload échoue, on tombe en fallback download-only.
        // On capture la raison pour l'afficher dans l'UI — sinon le user voit
        // "fallback" sans comprendre pourquoi.
        fallbackReason = err instanceof Error ? err.message : String(err);
        console.warn("[optimize-glb] failed :", fallbackReason);
      }

      // ─── STEP 4 : Redirect vers la démo persistante OU fallback ───────────
      if (aborted.current) return;

      if (demoData) {
        // Démo persistée — on redirige vers l'URL publique partageable
        const params = new URLSearchParams({
          u: demoData.url,
          shop: scrapeData.shop,
          vendor: scrapeData.vendor,
          product: product.title,
          image: product.image || "",
        });
        window.location.href = `/demo/${demoData.id}?${params.toString()}`;
        return; // page is leaving, don't update state
      }

      // Fallback : Blob a échoué — on garde l'ancien comportement download-only
      setState((s) =>
        s.kind === "generating"
          ? {
              ...s,
              step: "done",
              progress: 100,
              message: "Prêt (mode fallback, démo non persistée).",
              glbUrl: glbUrl || undefined,
              fallbackReason,
            }
          : s
      );
    } catch (err) {
      if (aborted.current) return;
      setState((s) =>
        s.kind === "generating"
          ? {
              ...s,
              step: "error",
              error: err instanceof Error ? err.message : String(err),
            }
          : s
      );
    }
  }

  function reset() {
    setState({ kind: "idle" });
    setUrl("");
  }

  return (
    <div className="relative min-h-screen bg-black text-white overflow-x-hidden">
      {/* Orbe ASCII rotative en arrière-plan — variant light pour fond noir */}
      <div
        className="fixed right-[-120px] md:right-[-150px] top-1/2 -translate-y-1/2 w-[420px] h-[420px] md:w-[750px] md:h-[750px] lg:w-[900px] lg:h-[900px] pointer-events-none opacity-40 md:opacity-55 z-0"
        aria-hidden="true"
      >
        <AnimatedSphere variant="light" />
      </div>

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
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-24">
        <div className="max-w-2xl w-full text-center">
          <span className="font-mono text-[10px] md:text-xs tracking-[0.4em] text-white/40 block mb-6">
            ESSAYE MAINTENANT
          </span>

          <h1 className="text-4xl md:text-6xl font-light tracking-tighter leading-[1.05] mb-6">
            Colle ton URL Shopify.
            <br />
            <span className="text-white/60 italic">On génère ton 3D en live.</span>
          </h1>

          <p className="text-white/50 text-sm md:text-base max-w-md mx-auto mb-10">
            Scraping en direct. Real-ESRGAN AI upscale. Meshy-6 image-to-3D. Affiché dans le navigateur dès la fin.
          </p>

          <form onSubmit={handleScrape} className="w-full max-w-xl mx-auto">
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://ta-boutique.myshopify.com"
                disabled={state.kind === "scraping" || state.kind === "generating"}
                className="flex-1 px-5 py-4 bg-white/5 border border-white/10 rounded-lg font-mono text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40 transition disabled:opacity-50"
                autoFocus
              />
              <button
                type="submit"
                disabled={
                  state.kind === "scraping" ||
                  state.kind === "generating" ||
                  url.length < 5
                }
                className="px-8 py-4 bg-white text-black font-mono text-xs tracking-[0.3em] rounded-lg hover:bg-white/90 transition disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {state.kind === "scraping" ? "ANALYSE…" : "ANALYSER →"}
              </button>
            </div>

            <p className="mt-4 font-mono text-[10px] tracking-widest text-white/30">
              EXEMPLES : loom.fr · allbirds.com · tikamoon.fr · buu-koff-2.myshopify.com
            </p>
          </form>
        </div>

        {state.kind === "scraping" && (
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

        {state.kind === "error" && (
          <div className="mt-12 max-w-md w-full text-center">
            {/* Refus quota quotidien : ton amber/jaune ("complet") plutôt que rouge erreur */}
            {state.message.toLowerCase().includes("complet pour aujourd") ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-5">
                <div className="font-mono text-[10px] tracking-[0.4em] text-amber-400 mb-2">
                  ⏳ COMPLET POUR AUJOURD&apos;HUI
                </div>
                <div className="text-white/80 text-sm">{state.message}</div>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-5">
                <div className="font-mono text-[10px] tracking-[0.4em] text-red-400 mb-2">
                  ERREUR
                </div>
                <div className="text-white/80 text-sm">{state.message}</div>
              </div>
            )}
            <button
              onClick={reset}
              className="mt-4 font-mono text-[10px] tracking-[0.3em] text-white/40 hover:text-white/80 transition"
            >
              ← ESSAYER UNE AUTRE URL
            </button>
          </div>
        )}
      </section>

      {/* Result state — choix du produit à générer */}
      {state.kind === "result" && (
        <section ref={resultRef} className="relative z-10 px-6 pb-32 max-w-5xl mx-auto pt-12">
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

          <p className="text-center text-white/60 text-sm mb-6">
            Clique sur un produit pour générer son site 3D en live
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-16">
            {state.data.products.map((p) => (
              <button
                key={p.id}
                onClick={() => handleGenerate(p)}
                disabled={!p.image}
                className="group relative block aspect-square rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden hover:border-white/50 transition disabled:opacity-30 disabled:cursor-not-allowed text-left"
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
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40">
                  <span className="font-mono text-[10px] tracking-[0.3em] text-white px-3 py-1.5 border border-white/40 rounded">
                    GÉNÉRER 3D →
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={reset}
              className="font-mono text-[10px] tracking-[0.3em] text-white/30 hover:text-white/70 transition"
            >
              ← TESTER UNE AUTRE BOUTIQUE
            </button>
          </div>
        </section>
      )}

      {/* Generating state — progress + (à la fin) viewer 3D */}
      {state.kind === "generating" && (
        <section ref={resultRef} className="relative z-10 px-6 pb-32 max-w-4xl mx-auto pt-12">
          <div className="mb-8 text-center">
            <span className="font-mono text-[10px] md:text-xs tracking-[0.4em] text-white/40 block mb-3">
              GÉNÉRATION 3D EN COURS
            </span>
            <h2 className="text-xl md:text-3xl font-light tracking-tight">
              {state.product.title}
            </h2>
          </div>

          {/* Progress bar */}
          <div className="max-w-xl mx-auto mb-6">
            <div className="h-1 w-full bg-white/10 rounded overflow-hidden">
              <div
                className="h-full bg-white/80 transition-all duration-500"
                style={{ width: `${state.progress}%` }}
              />
            </div>
            <div className="mt-3 flex justify-between font-mono text-[10px] tracking-widest text-white/50">
              <span>{state.message}</span>
              <span>{Math.round(state.progress)}%</span>
            </div>
          </div>

          {/* Steps overview */}
          <div className="max-w-2xl mx-auto mb-12 grid grid-cols-5 gap-2 text-center">
            {[
              { id: "scrape", label: "Scraping" },
              { id: "upscale", label: "AI Upscale" },
              { id: "mesh", label: "Meshy 3D" },
              { id: "optim", label: "Optim." },
              { id: "render", label: "Rendu" },
            ].map((s, i) => {
              let active = false;
              let done = false;
              if (s.id === "scrape") done = true;
              if (s.id === "upscale") {
                active =
                  state.step === "upscale_start" || state.step === "upscale_poll";
                done = state.step !== "upscale_start" && state.step !== "upscale_poll";
              }
              if (s.id === "mesh") {
                active = state.step === "mesh_start" || state.step === "mesh_poll";
                done =
                  state.step === "optimize" || state.step === "done";
              }
              if (s.id === "optim") {
                active = state.step === "optimize";
                done = state.step === "done";
              }
              if (s.id === "render") {
                active = false;
                done = state.step === "done";
              }
              return (
                <div key={s.id} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] ${
                      done
                        ? "border-emerald-400 bg-emerald-400/20 text-emerald-400"
                        : active
                        ? "border-white/80 text-white animate-pulse"
                        : "border-white/20 text-white/30"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <span
                    className={`font-mono text-[9px] tracking-widest ${
                      done || active ? "text-white/70" : "text-white/30"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Erreur de génération */}
          {state.step === "error" && (
            <div className="max-w-md mx-auto text-center">
              {/* Cas "QUEUE:..." : file Meshy pleine, message d'attente bleu/ambre */}
              {state.error?.startsWith("QUEUE:") ? (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-5">
                  <div className="font-mono text-[10px] tracking-[0.4em] text-cyan-400 mb-2">
                    ⏳ FILE D&apos;ATTENTE
                  </div>
                  <div className="text-white/80 text-sm">
                    {state.error.slice("QUEUE:".length).trim()}
                  </div>
                </div>
              ) : (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-5">
                  <div className="font-mono text-[10px] tracking-[0.4em] text-red-400 mb-2">
                    ÉCHEC GÉNÉRATION
                  </div>
                  <div className="text-white/80 text-sm">{state.error}</div>
                </div>
              )}
              <button
                onClick={reset}
                className="mt-4 font-mono text-[10px] tracking-[0.3em] text-white/40 hover:text-white/80 transition"
              >
                {state.error?.startsWith("QUEUE:")
                  ? "← RÉESSAYER PLUS TARD"
                  : "← RECOMMENCER"}
              </button>
            </div>
          )}

          {/* Résultat — modèle prêt */}
          {state.step === "done" && state.glbUrl && (
            <div className="max-w-3xl mx-auto">
              <div className="mb-8 text-center">
                <span className="font-mono text-[10px] md:text-xs tracking-[0.4em] text-emerald-400 block mb-3">
                  ✓ TON MODÈLE 3D EST GÉNÉRÉ
                </span>
                <h3 className="text-2xl md:text-4xl font-light tracking-tight">
                  Mesh prêt en 4 min.
                </h3>
                <p className="text-white/50 text-sm mt-3 max-w-md mx-auto">
                  300 000 polygones, quad topology, textures PBR.
                  Le mesh expire chez Meshy dans ~1h, télécharge-le maintenant.
                </p>
              </div>

              {/* Mode fallback : Blob upload échoué — on explique pourquoi */}
              {state.fallbackReason && (
                <div className="mb-8 max-w-xl mx-auto">
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                    <div className="font-mono text-[10px] tracking-[0.4em] text-amber-400 mb-2">
                      ⚠ DÉMO NON PERSISTÉE
                    </div>
                    <p className="text-white/80 text-sm mb-2">
                      Le mesh est généré mais la sauvegarde Vercel Blob a échoué.
                      Tu peux télécharger le .glb mais pas obtenir d&apos;URL partageable.
                    </p>
                    <p className="text-white/50 text-xs font-mono break-all">
                      {state.fallbackReason}
                    </p>
                  </div>
                </div>
              )}

              {/* Aperçu produit en fallback : pas de viewer 3D mais au moins l'image */}
              {!state.optimizedBlobUrl && state.product.image && (
                <div className="mb-8 relative aspect-square md:aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.product.image}
                    alt={state.product.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 text-center">
                    <span className="font-mono text-[9px] tracking-[0.4em] text-white/60 block mb-1">
                      MESH 3D GÉNÉRÉ — APERÇU SOURCE
                    </span>
                    <span className="font-mono text-[10px] text-white/40">
                      Visualise-le en 3D via le bouton ci-dessous
                    </span>
                  </div>
                </div>
              )}

              {/* Viewer 3D inline (si optimisation a réussi) */}
              {state.optimizedBlobUrl && (
                <div className="mb-8">
                  <GeneratedViewer url={state.optimizedBlobUrl} />
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3 max-w-md mx-auto">
                <a
                  href={state.glbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={`${state.product.handle}_vertxia.glb`}
                  className="flex items-center justify-between w-full px-6 py-4 bg-white text-black font-mono text-xs tracking-[0.3em] rounded-lg hover:bg-white/90 transition"
                >
                  <span>TÉLÉCHARGER LE .GLB</span>
                  <span>↓</span>
                </a>

                <a
                  href={`https://gltf-viewer.donmccurdy.com/?model=${encodeURIComponent(state.glbUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full px-6 py-4 border border-white/20 text-white font-mono text-xs tracking-[0.3em] rounded-lg hover:bg-white/5 transition"
                >
                  <span>VISUALISER EN 3D (gltf-viewer)</span>
                  <span>→</span>
                </a>

                <a
                  href={`mailto:emilien@vertxia.com?subject=Site%20complet%20pour%20${encodeURIComponent(
                    state.data.shop
                  )}&body=Salut%20Emilien,%0A%0AJe%20veux%20le%20site%203D%20complet%20pour%20:%0A${encodeURIComponent(
                    state.data.shop
                  )}%0AProduit%20test%C3%A9%20:%20${encodeURIComponent(
                    state.product.title
                  )}%0A%0AMon%20email%20:%20%5BMETS%20TON%20EMAIL%20ICI%5D%0A%0AMerci%20!`}
                  className="flex items-center justify-between w-full px-6 py-4 bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 border border-emerald-400/40 text-white font-mono text-xs tracking-[0.3em] rounded-lg hover:from-emerald-500/30 hover:to-emerald-500/20 transition"
                >
                  <span>RECEVOIR LE SITE 3D COMPLET</span>
                  <span>→</span>
                </a>
              </div>

              <div className="text-center mt-12">
                <button
                  onClick={reset}
                  className="font-mono text-[10px] tracking-[0.3em] text-white/30 hover:text-white/70 transition"
                >
                  ← GÉNÉRER UNE AUTRE BOUTIQUE
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <footer className="relative z-10 border-t border-white/10 p-8 text-center bg-black/80 backdrop-blur-sm">
        <span className="font-mono text-[10px] tracking-[0.4em] text-white/30">
          VERTXIA · BUILD IN PUBLIC · 2026
        </span>
      </footer>
    </div>
  );
}
