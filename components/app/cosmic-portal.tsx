"use client";

/**
 * CosmicPortal — overlay full-screen affiche au click Build avant le router.push.
 *
 * 3 phases sur ~1400ms :
 *   0-800ms   : fade-in noir + etoiles statiques apparaissent
 *   800-1200ms: warp speed (etoiles z = -200 -> 5 a grande vitesse)
 *   1200-1400ms: flash blanc
 *
 * Apres 1400ms, le parent declenche router.push et demonte le portail.
 *
 * R3F = lourd (~80KB) -> ce module DOIT etre dynamic-imported avec ssr: false
 * cote command-surface pour eviter de l'inclure dans le bundle initial /app.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";

function Warp({ count = 600 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 60;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 60;
      arr[i * 3 + 2] = -Math.random() * 200;
    }
    return arr;
  }, [count]);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    // Acceleration : lent au debut, warp speed apres 0.6s
    const speed = t < 0.6 ? 8 + t * 30 : 220;
    const pos = ref.current.geometry.attributes.position
      .array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 2] += speed * delta;
      if (pos[i * 3 + 2] > 5) {
        pos[i * 3 + 2] = -200;
        pos[i * 3] = (Math.random() - 0.5) * 60;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 60;
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
        size={0.55}
        sizeAttenuation
        transparent
        opacity={0.95}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/**
 * Camera dolly subtil : avance la camera vers l'avant pendant le warp,
 * accentue l'effet de plongee.
 */
function CameraDolly() {
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const z = Math.max(0, 5 - t * 4);
    state.camera.position.z = z;
  });
  return null;
}

export default function CosmicPortal() {
  // Flash blanc final : opacity 0 -> 1 entre 1200ms et 1400ms
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setFlash(true), 1180);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[9999] pointer-events-none"
      style={{ animation: "vsig-portal-fadein 220ms ease-out both" }}
    >
      <div className="absolute inset-0 bg-black" />

      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: false }}
        className="absolute inset-0"
      >
        <color attach="background" args={["#020010"]} />
        <CameraDolly />
        <Warp count={600} />
      </Canvas>

      {/* Flash blanc final */}
      <div
        className="absolute inset-0 bg-white"
        style={{
          opacity: flash ? 1 : 0,
          transition: "opacity 220ms ease-in",
        }}
      />

      <style>{`
        @keyframes vsig-portal-fadein {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
      `}</style>
    </div>
  );
}
