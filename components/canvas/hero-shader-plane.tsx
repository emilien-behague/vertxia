"use client";

/**
 * HeroShaderPlane — plane fullscreen shader pour le hero d'un template /lite/.
 *
 * Pattern basement (#1 + #2) :
 *  - Injecte un mesh dans le Canvas global via <WebGlTunnelIn>
 *  - frameloop="demand" : on appelle invalidate() chaque frame TANT que visible
 *    (sinon le canvas stop le RAF et le shader fige)
 *  - uTime anime en continu, uScroll lit le scroll Lenis si dispo
 *
 * Le composant N'A PAS de DOM cote page : il monte juste un mesh dans
 * le Canvas. Le hero DOM continue de vivre par-dessus (z-index > 0).
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { WebGlTunnelIn } from "@/components/canvas/tunnel";
import { HeroFadeMaterial } from "@/components/shaders/hero-fade/material";

type Props = {
  colorA?: string;
  colorB?: string;
  colorAccent?: string;
  opacity?: number;
  active?: boolean;
};

function HeroPlane({ colorA, colorB, colorAccent, opacity = 1, active = true }: Props) {
  const matRef = useRef<InstanceType<typeof HeroFadeMaterial>>(null);
  const { invalidate, size, viewport, camera } = useThree();

  useEffect(() => {
    if (matRef.current) {
      if (colorA) matRef.current.uColorA = new THREE.Color(colorA);
      if (colorB) matRef.current.uColorB = new THREE.Color(colorB);
      if (colorAccent) matRef.current.uColorAccent = new THREE.Color(colorAccent);
      matRef.current.uOpacity = opacity;
      matRef.current.uResolution = new THREE.Vector2(size.width, size.height);
    }
    invalidate();
  }, [colorA, colorB, colorAccent, opacity, size.width, size.height, invalidate]);

  useFrame((state) => {
    if (!active) return;
    if (matRef.current) {
      matRef.current.uTime = state.clock.elapsedTime;
      matRef.current.uScroll = (typeof window !== "undefined")
        ? window.scrollY / Math.max(1, window.innerHeight)
        : 0;
    }
    invalidate();
  });

  // Calcule la taille du plane pour couvrir le viewport a z=0
  const distance = camera.position.z;
  const planeHeight = 2 * Math.tan((camera as THREE.PerspectiveCamera).fov * 0.5 * Math.PI / 180) * distance;
  const planeWidth = planeHeight * (size.width / size.height);

  return (
    <mesh position={[0, 0, 0]} renderOrder={-1}>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <heroFadeMaterial ref={matRef} transparent depthWrite={false} />
    </mesh>
  );
}

export function HeroShaderPlane(props: Props) {
  return (
    <WebGlTunnelIn>
      <HeroPlane {...props} />
    </WebGlTunnelIn>
  );
}
