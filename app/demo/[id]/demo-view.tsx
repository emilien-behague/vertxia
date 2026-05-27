"use client";

/**
 * Client component pour la page /demo/[id].
 *
 * Affiche en plein écran :
 *   - Le mesh 3D du produit (Canvas R3F, fond noir cinéma)
 *   - Auto-rotation lente + OrbitControls (drag/zoom)
 *   - SceneLoader skeleton pendant le chargement du GLB
 *   - Overlay top : nom du produit + nom de la boutique
 *   - Sticky bottom banner : CTA "Active ta boutique"
 *   - Bouton "Copier le lien" pour partage viral
 *
 * Mécanique d'acquisition : chaque visiteur de cette URL voit le 3D d'une
 * VRAIE boutique Shopify, comprend ce que Vertxia fait en 5s, et a un CTA
 * clair pour activer le sien. C'est le funnel.
 */

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, useGLTF, OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { CinematicEffects } from "@/components/cinematic-effects";
import { SceneLoader } from "@/components/scene-loader";

type Props = {
  id: string;
  glbUrl: string;
  shop: string;
  vendor: string;
  product: string;
  image: string;
};

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      // Rotation auto lente — perçu cinématique
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.25;
    }
  });

  return (
    <group ref={groupRef} scale={1.6} position={[0, -1, 0]}>
      <primitive object={scene} />
    </group>
  );
}

export function DemoView({ id, glbUrl, shop, vendor, product, image }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Si clipboard API échoue (mobile vieux iOS, contexte non sécurisé), fallback :
      // on sélectionne dans un input invisible et on essaie execCommand
      const ta = document.createElement("textarea");
      ta.value = window.location.href;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      } catch {
        // tant pis
      }
      document.body.removeChild(ta);
    }
  }

  // Email pré-rempli pour le CTA "Activer ma boutique"
  const mailtoBody = encodeURIComponent(
    `Salut Emilien,\n\nJ'ai vu la démo Vertxia pour ${vendor}${shop ? ` (${shop})` : ""} :\nhttps://vertxia.com/demo/${id}\n\nJe veux la même chose pour ma boutique :\n- URL boutique : [TON URL SHOPIFY]\n- Email : [TON EMAIL]\n\nMerci !`
  );
  const mailtoUrl = `mailto:emilien@vertxia.com?subject=${encodeURIComponent(
    `Vertxia 3D pour ma boutique`
  )}&body=${mailtoBody}`;

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* Canvas 3D plein écran */}
      <div className="fixed inset-0 z-0">
        <Canvas
          camera={{ position: [3.2, 1.4, 6.5], fov: 28 }}
          gl={{ antialias: true, alpha: false }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <color attach="background" args={["#0a0907"]} />
            <fog attach="fog" args={["#0a0907", 9, 24]} />
            <ambientLight intensity={0.35} />
            <directionalLight
              position={[5, 8, 5]}
              intensity={1.2}
              color="#ffd9a3"
            />
            <pointLight position={[-4, 3, -4]} intensity={1.3} color="#a855f7" />
            <pointLight position={[4, 5, -3]} intensity={0.7} color="#22d3ee" />
            <Model url={glbUrl} />
            <Environment
              files="/hdri/studio_small_03_2k.hdr"
              environmentIntensity={0.65}
              background={false}
            />
            <CinematicEffects
              bloom={0.35}
              vignette={0.35}
              saturation={0.06}
              contrast={0.04}
            />
            <OrbitControls
              enablePan={false}
              enableZoom={true}
              minDistance={3.5}
              maxDistance={14}
              autoRotate={false}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* SceneLoader skeleton */}
      <SceneLoader />

      {/* Top nav */}
      <nav className="fixed top-0 inset-x-0 z-30 flex justify-between items-center p-5 md:p-8 bg-gradient-to-b from-black/70 via-black/40 to-transparent">
        <Link
          href="/"
          className="font-mono text-[10px] md:text-xs tracking-[0.3em] text-white/70 hover:text-white transition"
        >
          VERTXIA
        </Link>
        <button
          onClick={copyLink}
          className="font-mono text-[9px] md:text-[10px] tracking-[0.3em] text-white/60 hover:text-white border border-white/20 hover:border-white/60 px-3 py-2 rounded transition"
        >
          {copied ? "✓ COPIÉ" : "COPIER LE LIEN"}
        </button>
      </nav>

      {/* Overlay haut — produit + shop */}
      <div className="fixed top-20 md:top-24 left-0 right-0 z-20 px-6 text-center pointer-events-none">
        <span className="font-mono text-[9px] md:text-[10px] tracking-[0.4em] text-emerald-400/80 block mb-2">
          ✓ DÉMO 3D LIVE
        </span>
        <h1 className="text-2xl md:text-4xl font-light tracking-tight mb-1">
          {vendor}
        </h1>
        {product && (
          <p className="text-white/50 font-mono text-[10px] md:text-xs tracking-widest">
            {product}
          </p>
        )}
      </div>

      {/* Hint drag/zoom */}
      <div className="fixed bottom-32 md:bottom-36 left-0 right-0 z-10 text-center pointer-events-none">
        <span className="font-mono text-[9px] tracking-[0.4em] text-white/30">
          DRAG · ZOOM · EXPLORE
        </span>
      </div>

      {/* Sticky bottom CTA banner */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black via-black/95 to-transparent pt-12 pb-5 md:pb-7 px-5 md:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 bg-white/5 border border-white/15 backdrop-blur-md rounded-xl p-4 md:p-5">
            {/* Texte gauche */}
            <div className="flex-1 text-center md:text-left">
              <p className="text-white text-sm md:text-base font-light leading-tight">
                Cette démo a été générée gratuitement par <span className="font-medium">Vertxia</span>.
              </p>
              <p className="text-white/50 text-xs md:text-sm mt-1">
                Active la version complète pour <span className="text-white/80">{shop || "ta boutique"}</span> sur ton domaine, avec tous tes produits.
              </p>
            </div>

            {/* CTA email */}
            <a
              href={mailtoUrl}
              className="w-full md:w-auto whitespace-nowrap px-6 py-3 bg-white text-black font-mono text-[10px] md:text-xs tracking-[0.3em] rounded-lg hover:bg-white/90 transition text-center"
            >
              ACTIVER MA BOUTIQUE →
            </a>
          </div>
        </div>
      </div>

      {/* OG image preload (au cas où la page est sociale) — fallback noir si pas d'image */}
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          aria-hidden="true"
          className="hidden"
        />
      )}
    </div>
  );
}
