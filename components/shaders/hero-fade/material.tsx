"use client";

/**
 * HeroFadeMaterial — ShaderMaterial drei pour le hero plane.
 *
 * Usage :
 *   extend({ HeroFadeMaterial });
 *   <mesh>
 *     <planeGeometry args={[2, 2]} />
 *     <heroFadeMaterial uOpacity={0.5} ... />
 *   </mesh>
 */

import { shaderMaterial } from "@react-three/drei";
import { extend, type ThreeElement } from "@react-three/fiber";
import * as THREE from "three";

import { fragmentShader } from "./fragment";
import { vertexShader } from "./vertex";

export const HeroFadeMaterial = shaderMaterial(
  {
    uTime: 0,
    uOpacity: 1,
    uScroll: 0,
    uColorA: new THREE.Color("#0a0a0a"),
    uColorB: new THREE.Color("#1a1a1a"),
    uColorAccent: new THREE.Color("#e8521a"),
    uResolution: new THREE.Vector2(1, 1),
  },
  vertexShader,
  fragmentShader,
);

extend({ HeroFadeMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    heroFadeMaterial: ThreeElement<typeof HeroFadeMaterial>;
  }
}
