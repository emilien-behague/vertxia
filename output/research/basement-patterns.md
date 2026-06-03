# Patterns basement.studio/website-2k25 — Extraction pour Vertxia

**Date :** 2026-05-30
**Source :** [github.com/basementstudio/website-2k25](https://github.com/basementstudio/website-2k25) (94.6% TS, 4% GLSL)
**Pourquoi :** Actionable #1 du rapport CTO Vertxia 2026. C'est exactement le tier visuel cinematic visé.

---

## TL;DR — 3 takeaways stratégiques

1. **basement.studio n'utilise NI Lenis NI GSAP.** Ils misent tout sur **canvas global + tunnel-rat + shaders GLSL custom + Motion natif**. Ça nuance la recommandation du rapport CTO (qui prônait Lenis+GSAP en convergence 5/5). Pour Vertxia : Lenis+GSAP restent utiles pour les sections scroll-driven Vertxia Lite, mais le moat visuel ne dépend pas de ces libs.

2. **Le pattern le plus critique = Canvas Global + tunnel-rat** (à adopter AVANT toute nouvelle feature). Évite le re-mount du WebGL context à chaque navigation (sinon 300ms flash blanc = killer UX cinematic). C'est SEUL la chose qui débloque architecturalement.

3. **Le visuel cinematic = 70% shaders GLSL custom + 30% architecture**. basement a 9 matériaux GLSL custom + render-to-texture + double FBO. C'est ce qui produit le feel "Awwwards-tier". Le code React seul ne suffit pas.

---

## Stack basement.studio (extraite du package.json)

| Layer | Lib | Notes |
|---|---|---|
| Framework | Next.js 15.6-canary + React 19.0.1 | Webpack (`next dev --webpack`), pas Turbopack |
| 3D core | three 0.180 + @react-three/fiber 9.0.0-rc.6 + @react-three/drei 10.0.0-rc.1 | RC versions (Vertxia est sur 9.6 stable + 10.7 stable) |
| **Canvas global** | **tunnel-rat 0.1.2** | Pattern central — voir section dédiée |
| Spatial UI | **@react-three/uikit 1.0.60** + @react-three/uikit-default | Vision Pro tier UI in-scene |
| 3D worker | **@react-three/offscreen 1.0.0-rc.1** | 3D dans un OffscreenCanvas worker thread |
| Physics | @react-three/rapier 1.5 | Pour le mini-jeu basketball |
| Motion | **motion 12.0.0-alpha.2** | Pas de framer-motion, pas de GSAP, pas de Lenis |
| Math 3D | maath 0.10 | Helpers (lerp, damp, easing) |
| Shaders | glsl-noise + glslify-loader + raw-loader | Imports `.glsl` natifs dans webpack |
| Debug | leva 0.9 + r3f-perf 7.2 | Controls live + perf monitoring |
| State | zustand 5 | Stores globaux (navigation, minigame, loading) |
| Style | tailwind 4 + styled-components 6 | Hybride |

**Notable absences** :
- Pas de Lenis
- Pas de GSAP / @gsap/react
- Pas de framer-motion (`motion` standalone)
- Pas de Theatre.js
- Pas de tempus

→ Vertxia conserve Lenis+GSAP+Tempus pour les pages Vertxia Lite scroll-driven. Mais on suit basement pour la couche cinematic immersive.

---

## PATTERN #1 — Canvas Global + tunnel-rat (LE plus important)

### Architecture

```
app/(site)/layout.tsx (root)
├── <Analytics />
├── <SpeedInsights />
├── <Transitions />            ← gestion document.documentElement.dataset.disabled
├── <PostHogProvider>
│   └── <AssetsProvider assets={fetchAssets()}>
│       └── <InspectableProvider>
│           ├── <HtmlTunnelOut />          ← DOM injecté depuis n'importe quelle page
│           ├── <Navbar />
│           ├── <NavigationHandler />
│           ├── <ContentWrapper>
│           │   ├── <CustomCursor />
│           │   ├── <Scene /> (dynamic, ssr:false, fixed h-100svh) ← LE CANVAS GLOBAL
│           │   └── <div className="layout-container">{children}</div>
│           ├── <AppHooks assets={...} />
│           └── <Contact />
```

### Le composant Scene (extrait simplifié)

```tsx
"use client"
import { Canvas } from "@react-three/fiber"
import { Suspense } from "react"
import * as THREE from "three"
import { WebGlTunnelOut } from "@/components/tunnel"
import { Renderer } from "@/components/postprocessing/renderer"

export const Scene = () => {
  return (
    <div className="absolute inset-0">
      <Canvas
        id="canvas"
        frameloop="demand"          // ← GPU économisé (rendu uniquement si invalidate)
        tabIndex={0}
        gl={{
          antialias: false,         // ← antialias géré en postprocessing custom
          alpha: false,
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.NoToneMapping
        }}
        camera={{ fov: 60 }}
      >
        <AnimationController>
          <Renderer sceneChildren={
            <>
              <Suspense fallback={null}><Map /></Suspense>          // ← monde 3D principal
              <Suspense fallback={null}><WebGlTunnelOut /></Suspense> // ← meshes injectés depuis les pages
              <Suspense fallback={null}><CameraController /></Suspense>
              {/* etc. */}
            </>
          } />
        </AnimationController>
      </Canvas>
    </div>
  )
}
```

### Le tunnel (l'astuce centrale)

```tsx
// components/tunnel/index.tsx
"use client"
import tunnel from "tunnel-rat"

const _WebGL = tunnel()
export const WebGlTunnelOut = _WebGL.Out
export const WebGlTunnelIn = _WebGL.In

const _Html = tunnel()
export const HtmlTunnelOut = _Html.Out
export const HtmlTunnelIn = _Html.In
```

### Usage depuis une page

```tsx
// app/(site)/(pages)/showcase/page.tsx
import { WebGlTunnelIn } from "@/components/tunnel"

export default function ShowcasePage() {
  return (
    <>
      {/* DOM normal */}
      <h1>Showcase</h1>

      {/* Mesh 3D injecté dans le Canvas global */}
      <WebGlTunnelIn>
        <mesh position={[0, 0, 0]}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="orange" />
        </mesh>
      </WebGlTunnelIn>
    </>
  )
}
```

### Blacklist des routes sans canvas

```tsx
const BLACKLISTED_PATHS = [
  /^\/showcase\/\d+$/,
  /^\/post\/[^\/]+$/,
  /^\/contact$/,
  /^\/careers\/[^\/]+$/
]

const shouldShowCanvas = useMemo(() => {
  if (canvasErrorBoundaryTriggered) return false
  return !BLACKLISTED_PATHS.some((path) => pathname.match(path))
}, [pathname, canvasErrorBoundaryTriggered])
```

### Pour Vertxia — implémentation V1

1. Créer `components/global-canvas/scene.tsx` avec le pattern Scene ci-dessus
2. Créer `components/global-canvas/tunnel.ts` (3 lignes)
3. Wrapper `app/layout.tsx` ou `app/lite/layout.tsx` avec ce Scene
4. Layout-container : `lg:mt-[100dvh]` quand canvas visible (le contenu commence sous le canvas)
5. ErrorBoundary autour du canvas avec fallback `<div className="h-[37px]" aria-hidden />`
6. Toutes les sections 3D dans les briefs Vertxia Lite passent par `<WebGlTunnelIn>...</WebGlTunnelIn>` au lieu de monter un nouveau `<Canvas>`

**Gain :** 1 seul WebGL context pour tout le site, 0 flash blanc inter-route, postprocessing partagé, GPU économisé.

---

## PATTERN #2 — Canvas config minimaliste + frameloop="demand"

```tsx
<Canvas
  frameloop="demand"   // ← rend SEULEMENT si invalidate() appelé
  gl={{
    antialias: false,                          // ← géré en postprocessing
    alpha: false,                              // ← pas de transparence canvas (gain perf)
    outputColorSpace: THREE.SRGBColorSpace,
    toneMapping: THREE.NoToneMapping
  }}
  camera={{ fov: 60 }}
>
```

**À utiliser quand** : la scène n'a pas besoin de rendu 60fps continu (ex: scroll-driven, hover-driven, transitions discrètes). Sur un cinematic Vertxia avec scroll, c'est l'idéal.

**À NE PAS utiliser quand** : animation continue (rotation, particles physics, video texture jouée en continu) — dans ces cas garder `frameloop="always"` (default).

---

## PATTERN #3 — Shaders GLSL custom (structure + chunks Three.js)

basement a **9 matériaux GLSL custom** (characters, flow, global-shader, net, not-found, postprocessing, screen, solid-reveal, sparkles). Pour Vertxia, viser **2-3 max** en V1 (hero, transitions, vignette dynamique).

### Structure d'un fragment shader (extrait `material-global-shader/fragment.glsl`)

```glsl
precision highp float;

// VARYINGS (vertex → fragment)
varying vec2 vUv;
varying vec2 vUv2;
varying vec3 vWorldPosition;
varying vec3 vMvPosition;
varying vec3 vNormal;
varying vec3 vViewDirection;

// UNIFORMS (Base color)
uniform vec3 uColor;
uniform vec3 baseColor;
uniform sampler2D map;
uniform mat3 mapMatrix;
uniform vec2 mapRepeat;

// UNIFORMS (Animation)
uniform float uTime;          // ← incrémenté à chaque frame, pour shaders dynamiques

// UNIFORMS (Lightmap baked dans Blender)
uniform sampler2D lightMap;
uniform float lightMapIntensity;

// CONDITIONALS (compilation différenciée par mesh)
#ifdef LIGHT
  uniform vec3 lightDirection;
#endif
#ifdef BASKETBALL
  uniform vec3 backLightDirection;
#endif

// AO + Fog + Emissive + Alpha... (sections similaires)

void main() {
  // ... shader logic

  // CHUNKS Three.js (toneMapping + colorspace conversion)
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
```

### Charger des `.glsl` dans Next.js (webpack)

```js
// next.config.ts (extrait)
config.module.rules.push({
  test: /\.(glsl|vs|fs|vert|frag)$/,
  use: ["raw-loader", "glslify-loader"]
})
```

```tsx
import vertexShader from "./vertex.glsl"
import fragmentShader from "./fragment.glsl"

<shaderMaterial
  vertexShader={vertexShader}
  fragmentShader={fragmentShader}
  uniforms={{ uTime: { value: 0 }, uColor: { value: new Color("orange") } }}
/>
```

### Pour Vertxia — quel shader créer en V1

**Hero shader** : fade-in scroll-driven + halftone/grain subtil + hue shift selon scroll position. Donne le feel "magazine print" Aesop tier sur les photos produit.

**Transition shader** : entre 2 pages, un wipe avec masque SVG (basement utilise des masques SVG sprite gigantesques pour leurs transitions — voir `transitions.css`).

---

## PATTERN #4 — Suspense par feature

basement wrap CHAQUE feature dans son propre `<Suspense fallback={null}>` :

```tsx
<Renderer sceneChildren={
  <>
    <DoomJs />                                  // pas de Suspense (eager)
    <Suspense fallback={null}><Inspectables /></Suspense>
    <Suspense fallback={null}><Map /></Suspense>
    <Suspense fallback={null}><WebGlTunnelOut /></Suspense>
    <Suspense fallback={null}><CameraController /></Suspense>
    <Suspense fallback={null}><Sparkles /></Suspense>
    {isBasketball && (
      <PhysicsWorld paused={!isBasketball}>
        <ErrorBoundary>
          <HoopMinigame />
        </ErrorBoundary>
      </PhysicsWorld>
    )}
    <Suspense fallback={null}><CharacterInstanceConfig /><CharactersSpawn /></Suspense>
    <Suspense fallback={null}><Pets /></Suspense>
  </>
} />
```

**Bénéfice** : chaque chunk peut être code-split (lazy import), chaque modèle GLB peut suspendre indépendamment, le canvas reste interactif pendant le loading.

**Pour Vertxia** : wrap chaque section 3D du brief (hero icosaèdre, work case, etc.) dans son propre Suspense.

---

## PATTERN #5 — Render-to-Texture + Double FBO (V2 only)

basement ne fait PAS du postprocessing avec `<EffectComposer>` standard. Ils ont un **Renderer custom** qui :

1. Render `mainScene` dans un `WebGLRenderTarget` avec `HalfFloatType` + `DepthTexture`
2. Une `postProcessingScene` séparée avec une `OrthographicCamera`
3. Render final dans la postProcessingScene avec accès à la depth texture du main render
4. Double FBO pour les effets qui ont besoin du frame N-1 (motion blur, feedback)

```tsx
// extrait renderer.tsx
const mainTarget = useMemo(() => {
  const dt = new DepthTexture(window.innerWidth, window.innerHeight)
  const rt = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: HalfFloatType,
    format: RGBAFormat,
    colorSpace: LinearSRGBColorSpace,
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    depthBuffer: true,
    depthTexture: dt
  })
  return rt
}, [])

useFrameCallback(({ gl }) => {
  // main render
  gl.outputColorSpace = LinearSRGBColorSpace
  gl.toneMapping = NoToneMapping
  gl.setRenderTarget(mainTarget)
  gl.render(mainScene, mainCamera)

  // post processing
  gl.outputColorSpace = SRGBColorSpace
  gl.setRenderTarget(null)
  gl.render(postProcessingScene, postProcessingCamera)
})
```

**Pour Vertxia — V1 NON.** C'est overkill. Garder `@react-three/postprocessing` (SMAA+Bloom+ACES+Vignette validé).
**V2** : envisager si on veut accéder à la depth texture pour du SSAO custom ou des effects scene-aware.

---

## PATTERN #6 — Asset preloading + AssetsProvider

```tsx
// app-hooks-init/index.tsx
export const AppHooks = ({ assets }: { assets: AssetsResult }) => {
  useConsoleLogo()
  usePreloadAssets(assets)             // ← preload TOUS les GLB/textures/audio en arrière-plan
  useInitializeAudioContext()
  useAmbiencePlaylist()
  return <SiteAudioSFXsLoader />
}
```

```tsx
// layout.tsx
const assets = await fetchAssets()    // ← server-side: liste des assets nécessaires

<AssetsProvider assets={assets}>
  ...
</AssetsProvider>
```

**Pour Vertxia** : fetch côté server tous les GLB des produits du brief, les preload pendant que l'user voit le hero. Quand il scroll vers la collection, tout est déjà chargé.

---

## PATTERN #7 — Stores Zustand thématiques

basement a 4-5 stores zustand séparés :
- `useAppLoadingStore` (état loading + erreur canvas)
- `useNavigationStore` (page courante, camera mode, scene name)
- `useMinigameStore` (état basketball minigame)
- `useInspectableStore` (objet 3D actuellement inspecté)

Pattern : **1 store par feature**, pas un méga-store global. Permet code-splitting + re-renders ciblés.

**Pour Vertxia** : créer `useBriefStore` (brief courant), `useEditStore` (panel d'édition), `useCanvasStore` (état canvas global). Pas tout dans un store.

---

## Ce qu'on NE prend PAS de basement pour Vertxia

| Pattern basement | Pourquoi pas Vertxia |
|---|---|
| Mini-jeux (basketball, doom-js, arcade) | Pas le scope produit |
| @react-three/rapier (physique) | Pas nécessaire pour des sites e-commerce |
| @react-three/uikit | Vision Pro tier mais 140KB bundle — défer V2 |
| @react-three/offscreen | Worker thread pour 3D — défer V2 (gain marginal V1) |
| Render-to-texture custom + double FBO | Overkill V1, garder @react-three/postprocessing |
| Sanity CMS | On a déjà nos briefs JSON |
| Notion API + Mailchimp | Pas le scope |
| `next dev --webpack` au lieu de Turbopack | Bug Three.js + Turbopack en juin 2025 — vérifier si fixed depuis |

---

## Actionables immédiats Vertxia (ordre)

1. **[1h] Implémenter Canvas Global + tunnel-rat** dans `app/lite/layout.tsx`. Test : naviguer entre 2 briefs Vertxia Lite, vérifier 0 flash blanc et que le canvas survit.
2. **[30min] Switch `frameloop="demand"`** sur le canvas global + appeler `invalidate()` aux moments d'animation.
3. **[1h] Suspense par section 3D** dans les composants templates (CinematicNarrative, etc.).
4. **[2h] Setup webpack pour .glsl** + créer 1er shader hero (fade-in scroll + halftone subtil).
5. **[1h] Refactor stores zustand** thématiques (briefStore, editStore, canvasStore).
6. **[défer V2] Render-to-texture custom + uikit + offscreen + Theatre.js.**

**Total V1 : ~5-6h** de refactor architecture. Gain : 0 flash inter-route, GPU économisé, code-split par section, 1er shader cinematic custom.

---

## License & ethics

basement.studio website-2k25 est sur GitHub mais **AUCUNE LICENSE explicite**. Donc :
- ✅ Lire le code pour comprendre les patterns
- ✅ Adapter les concepts (canvas global, tunnel, shader structure)
- ❌ Ne PAS copier-coller de code source verbatim
- ❌ Ne PAS réutiliser leurs assets (GLB, textures, audio)

Notre implémentation Vertxia doit être **inspirée des patterns**, **réécrite from-scratch en l'adaptant à notre cas** (e-commerce Shopify, pas portfolio agence).

---

**Rapport CTO complet :** `Vertxia/web/output/research/vertxia-tech-stack-2026-cto-report.md`
**Repo cloné dans :** `Vertxia/research/website-2k25/` (à supprimer après extraction si quota disque)
