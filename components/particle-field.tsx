"use client";

/**
 * ParticleField — nuage de particules paramétrique pour les "chambres" de l'univers Vertxia.
 *
 * Distinct de WordParticles (qui sample une TextGeometry pour former des mots) :
 *   ParticleField distribue N points selon une fonction (`distribute`) — sphère,
 *   tunnel, spirale, plane, etc. Shader simplifié (pas de morph, pas de burst).
 *
 * Usage :
 *   <ParticleField count={6000} distribute={tunnelDistributor(3, 30)} />
 *
 * Tous les distributors usuels exportés depuis ce fichier.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type Distributor = (i: number, n: number) => [number, number, number];

type Props = {
  count: number;
  distribute: Distributor;
  pointSize?: number;
  colorA?: string;
  colorB?: string;
  position?: [number, number, number];
  /** Vitesse de drift global (Hz approx) */
  driftSpeed?: number;
  /** Amplitude de drift (en unités world) */
  driftAmount?: number;
};

export function ParticleField({
  count,
  distribute,
  pointSize = 1.1,
  colorA = "#A16207",
  colorB = "#FFE3B0",
  position = [0, 0, 0],
  driftSpeed = 1,
  driftAmount = 0.05,
}: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const built = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const [x, y, z] = distribute(i, count);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      seeds[i] = Math.random();
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 100);

    const uniforms = {
      uTime: { value: 0 },
      uPixelRatio: {
        value:
          typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1,
      },
      uPointSize: { value: pointSize },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uDriftSpeed: { value: driftSpeed },
      uDriftAmount: { value: driftAmount },
    };
    return { geom, uniforms };
  }, [count, distribute, pointSize, colorA, colorB, driftSpeed, driftAmount]);

  useFrame((_, dt) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += dt;
    }
  });

  return (
    <points position={position} geometry={built.geom} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        uniforms={built.uniforms}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

const VERTEX = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uPointSize;
  uniform float uDriftSpeed;
  uniform float uDriftAmount;
  varying float vSeed;
  varying float vDepth;

  void main() {
    vSeed = aSeed;
    vec3 pos = position;
    float phase = aSeed * 6.2831;
    pos.x += sin(uTime * 0.35 * uDriftSpeed + phase) * uDriftAmount;
    pos.y += cos(uTime * 0.28 * uDriftSpeed + phase * 1.2) * uDriftAmount;
    pos.z += sin(uTime * 0.22 * uDriftSpeed + phase * 0.8) * uDriftAmount * 1.5;
    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    vDepth = -mvPos.z;
    gl_Position = projectionMatrix * mvPos;
    float size = uPointSize * (0.5 + aSeed * 0.9) * uPixelRatio;
    gl_PointSize = size * (60.0 / max(vDepth, 0.1));
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vSeed;
  varying float vDepth;

  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float halo = pow(core, 3.0);
    vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 1.0, vSeed));
    // Fade quand la particule est devant ou derrière la caméra (effet "passe-à-travers")
    float nearFade = smoothstep(0.0, 1.5, vDepth);
    float depthFade = clamp(1.0 - (vDepth - 6.0) * 0.045, 0.0, 1.0);
    float alpha = halo * nearFade * depthFade * 0.5;
    gl_FragColor = vec4(col, alpha);
  }
`;

/* ─── Distributors usuels ─────────────────────────────────────────────────── */

/**
 * Distribue dans un tunnel cylindrique le long de Z.
 *   radius : rayon du tunnel
 *   length : profondeur (Z étendu de -length/2 à +length/2)
 *   innerRadius : pour creuser le centre (0 = plein, >0 = paroi seule)
 */
export function tunnelDistributor(
  radius: number,
  length: number,
  innerRadius = 0
): Distributor {
  return (i, n) => {
    const angle = Math.random() * Math.PI * 2;
    const r = innerRadius + Math.sqrt(Math.random()) * (radius - innerRadius);
    return [
      Math.cos(angle) * r,
      Math.sin(angle) * r,
      (Math.random() - 0.5) * length,
    ];
  };
}

/** Distribue dans une sphère pleine. */
export function sphereDistributor(radius: number): Distributor {
  return () => {
    const u = Math.random();
    const v = Math.random();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const r = Math.cbrt(Math.random()) * radius;
    return [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    ];
  };
}

/** Distribue dans une coque sphérique (rayon constant ± epsilon). */
export function shellDistributor(radius: number, thickness = 0.2): Distributor {
  return () => {
    const u = Math.random();
    const v = Math.random();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const r = radius + (Math.random() - 0.5) * thickness;
    return [
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi),
    ];
  };
}

/**
 * Vortex / tornade : spirale autour de Z avec rayon variable.
 *   turns : nombre de tours
 *   length : étendue Z
 *   maxRadius : rayon max au bout du vortex
 */
export function vortexDistributor(
  turns: number,
  length: number,
  maxRadius: number
): Distributor {
  return (i, n) => {
    const t = i / n;
    const angle = t * turns * Math.PI * 2 + Math.random() * 0.3;
    const r = maxRadius * (0.15 + Math.random() * 0.85) * t;
    return [
      Math.cos(angle) * r,
      Math.sin(angle) * r,
      (t - 0.5) * length + (Math.random() - 0.5) * 0.4,
    ];
  };
}

/** Plane horizontal : sol de particules. */
export function planeDistributor(
  width: number,
  depth: number,
  yOffset = 0
): Distributor {
  return () => [
    (Math.random() - 0.5) * width,
    yOffset + (Math.random() - 0.5) * 0.3,
    (Math.random() - 0.5) * depth,
  ];
}
