"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useMotionValueEvent,
} from "framer-motion";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  Environment,
  ContactShadows,
  Float,
  Sparkles,
  Stars,
  Trail,
  MeshTransmissionMaterial,
  Text,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  DepthOfField,
  ChromaticAberration,
  Vignette,
  SMAA,
  ToneMapping,
  Glitch,
  Noise,
  Scanline,
} from "@react-three/postprocessing";
import { BlendFunction, GlitchMode, ToneMappingMode } from "postprocessing";

// /preview/vertxia-v3 — SINGLE-CANVAS Z-AXIS CINEMATIC
//
// UN SEUL Canvas R3F qui contient :
//   • VideoPlane (la vidéo Higgsfield en VideoTexture sur un plane à z=0)
//   • Le monde 3D DERRIÈRE (entre z=-3 et z=-15)
//   • Caméra qui AVANCE SUR Z (de z=5.5 à z=-3) scroll-driven
//
// Phases scroll (section sticky de 1200vh) :
//   0.00 → 0.45 : ROOM 1 — caméra fixe à z=5.5, vidéo immersion
//   0.45 → 0.62 : TENSION — RGB split + glitch + scanlines + noise
//   0.62 → 0.75 : EXPLOSION — plane vidéo se brise, fragments + particules
//   0.75 → 1.00 : PLUNGE 3D — caméra traverse z=0 → z=-3 dans le monde

// @react-three/postprocessing v3 attend des THREE.Vector2 (pas des tuples).
// Constants module-level pour identité stable (évite re-init du Glitch).
const GLITCH_DELAY = new THREE.Vector2(0.6, 2.0);
const GLITCH_DURATION = new THREE.Vector2(0.15, 0.5);

const palette = {
  bg: "#050505",
  bgDeep: "#0A0606",
  silver: "#E8E8E8",
  silverMid: "#A0A0A0",
  silverDim: "#5A5A5A",
  redDeep: "#3A0606",
  redDark: "#8B0000",
  redNeon: "#FF2A2A",
  redAccent: "#C41E1E",
  // Palette cosmique (orb collapse → galaxy)
  cosmicDark: "#0A0B1A",
  cosmicBlue: "#4A6CF7",
  cosmicBlueDeep: "#1E3A8A",
  cosmicViolet: "#7A4CF7",
  cosmicVioletLight: "#A06CF7",
  cosmicGold: "#F7D56C",
} as const;

// Phases scroll (total 3200vh — extension trou noir + hyperspace + reveal site)
const PHASE_TENSION_START = 0.30;
const PHASE_EXPLOSION_START = 0.41;
const PHASE_3D_START = 0.50;
const PHASE_ORB_COLLAPSE_START = 0.62;
const PHASE_COSMIC_EXPLOSION_START = 0.66;
const PHASE_GALAXY_START = 0.78;
// Phase trou noir : émergence au cœur de la galaxie + aspiration spatiale
const PHASE_BLACKHOLE_START = 0.85;
const PHASE_SUCTION_START = 0.91;
const PHASE_HYPERSPACE_START = 0.93;
// Phase extinction : le tunnel ralentit, particules s'éteignent, silence cosmique
const PHASE_TUNNEL_DECEL_START = 0.95;
// Phase revelation : émergence minimaliste du site depuis le néant
const PHASE_REVEAL_START = 0.97;

// ─── CIRCULAR PARTICLE SPRITE (shared, lazy, SSR-safe) ──────────────────────
// Tous les <pointsMaterial> de la scène utilisent ce sprite radial → particules
// rondes avec soft glow au lieu des quads carrés Three.js par défaut.
let _CIRCLE_PARTICLE_TEX: THREE.Texture | null = null;
function particleTex(): THREE.Texture | undefined {
  if (_CIRCLE_PARTICLE_TEX) return _CIRCLE_PARTICLE_TEX;
  if (typeof document === "undefined") return undefined;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  const c = size / 2;
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  // Cœur plein blanc large (~35% du rayon) puis halo doux jusqu'au bord
  // → particules ROND lumineuses avec glow (et non disques pâles)
  grad.addColorStop(0.0, "rgba(255,255,255,1.0)");
  grad.addColorStop(0.35, "rgba(255,255,255,1.0)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.62)");
  grad.addColorStop(0.75, "rgba(255,255,255,0.22)");
  grad.addColorStop(0.9, "rgba(255,255,255,0.06)");
  grad.addColorStop(1.0, "rgba(255,255,255,0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  _CIRCLE_PARTICLE_TEX = tex;
  return tex;
}

// ─── AUDIO ENGINE — Web Audio API natif (drone cosmique + SFX par phase) ────
// Tout en synthèse : 0 asset, oscillateurs + noise buffers + filters + envelopes.
// AudioContext lazy-init au premier user interaction (Chrome autoplay policy).
let _audioCtx: AudioContext | null = null;
let _audioInited = false;
let _masterGain: GainNode | null = null;
let _droneIntensityGain: GainNode | null = null;
let _droneStaticGains: GainNode[] = [];
const _droneBaseGains = [0.32, 0.16, 0.08]; // mix par oscillateur

function initAudio(): void {
  if (_audioInited || typeof window === "undefined") return;
  const Ctx =
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return;
  try {
    _audioCtx = new Ctx();
  } catch {
    return;
  }
  _masterGain = _audioCtx.createGain();
  _masterGain.gain.value = 0.55;
  _masterGain.connect(_audioCtx.destination);
  startDrone();
  _audioInited = true;
}

function startDrone(): void {
  if (!_audioCtx || !_masterGain) return;
  // Intensity gain en série après les drones (modulable scroll-driven sans casser LFO)
  _droneIntensityGain = _audioCtx.createGain();
  _droneIntensityGain.gain.value = 1.0;
  _droneIntensityGain.connect(_masterGain);

  // 3 oscillators : root A1 (55) + fifth E2 (82.5) + octave A2 (110) = power chord cosmique
  const freqs = [55, 82.5, 110];
  const types: OscillatorType[] = ["sine", "sine", "triangle"];
  for (let i = 0; i < freqs.length; i++) {
    const osc = _audioCtx.createOscillator();
    osc.type = types[i];
    osc.frequency.value = freqs[i];
    osc.detune.value = (Math.random() - 0.5) * 6;

    // staticGain : porte le mix de base + reçoit LFO pour modulation amplitude organique
    const staticGain = _audioCtx.createGain();
    staticGain.gain.value = _droneBaseGains[i];

    // LFO lent par oscillateur (0.07–0.13 Hz) — sensation respiration cosmique
    const lfo = _audioCtx.createOscillator();
    lfo.frequency.value = 0.07 + i * 0.03;
    const lfoDepth = _audioCtx.createGain();
    lfoDepth.gain.value = _droneBaseGains[i] * 0.35;
    lfo.connect(lfoDepth);
    lfoDepth.connect(staticGain.gain);

    osc.connect(staticGain);
    staticGain.connect(_droneIntensityGain);

    osc.start();
    lfo.start();
    _droneStaticGains.push(staticGain);
  }
}

// Modulate drone intensity based on scroll progress
function setDroneIntensity(scrollProgress: number): void {
  if (!_audioCtx || !_droneIntensityGain) return;
  let intensity = 0.0;
  // Fade-in léger avant l'explosion vidéo (drone arrive doucement avec le scroll)
  if (scrollProgress >= 0.05) {
    intensity = Math.min(1.0, (scrollProgress - 0.05) / 0.2);
  }
  // Boost progressif blackhole → hyperspace
  if (scrollProgress >= PHASE_BLACKHOLE_START) {
    const t = Math.min(
      1,
      (scrollProgress - PHASE_BLACKHOLE_START) /
        (PHASE_HYPERSPACE_START - PHASE_BLACKHOLE_START),
    );
    intensity = 1.0 + t * 1.4; // jusqu'à 2.4 en hyperspace
  }
  // Décélération + reveal : fade out vers le silence cosmique
  if (scrollProgress >= PHASE_TUNNEL_DECEL_START) {
    const t = Math.min(
      1,
      (scrollProgress - PHASE_TUNNEL_DECEL_START) /
        (1 - PHASE_TUNNEL_DECEL_START),
    );
    intensity = 2.4 - t * 2.2; // fade out vers reveal silencieux
  }
  const now = _audioCtx.currentTime;
  _droneIntensityGain.gain.cancelScheduledValues(now);
  _droneIntensityGain.gain.linearRampToValueAtTime(intensity, now + 0.4);
}

function setAudioMuted(muted: boolean): void {
  if (!_audioCtx || !_masterGain) return;
  const now = _audioCtx.currentTime;
  _masterGain.gain.cancelScheduledValues(now);
  _masterGain.gain.linearRampToValueAtTime(muted ? 0 : 0.55, now + 0.15);
}

// Helper : créer un AudioBuffer de bruit blanc d'une durée donnée
function makeNoiseBuffer(durationSec: number): AudioBuffer | null {
  if (!_audioCtx) return null;
  const size = Math.floor(_audioCtx.sampleRate * durationSec);
  const buf = _audioCtx.createBuffer(1, size, _audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// SFX 1 — Cosmic Explosion : impact basse + texture noise courte
function sfxExplosion(): void {
  if (!_audioCtx || !_masterGain) return;
  const now = _audioCtx.currentTime;

  // Impact sub-basse (kick cosmique)
  const subOsc = _audioCtx.createOscillator();
  subOsc.type = "sine";
  subOsc.frequency.setValueAtTime(120, now);
  subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.6);
  const subGain = _audioCtx.createGain();
  subGain.gain.setValueAtTime(0.0, now);
  subGain.gain.linearRampToValueAtTime(0.7, now + 0.01);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  subOsc.connect(subGain);
  subGain.connect(_masterGain);
  subOsc.start(now);
  subOsc.stop(now + 0.85);

  // Noise burst (poussière cosmique éjectée)
  const noise = _audioCtx.createBufferSource();
  noise.buffer = makeNoiseBuffer(1.2);
  const filter = _audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(3500, now);
  filter.frequency.exponentialRampToValueAtTime(300, now + 1.0);
  const noiseGain = _audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.35, now + 0.02);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(_masterGain);
  noise.start(now);
  noise.stop(now + 1.2);
}

// SFX 2 — Suction/Blackhole : whoosh basse qui descend, sensation d'aspiration
function sfxWhoosh(): void {
  if (!_audioCtx || !_masterGain) return;
  const now = _audioCtx.currentTime;
  const noise = _audioCtx.createBufferSource();
  noise.buffer = makeNoiseBuffer(2.2);
  const filter = _audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 5;
  filter.frequency.setValueAtTime(900, now);
  filter.frequency.exponentialRampToValueAtTime(45, now + 2.0);
  const gain = _audioCtx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.28, now + 0.4);
  gain.gain.linearRampToValueAtTime(0.32, now + 1.5);
  gain.gain.linearRampToValueAtTime(0, now + 2.1);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(_masterGain);
  noise.start(now);
  noise.stop(now + 2.2);
}

// SFX 3 — Hyperspace : air pressure ascending + high-pass sweep
function sfxHyperspace(): void {
  if (!_audioCtx || !_masterGain) return;
  const now = _audioCtx.currentTime;
  const noise = _audioCtx.createBufferSource();
  noise.buffer = makeNoiseBuffer(2.5);
  const filter = _audioCtx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(180, now);
  filter.frequency.exponentialRampToValueAtTime(7500, now + 1.6);
  const gain = _audioCtx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.25);
  gain.gain.linearRampToValueAtTime(0.22, now + 1.4);
  gain.gain.linearRampToValueAtTime(0.0, now + 2.4);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(_masterGain);
  noise.start(now);
  noise.stop(now + 2.5);
}

// SFX 4 — Reveal : bell harmonics — ouverture cinéma
function sfxReveal(): void {
  if (!_audioCtx || !_masterGain) return;
  const now = _audioCtx.currentTime;
  // Cloche : 3 harmoniques sine A5 / E6 / A6
  const freqs = [880, 1318.5, 1760];
  const amps = [0.16, 0.075, 0.038];
  for (let i = 0; i < freqs.length; i++) {
    const osc = _audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freqs[i];
    const gain = _audioCtx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(amps[i], now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 3.2);
    osc.connect(gain);
    gain.connect(_masterGain);
    osc.start(now);
    osc.stop(now + 3.3);
  }
  // Sub-bass tonic doux pour ancrer
  const sub = _audioCtx.createOscillator();
  sub.type = "sine";
  sub.frequency.value = 110;
  const subGain = _audioCtx.createGain();
  subGain.gain.setValueAtTime(0, now);
  subGain.gain.linearRampToValueAtTime(0.18, now + 0.5);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 3.5);
  sub.connect(subGain);
  subGain.connect(_masterGain);
  sub.start(now);
  sub.stop(now + 3.5);
}

// ─── SPATIAL DRONE — ambiance section 5-chambres (Gmaj7 contemplatif) ──────
let _spatialDroneInited = false;
let _spatialIntensityGain: GainNode | null = null;
let _spatialPanNode: StereoPannerNode | null = null;
const _spatialDroneBaseGains = [0.18, 0.14, 0.10, 0.06];

function startSpatialDrone(): void {
  if (_spatialDroneInited || !_audioCtx || !_masterGain) return;
  _spatialDroneInited = true;

  _spatialIntensityGain = _audioCtx.createGain();
  _spatialIntensityGain.gain.value = 0;

  _spatialPanNode = _audioCtx.createStereoPanner();
  _spatialPanNode.pan.value = 0;

  _spatialIntensityGain.connect(_spatialPanNode);
  _spatialPanNode.connect(_masterGain);

  // Gmaj7 open voicing : G2 + D3 + B3 + F#4 — pas de sub-bass, mids/highs aérés
  // → totalement distinct du drone cosmique v1 (power chord A1+E2+A2)
  const freqs = [98.0, 146.83, 246.94, 369.99];
  const types: OscillatorType[] = ["sine", "sine", "triangle", "sine"];
  for (let i = 0; i < freqs.length; i++) {
    const osc = _audioCtx.createOscillator();
    osc.type = types[i];
    osc.frequency.value = freqs[i];
    osc.detune.value = (Math.random() - 0.5) * 4;

    const staticGain = _audioCtx.createGain();
    staticGain.gain.value = _spatialDroneBaseGains[i];

    // LFO plus lent que le drone cosmique (0.04 → 0.08 Hz) = respiration contemplative
    const lfo = _audioCtx.createOscillator();
    lfo.frequency.value = 0.04 + i * 0.012;
    const lfoDepth = _audioCtx.createGain();
    lfoDepth.gain.value = _spatialDroneBaseGains[i] * 0.4;
    lfo.connect(lfoDepth);
    lfoDepth.connect(staticGain.gain);

    osc.connect(staticGain);
    staticGain.connect(_spatialIntensityGain);

    osc.start();
    lfo.start();
  }
}

function setSpatialDroneIntensity(progress: number): void {
  if (!_audioCtx) return;
  // Lazy-init au premier appel (après que initAudio() ait créé _audioCtx)
  if (!_spatialDroneInited) startSpatialDrone();
  if (!_spatialIntensityGain) return;

  // Fade-in entry phase (0 → 0.08), stable à 1.0 ensuite
  const intensity = Math.min(1.0, Math.max(0, progress) / 0.08);
  const now = _audioCtx.currentTime;
  _spatialIntensityGain.gain.cancelScheduledValues(now);
  _spatialIntensityGain.gain.linearRampToValueAtTime(intensity, now + 0.6);
}

function setSpatialDronePan(panX: number): void {
  if (!_audioCtx || !_spatialPanNode) return;
  const clamped = Math.max(-1, Math.min(1, panX));
  const now = _audioCtx.currentTime;
  _spatialPanNode.pan.cancelScheduledValues(now);
  _spatialPanNode.pan.linearRampToValueAtTime(clamped, now + 0.8);
}

// ─── SFX UI — nav click + hover tick ────────────────────────────────────────
function sfxNavClick(): void {
  if (!_audioCtx || !_masterGain) return;
  const now = _audioCtx.currentTime;
  // Sweep court 440 → 880 + decay rapide = "tick numérique" sci-fi
  const osc = _audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
  const gain = _audioCtx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc.connect(gain);
  gain.connect(_masterGain);
  osc.start(now);
  osc.stop(now + 0.25);
}

function sfxNavHover(): void {
  if (!_audioCtx || !_masterGain) return;
  const now = _audioCtx.currentTime;
  // Tick très bref + subtil = feedback survol discret
  const osc = _audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 660;
  const gain = _audioCtx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.07, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(gain);
  gain.connect(_masterGain);
  osc.start(now);
  osc.stop(now + 0.08);
}

// ─── HERO HEADER (overlay HTML) ─────────────────────────────────────────────
function HeroHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 grid grid-cols-3 items-start px-8 py-6 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="leading-[0.85]"
        style={{ color: palette.silver }}
      >
        <div className="text-2xl md:text-3xl font-black tracking-[-0.02em] uppercase">
          Vertxia
        </div>
        <div className="text-[9px] font-mono tracking-[0.35em] uppercase opacity-60 mt-1">
          Shopify → 3D
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.6 }}
        className="text-center font-mono text-xs tracking-[0.3em] flex justify-center items-center gap-2"
        style={{ color: palette.silver }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: palette.redNeon, boxShadow: `0 0 8px ${palette.redNeon}` }}
        />
        <span className="opacity-70">REC · 001</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="flex justify-end gap-2 items-center pointer-events-auto"
      >
        <a
          href="mailto:emilien@vertxia.com?subject=Early%20Access%20Vertxia"
          className="px-4 py-2.5 rounded-md text-[11px] font-bold tracking-[0.18em] uppercase transition-all flex items-center gap-2 shadow-lg hover:scale-[1.02]"
          style={{
            background: palette.silver,
            color: palette.bg,
            boxShadow: `0 0 20px rgba(232,232,232,0.15)`,
          }}
        >
          Early Access
          <span aria-hidden>→</span>
        </a>
      </motion.div>
    </header>
  );
}

// ─── TENSION OVERLAY (CSS layers — scanlines + noise + flicker) ────────────
function TensionOverlay({ tensionT }: { tensionT: number }) {
  const flickerOpacity =
    tensionT > 0.4 ? 0.05 + Math.random() * 0.12 * tensionT : 0;

  return (
    <>
      {/* SCANLINES — repeating gradient */}
      <div
        className="absolute inset-0 pointer-events-none z-15"
        style={{
          background: `repeating-linear-gradient(
            0deg,
            transparent 0px,
            transparent 2px,
            rgba(0,0,0,${tensionT * 0.45}) 3px,
            rgba(0,0,0,${tensionT * 0.45}) 4px
          )`,
          opacity: tensionT > 0.2 ? Math.min(1, (tensionT - 0.2) * 2.5) : 0,
          mixBlendMode: "multiply",
        }}
        aria-hidden
      />

      {/* COMPRESSION ARTIFACTS — bandes red translucides aléatoires */}
      <div
        className="absolute inset-0 pointer-events-none z-15"
        style={{
          background: `repeating-linear-gradient(
            ${(Math.random() - 0.5) * 2}deg,
            transparent 0px,
            transparent ${20 + Math.random() * 40}px,
            ${palette.redDeep}${Math.round(tensionT * 80).toString(16).padStart(2, "0")} ${21 + Math.random() * 40}px,
            ${palette.redDeep}${Math.round(tensionT * 80).toString(16).padStart(2, "0")} ${22 + Math.random() * 40}px
          )`,
          opacity: tensionT > 0.5 ? (tensionT - 0.5) * 1.8 : 0,
          mixBlendMode: "screen",
        }}
        aria-hidden
      />

      {/* NOISE SVG — film grain */}
      <div
        className="absolute inset-0 pointer-events-none z-15"
        style={{
          opacity: tensionT * 0.45,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          mixBlendMode: "overlay",
        }}
        aria-hidden
      />

      {/* FLICKER — flash blanc random */}
      <div
        className="absolute inset-0 pointer-events-none z-15"
        style={{
          background: palette.silver,
          opacity: flickerOpacity,
          mixBlendMode: "screen",
        }}
        aria-hidden
      />

      {/* RED PULSE WARNING — bord rouge qui pulse */}
      <div
        className="absolute inset-0 pointer-events-none z-15"
        style={{
          boxShadow: `inset 0 0 ${80 + tensionT * 200}px ${tensionT * 60}px ${palette.redDark}`,
          opacity: tensionT > 0.3 ? (tensionT - 0.3) * 1.4 : 0,
        }}
        aria-hidden
      />
    </>
  );
}

// ─── VIDEO PLANE — la vidéo Higgsfield en VideoTexture sur un plane R3F ────
// COVER-scaling dynamique : le plane remplit toujours le viewport peu importe
// l'aspect ratio écran utilisateur (comme object-fit:cover du <video> HTML).
const VIDEO_ASPECT = 16 / 9;

function VideoPlane({
  videoEl,
  visibleRef,
}: {
  videoEl: HTMLVideoElement | null;
  visibleRef: React.MutableRefObject<boolean>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera, size } = useThree();

  const videoTexture = useMemo(() => {
    if (!videoEl) return null;
    const tex = new THREE.VideoTexture(videoEl);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [videoEl]);

  useFrame(() => {
    if (videoTexture) videoTexture.needsUpdate = true;
    if (!meshRef.current) return;
    meshRef.current.visible = visibleRef.current;

    // Plane position : centré devant la caméra à z=0 (la caméra avance sur z)
    meshRef.current.position.x = 0;
    meshRef.current.position.y = 0;

    // Cover-scaling : calculer le viewport visible à z=0 depuis la caméra
    // (qui peut être à n'importe quel z sur son path)
    const persp = camera as THREE.PerspectiveCamera;
    const distance = Math.abs(persp.position.z); // toujours > 0 (caméra à z>=0 face au plane)
    const fovRad = (persp.fov * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(fovRad / 2) * Math.max(distance, 0.1);
    const visibleWidth = visibleHeight * (size.width / size.height);

    // COVER : prendre le max pour que le plane couvre tout le viewport
    const viewportAspect = size.width / size.height;
    let scaleX: number, scaleY: number;
    if (viewportAspect > VIDEO_ASPECT) {
      // Écran plus large que 16:9 → fit width, height déborde
      scaleX = visibleWidth;
      scaleY = visibleWidth / VIDEO_ASPECT;
    } else {
      // Écran plus carré → fit height, width déborde
      scaleY = visibleHeight;
      scaleX = visibleHeight * VIDEO_ASPECT;
    }
    meshRef.current.scale.set(scaleX, scaleY, 1);
  });

  if (!videoTexture) return null;

  return (
    <mesh ref={meshRef} position={[0, 0, 0]} frustumCulled={false}>
      {/* Plane unitaire — la taille est pilotée par scale dynamique (cover) */}
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={videoTexture} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── EXPLOSION FRAGMENTS (40 PLANE pieces avec UV custom) ──────────────────
const SHATTER_COLS = 8;
const SHATTER_ROWS = 5;

type Fragment = {
  initialPos: [number, number, number];
  uv: [number, number, number, number];
  direction: [number, number, number];
  rotation: [number, number, number];
};

function makeFragments(): Fragment[] {
  const frags: Fragment[] = [];
  const worldW = 12;
  const worldH = 6.75;
  const cellW = worldW / SHATTER_COLS;
  const cellH = worldH / SHATTER_ROWS;
  for (let r = 0; r < SHATTER_ROWS; r++) {
    for (let c = 0; c < SHATTER_COLS; c++) {
      const x = -worldW / 2 + (c + 0.5) * cellW;
      const y = worldH / 2 - (r + 0.5) * cellH;
      const uvX = c / SHATTER_COLS;
      const uvY = 1 - (r + 1) / SHATTER_ROWS;
      const uvW = 1 / SHATTER_COLS;
      const uvH = 1 / SHATTER_ROWS;
      frags.push({
        initialPos: [x, y, 0],
        uv: [uvX, uvY, uvW, uvH],
        direction: [
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.2,
          Math.random() * 3 + 1.5, // bias vers caméra (z+)
        ],
        rotation: [
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 3,
        ],
      });
    }
  }
  return frags;
}

function ShatterFragment({
  fragment,
  videoTexture,
  progressRef,
}: {
  fragment: Fragment;
  videoTexture: THREE.VideoTexture | null;
  progressRef: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  const geometry = useMemo(() => {
    const cellW = 12 / SHATTER_COLS;
    const cellH = 6.75 / SHATTER_ROWS;
    const geo = new THREE.PlaneGeometry(cellW, cellH);
    const uvs = geo.attributes.uv.array as Float32Array;
    const [uvX, uvY, uvW, uvH] = fragment.uv;
    uvs[0] = uvX;       uvs[1] = uvY + uvH;
    uvs[2] = uvX + uvW; uvs[3] = uvY + uvH;
    uvs[4] = uvX;       uvs[5] = uvY;
    uvs[6] = uvX + uvW; uvs[7] = uvY;
    geo.attributes.uv.needsUpdate = true;
    return geo;
  }, [fragment.uv]);

  useFrame(() => {
    const t = Math.min(1, Math.max(0, progressRef.current));
    if (!meshRef.current || !matRef.current) return;

    if (t <= 0 || t >= 1) {
      meshRef.current.visible = false;
      return;
    }
    meshRef.current.visible = true;

    const eased = t * t * t;
    const [ix, iy] = fragment.initialPos;
    const [dx, dy, dz] = fragment.direction;
    meshRef.current.position.set(
      ix + dx * eased * 2.5,
      iy + dy * eased * 2.5,
      dz * eased * 3.5,
    );
    const [rx, ry, rz] = fragment.rotation;
    meshRef.current.rotation.set(rx * eased, ry * eased, rz * eased);

    const fadeStart = 0.45;
    const opacity =
      t < fadeStart ? 1 : Math.max(0, 1 - (t - fadeStart) / (1 - fadeStart));
    matRef.current.opacity = opacity;

    meshRef.current.scale.setScalar(1 + t * 0.3);
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={fragment.initialPos}
      frustumCulled={false}
    >
      <meshBasicMaterial
        ref={matRef}
        map={videoTexture ?? undefined}
        color={videoTexture ? "#ffffff" : palette.silver}
        transparent
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

function VideoShatter({
  videoEl,
  progressRef,
  activeRef,
}: {
  videoEl: HTMLVideoElement | null;
  progressRef: React.MutableRefObject<number>;
  activeRef: React.MutableRefObject<boolean>;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const videoTexture = useMemo(() => {
    if (!videoEl) return null;
    const tex = new THREE.VideoTexture(videoEl);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [videoEl]);

  const fragments = useMemo(() => makeFragments(), []);

  useFrame(() => {
    if (videoTexture) videoTexture.needsUpdate = true;
    if (groupRef.current) groupRef.current.visible = activeRef.current;
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]} visible={false}>
      {fragments.map((f, i) => (
        <ShatterFragment
          key={i}
          fragment={f}
          videoTexture={videoTexture}
          progressRef={progressRef}
        />
      ))}
    </group>
  );
}

// ─── PARTICLE EXPLOSION — ~2200 sparks argent/rouge ─────────────────────────
function ParticleExplosion({
  progressRef,
  activeRef,
}: {
  progressRef: React.MutableRefObject<number>;
  activeRef: React.MutableRefObject<boolean>;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const COUNT = 2200;

  const { positions, velocities, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const silverCol = new THREE.Color(palette.silver);
    const redCol = new THREE.Color(palette.redNeon);
    const dimCol = new THREE.Color(palette.silverDim);

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 11;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4;

      velocities[i * 3] = (Math.random() - 0.5) * 2;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
      velocities[i * 3 + 2] = Math.random() * 4 + 2;

      const rnd = Math.random();
      const col = rnd < 0.6 ? silverCol : rnd < 0.9 ? redCol : dimCol;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    return { positions, velocities, colors };
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;
    if (!activeRef.current) {
      pointsRef.current.visible = false;
      return;
    }
    const t = progressRef.current;
    if (t < 0.05 || t > 1.0) {
      pointsRef.current.visible = false;
      return;
    }
    pointsRef.current.visible = true;

    const eased = t * t;
    const geo = pointsRef.current.geometry as THREE.BufferGeometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      posArr[i3] = positions[i3] + velocities[i3] * eased * 1.4;
      posArr[i3 + 1] = positions[i3 + 1] + velocities[i3 + 1] * eased * 1.4;
      posArr[i3 + 2] = positions[i3 + 2] + velocities[i3 + 2] * eased * 1.4;
    }
    posAttr.needsUpdate = true;

    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = t < 0.85 ? 1 : Math.max(0, 1 - (t - 0.85) / 0.15);
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        sizeAttenuation
        map={particleTex()}
        vertexColors
        transparent
        opacity={1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// ─── UNIVERSE 3D — Tous les éléments wrapped derrière le plane vidéo ──────
// Tout est translaté en z=-5 → derrière le plane vidéo qui est à z=0

function ChromeSphere({
  orbScaleRef,
}: {
  orbScaleRef: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.12;
    meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.08;
    // Collapse : scale 1 → 0 sur signal externe (sphère se compresse vers l'intérieur)
    const s = Math.max(0.001, orbScaleRef.current);
    meshRef.current.scale.set(s, s, s);
    meshRef.current.visible = orbScaleRef.current > 0.01;
  });
  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 6]} />
      <meshStandardMaterial
        color={palette.silver}
        metalness={1}
        roughness={0.08}
        envMapIntensity={2.2}
      />
    </mesh>
  );
}

function WireframeOrbit() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.position.x = Math.cos(t * 0.25) * 2.2;
    groupRef.current.position.z = Math.sin(t * 0.25) * 2.2;
    groupRef.current.position.y = Math.sin(t * 0.5) * 0.3;
    groupRef.current.rotation.x = t * 0.4;
    groupRef.current.rotation.y = t * 0.3;
  });
  return (
    <group ref={groupRef}>
      <mesh>
        <icosahedronGeometry args={[0.7, 1]} />
        <meshBasicMaterial color={palette.redNeon} wireframe transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function Monoliths() {
  const positions: [number, number, number][] = [
    [-4.5, -0.5, -5],
    [4.2, -0.3, -6],
    [-2.5, 0.2, -8],
    [3.0, 0.5, -9],
    [0, 0.8, -11],
  ];
  return (
    <>
      {positions.map(([x, y, z], i) => {
        const height = 3 + (i % 3) * 1.5;
        return (
          <mesh key={i} position={[x, y, z]} castShadow>
            <boxGeometry args={[0.4, height, 0.4]} />
            <meshStandardMaterial
              color={palette.bgDeep}
              metalness={0.85}
              roughness={0.4}
              emissive={palette.redDeep}
              emissiveIntensity={0.15}
            />
          </mesh>
        );
      })}
    </>
  );
}

function GlassShards() {
  // Réduit à 3 shards (au lieu de 5) — MeshTransmissionMaterial est lourd
  const shards: { pos: [number, number, number]; scale: number; geom: "oct" | "tet" | "ico" }[] = [
    { pos: [-2.2, 1.2, 0.5], scale: 0.45, geom: "oct" },
    { pos: [2.5, -0.8, -1.2], scale: 0.6, geom: "tet" },
    { pos: [1.8, 1.5, -2.5], scale: 0.4, geom: "ico" },
  ];
  return (
    <>
      {shards.map((s, i) => (
        <Float
          key={i}
          speed={0.8 + (i % 3) * 0.3}
          rotationIntensity={0.6}
          floatIntensity={0.3}
        >
          <mesh position={s.pos} scale={s.scale}>
            {s.geom === "oct" && <octahedronGeometry args={[1, 0]} />}
            {s.geom === "tet" && <tetrahedronGeometry args={[1, 0]} />}
            {s.geom === "ico" && <icosahedronGeometry args={[1, 0]} />}
            <MeshTransmissionMaterial
              transmissionSampler
              transmission={0.95}
              thickness={0.5}
              roughness={0.1}
              chromaticAberration={0.18}
              anisotropicBlur={0.05}
              distortion={0.05}
              distortionScale={0.2}
              temporalDistortion={0.05}
              resolution={64}
              samples={2}
              ior={1.5}
              color={palette.silver}
            />
          </mesh>
        </Float>
      ))}
    </>
  );
}

function NeonTrail({
  radius,
  speed,
  phase,
  visibleRef,
}: {
  radius: number;
  speed: number;
  phase: number;
  visibleRef: React.MutableRefObject<boolean>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  // Le Trail de drei utilise un line2 hors du parent group → visible=false du group parent
  // ne suffit pas. On déplace l'émetteur à l'infini ET on cache le mesh quand inactif.
  useFrame((state) => {
    if (!meshRef.current) return;
    const visible = visibleRef.current;
    meshRef.current.visible = visible;
    if (!visible) {
      // Téléporter l'émetteur loin pour éviter que le trail s'étire vers le centre
      meshRef.current.position.set(9999, 9999, 9999);
      return;
    }
    const t = state.clock.elapsedTime * speed + phase;
    meshRef.current.position.x = Math.cos(t) * radius;
    meshRef.current.position.z = Math.sin(t) * radius;
    meshRef.current.position.y = Math.sin(t * 1.3) * 0.5;
  });
  return (
    <Trail
      width={0.15}
      color={palette.redNeon}
      length={4}
      decay={1.2}
      attenuation={(w) => w * w}
    >
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color={palette.redNeon} toneMapped={false} />
      </mesh>
    </Trail>
  );
}

function HoloPanels() {
  const positions: { pos: [number, number, number]; rot: [number, number, number] }[] = [
    { pos: [-3.5, 1.5, -3], rot: [0, 0.4, 0] },
    { pos: [3.2, 0.8, -3.5], rot: [0, -0.5, 0] },
    { pos: [-1.5, -1.2, -2.8], rot: [0, 0.2, 0.1] },
    { pos: [2.0, -1.5, -2.2], rot: [0, -0.3, -0.1] },
  ];
  return (
    <>
      {positions.map((p, i) => (
        <Float key={i} speed={0.5} rotationIntensity={0.2} floatIntensity={0.5}>
          <mesh position={p.pos} rotation={p.rot}>
            <planeGeometry args={[1.5, 1, 8, 6]} />
            <meshBasicMaterial
              color={palette.redDark}
              wireframe
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
            />
          </mesh>
        </Float>
      ))}
    </>
  );
}

function FloatingTypo({ visibleRef }: { visibleRef: React.MutableRefObject<boolean> }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.y = Math.sin(t * 0.15) * 0.1;
    groupRef.current.position.y = 2.4 + Math.sin(t * 0.6) * 0.15;
    groupRef.current.visible = visibleRef.current;
  });
  return (
    <group ref={groupRef} position={[0, 2.4, -3]} visible={false}>
      <Text
        fontSize={0.6}
        color={palette.silver}
        anchorX="center"
        anchorY="middle"
        material-transparent
        material-opacity={0.7}
        material-toneMapped={false}
        letterSpacing={0.05}
      >
        VERTXIA
      </Text>
    </group>
  );
}

// ─── COSMIC EXPLOSION — 8000 points cosmic-colored slow-motion ─────────────
function CosmicExplosion({
  progressRef,
  activeRef,
}: {
  progressRef: React.MutableRefObject<number>;
  activeRef: React.MutableRefObject<boolean>;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const COUNT = 8000;

  const { positions, velocities, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const cBlue = new THREE.Color(palette.cosmicBlue);
    const cViolet = new THREE.Color(palette.cosmicViolet);
    const cVioletL = new THREE.Color(palette.cosmicVioletLight);
    const cSilver = new THREE.Color(palette.silver);
    const cGold = new THREE.Color(palette.cosmicGold);

    for (let i = 0; i < COUNT; i++) {
      // Position initiale : tous au centre (point d'impact orb)
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      // Vélocité : sphère uniforme avec random magnitude (poussière cosmique)
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.acos(2 * Math.random() - 1);
      const speed = 1.5 + Math.random() * 6;
      velocities[i * 3] = Math.sin(theta) * Math.cos(phi) * speed;
      velocities[i * 3 + 1] = Math.sin(theta) * Math.sin(phi) * speed;
      velocities[i * 3 + 2] = Math.cos(theta) * speed;

      // Couleurs cosmiques : 40% bleu, 25% violet, 15% violet clair, 15% argent, 5% doré
      const rnd = Math.random();
      let col: THREE.Color;
      if (rnd < 0.4) col = cBlue;
      else if (rnd < 0.65) col = cViolet;
      else if (rnd < 0.8) col = cVioletL;
      else if (rnd < 0.95) col = cSilver;
      else col = cGold;

      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    return { positions, velocities, colors };
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;
    if (!activeRef.current) {
      pointsRef.current.visible = false;
      return;
    }
    pointsRef.current.visible = true;

    const t = progressRef.current; // 0 → 1
    // EaseOut cubic : démarre vite (slow motion sensation) puis ralentit
    const eased = 1 - Math.pow(1 - t, 3);
    const geo = pointsRef.current.geometry as THREE.BufferGeometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      // Position = velocity * eased * scaleFactor + slight rotation
      const vx = velocities[i3];
      const vy = velocities[i3 + 1];
      const vz = velocities[i3 + 2];
      posArr[i3] = vx * eased * 1.2;
      posArr[i3 + 1] = vy * eased * 1.2;
      posArr[i3 + 2] = vz * eased * 1.2;
    }
    posAttr.needsUpdate = true;

    // Opacity fade : visible vite, fade out vers la fin (la galaxie prend le relais)
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    if (t < 0.15) mat.opacity = t / 0.15; // fade in
    else if (t > 0.7) mat.opacity = Math.max(0, 1 - (t - 0.7) / 0.3); // fade out
    else mat.opacity = 1;
  });

  return (
    <points ref={pointsRef} frustumCulled={false} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        sizeAttenuation
        map={particleTex()}
        vertexColors
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// ─── GALAXY — 15000 points spirale logarithmique 4 bras + 4 Nebulae ────────
function Galaxy({
  progressRef,
  visibleRef,
  scrollProgressRef,
}: {
  progressRef: React.MutableRefObject<number>;
  visibleRef: React.MutableRefObject<boolean>;
  scrollProgressRef: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const COUNT = 15000;
  const BRANCHES = 4;
  const ARM_OFFSET = (Math.PI * 2) / BRANCHES;
  const RADIUS_MAX = 8;
  const TWIST = 1.6; // intensité de la spirale

  // Note : on stocke aussi initialR + initialAngle + initialY pour pouvoir
  // muter les positions en phase suction (vortex collapse) sans perdre l'état initial
  const { positions, colors, initialR, initialAngle, initialY } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const initialR = new Float32Array(COUNT);
    const initialAngle = new Float32Array(COUNT);
    const initialY = new Float32Array(COUNT);
    const cBlue = new THREE.Color(palette.cosmicBlue);
    const cViolet = new THREE.Color(palette.cosmicViolet);
    const cVioletL = new THREE.Color(palette.cosmicVioletLight);
    const cSilver = new THREE.Color(palette.silver);
    const cGold = new THREE.Color(palette.cosmicGold);

    for (let i = 0; i < COUNT; i++) {
      // Distance au centre : skew vers extérieur (sqrt pour densité variable)
      const t = Math.pow(Math.random(), 0.7);
      const radius = t * RADIUS_MAX;

      // Bras galactique : 4 branches espacées de π/2
      const branch = i % BRANCHES;
      const branchAngle = branch * ARM_OFFSET;
      // Twist : plus on est loin, plus la spirale tord
      const spinAngle = radius * TWIST;
      // Random scatter autour du bras
      const scatter = (1 - t) * 0.6 + 0.1;
      const rx = (Math.random() - 0.5) * scatter;
      const ry = (Math.random() - 0.5) * scatter * 0.3; // disque mince Y
      const rz = (Math.random() - 0.5) * scatter;

      const totalAngle = branchAngle + spinAngle;
      const px = Math.cos(totalAngle) * radius + rx;
      const pz = Math.sin(totalAngle) * radius + rz;
      const py = ry * (1 - t * 0.7);
      positions[i * 3] = px;
      positions[i * 3 + 1] = py;
      positions[i * 3 + 2] = pz;
      // Snapshot pour la phase suction (recalc r/angle après scatter)
      initialR[i] = Math.sqrt(px * px + pz * pz);
      initialAngle[i] = Math.atan2(pz, px);
      initialY[i] = py;

      // Couleurs : centre doré → milieu blanc → bras bleu/violet
      const colorRnd = Math.random();
      let col: THREE.Color;
      if (t < 0.15 && colorRnd < 0.6) {
        col = cGold; // cœur galaxie doré
      } else if (t < 0.4) {
        col = colorRnd < 0.5 ? cSilver : cVioletL;
      } else {
        // Bras extérieurs : bleu cosmique dominant + violet
        col = colorRnd < 0.55 ? cBlue : colorRnd < 0.85 ? cViolet : cVioletL;
      }
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    return { positions, colors, initialR, initialAngle, initialY };
  }, []);

  useFrame((state) => {
    if (!groupRef.current || !pointsRef.current) return;
    groupRef.current.visible = visibleRef.current;
    if (!visibleRef.current) return;

    const raw = scrollProgressRef.current;
    // Phase SUCTION : 0 (avant 0.91) → 1 (à HYPERSPACE_START = 0.96)
    const suctionT = Math.max(
      0,
      Math.min(1, (raw - PHASE_SUCTION_START) / (PHASE_HYPERSPACE_START - PHASE_SUCTION_START)),
    );
    // EaseIn quad pour démarrage lent puis aspiration violente
    const suction = suctionT * suctionT;

    // Rotation pendant la phase suction : vortex, mais contemplatif
    // Base : 0.08 (rotation majestueuse normale)
    // En suction : +1.2 (tourbillon visible mais plus lent — perception "ralenti cosmique")
    const baseRotSpeed = 0.08;
    const vortexRotBoost = suction * 1.2;
    groupRef.current.rotation.y =
      state.clock.elapsedTime * (baseRotSpeed + vortexRotBoost);
    groupRef.current.rotation.x = -0.32 + suction * 0.32; // se redresse vers horizontal en suction

    // Mutation des positions en phase suction : VORTEX COLLAPSE
    if (suction > 0.001) {
      const geo = pointsRef.current.geometry as THREE.BufferGeometry;
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;

      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3;
        const r0 = initialR[i];
        const a0 = initialAngle[i];
        const y0 = initialY[i];

        // Réduction radiale : points convergent au centre (mais conservent un floor minimal pour stretch)
        const r = r0 * (1 - suction * 0.97);
        // Spin tangentiel : effet vortex local (la rotation locale s'ajoute à la rotation globale du groupe)
        const extraSpin = suction * 2.0;
        const spin = a0 + extraSpin;
        // Compression Y : disque s'écrase
        const y = y0 * (1 - suction * 0.92);

        posArr[i3] = Math.cos(spin) * r;
        posArr[i3 + 1] = y;
        posArr[i3 + 2] = Math.sin(spin) * r;
      }
      posAttr.needsUpdate = true;
    }

    // Material : opacity fade-in, puis fade-out vers la fin (hyperspace prend le relais)
    const t = progressRef.current;
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    const fadeIn = Math.min(1, t * 1.4);
    // En phase HYPERSPACE : fade out progressif (la galaxie disparaît absorbée)
    const hyperT = Math.max(0, Math.min(1, (raw - PHASE_HYPERSPACE_START) / (1 - PHASE_HYPERSPACE_START)));
    const fadeOut = 1 - hyperT;
    mat.opacity = fadeIn * fadeOut;
    // Point size : augmente fortement en suction (illusion d'élongation / motion blur des étoiles aspirées)
    mat.size = 0.055 + suction * 0.18;
  });

  return (
    <group ref={groupRef} visible={false}>
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.035}
          sizeAttenuation
          map={particleTex()}
          vertexColors
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Nébuleuses : 4 sphères larges semi-transparentes additif — aspirées en phase suction */}
      <Nebulae scrollProgressRef={scrollProgressRef} />

      {/* Cœur lumineux doré : fade-out en phase suction (avalé par le trou noir) */}
      <GoldenCore scrollProgressRef={scrollProgressRef} />
    </group>
  );
}

// ─── NEBULAE — 4 sphères diffuses, aspirées et compressées en phase suction ──
const NEBULAE_DATA: { pos: [number, number, number]; scale: number; color: string }[] = [
  { pos: [3.5, 0.4, 1], scale: 3.2, color: palette.cosmicBlue },
  { pos: [-3.2, -0.3, 1.8], scale: 2.6, color: palette.cosmicViolet },
  { pos: [1.8, 0.8, -3], scale: 2.4, color: palette.cosmicVioletLight },
  { pos: [-1.5, -0.6, -2], scale: 2.0, color: palette.cosmicBlueDeep },
];

function Nebulae({ scrollProgressRef }: { scrollProgressRef: React.MutableRefObject<number> }) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(() => {
    const raw = scrollProgressRef.current;
    // Phase SUCTION (0 avant 0.91, 1 à HYPERSPACE_START = 0.96)
    const suctionT = Math.max(
      0,
      Math.min(1, (raw - PHASE_SUCTION_START) / (PHASE_HYPERSPACE_START - PHASE_SUCTION_START)),
    );
    const s = suctionT * suctionT; // easeIn quad
    const pullFactor = 1 - s * 0.95; // 1 → 0.05 (attraction quasi totale)
    const scaleFactor = 1 - s * 0.85; // 1 → 0.15 (compression)
    const opacity = 0.12 * (1 - s); // 0.12 → 0 (absorption)

    for (let i = 0; i < NEBULAE_DATA.length; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;
      const n = NEBULAE_DATA[i];
      mesh.position.set(n.pos[0] * pullFactor, n.pos[1] * pullFactor, n.pos[2] * pullFactor);
      mesh.scale.setScalar(n.scale * scaleFactor);
      mesh.visible = opacity > 0.003;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = opacity;
    }
  });

  return (
    <>
      {NEBULAE_DATA.map((n, i) => (
        <mesh key={i} ref={(el) => { meshRefs.current[i] = el; }}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial
            color={n.color}
            transparent
            opacity={0.12}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

function GoldenCore({ scrollProgressRef }: { scrollProgressRef: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!meshRef.current) return;
    const raw = scrollProgressRef.current;
    const suctionT = Math.max(
      0,
      Math.min(1, (raw - PHASE_SUCTION_START) / (PHASE_HYPERSPACE_START - PHASE_SUCTION_START)),
    );
    // Le cœur doré fade-out rapidement en phase suction (avalé par le trou noir qui émerge)
    const opacity = 0.85 * Math.max(0, 1 - suctionT * 2);
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity;
    meshRef.current.visible = opacity > 0.005;
    // Scale aussi shrink
    meshRef.current.scale.setScalar(Math.max(0.05, 1 - suctionT * 0.95));
  });
  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <sphereGeometry args={[0.4, 32, 32]} />
      <meshBasicMaterial
        color={palette.cosmicGold}
        transparent
        opacity={0.85}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function Nebula({
  pos,
  scale,
  color,
}: {
  pos: [number, number, number];
  scale: number;
  color: string;
}) {
  return (
    <mesh position={pos} scale={scale}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.12}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

// ─── MINIMAL REVEAL — le site émerge du néant : ligne → wireframe → UI ─────
// 4 sub-phases progressives dans PHASE_REVEAL_START → 1.0 :
//   0.00-0.25 : ligne lumineuse horizontale au loin (z=-45 local = world z=-50)
//   0.25-0.55 : ligne grandit, devient un wireframe rectangle subtle
//   0.55-0.80 : éléments UI 3D apparaissent (typo VERTXIA, sous-titre, lignes déco)
//   0.80-1.00 : logo glow + finalisation
function MinimalReveal({
  scrollProgressRef,
}: {
  scrollProgressRef: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.Mesh>(null);
  const wireframeRef = useRef<THREE.LineSegments>(null);
  const titleRef = useRef<THREE.Group>(null);
  const subtitleRef = useRef<THREE.Group>(null);
  const decoLineTopRef = useRef<THREE.Mesh>(null);
  const decoLineBotRef = useRef<THREE.Mesh>(null);
  const logoCoreRef = useRef<THREE.Mesh>(null);
  const logoHaloRef = useRef<THREE.Mesh>(null);

  // Position cible du site : world z = -50 (donc local z = -45 dans Universe3D à z=-5)
  const SITE_Z = -45;

  // Wireframe edges (rectangle 8x4.5 ratio cinéma)
  const wireframeGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const w = 8;
    const h = 4.5;
    const points = new Float32Array([
      // 4 coins reliés (rectangle)
      -w/2, -h/2, 0,  w/2, -h/2, 0,
       w/2, -h/2, 0,  w/2,  h/2, 0,
       w/2,  h/2, 0, -w/2,  h/2, 0,
      -w/2,  h/2, 0, -w/2, -h/2, 0,
    ]);
    geo.setAttribute("position", new THREE.BufferAttribute(points, 3));
    return geo;
  }, []);

  useFrame(() => {
    if (!groupRef.current) return;
    const raw = scrollProgressRef.current;
    // Pas encore en phase reveal
    if (raw < PHASE_REVEAL_START - 0.005) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    // T local 0→1 sur la phase reveal
    const t = Math.max(0, Math.min(1, (raw - PHASE_REVEAL_START) / (1 - PHASE_REVEAL_START)));

    // ── Sub-phase 1 : ligne lumineuse (0→0.25) ────────────────────────────
    const lineT = Math.min(1, t / 0.25);
    if (lineRef.current) {
      // La ligne apparaît en s'étendant horizontalement
      const lineWidth = lineT * 1.5; // grandit jusqu'à 1.5 unités
      lineRef.current.scale.set(lineWidth, 1, 1);
      const mat = lineRef.current.material as THREE.MeshBasicMaterial;
      // Fade in puis fade out quand le wireframe prend le relais
      const wireOverlap = Math.max(0, (t - 0.25) / 0.1);
      mat.opacity = lineT * (1 - wireOverlap * 0.7);
      lineRef.current.visible = mat.opacity > 0.01;
    }

    // ── Sub-phase 2 : wireframe (0.25→0.55) ───────────────────────────────
    const wireT = Math.max(0, Math.min(1, (t - 0.25) / 0.30));
    if (wireframeRef.current) {
      wireframeRef.current.scale.setScalar(0.3 + wireT * 0.7); // grandit de 30% à 100%
      const mat = wireframeRef.current.material as THREE.LineBasicMaterial;
      // Fade in en début, reste visible jusqu'à la fin
      const fadeOutUI = Math.max(0, (t - 0.85) / 0.15);
      mat.opacity = wireT * 0.4 * (1 - fadeOutUI * 0.5);
      wireframeRef.current.visible = mat.opacity > 0.01;
    }

    // ── Sub-phase 3 : typo + sous-titre + lignes déco (0.55→0.85) ─────────
    const uiT = Math.max(0, Math.min(1, (t - 0.55) / 0.30));
    const uiEased = 1 - Math.pow(1 - uiT, 3); // easeOut cubic pour entrée douce
    if (titleRef.current) {
      titleRef.current.visible = uiEased > 0.005;
      // Légère élévation à l'entrée (translate Y de 0.3 → 0)
      titleRef.current.position.y = 0.7 + (1 - uiEased) * 0.3;
      // Opacity via scale (le Text material gère son propre opacity)
      titleRef.current.scale.setScalar(0.9 + uiEased * 0.1);
    }
    if (subtitleRef.current) {
      subtitleRef.current.visible = uiEased > 0.1;
      const subT = Math.max(0, (uiT - 0.15) / 0.85);
      subtitleRef.current.position.y = -0.4 - (1 - subT) * 0.2;
    }
    if (decoLineTopRef.current && decoLineBotRef.current) {
      const decoOpacity = uiEased * 0.35;
      const matT = decoLineTopRef.current.material as THREE.MeshBasicMaterial;
      const matB = decoLineBotRef.current.material as THREE.MeshBasicMaterial;
      matT.opacity = decoOpacity;
      matB.opacity = decoOpacity;
      decoLineTopRef.current.scale.x = uiEased * 2.5;
      decoLineBotRef.current.scale.x = uiEased * 2.5;
      decoLineTopRef.current.visible = decoOpacity > 0.01;
      decoLineBotRef.current.visible = decoOpacity > 0.01;
    }

    // ── Sub-phase 4 : logo glow (0.80→1.0) ────────────────────────────────
    const logoT = Math.max(0, Math.min(1, (t - 0.80) / 0.20));
    const logoEased = 1 - Math.pow(1 - logoT, 2);
    if (logoCoreRef.current) {
      logoCoreRef.current.visible = logoEased > 0.005;
      logoCoreRef.current.scale.setScalar(0.08 + logoEased * 0.05); // grandit doucement
      const mat = logoCoreRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = logoEased * 0.95;
    }
    if (logoHaloRef.current) {
      logoHaloRef.current.visible = logoEased > 0.005;
      logoHaloRef.current.scale.setScalar(0.16 + logoEased * 0.12);
      const mat = logoHaloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = logoEased * 0.35;
    }
  });

  return (
    <group ref={groupRef} visible={false} position={[0, 0, SITE_Z]}>
      {/* Ligne lumineuse initiale (fine, horizontale, blanche) */}
      <mesh ref={lineRef} position={[0, 0, 0]}>
        <planeGeometry args={[1, 0.02]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wireframe rectangle subtle */}
      <lineSegments ref={wireframeRef} geometry={wireframeGeo}>
        <lineBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>

      {/* Logo : sphère blanche lumineuse au centre */}
      <mesh ref={logoCoreRef} position={[0, 0, 0.05]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Logo halo : sphère plus large diffuse */}
      <mesh ref={logoHaloRef} position={[0, 0, 0.04]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Typo VERTXIA en 3D (drei Text) */}
      <group ref={titleRef} visible={false} position={[0, 0.7, 0.1]}>
        <Text
          fontSize={0.85}
          letterSpacing={-0.04}
          color="#FFFFFF"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0}
          material-toneMapped={false}
        >
          VERTXIA
        </Text>
      </group>

      {/* Sous-titre */}
      <group ref={subtitleRef} visible={false} position={[0, -0.4, 0.1]}>
        <Text
          fontSize={0.18}
          letterSpacing={0.3}
          color="#E8E8E8"
          anchorX="center"
          anchorY="middle"
          material-toneMapped={false}
          fillOpacity={0.7}
        >
          SHOPIFY → 3D
        </Text>
      </group>

      {/* Ligne déco supérieure (au-dessus du titre) */}
      <mesh ref={decoLineTopRef} position={[0, 1.5, 0.05]}>
        <planeGeometry args={[1, 0.008]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Ligne déco inférieure (sous le sous-titre) */}
      <mesh ref={decoLineBotRef} position={[0, -0.95, 0.05]}>
        <planeGeometry args={[1, 0.008]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ─── RESIDUAL PARTICLES — particules résiduelles flottantes après le tunnel ───
// Apparaissent en phase DECEL : ambiance "poussière cosmique" calme, prélude au site
function ResidualParticles({
  scrollProgressRef,
}: {
  scrollProgressRef: React.MutableRefObject<number>;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const COUNT = 120;
  const SPREAD = 12; // dispersion autour du centre caméra (local Universe3D)

  const { positions, drift } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const drift = new Float32Array(COUNT * 3); // micro-vélocité pour flottement doux
    for (let i = 0; i < COUNT; i++) {
      // Distribution sphérique autour du centre (caméra forward dans tunnel)
      const r = Math.pow(Math.random(), 0.6) * SPREAD;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = -30 + Math.random() * 50; // entre z=-30 et z=20 (local)
      // Drift : très lent flottement aléatoire
      drift[i * 3] = (Math.random() - 0.5) * 0.05;
      drift[i * 3 + 1] = (Math.random() - 0.5) * 0.05;
      drift[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }
    return { positions, drift };
  }, []);

  useFrame((_state, delta) => {
    if (!pointsRef.current) return;
    const raw = scrollProgressRef.current;
    // Visible uniquement en phase decel et au-delà
    if (raw < PHASE_TUNNEL_DECEL_START - 0.005) {
      pointsRef.current.visible = false;
      return;
    }
    pointsRef.current.visible = true;

    // Fade in progressif pendant la décélération (mappé sur la même fenêtre que le tunnel)
    const decelT = Math.max(
      0,
      Math.min(1, (raw - PHASE_TUNNEL_DECEL_START) / (PHASE_REVEAL_START - PHASE_TUNNEL_DECEL_START)),
    );
    const fadeIn = Math.min(1, decelT * 2); // monte vite, plafonne à 0.5 decel
    // Fade-out en fin de reveal (le site prend toute l'attention)
    const revealT = Math.max(0, Math.min(1, (raw - PHASE_REVEAL_START) / (1 - PHASE_REVEAL_START)));
    const fadeOutReveal = 1 - revealT * 0.5; // reste à 50% en fin pour ambiance
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = fadeIn * 0.55 * fadeOutReveal;

    // Mouvement doux : drift très lent pour ambiance contemplative
    const dt = Math.min(0.05, delta);
    const geo = pointsRef.current.geometry as THREE.BufferGeometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      posArr[i3] += drift[i3] * dt;
      posArr[i3 + 1] += drift[i3 + 1] * dt;
      posArr[i3 + 2] += drift[i3 + 2] * dt;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        sizeAttenuation
        map={particleTex()}
        color="#FFFFFF"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

// ─── HYPERSPACE TUNNEL — plongée dans la singularité, streaming vers caméra ────
function HyperspaceTunnel({
  visibleRef,
  scrollProgressRef,
}: {
  visibleRef: React.MutableRefObject<boolean>;
  scrollProgressRef: React.MutableRefObject<number>;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const COUNT = 12000;
  const TUNNEL_LENGTH = 80; // longueur Z totale du tunnel
  const TUNNEL_Z_MIN = -50;
  const TUNNEL_Z_MAX = 30;
  const RADIUS_MIN = 0.4;
  const RADIUS_MAX = 5.5;

  const { positions, velocities, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT); // vitesse Z par point (variable)
    const colors = new Float32Array(COUNT * 3);
    const cWhite = new THREE.Color("#FFFFFF");
    const cBlue = new THREE.Color(palette.cosmicBlue);
    const cViolet = new THREE.Color(palette.cosmicViolet);
    const cVioletL = new THREE.Color(palette.cosmicVioletLight);
    const cGold = new THREE.Color(palette.cosmicGold);

    for (let i = 0; i < COUNT; i++) {
      // Distribution radiale : densité plus forte près du centre (illusion de tunnel)
      const r = RADIUS_MIN + Math.pow(Math.random(), 1.5) * (RADIUS_MAX - RADIUS_MIN);
      const theta = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = Math.sin(theta) * r;
      // Z initial : distribué sur toute la longueur du tunnel
      positions[i * 3 + 2] = TUNNEL_Z_MIN + Math.random() * TUNNEL_LENGTH;

      // Vélocité Z (vers la caméra) : variable pour effet de profondeur
      velocities[i] = 20 + Math.random() * 50;

      // Couleur : centre blanc-hot, bords bleus/violets, accents dorés rares
      const normalizedR = (r - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN);
      const cRnd = Math.random();
      let col: THREE.Color;
      if (normalizedR < 0.25) {
        // Centre : 70% blanc, 20% doré, 10% violet pâle
        col = cRnd < 0.7 ? cWhite : cRnd < 0.9 ? cGold : cVioletL;
      } else if (normalizedR < 0.6) {
        // Mi-rayon : 50% blanc, 30% violet pâle, 20% bleu
        col = cRnd < 0.5 ? cWhite : cRnd < 0.8 ? cVioletL : cBlue;
      } else {
        // Bords : 50% bleu, 40% violet, 10% blanc
        col = cRnd < 0.5 ? cBlue : cRnd < 0.9 ? cViolet : cWhite;
      }
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    return { positions, velocities, colors };
  }, []);

  useFrame((_state, delta) => {
    if (!pointsRef.current) return;
    if (!visibleRef.current) {
      pointsRef.current.visible = false;
      return;
    }
    pointsRef.current.visible = true;

    const raw = scrollProgressRef.current;
    // Phase chaos : tunnel à pleine vitesse (boost vitesse 1x → 4x)
    const chaosT = Math.max(
      0,
      Math.min(1, (raw - PHASE_HYPERSPACE_START) / (PHASE_TUNNEL_DECEL_START - PHASE_HYPERSPACE_START)),
    );
    // Phase decel : extinction du tunnel entre PHASE_TUNNEL_DECEL_START et PHASE_REVEAL_START
    // (le tunnel doit être complètement éteint quand la révélation commence)
    const decelT = Math.max(
      0,
      Math.min(1, (raw - PHASE_TUNNEL_DECEL_START) / (PHASE_REVEAL_START - PHASE_TUNNEL_DECEL_START)),
    );
    // Easing : ralentissement rapide au début, traînée douce vers le silence
    const decelEased = decelT * decelT;
    // Speed boost combiné : monte 1→4 en chaos puis redescend 4→0.05 en decel
    const speedBoost = (1 + chaosT * 3) * (1 - decelEased * 0.99);
    // Clamp delta pour éviter saut massif si tab inactif
    const dt = Math.min(0.05, delta);

    const geo = pointsRef.current.geometry as THREE.BufferGeometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      // Avancée vers la caméra : Z += vitesse * delta * boost
      posArr[i3 + 2] += velocities[i] * dt * speedBoost;
      // Recycler : si dépassé la limite max, réapparaît au début
      if (posArr[i3 + 2] > TUNNEL_Z_MAX) {
        posArr[i3 + 2] = TUNNEL_Z_MIN;
      }
    }
    posAttr.needsUpdate = true;

    // Material opacity : fade-in en début, puis extinction progressive en phase decel
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    const fadeIn = Math.max(0, Math.min(1, (raw - (PHASE_HYPERSPACE_START - 0.02)) / 0.05));
    const extinction = 1 - decelEased * 0.97; // 1 → 0.03 (presque éteint en fin)
    mat.opacity = fadeIn * 0.9 * extinction;
    // Size : grandit pendant le chaos, shrink en decel (les particules deviennent ténues)
    mat.size = (0.06 + chaosT * 0.06) * (1 - decelT * 0.6);
  });

  return (
    <points ref={pointsRef} frustumCulled={false} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        sizeAttenuation
        map={particleTex()}
        vertexColors
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

// ─── BACKGROUND STARS — espace cosmique profond dès l'explosion de l'orbe ────
// 2500 étoiles statiques distribuées dans une grande sphère, visibles dès que
// l'orbe explose et qu'on quitte le world 3D pour entrer dans l'espace.
function BackgroundStars({
  visibleRef,
  scrollProgressRef,
}: {
  visibleRef: React.MutableRefObject<boolean>;
  scrollProgressRef: React.MutableRefObject<number>;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const COUNT = 2500;
  const RADIUS_INNER = 18; // au-delà des contenus cosmiques (galaxy radius_max = 8)
  const RADIUS_OUTER = 55;

  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);
    const cWhite = new THREE.Color("#FFFFFF");
    const cSilver = new THREE.Color(palette.silver);
    const cBlue = new THREE.Color(palette.cosmicBlue);
    const cVioletL = new THREE.Color(palette.cosmicVioletLight);

    for (let i = 0; i < COUNT; i++) {
      // Distribution sphérique uniforme entre RADIUS_INNER et RADIUS_OUTER
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      // Skew vers le rayon extérieur pour densité réaliste
      const r = RADIUS_INNER + Math.pow(Math.random(), 0.7) * (RADIUS_OUTER - RADIUS_INNER);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Couleur : 70% blanc, 15% argent, 10% bleu cosmique, 5% violet pâle
      const cRnd = Math.random();
      let col: THREE.Color;
      if (cRnd < 0.7) col = cWhite;
      else if (cRnd < 0.85) col = cSilver;
      else if (cRnd < 0.95) col = cBlue;
      else col = cVioletL;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      // Taille variable pour donner de la profondeur (petite à 0.4, grosse à 1.2)
      sizes[i] = 0.4 + Math.pow(Math.random(), 2) * 0.8;
    }
    return { positions, colors, sizes };
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;
    if (!visibleRef.current) {
      pointsRef.current.visible = false;
      return;
    }
    pointsRef.current.visible = true;

    const raw = scrollProgressRef.current;
    const mat = pointsRef.current.material as THREE.PointsMaterial;

    // Fade-in entre PHASE_COSMIC_EXPLOSION_START et PHASE_GALAXY_START (apparition douce)
    const fadeIn = Math.max(
      0,
      Math.min(1, (raw - PHASE_COSMIC_EXPLOSION_START) / (PHASE_GALAXY_START - PHASE_COSMIC_EXPLOSION_START)),
    );
    // Fade-out en hyperspace (les étoiles disparaissent absorbées par le tunnel)
    const hyperT = Math.max(0, Math.min(1, (raw - PHASE_HYPERSPACE_START) / (1 - PHASE_HYPERSPACE_START)));
    mat.opacity = fadeIn * (1 - hyperT) * 0.85;
  });

  return (
    <points ref={pointsRef} frustumCulled={false} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        sizeAttenuation
        map={particleTex()}
        vertexColors
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

// ─── BLACK HOLE — émerge au cœur de la galaxie, halo gravitationnel pur ───────
function BlackHole({
  progressRef,
  visibleRef,
}: {
  progressRef: React.MutableRefObject<number>;
  visibleRef: React.MutableRefObject<boolean>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const haloOuterRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    if (!visibleRef.current) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    const raw = progressRef.current;
    // Émergence : 0 (avant 0.85) → 1 (à SUCTION_START = 0.91)
    const tEmerge = Math.max(
      0,
      Math.min(1, (raw - PHASE_BLACKHOLE_START) / (PHASE_SUCTION_START - PHASE_BLACKHOLE_START)),
    );
    const emerge = 1 - Math.pow(1 - tEmerge, 3); // easeOut cubic

    // Croissance pendant la phase suction : 1 → 1.6 (le trou noir devient plus menaçant)
    const tGrow = Math.max(
      0,
      Math.min(1, (raw - PHASE_SUCTION_START) / (PHASE_HYPERSPACE_START - PHASE_SUCTION_START)),
    );
    const sizeFactor = emerge + tGrow * 0.6;

    // Fade out en phase hyperspace : le trou noir disparaît absorbé par le tunnel
    const hyperT = Math.max(
      0,
      Math.min(1, (raw - PHASE_HYPERSPACE_START) / (1 - PHASE_HYPERSPACE_START)),
    );
    const fadeOut = 1 - hyperT;

    // Sphère noire absolue (visibilité via opacity du material n'est pas applicable au color
    // basique noir, donc on cache le mesh entier dès que hyperT > 0.3)
    if (sphereRef.current) {
      sphereRef.current.scale.setScalar(sizeFactor * 0.7 * fadeOut);
      sphereRef.current.visible = hyperT < 0.85;
    }

    // Halo gravitationnel intérieur (violet UV) — fin et concentré
    if (haloRef.current) {
      haloRef.current.scale.setScalar(sizeFactor * 0.95);
      const mat = haloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = emerge * 0.55 * fadeOut;
    }
    // Halo extérieur diffus (bleu profond) — distorsion gravitationnelle
    if (haloOuterRef.current) {
      haloOuterRef.current.scale.setScalar(sizeFactor * 1.9);
      const mat = haloOuterRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = emerge * 0.25 * fadeOut;
    }
  });

  return (
    // Trou noir pur : sphère noire absolue + 2 halos gravitationnels (pas d'anneaux)
    <group ref={groupRef} visible={false} position={[0, 0, 0]}>
      {/* Sphère noire — le "centre infini" */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial color="#000000" toneMapped={false} />
      </mesh>

      {/* Halo gravitationnel intérieur — violet UV concentré près de l'horizon */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={palette.cosmicViolet}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Halo extérieur — distorsion gravitationnelle diffuse (bleu profond) */}
      <mesh ref={haloOuterRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={palette.cosmicBlueDeep}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Universe3D({
  typoVisibleRef,
  visibleRef,
  world3DVisibleRef,
  orbScaleRef,
  cosmicProgressRef,
  cosmicActiveRef,
  galaxyProgressRef,
  galaxyVisibleRef,
  blackHoleVisibleRef,
  cosmicStarsVisibleRef,
  hyperspaceVisibleRef,
  scrollProgressRef,
}: {
  typoVisibleRef: React.MutableRefObject<boolean>;
  visibleRef: React.MutableRefObject<boolean>;
  world3DVisibleRef: React.MutableRefObject<boolean>;
  orbScaleRef: React.MutableRefObject<number>;
  cosmicProgressRef: React.MutableRefObject<number>;
  cosmicActiveRef: React.MutableRefObject<boolean>;
  galaxyProgressRef: React.MutableRefObject<number>;
  galaxyVisibleRef: React.MutableRefObject<boolean>;
  blackHoleVisibleRef: React.MutableRefObject<boolean>;
  cosmicStarsVisibleRef: React.MutableRefObject<boolean>;
  hyperspaceVisibleRef: React.MutableRefObject<boolean>;
  scrollProgressRef: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const world3DGroupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (groupRef.current) groupRef.current.visible = visibleRef.current;
    if (world3DGroupRef.current) world3DGroupRef.current.visible = world3DVisibleRef.current;
  });
  return (
    // Wrap : tout le monde 3D est à z=-5 (derrière le plane vidéo)
    // visible=false pendant l'immersion vidéo → gain de perf énorme (pas de draw calls)
    <group ref={groupRef} position={[0, 0, -5]} visible={false}>
      <ambientLight intensity={0.18} />
      {/* Spotlight sans shadow (shadows = très coûteux) */}
      <spotLight
        position={[0, 6, 4]}
        intensity={2.8}
        color={palette.silver}
        angle={0.5}
        penumbra={0.6}
      />
      <pointLight position={[-4, -1, 2]} intensity={1.8} color={palette.redNeon} distance={10} />
      <pointLight position={[4, 2, -3]} intensity={0.9} color={palette.silver} distance={12} />
      <directionalLight
        position={[-5, 0, -2]}
        intensity={0.6}
        color={palette.redDeep}
      />

      {/* WORLD 3D : sphère chromée + wireframe + monolithes + verre + trails + holo + sparkles + stars
          Sub-group caché quand l'orb explose pour laisser place à la galaxie SEULE */}
      <group ref={world3DGroupRef}>
        <Float speed={1.0} rotationIntensity={0.2} floatIntensity={0.35}>
          <ChromeSphere orbScaleRef={orbScaleRef} />
        </Float>

        <WireframeOrbit />
        <Monoliths />
        <GlassShards />

        <NeonTrail radius={2.8} speed={0.7} phase={0} visibleRef={world3DVisibleRef} />
        <NeonTrail radius={3.3} speed={-0.5} phase={Math.PI} visibleRef={world3DVisibleRef} />

        <HoloPanels />
        <FloatingTypo visibleRef={typoVisibleRef} />

        <Sparkles count={80} scale={12} size={2} speed={0.3} opacity={0.4} color={palette.silver} />
        <Sparkles count={30} scale={[10, 6, 10]} size={1.5} speed={0.2} opacity={0.5} color={palette.redNeon} />

        <Stars radius={25} depth={40} count={500} factor={2.5} saturation={0} fade speed={0.4} />
      </group>

      {/* Étoiles arrière-plan : apparaissent dès l'explosion de l'orbe et restent jusqu'au tunnel */}
      <BackgroundStars
        visibleRef={cosmicStarsVisibleRef}
        scrollProgressRef={scrollProgressRef}
      />

      {/* Cosmic explosion + galaxie : centrés au même point que la sphère, indépendants du world 3D */}
      <CosmicExplosion progressRef={cosmicProgressRef} activeRef={cosmicActiveRef} />
      <Galaxy
        progressRef={galaxyProgressRef}
        visibleRef={galaxyVisibleRef}
        scrollProgressRef={scrollProgressRef}
      />
      {/* Trou noir : émerge au cœur de la galaxie (même position [0,0,0] = world z=-5) */}
      <BlackHole progressRef={scrollProgressRef} visibleRef={blackHoleVisibleRef} />

      {/* Tunnel hyperspatial : la plongée après l'horizon des événements */}
      <HyperspaceTunnel
        visibleRef={hyperspaceVisibleRef}
        scrollProgressRef={scrollProgressRef}
      />

      {/* Particules résiduelles : poussière cosmique douce après l'extinction du tunnel */}
      <ResidualParticles scrollProgressRef={scrollProgressRef} />

      {/* Révélation minimaliste du site : ligne → wireframe → UI → logo */}
      <MinimalReveal scrollProgressRef={scrollProgressRef} />
    </group>
  );
}

// ─── CAMERA RIG — avance UNIQUEMENT sur Z ──────────────────────────────────
// Caméra immobile en x/y. lookAt reste vers z=-10 (loin devant) tout du long.
// On AVANCE TOUT DROIT — exactement le brief.
function CameraRig({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const { scene } = useThree();

  // Fog dynamique : pas de fog avant la phase 3D (sinon la vidéo serait fogged)
  useEffect(() => {
    const fog = new THREE.Fog(palette.bgDeep, 100, 200); // initial : pas de fog visible
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame((state) => {
    const t = progressRef.current;

    // Camera Z path :
    //  • Phases 0 → 0.66 : avance lentement vers l'orb (z=5.5 → -5 = noyau)
    //  • À PHASE_COSMIC_EXPLOSION_START : IMPACT, caméra au cœur de l'orb
    //  • Phases 0.66 → 1.0 : caméra REPOUSSÉE vers l'arrière par l'onde de choc
    //    → recul cinématique pour dévoiler la galaxie en formation
    const kp: { z: number; t: number }[] = [
      { z: 5.5, t: 0.0 },                                  // immersion vidéo
      { z: 5.3, t: PHASE_TENSION_START },                  // début tension
      { z: 4.5, t: PHASE_EXPLOSION_START },                // début explosion vidéo
      { z: 2.0, t: PHASE_3D_START },                       // entrée monde 3D
      { z: -3.5, t: PHASE_ORB_COLLAPSE_START },            // s'approche de la sphère
      { z: -5.0, t: PHASE_COSMIC_EXPLOSION_START },        // IMPACT : caméra dans le noyau de l'orb
      { z: -2.0, t: 0.70 },                                // repoussée par l'onde de choc
      { z: 3.0, t: PHASE_GALAXY_START },                   // recul, formation galaxie
      { z: 9.0, t: 0.82 },                                 // contemplation : galaxie majestueuse
      { z: 14.0, t: PHASE_BLACKHOLE_START },               // recul max — anomalie au cœur, échelle monumentale
      { z: 13.0, t: 0.89 },                                // approche très lente, garde le spectacle
      { z: 12.0, t: PHASE_SUCTION_START },                 // recul maintenu : on voit la galaxie aspirée !
      { z: 9.0, t: 0.94 },                                 // l'aspiration s'accélère
      { z: 3.0, t: PHASE_HYPERSPACE_START },               // plongée vers l'horizon des événements
      { z: -22.0, t: PHASE_TUNNEL_DECEL_START },           // accélération max dans le tunnel
      { z: -32.0, t: PHASE_REVEAL_START },                 // décélération vers silence cosmique
      { z: -36.0, t: 0.995 },                              // approche très lente du site qui émerge
      { z: -37.0, t: 1.0 },                                // caméra immobile face au site révélé
    ];

    let seg = 0;
    for (let i = 0; i < kp.length - 1; i++) {
      if (t >= kp[i].t && t <= kp[i + 1].t) { seg = i; break; }
      if (t > kp[kp.length - 1].t) seg = kp.length - 2;
    }
    const a = kp[seg];
    const b = kp[seg + 1];
    const localT = (t - a.t) / (b.t - a.t);
    const e = Math.max(0, Math.min(1, localT));
    const eased = e * e * (3 - 2 * e);
    const z = a.z + (b.z - a.z) * eased;

    // Caméra : x=0, y=0 toujours. Avance uniquement sur Z.
    state.camera.position.x += (0 - state.camera.position.x) * 0.18;
    state.camera.position.y += (0 - state.camera.position.y) * 0.18;
    state.camera.position.z += (z - state.camera.position.z) * 0.18;

    // LookAt : 4 modes blendés
    //  1. Avant orb collapse : regarde 15 unités devant la caméra (plongée immersive)
    //  2. Cosmic explosion → suction : regarde le centre du cosmos (z=-5)
    //  3. Hyperspace : regarde DEVANT la caméra (sinon elle regarderait en arrière)
    //  4. Reveal : regarde le site révélé (world z = -50)
    const lookAtFar = state.camera.position.z - 15;
    const lookAtCosmic = -5;
    const lookAtSite = -50; // position world du site révélé

    // Blend cosmic (entre PHASE_ORB_COLLAPSE_START et PHASE_HYPERSPACE_START)
    let blendCosmic = 0;
    if (t > PHASE_ORB_COLLAPSE_START) {
      blendCosmic = Math.min(1, (t - PHASE_ORB_COLLAPSE_START) / 0.05);
    }
    // Blend back to "forward" en phase hyperspace
    let blendHyper = 0;
    if (t > PHASE_HYPERSPACE_START - 0.02) {
      blendHyper = Math.min(1, (t - (PHASE_HYPERSPACE_START - 0.02)) / 0.03);
    }
    // Blend vers le site révélé en phase reveal (transition douce sur 0.02)
    let blendReveal = 0;
    if (t > PHASE_REVEAL_START - 0.01) {
      blendReveal = Math.min(1, (t - (PHASE_REVEAL_START - 0.01)) / 0.02);
    }

    // Mode 1 (forward) si pas cosmic
    // Mode 2 (cosmic) entre les deux
    // Mode 3 (forward) en hyperspace
    // Mode 4 (site) en reveal — override progressif du forward
    const lookAtHyperMode = lookAtFar * (1 - blendReveal) + lookAtSite * blendReveal;
    const lookAtCosmicMode =
      lookAtCosmic * (1 - blendHyper) + lookAtHyperMode * blendHyper;
    const lookAtZ =
      lookAtFar * (1 - blendCosmic) + lookAtCosmicMode * blendCosmic;
    state.camera.lookAt(0, 0, lookAtZ);

    // Fog : visible en phase 3D, désactivé dans l'espace cosmique (galaxy/blackhole/hyperspace)
    if (scene.fog && scene.fog instanceof THREE.Fog) {
      if (t < PHASE_3D_START) {
        scene.fog.near = 100;
        scene.fog.far = 200;
      } else if (t < PHASE_ORB_COLLAPSE_START) {
        // Phase 3D : fog dense atmosphérique
        const fogT = Math.min(1, (t - PHASE_3D_START) / 0.15);
        scene.fog.near = 100 - fogT * 96; // 100 → 4
        scene.fog.far = 200 - fogT * 182; // 200 → 18
      } else if (t < PHASE_GALAXY_START) {
        // Phase cosmic explosion : fog s'ouvre (on sort de l'atmosphère)
        const escapeT = Math.min(1, (t - PHASE_ORB_COLLAPSE_START) / (PHASE_GALAXY_START - PHASE_ORB_COLLAPSE_START));
        scene.fog.near = 4 + escapeT * 50; // 4 → 54
        scene.fog.far = 18 + escapeT * 100; // 18 → 118
      } else if (t < PHASE_TUNNEL_DECEL_START) {
        // Phase galaxy + blackhole + tunnel chaos : pas de fog (espace profond)
        scene.fog.near = 200;
        scene.fog.far = 400;
      } else {
        // Phase decel + silence : brume volumétrique douce qui s'épaissit
        // Le tunnel s'éteint dans la brume — ambiance contemplative
        const decelT = Math.min(1, (t - PHASE_TUNNEL_DECEL_START) / (1 - PHASE_TUNNEL_DECEL_START));
        // Fog se rapproche progressivement (200 → 8) et la far descend (400 → 35)
        scene.fog.near = 200 - decelT * 192;
        scene.fog.far = 400 - decelT * 365;
      }
    }
  });
  return null;
}

// ─── 3D OVERLAY UI — Captions sync ──────────────────────────────────────────
const MOMENTS = [
  { title: "Plunge.", subtitle: "Tu viens d'entrer dans la dimension.", range: [0.51, 0.56] },
  { title: "Inspect.", subtitle: "Chaque produit. 360°. Photoréaliste.", range: [0.56, 0.60] },
  { title: "Detail.", subtitle: "Matériaux, lumière, profondeur.", range: [0.60, 0.63] },
  { title: "Genesis.", subtitle: "L'orbe se brise. L'univers naît.", range: [0.67, 0.75] },
  { title: "Cosmos.", subtitle: "Particules. Nébuleuses. Voie lactée.", range: [0.80, 0.85] },
  { title: "Ready.", subtitle: "Ton site Shopify livré 7 jours. Beta privée 10 places.", range: [0.95, 1.0] },
] as const;

function MomentOverlay({ index, progress }: { index: number; progress: number }) {
  const moment = MOMENTS[index];
  const [start, end] = moment.range;
  const inRange = progress >= start && progress <= end;
  const localT = inRange ? (progress - start) / (end - start) : 0;
  const fadeIn = Math.min(1, localT * 4);
  const fadeOut = Math.min(1, (1 - localT) * 4);
  const opacity = inRange ? Math.min(fadeIn, fadeOut) : 0;

  return (
    <motion.div
      animate={{ opacity }}
      transition={{ duration: 0.2, ease: "linear" }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none px-8 z-25"
    >
      <div className="text-center max-w-[800px]">
        <div
          className="text-[10px] font-mono tracking-[0.5em] uppercase mb-4"
          style={{ color: `${palette.silver}80` }}
        >
          — Moment {String(index + 1).padStart(2, "0")} / {MOMENTS.length.toString().padStart(2, "0")}
        </div>
        <h2
          className="text-6xl md:text-8xl font-black leading-[0.9] tracking-[-0.04em]"
          style={{ color: palette.silver }}
        >
          {moment.title}
        </h2>
        <p
          className="mt-6 text-sm md:text-base max-w-[480px] mx-auto leading-relaxed"
          style={{ color: `${palette.silver}B0` }}
        >
          {moment.subtitle}
        </p>
      </div>
    </motion.div>
  );
}

// ─── SCENE WRAPPER (inside Canvas, accède à useThree) ──────────────────────
function CinematicScene({
  videoEl,
  progressRef,
  shatterProgressRef,
  shatterActiveRef,
  videoVisibleRef,
  typoVisibleRef,
  universeVisibleRef,
  world3DVisibleRef,
  orbScaleRef,
  cosmicProgressRef,
  cosmicActiveRef,
  galaxyProgressRef,
  galaxyVisibleRef,
  blackHoleVisibleRef,
  cosmicStarsVisibleRef,
  hyperspaceVisibleRef,
  tensionT,
  shatterT,
  inShatter,
  in3DWorld,
  inCosmicPhase,
  inGalaxyPhase,
  inBlackHolePhase,
  inDecelPhase,
  decelFactor,
}: {
  videoEl: HTMLVideoElement | null;
  progressRef: React.MutableRefObject<number>;
  shatterProgressRef: React.MutableRefObject<number>;
  shatterActiveRef: React.MutableRefObject<boolean>;
  videoVisibleRef: React.MutableRefObject<boolean>;
  typoVisibleRef: React.MutableRefObject<boolean>;
  universeVisibleRef: React.MutableRefObject<boolean>;
  world3DVisibleRef: React.MutableRefObject<boolean>;
  orbScaleRef: React.MutableRefObject<number>;
  cosmicProgressRef: React.MutableRefObject<number>;
  cosmicActiveRef: React.MutableRefObject<boolean>;
  galaxyProgressRef: React.MutableRefObject<number>;
  galaxyVisibleRef: React.MutableRefObject<boolean>;
  blackHoleVisibleRef: React.MutableRefObject<boolean>;
  cosmicStarsVisibleRef: React.MutableRefObject<boolean>;
  hyperspaceVisibleRef: React.MutableRefObject<boolean>;
  tensionT: number;
  shatterT: number;
  inShatter: boolean;
  in3DWorld: boolean;
  inCosmicPhase: boolean;
  inGalaxyPhase: boolean;
  inBlackHolePhase: boolean;
  inDecelPhase: boolean;
  decelFactor: number;
}) {
  // shatterT contribue UNIQUEMENT pendant l'explosion (inShatter=true)
  const sT = inShatter ? shatterT : 0;
  // Baseline "data corrupted" en phase 3D — DÉSACTIVÉ pendant les phases cosmiques
  // (orb collapse / cosmic explosion / galaxy) → ambiance spatiale pure
  const glitchBaseline = in3DWorld && !inCosmicPhase ? 1 : 0;
  // En phase decel, on baisse drastiquement les FX cosmiques pour ambiance contemplative
  const fxAttenuation = 1 - decelFactor * 0.95;
  const chromaOffsetX =
    (0.0005 + tensionT * 0.012 + sT * 0.018 + glitchBaseline * 0.008
    + (inGalaxyPhase ? 0.003 : 0) // léger lensing en galaxie
    + (inBlackHolePhase ? 0.012 : 0)) * fxAttenuation; // gravitational lensing intense au trou noir
  const chromaOffsetY =
    (0.0005 + tensionT * 0.005 + sT * 0.012 + glitchBaseline * 0.005
    + (inGalaxyPhase ? 0.002 : 0)
    + (inBlackHolePhase ? 0.008 : 0)) * fxAttenuation;
  const glitchActive =
    !inCosmicPhase &&
    (tensionT > 0.25 || (inShatter && shatterT < 0.6) || in3DWorld);
  const glitchRatio = in3DWorld
    ? 0.88
    : Math.max(0.15, 1 - tensionT * 0.5 - sT * 0.4);
  const glitchStrength = new THREE.Vector2(
    Math.max(tensionT * 0.15 + sT * 0.4, glitchBaseline * 0.08),
    Math.max(tensionT * 0.5 + sT * 0.8, glitchBaseline * 0.2),
  );
  const scanDensity = 0.8 + tensionT * 4 + glitchBaseline * 1.5;
  const scanOpacity = tensionT * 0.6 + glitchBaseline * 0.22;
  const noiseOpacity = tensionT * 0.35 + sT * 0.25 + glitchBaseline * 0.08;

  return (
    <>
      <CameraRig progressRef={progressRef} />

      {/* Background couleur (visible quand la vidéo a disparu) */}
      <color attach="background" args={[palette.bg]} />

      {/* Plane vidéo R3F — disparaît à l'explosion */}
      <VideoPlane videoEl={videoEl} visibleRef={videoVisibleRef} />

      {/* Fragments shatter — actifs uniquement pendant l'explosion */}
      <VideoShatter
        videoEl={videoEl}
        progressRef={shatterProgressRef}
        activeRef={shatterActiveRef}
      />

      {/* Particules — actives uniquement pendant l'explosion */}
      <ParticleExplosion
        progressRef={shatterProgressRef}
        activeRef={shatterActiveRef}
      />

      {/* Environment HDR — pour les reflections sur la sphère chromée */}
      <Environment preset="night" environmentIntensity={0.7} />

      {/* Le monde 3D — DERRIÈRE le plane vidéo (z=-5), visible uniquement à partir de l'explosion */}
      <Universe3D
        typoVisibleRef={typoVisibleRef}
        visibleRef={universeVisibleRef}
        world3DVisibleRef={world3DVisibleRef}
        orbScaleRef={orbScaleRef}
        cosmicProgressRef={cosmicProgressRef}
        cosmicActiveRef={cosmicActiveRef}
        galaxyProgressRef={galaxyProgressRef}
        galaxyVisibleRef={galaxyVisibleRef}
        blackHoleVisibleRef={blackHoleVisibleRef}
        cosmicStarsVisibleRef={cosmicStarsVisibleRef}
        hyperspaceVisibleRef={hyperspaceVisibleRef}
        scrollProgressRef={progressRef}
      />

      {/* Post-FX modulés par scroll — léger, désactivé en immersion vidéo */}
      <EffectComposer multisampling={0} enabled={tensionT > 0.05 || inShatter || in3DWorld}>
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={[chromaOffsetX, chromaOffsetY]}
          radialModulation={inCosmicPhase || inBlackHolePhase}
          modulationOffset={inBlackHolePhase ? 0.05 : inCosmicPhase ? 0.15 : 0}
        />
        <Glitch
          delay={GLITCH_DELAY}
          duration={GLITCH_DURATION}
          strength={glitchStrength}
          mode={GlitchMode.SPORADIC}
          active={glitchActive}
          ratio={glitchRatio}
        />
        <Scanline
          blendFunction={BlendFunction.OVERLAY}
          density={scanDensity}
          opacity={scanOpacity}
        />
        <Noise
          premultiply
          blendFunction={BlendFunction.ADD}
          opacity={noiseOpacity}
        />
        <Bloom
          intensity={
            (inBlackHolePhase ? 1.1 : inGalaxyPhase ? 1.6 : inCosmicPhase ? 1.4 : in3DWorld ? 0.95 : inShatter ? 1.4 : 0.0)
            * (1 - decelFactor * 0.6) // bloom diminue en phase decel pour ambiance douce
          }
          luminanceThreshold={inBlackHolePhase ? 0.55 : inCosmicPhase ? 0.35 : 0.6}
          luminanceSmoothing={0.55}
          mipmapBlur
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.3} darkness={inBlackHolePhase ? 1.0 : inCosmicPhase ? 0.85 : in3DWorld ? 0.75 : 0.3} />
      </EffectComposer>
    </>
  );
}

// ─── CINEMATIC SECTION — UN SEUL CONTAINER scroll-driven ────────────────────
function CinematicSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef(0);
  const shatterProgressRef = useRef(0);
  const shatterActiveRef = useRef(false);
  const videoVisibleRef = useRef(true);
  const typoVisibleRef = useRef(false);
  const universeVisibleRef = useRef(false);
  // Phase cosmique : orb collapse + cosmic explosion + galaxy
  const orbScaleRef = useRef(1);
  const cosmicProgressRef = useRef(0);
  const cosmicActiveRef = useRef(false);
  const galaxyProgressRef = useRef(0);
  const galaxyVisibleRef = useRef(false);
  // Trou noir : émerge à PHASE_BLACKHOLE_START au cœur de la galaxie
  const blackHoleVisibleRef = useRef(false);
  // Étoiles arrière-plan : visibles dès l'explosion de l'orbe
  const cosmicStarsVisibleRef = useRef(false);
  // Tunnel hyperspatial : visible à partir de PHASE_HYPERSPACE_START
  const hyperspaceVisibleRef = useRef(false);
  // Quand l'orb explose → tout le world 3D s'efface (sauf la galaxie qui prend le relais)
  const world3DVisibleRef = useRef(false);
  const cameraShakeRef = useRef({ x: 0, y: 0 });

  // SFX déjà déclenchés (anti re-trigger sur ré-entrée de phase)
  const sfxFiredRef = useRef({
    explosion: false,
    whoosh: false,
    hyperspace: false,
    reveal: false,
  });

  const [progressState, setProgressState] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Scrub vidéo lerp continu (rAF persistant) — découple le rendu vidéo
  // du flux d'événements scroll. 60 Hz constant, lerp adoucit les sauts
  // entre frames source (24 fps) ↔ scroll rapide.
  const targetTimeRef = useRef(0);
  const animTimeRef = useRef(0);
  const stateRafRef = useRef<number | null>(null);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    // Refs : update immédiat (lecture dans useFrame R3F, doit être synchrone)
    progressRef.current = latest;

    // ─── AUDIO — drone intensity scroll-driven + SFX triggers par phase ───
    setDroneIntensity(latest);
    // Explosion cosmique
    if (latest >= PHASE_COSMIC_EXPLOSION_START && !sfxFiredRef.current.explosion) {
      sfxExplosion();
      sfxFiredRef.current.explosion = true;
    } else if (latest < PHASE_COSMIC_EXPLOSION_START - 0.02) {
      sfxFiredRef.current.explosion = false;
    }
    // Suction / Blackhole whoosh
    if (latest >= PHASE_SUCTION_START && !sfxFiredRef.current.whoosh) {
      sfxWhoosh();
      sfxFiredRef.current.whoosh = true;
    } else if (latest < PHASE_SUCTION_START - 0.02) {
      sfxFiredRef.current.whoosh = false;
    }
    // Hyperspace air pressure sweep
    if (latest >= PHASE_HYPERSPACE_START && !sfxFiredRef.current.hyperspace) {
      sfxHyperspace();
      sfxFiredRef.current.hyperspace = true;
    } else if (latest < PHASE_HYPERSPACE_START - 0.02) {
      sfxFiredRef.current.hyperspace = false;
    }
    // Reveal bell
    if (latest >= PHASE_REVEAL_START && !sfxFiredRef.current.reveal) {
      sfxReveal();
      sfxFiredRef.current.reveal = true;
    } else if (latest < PHASE_REVEAL_START - 0.01) {
      sfxFiredRef.current.reveal = false;
    }

    // Shatter progress local 0→1
    const shatterEnd = PHASE_3D_START + 0.05;
    shatterProgressRef.current = Math.max(
      0,
      Math.min(1, (latest - PHASE_EXPLOSION_START) / (shatterEnd - PHASE_EXPLOSION_START)),
    );
    shatterActiveRef.current = latest >= PHASE_EXPLOSION_START && latest <= shatterEnd;
    videoVisibleRef.current = latest < PHASE_EXPLOSION_START;
    // Typo VERTXIA visible uniquement pendant la phase 3D (avant l'orb collapse)
    typoVisibleRef.current =
      latest >= PHASE_3D_START + 0.02 && latest < PHASE_ORB_COLLAPSE_START;
    // Univers 3D visible un peu avant l'explosion vidéo et reste actif jusqu'à la fin (galaxy inclus)
    universeVisibleRef.current = latest >= PHASE_EXPLOSION_START - 0.05;
    // World 3D (sphère/wireframe/monolithes/verre/trails/holo/sparkles/stars) :
    // visible entre explosion vidéo et orb collapse end. Quand l'orb explose → tout disparaît,
    // seule la galaxie reste.
    world3DVisibleRef.current =
      latest >= PHASE_EXPLOSION_START - 0.05 && latest < PHASE_COSMIC_EXPLOSION_START;

    // Orb collapse : scale 1 → 0 entre PHASE_ORB_COLLAPSE_START et PHASE_COSMIC_EXPLOSION_START
    if (latest < PHASE_ORB_COLLAPSE_START) {
      orbScaleRef.current = 1;
    } else if (latest < PHASE_COSMIC_EXPLOSION_START) {
      const t = (latest - PHASE_ORB_COLLAPSE_START) /
        (PHASE_COSMIC_EXPLOSION_START - PHASE_ORB_COLLAPSE_START);
      // Easing : compression rapide (easeIn quintic)
      orbScaleRef.current = Math.max(0, 1 - Math.pow(t, 1.5));
    } else {
      orbScaleRef.current = 0;
    }

    // Cosmic explosion : actif entre PHASE_COSMIC_EXPLOSION_START et PHASE_GALAXY_START + epsilon
    const cosmicEnd = PHASE_GALAXY_START + 0.04;
    cosmicProgressRef.current = Math.max(
      0,
      Math.min(1, (latest - PHASE_COSMIC_EXPLOSION_START) /
        (cosmicEnd - PHASE_COSMIC_EXPLOSION_START)),
    );
    cosmicActiveRef.current =
      latest >= PHASE_COSMIC_EXPLOSION_START && latest <= cosmicEnd;

    // Galaxy : visible à partir de PHASE_GALAXY_START - small (overlap avec cosmic fade)
    galaxyVisibleRef.current = latest >= PHASE_GALAXY_START - 0.04;
    galaxyProgressRef.current = Math.max(
      0,
      Math.min(1, (latest - PHASE_GALAXY_START) / (1 - PHASE_GALAXY_START)),
    );

    // Trou noir : visible à partir de PHASE_BLACKHOLE_START (overlap léger -0.02 pour pré-fade-in)
    blackHoleVisibleRef.current = latest >= PHASE_BLACKHOLE_START - 0.02;

    // Étoiles arrière-plan : visibles dès l'explosion de l'orbe et jusqu'à la fin
    cosmicStarsVisibleRef.current = latest >= PHASE_COSMIC_EXPLOSION_START - 0.02;

    // Tunnel hyperspatial : visible dès le début du seuil pour fade-in propre
    hyperspaceVisibleRef.current = latest >= PHASE_HYPERSPACE_START - 0.03;

    // setProgressState : throttle via rAF — un setState par frame max au lieu de
    // un par scroll event (qui peuvent être plusieurs par frame)
    if (stateRafRef.current === null) {
      stateRafRef.current = requestAnimationFrame(() => {
        stateRafRef.current = null;
        setProgressState(progressRef.current);
      });
    }

    // Note : on NE met PAS à jour targetTimeRef ici. La boucle rAF lit
    // scrollYProgress.get() directement chaque frame — bypass le batching
    // de useMotionValueEvent qui ne fire que par paliers grossiers sur
    // scroll continu.
  });

  // Boucle rAF persistante : lerp animTime → target, applique sur la vidéo.
  // - lerp factor 0.22 : ~3 frames pour rattraper 95 % du delta
  // - fastSeek() préféré à currentTime= (optimisé scrub, garanti instant sur
  //   all-keyframes), fallback currentTime= si non supporté
  // - lastSetRef tracke la dernière valeur émise (le getter v.currentTime
  //   peut être stale pendant qu'un seek est en cours → garder notre vérité)
  // Cache des dimensions container — recalculé seulement au resize/mount.
  // Évite getBoundingClientRect() à chaque frame (forced reflow / layout work).
  const layoutRef = useRef<{ topDoc: number; range: number } | null>(null);
  useEffect(() => {
    const recompute = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      layoutRef.current = {
        topDoc: window.scrollY + rect.top,
        range: container.offsetHeight - window.innerHeight,
      };
    };
    recompute();
    window.addEventListener("resize", recompute, { passive: true });
    // Recompute au load complet (au cas où des fonts/images shift le layout)
    if (document.readyState === "complete") recompute();
    else window.addEventListener("load", recompute, { once: true });
    return () => window.removeEventListener("resize", recompute);
  }, []);

  // Seek à chaque frame rAF (60 Hz max). Pas de throttle artificiel : le
  // decoder Chrome avec source 24 fps + bitrate modéré tient ce rythme.
  // lastSetRef évite les writes redondants (delta < ~1 frame vidéo).
  const lastSetRef = useRef(-1);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      const layout = layoutRef.current;
      if (v && v.duration && !isNaN(v.duration) && layout && layout.range > 0) {
        const latest = Math.max(0, Math.min(1, (window.scrollY - layout.topDoc) / layout.range));
        const videoT = Math.min(1, latest / PHASE_EXPLOSION_START);
        const target = Math.max(0, Math.min(v.duration - 0.05, videoT * v.duration));
        targetTimeRef.current = target;

        const cur = animTimeRef.current;
        const delta = target - cur;
        // Snap si delta énorme (>0.5s) — sinon attente perceptible
        const next = Math.abs(delta) > 0.5 ? target : cur + delta * 0.22;
        animTimeRef.current = next;
        if (Math.abs(lastSetRef.current - next) > 0.012) {
          lastSetRef.current = next;
          if (typeof v.fastSeek === "function") {
            v.fastSeek(next);
          } else {
            v.currentTime = next;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Debug : expose refs sur window pour test runtime (chrome-devtools)
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as unknown as { __vxScrub?: object }).__vxScrub = {
      get target() { return targetTimeRef.current; },
      get anim() { return animTimeRef.current; },
      get lastSet() { return lastSetRef.current; },
      get currentTime() { return videoRef.current?.currentTime ?? null; },
    };
  }, []);

  useEffect(() => {
    return () => {
      if (stateRafRef.current !== null) cancelAnimationFrame(stateRafRef.current);
    };
  }, []);

  // Phases calculées (pour UI overlays uniquement — la scène se réfère aux refs)
  // tensionT : ramp 0→1 (tension), reste à 1 pendant explosion, fade 1→0 en début 3D, puis 0
  const TENSION_FADEOUT_END = PHASE_3D_START + 0.04;
  const tensionT =
    progressState < PHASE_TENSION_START
      ? 0
      : progressState < PHASE_EXPLOSION_START
        ? (progressState - PHASE_TENSION_START) /
          (PHASE_EXPLOSION_START - PHASE_TENSION_START)
        : progressState < PHASE_3D_START
          ? 1
          : progressState < TENSION_FADEOUT_END
            ? Math.max(0, 1 - (progressState - PHASE_3D_START) / (TENSION_FADEOUT_END - PHASE_3D_START))
            : 0;

  const shatterT = shatterProgressRef.current;
  const inShatter = shatterActiveRef.current;
  // Le 3D world est "pleinement visible" (post-FX propres) après TENSION_FADEOUT_END
  const in3DWorld = progressState >= TENSION_FADEOUT_END;
  // Phase cosmique : orb collapse + cosmic explosion + galaxy
  // → désactive Glitch/Scanline/Noise pour une ambiance pure spectaculaire
  const inCosmicPhase = progressState >= PHASE_ORB_COLLAPSE_START;
  const inGalaxyPhase = progressState >= PHASE_GALAXY_START;
  const inBlackHolePhase = progressState >= PHASE_BLACKHOLE_START;
  // Phase decel : tunnel ralentit, particules s'éteignent, ambiance contemplative
  const inDecelPhase = progressState >= PHASE_TUNNEL_DECEL_START;
  // Facteur de décélération 0→1 utilisé pour fade out les FX en phase decel
  const decelFactor = inDecelPhase
    ? Math.min(1, (progressState - PHASE_TUNNEL_DECEL_START) / (1 - PHASE_TUNNEL_DECEL_START))
    : 0;

  // Red flash au peak
  const peakProgress = 0.4;
  const flashIntensity =
    inShatter && shatterT > 0.2 && shatterT < 0.65
      ? Math.max(0, 1 - Math.abs(shatterT - peakProgress) / 0.2)
      : 0;

  // Camera shake CSS (transform sur wrapper Canvas) pendant explosion
  const shakeIntensity = inShatter && shatterT < 0.7 ? shatterT * 16 : 0;
  cameraShakeRef.current = {
    x: (Math.random() - 0.5) * shakeIntensity,
    y: (Math.random() - 0.5) * shakeIntensity,
  };

  // CSS filter sur le plane vidéo (hue rotate + saturate + contrast) → appliqué directement
  // sur le video element HTML (le VideoTexture reflète automatiquement les filters CSS du <video>)
  // Note : sur certains navigateurs les filters CSS ne se propagent pas à la VideoTexture.
  // Solution : on les applique en post-process via ChromaticAberration + Noise + Glitch (déjà fait).

  return (
    <section
      ref={containerRef}
      className="relative w-full"
      style={{ height: "3200vh" }}
    >
      <div
        className="sticky top-0 h-screen w-full overflow-hidden"
        style={{ background: palette.bg }}
      >
        {/* Vidéo HTML cachée (decode pour VideoTexture) */}
        <video
          ref={videoRef}
          src="/videos/shopify-explosion-scroll.mp4"
          muted
          playsInline
          preload="auto"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 2,
            height: 2,
            opacity: 0,
            pointerEvents: "none",
            zIndex: -1,
          }}
          aria-hidden
        />

        {/* CANVAS R3F UNIQUE — vidéo + explosion + monde 3D ensemble */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${cameraShakeRef.current.x}px, ${cameraShakeRef.current.y}px)`,
            willChange: "transform",
          }}
        >
          <Canvas
            dpr={1}
            camera={{ position: [0, 0, 5.5], fov: 50, near: 0.1, far: 100 }}
            gl={{
              antialias: false,
              alpha: false,
              powerPreference: "high-performance",
              stencil: false,
              depth: true,
            }}
          >
            <Suspense fallback={null}>
              <CinematicScene
                videoEl={videoRef.current}
                progressRef={progressRef}
                shatterProgressRef={shatterProgressRef}
                shatterActiveRef={shatterActiveRef}
                videoVisibleRef={videoVisibleRef}
                typoVisibleRef={typoVisibleRef}
                universeVisibleRef={universeVisibleRef}
                world3DVisibleRef={world3DVisibleRef}
                orbScaleRef={orbScaleRef}
                cosmicProgressRef={cosmicProgressRef}
                cosmicActiveRef={cosmicActiveRef}
                galaxyProgressRef={galaxyProgressRef}
                galaxyVisibleRef={galaxyVisibleRef}
                blackHoleVisibleRef={blackHoleVisibleRef}
                cosmicStarsVisibleRef={cosmicStarsVisibleRef}
                hyperspaceVisibleRef={hyperspaceVisibleRef}
                tensionT={tensionT}
                shatterT={shatterT}
                inShatter={inShatter}
                in3DWorld={in3DWorld}
                inCosmicPhase={inCosmicPhase}
                inGalaxyPhase={inGalaxyPhase}
                inBlackHolePhase={inBlackHolePhase}
                inDecelPhase={inDecelPhase}
                decelFactor={decelFactor}
              />
            </Suspense>
          </Canvas>
        </div>

        {/* TENSION CSS overlays (scanlines + noise + flicker + red pulse) */}
        {tensionT > 0 && progressState < PHASE_EXPLOSION_START && (
          <TensionOverlay tensionT={tensionT} />
        )}

        {/* Red flash au peak du shatter */}
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background: palette.redNeon,
            opacity: flashIntensity * 0.55,
            mixBlendMode: "screen",
          }}
          aria-hidden
        />
        {/* White flash subtil */}
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background: palette.silver,
            opacity: flashIntensity * 0.4,
            mixBlendMode: "screen",
          }}
          aria-hidden
        />

        {/* HEADER fixed */}
        <HeroHeader />

        {/* HUD vidéo (visible uniquement avant explosion) */}
        {progressState < PHASE_EXPLOSION_START && (
          <>
            <div
              className="absolute top-6 right-1/2 translate-x-[300px] text-[9px] font-mono tracking-[0.3em] uppercase pointer-events-none z-25"
              style={{ color: `${palette.silver}99` }}
            >
              [ VERTXIA · TRANSMISSION 01 ]
            </div>
            <div
              className="absolute bottom-24 right-8 text-[9px] font-mono tracking-[0.3em] uppercase text-right pointer-events-none z-25"
              style={{ color: `${palette.silver}99` }}
            >
              16:9 · WebGL · 60fps
            </div>
            <div
              className="absolute bottom-24 left-8 text-[9px] font-mono tracking-[0.3em] uppercase pointer-events-none flex items-center gap-2 z-25"
              style={{ color: palette.redNeon }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: palette.redNeon }} />
              Scroll to plunge
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center text-[10px] font-mono tracking-[0.4em] uppercase pointer-events-none z-25"
              style={{ color: `${palette.silver}B0` }}
            >
              <div>Scroll to break reality</div>
              <motion.div
                animate={{ y: [0, 4, 0] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                className="mt-2 text-base"
                style={{ color: palette.redNeon }}
              >
                ↓
              </motion.div>
            </motion.div>
          </>
        )}

        {/* MOMENT CAPTIONS (phase 3D uniquement, masqués à partir du trou noir pour ne pas distraire) */}
        {progressState >= PHASE_3D_START && progressState < PHASE_BLACKHOLE_START &&
          MOMENTS.map((_, i) => <MomentOverlay key={i} index={i} progress={progressState} />)}

        {/* Progress bar bas */}
        <div className="absolute bottom-6 left-8 right-8 flex items-center gap-4 pointer-events-none z-25">
          <span
            className="text-[9px] font-mono tracking-[0.3em] uppercase"
            style={{ color: `${palette.silver}60` }}
          >
            00:{String(Math.floor(progressState * 60)).padStart(2, "0")}
          </span>
          <div className="flex-1 h-px relative overflow-hidden" style={{ background: `${palette.silver}20` }}>
            <motion.div
              animate={{ scaleX: progressState }}
              transition={{ duration: 0.1 }}
              style={{ transformOrigin: "left", background: palette.redNeon }}
              className="absolute inset-0"
            />
          </div>
          <span
            className="text-[9px] font-mono tracking-[0.3em] uppercase"
            style={{ color: `${palette.silver}60` }}
          >
            01:00
          </span>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── SPATIAL SITE — exploration du site en constellation 3D ─────────────────
// ═══════════════════════════════════════════════════════════════════════════
// 5 sections spatiales positionnées en constellation autour de la caméra,
// navigables via scroll (linéaire) + menu HTML overlay (fly-to direct).

const SECTIONS_POSITIONS: { name: string; pos: [number, number, number]; color: string }[] = [
  { name: "Portfolio",   pos: [0, 0, -25],     color: "#FFFFFF" },
  { name: "Projets",     pos: [20, 8, -32],    color: palette.cosmicViolet },
  { name: "Contact",     pos: [-15, -10, -28], color: palette.cosmicBlue },
  { name: "About",       pos: [25, -12, -38],  color: palette.silver },
  { name: "Compétences", pos: [-18, 12, -35],  color: palette.cosmicGold },
];

function SpatialCameraRig({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const { scene } = useThree();

  useEffect(() => {
    const fog = new THREE.Fog("#020202", 25, 90);
    scene.fog = fog;
    return () => { scene.fog = null; };
  }, [scene]);

  useFrame((state) => {
    const t = progressRef.current;

    let targetPos: [number, number, number] = [0, 0, 5];
    let targetLook: [number, number, number] = [0, 0, -10];

    if (t < 0.08) {
      // Phase d'entrée : caméra avance dans l'espace
      const localT = t / 0.08;
      const eased = localT * localT * (3 - 2 * localT);
      targetPos = [0, 0, 5 - eased * 12]; // 5 → -7
      targetLook = SECTIONS_POSITIONS[0].pos;
    } else {
      // 5 segments entre les sections : 0.08 → 0.96 (5 × 0.176)
      const segLen = 0.176;
      const segIdx = Math.min(4, Math.floor((t - 0.08) / segLen));
      const segT = Math.min(1, ((t - 0.08) - segIdx * segLen) / segLen);
      const clampedSeg = Math.min(4, segIdx);
      const nextSeg = Math.min(4, clampedSeg + 1);

      const currentSection = SECTIONS_POSITIONS[clampedSeg];
      const nextSection = SECTIONS_POSITIONS[nextSeg];

      // Caméra à 9 unités devant chaque section (sur l'axe section→origine du monde)
      const camOffset = 9;
      const dist = Math.hypot(currentSection.pos[0], currentSection.pos[1], currentSection.pos[2]);
      const factor = (dist - camOffset) / dist;
      const camCurrent: [number, number, number] = [
        currentSection.pos[0] * factor,
        currentSection.pos[1] * factor,
        currentSection.pos[2] * factor,
      ];
      const distN = Math.hypot(nextSection.pos[0], nextSection.pos[1], nextSection.pos[2]);
      const factorN = (distN - camOffset) / distN;
      const camNext: [number, number, number] = [
        nextSection.pos[0] * factorN,
        nextSection.pos[1] * factorN,
        nextSection.pos[2] * factorN,
      ];

      // EaseInOut entre deux sections : ralenti aux extrêmes, vite au milieu
      const e = segT * segT * (3 - 2 * segT);

      targetPos = [
        camCurrent[0] + (camNext[0] - camCurrent[0]) * e,
        camCurrent[1] + (camNext[1] - camCurrent[1]) * e,
        camCurrent[2] + (camNext[2] - camCurrent[2]) * e,
      ];

      // LookAt : pendant 70% du segment regarde la section actuelle, puis transitionne vers la suivante
      const lookE = Math.max(0, Math.min(1, (segT - 0.3) / 0.7));
      const lookEased = lookE * lookE * (3 - 2 * lookE);
      targetLook = [
        currentSection.pos[0] + (nextSection.pos[0] - currentSection.pos[0]) * lookEased,
        currentSection.pos[1] + (nextSection.pos[1] - currentSection.pos[1]) * lookEased,
        currentSection.pos[2] + (nextSection.pos[2] - currentSection.pos[2]) * lookEased,
      ];
    }

    // Smooth camera update (inertie cinématique)
    state.camera.position.x += (targetPos[0] - state.camera.position.x) * 0.08;
    state.camera.position.y += (targetPos[1] - state.camera.position.y) * 0.08;
    state.camera.position.z += (targetPos[2] - state.camera.position.z) * 0.08;
    state.camera.lookAt(targetLook[0], targetLook[1], targetLook[2]);
  });

  return null;
}

function SpatialStarsField() {
  const COUNT = 3500;
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const cWhite = new THREE.Color("#FFFFFF");
    const cSilver = new THREE.Color(palette.silver);
    const cBlue = new THREE.Color(palette.cosmicBlue);
    const cViolet = new THREE.Color(palette.cosmicVioletLight);

    for (let i = 0; i < COUNT; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 50 + Math.random() * 80; // étoiles entre 50 et 130 unités
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const rnd = Math.random();
      const col = rnd < 0.7 ? cWhite : rnd < 0.88 ? cSilver : rnd < 0.96 ? cBlue : cViolet;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    return { positions, colors };
  }, []);

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        sizeAttenuation
        map={particleTex()}
        vertexColors
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

function SpatialDust() {
  // 250 particules de poussière cosmique qui dérivent doucement
  const pointsRef = useRef<THREE.Points>(null);
  const COUNT = 250;
  const { positions, drift } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const drift = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 2] = -15 - Math.random() * 35;
      drift[i * 3] = (Math.random() - 0.5) * 0.08;
      drift[i * 3 + 1] = (Math.random() - 0.5) * 0.08;
      drift[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
    }
    return { positions, drift };
  }, []);

  useFrame((_state, delta) => {
    if (!pointsRef.current) return;
    const dt = Math.min(0.05, delta);
    const geo = pointsRef.current.geometry as THREE.BufferGeometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      posArr[i3] += drift[i3] * dt;
      posArr[i3 + 1] += drift[i3 + 1] * dt;
      posArr[i3 + 2] += drift[i3 + 2] * dt;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        sizeAttenuation
        map={particleTex()}
        color="#FFFFFF"
        transparent
        opacity={0.45}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

// Marker placeholder pour 5A — sera remplacé par les vraies sections en 5B-5F
function SectionMarker({ pos, color, label }: { pos: [number, number, number]; color: string; label: string }) {
  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.2, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[0, 2, 0]}
        fontSize={0.6}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        material-toneMapped={false}
        fillOpacity={0.85}
      >
        {label}
      </Text>
    </group>
  );
}

// ─── PORTFOLIO SECTION — structure géométrique lumineuse (icosaèdre wireframe)
const PORTFOLIO_CARDS = [
  { title: "Vertxia Engine", tag: "SaaS · 3D · Shopify" },
  { title: "Galaxy Reveal", tag: "WebGL · R3F · Postprocessing" },
  { title: "Spatial UI", tag: "Cinematic · Premium · Motion" },
];

function PortfolioSection({ pos }: { pos: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  const icosaRef = useRef<THREE.LineSegments>(null);
  const innerCoreRef = useRef<THREE.Mesh>(null);

  // Geometry pour icosaèdre wireframe
  const icosaGeo = useMemo(() => {
    const baseGeo = new THREE.IcosahedronGeometry(2.5, 1);
    return new THREE.EdgesGeometry(baseGeo);
  }, []);

  useFrame((state) => {
    if (icosaRef.current) {
      icosaRef.current.rotation.y = state.clock.elapsedTime * 0.15;
      icosaRef.current.rotation.x = state.clock.elapsedTime * 0.08;
    }
    if (innerCoreRef.current) {
      // Pulse subtle
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.2) * 0.06;
      innerCoreRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={groupRef} position={pos}>
      {/* Icosaèdre wireframe — la "structure géométrique lumineuse" */}
      <lineSegments ref={icosaRef} geometry={icosaGeo}>
        <lineBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>

      {/* Core lumineux au centre (sphère qui pulse) */}
      <mesh ref={innerCoreRef}>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.92}
          toneMapped={false}
        />
      </mesh>

      {/* Halo diffus autour du core */}
      <mesh>
        <sphereGeometry args={[0.9, 24, 24]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Titre 3D au-dessus */}
      <Text
        position={[0, 4, 0]}
        fontSize={0.95}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        letterSpacing={-0.03}
        material-toneMapped={false}
      >
        Portfolio
      </Text>

      {/* Sous-titre */}
      <Text
        position={[0, 3.1, 0]}
        fontSize={0.22}
        color="#E8E8E8"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.25}
        material-toneMapped={false}
        fillOpacity={0.75}
      >
        SÉLECTION DE TRAVAUX 3D & EXPÉRIMENTATIONS
      </Text>

      {/* 3 cards flottantes autour de l'icosaèdre (gauche / droite / bas) */}
      <PortfolioCard
        position={[-5, 0.5, 0.5]}
        rotation={[0, 0.3, 0]}
        title={PORTFOLIO_CARDS[0].title}
        tag={PORTFOLIO_CARDS[0].tag}
      />
      <PortfolioCard
        position={[5, 0.5, 0.5]}
        rotation={[0, -0.3, 0]}
        title={PORTFOLIO_CARDS[1].title}
        tag={PORTFOLIO_CARDS[1].tag}
      />
      <PortfolioCard
        position={[0, -3.5, 1]}
        rotation={[0.2, 0, 0]}
        title={PORTFOLIO_CARDS[2].title}
        tag={PORTFOLIO_CARDS[2].tag}
      />

      {/* Fines lignes décoratives haut/bas */}
      <mesh position={[0, 5.5, 0]}>
        <planeGeometry args={[4, 0.015]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, -5.5, 0]}>
        <planeGeometry args={[4, 0.015]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function PortfolioCard({
  position,
  rotation,
  title,
  tag,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  title: string;
  tag: string;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Floating animation : oscillation Y douce
  useFrame((state) => {
    if (!groupRef.current) return;
    const phase = position[0] * 0.5 + position[1] * 0.3; // unique phase per card
    groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.6 + phase) * 0.12;
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Cadre glassmorphism (plane semi-transparent) */}
      <mesh>
        <planeGeometry args={[3, 2]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.05}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* Border lumineux : 4 lignes minces autour */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array([
                -1.5, -1, 0,  1.5, -1, 0,
                 1.5, -1, 0,  1.5,  1, 0,
                 1.5,  1, 0, -1.5,  1, 0,
                -1.5,  1, 0, -1.5, -1, 0,
              ]),
              3,
            ]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>

      {/* Titre */}
      <Text
        position={[0, 0.2, 0.01]}
        fontSize={0.28}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        letterSpacing={-0.02}
        material-toneMapped={false}
      >
        {title}
      </Text>

      {/* Tag */}
      <Text
        position={[0, -0.25, 0.01]}
        fontSize={0.12}
        color="#E8E8E8"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.2}
        material-toneMapped={false}
        fillOpacity={0.65}
      >
        {tag.toUpperCase()}
      </Text>

      {/* Petit point lumineux décoratif top-left */}
      <mesh position={[-1.35, 0.85, 0.02]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshBasicMaterial color="#FFFFFF" toneMapped={false} />
      </mesh>
    </group>
  );
}

// ─── PROJETS SECTION — anneau orbital futuriste ──────────────────────────────
const PROJETS_ITEMS = [
  { title: "hush", tag: "B2C SaaS" },
  { title: "Vertxia", tag: "B2B SaaS · 3D" },
  { title: "Réeltopost", tag: "Automation" },
  { title: "Beta lab", tag: "R&D" },
  { title: "Studio", tag: "Brand · Design" },
];

function ProjetsSection({ pos }: { pos: [number, number, number] }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const orbitRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.1;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z = -state.clock.elapsedTime * 0.15;
    }
    if (orbitRef.current) {
      orbitRef.current.rotation.y = state.clock.elapsedTime * 0.08;
    }
  });

  return (
    <group position={pos}>
      {/* Anneau orbital principal (large torus violet) */}
      <mesh ref={ringRef} rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[3.5, 0.04, 16, 128]} />
        <meshBasicMaterial
          color={palette.cosmicViolet}
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Anneau intérieur plus fin */}
      <mesh ref={innerRingRef} rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[2.6, 0.02, 12, 96]} />
        <meshBasicMaterial
          color={palette.cosmicVioletLight}
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Items orbitant dans l'anneau */}
      <group ref={orbitRef}>
        {PROJETS_ITEMS.map((item, i) => {
          const angle = (i / PROJETS_ITEMS.length) * Math.PI * 2;
          const x = Math.cos(angle) * 3.5;
          const z = Math.sin(angle) * 3.5;
          // léger tilt pour suivre l'inclinaison de l'anneau
          const y = Math.sin(angle) * 0.5;
          return (
            <group key={i} position={[x, y, z]}>
              <mesh>
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshBasicMaterial
                  color={palette.cosmicVioletLight}
                  toneMapped={false}
                />
              </mesh>
              <Text
                position={[0, 0.5, 0]}
                fontSize={0.18}
                color="#FFFFFF"
                anchorX="center"
                anchorY="middle"
                material-toneMapped={false}
                fillOpacity={0.85}
              >
                {item.title}
              </Text>
              <Text
                position={[0, 0.25, 0]}
                fontSize={0.08}
                color="#E8E8E8"
                anchorX="center"
                anchorY="middle"
                letterSpacing={0.2}
                material-toneMapped={false}
                fillOpacity={0.55}
              >
                {item.tag.toUpperCase()}
              </Text>
            </group>
          );
        })}
      </group>

      {/* Titre central */}
      <Text
        position={[0, 4.5, 0]}
        fontSize={0.95}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        letterSpacing={-0.03}
        material-toneMapped={false}
      >
        Projets
      </Text>

      {/* Sous-titre */}
      <Text
        position={[0, 3.7, 0]}
        fontSize={0.22}
        color="#E8E8E8"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.25}
        material-toneMapped={false}
        fillOpacity={0.75}
      >
        SAAS · BUILD · LAB
      </Text>

      {/* Core central : petit core violet pulsant */}
      <mesh>
        <sphereGeometry args={[0.4, 24, 24]} />
        <meshBasicMaterial
          color={palette.cosmicViolet}
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ─── CONTACT SECTION — sphère de verre cosmique ───────────────────────────────
function ContactSection({ pos }: { pos: [number, number, number] }) {
  const sphereRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (sphereRef.current) {
      sphereRef.current.rotation.y = state.clock.elapsedTime * 0.12;
    }
  });

  return (
    <group position={pos}>
      {/* Sphère de verre transmissive — utilise MeshTransmissionMaterial de drei */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[2.5, 64, 64]} />
        <MeshTransmissionMaterial
          color={palette.cosmicBlue}
          transmission={0.95}
          thickness={0.6}
          roughness={0.15}
          ior={1.4}
          chromaticAberration={0.04}
          backside
          backsideThickness={0.4}
          distortion={0.2}
          distortionScale={0.4}
          temporalDistortion={0.05}
          toneMapped={false}
        />
      </mesh>

      {/* Cœur lumineux à l'intérieur de la sphère (visible à travers le verre) */}
      <mesh>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </mesh>

      {/* Halo extérieur bleu */}
      <mesh>
        <sphereGeometry args={[3.2, 32, 32]} />
        <meshBasicMaterial
          color={palette.cosmicBlue}
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Titre flottant au-dessus */}
      <Text
        position={[0, 4, 0]}
        fontSize={0.95}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        letterSpacing={-0.03}
        material-toneMapped={false}
      >
        Contact
      </Text>

      {/* Email flottant en-dessous */}
      <Text
        position={[0, -4, 0]}
        fontSize={0.32}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.05}
        material-toneMapped={false}
        fillOpacity={0.9}
      >
        emilien@vertxia.com
      </Text>

      <Text
        position={[0, -4.5, 0]}
        fontSize={0.12}
        color="#E8E8E8"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.3}
        material-toneMapped={false}
        fillOpacity={0.6}
      >
        TOULON · FRANCE
      </Text>
    </group>
  );
}

// ─── ABOUT SECTION — monolithe minimaliste gigantesque ────────────────────────
function AboutSection({ pos }: { pos: [number, number, number] }) {
  const monolithRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (monolithRef.current) {
      // Rotation lente, presque imperceptible
      monolithRef.current.rotation.y = state.clock.elapsedTime * 0.03;
    }
  });

  return (
    <group position={pos}>
      {/* Monolithe principal : boîte élancée argentée mate (style 2001 Space Odyssey) */}
      <mesh ref={monolithRef}>
        <boxGeometry args={[1.5, 7, 0.3]} />
        <meshStandardMaterial
          color="#0a0a0a"
          metalness={0.9}
          roughness={0.25}
          emissive={palette.silver}
          emissiveIntensity={0.08}
        />
      </mesh>

      {/* Lignes lumineuses verticales sur le monolithe (3 lignes argent) */}
      {[-0.5, 0, 0.5].map((xOffset, i) => (
        <mesh key={i} position={[xOffset, 0, 0.16]}>
          <planeGeometry args={[0.02, 6.5]} />
          <meshBasicMaterial
            color="#FFFFFF"
            transparent
            opacity={0.35}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Point lumineux au sommet du monolithe */}
      <mesh position={[0, 3.7, 0.16]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color="#FFFFFF" toneMapped={false} />
      </mesh>

      {/* Halo lumineux autour du monolithe */}
      <mesh>
        <boxGeometry args={[1.8, 7.3, 0.5]} />
        <meshBasicMaterial
          color={palette.silver}
          transparent
          opacity={0.06}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Texte à droite du monolithe */}
      <group position={[2.5, 1, 0]}>
        <Text
          fontSize={0.85}
          color="#FFFFFF"
          anchorX="left"
          anchorY="middle"
          letterSpacing={-0.03}
          material-toneMapped={false}
        >
          About
        </Text>
        <Text
          position={[0, -0.8, 0]}
          fontSize={0.18}
          color="#E8E8E8"
          anchorX="left"
          anchorY="middle"
          maxWidth={4.5}
          lineHeight={1.5}
          material-toneMapped={false}
          fillOpacity={0.75}
        >
          Emilien Behague.{"\n"}Builder solo. Toulon, France.{"\n"}Background tech + execution.
        </Text>
      </group>

      {/* Petite ligne déco horizontale */}
      <mesh position={[3.5, 0, 0]}>
        <planeGeometry args={[1.5, 0.012]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ─── COMPÉTENCES SECTION — constellations interactives ────────────────────────
const COMPETENCES_NODES = [
  { name: "React",     pos: [0, 1, 0] as const },
  { name: "Three.js",  pos: [1.5, 0.5, 0.5] as const },
  { name: "R3F",       pos: [-1.5, 0.5, 0.3] as const },
  { name: "WebGL",     pos: [1.2, -0.8, -0.3] as const },
  { name: "Next.js",   pos: [-1.2, -0.6, 0.6] as const },
  { name: "TypeScript",pos: [0.4, -1.5, 0] as const },
  { name: "Shopify",   pos: [-0.5, 1.6, -0.4] as const },
  { name: "AI",        pos: [2.0, -0.2, -0.5] as const },
  { name: "GLSL",      pos: [-2.0, -0.1, -0.5] as const },
  { name: "Motion",    pos: [0, -0.3, 1.2] as const },
];

// Connexions entre nodes (par index, pour former une constellation cohérente)
const COMPETENCES_EDGES: [number, number][] = [
  [0, 1], [0, 2], [0, 6], [0, 9],
  [1, 3], [1, 7], [2, 4], [2, 8],
  [3, 5], [4, 5], [5, 9], [6, 2],
  [7, 3], [8, 4], [9, 5],
];

function CompetencesSection({ pos }: { pos: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);

  // Geometry pour les edges
  const edgesGeo = useMemo(() => {
    const positions = new Float32Array(COMPETENCES_EDGES.length * 6);
    for (let i = 0; i < COMPETENCES_EDGES.length; i++) {
      const [a, b] = COMPETENCES_EDGES[i];
      const na = COMPETENCES_NODES[a].pos;
      const nb = COMPETENCES_NODES[b].pos;
      positions[i * 6 + 0] = na[0] * 1.5;
      positions[i * 6 + 1] = na[1] * 1.5;
      positions[i * 6 + 2] = na[2] * 1.5;
      positions[i * 6 + 3] = nb[0] * 1.5;
      positions[i * 6 + 4] = nb[1] * 1.5;
      positions[i * 6 + 5] = nb[2] * 1.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.07;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.15) * 0.1;
    }
  });

  return (
    <group position={pos}>
      {/* Titre */}
      <Text
        position={[0, 4, 0]}
        fontSize={0.95}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        letterSpacing={-0.03}
        material-toneMapped={false}
      >
        Compétences
      </Text>

      {/* Sous-titre */}
      <Text
        position={[0, 3.2, 0]}
        fontSize={0.22}
        color="#E8E8E8"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.25}
        material-toneMapped={false}
        fillOpacity={0.75}
      >
        STACK · OUTILS · DOMAINES
      </Text>

      {/* Constellation : nodes + edges */}
      <group ref={groupRef}>
        {/* Edges (connexions) */}
        <lineSegments ref={edgesRef} geometry={edgesGeo}>
          <lineBasicMaterial
            color={palette.cosmicGold}
            transparent
            opacity={0.4}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </lineSegments>

        {/* Nodes (étoiles) */}
        {COMPETENCES_NODES.map((node, i) => (
          <group key={i} position={[node.pos[0] * 1.5, node.pos[1] * 1.5, node.pos[2] * 1.5]}>
            <mesh>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshBasicMaterial
                color={palette.cosmicGold}
                toneMapped={false}
              />
            </mesh>
            {/* Halo */}
            <mesh>
              <sphereGeometry args={[0.25, 16, 16]} />
              <meshBasicMaterial
                color={palette.cosmicGold}
                transparent
                opacity={0.3}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <Text
              position={[0, 0.35, 0]}
              fontSize={0.13}
              color="#FFFFFF"
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.1}
              material-toneMapped={false}
              fillOpacity={0.85}
            >
              {node.name}
            </Text>
          </group>
        ))}
      </group>
    </group>
  );
}

function SpatialScene({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  return (
    <>
      <SpatialCameraRig progressRef={progressRef} />
      <color attach="background" args={["#020202"]} />

      <ambientLight intensity={0.2} />
      <pointLight position={[0, 5, 0]} intensity={0.6} color="#FFFFFF" />
      <pointLight position={[10, -5, -20]} intensity={0.4} color={palette.cosmicBlue} />
      <pointLight position={[-15, 8, -25]} intensity={0.4} color={palette.cosmicViolet} />

      {/* Background spatial : étoiles + poussière */}
      <SpatialStarsField />
      <SpatialDust />

      {/* Les 5 sections spatiales — chacune avec sa structure 3D distinctive */}
      <PortfolioSection pos={SECTIONS_POSITIONS[0].pos} />
      <ProjetsSection pos={SECTIONS_POSITIONS[1].pos} />
      <ContactSection pos={SECTIONS_POSITIONS[2].pos} />
      <AboutSection pos={SECTIONS_POSITIONS[3].pos} />
      <CompetencesSection pos={SECTIONS_POSITIONS[4].pos} />

      {/* Postprocessing minimaliste cinéma */}
      <EffectComposer multisampling={0}>
        <Bloom intensity={1.0} luminanceThreshold={0.4} luminanceSmoothing={0.5} mipmapBlur />
        <Vignette offset={0.3} darkness={0.65} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}

function SpatialSiteSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const [progressState, setProgressState] = useState(0);
  const stateRafRef = useRef<number | null>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    progressRef.current = latest;
    // Spatial drone : intensity scroll-driven (fade-in entry phase)
    setSpatialDroneIntensity(latest);
    if (stateRafRef.current === null) {
      stateRafRef.current = requestAnimationFrame(() => {
        stateRafRef.current = null;
        setProgressState(progressRef.current);
      });
    }
  });

  useEffect(() => {
    return () => {
      if (stateRafRef.current !== null) cancelAnimationFrame(stateRafRef.current);
    };
  }, []);

  // Section actuelle pour overlay HUD
  const currentSectionIdx = progressState < 0.08
    ? -1
    : Math.min(4, Math.floor((progressState - 0.08) / 0.176));

  // Spatial audio : pan stereo selon la position X 3D de la section active
  // Sections x ∈ [-18 ; 25] → normalisé [-1 ; 1] subtil pour effet "présence"
  useEffect(() => {
    if (currentSectionIdx === -1) {
      setSpatialDronePan(0);
    } else {
      const xPos = SECTIONS_POSITIONS[currentSectionIdx].pos[0];
      setSpatialDronePan(xPos / 30); // ±0.5 à ±0.83 selon la section
    }
  }, [currentSectionIdx]);

  // Fly-to : scroll smooth vers le centre du segment de la section cible
  const scrollToSection = (sectionIdx: number) => {
    if (!containerRef.current) return;
    const sectionRect = containerRef.current.getBoundingClientRect();
    const sectionTop = window.scrollY + sectionRect.top;
    const sectionHeight = containerRef.current.offsetHeight;
    const viewportH = window.innerHeight;
    // Progress cible = centre du segment (entrée + 0.08, segments de 0.176)
    const targetProgress = 0.08 + (sectionIdx + 0.5) * 0.176;
    const targetScrollY = sectionTop + targetProgress * (sectionHeight - viewportH);
    window.scrollTo({ top: targetScrollY, behavior: "smooth" });
  };

  return (
    <section
      ref={containerRef}
      className="relative w-full"
      style={{ height: "1500vh" }}
    >
      <div
        className="sticky top-0 h-screen w-full overflow-hidden"
        style={{ background: "#020202" }}
      >
        <Canvas
          dpr={1}
          camera={{ position: [0, 0, 5], fov: 55, near: 0.1, far: 250 }}
          gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
        >
          <Suspense fallback={null}>
            <SpatialScene progressRef={progressRef} />
          </Suspense>
        </Canvas>

        {/* HUD : indicateur de section */}
        <div
          className="absolute top-8 left-8 text-[10px] font-mono tracking-[0.3em] uppercase pointer-events-none z-30"
          style={{ color: `${palette.silver}A0` }}
        >
          {currentSectionIdx === -1
            ? "→ Entering Vertxia"
            : `[ ${String(currentSectionIdx + 1).padStart(2, "0")} / 05 ] · ${SECTIONS_POSITIONS[currentSectionIdx].name}`}
        </div>

        {/* Menu navigation — fly-to interactif vers chaque section */}
        <nav className="absolute top-1/2 right-8 -translate-y-1/2 flex flex-col gap-3 z-30">
          {SECTIONS_POSITIONS.map((s, i) => {
            const isActive = i === currentSectionIdx;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  sfxNavClick();
                  scrollToSection(i);
                }}
                onMouseEnter={() => {
                  if (!isActive) sfxNavHover();
                }}
                className="text-[9px] font-mono tracking-[0.3em] uppercase transition-all duration-300 text-right cursor-pointer hover:!text-white"
                style={{
                  color: isActive ? palette.silver : `${palette.silver}55`,
                  transform: isActive ? "translateX(-8px)" : "translateX(0)",
                  letterSpacing: "0.3em",
                  background: "transparent",
                  border: "none",
                  padding: "4px 0",
                }}
              >
                {isActive ? "● " : "· "}
                {s.name}
              </button>
            );
          })}
        </nav>
      </div>
    </section>
  );
}

// ─── FINAL CTA ──────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section
      className="relative w-full min-h-screen overflow-hidden flex flex-col items-center justify-center px-8 py-24"
      style={{ background: palette.bg, color: palette.silver }}
    >
      <div
        className="text-[10px] font-mono tracking-[0.5em] uppercase mb-6"
        style={{ color: `${palette.silver}80` }}
      >
        — End of transmission
      </div>
      <h2
        className="text-5xl md:text-7xl font-black leading-[0.95] tracking-[-0.02em] text-center max-w-[800px]"
        style={{ color: palette.silver }}
      >
        Demande l&apos;accès{" "}
        <span className="italic" style={{ color: palette.redNeon }}>
          anticipé.
        </span>
      </h2>
      <p
        className="mt-6 text-sm md:text-base max-w-[480px] text-center leading-relaxed"
        style={{ color: `${palette.silver}B0` }}
      >
        10 places dans la beta privée. Le moteur Vertxia, le pipeline complet, l&apos;accès direct.
      </p>
      <a
        href="mailto:emilien@vertxia.com?subject=Early%20Access%20Vertxia"
        className="mt-10 px-6 py-3.5 rounded-md text-xs font-bold tracking-[0.2em] uppercase transition-all flex items-center gap-3 hover:scale-[1.02]"
        style={{
          background: palette.silver,
          color: palette.bg,
          boxShadow: `0 0 40px ${palette.silver}30`,
        }}
      >
        emilien@vertxia.com
        <span aria-hidden>→</span>
      </a>

      <div
        className="absolute bottom-6 left-0 right-0 flex justify-between px-8 text-[9px] font-mono tracking-[0.3em] uppercase"
        style={{ color: `${palette.silver}60` }}
      >
        <span>© 2026 Vertxia · Built in Toulon · Day 03 · v0.1 alpha</span>
        <span>@vertxia.fr</span>
      </div>
    </section>
  );
}

// ─── MUTE TOGGLE — bouton fixe bas-gauche + raccourci M ─────────────────────
function MuteToggle({
  muted,
  onToggle,
}: {
  muted: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={muted ? "Activer le son" : "Couper le son"}
      title={muted ? "Activer le son (M)" : "Couper le son (M)"}
      className="fixed bottom-6 left-8 z-50 w-10 h-10 flex items-center justify-center rounded-full backdrop-blur-sm transition-all hover:scale-105"
      style={{
        background: `${palette.bg}AA`,
        border: `1px solid ${palette.silver}30`,
        color: muted ? `${palette.silver}80` : palette.silver,
        boxShadow: muted ? "none" : `0 0 12px ${palette.silver}25`,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* Haut-parleur */}
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        {muted ? (
          // X croix : muted
          <>
            <line x1="22" y1="9" x2="16" y2="15" />
            <line x1="16" y1="9" x2="22" y2="15" />
          </>
        ) : (
          // Ondes sonores
          <>
            <path d="M15.54 8.46a5 5 0 010 7.07" />
            <path d="M19.07 4.93a10 10 0 010 14.14" />
          </>
        )}
      </svg>
    </button>
  );
}

// ─── PAGE ROOT ──────────────────────────────────────────────────────────────
export default function VertxiaV3Page() {
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);

  // Load mute preference depuis localStorage au mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && localStorage.getItem("vertxia-muted") === "1") {
        setIsMuted(true);
      }
    } catch {
      /* localStorage indispo (incognito/sandbox) → ignore */
    }
  }, []);

  // Sync isMuted → audio engine + localStorage + ref
  useEffect(() => {
    isMutedRef.current = isMuted;
    setAudioMuted(isMuted);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("vertxia-muted", isMuted ? "1" : "0");
      }
    } catch {
      /* silently ignore */
    }
  }, [isMuted]);

  // First-interaction unlock : Chrome autoplay policy → AudioContext.resume()
  // attaché au premier scroll / click / touch / key. Auto-cleanup après unlock.
  useEffect(() => {
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      initAudio();
      // Applique le mute state initial (au cas où user était muted via localStorage)
      setAudioMuted(isMutedRef.current);
    };
    const opts: AddEventListenerOptions = { passive: true, once: true };
    window.addEventListener("scroll", unlock, opts);
    window.addEventListener("click", unlock, opts);
    window.addEventListener("touchstart", unlock, opts);
    window.addEventListener("keydown", unlock, opts);
    return () => {
      window.removeEventListener("scroll", unlock);
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Raccourci clavier M : toggle mute
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "m" || e.key === "M") {
        // ne pas trigger si l'utilisateur tape dans un input (sécurité future)
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        setIsMuted((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main
      className="relative w-full overflow-x-clip font-sans antialiased"
      style={{
        background: palette.bg,
        color: palette.silver,
        // Désactive le scroll anchoring browser : sur ce site sticky-heavy avec
        // overlays HTML qui montent/démontent selon le scroll, le browser tente
        // de "maintenir la position visuelle" en ajustant le scroll → sauts en arrière.
        overflowAnchor: "none",
      }}
    >
      <CinematicSection />
      <SpatialSiteSection />
      <FinalCTA />
      <MuteToggle muted={isMuted} onToggle={() => setIsMuted((p) => !p)} />
    </main>
  );
}
