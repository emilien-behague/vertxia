"use client";

/**
 * FloatingTemplate — un GLB qui flotte + tourne dans l'univers Vertxia.
 *
 * Usage dans une chambre du journey :
 *   <FloatingTemplate
 *     url="/3d/jiraya_m6.glb"
 *     position={[-3, 0, -90]}
 *     targetSize={2.4}
 *     rotationSpeed={0.25}
 *   />
 *
 * Le GLB est chargé via useGLTF (Suspense), centré sur son origine via bounding
 * box, et scalé pour que sa plus grande dimension == targetSize. La position
 * passée en prop est donc le CENTRE du mesh dans l'espace world.
 *
 * Performance : chaque instance .clone() la scène pour avoir sa propre transform.
 * Les BufferGeometries restent partagées (instancées). 4-6 templates simultanés
 * = OK desktop, surveiller sur mobile.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

type Props = {
  url: string;
  position: [number, number, number];
  /** Plus grande dimension du mesh après normalisation (unités world). */
  targetSize?: number;
  /** Tours par seconde (≈). 0 = pas de rotation. */
  rotationSpeed?: number;
  /** Amplitude verticale du float (unités world). */
  floatAmplitude?: number;
  /** Fréquence du float (Hz approx). */
  floatSpeed?: number;
  /** Décalage de phase pour désynchroniser plusieurs templates. */
  phaseOffset?: number;
  /** Axe initial tilté (radians) pour casser le "tous droits". */
  initialTilt?: [number, number, number];
};

export function FloatingTemplate({
  url,
  position,
  targetSize = 2.5,
  rotationSpeed = 0.25,
  floatAmplitude = 0.2,
  floatSpeed = 0.7,
  phaseOffset = 0,
  initialTilt = [0, 0, 0],
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);
  const tRef = useRef(phaseOffset);

  // Clone + centre + scale une fois — chaque instance a son propre état.
  // IMPORTANT : SkeletonUtils.clone (pas scene.clone) pour que les SkinnedMesh
  // (Trunks, Jiraya — personnages rigés) clonent correctement leur squelette.
  // Sinon les vertices de la moitié haute se retrouvent au mauvais endroit.
  const prepared = useMemo(() => {
    const cloned = cloneSkinned(scene);
    const box = new THREE.Box3().setFromObject(cloned);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scaleFactor = targetSize / maxDim;
    // Re-centrer à l'origine pour que la rotation se fasse autour du centre
    cloned.position.set(-center.x, -center.y, -center.z);
    return { object: cloned, scaleFactor };
  }, [scene, targetSize]);

  useFrame((_, dt) => {
    tRef.current += dt;
    if (groupRef.current) {
      groupRef.current.position.y =
        position[1] + Math.sin(tRef.current * floatSpeed) * floatAmplitude;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = tRef.current * rotationSpeed;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <group
        ref={innerRef}
        scale={prepared.scaleFactor}
        rotation={initialTilt}
      >
        <primitive object={prepared.object} />
      </group>
    </group>
  );
}

/* Preload pour que les GLB soient en cache dès la première section du scroll —
   évite le pop-in quand l'utilisateur arrive sur la GALERIE. */
useGLTF.preload("/3d/jiraya_m6.glb");
useGLTF.preload("/3d/dbz-trunks_m6.glb");
useGLTF.preload("/3d/les-derbies-femme_m6.glb");
useGLTF.preload("/3d/wool-runner.glb");
useGLTF.preload("/3d/coffee-tek-meuble-tv-180_clean.glb");
