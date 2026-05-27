"use client";

/**
 * PortfolioView — page /demo (Vertxia Lab).
 *
 * Concept (Emilien 27/05/2026) : "site 3D infini où quand on scroll on avance
 *   dans l'univers de Vertxia". Référence visuelle : Magic Window Dow Jones —
 *   caméra qui marche droit devant à travers une ville-particules.
 *
 * Mécanique :
 *   - <Canvas> sticky derrière toute la page
 *   - Le DOM contient N sections (1 par "chambre") = ~500vh de scroll total
 *   - <ScrollCamera> traduit le scroll en position.z (strictement axial)
 *   - Chaque chambre est un <group position={[0,0,zChambre]}> qui contient
 *     un champ de particules + (optionnel) un mot en particules
 *   - Les textes de chaque chambre sont rendus en overlay HTML dans la section
 *     correspondante — ils défilent normalement avec le scroll
 *
 * Aucun drift caméra latéral. Aucun lookAt dynamique. La caméra regarde -Z
 *   et ne fait QUE avancer/reculer selon le scroll.
 */

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { CinematicEffects } from "@/components/cinematic-effects";
import { WordParticles } from "@/components/word-particles";
import { ScrollCamera } from "@/components/scroll-camera";
import {
  ParticleField,
  tunnelDistributor,
  vortexDistributor,
  shellDistributor,
  planeDistributor,
  sphereDistributor,
} from "@/components/particle-field";
import { FloatingTemplate } from "@/components/floating-template";
import { AudioProvider } from "@/components/audio/audio-provider";
import { AudioToggle } from "@/components/audio/audio-toggle";
import { MagneticButton } from "@/components/magnetic-button";

/* ─── Layout du voyage ────────────────────────────────────────────────────── */
// 6 chambres alignées sur Z. La caméra démarre à Z=4.5 et avance en ligne droite
// jusqu'à la chambre FIN (espace calme où le texte CTA HTML apparaît).
// TON TOUR (chambre 5) est traversée comme un mur de particules — la caméra
// continue ensuite vers la chambre FIN où la lumière s'apaise.
const CHAMBERS = [
  { z: 0, label: "HERO" },
  { z: -30, label: "TUNNEL" },
  { z: -60, label: "PIPELINE" },
  { z: -90, label: "GALLERY" },
  { z: -120, label: "TON TOUR" },
  { z: -160, label: "FIN" },
] as const;
// Camera : Z=4.5 → Z=4.5-165 = -160.5 (juste à la chambre FIN, après avoir
// traversé "TON TOUR" à Z=-120).
const TOTAL_DEPTH = 165;
const SCROLL_HEIGHT_VH = 600; // 6 sections × 100vh

/**
 * MobileScale — wrappe un sous-arbre 3D pour qu'il tienne dans le FOV horizontal.
 * Le FOV horizontal d'une caméra perspective est = vFov * aspect. Sur portrait
 * 9:16 (aspect 0.56), il vaut ~28° — bien trop étroit pour cadrer VERTXIA à
 * scale 1. On scale dynamiquement par aspect pour que le mot tienne quelle que
 * soit la largeur du viewport. Min 0.28 = sécurité sur les écrans très étroits.
 */
function MobileScale({ children }: { children: React.ReactNode }) {
  const { size } = useThree();
  const aspect = size.width / size.height;
  // Landscape : pas de scale. Portrait : aspect * 0.6 (avec floor 0.28).
  const scale = aspect >= 1 ? 1 : Math.max(0.28, aspect * 0.6);
  return <group scale={scale}>{children}</group>;
}

function LabInner() {
  const scrollRef = useRef(0);

  useEffect(() => {
    const updateScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollRef.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll);

    // Dev helper : ?s=0.25 scroll automatiquement à 25% (utile pour screenshots
    // headless de chaque chambre). En prod ça reste silencieux si pas de query.
    const sp = new URLSearchParams(window.location.search);
    const target = sp.get("s");
    if (target !== null) {
      const t = Math.min(1, Math.max(0, parseFloat(target)));
      // Force le ref tout de suite pour que la cam saute immédiatement, puis
      // scrolle le DOM après que la hauteur soit stable (sections 500vh montées).
      scrollRef.current = t;
      const doScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: t * max, behavior: "auto" });
      };
      setTimeout(doScroll, 100);
      setTimeout(doScroll, 500);
    }

    return () => {
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
    };
  }, []);

  return (
    <main className="relative w-full overflow-x-hidden bg-background">
      {/* Sticky 3D canvas — derrière tout le contenu HTML.
          La caméra avance sur Z avec le scroll, traverse les chambres une par une. */}
      <div className="fixed inset-0 z-0">
        <Canvas
          dpr={[1, 2]}
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl, scene }) => {
            gl.setClearColor("#0B0907");
            scene.fog = new THREE.FogExp2("#1A1410", 0.025);
          }}
        >
          <PerspectiveCamera makeDefault fov={50} position={[0, 0, 4.5]} />
          <ScrollCamera
            scrollRef={scrollRef}
            startZ={4.5}
            totalDepth={TOTAL_DEPTH}
          />

          <ambientLight intensity={0.18} color="#3a2e22" />
          <directionalLight position={[4, 3, 6]} intensity={1.4} color="#FFC58A" />

          <Suspense fallback={null}>
            {/* Chambre 0 : Hero — VERTXIA en particules face à l'entrée.
                MobileScale rétrécit le mot en portrait (sinon il déborde du FOV). */}
            <group position={[0, 0, CHAMBERS[0].z]}>
              <MobileScale>
                <WordParticles
                  words={["VERTXIA"]}
                  activeIndex={0}
                  pointSize={0.9}
                />
              </MobileScale>
            </group>

            {/* Chambre 1 : Tunnel — paroi de particules autour du chemin Z */}
            <group position={[0, 0, CHAMBERS[1].z]}>
              <ParticleField
                count={22000}
                distribute={tunnelDistributor(8, 32, 2.5)}
                pointSize={1.0}
                colorA="#A16207"
                colorB="#FFB070"
                driftSpeed={0.6}
                driftAmount={0.04}
              />
            </group>

            {/* Chambre 2 : Pipeline — vortex/tornade de particules */}
            <group position={[0, 0, CHAMBERS[2].z]}>
              <ParticleField
                count={28000}
                distribute={vortexDistributor(7, 32, 6)}
                pointSize={0.9}
                colorA="#C5800B"
                colorB="#FFE3B0"
                driftSpeed={1.3}
                driftAmount={0.08}
              />
              {/* Cœur du pipeline : noyau dense */}
              <ParticleField
                count={6000}
                distribute={sphereDistributor(2.2)}
                pointSize={1.0}
                colorA="#FF9E55"
                colorB="#FFE3B0"
              />
            </group>

            {/* Chambre 3 : GALERIE — showroom des templates 3D Vertxia.
                On traverse 5 produits réels qui flottent : figurines, chaussures,
                meuble. Chacun entouré d'un halo de particules pour le valoriser.
                C'est LE moment de preuve : "voici ce que je peux faire pour toi". */}
            <group position={[0, 0, CHAMBERS[3].z]}>
              {/* Lumières dédiées chambre — clé latérale warm + fill stone */}
              <pointLight position={[5, 4, 5]} intensity={45} color="#FFD080" distance={30} decay={1.5} />
              <pointLight position={[-5, 2, -5]} intensity={28} color="#A16207" distance={25} decay={1.5} />
              <pointLight position={[0, 6, -15]} intensity={20} color="#FFE3B0" distance={30} decay={1.5} />

              {/* Sol particules en perspective */}
              <ParticleField
                count={14000}
                distribute={planeDistributor(34, 32, -3.5)}
                pointSize={0.9}
                colorA="#5A3812"
                colorB="#A16207"
                driftAmount={0.02}
              />

              {/* 5 templates 3D positionnés en chicane le long de Z (depth 4 → -16)
                  pour que la caméra les rencontre l'un après l'autre. Tailles
                  variées pour casser le rythme. Halo particules sous chaque mesh. */}

              {/* Jiraya — gauche-près */}
              <FloatingTemplate
                url="/3d/jiraya_m6.glb"
                position={[-3, 0.3, 5]}
                targetSize={3.2}
                rotationSpeed={0.28}
                phaseOffset={0}
                initialTilt={[0, 0.3, 0]}
              />
              <ParticleField
                count={2500}
                distribute={shellDistributor(2.4, 0.3)}
                pointSize={0.95}
                colorA="#C5800B"
                colorB="#FFE3B0"
                position={[-3, 0.3, 5]}
              />

              {/* Wool-runner — droite */}
              <FloatingTemplate
                url="/3d/wool-runner.glb"
                position={[3, 0.5, -2]}
                targetSize={2.4}
                rotationSpeed={0.32}
                phaseOffset={1.5}
                initialTilt={[0, -0.4, 0]}
              />
              <ParticleField
                count={1800}
                distribute={shellDistributor(1.6, 0.2)}
                pointSize={0.9}
                colorA="#A16207"
                colorB="#FFE3B0"
                position={[3, 0.5, -2]}
              />

              {/* Derbies femme — droite haute (ex-Trunks position) */}
              <FloatingTemplate
                url="/3d/les-derbies-femme_m6.glb"
                position={[3.5, 1.8, -9]}
                targetSize={2.6}
                rotationSpeed={0.30}
                phaseOffset={3}
                initialTilt={[0, 0.5, 0]}
              />
              <ParticleField
                count={1800}
                distribute={shellDistributor(1.8, 0.22)}
                pointSize={0.9}
                colorA="#A16207"
                colorB="#FFE3B0"
                position={[3.5, 1.8, -9]}
              />

              {/* Trunks DBZ — gauche bas (la bulle vide que tu pointais) */}
              <FloatingTemplate
                url="/3d/dbz-trunks_m6.glb"
                position={[-3.5, -0.5, -12]}
                targetSize={3.2}
                rotationSpeed={0.22}
                phaseOffset={4.5}
                initialTilt={[0, 0.7, 0]}
              />
              <ParticleField
                count={2200}
                distribute={shellDistributor(2.2, 0.28)}
                pointSize={0.95}
                colorA="#A16207"
                colorB="#FFE3B0"
                position={[-3.5, -0.5, -12]}
              />

              {/* Meuble TV — droite éloigné */}
              <FloatingTemplate
                url="/3d/coffee-tek-meuble-tv-180_clean.glb"
                position={[3.2, 0.2, -16]}
                targetSize={3.0}
                rotationSpeed={0.20}
                phaseOffset={6}
                initialTilt={[0, -0.6, 0]}
              />
              <ParticleField
                count={1800}
                distribute={shellDistributor(2.0, 0.22)}
                pointSize={0.9}
                colorA="#A16207"
                colorB="#FFE3B0"
                position={[3.2, 0.2, -16]}
              />
            </group>

            {/* Chambre 4 : TON TOUR — mur de particules qu'on TRAVERSE.
                Caméra continue ensuite vers la chambre FIN au-delà. */}
            <group position={[0, 0, CHAMBERS[4].z]}>
              <MobileScale>
                <WordParticles
                  words={["TON TOUR"]}
                  activeIndex={0}
                  pointSize={0.9}
                />
              </MobileScale>
            </group>

            {/* Chambre 5 : FIN — espace calme post-mur, lumière warm en bout de
                fuite. Le texte CTA HTML apparaît en overlay ici. */}
            <group position={[0, 0, CHAMBERS[5].z]}>
              {/* Plane sol qui s'étend devant pour la perspective infinie */}
              <ParticleField
                count={14000}
                distribute={planeDistributor(50, 80, -3)}
                pointSize={0.85}
                colorA="#3D2008"
                colorB="#A16207"
                driftAmount={0.02}
              />
              {/* Halo warm devant la caméra — bout de fuite cinéma */}
              <ParticleField
                count={6000}
                distribute={sphereDistributor(3)}
                pointSize={0.9}
                colorA="#FF9E55"
                colorB="#FFE3B0"
                position={[0, 0, -8]}
                driftAmount={0.04}
              />
              {/* Light dust traversée subtile autour du couloir final */}
              <ParticleField
                count={7000}
                distribute={tunnelDistributor(7, 30, 1.5)}
                pointSize={0.8}
                colorA="#A16207"
                colorB="#FFE3B0"
              />
            </group>

            {/* Champ ambiant traversé en permanence — donne le feel "espace infini".
                Couvre toute la longueur du voyage pour qu'il n'y ait jamais de vide. */}
            <ParticleField
              count={18000}
              distribute={tunnelDistributor(16, TOTAL_DEPTH + 40, 6)}
              pointSize={0.75}
              colorA="#2A1A0A"
              colorB="#A16207"
              position={[0, 0, -TOTAL_DEPTH / 2]}
              driftSpeed={0.4}
              driftAmount={0.03}
            />
          </Suspense>

          <CinematicEffects
            bloom={0.22}
            vignette={0.55}
            saturation={0.1}
            contrast={0.05}
            chromaticAberration={0.0012}
          />
        </Canvas>

        {/* Backdrop glow warm — sous le canvas opaque, agit comme bord lumineux */}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 85%, rgba(161, 98, 7, 0.16) 0%, rgba(161, 98, 7, 0) 60%)",
            mixBlendMode: "screen",
          }}
        />
      </div>

      {/* UI fixe : header + footer + sound toggle (au-dessus de tout) */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between p-6 md:p-10">
        <div className="pointer-events-auto flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.4em] text-foreground/70">
            VERTXIA · LAB
          </span>
          <span className="h-px w-8 bg-foreground/20" />
          <span className="font-mono text-[10px] tracking-[0.35em] text-foreground/45">
            SCROLL ↓
          </span>
        </div>
        <AudioToggle className="pointer-events-auto" />
      </div>

      {/* Sections scroll — chacune correspond visuellement à une chambre */}
      <div className="relative z-10" style={{ height: `${SCROLL_HEIGHT_VH}vh` }}>
        <Section align="end">
          <ChapterLabel index={1} label="ENTRÉE" />
          <h1 className="font-display text-4xl md:text-6xl leading-[1.02] text-foreground/95 max-w-3xl">
            L&apos;IA qui transforme ton Shopify
            <br />
            en site 3D cinéma.
          </h1>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-foreground/55 max-w-md">
            Build in public · Emilien · Toulon
          </p>
        </Section>

        <Section align="end">
          <ChapterLabel index={2} label="TUNNEL" />
          <h2 className="font-display text-3xl md:text-5xl leading-[1.05] text-foreground/95 max-w-2xl">
            Tu colles l&apos;URL Shopify.
            <br />
            On scrape ton catalogue.
          </h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-foreground/55 max-w-md">
            WooCommerce HTML · Shopify /products.json · 4 min de pipeline
          </p>
        </Section>

        <Section align="end">
          <ChapterLabel index={3} label="PIPELINE" />
          <h2 className="font-display text-3xl md:text-5xl leading-[1.05] text-foreground/95 max-w-2xl">
            Meshy 3D · postprocess Blender
            <br />
            · compression draco · 14 MB max.
          </h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-foreground/55 max-w-md">
            GLB cinéma · 300k poly · ACES filmic · particules GPU
          </p>
        </Section>

        <Section align="end">
          <ChapterLabel index={4} label="GALERIE" />
          <h2 className="font-display text-3xl md:text-5xl leading-[1.05] text-foreground/95 max-w-2xl">
            Chaque produit devient
            <br />
            une scène traversable.
          </h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-foreground/55 max-w-md">
            Camera path · scroll cinéma · sound design Web Audio
          </p>
        </Section>

        {/* Section 5 : on traverse le mur "TON TOUR" en particules.
            Volontairement minimaliste — le mur particules est le hero, le texte
            HTML reste en retrait pour ne pas concurrencer. */}
        <Section align="end">
          <ChapterLabel index={5} label="TON TOUR" />
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-foreground/45 max-w-md">
            Tu traverses le mur. Le moment où tu décides.
          </p>
        </Section>

        {/* Section 6 : FIN — espace calme, le texte CTA principal apparaît ici
            une fois "TON TOUR" passé derrière la caméra. */}
        <Section align="center">
          <ChapterLabel index={6} label="FIN" />
          <h2 className="font-display text-4xl md:text-6xl leading-[1.02] text-foreground/95 max-w-3xl text-center">
            Active Vertxia
            <br />
            pour ta boutique.
          </h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-foreground/55 text-center max-w-md">
            Premiers 30 testeurs · emilien@vertxia.com
          </p>
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-4 pt-2">
            <MagneticButton
              href="https://instagram.com/vertxia.fr"
              variant="solid"
              target="_blank"
              rel="noopener"
            >
              @VERTXIA.FR →
            </MagneticButton>
          </div>
        </Section>
      </div>
    </main>
  );
}

/* ─── Petits composants section/label ─────────────────────────────────────── */

function Section({
  children,
  align = "end",
}: {
  children: React.ReactNode;
  align?: "end" | "center" | "start";
}) {
  const alignment =
    align === "center"
      ? "items-center justify-center text-foreground"
      : align === "start"
        ? "items-start justify-start"
        : "items-start justify-end";
  // pb-32 sur mobile pour rester clear de la tab bar iOS Safari (~80-100px).
  // md:pb-10 desktop normal. pt-24 sur mobile pour clear le header fixe.
  return (
    <section
      className={`pointer-events-none relative flex h-screen flex-col px-6 pt-24 pb-32 md:p-10 ${alignment}`}
    >
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function ChapterLabel({ index, label }: { index: number; label: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.4em] text-foreground/40">
      <span>{String(index).padStart(2, "0")}</span>
      <span className="h-px w-8 bg-foreground/30" />
      <span>{label}</span>
    </div>
  );
}

export function PortfolioView() {
  return (
    <AudioProvider enableDrone>
      <LabInner />
    </AudioProvider>
  );
}
