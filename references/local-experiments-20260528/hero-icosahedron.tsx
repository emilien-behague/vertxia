"use client";

import { Suspense, useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, MeshTransmissionMaterial, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { useTimeOfDay } from "@/lib/use-time-of-day";
import { CinematicEffects } from "@/components/cinematic-effects";

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

function IcosahedronMesh({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.18;
    ref.current.rotation.x += delta * 0.07;
  });

  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.6, 0]} />
      <MeshTransmissionMaterial
        color={color}
        thickness={0.9}
        roughness={0.05}
        transmission={1}
        ior={1.45}
        chromaticAberration={0.08}
        anisotropy={0.5}
        distortion={0.3}
        distortionScale={0.4}
        temporalDistortion={0.15}
        backside
      />
    </mesh>
  );
}

export function HeroIcosahedron() {
  const { palette, mounted } = useTimeOfDay();
  const isMobile = useIsMobile();

  if (!mounted || isMobile) return null;

  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none z-0"
      aria-hidden
    >
      <Canvas
        camera={{ position: [0, 0, 6.5], fov: 35 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} />
        <pointLight position={[-3, 2, -3]} intensity={0.7} color={palette.accent} />
        <pointLight position={[3, -2, 2]} intensity={0.4} color={palette.fg} />

        <Suspense fallback={null}>
          <Float speed={0.6} rotationIntensity={0.3} floatIntensity={0.4}>
            <IcosahedronMesh color={palette.accent} />
          </Float>
          <Sparkles
            count={30}
            scale={5}
            size={2}
            speed={0.25}
            opacity={0.6}
            color={palette.accent}
            noise={0.6}
          />
          <Environment preset="city" />
        </Suspense>

        <CinematicEffects
          bloom={0.35}
          vignette={0.15}
          filmGrain={0.15}
          chromaticAberration={0.0015}
        />
      </Canvas>
    </div>
  );
}
