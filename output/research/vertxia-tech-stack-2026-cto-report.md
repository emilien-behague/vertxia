# Vertxia Tech Stack 2026 — Rapport CTO

**Date :** 2026-05-30
**Source :** Workflow 6 agents (5 experts + 1 synthèse Opus)
**Durée :** 6:48 min
**Tokens :** 468k

---

## Executive Summary

La stack Vertxia 2026 idéale est figée : **Next.js 16 App Router + React 19 + Tailwind 4** (déjà en place, garder), **Three.js r183+ WebGPURenderer + R3F v9 + drei + @react-three/postprocessing** pour la 3D, **GSAP 3.13 + ScrollTrigger + SplitText + @gsap/react useGSAP()** pour les scroll narratives, **Motion (motion/react avec pattern m + LazyMotion à 4.6KB)** pour les micro-interactions UI, **Lenis 1.3+ + Tempus** pour un RAF unifié, **cmdk + Vaul + Sonner + Radix** pour l'UI premium, **Theatre.js uniquement V2** si une scène signature >30s le justifie.

Les 5 agents convergent à 100% sur ce socle — c'est la stack des Awwwards SOTD 2025-2026 (basement.studio, darkroom, Lusion, Active Theory).

**Le moat de Vertxia n'est PAS le code** (tout est open-source), c'est la verticalisation Shopify + qualité éditoriale 3D + brief créatif IA + vitesse d'exécution, dans une fenêtre **6-12 mois** avant qu'Agensi/Pippit/Lovable ne comblent le trou.

**Décision stratégique non-négociable** : NE PAS hand-coder le visuel premium (2 tentatives rejetées, cf. `feedback_vertxia_no_handcoded_visual`) — acheter un template Awwwards-tier (Studio Freight/Locomotive/Wodniack) et brancher dessus la pipeline URL→assets.

---

## Stack idéale Vertxia 2026

| Catégorie | Primary | Secondary | Pourquoi |
|---|---|---|---|
| **Motion** | GSAP 3.13 + ScrollTrigger + SplitText + @gsap/react (useGSAP) | Motion (motion/react avec `m` + LazyMotion, 4.6KB) | Stack Awwwards SOTD 2026. GSAP 100% gratuit depuis Webflow oct 2024. Motion = 33M downloads/sem. Pairing volontaire : GSAP scroll-driven + Motion UI. useGSAP() obligatoire React 19. |
| **Rendering 3D** | Three.js r183+ + WebGPURenderer + WebGL2 fallback + R3F v9 + drei + @react-three/postprocessing | Theatre.js (V2 only), pmndrs/uikit (spatial UI Vision Pro), OGL (escape hatch léger) | WebGPU production-ready depuis Safari 26, 2-10x perf. R3F v9 visibility events. drei MeshTransmissionMaterial + Environment + Lightformer = "glass + light study" Vision Pro feel. **Pas de DOF ni N8AO** (validé). |
| **UI Framework** | Next.js 16 App Router + React 19 + Tailwind 4 + Shadcn/Radix (theming AGRESSIF) | cmdk (Cmd+K en bas) + Vaul (drawers) + Sonner (toasts) + cva (microstates) | **CRITIQUE : bannir Shadcn defaults** (slate+zinc+0.5 radius = signature v0/Lovable). Typo non-Inter/Geist, palette grayscale + 1 accent non-violet, échelle 4px, 6 microstates par composant, tabular-nums global. |
| **Animations** | Lenis 1.3+ + Tempus (RAF unifié darkroom) | View Transitions API native (Next.js 16 `unstable_ViewTransition`) + Motion AnimatePresence | Tempus fix le problème multi-RAF (cause #1 stutters 60→45fps). Config Lenis : `lerp:0.1`, `syncTouch:false` mobile, respect `prefers-reduced-motion`. View Transitions = 0KB bundle. **Barba.js obsolète.** |
| **Architecture** | Canvas global + tunnel-rat (pattern pmndrs/react-three-next) | Drei `<View />` pour 3D islands multi-section + Server Components + Bun + Turbopack | Évite re-mount WebGL context (sinon 200-400ms + flash blanc = killer UX). À implémenter AVANT le code v4, pas après. |
| **Tooling** | Pipeline obligatoire #21 : sequential-thinking → context7 → 1 incrément → chrome-devtools (screenshot + console + perf trace) → fix → validation Emilien | @next/bundle-analyzer + gltf-transform (webp+draco, validé 181→14MB) + Real-ESRGAN conditionnel <1400px | Budget perf strict : LCP <2.5s, INP <200ms, JS <250KB, GLB <15MB. 70% trafic Shopify = mobile. |
| **Inspiration Design** | Cloner basement.studio/website-2k25 + AntoineW/AW-2025-Portfolio + Mobbin/Linear Method/Refactoring UI | Acheter template Awwwards premium ($200-500) OU freelance designer ($3-5k) — **JAMAIS hand-coder le visuel premium** | Awwwards-tier = 70% asset craft + 30% code. Mobbin = 300k+ screenshots Linear/Vercel/Arc/Figma. |

---

## Top 7 Repos GitHub à cloner / disséquer

| # | Repo | Pourquoi |
|---|---|---|
| 1 | [basementstudio/website-2k25](https://github.com/basementstudio/website-2k25) | **PRIORITÉ ABSOLUE** — Site basement.studio open-sourcé (94.6% TS, 4% GLSL). Exactement le tier visé. Pattern R3F + GSAP + Lenis sans drops + shaders GLSL custom + transitions canvas-global. À disséquer LIGNE PAR LIGNE avant tout code v4. |
| 2 | [pmndrs/react-three-next](https://github.com/pmndrs/react-three-next) | Starter officiel pmndrs avec tunnel-rat. TTL 100ms, first load 79kb, Lighthouse 100. Architecture à adopter AVANT de coder v4. |
| 3 | [darkroomengineering/lenis](https://github.com/darkroomengineering/lenis) | Lenis v1.3+ déjà en stack, vérifier upgrade. Étudier /packages/react + /website/. Bundle complet darkroom (Lenis + Tempus + Hamo, ~10KB) résout 80% des problèmes scroll/RAF. |
| 4 | [AntoineW/AW-2025-Portfolio](https://github.com/AntoineW/AW-2025-Portfolio) | Portfolio Webby-winning Wodniack open-sourcé 2026 (référence Hybride 2D+3D validée 27/05). Astro pas notre stack mais patterns transférables 1:1. ⚠️ License CC BY-NC, inspiration OK, copy KO. |
| 5 | [calcom/cal.com](https://github.com/calcom/cal.com) | 32k stars. SaaS Next.js + Tailwind + Shadcn qui ÉCHAPPE au look v0/Lovable. Référence pour customiser Shadcn jusqu'à un niveau Linear-adjacent. |
| 6 | [pacocoursey/cmdk](https://github.com/pacocoursey/cmdk) | Command palette utilisée Linear/Vercel/Raycast/Resend (11.5k stars). Standard pour la Command Bar Raycast-style en bas (anti-cliché "hero prompt centré"). |
| 7 | [Ali-Sanati/awwwards-portfolio](https://github.com/Ali-Sanati/awwwards-portfolio) | Seul repo qui livre un résultat Awwwards-tier en open source complet (React Vite + GSAP + R3F + Drei + Tailwind). Tutoriel YouTube ligne par ligne. Vite pas Next.js mais 90% portable. |

---

## Strategy de différenciation

Vertxia n'a aucun concurrent qui combine les 3 axes simultanément :

1. **URL Shopify → site cinematic 3D R3F réel** (pas du 2D GSAP)
2. **Vidéo AI per-produit avec cohérence narrative cross-catalogue**
3. **Brief créatif LLM en amont**

| Concurrent | Ce qu'ils font | Ce qu'ils ratent |
|---|---|---|
| Lovable / Bolt / v0 / Replit / Framer AI | Builders généralistes | Pas de 3D, pas de vidéo, pas Shopify vertical |
| Higgsfield / Runway / Kling | Vidéo AI | Pas de site |
| TopView / Pippit / Creatify | Vidéo produit | Pas de site |
| PagePilot / Replo | Landing 2D Shopify | Pas de cinéma, pas de vidéo |
| **Agensi Cinematic Sites** ⚠️ | Le plus proche | Kling-only, GSAP 2D pur, **zéro Shopify, 3 installs** |

**Le moat n'est PAS technique** (R3F open-source, Kling = API publique). C'est la **verticalisation Shopify e-commerce premium + qualité éditoriale 3D cinéma + brief créatif IA + cohérence narrative cross-produit**, défendue par la vitesse founder-solo + Claude Code et un positionnement de prix **$149-249/mois mid-DTC** (sweet spot vide entre PagePilot $39 dropshipping et Lovable Enterprise).

**Fenêtre 6-12 mois max** avant que Agensi ajoute Shopify, Pippit pousse via ByteDance, ou Lovable rachète/copie la verticalisation.

**Build-in-public avec 10 démos publiques de boutiques Shopify connues** = preuve sociale + distribution organique à coût ~$100.

---

## Top 6 Actionables 30 jours

### Semaine 1
1. **Cloner basement.studio/website-2k25** (3h avec chrome-devtools MCP). Extraire 3 patterns concrets : (a) sync Lenis+GSAP+R3F sans drops via Tempus, (b) structure shaders GLSL custom, (c) transitions pages canvas-global. Output : `Output/basement-patterns.md`. **Coût $0, ROI = référence vivante du tier visé.**

### Semaine 1-2
2. **Décision stratégique non-négociable VISUEL** :
   - **A** Acheter template Awwwards premium ($200-500, 1 sem, fork + brancher pipeline URL→assets)
   - **B** Freelance designer humain via Twitter/Dribbble ($3-5k, 2-3 sem, identité unique garantie)
   - **C** Continuer hand-code (RISQUE MAJEUR : 100% rejet sur 2 tentatives, cf. memory)
   - **Recommandation BOS : A pour V0 (vitesse), B pour V1 (identité). Memory interdit C par défaut.**

### Semaine 2
3. **Refactor architecture pattern pmndrs/react-three-next** : canvas global + tunnel-rat + Drei `<View />` + `frameloop='demand'`. Setup Lenis + Tempus comme RAF unique. **Output : architecture v4 propre AVANT tout code de feature.**

### Semaine 2-3
4. **Design system anti-IA-générique** :
   - (a) Typo non-default (tester Söhne/GT America/ABC Diatype/Pangram en parallèle, garder 1)
   - (b) Palette grayscale 10 nuances + 1 accent non-violet (vert électrique ou orange chaud)
   - (c) Tailwind config échelle 4px strict (bannir valeurs custom)
   - (d) `font-variant-numeric: tabular-nums` global CSS root
   - (e) 6 microstates systématisés via cva sur 5 composants core (Button, Card, Input, Dialog, Command)
   - (f) cmdk en bas Raycast-style avec keycap glyphs
   - **Test final : screenshot à un dev front sur Twitter, valider qu'il NE DIT PAS "on dirait Lovable/v0".**

### Semaine 3
5. **Bibliothèque 3-5 démos publiques "avant/après"** : 3 boutiques Shopify réelles connues (Allbirds, Glossier, Death Wish Coffee ou équivalent), produire la version Vertxia complète (site cinematic + vidéo Kling + brief créatif Claude), publier en build-in-public sur X/LinkedIn. **Coût ~$100** (Kling $1/vidéo × 10 produits × 3-5 boutiques). **Objectif : preuve sociale + distribution organique + test marché direct.**

### Semaine 3-4
6. **Surveillance hebdo formalisée des 3 concurrents critiques** (alerte Google + check manuel hebdo) :
   - **Agensi Cinematic Sites** (closest direct, ajout Shopify possible)
   - **Pippit/CapCut** (push ByteDance Shopify App Store probable)
   - **Lovable** (annonce mode e-commerce cinematic)
   - Si l'un annonce le combo Vertxia → **déclenchement immédiat revue stratégique kill switch Core #18**, PAS ajustement à la marge.

---

## Risks to Avoid (par ordre de gravité)

1. **KILL SWITCH OVERRIDE** — Toute cette stack est inutile si les 4 kill switches Vertxia signés 25/05 sont ratés. Règle Core #18 prime sur le polish technique. **JAMAIS passer 3 semaines sur le moteur cinematic pendant que les checkpoints de validation marché passent à côté.**

2. **HAND-CODED VISUAL TRAP** — 2 tentatives 29/05 rejetées (7 templates batch + site Satus). Memory explicite : BOS ne peut PAS atteindre Awwwards-tier from-scratch. Décision : template premium ($200-500, 1 sem) OU freelance ($3-5k, 2-3 sem). **Coder soi-même le visuel premium = échec garanti à 4-6 semaines, identité 6/10.**

3. **BUNDLE EXPLOSION** — Stack complète peut faire 1MB+ JS first load mobile 3G. Discipline obligatoire : Motion en `m` + LazyMotion (4.6KB pas 34KB), GSAP plugin par plugin (jamais `gsap/all`), Theatre.js seulement V2, drei tree-shaken, bundle-analyzer sur chaque PR. **Budget strict : LCP <2.5s, INP <200ms, JS <250KB, GLB <15MB. Au-dessus = bounce mobile e-comm explose.**

4. **AI-GENERIC AESTHETIC TRAP** — Inter/Geist + gradient mesh purple-blue-pink + hero prompt centré + floating orbs + Shadcn defaults = signature Lovable/v0/Bolt/Cursor/ChatGPT. **Vertxia dans cette esthétique = invisible dans la mer IA.** Règle Core #22 NON-NÉGOCIABLE : avant tout mock /app, citer 3 références premium spécifiques (Linear/Raycast/Arc/Vercel/Wodniack/basement).

5. **SCROLL JANK MULTI-RAF** — Lenis + GSAP + R3F useFrame + Theatre.js = 4 boucles concurrentes par défaut = stutters 60→45fps. Solution : Tempus comme RAF unique, Lenis pilote scrollTop, GSAP ticker écoute Lenis, R3F `frameloop='demand'` + invalidate() sur scroll. **Sans ça, site cinematic techniquement inférieur à un PagePilot statique sur mobile.**

6. **AGENSI WINDOW** — Cinematic Sites Agensi occupe le même espace tech (Tailwind+GSAP+Gemini+Kling+Cloudflare+Claude QA). S'ils ajoutent Shopify + per-product video avant Vertxia, le différenciateur s'effondre. **Fenêtre <90 jours pour shipper la verticale Shopify e-comm.**

---

## Convergence des 5 agents (ce qu'ils ont tous dit pareil)

- **GSAP 3.13 (gratuit) + Lenis + Motion** = stack motion universelle 2026
- **R3F v9 + drei + postprocessing** = stack 3D universelle 2026
- **WebGPU production-ready** depuis Safari 26
- **Theatre.js réservé V2** (surengineering V1)
- **cmdk + Vaul + Sonner + Radix** = stack UI premium 2026
- **Bannir Inter/Geist + gradient mesh purple** = anti-clichés IA 2026
- **Canvas global + tunnel-rat** = architecture obligatoire React+R3F+Next
- **Hand-coded visual ≠ Awwwards-tier** (asset craft = 70%, code = 30%)

---

**Rapport complet JSON sauvegardé dans** : `C:\Users\behag\AppData\Local\Temp\claude\c--Users-behag-Desktop-BOS-main\18dcf118-818d-4fe5-a3b6-2e565da6641f\tasks\wekthakgn.output`
