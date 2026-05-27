"use client";

/**
 * WordParticles — texte 3D formé par un nuage de particules GPU.
 *
 * Concept (cf. Magic Window Dow Jones experience, frames analysées 27/05/2026) :
 *   - Chaque mot est échantillonné en N points sur la surface de sa TextGeometry
 *   - Tous les nuages sont préchargés au mount (un Float32Array par mot)
 *   - Quand `activeIndex` change, on lerp particle-by-particle entre 2 nuages
 *     via uniform GPU (`uMorph` 0→1), pas de réécriture CPU pendant la transition
 *   - Custom shader : depth-aware soft sprite, drift per-particle, palette gold/cream
 *
 * Pourquoi pas Text3D drei : on veut des particules, pas un mesh solide.
 *   Text3D renderait des lettres en MeshStandardMaterial — on perd l'aesthetic
 *   particle cloud de Magic Window / Active Theory.
 *
 * Perf : 40k particules × N mots préchargés au mount. À 60fps tant que le shader
 *   reste simple (pas de raymarching, juste sin/cos drift + radial alpha).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

const FONT_URL = "/fonts/helvetiker_bold.typeface.json";
const PARTICLES_PER_WORD = 40000;
const MORPH_DURATION = 1.4; // secondes pour la transition entre 2 mots (laisse voir la dispersion)

type Props = {
  words: string[];
  activeIndex: number;
  pointSize?: number;
};

export function WordParticles({ words, activeIndex, pointSize = 1.2 }: Props) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const [wordArrays, setWordArrays] = useState<Float32Array[] | null>(null);

  // Morph state — driven dans useFrame, pas dans React (perf)
  const morphProgressRef = useRef(1);
  const wasMorphingRef = useRef(false);

  // Charger la police + échantillonner tous les mots une fois
  useEffect(() => {
    let cancelled = false;
    const loader = new FontLoader();
    loader.load(FONT_URL, (font) => {
      if (cancelled) return;
      const arrays = words.map((w) => sampleWord(font, w, PARTICLES_PER_WORD));
      setWordArrays(arrays);
    });
    return () => {
      cancelled = true;
    };
  }, [words]);

  // Géométrie + uniforms construits une fois quand les samples sont prêts
  const built = useMemo(() => {
    if (!wordArrays) return null;
    const init = wordArrays[Math.min(activeIndex, wordArrays.length - 1)];
    const positionArr = new Float32Array(init);
    const targetA = new Float32Array(init);
    const targetB = new Float32Array(init);
    const seeds = new Float32Array(PARTICLES_PER_WORD);
    for (let i = 0; i < PARTICLES_PER_WORD; i++) seeds[i] = Math.random();

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positionArr, 3));
    geom.setAttribute("aTargetA", new THREE.BufferAttribute(targetA, 3));
    geom.setAttribute("aTargetB", new THREE.BufferAttribute(targetB, 3));
    geom.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 10);

    const uniforms = {
      uTime: { value: 0 },
      uMorph: { value: 1 },
      uPixelRatio: {
        value: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1,
      },
      uPointSize: { value: pointSize },
      uDispersion: { value: 1.0 },
      uColorA: { value: new THREE.Color("#A16207") },
      uColorB: { value: new THREE.Color("#FFE3B0") },
      uColorBurst: { value: new THREE.Color("#FF9E55") },
    };
    return { geom, uniforms };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordArrays]);

  // Au changement d'activeIndex : swap les targets, reset progress
  useEffect(() => {
    if (!built || !wordArrays || !pointsRef.current) return;
    const geom = pointsRef.current.geometry as THREE.BufferGeometry;
    const pos = geom.getAttribute("position") as THREE.BufferAttribute;
    const tA = geom.getAttribute("aTargetA") as THREE.BufferAttribute;
    const tB = geom.getAttribute("aTargetB") as THREE.BufferAttribute;

    // Le "from" devient l'état courant des particules (pour fluide)
    (tA.array as Float32Array).set(pos.array as Float32Array);
    tA.needsUpdate = true;
    // Le "to" = nouveau mot
    (tB.array as Float32Array).set(wordArrays[activeIndex]);
    tB.needsUpdate = true;

    morphProgressRef.current = 0;
    wasMorphingRef.current = true;
  }, [activeIndex, built, wordArrays]);

  useFrame((_, dt) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value += dt;

    if (wasMorphingRef.current) {
      morphProgressRef.current = Math.min(1, morphProgressRef.current + dt / MORPH_DURATION);
      matRef.current.uniforms.uMorph.value = morphProgressRef.current;

      if (morphProgressRef.current >= 1 && pointsRef.current) {
        // Baker l'état final sur position pour préparer le prochain morph
        const geom = pointsRef.current.geometry as THREE.BufferGeometry;
        const pos = geom.getAttribute("position") as THREE.BufferAttribute;
        const tB = geom.getAttribute("aTargetB") as THREE.BufferAttribute;
        (pos.array as Float32Array).set(tB.array as Float32Array);
        pos.needsUpdate = true;
        // Reset uniform pour que tA = position et morph = 0 partent du même endroit
        matRef.current.uniforms.uMorph.value = 1;
        wasMorphingRef.current = false;
      }
    }
  });

  if (!built) return null;

  return (
    <points ref={pointsRef} geometry={built.geom} frustumCulled={false}>
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

/* ─── Sampling : TextGeometry → nuage de points ───────────────────────────── */

function sampleWord(font: Font, text: string, n: number): Float32Array {
  const geom = new TextGeometry(text, {
    font,
    size: 1,
    depth: 0.32,
    curveSegments: 6,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.03,
    bevelOffset: 0,
    bevelSegments: 2,
  }) as unknown as THREE.BufferGeometry;

  geom.computeBoundingBox();
  const bbox = geom.boundingBox!;
  const cx = (bbox.min.x + bbox.max.x) / 2;
  const cy = (bbox.min.y + bbox.max.y) / 2;
  const cz = (bbox.min.z + bbox.max.z) / 2;
  geom.translate(-cx, -cy, -cz);

  // MeshSurfaceSampler refuse certains attributs — on simplifie
  geom.deleteAttribute("normal");
  geom.deleteAttribute("uv");

  const mesh = new THREE.Mesh(geom);
  const sampler = new MeshSurfaceSampler(mesh).build();
  const out = new Float32Array(n * 3);
  const tmp = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    sampler.sample(tmp);
    out[i * 3] = tmp.x;
    out[i * 3 + 1] = tmp.y;
    out[i * 3 + 2] = tmp.z;
  }
  geom.dispose();
  return out;
}

/* ─── Shaders ─────────────────────────────────────────────────────────────── */

const VERTEX = /* glsl */ `
  attribute vec3 aTargetA;
  attribute vec3 aTargetB;
  attribute float aSeed;
  uniform float uTime;
  uniform float uMorph;
  uniform float uPixelRatio;
  uniform float uPointSize;
  uniform float uDispersion;
  varying float vSeed;
  varying float vDepth;
  varying float vDispersion;

  // Hash 1D → 3D pseudo-random direction (stable par seed)
  vec3 hashDir(float s) {
    float a = sin(s * 17.31) * 43758.5453;
    float b = sin(s * 23.57) * 12543.7531;
    float c = sin(s * 31.19) * 65437.8217;
    return normalize(vec3(fract(a) - 0.5, fract(b) - 0.5, fract(c) - 0.5));
  }

  void main() {
    vSeed = aSeed;
    float t = smoothstep(0.0, 1.0, uMorph);
    vec3 pos = mix(aTargetA, aTargetB, t);

    // Dispersion organique pendant le morph : pic à t=0.5, retour à 0 en début/fin
    // sin(t*π) donne une cloche. Direction aléatoire stable par particule.
    float burst = sin(uMorph * 3.14159265);
    vec3 dir = hashDir(aSeed * 7.7 + 0.13);
    // Magnitude module par seed pour varier l'amplitude par particule
    float mag = (0.18 + aSeed * 0.55) * uDispersion;
    pos += dir * burst * mag;
    vDispersion = burst;

    // Drift continu pour vie organique (même quand pas en morph)
    float phase = aSeed * 6.2831;
    pos.x += sin(uTime * 0.35 + phase) * 0.012;
    pos.y += cos(uTime * 0.28 + phase * 1.2) * 0.012;
    pos.z += sin(uTime * 0.22 + phase * 0.8) * 0.018;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    vDepth = -mvPos.z;
    gl_Position = projectionMatrix * mvPos;

    float size = uPointSize * (0.6 + aSeed * 0.8) * uPixelRatio;
    // Particules grossissent légèrement pendant la dispersion (effet poussière)
    size *= 1.0 + burst * 0.4;
    gl_PointSize = size * (60.0 / max(vDepth, 0.1));
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorBurst;
  varying float vSeed;
  varying float vDepth;
  varying float vDispersion;

  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    // Soft radial falloff — coeur dense, halo doux mais resserré
    float core = smoothstep(0.5, 0.0, d);
    float halo = pow(core, 3.2);
    // Couleur warm gold → cream selon seed (variation per-particle)
    vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 1.0, vSeed));
    // Particules en dispersion virent vers la couleur burst (cream brûlée)
    col = mix(col, uColorBurst, vDispersion * 0.45);
    // Atmospheric perspective : fade en profondeur — disparition totale à ~30u
    // (sinon le mot d'une chambre éloignée reste visible depuis l'entrée)
    float depthFade = clamp(1.0 - (vDepth - 2.0) * 0.035, 0.0, 1.0);
    // Alpha bas pour que l'accumulation additive ne sature pas au centre du mot
    // (mobile : densité par pixel plus haute à cause du scale → baisser ici)
    float alpha = halo * depthFade * 0.32;
    gl_FragColor = vec4(col, alpha);
  }
`;
