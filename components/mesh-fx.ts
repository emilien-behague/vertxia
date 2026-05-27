"use client";

/**
 * Helpers de transformation des matériaux du mesh (post-load GLB).
 *
 * applyIridescence : convertit MeshStandardMaterial → MeshPhysicalMaterial
 * avec iridescence (thin-film effect, soap bubble), clearcoat et transmission
 * subtile. C est la signature "matière futuriste" Active Theory : le mesh
 * shimmer comme du nacre / chrome quand la lumière bouge.
 *
 * IMPORTANT : on CLONE les matériaux. Sinon les mutations contaminent le
 * cache de useGLTF (qui partage les scenes entre instances) et la deuxième
 * page rendue avec le même GLB hérite des effets de la première.
 */

import * as THREE from "three";

type IridescenceOpts = {
  /** Force iridescence (0 = off, 0.5 = subtil, 1 = full prism) */
  strength?: number;
  /** Force du clearcoat ajouté par-dessus (0.3-0.5 = effet vernis) */
  clearcoat?: number;
  /** Index de réfraction de la couche iridescente (1.3 = standard) */
  ior?: number;
  /** Plage d épaisseur du thin film, contrôle la couleur (nm) */
  thicknessRange?: [number, number];
};

export function applyIridescence(
  root: THREE.Object3D,
  opts: IridescenceOpts = {}
) {
  const strength = opts.strength ?? 0.6;
  const clearcoat = opts.clearcoat ?? 0.4;
  const ior = opts.ior ?? 1.3;
  const thicknessRange = opts.thicknessRange ?? [100, 800];

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;

    const cloneOne = (old: THREE.Material): THREE.Material => {
      if (!(old instanceof THREE.MeshStandardMaterial)) return old;
      // Skip si déjà MeshPhysicalMaterial avec iridescence active
      if (
        old instanceof THREE.MeshPhysicalMaterial &&
        old.iridescence >= strength - 0.001
      ) {
        return old;
      }

      const phys = new THREE.MeshPhysicalMaterial({
        map: old.map,
        normalMap: old.normalMap,
        normalScale: old.normalScale.clone(),
        roughnessMap: old.roughnessMap,
        metalnessMap: old.metalnessMap,
        aoMap: old.aoMap,
        aoMapIntensity: old.aoMapIntensity,
        emissiveMap: old.emissiveMap,
        color: old.color.clone(),
        roughness: old.roughness,
        metalness: old.metalness,
        emissive: old.emissive.clone(),
        emissiveIntensity: old.emissiveIntensity,
        transparent: old.transparent,
        opacity: old.opacity,
        side: old.side,
        iridescence: strength,
        iridescenceIOR: ior,
        iridescenceThicknessRange: thicknessRange,
        clearcoat,
        clearcoatRoughness: 0.2,
      });
      phys.needsUpdate = true;
      return phys;
    };

    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map(cloneOne);
    } else {
      obj.material = cloneOne(obj.material);
    }
  });
}
