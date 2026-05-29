"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  Vignette,
  SMAA,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";

// /preview/kage — CHAMBRE 1 ISOLÉE (V1 propre, validée par chrome-devtools)
// Stack vérifié context7 (28/05/2026) : Canvas alpha:true + EffectComposer
// multisampling=0 + SMAA + Bloom mipmap + ToneMapping ACES + Vignette.
// NO Lenis, NO Web Audio, NO multi-chambres, NO post-FX aggressifs.

type CursorState = { nx: number; ny: number };

function Skull({
  cursorRef,
  color,
}: {
  cursorRef: React.MutableRefObject<CursorState>;
  color: string;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const g = ref.current;
    const t = state.clock.elapsedTime;
    // Target = curseur + oscillation sin subtile (no accumulation)
    const targetY = cursorRef.current.nx * 0.45 + Math.sin(t * 0.35) * 0.12;
    const targetX = cursorRef.current.ny * -0.25 + Math.sin(t * 0.5 + 1) * 0.04;
    g.rotation.y += (targetY - g.rotation.y) * 0.05;
    g.rotation.x += (targetX - g.rotation.x) * 0.05;
  });

  // Édges = arêtes nettes du polyèdre brut (pas wireframe trianglé sale)
  // Crâne aplati (scale Y > X et Z) → forme oblong vertical d'un crâne humain
  return (
    <group ref={ref} position={[0, 0.15, 0]}>
      {/* Crâne principal — icosaèdre BRUT (subdiv 0 = 20 faces anguleuses) oblong */}
      <mesh scale={[1.0, 1.18, 0.95]}>
        <icosahedronGeometry args={[1.0, 0]} />
        <meshBasicMaterial color={color} transparent opacity={0} />
        <Edges color={color} threshold={1} />
      </mesh>
      {/* Mâchoire — pareil subdiv 0 + séparée */}
      <mesh position={[0, -0.88, 0.05]} scale={[0.7, 0.4, 0.6]}>
        <icosahedronGeometry args={[0.95, 0]} />
        <meshBasicMaterial color={color} transparent opacity={0} />
        <Edges color={color} threshold={1} />
      </mesh>
      {/* Œil gauche — orbite creuse */}
      <mesh position={[-0.34, 0.15, 0.78]}>
        <icosahedronGeometry args={[0.21, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0} />
        <Edges color={color} threshold={15} />
      </mesh>
      {/* Œil droit */}
      <mesh position={[0.34, 0.15, 0.78]}>
        <icosahedronGeometry args={[0.21, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0} />
        <Edges color={color} threshold={15} />
      </mesh>
      {/* Nez (cavité triangulaire) */}
      <mesh position={[0, -0.22, 0.92]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.08, 0.22, 3]} />
        <meshBasicMaterial color={color} transparent opacity={0} />
        <Edges color={color} threshold={1} />
      </mesh>
      {/* Dents — 6 alignées, plus serrées et plus visibles */}
      {[-0.22, -0.13, -0.045, 0.045, 0.13, 0.22].map((x) => (
        <mesh key={x} position={[x, -0.7, 0.55]}>
          <boxGeometry args={[0.06, 0.15, 0.05]} />
          <meshBasicMaterial color={color} transparent opacity={0} />
          <Edges color={color} threshold={1} />
        </mesh>
      ))}
    </group>
  );
}

function CustomCursor({ color }: { color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (ref.current) {
        ref.current.style.transform = `translate3d(${e.clientX - 12}px, ${e.clientY - 12}px, 0)`;
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  return (
    <div
      ref={ref}
      className="fixed top-0 left-0 z-40 w-6 h-6 pointer-events-none mix-blend-difference"
      style={{ willChange: "transform" }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
      </svg>
    </div>
  );
}

export default function KagePreview() {
  const [inverted, setInverted] = useState(false);
  const [time, setTime] = useState("--:--");
  const cursorRef = useRef<CursorState>({ nx: 0, ny: 0 });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
      );
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setInverted(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setInverted(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      cursorRef.current.nx = (e.clientX / window.innerWidth) * 2 - 1;
      cursorRef.current.ny = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const bg = inverted ? "#F0EDE8" : "#080808";
  const fg = inverted ? "#080808" : "#F0EDE8";

  return (
    <div
      className="relative w-full h-screen overflow-hidden"
      style={{
        background: bg,
        color: fg,
        fontFamily: 'ui-monospace, "Space Mono", "Menlo", monospace',
        cursor: "none",
      }}
    >
      <div className="fixed inset-0 z-0 pointer-events-none">
        <video
          src="/videos/kage-hero.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background: inverted
              ? "linear-gradient(to bottom, rgba(240,237,232,0.40) 0%, rgba(240,237,232,0.60) 100%)"
              : "linear-gradient(to bottom, rgba(8,8,8,0.45) 0%, rgba(8,8,8,0.65) 100%)",
          }}
        />
      </div>

      <div className="fixed inset-0 z-[1]">
        <Canvas
          camera={{ position: [0, 0.1, 3.6], fov: 50 }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          dpr={[1, 2]}
        >
          <ambientLight intensity={0.5} />
          <pointLight position={[3, 3, 3]} intensity={0.6} color={fg} />

          <Suspense fallback={null}>
            <Skull cursorRef={cursorRef} color={fg} />
          </Suspense>

          <EffectComposer multisampling={0}>
            <SMAA />
            <Bloom
              intensity={0.45}
              luminanceThreshold={0.7}
              luminanceSmoothing={0.4}
              mipmapBlur
            />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <Vignette offset={0.3} darkness={0.5} />
          </EffectComposer>
        </Canvas>
      </div>

      <CustomCursor color={fg} />

      <header className="fixed top-0 left-0 right-0 z-30 grid grid-cols-3 items-center px-8 py-6 pointer-events-none">
        <nav className="flex gap-6 text-[10px] tracking-[0.25em] uppercase opacity-70 pointer-events-auto">
          <a href="#projects" className="hover:opacity-100">
            Projects
          </a>
          <a href="#about" className="hover:opacity-100">
            About
          </a>
        </nav>
        <div className="text-center text-sm tracking-[0.35em] font-medium">
          KAGE
        </div>
        <nav className="flex gap-6 justify-end text-[10px] tracking-[0.25em] uppercase opacity-70 pointer-events-auto">
          <a href="#playground" className="hover:opacity-100">
            Playground
          </a>
          <a href="#contact" className="hover:opacity-100">
            Contact
          </a>
        </nav>
      </header>

      <div className="fixed top-24 left-8 z-20 text-[10px] tracking-[0.22em] uppercase opacity-70 leading-relaxed pointer-events-none">
        {time} TOULON
        <br />
        OVERCAST, 14°
      </div>

      <div className="fixed top-24 right-8 z-20 text-[10px] tracking-[0.22em] uppercase opacity-70 leading-relaxed text-right pointer-events-none">
        CHAPTER 01 / 01
        <br />
        KAGE
      </div>

      <div className="fixed inset-0 z-20 flex flex-col items-center justify-center pointer-events-none text-center">
        <div className="text-[10px] tracking-[0.4em] uppercase opacity-60 mb-3">
          — CHAPTER 01 —
        </div>
        <h1
          className="text-3xl md:text-4xl tracking-[0.15em] font-medium leading-tight mix-blend-difference"
          style={{ color: fg }}
        >
          BUILD IN SILENCE
        </h1>
        <p className="mt-3 text-[10px] tracking-[0.3em] uppercase opacity-60">
          SHIP IN PUBLIC
        </p>
      </div>

      <div className="fixed bottom-8 left-8 z-20 flex items-center gap-3 text-[10px] tracking-[0.25em] uppercase opacity-70 pointer-events-none">
        <span
          className="inline-block w-5 h-5 border flex items-center justify-center text-[8px]"
          style={{ borderColor: fg }}
        >
          ⇧
        </span>
        SHIFT — INVERSE
      </div>

      <div className="fixed bottom-8 right-8 z-20 flex items-center gap-6 text-[10px] tracking-[0.25em] uppercase opacity-60 pointer-events-none">
        <span className="flex gap-4 pointer-events-auto">
          <a href="#" className="hover:opacity-100" aria-label="X">
            ✕
          </a>
          <a href="#" className="hover:opacity-100" aria-label="Instagram">
            ○
          </a>
        </span>
      </div>

      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-20 text-[8px] tracking-[0.3em] uppercase opacity-25 pointer-events-none">
        · vertxia template · kage v1 ·
      </div>
    </div>
  );
}
