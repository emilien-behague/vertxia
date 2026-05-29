"use client";

/**
 * FloatingGallery — galerie cinematic 3 couches LIGHT (25 cards total).
 *
 * Refactor 2026-05-29 :
 *  - Volume reduit a 25 (5 fg + 8 mid + 12 bg)
 *  - Fade-in cinematic staggered au mount (foreground → midground → background)
 *
 *   Foreground (z   0 a +1) :  5 hero cards, nettes, interactives, parallax 0.10
 *   Midground  (z -3 a -4) :  8 supporting images, opacity 0.7-0.8, parallax 0.04
 *   BG Far     (z -4.5 a -6) : 12 vraies images, opacity 0.45-0.55, parallax 0.025
 *
 * Atmosphere : Sparkles drei 130 particules + 3 halos diffus colores.
 * Fog Three.js #050505 near 5 / far 17. Pas de DoF postprocess (memory feedback Vertxia).
 *
 * Reveal sequence : foreground 0-0.4s, midground 0.5-1.06s, bg 1.10-1.76s.
 * Duree fade ~0.9s par card, easing easeOutCubic.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Image as DreiImage, Html, Sparkles } from "@react-three/drei";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  FOREGROUND_PROJECTS,
  MIDGROUND_PROJECTS,
  BACKGROUND_FAR,
  type MockProject,
  type MidProject,
  type BackgroundFar,
} from "@/lib/mock-projects";

const BG_COLOR = "#050505";

/* ============================================================
 *  useReveal — stagger fade-in (renvoie une ref [0,1] eased)
 * ============================================================ */

function useReveal(delay: number, duration = 0.9) {
  const startedAt = useRef<number | null>(null);
  const linear = useRef(0);
  const eased = useRef(0);

  useFrame((state, dt) => {
    if (startedAt.current === null) startedAt.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - startedAt.current - delay;
    if (elapsed > 0 && linear.current < 1) {
      linear.current = Math.min(1, linear.current + dt / duration);
      // easeOutCubic
      eased.current = 1 - Math.pow(1 - linear.current, 3);
    }
  });

  return eased;
}

/* ============================================================
 *  FOREGROUND — hero cards interactives (nettes, full image)
 * ============================================================ */

function ForegroundCard({
  project,
  revealDelay,
}: {
  project: MockProject;
  revealDelay: number;
}) {
  const router = useRouter();
  const meshRef = useRef<THREE.Mesh>(null);
  const imgRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [labelVisible, setLabelVisible] = useState(false);
  const reveal = useReveal(revealDelay);

  useEffect(() => {
    const t = setTimeout(() => setLabelVisible(true), (revealDelay + 0.3) * 1000);
    return () => clearTimeout(t);
  }, [revealDelay]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const r = reveal.current;

    const targetZ = hovered ? project.position[2] + 0.7 : project.position[2];
    // Scale combine hover + reveal pop (0.88 → 1.0)
    const targetScale = (hovered ? 1.06 : 1) * (0.88 + 0.12 * r);

    meshRef.current.position.z = THREE.MathUtils.lerp(
      meshRef.current.position.z,
      targetZ,
      delta * 6
    );
    meshRef.current.scale.x = THREE.MathUtils.lerp(
      meshRef.current.scale.x,
      targetScale,
      delta * 8
    );
    meshRef.current.scale.y = THREE.MathUtils.lerp(
      meshRef.current.scale.y,
      targetScale,
      delta * 8
    );

    // Mute material opacity directement (evite re-render React)
    const mat = imgRef.current?.material as
      | (THREE.Material & { opacity: number })
      | undefined;
    if (mat) {
      mat.transparent = true;
      mat.opacity = r;
    }
  });

  function onClick() {
    if (project.liveSlug) {
      router.push(`/lite/${project.liveSlug}`);
    }
  }

  return (
    <Float
      speed={0.7 + (project.id.length % 4) * 0.10}
      rotationIntensity={0.18}
      floatIntensity={0.55}
      floatingRange={[-0.20, 0.20]}
    >
      <mesh
        ref={meshRef}
        position={project.position}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          if (typeof document !== "undefined") {
            document.body.style.cursor = "pointer";
          }
        }}
        onPointerOut={() => {
          setHovered(false);
          if (typeof document !== "undefined") {
            document.body.style.cursor = "default";
          }
        }}
        onClick={onClick}
      >
        <DreiImage
          ref={imgRef}
          url={project.imageUrl}
          scale={project.scale}
          transparent
          opacity={0}
          radius={0.08}
          toneMapped={false}
        />

        <Html
          position={[0, -project.scale[1] / 2 - 0.18, 0.05]}
          center
          distanceFactor={6}
          zIndexRange={[100, 0]}
          style={{
            opacity: labelVisible ? (hovered ? 1 : 0.6) : 0,
            transition: "opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
            pointerEvents: "none",
            transform: "translate(-50%, 0)",
          }}
        >
          <div
            className="whitespace-nowrap text-center"
            style={{ fontFamily: "Inter, sans-serif", minWidth: "200px" }}
          >
            <p
              className="text-[10px] tracking-[0.18em] uppercase font-medium"
              style={{
                color: hovered
                  ? "rgba(214, 185, 110, 1)"
                  : "rgba(214, 185, 110, 0.65)",
              }}
            >
              {project.category}
            </p>
            <p
              className="text-white font-medium mt-0.5"
              style={{
                fontSize: hovered ? "13px" : "12px",
                transition: "font-size 0.3s ease",
              }}
            >
              {project.label}
            </p>
            {hovered && (
              <p
                className="text-[10.5px] text-white/55 mt-1"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {project.hint}
              </p>
            )}
          </div>
        </Html>
      </mesh>
    </Float>
  );
}

function ForegroundLayer() {
  const ref = useRef<THREE.Group>(null);
  const { mouse } = useThree();

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y = THREE.MathUtils.lerp(
      ref.current.rotation.y,
      mouse.x * 0.10,
      delta * 2.2
    );
    ref.current.rotation.x = THREE.MathUtils.lerp(
      ref.current.rotation.x,
      -mouse.y * 0.06,
      delta * 2.2
    );
  });

  return (
    <group ref={ref}>
      {FOREGROUND_PROJECTS.map((p, i) => (
        <ForegroundCard key={p.id} project={p} revealDelay={i * 0.10} />
      ))}
    </group>
  );
}

/* ============================================================
 *  MIDGROUND — supporting images (opacity moderee, drift lent)
 * ============================================================ */

function MidgroundCard({
  project,
  revealDelay,
}: {
  project: MidProject;
  revealDelay: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const imgRef = useRef<THREE.Mesh>(null);
  const reveal = useReveal(revealDelay);

  useFrame((_, delta) => {
    const r = reveal.current;
    if (meshRef.current) {
      const target = 0.9 + 0.1 * r;
      meshRef.current.scale.x = THREE.MathUtils.lerp(
        meshRef.current.scale.x,
        target,
        delta * 8
      );
      meshRef.current.scale.y = THREE.MathUtils.lerp(
        meshRef.current.scale.y,
        target,
        delta * 8
      );
    }
    const mat = imgRef.current?.material as
      | (THREE.Material & { opacity: number })
      | undefined;
    if (mat) {
      mat.transparent = true;
      mat.opacity = project.opacity * r;
    }
  });

  return (
    <Float
      speed={project.speed}
      rotationIntensity={0.10}
      floatIntensity={0.32}
      floatingRange={[-0.12, 0.12]}
    >
      <mesh ref={meshRef} position={project.position} raycast={() => null}>
        <DreiImage
          ref={imgRef}
          url={project.imageUrl}
          scale={project.scale}
          transparent
          opacity={0}
          radius={0.06}
          toneMapped={false}
        />
      </mesh>
    </Float>
  );
}

function MidgroundLayer() {
  const ref = useRef<THREE.Group>(null);
  const { mouse } = useThree();

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y = THREE.MathUtils.lerp(
      ref.current.rotation.y,
      mouse.x * 0.04,
      delta * 1.8
    );
    ref.current.rotation.x = THREE.MathUtils.lerp(
      ref.current.rotation.x,
      -mouse.y * 0.025,
      delta * 1.8
    );
  });

  return (
    <group ref={ref}>
      {MIDGROUND_PROJECTS.map((p, i) => (
        <MidgroundCard
          key={p.id}
          project={p}
          revealDelay={0.5 + i * 0.08}
        />
      ))}
    </group>
  );
}

/* ============================================================
 *  BACKGROUND FAR — 28 vraies images lointaines
 * ============================================================ */

function BackgroundFarCard({
  item,
  revealDelay,
}: {
  item: BackgroundFar;
  revealDelay: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const imgRef = useRef<THREE.Mesh>(null);
  const reveal = useReveal(revealDelay, 1.1);

  useFrame((_, delta) => {
    const r = reveal.current;
    if (meshRef.current) {
      const target = 0.92 + 0.08 * r;
      meshRef.current.scale.x = THREE.MathUtils.lerp(
        meshRef.current.scale.x,
        target,
        delta * 8
      );
      meshRef.current.scale.y = THREE.MathUtils.lerp(
        meshRef.current.scale.y,
        target,
        delta * 8
      );
    }
    const mat = imgRef.current?.material as
      | (THREE.Material & { opacity: number })
      | undefined;
    if (mat) {
      mat.transparent = true;
      mat.opacity = item.opacity * r;
    }
  });

  return (
    <Float
      speed={item.speed}
      rotationIntensity={0.05}
      floatIntensity={0.18}
      floatingRange={[-0.08, 0.08]}
    >
      <mesh ref={meshRef} position={item.position} raycast={() => null}>
        <DreiImage
          ref={imgRef}
          url={item.imageUrl}
          scale={item.scale}
          transparent
          opacity={0}
          radius={0.05}
          toneMapped={false}
        />
      </mesh>
    </Float>
  );
}

function BackgroundFarLayer() {
  const ref = useRef<THREE.Group>(null);
  const { mouse } = useThree();

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y = THREE.MathUtils.lerp(
      ref.current.rotation.y,
      mouse.x * 0.025,
      delta * 1.5
    );
    ref.current.rotation.x = THREE.MathUtils.lerp(
      ref.current.rotation.x,
      -mouse.y * 0.018,
      delta * 1.5
    );
  });

  return (
    <group ref={ref}>
      {BACKGROUND_FAR.map((item, i) => (
        <BackgroundFarCard
          key={item.id}
          item={item}
          revealDelay={1.1 + i * 0.06}
        />
      ))}
    </group>
  );
}

/* ============================================================
 *  ATMOSPHERE — halos diffus + sparkles
 * ============================================================ */

function AtmosphereHalos() {
  return (
    <group>
      <mesh position={[-3.5, 2.0, -6]} raycast={() => null}>
        <sphereGeometry args={[3.5, 24, 24]} />
        <meshBasicMaterial
          color="#4F7DFF"
          transparent
          opacity={0.06}
          depthWrite={false}
          fog={false}
        />
      </mesh>
      <mesh position={[3.0, -1.5, -7]} raycast={() => null}>
        <sphereGeometry args={[4.0, 24, 24]} />
        <meshBasicMaterial
          color="#8A5CFF"
          transparent
          opacity={0.05}
          depthWrite={false}
          fog={false}
        />
      </mesh>
      <mesh position={[0, 0, -9]} raycast={() => null}>
        <sphereGeometry args={[5.5, 24, 24]} />
        <meshBasicMaterial
          color="#D6B96E"
          transparent
          opacity={0.04}
          depthWrite={false}
          fog={false}
        />
      </mesh>
    </group>
  );
}

function DustParticles() {
  return (
    <Sparkles
      count={130}
      scale={[22, 14, 8]}
      position={[0, 0, -3]}
      size={2.6}
      speed={0.28}
      opacity={0.62}
      color="#F0DBA8"
      noise={0.6}
    />
  );
}

/* ============================================================
 *  Scene + Canvas
 * ============================================================ */

function Scene() {
  return (
    <>
      {/* fog far rehausse a 17 (was 13.5) — laisse les BG FAR respirer */}
      <fog attach="fog" args={[BG_COLOR, 5.0, 17.0]} />

      <ambientLight intensity={0.55} />

      <AtmosphereHalos />
      <BackgroundFarLayer />
      <MidgroundLayer />
      <ForegroundLayer />
      <DustParticles />
    </>
  );
}

export function FloatingGallery() {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 55 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
