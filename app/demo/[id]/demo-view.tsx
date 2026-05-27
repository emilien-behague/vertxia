"use client";

/**
 * Client component pour la page /demo/[id].
 *
 * Expérience immersive scroll-driven (même pattern que /preview/buukoff) :
 *   - Canvas R3F sticky en fond (3D auto-rotation + lights + Sparkles)
 *   - Lenis smooth scroll + GSAP ScrollTrigger
 *   - 6 sections plein écran qui défilent par-dessus le 3D
 *
 * Sections :
 *   1. HERO        — Lettres vendor géantes animées + product title
 *   2. CHAPITRE 01 — Pitch boutique (right-aligned)
 *   3. STORY 1     — Image produit en background overlay
 *   4. CHAPITRE 02 — Stats tech (polygons, time, web) (left-aligned)
 *   5. STORY 2     — Pivot upsell
 *   6. CTA         — Activer ma boutique (email + lien shop)
 *
 * Conversion mechanic : top nav "ACTIVER MA BOUTIQUE" toujours visible
 * (low-friction) + CTA finale pour scrollers engagés.
 */

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  useGLTF,
  Html,
} from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import SplitText from "@activetheory/split-text";
import { CinematicEffects } from "@/components/cinematic-effects";
import { SceneLoader } from "@/components/scene-loader";
import { AudioProvider } from "@/components/audio/audio-provider";
import { AudioToggle } from "@/components/audio/audio-toggle";
import { SoundEngine } from "@/components/audio/sound-engine";
import { CustomCursor } from "@/components/custom-cursor";
import { MagneticButton } from "@/components/magnetic-button";

type SplitTextDom = SplitText & {
  chars: HTMLElement[];
  words: HTMLElement[];
  lines: HTMLElement[];
};

type Props = {
  id: string;
  glbUrl: string;
  shop: string;
  vendor: string;
  product: string;
  image: string;
};

// ─── Scene 3D ────────────────────────────────────────────────────────────────
function Scene({
  url,
  scrollRef,
}: {
  url: string;
  scrollRef: React.MutableRefObject<number>;
}) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const bgColor = useRef(new THREE.Color("#0a0612"));
  const rimRef = useRef<THREE.PointLight>(null);
  const auraRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.35;
    }
    // Background cycle violet profond → magenta selon le scroll
    const p = Math.min(Math.max(scrollRef.current, 0), 1);
    bgColor.current.setHSL(
      0.74 + p * 0.12,
      0.5,
      0.05 + Math.sin(p * Math.PI) * 0.025
    );
    state.scene.background = bgColor.current;

    if (rimRef.current) {
      rimRef.current.intensity =
        1.4 + Math.sin(state.clock.elapsedTime * 1.5) * 0.25;
    }
    if (auraRef.current) {
      auraRef.current.intensity =
        0.6 + Math.sin(state.clock.elapsedTime * 2.0 + 1) * 0.15;
    }
  });

  return (
    <>
      <fog attach="fog" args={["#0a0612", 8, 22]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.1}
        color="#ffd9a3"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight
        ref={rimRef}
        position={[-4, 3, -4]}
        intensity={1.4}
        color="#a855f7"
        distance={15}
      />
      <pointLight
        ref={auraRef}
        position={[4, 5, -3]}
        intensity={0.7}
        color="#22d3ee"
        distance={12}
      />
      <pointLight position={[3, -1, 4]} intensity={0.25} color="#fb923c" />

      <group ref={groupRef} scale={1.5} position={[0, -0.9, 0]}>
        <primitive object={scene} />
      </group>

      {/* Sparkles retire : artefacts carres a cause du bloom qui rend visible
          les quads des sprites. Atmosphere portee par bloom + vignette + rim lights. */}

      <Environment
        files="/hdri/studio_small_03_2k.hdr"
        environmentIntensity={0.6}
        background={false}
      />

      <CinematicEffects
        bloom={0.35}
        vignette={0.35}
        saturation={0.08}
        contrast={0.04}
      />
    </>
  );
}

function Loader() {
  return (
    <Html center>
      <div className="text-white/40 text-xs font-mono tracking-widest">
        LOADING SCENE...
      </div>
    </Html>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export function DemoView({ id, glbUrl, shop, vendor, product, image }: Props) {
  const scrollRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Lenis smooth scroll + tracking scroll progress pour la scène 3D
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);

    const lenis = new Lenis({
      duration: 1.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    function raf(time: number) {
      lenis.raf(time);
      ScrollTrigger.update();
      requestAnimationFrame(raf);
    }
    const rafId = requestAnimationFrame(raf);

    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollRef.current = window.scrollY / Math.max(max, 1);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      lenis.destroy();
    };
  }, []);

  // GSAP animations : hero letters + scroll fade-in + sound triggers
  useEffect(() => {
    if (typeof window === "undefined") return;
    gsap.registerPlugin(ScrollTrigger);

    const splits: SplitText[] = [];

    const init = async () => {
      if (typeof document !== "undefined" && "fonts" in document) {
        await document.fonts.ready;
      }

      const ctx = gsap.context(() => {
        // Hero : vendor letters char-by-char au mount
        containerRef.current
          ?.querySelectorAll<HTMLElement>(".hero-brand")
          .forEach((heroEl) => {
            const heroSplit = new SplitText(heroEl, {
              type: "chars",
            }) as SplitTextDom;
            splits.push(heroSplit);
            gsap.fromTo(
              heroSplit.chars,
              { opacity: 0, y: 120, rotationX: -90 },
              {
                opacity: 1,
                y: 0,
                rotationX: 0,
                stagger: 0.06,
                duration: 1.3,
                ease: "power4.out",
                delay: 0.4,
              }
            );
          });

        // Hero meta (sous-titres + scroll hint)
        gsap.fromTo(
          ".hero-meta",
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 1.5, delay: 1.2, ease: "power3.out" }
        );

        // Chapter titles : char-by-char + whoosh sonore
        containerRef.current
          ?.querySelectorAll<HTMLElement>(".chapter-title")
          .forEach((el) => {
            const split = new SplitText(el, {
              type: "chars",
            }) as SplitTextDom;
            splits.push(split);
            gsap.fromTo(
              split.chars,
              { opacity: 0, y: 50, rotationX: -60 },
              {
                opacity: 1,
                y: 0,
                rotationX: 0,
                stagger: 0.03,
                duration: 0.7,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: el,
                  start: "top 75%",
                  toggleActions: "play none none reverse",
                  onEnter: () => SoundEngine.whoosh(),
                },
              }
            );
          });

        // Quotes : word-by-word avec blur + reveal sonore
        containerRef.current
          ?.querySelectorAll<HTMLElement>(".v-quote")
          .forEach((el) => {
            const split = new SplitText(el, {
              type: "words",
            }) as SplitTextDom;
            splits.push(split);
            gsap.fromTo(
              split.words,
              { opacity: 0, y: 30, filter: "blur(8px)" },
              {
                opacity: 1,
                y: 0,
                filter: "blur(0px)",
                stagger: 0.06,
                duration: 0.9,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: el,
                  start: "top 78%",
                  toggleActions: "play none none reverse",
                  onEnter: () => SoundEngine.reveal(),
                },
              }
            );
          });

        // Autres éléments .v-fade > * (paragraphes / stats / CTA) : fade-up classique
        gsap.utils.toArray<HTMLElement>(".v-fade > *").forEach((el) => {
          if (
            el.classList.contains("chapter-title") ||
            el.classList.contains("v-quote")
          ) {
            return;
          }
          gsap.fromTo(
            el,
            { opacity: 0, y: 40 },
            {
              opacity: 1,
              y: 0,
              duration: 1,
              ease: "power3.out",
              scrollTrigger: {
                trigger: el,
                start: "top 80%",
                toggleActions: "play none none reverse",
              },
            }
          );
        });
      }, containerRef);

      return ctx;
    };

    const ctxPromise = init();

    return () => {
      ctxPromise.then((ctx) => ctx?.revert());
      splits.forEach((s) => s.revert());
    };
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = window.location.href;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      } catch {
        // tant pis
      }
      document.body.removeChild(ta);
    }
  }

  // Email pré-rempli pour le CTA "Activer ma boutique"
  const mailtoBody = encodeURIComponent(
    `Salut Emilien,\n\nJ'ai vu la démo Vertxia pour ${vendor}${
      shop ? ` (${shop})` : ""
    } :\nhttps://vertxia.com/demo/${id}\n\nJe veux la même chose pour ma boutique :\n- URL boutique : [TON URL SHOPIFY]\n- Email : [TON EMAIL]\n\nMerci !`
  );
  const mailtoUrl = `mailto:emilien@vertxia.com?subject=${encodeURIComponent(
    `Vertxia 3D pour ma boutique`
  )}&body=${mailtoBody}`;

  // Vendor letters pour l'animation hero. Si vendor très long, on tronque
  // pour pas exploser le layout — on garde les 14 premiers chars max.
  const heroLetters = vendor.length > 14 ? vendor.slice(0, 14) : vendor;
  // Lien direct vers la boutique source (Shopify)
  const shopHref = shop
    ? shop.startsWith("http")
      ? shop
      : `https://${shop}`
    : "https://shopify.com";

  return (
    <AudioProvider enableDrone={true}>
    <CustomCursor />
    <div ref={containerRef} className="relative bg-black overflow-x-hidden">
      <SceneLoader />
      {/* Audio toggle discret en bas-droite */}
      <AudioToggle className="fixed bottom-6 right-6 z-50" />

      {/* Sticky Canvas 3D en fond */}
      <div className="fixed inset-0 z-0">
        <Canvas
          camera={{ position: [3, 1.2, 6], fov: 28 }}
          gl={{ antialias: true, alpha: false }}
          shadows
          dpr={[1, 2]}
          frameloop="always"
        >
          <Suspense fallback={<Loader />}>
            <Scene url={glbUrl} scrollRef={scrollRef} />
          </Suspense>
        </Canvas>
      </div>

      {/* Top nav — VERTXIA + Copier + Activer */}
      <nav className="fixed top-0 inset-x-0 z-50 flex justify-between items-center p-5 md:p-8 pointer-events-none">
        <Link
          href="/"
          className="font-mono text-[10px] md:text-xs tracking-[0.3em] text-white/60 hover:text-white transition pointer-events-auto"
        >
          VERTXIA · DÉMO LIVE
        </Link>
        <div className="flex items-center gap-2 md:gap-3 pointer-events-auto">
          <button
            onClick={copyLink}
            className="font-mono text-[9px] md:text-[10px] tracking-[0.3em] text-white/60 hover:text-white border border-white/20 hover:border-white/60 px-2.5 md:px-3 py-2 rounded transition"
          >
            {copied ? "✓ COPIÉ" : "COPIER LE LIEN"}
          </button>
          <a
            href={mailtoUrl}
            className="font-mono text-[9px] md:text-[10px] tracking-[0.3em] bg-white text-black hover:bg-white/90 px-3 md:px-4 py-2 rounded transition"
          >
            ACTIVER →
          </a>
        </div>
      </nav>

      {/* ─── 1. HERO ──────────────────────────────────────────────────────── */}
      <section className="relative z-10 h-screen flex flex-col items-start justify-end p-6 md:p-16 overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[55vh] z-0 pointer-events-none md:hidden bg-gradient-to-b from-black/70 via-black/30 to-transparent" />

        {/* MOBILE */}
        <div className="md:hidden absolute top-20 left-6 right-6 z-10">
          <span className="hero-meta font-mono text-[10px] tracking-[0.4em] text-emerald-400/80 block mb-3">
            ✓ GÉNÉRÉ EN LIVE · {shop.toUpperCase() || "SHOPIFY"}
          </span>
          <h1 className="hero-brand text-5xl font-light leading-[0.85] tracking-tighter text-white drop-shadow-2xl">
            {heroLetters}
          </h1>
          <p className="hero-meta text-xs text-white/70 max-w-xs mt-4 drop-shadow-lg">
            {product}
            <br />
            Boutique 3D immersive. Générée en 4 min.
          </p>
        </div>

        {/* DESKTOP */}
        <div className="hidden md:block">
          <span className="hero-meta font-mono text-xs tracking-[0.4em] text-emerald-400/80 block mb-6">
            ✓ GÉNÉRÉ EN LIVE · {shop.toUpperCase() || "SHOPIFY"}
          </span>
          <h1 className="hero-brand text-[clamp(3rem,11vw,10rem)] font-light leading-[0.85] tracking-tighter text-white max-w-[90vw] overflow-hidden">
            {heroLetters}
          </h1>
          <p className="hero-meta text-base text-white/50 max-w-md mt-6">
            {product}
            <br />
            Boutique 3D immersive. Générée en 4 min.
          </p>
        </div>

        <div className="hero-meta absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 text-[10px] font-mono tracking-[0.3em] flex flex-col items-center gap-3">
          <span>SCROLL</span>
          <span className="text-base animate-bounce">↓</span>
        </div>
      </section>

      {/* ─── 2. CHAPITRE 01 — Pitch boutique ──────────────────────────────── */}
      <section className="v-fade relative z-10 h-screen flex items-center justify-end p-6 md:p-16">
        <div className="max-w-md text-right text-white space-y-4">
          <span className="font-mono text-xs tracking-[0.4em] text-white/40 block">
            CHAPITRE 01
          </span>
          <h2 className="chapter-title text-3xl md:text-6xl font-light leading-[0.95] tracking-tight">
            {vendor}.
          </h2>
          <p className="text-lg md:text-3xl font-light text-white/80 leading-tight">
            Une boutique
            <br />
            qui se vit en 3D.
          </p>
          <p className="text-sm md:text-base text-white/50 leading-relaxed pt-2">
            Chaque produit devient une scène. Le visiteur tourne, zoome, explore.
            Plus d&apos;e-shop plat — un espace immersif que tu possèdes.
          </p>
        </div>
      </section>

      {/* ─── 3. STORY 1 — Image produit en background ─────────────────────── */}
      {image && (
        <section className="v-fade relative z-10 h-screen flex items-center justify-center overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${image})`,
              filter: "brightness(0.4) saturate(1.1)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-purple-950/30 to-black/80" />
          <div className="relative z-10 text-center text-white max-w-[85vw] md:max-w-3xl px-6">
            <p className="v-quote text-3xl md:text-7xl font-light leading-[1] tracking-tight">
              « Une boutique
              <br />
              <span className="italic text-white/80">qu&apos;on n&apos;oublie pas. »</span>
            </p>
            <p className="mt-8 text-xs md:text-sm text-white/50 font-mono tracking-[0.3em]">
              — {product.toUpperCase().slice(0, 60)}
            </p>
          </div>
        </section>
      )}

      {/* ─── 4. CHAPITRE 02 — Stats tech ──────────────────────────────────── */}
      <section className="v-fade relative z-10 h-screen flex items-center justify-start p-6 md:p-16">
        <div className="max-w-md text-white space-y-4">
          <span className="font-mono text-xs tracking-[0.4em] text-white/40 block">
            CHAPITRE 02
          </span>
          <h2 className="chapter-title text-3xl md:text-6xl font-light leading-[0.95] tracking-tight">
            Vraie 3D.
            <br />
            <span className="text-white/60">Pas un GIF.</span>
          </h2>
          <p className="text-base md:text-lg text-white/60 leading-relaxed pt-2">
            Mesh haute densité, textures PBR, post-processing cinéma.
            <br />
            100% web — aucun plugin, aucun app store.
          </p>
          <div className="pt-6 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="font-mono text-3xl md:text-4xl text-white">300K</div>
              <div className="text-[10px] tracking-widest text-white/40 mt-1">
                POLYGONS
              </div>
            </div>
            <div>
              <div className="font-mono text-3xl md:text-4xl text-white">4min</div>
              <div className="text-[10px] tracking-widest text-white/40 mt-1">
                À GÉNÉRER
              </div>
            </div>
            <div>
              <div className="font-mono text-3xl md:text-4xl text-white">WEB</div>
              <div className="text-[10px] tracking-widest text-white/40 mt-1">
                AUCUNE INSTALL
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. STORY 2 — Pivot upsell ────────────────────────────────────── */}
      <section className="v-fade relative z-10 h-screen flex items-center justify-center overflow-hidden">
        {image && (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${image})`,
                filter: "brightness(0.3) saturate(1.05)",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-purple-950/20 to-black/40" />
          </>
        )}
        <div className="relative z-10 text-center text-white max-w-[85vw] md:max-w-3xl px-6">
          <p className="v-quote text-3xl md:text-7xl font-light leading-[1] tracking-tight">
            Imagine.
          </p>
          <p className="text-lg md:text-4xl font-light text-white/70 mt-6">
            Tous tes produits.
            <br />
            Ton domaine. Ton univers.
          </p>
          <p className="text-base md:text-lg text-white/50 mt-8 italic max-w-xl mx-auto">
            Ce que tu vois là c&apos;est juste UN produit en démo.
            La version complète, c&apos;est ta boutique entière.
          </p>
        </div>
      </section>

      {/* ─── 6. CTA — Activer ma boutique ─────────────────────────────────── */}
      <section className="v-fade relative z-10 h-screen flex flex-col items-center justify-center p-6 md:p-16 text-center">
        <div className="max-w-2xl">
          <span className="font-mono text-xs tracking-[0.4em] text-emerald-400/80 block mb-6">
            ACTIVER MA BOUTIQUE 3D
          </span>
          <h2 className="text-4xl md:text-7xl font-light text-white tracking-tighter leading-[0.95]">
            On construit la tienne.
          </h2>
          <p className="text-white/60 text-base md:text-lg mt-8 max-w-md mx-auto leading-relaxed">
            Envoie-moi ton URL Shopify. Je te livre ton site 3D complet
            sur ton domaine, avec tous tes produits.
          </p>

          <div className="mt-12 flex flex-col gap-3 max-w-sm mx-auto">
            <MagneticButton href={mailtoUrl} variant="solid" className="w-full">
              ACTIVER MA BOUTIQUE →
            </MagneticButton>
            <MagneticButton
              href={shopHref}
              target="_blank"
              rel="noopener noreferrer"
              variant="ghost"
              className="w-full"
            >
              VOIR LA BOUTIQUE SOURCE ↗
            </MagneticButton>
            <button
              onClick={copyLink}
              className="block px-8 py-4 border border-white/10 text-white/60 hover:text-white hover:border-white/30 font-mono text-xs tracking-[0.3em] rounded-lg transition"
            >
              {copied ? "✓ LIEN COPIÉ" : "COPIER LE LIEN DE LA DÉMO"}
            </button>
          </div>

          <div className="mt-16 flex flex-col items-center gap-2">
            <span className="font-mono text-[10px] text-white/30 tracking-[0.3em]">
              GÉNÉRÉ EN 4 MIN PAR
            </span>
            <Link
              href="/"
              className="font-mono text-sm text-white/60 hover:text-white transition"
            >
              vertxia.com
            </Link>
          </div>
        </div>
      </section>
    </div>
    </AudioProvider>
  );
}
