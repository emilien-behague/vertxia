"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  useGLTF,
  Sparkles,
  Html,
} from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

const MODEL_PATH = "/3d/dbz-trunks_uhq.glb";

const LIFESTYLE_IMG_1 =
  "https://cdn.shopify.com/s/files/1/0995/9597/7051/files/D53B95AC-8C83-4DA4-BA15-83DEF8143C8E.jpg?v=1779126491";
const LIFESTYLE_IMG_2 =
  "https://cdn.shopify.com/s/files/1/0995/9597/7051/files/B9F3ED9A-A213-4FE1-8672-23B6CB5E165E.jpg?v=1779126490";

// ─── Scene 3D ────────────────────────────────────────────────────────────────
function Scene({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  const { scene } = useGLTF(MODEL_PATH);
  const groupRef = useRef<THREE.Group>(null);
  const bgColor = useRef(new THREE.Color("#0a0612"));
  const rimRef = useRef<THREE.PointLight>(null);
  const auraRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.4;
    }
    // Background cycle violet profond → magenta (palette anime dark cohérente)
    const p = Math.min(Math.max(scrollRef.current, 0), 1);
    bgColor.current.setHSL(0.74 + p * 0.12, 0.5, 0.05 + Math.sin(p * Math.PI) * 0.025);
    state.scene.background = bgColor.current;

    if (rimRef.current) {
      rimRef.current.intensity = 1.4 + Math.sin(state.clock.elapsedTime * 1.5) * 0.25;
    }
    if (auraRef.current) {
      auraRef.current.intensity = 0.6 + Math.sin(state.clock.elapsedTime * 2.0 + 1) * 0.15;
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

      <Sparkles count={120} size={2.5} speed={0.3} scale={[14, 16, 14]} opacity={0.55} color="#ffd700" />

      <Environment preset="night" environmentIntensity={0.55} />
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

// ─── Page : 100% vertical scroll ────────────────────────────────────
export default function BuuKoffImmersive() {
  const scrollRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

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
      const max =
        document.documentElement.scrollHeight - window.innerHeight;
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // Hero : lettres apparaissent au mount
      gsap.fromTo(
        ".hero-brand-letter",
        { opacity: 0, y: 120, rotationX: -90 },
        {
          opacity: 1,
          y: 0,
          rotationX: 0,
          stagger: 0.08,
          duration: 1.3,
          ease: "power4.out",
          delay: 0.4,
        }
      );

      gsap.fromTo(
        ".hero-meta",
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1.5, delay: 1.2, ease: "power3.out" }
      );

      // Texte sections fade-in au scroll
      gsap.utils.toArray<HTMLElement>(".v-fade > *").forEach((el) => {
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

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="relative bg-black overflow-x-hidden">
      {/* Sticky Canvas 3D */}
      <div className="fixed inset-0 z-0">
        <Canvas
          camera={{ position: [3, 1.2, 6], fov: 28 }}
          gl={{ antialias: true, alpha: false }}
          shadows
          dpr={[1, 2]}
          frameloop="always"
        >
          <Suspense fallback={<Loader />}>
            <Scene scrollRef={scrollRef} />
          </Suspense>
        </Canvas>
      </div>

      {/* Top fixed nav */}
      <div className="fixed top-0 inset-x-0 z-50 flex justify-between items-center p-6 md:p-10 pointer-events-none">
        <span className="font-mono text-[10px] md:text-xs tracking-[0.3em] text-white/50">
          VERTXIA · PREVIEW
        </span>
        <span className="font-mono text-[10px] md:text-xs tracking-[0.3em] text-white/50">
          DAY 1 · BUU&apos;KOFF
        </span>
      </div>

      {/* HERO */}
      <section className="relative z-10 h-screen flex flex-col items-start justify-end p-6 md:p-16 overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[55vh] z-0 pointer-events-none md:hidden bg-gradient-to-b from-black/70 via-black/30 to-transparent" />

        {/* MOBILE */}
        <div className="md:hidden absolute top-20 left-6 right-6 z-10">
          <span className="hero-meta font-mono text-[10px] tracking-[0.4em] text-white/50 block mb-3">
            GENERATED FROM · BUU-KOFF
          </span>
          <h1 className="text-5xl font-light leading-[0.85] tracking-tighter text-white drop-shadow-2xl">
            {"BUU’KOFF".split("").map((letter, i) => (
              <span key={i} className="hero-brand-letter inline-block">
                {letter}
              </span>
            ))}
          </h1>
          <p className="hero-meta text-xs text-white/70 max-w-xs mt-4 drop-shadow-lg">
            DBZ — Trunks Solid Edge Works.
            <br />
            Figurine collector. Site immersif 30 min.
          </p>
        </div>

        {/* DESKTOP */}
        <div className="hidden md:block">
          <span className="hero-meta font-mono text-xs tracking-[0.4em] text-white/40 block mb-6">
            GENERATED FROM · BUU-KOFF-2.MYSHOPIFY.COM
          </span>
          <h1 className="text-[clamp(3.5rem,12vw,11rem)] font-light leading-[0.85] tracking-tighter text-white max-w-[90vw] overflow-hidden">
            {"BUU’KOFF".split("").map((letter, i) => (
              <span key={i} className="hero-brand-letter inline-block">
                {letter}
              </span>
            ))}
          </h1>
          <p className="hero-meta text-base text-white/50 max-w-md mt-6">
            DBZ — Trunks Solid Edge Works.
            <br />
            Figurine collector. Site immersif 30 min.
          </p>
        </div>

        <div className="hero-meta absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 text-[10px] font-mono tracking-[0.3em] flex flex-col items-center gap-3">
          <span>SCROLL</span>
          <span className="text-base animate-bounce">↓</span>
        </div>
      </section>

      {/* CHAPITRE 01 — Buu'Koff */}
      <section className="v-fade relative z-10 h-screen flex items-center justify-end p-6 md:p-16">
        <div className="max-w-md text-right text-white space-y-4">
          <span className="font-mono text-xs tracking-[0.4em] text-white/40 block">
            CHAPITRE 01
          </span>
          <h2 className="text-3xl md:text-6xl font-light leading-[0.95] tracking-tight">
            Buu&rsquo;Koff.
          </h2>
          <p className="text-lg md:text-3xl font-light text-white/80 leading-tight">
            Figurines anime
            <br />
            authentifiées.
          </p>
          <p className="text-sm md:text-base text-white/50 leading-relaxed pt-2">
            Banpresto, Ichiban Kuji, Figuarts — sélection collector pour les puristes.
          </p>
        </div>
      </section>

      {/* STORY 1 — DBZ lore */}
      <section className="v-fade relative z-10 h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${LIFESTYLE_IMG_1})`,
            filter: "brightness(0.4) saturate(1.1)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-purple-950/30 to-black/80" />
        <div className="relative z-10 text-center text-white max-w-[85vw] md:max-w-3xl px-6">
          <p className="text-3xl md:text-7xl font-light leading-[1] tracking-tight">
            « Le fils de Vegeta
            <br />
            <span className="italic text-white/80">venu d&apos;un futur brisé. »</span>
          </p>
          <p className="mt-8 text-xs md:text-sm text-white/50 font-mono tracking-[0.3em]">
            — DRAGON BALL Z LORE
          </p>
        </div>
      </section>

      {/* CHAPITRE 02 — Solid Edge Works detail */}
      <section className="v-fade relative z-10 h-screen flex items-center justify-start p-6 md:p-16">
        <div className="max-w-md text-white space-y-4">
          <span className="font-mono text-xs tracking-[0.4em] text-white/40 block">
            CHAPITRE 02
          </span>
          <h2 className="text-3xl md:text-6xl font-light leading-[0.95] tracking-tight">
            Solid Edge Works.
            <br />
            <span className="text-white/60">Arêtes vives.</span>
          </h2>
          <p className="text-base md:text-lg text-white/60 leading-relaxed pt-2">
            Ligne Banpresto au design polygonal tranché.
            <br />
            Hommage manga aux planches d&apos;Akira Toriyama.
          </p>
          <div className="pt-6 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="font-mono text-3xl md:text-4xl text-white">25</div>
              <div className="text-[10px] tracking-widest text-white/40 mt-1">
                € PRIX
              </div>
            </div>
            <div>
              <div className="font-mono text-3xl md:text-4xl text-white">22cm</div>
              <div className="text-[10px] tracking-widest text-white/40 mt-1">
                HAUTEUR
              </div>
            </div>
            <div>
              <div className="font-mono text-3xl md:text-4xl text-white">PVC</div>
              <div className="text-[10px] tracking-widest text-white/40 mt-1">
                MATÉRIAU
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STORY 2 — Collection */}
      <section className="v-fade relative z-10 h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${LIFESTYLE_IMG_2})`,
            filter: "brightness(0.35) saturate(1.05)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-purple-950/20 to-black/40" />
        <div className="relative z-10 text-center text-white max-w-[85vw] md:max-w-3xl px-6">
          <p className="text-3xl md:text-7xl font-light leading-[1] tracking-tight">
            Une pièce de collection.
          </p>
          <p className="text-lg md:text-4xl font-light text-white/50 mt-3 italic">
            Pas un produit dérivé.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="v-fade relative z-10 h-screen flex flex-col items-center justify-center p-6 md:p-16 text-center">
        <div>
          <span className="font-mono text-xs tracking-[0.4em] text-white/40 block mb-6">
            DÉCOUVRIR
          </span>
          <h2 className="text-5xl md:text-9xl font-light text-white tracking-tighter leading-none">
            buu-koff
          </h2>
          <a
            href="https://buu-koff-2.myshopify.com/products/dragon-ball-z-trunks-solid-edge-works-1"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-10 px-8 py-3 border border-white/20 text-white hover:bg-white hover:text-black transition-colors duration-300 pointer-events-auto font-mono text-xs md:text-sm tracking-[0.3em]"
          >
            VOIR LA FIGURINE
          </a>
          <div className="mt-16 flex flex-col items-center gap-2">
            <span className="font-mono text-[10px] text-white/30 tracking-[0.3em]">
              GÉNÉRÉ EN 30 MIN PAR
            </span>
            <a
              href="https://vertxia.com"
              className="font-mono text-sm text-white/60 hover:text-white transition pointer-events-auto"
            >
              vertxia.com
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

useGLTF.preload(MODEL_PATH);
