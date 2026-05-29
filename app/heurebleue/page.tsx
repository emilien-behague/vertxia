"use client";

/**
 * L'Heure Bleue — Site immersif Vertxia.
 *
 * Concept : pas une boutique, une **traversée** dans l'heure exacte où la
 * lumière du jour rencontre celle de la nuit. 13 chambres scroll-driven,
 * camera Z-axiale + micro-roll velocity-driven, brume olfactive globale
 * 200k particules, géométries signature per-sillage avec materials custom
 * (iridescent / metallic / transmission), audio drone Web Audio API natif
 * + chimes ADSR per-chambre, cursor custom point-doré-attractor, easter
 * eggs (Konami / hold ESC / heure réelle), mobile différencié.
 *
 * Architecture :
 *   - Canvas R3F fixed inset-0 (pointer-events-none pour laisser le scroll)
 *   - Page scrollable 1300vh = 13 chambres × 100vh
 *   - scrollRef updated par Lenis raf loop
 *   - R3F camera lit scrollRef et avance en Z
 *   - HTML overlays positionnés via scroll-snap des sections
 *
 * Référence visuelle : Magic Window (Active Theory), Lusion immersive,
 * Bruno Simon's portfolio. Mais palette spécifique heure bleue (bleu
 * nuit profond #050B1F + or vieilli #C9A668 + crème chaude #F4EFE5).
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type MutableRefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import Lenis from "lenis";
import { motion, AnimatePresence } from "framer-motion";
import { CinematicEffects } from "@/components/cinematic-effects";
import {
  SILLAGES,
  PALETTE,
  CHAMBRES_Z,
  TOTAL_DEPTH,
  SCROLL_HEIGHT_VH,
  SCROLL_WORDS,
  getIntroByHour,
  type Sillage,
} from "./lib/sillages";
import { getAudioEngine } from "./lib/audio-engine";

/* ═══════════════════════════════════════════════════════════════════════════
 * UTILITAIRES
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Mobile detection — réduit particules + désactive audio par défaut. */
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

/* ═══════════════════════════════════════════════════════════════════════════
 * CAMERA — Z-axiale scroll-driven + micro-roll velocity
 * ═══════════════════════════════════════════════════════════════════════════ */

function ScrollCamera({
  scrollRef,
}: {
  scrollRef: MutableRefObject<number>;
}) {
  const { camera } = useThree();
  const currentZ = useRef(0);
  const currentRoll = useRef(0);
  const lastScroll = useRef(0);
  const velocityRef = useRef(0);

  useFrame((_, dt) => {
    // startZ=0 (vs 4 avant) → la caméra atterrit EXACTEMENT sur CHAMBRES_Z[X]
    // quand la section X est au top du viewport. Cf. lib/sillages.ts calculs.
    const targetZ = -scrollRef.current * TOTAL_DEPTH;
    const alpha = Math.min(1, dt * 4.5);
    currentZ.current += (targetZ - currentZ.current) * alpha;

    // Calcul velocity du scroll → micro-roll (effet tangage)
    const delta = scrollRef.current - lastScroll.current;
    lastScroll.current = scrollRef.current;
    velocityRef.current += (delta * 60 - velocityRef.current) * 0.08;
    const targetRoll = THREE.MathUtils.clamp(velocityRef.current * 0.4, -0.026, 0.026);
    currentRoll.current += (targetRoll - currentRoll.current) * 0.06;

    camera.position.set(0, 0, currentZ.current);
    camera.rotation.set(0, 0, currentRoll.current);
  });

  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * BRUME OLFACTIVE GLOBALE — 200k particules (60k mobile)
 *
 * Matière de l'air à l'heure bleue. Pas des étoiles (cliché) — du pollen
 * suspendu, des cendres dorées, des éclats microscopiques. Drift Perlin
 * via sin/cos phasés par seed. Couleur dominante or vieilli, variance
 * per-particle vers crème + bleu pâle.
 * ═══════════════════════════════════════════════════════════════════════════ */

function BrumeGlobale({ count }: { count: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  // Positions distribuées dans le tunnel d'avancée camera (Z négatifs)
  // Distribution plus serrée autour de l'axe camera pour densité brume (vs étoiles)
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Distribution cylindrique resserrée pour effet "brouillard dense"
      // 80% des particules à radius 2-8 (proche camera), 20% à 8-14 (lointaines)
      const t = Math.random();
      const radius = t < 0.8 ? 1.5 + Math.random() * 6.5 : 8 + Math.random() * 6;
      const theta = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 18;
      positions[i * 3 + 2] = -Math.random() * (TOTAL_DEPTH + 30);
      seeds[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -TOTAL_DEPTH / 2), TOTAL_DEPTH);
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: {
        value: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1,
      },
      uColorOr: { value: new THREE.Color(PALETTE.or) },
      uColorCreme: { value: new THREE.Color(PALETTE.creme) },
      uColorBleuPale: { value: new THREE.Color("#7A8DB8") },
    }),
    []
  );

  useFrame((_, dt) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += dt;
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={BRUME_VERTEX}
        fragmentShader={BRUME_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

const BRUME_VERTEX = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vSeed;
  varying float vDepth;

  void main() {
    vSeed = aSeed;
    vec3 pos = position;
    // Drift TRÈS subtle — les particules bougent juste assez pour vivre,
    // sans devenir un carnaval de bokehs colorés.
    float phase = aSeed * 6.2831;
    pos.x += sin(uTime * 0.18 + phase) * 0.12;
    pos.y += cos(uTime * 0.22 + phase * 1.3) * 0.15;
    pos.z += sin(uTime * 0.14 + phase * 0.7) * 0.08;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    vDepth = -mvPos.z;
    gl_Position = projectionMatrix * mvPos;

    // Taille réduite — fine poussière, pas bulles de savon.
    // Range 0.4-1.4 (vs 1.6-5.0 trop gros, vs 0.6-1.8 d'origine)
    float size = (0.4 + aSeed * 1.0) * uPixelRatio;
    gl_PointSize = size * (40.0 / max(vDepth, 0.1));
  }
`;

const BRUME_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uColorOr;
  uniform vec3 uColorCreme;
  uniform vec3 uColorBleuPale;
  varying float vSeed;
  varying float vDepth;

  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float halo = pow(core, 2.5);

    // Palette resserée : or vieilli + crème.
    // Pas de bleu, pas de variance criarde — l'unité fait la noblesse.
    vec3 col = mix(uColorOr, uColorCreme, smoothstep(0.0, 1.0, vSeed));

    // Alpha BAS pour que ce soit une brume diffuse, pas des fireflies.
    float depthFade = clamp(1.0 - (vDepth - 4.0) * 0.018, 0.0, 1.0);
    float alpha = halo * depthFade * 0.12;
    gl_FragColor = vec4(col, alpha);
  }
`;

/* ═══════════════════════════════════════════════════════════════════════════
 * WORDPARTICLES OR — texte qui se forme en particules dorées
 *
 * Variant du composant /demo, adapté palette or vieilli + cremes.
 * Sample d'une TextGeometry en N points + morph via aTargetA/aTargetB.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

function WordParticlesOr({
  words,
  activeIndex,
  pointSize = 1.4,
  scale = 1,
  particlesPerWord = 28000,
}: {
  words: string[];
  activeIndex: number;
  pointSize?: number;
  scale?: number;
  particlesPerWord?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const [wordArrays, setWordArrays] = useState<Float32Array[] | null>(null);

  const morphProgressRef = useRef(1);
  const wasMorphingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const loader = new FontLoader();
    loader.load("/fonts/helvetiker_bold.typeface.json", (font) => {
      if (cancelled) return;
      const arrays = words.map((w) => sampleWord(font, w, particlesPerWord));
      setWordArrays(arrays);
    });
    return () => {
      cancelled = true;
    };
  }, [words, particlesPerWord]);

  const built = useMemo(() => {
    if (!wordArrays) return null;
    const init = wordArrays[Math.min(activeIndex, wordArrays.length - 1)];
    const positionArr = new Float32Array(init);
    const targetA = new Float32Array(init);
    const targetB = new Float32Array(init);
    const seeds = new Float32Array(particlesPerWord);
    for (let i = 0; i < particlesPerWord; i++) seeds[i] = Math.random();

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
      uColorA: { value: new THREE.Color(PALETTE.or) },
      uColorB: { value: new THREE.Color(PALETTE.cremeTiede) },
      uColorBurst: { value: new THREE.Color(PALETTE.orChaud) },
    };
    return { geom, uniforms };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordArrays]);

  useEffect(() => {
    if (!built || !wordArrays || !pointsRef.current) return;
    const geom = pointsRef.current.geometry as THREE.BufferGeometry;
    const pos = geom.getAttribute("position") as THREE.BufferAttribute;
    const tA = geom.getAttribute("aTargetA") as THREE.BufferAttribute;
    const tB = geom.getAttribute("aTargetB") as THREE.BufferAttribute;

    (tA.array as Float32Array).set(pos.array as Float32Array);
    tA.needsUpdate = true;
    (tB.array as Float32Array).set(wordArrays[activeIndex]);
    tB.needsUpdate = true;

    morphProgressRef.current = 0;
    wasMorphingRef.current = true;
  }, [activeIndex, built, wordArrays]);

  useFrame((_, dt) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value += dt;

    if (wasMorphingRef.current) {
      morphProgressRef.current = Math.min(1, morphProgressRef.current + dt / 1.4);
      matRef.current.uniforms.uMorph.value = morphProgressRef.current;
      if (morphProgressRef.current >= 1 && pointsRef.current) {
        const geom = pointsRef.current.geometry as THREE.BufferGeometry;
        const pos = geom.getAttribute("position") as THREE.BufferAttribute;
        const tB = geom.getAttribute("aTargetB") as THREE.BufferAttribute;
        (pos.array as Float32Array).set(tB.array as Float32Array);
        pos.needsUpdate = true;
        matRef.current.uniforms.uMorph.value = 1;
        wasMorphingRef.current = false;
      }
    }
  });

  if (!built) return null;

  return (
    <points ref={pointsRef} geometry={built.geom} frustumCulled={false} scale={scale}>
      <shaderMaterial
        ref={matRef}
        uniforms={built.uniforms}
        vertexShader={WORD_VERTEX}
        fragmentShader={WORD_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

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

const WORD_VERTEX = /* glsl */ `
  attribute vec3 aTargetA;
  attribute vec3 aTargetB;
  attribute float aSeed;
  uniform float uTime;
  uniform float uMorph;
  uniform float uPixelRatio;
  uniform float uPointSize;
  varying float vSeed;
  varying float vDepth;
  varying float vDispersion;

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

    float burst = sin(uMorph * 3.14159265);
    vec3 dir = hashDir(aSeed * 7.7 + 0.13);
    float mag = (0.16 + aSeed * 0.5);
    pos += dir * burst * mag;
    vDispersion = burst;

    float phase = aSeed * 6.2831;
    pos.x += sin(uTime * 0.32 + phase) * 0.014;
    pos.y += cos(uTime * 0.25 + phase * 1.2) * 0.014;
    pos.z += sin(uTime * 0.2 + phase * 0.8) * 0.02;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    vDepth = -mvPos.z;
    gl_Position = projectionMatrix * mvPos;

    float size = uPointSize * (0.6 + aSeed * 0.8) * uPixelRatio;
    size *= 1.0 + burst * 0.4;
    gl_PointSize = size * (60.0 / max(vDepth, 0.1));
  }
`;

const WORD_FRAGMENT = /* glsl */ `
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
    float core = smoothstep(0.5, 0.0, d);
    float halo = pow(core, 3.0);
    vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 1.0, vSeed));
    col = mix(col, uColorBurst, vDispersion * 0.5);
    float depthFade = clamp(1.0 - (vDepth - 2.0) * 0.04, 0.0, 1.0);
    // Alpha bas pour subtilité — additive blending = accumulation visible
    float alpha = halo * depthFade * 0.22;
    gl_FragColor = vec4(col, alpha);
  }
`;

/* ═══════════════════════════════════════════════════════════════════════════
 * ESSENCE — géométrie signature per-sillage
 *
 * Chaque sillage a une signature 3D unique :
 *   - NUMEN : sphère sacrée, blanc nacré → IcosahedronGeometry + iridescent
 *   - VESPRE : tor sombre métal oxydé → TorusKnotGeometry + metal
 *   - LUMIEL : disque solaire doré → TorusGeometry thin + emissive
 *   - SOLÈNE : lotus cristallin → DodecahedronGeometry + transmission
 *   - CENDRE : pierre brûlée → IcosahedronGeometry + displacement rough
 *   - ORÉE : cristal forestier → OctahedronGeometry + transmission vert
 *
 * Toutes flottent (sin Y) + tournent (Y axis) avec phase décalée.
 * ═══════════════════════════════════════════════════════════════════════════ */

function Essence({
  sillage,
  position,
}: {
  sillage: Sillage;
  position: [number, number, number];
}) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const tRef = useRef(Math.random() * 10);

  useFrame((_, dt) => {
    tRef.current += dt;
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(tRef.current * 0.5) * 0.25;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = tRef.current * 0.3;
      innerRef.current.rotation.x = Math.sin(tRef.current * 0.2) * 0.1;
    }
  });

  // Géométrie + material par sillage
  const { geometry, material } = useMemo(() => {
    const accent = new THREE.Color(sillage.palette.accent);
    const glow = new THREE.Color(sillage.palette.glow);
    switch (sillage.geometry) {
      case "sphere": // NUMEN — iridescent sacré (refined : moins brûlant, plus contrôlé)
        return {
          geometry: new THREE.IcosahedronGeometry(1.4, 4),
          material: new THREE.MeshPhysicalMaterial({
            color: 0xc8d8e8, // bleu nuit froid (vs blanc pur → moins de bloom out)
            roughness: 0.35,
            metalness: 0.45,
            iridescence: 1.0,
            iridescenceIOR: 1.4,
            iridescenceThicknessRange: [120, 480],
            envMapIntensity: 0.9,
            emissive: 0x000000,
            emissiveIntensity: 0,
          }),
        };
      case "torus": // VESPRE — tor métal sombre ambré
        return {
          geometry: new THREE.TorusKnotGeometry(1, 0.32, 200, 28, 2, 3),
          material: new THREE.MeshPhysicalMaterial({
            color: 0x4a2818,
            roughness: 0.35,
            metalness: 1.0,
            emissive: accent,
            emissiveIntensity: 0.45,
            envMapIntensity: 1.8,
          }),
        };
      case "disc": // LUMIEL — disque solaire doré (épaisseur ↑ pour présence)
        return {
          geometry: new THREE.TorusGeometry(1.6, 0.14, 64, 128),
          material: new THREE.MeshPhysicalMaterial({
            color: accent,
            roughness: 0.08,
            metalness: 1.0,
            emissive: accent,
            emissiveIntensity: 1.2,
            envMapIntensity: 1.8,
          }),
        };
      case "lotus": // SOLÈNE — lotus cristallin (transmission + emissive ↑ pour lisibilité)
        return {
          geometry: new THREE.DodecahedronGeometry(1.5, 0),
          material: new THREE.MeshPhysicalMaterial({
            color: 0xe8eff5,
            roughness: 0.05,
            metalness: 0.0,
            transmission: 0.92,
            thickness: 0.8,
            ior: 1.6,
            envMapIntensity: 1.5,
            emissive: glow,
            emissiveIntensity: 0.35,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
          }),
        };
      case "stone": // CENDRE — pierre brûlée
        return {
          geometry: (() => {
            const g = new THREE.IcosahedronGeometry(1.4, 2);
            // Displace irregularly pour effet pierre brûlée
            const pos = g.attributes.position;
            for (let i = 0; i < pos.count; i++) {
              const x = pos.getX(i);
              const y = pos.getY(i);
              const z = pos.getZ(i);
              const n = Math.sin(x * 3.7) * Math.cos(y * 4.3) * Math.sin(z * 2.9) * 0.18;
              pos.setXYZ(i, x + n * x, y + n * y, z + n * z);
            }
            g.computeVertexNormals();
            return g;
          })(),
          material: new THREE.MeshPhysicalMaterial({
            color: 0x2a1208,
            roughness: 0.85,
            metalness: 0.3,
            emissive: accent,
            emissiveIntensity: 0.95, // braise active, pas froide
          }),
        };
      case "crystal": // ORÉE — cristal forestier (transmission + emissive ↑)
      default:
        return {
          geometry: new THREE.OctahedronGeometry(1.6, 0),
          material: new THREE.MeshPhysicalMaterial({
            color: 0x8aa860,
            roughness: 0.05,
            metalness: 0.0,
            transmission: 0.85,
            thickness: 1.2,
            ior: 1.7,
            envMapIntensity: 1.4,
            emissive: glow,
            emissiveIntensity: 0.45,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
          }),
        };
    }
  }, [sillage]);

  return (
    <group ref={groupRef} position={position}>
      <mesh ref={innerRef} geometry={geometry} material={material} />
      {/* 2 point lights — un proche fort (révèle la matière) + un far doux
          (colore l'air alentour). Intensities ajustées pour ne PAS bouffer
          la silhouette de l'essence (Cendre était noire ; Solène/Orée invisibles). */}
      <pointLight color={sillage.palette.accent} intensity={3.2} distance={5} decay={1.8} />
      <pointLight
        color={sillage.palette.glow}
        intensity={1.4}
        distance={12}
        decay={2}
        position={[0, 1, 1]}
      />
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SCENE — Canvas R3F qui contient tout le 3D
 * ═══════════════════════════════════════════════════════════════════════════ */

function FloatingWordParticles({
  words,
  activeIndex,
  isMobile,
  visible,
}: {
  words: string[];
  activeIndex: number;
  isMobile: boolean;
  visible: boolean;
}) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  // Position : 22 unités devant la caméra (vs 14 avant). Plus loin = plus petit
  // visuellement = ne domine plus le HERO/titre HTML. Y offset -1.5 pour ne pas
  // overlap directement avec les sphères qui sont au centre.
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(camera.position.x, camera.position.y - 1.6, camera.position.z - 22);
      groupRef.current.visible = visible;
    }
  });

  return (
    <group ref={groupRef} scale={isMobile ? 0.65 : 1.0}>
      <WordParticlesOr
        words={words}
        activeIndex={activeIndex}
        pointSize={1.0}
        particlesPerWord={isMobile ? 14000 : 26000}
      />
    </group>
  );
}

function Scene({
  scrollRef,
  isMobile,
  activeSection,
}: {
  scrollRef: MutableRefObject<number>;
  isMobile: boolean;
  activeSection: number;
}) {
  return (
    <>
      <ScrollCamera scrollRef={scrollRef} />

      {/* Ambient + key lights */}
      <ambientLight intensity={0.12} color="#4A5A8A" />
      <directionalLight position={[2, 5, 3]} intensity={0.35} color="#C9A668" />
      <directionalLight position={[-3, 2, -1]} intensity={0.15} color="#6080B0" />

      {/* HDRI environment — réflexions matériaux */}
      <Environment files="/hdri/studio_small_03_2k.hdr" environmentIntensity={0.35} background={false} />

      {/* Brume olfactive globale */}
      <BrumeGlobale count={isMobile ? 60000 : 200000} />

      {/* HERO — sphère iridescente "pierre de lune" + FloatingWordParticles
          en arrière-plan. Essence positionnée à z=-8 inside chambre pour
          être DEVANT la caméra (qui démarre à z=0) — pas DANS la caméra. */}
      <group position={[0, 0, CHAMBRES_Z.HERO]}>
        <Essence
          sillage={{
            ...SILLAGES[0],
            palette: { bg: PALETTE.cielBase, accent: PALETTE.or, glow: PALETTE.orChaud },
            geometry: "sphere",
          }}
          position={[0, 0, -8]}
        />
      </group>

      {/* MANIFESTO — vide, juste brume + texte HTML */}

      {/* SILLAGES — chacun avec sa géométrie signature.
          Essence flotte côté + plus en avant. Le titre du sillage est rendu
          par FloatingWordParticles (un seul composant global qui suit la
          caméra et morphe entre les mots — évite que la caméra rentre dans
          le nuage de particules à mi-section, ce qui rendait illisible). */}
      {SILLAGES.map((sillage, i) => {
        const zKey = ["SILLAGE_I", "SILLAGE_II", "SILLAGE_III", "SILLAGE_IV", "SILLAGE_V", "SILLAGE_VI"][
          i
        ] as keyof typeof CHAMBRES_Z;
        const z = CHAMBRES_Z[zKey];
        const xOffset = i % 2 === 0 ? -2.4 : 2.4;
        return (
          <group key={sillage.nom} position={[0, 0, z]}>
            {/* Essence à z=-8 inside chambre → toujours DEVANT la caméra
                qui arrive à chambre_z, jamais coincidente avec elle. */}
            <Essence sillage={sillage} position={[xOffset, -0.3, -8]} />
          </group>
        );
      })}

      {/* WordParticles GLOBAL — suit la caméra à distance fixe (-14 unités
          devant), morphe entre les 12 mots quand activeSection change.
          C'est la signature visuelle qui remplace les WordParticles par
          chambre (qui devenaient illisibles à mi-section). */}
      {/* WordParticles caché pendant HERO (le titre HTML "L'Heure Bleue" suffit).
          Visible pour manifesto + 6 sillages + parfumeur + atelier + commande + RDV. */}
      <FloatingWordParticles
        words={[...SCROLL_WORDS]}
        activeIndex={Math.min(activeSection, SCROLL_WORDS.length - 1)}
        isMobile={isMobile}
        visible={activeSection >= 1}
      />

      {/* COMMANDE PRIVÉE — flacon faceted cristallin, position z=-8 dans chambre */}
      <group position={[0, 0, CHAMBRES_Z.COMMANDE]}>
        <mesh position={[0, 0, -8]}>
          <octahedronGeometry args={[2.0, 1]} />
          <meshPhysicalMaterial
            color={0xffffff}
            roughness={0.0}
            metalness={0.0}
            transmission={1.0}
            thickness={1.5}
            ior={1.7}
            attenuationDistance={2}
            attenuationColor={new THREE.Color(PALETTE.or)}
            envMapIntensity={2.0}
            clearcoat={1.0}
            clearcoatRoughness={0.05}
          />
        </mesh>
        <pointLight position={[0, 0, -8]} color={PALETTE.or} intensity={2.5} distance={10} decay={2} />
      </group>

      {/* Postprocess : raffiné, pas flashy. Bloom subtle, chromaticAberration
          quasi-inexistante (0.0005 vs 0.0014) — ça séparait les textes en
          orange/cyan visible, trop "agency 2010". */}
      <CinematicEffects
        bloom={isMobile ? 0.14 : 0.2}
        vignette={0.38}
        saturation={0.03}
        contrast={0.03}
        chromaticAberration={0.0005}
      />

      <SceneObserver scrollRef={scrollRef} />
    </>
  );
}

/**
 * SceneObserver — log progress + handle audio chime triggers.
 * Pas un composant visuel, juste un side-effect register.
 */
function SceneObserver({ scrollRef }: { scrollRef: MutableRefObject<number> }) {
  const lastChimedIndex = useRef(-1);

  useFrame(() => {
    // Trouver le sillage le plus proche de la position camera (startZ=0 maintenant)
    const cameraZ = -scrollRef.current * TOTAL_DEPTH;
    const sillageZs = [
      CHAMBRES_Z.SILLAGE_I,
      CHAMBRES_Z.SILLAGE_II,
      CHAMBRES_Z.SILLAGE_III,
      CHAMBRES_Z.SILLAGE_IV,
      CHAMBRES_Z.SILLAGE_V,
      CHAMBRES_Z.SILLAGE_VI,
    ];
    let nearest = -1;
    let nearestDist = 6;
    for (let i = 0; i < sillageZs.length; i++) {
      const d = Math.abs(sillageZs[i] - cameraZ);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    }
    if (nearest !== -1 && nearest !== lastChimedIndex.current && nearestDist < 4) {
      lastChimedIndex.current = nearest;
      getAudioEngine().chime(SILLAGES[nearest].chime, 3.2);
    }
  });
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * LOADING SEUIL — écran d'entrée narratif
 *
 * Affiche une citation contextuelle selon l'heure réelle de la visite, puis
 * explose en particules dorées pour révéler l'univers.
 * ═══════════════════════════════════════════════════════════════════════════ */

function LoadingSeuil({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"text" | "explode" | "done">("text");
  const [hour, setHour] = useState(20);

  useEffect(() => {
    setHour(new Date().getHours());
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("explode"), 2800);
    const t2 = setTimeout(() => {
      setPhase("done");
      onDone();
    }, 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  if (phase === "done") return null;

  const intro = getIntroByHour(hour);

  return (
    <AnimatePresence>
      <motion.div
        key="seuil"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.2 }}
        className="fixed inset-0 z-[100] bg-[#050B1F] flex flex-col items-center justify-center px-8 text-center"
      >
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "text" ? 0.85 : 0 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          className="font-[family-name:var(--font-cormorant)] italic text-[#F4EFE5] text-lg md:text-2xl max-w-xl leading-relaxed"
        >
          {intro}
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "text" ? 0.4 : 0 }}
          transition={{ duration: 1.4, delay: 0.6, ease: "easeOut" }}
          className="mt-12 text-[10px] tracking-[0.5em] uppercase text-[#C9A668] font-sans"
        >
          ·   L'Heure Bleue   ·
        </motion.p>
        {/* Point central qui se dilate puis explose */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={
            phase === "explode"
              ? { scale: 80, opacity: [0, 1, 0] }
              : { scale: 1, opacity: 0.7 }
          }
          transition={{ duration: phase === "explode" ? 1.2 : 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="absolute w-3 h-3 rounded-full bg-[#C9A668] shadow-[0_0_60px_15px_#C9A66880]"
        />
      </motion.div>
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * CURSOR CUSTOM — point doré + halo, suit pointer
 *
 * Désactivé sur mobile (touch).
 * Sur hover d'éléments interactifs (data-hover) → scale up.
 * ═══════════════════════════════════════════════════════════════════════════ */

function Cursor({ isMobile }: { isMobile: boolean }) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (isMobile) return;
    const onMove = (e: PointerEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${e.clientX - 12}px, ${e.clientY - 12}px)`;
      }
    };
    const onOver = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-hover]")) setHovering(true);
      else setHovering(false);
    };
    window.addEventListener("pointermove", onMove);
    document.addEventListener("mouseover", onOver);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseover", onOver);
    };
  }, [isMobile]);

  if (isMobile) return null;

  return (
    <div
      ref={cursorRef}
      className="fixed top-0 left-0 z-[90] pointer-events-none mix-blend-screen"
      style={{
        width: 24,
        height: 24,
        willChange: "transform",
      }}
    >
      <div
        className="absolute inset-0 rounded-full transition-all duration-300 ease-out"
        style={{
          background: hovering ? PALETTE.orChaud : PALETTE.or,
          transform: hovering ? "scale(2)" : "scale(0.45)",
          boxShadow: hovering
            ? `0 0 40px 14px ${PALETTE.or}cc`
            : `0 0 22px 6px ${PALETTE.or}88`,
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * AUDIO TOGGLE — bouton mute clean en haut à droite
 * ═══════════════════════════════════════════════════════════════════════════ */

function AudioToggle({ started, muted, onToggle }: { started: boolean; muted: boolean; onToggle: () => void }) {
  return (
    <button
      data-hover
      onClick={onToggle}
      className="fixed top-6 right-6 z-[80] flex items-center gap-3 px-4 py-2 border border-[#C9A66833] hover:border-[#C9A668] transition-colors duration-500 backdrop-blur-sm bg-[#050B1F]/30 cursor-pointer"
      aria-label={muted ? "Activer le son" : "Couper le son"}
    >
      <span
        className={`block w-1.5 h-1.5 rounded-full ${
          started && !muted ? "bg-[#C9A668] animate-pulse" : "bg-[#C9A66844]"
        }`}
      />
      <span className="text-[9px] tracking-[0.4em] uppercase text-[#F4EFE5]/80">
        {muted ? "Silence" : "Sonore"}
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * NAV LATÉRALE — points discrets, navigation entre sillages
 * ═══════════════════════════════════════════════════════════════════════════ */

function NavSide({ activeSection, total }: { activeSection: number; total: number }) {
  return (
    <div className="hidden md:flex fixed right-8 top-1/2 -translate-y-1/2 z-[70] flex-col gap-3">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="w-1 h-1 rounded-full transition-all duration-700"
          style={{
            background:
              i === activeSection ? PALETTE.or : PALETTE.orOmbre,
            transform: i === activeSection ? "scale(2.2)" : "scale(1)",
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SECTIONS HTML — overlays scroll-synced, un par chambre
 *
 * Chaque Section prend exactement 100vh et déclenche reveal via Framer.
 * Le Canvas R3F en fond, les Section au scroll naturel.
 * ═══════════════════════════════════════════════════════════════════════════ */

function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`relative h-screen w-full flex items-center justify-center px-6 md:px-12 pointer-events-none ${className}`}
    >
      <div className="relative w-full max-w-6xl mx-auto pointer-events-auto">
        {children}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * EASTER EGGS — Konami code, hold ESC, clics multiples
 * ═══════════════════════════════════════════════════════════════════════════ */

function useEasterEggs(onSilence: (s: boolean) => void, onSecret: () => void) {
  const konamiRef = useRef<string[]>([]);
  const escHoldRef = useRef<number | null>(null);
  const titleClicksRef = useRef<{ count: number; timer: number | null }>({ count: 0, timer: null });

  useEffect(() => {
    const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight"];
    const onKey = (e: KeyboardEvent) => {
      konamiRef.current.push(e.key);
      if (konamiRef.current.length > KONAMI.length) konamiRef.current.shift();
      if (KONAMI.every((k, i) => konamiRef.current[i] === k)) {
        onSecret();
        konamiRef.current = [];
      }
      if (e.key === "Escape" && !escHoldRef.current) {
        escHoldRef.current = window.setTimeout(() => {
          onSilence(true);
          escHoldRef.current = null;
        }, 3000);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Escape" && escHoldRef.current) {
        clearTimeout(escHoldRef.current);
        escHoldRef.current = null;
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [onSilence, onSecret]);

  const onTitleClick = useCallback(() => {
    titleClicksRef.current.count++;
    if (titleClicksRef.current.timer) window.clearTimeout(titleClicksRef.current.timer);
    titleClicksRef.current.timer = window.setTimeout(() => {
      if (titleClicksRef.current.count >= 7) onSecret();
      titleClicksRef.current.count = 0;
    }, 1500);
  }, [onSecret]);

  return { onTitleClick };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PAGE PRINCIPALE
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function LHeureBleueImmersive() {
  const isMobile = useIsMobile();
  const scrollRef = useRef(0);
  const [activeSection, setActiveSection] = useState(0);
  const [loadingDone, setLoadingDone] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [silenceMode, setSilenceMode] = useState(false);
  const [secretRevealed, setSecretRevealed] = useState(false);

  // Lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.6,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      // Update scrollRef avec progress 0→1.
      // max = total scrollable distance = scrollHeight - viewportHeight.
      // À section X top : scrollY = X*100vh → scrollRef = X/11 (puisque 12 sections × 100vh = 1200vh, max scroll = 1100vh)
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollRef.current = max > 0 ? window.scrollY / max : 0;
      // Update active section (0 → 11). 12 sections au total, indexes 0-11.
      const sectionIdx = Math.min(11, Math.round(scrollRef.current * 11));
      setActiveSection(sectionIdx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  // Easter eggs
  const handleSecret = useCallback(() => {
    setSecretRevealed(true);
    setTimeout(() => setSecretRevealed(false), 5000);
  }, []);
  const { onTitleClick } = useEasterEggs(setSilenceMode, handleSecret);

  // Audio init au premier clic (gesture requis par browsers)
  const handleAudioStart = useCallback(async () => {
    if (audioStarted) return;
    const ok = await getAudioEngine().start();
    if (ok) setAudioStarted(true);
  }, [audioStarted]);

  // Audio toggle mute
  const handleAudioToggle = useCallback(async () => {
    if (!audioStarted) {
      await handleAudioStart();
      return;
    }
    const newMuted = !muted;
    setMuted(newMuted);
    getAudioEngine().setMuted(newMuted);
  }, [audioStarted, muted, handleAudioStart]);

  // Démarrer l'audio dès le premier clic n'importe où (auto-prompt après loading)
  useEffect(() => {
    if (!loadingDone || audioStarted || isMobile) return;
    const onAnyClick = () => {
      handleAudioStart();
    };
    document.addEventListener("click", onAnyClick, { once: true });
    return () => document.removeEventListener("click", onAnyClick);
  }, [loadingDone, audioStarted, isMobile, handleAudioStart]);

  return (
    <>
      {/* Cursor + Audio toggle + Nav latérale */}
      {loadingDone && (
        <>
          <Cursor isMobile={isMobile} />
          <AudioToggle started={audioStarted} muted={muted} onToggle={handleAudioToggle} />
          <NavSide activeSection={activeSection} total={12} />
        </>
      )}

      {/* Loading seuil narratif */}
      {!loadingDone && <LoadingSeuil onDone={() => setLoadingDone(true)} />}

      {/* Easter egg secret reveal — overlay opaque pour qu'aucun contenu en
          dessous ne perturbe le moment. Backdrop noir + glow gold. */}
      <AnimatePresence>
        {secretRevealed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-[95] flex flex-col items-center justify-center pointer-events-none bg-[#050B1F]/92 backdrop-blur-md"
          >
            <motion.span
              initial={{ scale: 0.5, opacity: 0, filter: "blur(20px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 1.2 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="font-[family-name:var(--font-italiana)] text-[#C9A668] tracking-[0.04em] leading-none drop-shadow-[0_0_60px_#C9A668ee]"
              style={{ fontSize: "clamp(110px, 22vw, 320px)" }}
            >
              MMXXVI
            </motion.span>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ duration: 1.2, delay: 0.6 }}
              className="font-[family-name:var(--font-cormorant)] italic text-lg md:text-2xl text-[#F4EFE5]/70 mt-10 max-w-md text-center px-6"
            >
              L'année où l'heure bleue a pris son nom.
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Silence mode banner */}
      <AnimatePresence>
        {silenceMode && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[85] px-6 py-2 border border-[#C9A66833] bg-[#050B1F]/70 backdrop-blur-sm"
          >
            <span className="text-[10px] tracking-[0.4em] uppercase text-[#F4EFE5]/80">
              · mode silence ·
            </span>
            <button
              onClick={() => setSilenceMode(false)}
              data-hover
              className="ml-4 text-[10px] tracking-[0.3em] uppercase text-[#C9A668]"
            >
              sortir
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CANVAS R3F FIXED — toujours visible derrière le scroll */}
      <div className="fixed inset-0 z-0 bg-[#050B1F] pointer-events-none">
        <Canvas
          camera={{ fov: 38, near: 0.1, far: 340, position: [0, 0, 0] }}
          dpr={[1, isMobile ? 1.5 : 2]}
          gl={{
            antialias: false,
            powerPreference: "high-performance",
            preserveDrawingBuffer: false,
          }}
        >
          <color attach="background" args={[PALETTE.cielBase]} />
          <fog attach="fog" args={[PALETTE.cielBase, 8, 65]} />
          {loadingDone && !silenceMode && (
            <Scene scrollRef={scrollRef} isMobile={isMobile} activeSection={activeSection} />
          )}
        </Canvas>
      </div>

      {/* PAGE SCROLLABLE — sections HTML overlay */}
      <main
        className="relative z-10 pointer-events-none"
        style={{ height: `${SCROLL_HEIGHT_VH}vh` }}
      >
        {/* CHAMBRE 1 — HERO */}
        <Section id="hero">
          <div className="flex flex-col items-center text-center">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: loadingDone ? 0.7 : 0 }}
              transition={{ duration: 1.6, delay: 0.6 }}
              className="text-[10px] tracking-[0.5em] uppercase text-[#C9A668] mb-10 font-sans"
            >
              ·  Maison fondée en MMXXVI  ·
            </motion.p>
            <motion.h1
              data-hover
              onClick={onTitleClick}
              initial={{ opacity: 0, filter: "blur(20px)", y: 60 }}
              animate={
                loadingDone
                  ? { opacity: 1, filter: "blur(0px)", y: 0 }
                  : { opacity: 0, filter: "blur(20px)", y: 60 }
              }
              transition={{ duration: 2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="font-[family-name:var(--font-italiana)] text-[#F4EFE5] leading-[0.92] tracking-tight cursor-pointer select-none"
              style={{ fontSize: "clamp(60px, 13vw, 200px)" }}
            >
              L'Heure
              <br />
              <span className="font-[family-name:var(--font-cormorant)] italic font-light text-[#C9A668]">
                Bleue
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={loadingDone ? { opacity: 1, y: 0 } : { opacity: 0 }}
              transition={{ duration: 1.4, delay: 1.4 }}
              className="font-[family-name:var(--font-cormorant)] italic text-lg md:text-2xl text-[#F4EFE5]/75 mt-12 max-w-xl"
            >
              L'instant exact où la lumière hésite,
              <br />
              et où le parfum prend la parole.
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={loadingDone ? { opacity: 0.5 } : { opacity: 0 }}
              transition={{ duration: 1, delay: 2.4 }}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
            >
              <span className="text-[9px] tracking-[0.5em] uppercase text-[#F4EFE5]/40">Descendez</span>
              <motion.div
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                className="w-[1px] h-10 bg-gradient-to-b from-[#C9A668]/70 to-transparent"
              />
            </motion.div>
          </div>
        </Section>

        {/* CHAMBRE 2 — MANIFESTO */}
        <Section id="manifesto">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 1.2 }}
              className="text-[10px] tracking-[0.4em] uppercase text-[#C9A668] mb-12 font-sans"
            >
              ·  L'Instant  ·
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
              className="font-[family-name:var(--font-italiana)] text-4xl md:text-7xl text-[#F4EFE5] leading-[1.04] mb-12"
            >
              Six sillages.
              <br />
              <span className="font-[family-name:var(--font-cormorant)] italic text-[#C9A668]">
                Une seule heure.
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 0.7, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 1.2, delay: 0.4 }}
              className="font-[family-name:var(--font-cormorant)] italic text-lg md:text-xl text-[#F4EFE5]/65 max-w-xl mx-auto leading-relaxed"
            >
              L'Heure Bleue n'est pas une marque. C'est une discipline.
              Celle d'attendre que la lumière du jour ait fini sa course,
              et qu'entre ce qui finit et ce qui commence s'ouvre l'intervalle
              où l'air devient mémoire.
            </motion.p>
          </div>
        </Section>

        {/* CHAMBRES 3-8 — LES 6 SILLAGES */}
        {SILLAGES.map((sillage, i) => (
          <Section key={sillage.nom} id={`sillage-${i + 1}`}>
            <div
              className={`flex flex-col ${
                i % 2 === 0 ? "md:items-start text-left" : "md:items-end text-right"
              } items-center text-center max-w-md ${i % 2 === 0 ? "md:mr-auto" : "md:ml-auto"}`}
            >
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 1.2 }}
                className="font-[family-name:var(--font-italiana)] text-3xl md:text-4xl text-[#C9A668]/70 mb-4"
              >
                {sillage.no}
              </motion.p>
              {/* Titre HTML — réduit + opacity 65 pour devenir "label" propre
                  vs WordParticles dominant en arrière-plan 3D. Garde la
                  version accentuée (SOLÈNE/ORÉE) que les particules ne peuvent
                  pas rendre. */}
              <motion.h3
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 0.85, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 1.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="font-[family-name:var(--font-italiana)] text-3xl md:text-5xl text-[#F4EFE5] leading-none tracking-tight"
              >
                {sillage.nom}
              </motion.h3>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 0.7 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 1.2, delay: 0.4 }}
                className="font-[family-name:var(--font-cormorant)] italic text-base md:text-xl text-[#F4EFE5]/55 mt-6 leading-relaxed"
              >
                {sillage.accord}
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 0.55 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 1.2, delay: 0.6 }}
                className="font-[family-name:var(--font-cormorant)] italic text-sm md:text-base text-[#F4EFE5]/40 mt-8 max-w-xs leading-relaxed"
              >
                « {sillage.citation} »
              </motion.p>
            </div>
          </Section>
        ))}

        {/* CHAMBRE 9 — LE PARFUMEUR */}
        <Section id="parfumeur">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.2 }}
              className="text-[10px] tracking-[0.5em] uppercase text-[#C9A668] mb-12 font-sans"
            >
              ·  Le Parfumeur  ·
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
              className="font-[family-name:var(--font-italiana)] text-5xl md:text-8xl text-[#F4EFE5] leading-[0.95] mb-10"
            >
              Antoine
              <br />
              <span className="font-[family-name:var(--font-cormorant)] italic text-[#C9A668]">
                Verger
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.7 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.2, delay: 0.4 }}
              className="font-[family-name:var(--font-cormorant)] italic text-lg md:text-2xl text-[#F4EFE5]/65 max-w-xl mx-auto"
            >
              « J'ai longtemps cru qu'on faisait un parfum pour plaire.
              <br />
              Je sais aujourd'hui qu'on en fait un pour reconnaître. »
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.2, delay: 0.7 }}
              className="mt-16 flex justify-center gap-16"
            >
              <div>
                <div className="font-[family-name:var(--font-italiana)] text-3xl text-[#C9A668]">32</div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-[#F4EFE5]/40 mt-2 font-sans">Années de nez</div>
              </div>
              <div>
                <div className="font-[family-name:var(--font-italiana)] text-3xl text-[#C9A668]">VI</div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-[#F4EFE5]/40 mt-2 font-sans">Sillages signés</div>
              </div>
              <div>
                <div className="font-[family-name:var(--font-italiana)] text-3xl text-[#C9A668]">I</div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-[#F4EFE5]/40 mt-2 font-sans">Maison fondée</div>
              </div>
            </motion.div>
          </div>
        </Section>

        {/* CHAMBRE 10 — L'ATELIER */}
        <Section id="atelier">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.2 }}
              className="text-[10px] tracking-[0.5em] uppercase text-[#C9A668] mb-12 font-sans"
            >
              ·  L'Atelier  ·
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
              className="font-[family-name:var(--font-italiana)] text-5xl md:text-8xl text-[#F4EFE5] leading-[0.95] mb-12"
            >
              Tout commence
              <br />
              <span className="font-[family-name:var(--font-cormorant)] italic text-[#C9A668]">
                par un silence.
              </span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 0.7, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.4, delay: 0.4 }}
              className="font-[family-name:var(--font-cormorant)] italic text-lg md:text-2xl text-[#F4EFE5]/60 max-w-xl mx-auto leading-relaxed"
            >
              Chaque composition naît d'une saison passée à ne rien composer.
              On marche, on respire un lieu, on en sort la note unique qui le tient.
            </motion.p>
          </div>
        </Section>

        {/* CHAMBRE 11 — COMMANDE PRIVÉE */}
        <Section id="commande">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.2 }}
              className="text-[10px] tracking-[0.4em] uppercase text-[#C9A668] mb-12 font-sans"
            >
              ·  La Commande Privée  ·
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
              className="font-[family-name:var(--font-italiana)] text-5xl md:text-7xl text-[#F4EFE5] leading-[0.95] mb-10"
            >
              Un parfum
              <br />
              <span className="font-[family-name:var(--font-cormorant)] italic text-[#C9A668]">
                qui n'existe pas.
              </span>
              <br />
              Encore.
            </motion.h2>
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.4, delay: 0.4 }}
              className="mt-12 inline-flex flex-col gap-3 px-12 py-8 border border-[#C9A66833]"
            >
              <div className="text-[10px] tracking-[0.4em] uppercase text-[#F4EFE5]/40 font-sans">
                À partir de
              </div>
              <div className="font-[family-name:var(--font-italiana)] text-5xl md:text-7xl text-[#C9A668]">
                48 000 €
              </div>
              <div className="text-[10px] tracking-[0.3em] uppercase text-[#F4EFE5]/40 font-sans mt-2">
                · Liste d'attente — MMXXVII ·
              </div>
            </motion.div>
          </div>
        </Section>

        {/* CHAMBRE 12 — LE RENDEZ-VOUS */}
        <Section id="contact">
          <div className="max-w-2xl mx-auto text-center">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.2 }}
              className="text-[10px] tracking-[0.5em] uppercase text-[#C9A668] mb-12 font-sans"
            >
              ·  Sur rendez-vous uniquement  ·
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
              className="font-[family-name:var(--font-italiana)] text-5xl md:text-8xl text-[#F4EFE5] leading-[0.95] mb-14"
            >
              Venez à
              <br />
              <span className="font-[family-name:var(--font-cormorant)] italic text-[#C9A668]">
                l'heure exacte.
              </span>
            </motion.h2>
            <motion.a
              data-hover
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.2, delay: 0.4 }}
              href="mailto:bonjour@lheurebleue.paris?subject=Demande%20de%20rendez-vous"
              className="group inline-flex items-center gap-4 px-14 py-5 border border-[#C9A66866] text-[#F4EFE5] hover:bg-[#C9A668] hover:text-[#050B1F] transition-all duration-700 tracking-[0.32em] text-xs uppercase backdrop-blur-sm"
            >
              <span>Demander un rendez-vous</span>
              <span className="transition-transform duration-700 group-hover:translate-x-2">→</span>
            </motion.a>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 1.2, delay: 0.8 }}
              className="mt-12 font-[family-name:var(--font-cormorant)] italic text-[#F4EFE5]/40 text-sm"
            >
              12, rue du Bac · 75007 Paris · MMXXVI
              <br />
              <span className="text-[#F4EFE5]/25 text-[10px] tracking-[0.32em] uppercase mt-3 inline-block">
                Conçu par Vertxia · vertxia.com
              </span>
            </motion.p>
          </div>
        </Section>
      </main>
    </>
  );
}
