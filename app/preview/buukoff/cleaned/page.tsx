"use client";

// Page de comparaison Meshy UHQ original vs Meshy UHQ + Blender postprocess.
// Modele : /3d/dbz-trunks_cleaned.glb (20 MB, 4225 artefacts supprimes, base detectee)
// vs /preview/buukoff qui charge /3d/dbz-trunks_uhq.glb (24 MB, raw Meshy)
// Meme scene/lighting/effects pour comparaison juste.

import { Suspense, useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  OrbitControls,
  useGLTF,
  ContactShadows,
  Html,
  Sparkles,
} from "@react-three/drei";
import * as THREE from "three";
import { CinematicEffects } from "@/components/cinematic-effects";

const MODEL_PATH = "/3d/dbz-trunks_cleaned.glb";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

function Product3D({ scale, posY }: { scale: number; posY: number }) {
  const ref = useRef<THREE.Group>(null);
  const { scene } = useGLTF(MODEL_PATH);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.4;
    }
  });

  return (
    <group ref={ref}>
      <primitive object={scene} scale={scale} position={[0, posY, 0]} />
    </group>
  );
}

function Loader() {
  return (
    <Html center>
      <div className="text-white/40 text-xs font-mono tracking-widest">
        LOADING CLEANED MODEL...
      </div>
    </Html>
  );
}

export default function BuuKoffCleanedCompare() {
  const isMobile = useIsMobile();

  const cameraPos: [number, number, number] = isMobile ? [2, 1.5, 8] : [3, 1.5, 5.5];
  const cameraFov = isMobile ? 32 : 28;
  const modelScale = isMobile ? 1.1 : 1.5;
  const modelPosY = isMobile ? -0.5 : -0.7;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-6 md:p-16">
        <div className="flex justify-between items-start">
          <span className="font-mono text-[10px] md:text-xs tracking-[0.3em] text-white/50">
            VERTXIA · POSTPROCESS
          </span>
          <span className="font-mono text-[10px] md:text-xs tracking-[0.3em] text-cyan-400">
            BLENDER CLEANED · -15%
          </span>
        </div>

        {isMobile ? (
          <div className="absolute top-20 left-6 right-6 flex flex-col gap-2">
            <span className="font-mono text-[9px] tracking-[0.4em] text-cyan-400/80 uppercase">
              Meshy + Blender · 20 MB
            </span>
            <h1 className="text-4xl font-light leading-none tracking-tighter text-white drop-shadow-2xl">
              CLEANED
            </h1>
            <p className="text-xs text-white/60 max-w-xs drop-shadow-lg">
              4225 artefacts supprimés (90% noise).
              <br />
              <a href="/preview/buukoff" className="text-cyan-400 underline pointer-events-auto">/preview/buukoff (raw Meshy, 24 MB)</a>
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4">
            <span className="font-mono text-[10px] tracking-[0.4em] text-cyan-400/80 uppercase">
              Meshy UHQ + Blender postprocess · 20 MB · 476 composantes utiles
            </span>
            <h1 className="text-[clamp(3rem,9vw,8rem)] font-light leading-none tracking-tighter text-white max-w-[55vw]">
              CLEANED
            </h1>
            <p className="text-sm md:text-base text-white/50 max-w-md">
              4225 artefacts mesh supprimés (90% noise). Base auto-détectée.{" "}
              <a href="/preview/buukoff" className="text-cyan-400 underline pointer-events-auto">
                Compare avec /preview/buukoff (raw Meshy, 24 MB, 4711 composantes)
              </a>
            </p>
          </div>
        )}

        <div className="flex justify-between items-end">
          <span className="font-mono text-[10px] md:text-xs tracking-[0.2em] text-white/40">
            vertxia.com
          </span>
          <span className="font-mono text-[10px] md:text-xs tracking-[0.2em] text-white/40 hidden md:block">
            drag · rotate
          </span>
        </div>
      </div>

      {isMobile && (
        <div
          className="absolute top-0 left-0 right-0 h-[40vh] z-20 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0) 100%)",
          }}
        />
      )}

      <Canvas
        camera={{ position: cameraPos, fov: cameraFov }}
        gl={{ antialias: true, alpha: false }}
        shadows
        dpr={[1, 2]}
      >
        <color attach="background" args={["#0a0612"]} />
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
        <pointLight position={[-4, 3, -4]} intensity={1.4} color="#a855f7" distance={15} />
        <pointLight position={[4, 5, -3]} intensity={0.7} color="#22d3ee" distance={12} />
        <pointLight position={[3, -1, 4]} intensity={0.25} color="#fb923c" />

        <Suspense fallback={<Loader />}>
          <Product3D scale={modelScale} posY={modelPosY} />

          <ContactShadows
            position={[0, -1.2, 0]}
            opacity={0.4}
            scale={6}
            blur={3}
            far={3}
          />

          <Sparkles count={120} size={2.5} speed={0.3} scale={[14, 16, 14]} opacity={0.55} color="#ffd700" />

          <Environment preset="night" environmentIntensity={0.55} />

          <CinematicEffects bloom={0.35} vignette={0.35} saturation={0.08} contrast={0.04} />
        </Suspense>

        <OrbitControls
          enableZoom={true}
          enablePan={false}
          autoRotate={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={3}
          maxDistance={12}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_PATH);
