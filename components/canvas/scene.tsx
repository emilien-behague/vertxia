"use client";

/**
 * Scene — Canvas R3F global pour /lite/*.
 *
 * Pattern basement.studio website-2k25 :
 *  - UN seul <Canvas> monte au niveau layout
 *  - reste monte au-dessus des routes (fixed h-100svh)
 *  - chaque page injecte ses meshes via <WebGlTunnelIn>
 *  - frameloop="demand" : 0 frame quand idle, invalidate() au besoin
 *
 * Benefice : 0 re-mount WebGL inter-route = 0 flash blanc + GPU libre.
 *
 * Config GL minimaliste (basement) :
 *  - antialias: false  (postprocessing SMAA gere AA)
 *  - alpha: false      (canvas opaque = perf++)
 *  - SRGBColorSpace + NoToneMapping (le tone map se fait dans renderer/postFX)
 */

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";

import { WebGlTunnelOut } from "@/components/canvas/tunnel";
import { useCanvasStore } from "@/store/canvas-store";

export function Scene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setCanvasReady = useCanvasStore((s) => s.setCanvasReady);
  const isHidden = useCanvasStore((s) => s.isHidden);

  useEffect(() => {
    setCanvasReady(true);
    return () => setCanvasReady(false);
  }, [setCanvasReady]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 h-[100svh] w-screen"
      style={{
        zIndex: 0,
        visibility: isHidden ? "hidden" : "visible",
      }}
    >
      <Canvas
        ref={canvasRef}
        frameloop="demand"
        dpr={[1, 2]}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.NoToneMapping,
        }}
        camera={{ fov: 50, near: 0.1, far: 100, position: [0, 0, 5] }}
        style={{ pointerEvents: "none" }}
      >
        <Suspense fallback={null}>
          <WebGlTunnelOut />
        </Suspense>
      </Canvas>
    </div>
  );
}
