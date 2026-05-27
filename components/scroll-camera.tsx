"use client";

/**
 * ScrollCamera — caméra propulsée vers -Z par le scroll de la page.
 *
 * scrollRef.current ∈ [0, 1] (0 = top de page, 1 = bottom).
 * Caméra interpolée smoothly entre startZ (top) et startZ - totalDepth (bottom).
 *
 * Pas de lookAt() — la caméra regarde -Z par défaut. Tout ce qu'on aligne sur
 * l'axe Z (chambres) défile naturellement devant le viewer.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";

type Props = {
  scrollRef: React.MutableRefObject<number>;
  startZ?: number;
  totalDepth?: number;
  /** Vitesse de rattrapage du target (plus haut = plus réactif, mais plus saccadé). */
  responsiveness?: number;
};

/**
 * Mouvement STRICTEMENT axial (Z only). Aucun drift X/Y, aucun lookAt
 * dynamique — la caméra regarde -Z par défaut et on ne touche qu'à position.z.
 * Demande Emilien 27/05/2026 : "quand tu scroll ça va tout droit".
 */
export function ScrollCamera({
  scrollRef,
  startZ = 4.5,
  totalDepth = 130,
  responsiveness = 4.5,
}: Props) {
  const { camera } = useThree();
  const currentZ = useRef(startZ);

  useFrame((_, dt) => {
    const target = startZ - scrollRef.current * totalDepth;
    const alpha = Math.min(1, dt * responsiveness);
    currentZ.current += (target - currentZ.current) * alpha;
    camera.position.set(0, 0, currentZ.current);
    camera.rotation.set(0, 0, 0);
  });

  return null;
}
