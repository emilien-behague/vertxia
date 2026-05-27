"use client";

/**
 * VolumetricFog — data cloud Active Theory-style.
 *
 * Particles GPU-side avec ShaderMaterial custom :
 *   - Sprite circulaire procédural (canvas radial gradient — pas d artefact carré)
 *   - Per-vertex size (vrais bokeh naturels, gros + petits)
 *   - Per-vertex color (palette warm/cool aléatoire)
 *   - Animation vertex shader (sin/cos drift sans coût CPU)
 *   - Depth-based alpha (les particules trop proches fadent → ne clippent pas le mesh)
 *   - Additive blending (lumière, pas matière)
 *
 * Le composant remplace les <Sparkles> drei (qui montraient des quads carrés
 * sous le bloom — cf. bug reporté avec screenshot).
 *
 * Perf :
 *   - 1200 particles desktop ≈ 1 draw call, négligeable
 *   - 400 particles mobile (à passer en prop count)
 *   - Animation 100% GPU, zero JS per-frame autre que uniform uTime
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Props = {
  count?: number;
  radius?: number;
  sizeMin?: number;
  sizeMax?: number;
  colors?: string[];
  yOffset?: number;
  opacity?: number;
};

/**
 * Génère une texture sprite circulaire douce via canvas 2D (pas de fichier).
 * Radial gradient blanc → transparent. Le shader colore ensuite par vertex.
 */
function makeBokehTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.Texture();
  }
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.18, "rgba(255,255,255,0.85)");
  g.addColorStop(0.4, "rgba(255,255,255,0.35)");
  g.addColorStop(0.75, "rgba(255,255,255,0.06)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;

    vec3 pos = position;
    // Subtle floating drift — totally GPU, free
    pos.x += sin(uTime * 0.25 + aPhase) * 0.20;
    pos.y += sin(uTime * 0.18 + aPhase * 1.31) * 0.15;
    pos.z += cos(uTime * 0.22 + aPhase * 0.81) * 0.20;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float d = -mv.z;

    // Depth-based alpha : particules trop proches (d < 7) ou trop loin (d > 22) fadent
    vAlpha = smoothstep(2.0, 7.0, d) * smoothstep(22.0, 14.0, d);

    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * (220.0 / d);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uSprite;
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 tex = texture2D(uSprite, gl_PointCoord);
    if (tex.a < 0.02) discard;
    gl_FragColor = vec4(vColor, tex.a * vAlpha * uOpacity);
  }
`;

export function VolumetricFog({
  count = 1200,
  radius = 10,
  sizeMin = 6,
  sizeMax = 28,
  colors = ["#ffd9a3", "#a855f7", "#22d3ee", "#fb923c", "#fbbf24", "#ffffff"],
  yOffset = -1,
  opacity = 0.9,
}: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colorObjs = colors.map((c) => new THREE.Color(c));

    for (let i = 0; i < count; i++) {
      // Distribution sphérique biaisée vers l extérieur (volume creux ish)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.3 + Math.pow(Math.random(), 0.7) * 0.7);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + yOffset;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const col = colorObjs[Math.floor(Math.random() * colorObjs.length)];
      cols[i * 3] = col.r;
      cols[i * 3 + 1] = col.g;
      cols[i * 3 + 2] = col.b;

      // Bias bokeh : majorité petites, quelques grosses (pow 2.5)
      const t = Math.pow(Math.random(), 2.5);
      sizes[i] = sizeMin + (sizeMax - sizeMin) * t;

      phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(cols, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

    const sprite = makeBokehTexture();

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSprite: { value: sprite },
        uOpacity: { value: opacity },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geometry: geo, material: mat };
  }, [count, radius, sizeMin, sizeMax, colors, yOffset, opacity]);

  // Dispose ressources GPU au unmount (sinon leak GPU memory à chaque hot-reload)
  useEffect(() => {
    return () => {
      geometry.dispose();
      const sprite = material.uniforms.uSprite.value as THREE.Texture | null;
      if (sprite) sprite.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <points geometry={geometry}>
      <primitive object={material} ref={matRef} attach="material" />
    </points>
  );
}
