"use client";

/**
 * Reel scroll-driven 9:16 portrait pour Insta.
 *
 * Storyboard piloté par scroll (5 sections h-screen) :
 *   Section 1 (0%)   : Gros plan visage Jiraya (radius 2, lookAt visage)
 *   Section 2 (25%)  : Caméra commence à reculer + tourner. Card 1 apparaît
 *   Section 3 (50%)  : Mi-distance, mi-rotation. Card 2 apparaît
 *   Section 4 (75%)  : Recul presque max. Cards 3+4 apparaissent
 *   Section 5 (100%) : Vue pleine figurine + CTA final vertxia.com
 *
 * Tournage : ouvrir la page en mobile responsive 1080x1920, screen record
 * pendant que tu scroll manuellement (vitesse contrôlée par le screen record).
 */

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, useGLTF, Sparkles, Html } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { CinematicEffects } from "@/components/cinematic-effects";
import { SceneLoader } from "@/components/scene-loader";

const MODEL_PATH = "/3d/jiraya_m6.glb";

// Mouvement "reveal" cinéma piloté par scroll.
// Cadrage calé sur ce que fait /preview/buukoff qui marche : la caméra par
// défaut à [3, 1.2, 6] lookAt(0,0,0) bien cadre la figurine. Le visage est
// donc à world Y ~0.3-0.5 (pas 0.9 comme j'avais surestimé).
const CAM_START_RADIUS = 2.5;    // gros plan visage (proche, cadre tête + épaules)
const CAM_END_RADIUS = 5.5;      // vue d'ensemble pleine figurine
const CAM_START_HEIGHT = 0.5;    // hauteur visage : caméra "à hauteur d'yeux"
const CAM_END_HEIGHT = 1.2;      // légère plongée pour vue cinéma standard
const CAM_START_LOOKAT_Y = 0.3;  // vise le centre du visage
const CAM_END_LOOKAT_Y = -0.3;   // vise plus bas pour intégrer les pieds
const CAM_TOTAL_ANGLE = Math.PI * 2; // 1 tour complet : retour face en fin

// ─── Caméra animée : reveal pull-back orbit pilotée par scroll ──────────────
function CameraOrbit({
  progressRef,
}: {
  progressRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();

  useFrame(() => {
    const p = progressRef.current;

    const radius = CAM_START_RADIUS + (CAM_END_RADIUS - CAM_START_RADIUS) * p;
    const height = CAM_START_HEIGHT + (CAM_END_HEIGHT - CAM_START_HEIGHT) * p;
    const angle = p * CAM_TOTAL_ANGLE;

    camera.position.set(
      Math.sin(angle) * radius,
      height,
      Math.cos(angle) * radius
    );

    const lookAtY =
      CAM_START_LOOKAT_Y + (CAM_END_LOOKAT_Y - CAM_START_LOOKAT_Y) * p;
    camera.lookAt(0, lookAtY, 0);
  });

  return null;
}

// ─── Scene 3D ────────────────────────────────────────────────────────────────
function Scene({
  progressRef,
}: {
  progressRef: React.MutableRefObject<number>;
}) {
  const { scene } = useGLTF(MODEL_PATH);
  const rimRef = useRef<THREE.PointLight>(null);
  const auraRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
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
      <CameraOrbit progressRef={progressRef} />
      <color attach="background" args={["#0c0a07"]} />
      <fog attach="fog" args={["#0c0a07", 8, 22]} />

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
        color="#dc2626"
        distance={15}
      />
      <pointLight
        ref={auraRef}
        position={[4, 5, -3]}
        intensity={0.7}
        color="#84cc16"
        distance={12}
      />
      <pointLight position={[3, -1, 4]} intensity={0.25} color="#fb923c" />

      <group scale={1.5} position={[0, -0.9, 0]}>
        <primitive object={scene} />
      </group>

      <Sparkles
        count={120}
        size={2.5}
        speed={0.3}
        scale={[14, 16, 14]}
        opacity={0.55}
        color="#f5d76e"
      />

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
        LOADING…
      </div>
    </Html>
  );
}

// ─── Page : scroll-driven reel ───────────────────────────────────────────────
export default function JirayaReel() {
  const progressRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lenis smooth scroll + tracking progress
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);

    const lenis = new Lenis({
      duration: 1.2,
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
      progressRef.current = Math.min(
        Math.max(window.scrollY / Math.max(max, 1), 0),
        1
      );
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      lenis.destroy();
    };
  }, []);

  // Cards fade-in via ScrollTrigger
  useEffect(() => {
    if (typeof window === "undefined") return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".reel-card").forEach((card) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 30, scale: 0.95 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: {
              trigger: card,
              start: "top 85%",
              end: "bottom 15%",
              toggleActions: "play reverse play reverse",
            },
          }
        );
      });

      // CTA final : fade in progressif et stable une fois visible
      gsap.fromTo(
        ".reel-final-cta",
        { opacity: 0, scale: 0.9 },
        {
          opacity: 1,
          scale: 1,
          duration: 1.2,
          ease: "power4.out",
          scrollTrigger: {
            trigger: ".reel-final-cta",
            start: "top 70%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="relative bg-black overflow-x-hidden">
      {/* Skeleton loader overlay pendant le download GLB/textures */}
      <SceneLoader />

      {/* Canvas sticky plein écran (z-0) */}
      <div className="fixed inset-0 z-0">
        <Canvas
          camera={{
            position: [0, CAM_START_HEIGHT, CAM_START_RADIUS],
            fov: 30,
          }}
          gl={{ antialias: true, alpha: false }}
          shadows
          dpr={[1, 2]}
          frameloop="always"
        >
          <Suspense fallback={<Loader />}>
            <Scene progressRef={progressRef} />
          </Suspense>
        </Canvas>
      </div>

      {/* Top brand mark */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <span className="font-mono text-[10px] tracking-[0.4em] text-white/60">
          VERTXIA · PREVIEW
        </span>
      </div>

      {/* Scroll indicator (visible seulement au début) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 text-white/40 text-[10px] font-mono tracking-[0.3em] flex flex-col items-center gap-2 pointer-events-none animate-pulse">
        <span>SCROLL</span>
        <span className="text-base">↓</span>
      </div>

      {/* SECTION 1 — Hero : visage Jiraya */}
      <section className="relative z-10 h-screen flex items-end justify-center pb-16 md:pb-24">
        {/* vide volontairement, on contemple le visage */}
      </section>

      {/* SECTION 2 — Card 1 (top-left) GENERATED FROM */}
      <section className="relative z-10 h-screen flex items-center px-6 md:px-12">
        <div className="reel-card w-full max-w-xs md:max-w-sm">
          <div className="bg-black/55 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-2xl">
            <div className="font-mono text-[9px] md:text-[10px] tracking-[0.35em] text-white/40 mb-2">
              GENERATED FROM
            </div>
            <div className="font-mono text-[11px] md:text-sm text-white/80">
              buu-koff-2.myshopify.com
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 — Card 2 (top-right) CHAPITRE 01 */}
      <section className="relative z-10 h-screen flex items-center justify-end px-6 md:px-12">
        <div className="reel-card w-full max-w-xs md:max-w-sm text-right">
          <div className="bg-black/55 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-2xl">
            <div className="font-mono text-[9px] md:text-[10px] tracking-[0.35em] text-white/40 mb-2">
              CHAPITRE 01
            </div>
            <div className="text-white text-lg md:text-2xl font-light leading-tight">
              Buu&rsquo;Koff.
            </div>
            <div className="text-white/60 text-xs md:text-sm leading-snug mt-1">
              Figurines anime authentifiées.
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — Card 3 (bottom-left) SAGE MODE STATS */}
      <section className="relative z-10 h-screen flex items-center px-6 md:px-12">
        <div className="reel-card w-full max-w-xs md:max-w-md">
          <div className="bg-black/55 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-2xl">
            <div className="font-mono text-[9px] md:text-[10px] tracking-[0.35em] text-white/40 mb-3">
              SAGE MODE · LOT E
            </div>
            <div className="flex gap-5 md:gap-6">
              <div>
                <div className="font-mono text-2xl md:text-3xl text-white">
                  96
                </div>
                <div className="text-[8px] md:text-[10px] tracking-widest text-white/40 mt-1">
                  € PRIX
                </div>
              </div>
              <div>
                <div className="font-mono text-2xl md:text-3xl text-white">
                  20cm
                </div>
                <div className="text-[8px] md:text-[10px] tracking-widest text-white/40 mt-1">
                  HAUTEUR
                </div>
              </div>
              <div>
                <div className="font-mono text-2xl md:text-3xl text-white">
                  PVC
                </div>
                <div className="text-[8px] md:text-[10px] tracking-widest text-white/40 mt-1">
                  MATÉRIAU
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 — CTA final */}
      <section className="reel-final-cta relative z-10 h-screen flex items-center justify-center px-6">
        <div className="text-center bg-black/60 backdrop-blur-sm py-10 px-8 rounded-2xl border border-white/10 max-w-md">
          <div className="font-mono text-[10px] md:text-xs tracking-[0.4em] text-white/40 mb-4">
            GÉNÉRÉ EN 3 MIN
          </div>
          <div className="text-white text-4xl md:text-6xl font-light tracking-tighter">
            vertxia.com
          </div>
          <div className="font-mono text-xs md:text-sm tracking-[0.3em] text-white/50 mt-3">
            /preview/jiraya
          </div>
        </div>
      </section>
    </div>
  );
}

useGLTF.preload(MODEL_PATH);
