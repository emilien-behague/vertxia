"use client";

/**
 * Skeleton loader overlay pour les pages preview 3D.
 *
 * Utilise `useProgress` de @react-three/drei qui hook le loading manager
 * Three.js global -> on a le vrai % de download des assets (GLB + textures + HDRI).
 *
 * Visuel : fond noir, spinner ring CSS, texte mono tracking large, progress bar
 * fine + compteur %. Cohérent avec l'esthétique Vertxia (font mono, tracking 0.3-0.4em).
 *
 * Fade-out automatique 600ms après progress >= 100, puis unmount pour libérer le DOM.
 */

import { useProgress } from "@react-three/drei";
import { useEffect, useState } from "react";

export function SceneLoader() {
  const { progress, active } = useProgress();
  const [unmounted, setUnmounted] = useState(false);

  useEffect(() => {
    // Quand le loading est fini, on attend 600ms (fade out) puis on unmount
    if (!active && progress >= 100) {
      const t = setTimeout(() => setUnmounted(true), 600);
      return () => clearTimeout(t);
    }
  }, [active, progress]);

  if (unmounted) return null;

  const isDone = !active && progress >= 100;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-50 bg-black flex flex-col items-center justify-center transition-opacity duration-500 ${
        isDone ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Spinner ring */}
      <div className="relative w-14 h-14 mb-7">
        {/* Track */}
        <div className="absolute inset-0 rounded-full border border-white/10" />
        {/* Arc qui tourne */}
        <div className="absolute inset-0 rounded-full border border-t-white/70 border-r-white/20 border-b-transparent border-l-transparent animate-spin" />
      </div>

      {/* Label */}
      <div className="font-mono text-[10px] md:text-xs tracking-[0.4em] text-white/55 mb-2">
        LOADING SCENE
      </div>

      {/* Pourcentage live */}
      <div className="font-mono text-[9px] md:text-[10px] tracking-[0.3em] text-white/30">
        {Math.round(progress)}%
      </div>

      {/* Progress bar fine */}
      <div className="mt-5 w-28 h-px bg-white/10 overflow-hidden">
        <div
          className="h-full bg-white/50 transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
