/**
 * Fragment shader — Hero fade-in + halftone subtil.
 *
 * Inspire basement.studio shader structure :
 *  - varyings en haut
 *  - uniforms groupes par section
 *  - halftone pattern (dots) pour donner une vibration analogique editoriale
 *  - fade radial vignette pour focus
 *  - tone-map ACES via Three.js chunks
 */

export const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  uniform float uTime;
  uniform float uOpacity;
  uniform float uScroll;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorAccent;
  uniform vec2 uResolution;

  // Hash pseudo-aleatoire stable
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  // Halftone : pattern de points subtil
  float halftone(vec2 uv, float scale) {
    vec2 grid = fract(uv * scale) - 0.5;
    return smoothstep(0.45, 0.15, length(grid));
  }

  void main() {
    vec2 uv = vUv;

    // Gradient vertical doux ColorA -> ColorB
    float vGrad = smoothstep(0.0, 1.0, uv.y);
    vec3 col = mix(uColorA, uColorB, vGrad);

    // Touche d'accent (light leak diagonal)
    float leak = smoothstep(0.6, 1.2, uv.x + uv.y * 0.4 - uScroll * 0.5);
    col = mix(col, uColorAccent, leak * 0.18);

    // Halftone analogique
    float hf = halftone(uv + vec2(uTime * 0.005, 0.0), 180.0);
    col -= hf * 0.04;

    // Grain fin pour casser les bandings
    float grain = (hash(uv * uResolution + uTime) - 0.5) * 0.025;
    col += grain;

    // Vignette radiale legere
    float dist = distance(uv, vec2(0.5));
    float vignette = smoothstep(0.85, 0.35, dist);
    col *= mix(0.78, 1.0, vignette);

    gl_FragColor = vec4(col, uOpacity);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
