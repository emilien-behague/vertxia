"use client";

import { Suspense, useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  OrbitControls,
  useGLTF,
  ContactShadows,
  Html,
} from "@react-three/drei";
import * as THREE from "three";
import { CinematicEffects } from "@/components/cinematic-effects";

const MODEL_PATH = "/3d/coffee-tek-meuble-tv-180_clean.glb";

// ─── Hook responsive ─────────────────────────────────────────────────────────
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

// ─── Modèle 3D ────────────────────────────────────────────────────────────────
function Product3D({ scale, posY }: { scale: number; posY: number }) {
  const ref = useRef<THREE.Group>(null);
  const { scene } = useGLTF(MODEL_PATH);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.25;
    }
  });

  return (
    <group ref={ref}>
      <primitive object={scene} scale={scale} position={[0, posY, 0]} />
    </group>
  );
}

// ─── Loading state ─────────────────────────────────────────────────────────────
function Loader() {
  return (
    <Html center>
      <div className="text-white/40 text-xs font-mono tracking-widest">
        LOADING 3D MODEL...
      </div>
    </Html>
  );
}

// ─── Scène ────────────────────────────────────────────────────────────────────
export default function TikamoonPreview() {
  const isMobile = useIsMobile();

  // Meuble large/bas → caméra plus éloignée et FOV plus large que sneaker
  const cameraPos: [number, number, number] = isMobile ? [3, 1.5, 10] : [4, 1.5, 7];
  const cameraFov = isMobile ? 36 : 32;
  const modelScale = isMobile ? 0.9 : 1.1;
  const modelPosY = isMobile ? -0.4 : -0.5;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-6 md:p-16">
        <div className="flex justify-between items-start">
          <span className="font-mono text-[10px] md:text-xs tracking-[0.3em] text-white/50">
            VERTXIA · PREVIEW
          </span>
          <span className="font-mono text-[10px] md:text-xs tracking-[0.3em] text-white/50">
            DAY 1
          </span>
        </div>

        {isMobile ? (
          <div className="absolute top-20 left-6 right-6 flex flex-col gap-2">
            <span className="font-mono text-[9px] tracking-[0.4em] text-white/40 uppercase">
              Generated from URL · tikamoon.com
            </span>
            <h1 className="text-6xl font-light leading-none tracking-tighter text-white drop-shadow-2xl">
              TIKAMOON
            </h1>
            <p className="text-xs text-white/60 max-w-xs drop-shadow-lg">
              Page 3D générée en 3 min depuis la fiche produit.
              <br />
              Bientôt : ton site complet, pour 99€/mois.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4">
            <span className="font-mono text-[10px] tracking-[0.4em] text-white/30 uppercase">
              Generated from URL · tikamoon.com
            </span>
            <h1 className="text-[clamp(3rem,9vw,8rem)] font-light leading-none tracking-tighter text-white max-w-[55vw]">
              TIKAMOON
            </h1>
            <p className="text-sm md:text-base text-white/50 max-w-md">
              Page 3D générée en 3 min depuis la fiche produit.
              <br />
              Bientôt : ton site complet, pour 99€/mois.
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
        <color attach="background" args={["#0a0a0a"]} />

        <ambientLight intensity={0.5} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <pointLight position={[-5, 3, -5]} intensity={0.3} color="#ffa56b" />

        <Suspense fallback={<Loader />}>
          <Product3D scale={modelScale} posY={modelPosY} />

          <ContactShadows
            position={[0, -1.0, 0]}
            opacity={0.4}
            scale={6}
            blur={3}
            far={3}
          />

          <Environment files="/hdri/photo_studio_01_4k.hdr" environmentIntensity={0.9} background={false} />

          {/* Cinematic post-processing : ACES tone mapping + bloom + vignette */}
          <CinematicEffects bloom={0.2} vignette={0.3} saturation={0.05} contrast={0.04} />
        </Suspense>

        <OrbitControls
          enableZoom={true}
          enablePan={false}
          autoRotate={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={3}
          maxDistance={15}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_PATH);
