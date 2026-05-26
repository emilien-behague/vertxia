"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  OrbitControls,
  useGLTF,
  ContactShadows,
  Html,
} from "@react-three/drei";
import * as THREE from "three";

const MODEL_PATH = "/3d/wool-runner.glb";

// ─── Modèle 3D ────────────────────────────────────────────────────────────────
function Product3D() {
  const ref = useRef<THREE.Group>(null);
  const { scene } = useGLTF(MODEL_PATH);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.25;
    }
  });

  return (
    <group ref={ref}>
      <primitive object={scene} scale={1.3} position={[0, -0.3, 0]} />
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
export default function LoomPreview() {
  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Overlay branding */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-8 md:p-16">
        {/* Top: Vertxia tag */}
        <div className="flex justify-between items-start">
          <span className="font-mono text-xs tracking-[0.3em] text-white/40">
            VERTXIA · PREVIEW
          </span>
          <span className="font-mono text-xs tracking-[0.3em] text-white/40">
            DAY 2
          </span>
        </div>

        {/* Center: Brand name overlay */}
        <div className="flex flex-col items-start gap-4">
          <span className="font-mono text-[10px] tracking-[0.4em] text-white/30 uppercase">
            Generated from URL · loom.fr
          </span>
          <h1 className="text-[clamp(4rem,15vw,12rem)] font-light leading-none tracking-tighter text-white">
            LOOM
          </h1>
          <p className="text-sm md:text-base text-white/50 max-w-md">
            Site 3D généré automatiquement à partir d&apos;une URL Shopify.
            <br />
            Sans agence. En 30 minutes. Pour 99€/mois.
          </p>
        </div>

        {/* Bottom: footer */}
        <div className="flex justify-between items-end">
          <span className="font-mono text-xs tracking-[0.2em] text-white/30">
            vertxia.com
          </span>
          <span className="font-mono text-xs tracking-[0.2em] text-white/30 hidden md:block">
            drag · rotate
          </span>
        </div>
      </div>

      {/* Scène 3D */}
      <Canvas
        camera={{ position: [3, 1, 6], fov: 28 }}
        gl={{ antialias: true, alpha: false }}
        shadows
        dpr={[1, 2]}
      >
        <color attach="background" args={["#0a0a0a"]} />

        {/* Lighting doux + HDRI */}
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
          <Product3D />

          <ContactShadows
            position={[0, -1.0, 0]}
            opacity={0.4}
            scale={6}
            blur={3}
            far={3}
          />

          {/* Environment apporte la majorité du lighting réaliste */}
          <Environment preset="studio" environmentIntensity={1.0} />
        </Suspense>

        <OrbitControls
          enableZoom={true}
          enablePan={false}
          autoRotate={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={3}
          maxDistance={10}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload(MODEL_PATH);
