"use client";

import {
  EffectComposer,
  Bloom,
  Vignette,
  SMAA,
  ToneMapping,
  BrightnessContrast,
  HueSaturation,
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
};

/**
 * Cinematic post-processing chain réutilisable.
 *
 * Chain :
 *   - SMAA : antialiasing fin (mieux que FXAA, moins coûteux que MSAA)
 *   - Bloom : highlights/aura (subtil par défaut)
 *   - ToneMapping ACES : color science cinéma (vs Linear/Reinhard)
 *   - HueSaturation : saturation contrôlée
 *   - BrightnessContrast : punch légèrement
 *   - Vignette : focus sur le centre
 *
 * Note : ToneMapping ACES est le levier qui transforme le plus le rendu
 * vers un look "Apple/Adobe/agence" vs "demo R3F générique".
 */
export function CinematicEffects({
  bloom = 0.25,
  vignette = 0.3,
  saturation = 0.05,
  contrast = 0.03,
}: Props) {
  return (
    <EffectComposer multisampling={0}>
      <SMAA />
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
