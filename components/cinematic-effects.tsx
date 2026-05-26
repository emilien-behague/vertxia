"use client";

import {
  EffectComposer,
  Bloom,
  Vignette,
  SMAA,
  ToneMapping,
  BrightnessContrast,
  HueSaturation,
  N8AO,
  DepthOfField,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";

type Props = {
  // Niveau de bloom (intensité des highlights). 0 = off, 0.3 = subtil, 0.6 = punchy
  bloom?: number;
  // Force du vignette (focus). 0 = off, 0.3 = standard, 0.5 = dramatique
  vignette?: number;
  // Saturation boost. 0 = neutre, 0.1 = légère, 0.2 = vibrant
  saturation?: number;
  // Contraste boost. 0 = neutre, 0.05 = légère, 0.1 = punchy
  contrast?: number;
  // Ambient Occlusion : ombres de contact dans les plis / détails fins.
  // 0 = off, 1.5 = subtil, 3 = standard, 5 = dramatique. Le levier qui distingue
  // un rendu "carton" d'un rendu "studio photo".
  ao?: number;
  // Rayon AO : taille de la zone d'ombrage. 0.5 = micro (détails fins),
  // 1.0 = standard, 2.0 = large (ombres globales)
  aoRadius?: number;
  // Depth of Field : flou progressif arrière-plan. Donne look photo macro.
  // 0 = off (recommandé sur sols/sets riches), 1 = subtil, 3 = dramatique
  dof?: number;
  // Distance focale normalisée 0-1 (fraction du frustum). Pour caméra Vertxia
  // (model centré devant cam), 0.012-0.020 est le sweet spot focus produit
  dofFocusDistance?: number;
};

/**
 * Cinematic post-processing chain réutilisable.
 *
 * Chain (ordre = chain rendering, important) :
 *   - SMAA              : antialiasing fin (mieux que FXAA, moins coûteux que MSAA)
 *   - N8AO              : ambient occlusion (ombres de contact, plis, détails)
 *   - DepthOfField      : flou progressif arrière-plan (look photo macro)
 *   - Bloom             : highlights / aura (subtil par défaut)
 *   - ToneMapping ACES  : color science cinéma (vs Linear/Reinhard)
 *   - HueSaturation     : saturation contrôlée
 *   - BrightnessContrast: punch légèrement
 *   - Vignette          : focus sur le centre
 *
 * Notes :
 * - N8AO est le SOTA 2024 vs SSAO classique : meilleur visuel + plus rapide GPU
 * - DOF off par défaut : à activer page par page selon richesse du fond
 */
export function CinematicEffects({
  bloom = 0.25,
  vignette = 0.3,
  saturation = 0.05,
  contrast = 0.03,
  ao = 2.5,
  aoRadius = 1.0,
  dof = 0,
  dofFocusDistance = 0.015,
}: Props) {
  return (
    <EffectComposer multisampling={0}>
      <SMAA />
      {ao > 0 ? (
        <N8AO
          aoRadius={aoRadius}
          intensity={ao}
          distanceFalloff={1.0}
          quality="high"
        />
      ) : (
        <></>
      )}
      {dof > 0 ? (
        <DepthOfField
          focusDistance={dofFocusDistance}
          focalLength={0.05}
          bokehScale={dof}
          height={480}
        />
      ) : (
        <></>
      )}
      <Bloom
        intensity={bloom}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.4}
        mipmapBlur
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <HueSaturation hue={0} saturation={saturation} />
      <BrightnessContrast brightness={0} contrast={contrast} />
      <Vignette
        offset={0.3}
        darkness={vignette}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}
