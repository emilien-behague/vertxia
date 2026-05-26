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
import { CinematicEffects } from "@/components/cinematic-effects";

const MODEL_PATH = "/3d/les-derbies-femme_m6.glb";

const LIFESTYLE_IMG_1 =
  "https://cdn.shopify.com/s/files/1/1355/7899/files/SLIDESHOWIMAGE3_af538f97-1a4e-4451-bb64-011995d3a4c3.jpg?v=1775717876";
const LIFESTYLE_IMG_2 =
  "https://cdn.shopify.com/s/files/1/1355/7899/files/SLIDESHOWIMAGE5_c6df59a4-45fb-4105-baa1-8128f5c3ba8e.jpg?v=1775717876";

// ─── Scene 3D ────────────────────────────────────────────────────────────────
function Scene({ scrollRef }: { scrollRef: React.MutableRefObject<number> }) {
  const { scene } = useGLTF(MODEL_PATH);
  const groupRef = useRef<THREE.Group>(null);
  const bgColor = useRef(new THREE.Color("#0a0a0a"));

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
    // Background cycle bleu → violet → noir selon scroll (léger en compute)
    const p = Math.min(Math.max(scrollRef.current, 0), 1);
    bgColor.current.setHSL(0.6 + p * 0.2, 0.4, 0.04 + Math.sin(p * Math.PI) * 0.06);
    state.scene.background = bgColor.current;
  });

  return (
    <>
      <fog attach="fog" args={["#0a0a0a", 7, 22]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-5, 3, -5]} intensity={0.3} color="#ffa56b" />
      <pointLight position={[5, -2, 3]} intensity={0.2} color="#6b9aff" />

      <group ref={groupRef} scale={1.3} position={[0, -0.3, 0]}>
        <primitive object={scene} />
      </group>

      <Sparkles count={80} size={2} speed={0.4} scale={[18, 10, 18]} opacity={0.4} />
      <Environment files="/hdri/studio_small_03_2k.hdr" environmentIntensity={0.75} background={false} />

      {/* Cinematic post-processing : ACES tone mapping + bloom léger + vignette */}
      <CinematicEffects bloom={0.2} vignette={0.32} saturation={0.04} contrast={0.04} />
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

// ─── Page : vertical normal → break horizontal d'un coup ───────────────────
export default function LoomImmersive() {
  const scrollRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const horizontalWrapperRef = useRef<HTMLDivElement>(null);
  const horizontalTrackRef = useRef<HTMLDivElement>(null);

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

  // GSAP — Break horizontal après les sections verticales
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !horizontalTrackRef.current ||
      !horizontalWrapperRef.current
    )
      return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const horizontalSections = gsap.utils.toArray<HTMLElement>(".horizontal-section");
      const nbHorizontal = horizontalSections.length;

      // Horizontal scroll : utilise x (pixels) au lieu de xPercent pour
      // alignement précis. La page S'ARRÊTE quand la dernière section est full visible.
      const getMaxX = () =>
        horizontalTrackRef.current!.offsetWidth - window.innerWidth;

      gsap.to(horizontalTrackRef.current, {
        x: () => -getMaxX(),
        ease: "power2.inOut",
        scrollTrigger: {
          trigger: horizontalWrapperRef.current,
          pin: true,
          scrub: 0.5,
          end: () => "+=" + getMaxX(),
          invalidateOnRefresh: true,
        },
      });

      // Hero : lettres apparaissent au mount
      gsap.fromTo(
        ".hero-brand-letter",
        { opacity: 0, y: 120, rotationX: -90 },
        {
          opacity: 1,
          y: 0,
          rotationX: 0,
          stagger: 0.1,
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

      // Texte des sections verticales fade-in au scroll
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
          camera={{ position: [3, 1, 6], fov: 28 }}
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
          DAY 1 · LOOM
        </span>
      </div>

      {/* ═══ PHASE 1 : SCROLL VERTICAL NORMAL ═══ */}

      {/* HERO */}
      <section className="relative z-10 h-screen flex flex-col items-start justify-end p-6 md:p-16 overflow-hidden">
        {/* Gradient overlay mobile : assure lisibilité texte au-dessus du 3D */}
        <div className="absolute top-0 inset-x-0 h-[55vh] z-0 pointer-events-none md:hidden bg-gradient-to-b from-black/70 via-black/30 to-transparent" />

        {/* MOBILE : texte en haut sous la nav */}
        <div className="md:hidden absolute top-20 left-6 right-6 z-10">
          <span className="hero-meta font-mono text-[10px] tracking-[0.4em] text-white/50 block mb-3">
            GENERATED FROM · LOOM.FR
          </span>
          <h1 className="text-6xl font-light leading-[0.85] tracking-tighter text-white drop-shadow-2xl">
            {"LOOM".split("").map((letter, i) => (
              <span key={i} className="hero-brand-letter inline-block">
                {letter}
              </span>
            ))}
          </h1>
          <p className="hero-meta text-xs text-white/70 max-w-xs mt-4 drop-shadow-lg">
            Les derbies femme.
            <br />
            Site immersif généré en 5 min.
          </p>
        </div>

        {/* DESKTOP : texte en bas gauche, layout cinéma */}
        <div className="hidden md:block">
          <span className="hero-meta font-mono text-xs tracking-[0.4em] text-white/40 block mb-6">
            GENERATED FROM · LOOM.FR
          </span>
          <h1 className="text-[clamp(4rem,16vw,14rem)] font-light leading-[0.85] tracking-tighter text-white max-w-[80vw] overflow-hidden">
            {"LOOM".split("").map((letter, i) => (
              <span key={i} className="hero-brand-letter inline-block">
                {letter}
              </span>
            ))}
          </h1>
          <p className="hero-meta text-base text-white/50 max-w-md mt-6">
            Les derbies femme.
            <br />
            Site immersif généré en 5 min.
          </p>
        </div>

        <div className="hero-meta absolute bottom-8 left-1/2 -translate-x-1/2 text-white/30 text-[10px] font-mono tracking-[0.3em] flex flex-col items-center gap-3">
          <span>SCROLL</span>
          <span className="text-base animate-bounce">↓</span>
        </div>
      </section>

      {/* INTRO — section verticale */}
      <section className="v-fade relative z-10 h-screen flex items-center justify-end p-6 md:p-16">
        <div className="max-w-md text-right text-white space-y-4">
          <span className="font-mono text-xs tracking-[0.4em] text-white/40 block">
            CHAPITRE 01
          </span>
          <h2 className="text-3xl md:text-6xl font-light leading-[0.95] tracking-tight">
            Loom.
          </h2>
          <p className="text-lg md:text-3xl font-light text-white/80 leading-tight">
            Vêtements éco-conçus
            <br />
            depuis 2018.
          </p>
          <p className="text-sm md:text-base text-white/50 leading-relaxed pt-2">
            Une marque française qui s'engage à durer.
          </p>
        </div>
      </section>

      {/* STORY 1 — section verticale (la "fameuse image" après laquelle ça part à droite) */}
      <section className="v-fade relative z-10 h-screen flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${LIFESTYLE_IMG_1})`,
            filter: "brightness(0.45) saturate(0.9)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
        <div className="relative z-10 text-center text-white max-w-3xl px-6">
          <p className="text-3xl md:text-7xl font-light leading-[1] tracking-tight">
            « Une chaussure qui vit
            <br />
            <span className="italic text-white/80">toute une vie. »</span>
          </p>
          <p className="mt-8 text-xs md:text-sm text-white/50 font-mono tracking-[0.3em]">
            — LOOM MANIFESTO
          </p>
        </div>
        {/* Petit indicateur : ça va partir à droite */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 text-[10px] font-mono tracking-[0.3em] flex items-center gap-3">
          <span>CONTINUE</span>
          <span className="text-base animate-bounce">↓</span>
        </div>
      </section>

      {/* ═══ PHASE 2 : SCROLL VERTICAL = TRANSLATE HORIZONTAL (le "d'un coup") ═══ */}

      <div ref={horizontalWrapperRef} className="relative h-screen overflow-hidden">
        <div
          ref={horizontalTrackRef}
          className="flex h-full w-fit will-change-transform"
        >
          {/* H-SECTION 1 — DETAIL */}
          <section className="horizontal-section relative w-screen h-screen flex-shrink-0 flex items-center justify-start p-6 md:p-16">
            <div className="max-w-md text-white space-y-4">
              <span className="font-mono text-xs tracking-[0.4em] text-white/40 block">
                CHAPITRE 02
              </span>
              <h2 className="text-3xl md:text-6xl font-light leading-[0.95] tracking-tight">
                Cuir de vachette
                <br />
                <span className="text-white/60">tannage végétal.</span>
              </h2>
              <p className="text-base md:text-lg text-white/60 leading-relaxed pt-2">
                Cousu Goodyear. Garanti 5 ans. Resemellable à vie.
                <br />
                Pensé pour ne jamais finir à la poubelle.
              </p>
              <div className="pt-6 grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="font-mono text-3xl md:text-4xl text-white">5</div>
                  <div className="text-[10px] tracking-widest text-white/40 mt-1">
                    ANS GARANTIE
                  </div>
                </div>
                <div>
                  <div className="font-mono text-3xl md:text-4xl text-white">∞</div>
                  <div className="text-[10px] tracking-widest text-white/40 mt-1">
                    RESEMELLABLE
                  </div>
                </div>
                <div>
                  <div className="font-mono text-3xl md:text-4xl text-white">FR</div>
                  <div className="text-[10px] tracking-widest text-white/40 mt-1">
                    CONÇU EN
                  </div>
                </div>
              </div>
            </div>
            {/* Indicateur scroll horizontal en cours */}
            <div className="absolute bottom-8 right-8 text-white/40 text-[10px] font-mono tracking-[0.3em] flex items-center gap-3">
              <span>EXPLORE</span>
              <span className="text-base animate-pulse">→</span>
            </div>
          </section>

          {/* H-SECTION 2 — STORY 2 */}
          <section className="horizontal-section relative w-screen h-screen flex-shrink-0 flex items-center justify-center overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${LIFESTYLE_IMG_2})`,
                filter: "brightness(0.35) saturate(0.85)",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
            <div className="relative z-10 text-center text-white max-w-3xl px-6">
              <p className="text-3xl md:text-7xl font-light leading-[1] tracking-tight">
                Faite pour durer.
              </p>
              <p className="text-xl md:text-4xl font-light text-white/50 mt-3 italic">
                Pas pour suivre la mode.
              </p>
            </div>
          </section>

          {/* H-SECTION 3 — CTA */}
          <section className="horizontal-section relative w-screen h-screen flex-shrink-0 flex flex-col items-center justify-center p-6 md:p-16 text-center">
            <div>
              <span className="font-mono text-xs tracking-[0.4em] text-white/40 block mb-6">
                DÉCOUVRIR
              </span>
              <h2 className="text-5xl md:text-9xl font-light text-white tracking-tighter leading-none">
                loom.fr
              </h2>
              <a
                href="https://www.loom.fr/products/les-derbies-femme"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-10 px-8 py-3 border border-white/20 text-white hover:bg-white hover:text-black transition-colors duration-300 pointer-events-auto font-mono text-xs md:text-sm tracking-[0.3em]"
              >
                VOIR LE SITE COMPLET
              </a>
              <div className="mt-16 flex flex-col items-center gap-2">
                <span className="font-mono text-[10px] text-white/30 tracking-[0.3em]">
                  GÉNÉRÉ EN 5 MIN PAR
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
      </div>
    </div>
  );
}

useGLTF.preload(MODEL_PATH);
