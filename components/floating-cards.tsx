"use client";

/**
 * FloatingCards — gallery 3D "walkable portfolio" Active Theory-style.
 *
 * Affiche N plans flottants positionnés dans l espace (z négatif, derrière le
 * mesh principal). Chaque plan a une texture canvas générée procéduralement
 * avec titre + sous-titre + accent border.
 *
 * Le camera fly-through (cf. CAMERA_CURVE dans demo-view) plonge dans cette
 * zone en fin de scroll — l utilisateur découvre soudain qu il y a tout un
 * "univers" autour du produit qu il vient de voir. C est le moment WOW final
 * avant le CTA.
 *
 * Animation : drift vertical sin/cos + légère rotation pour effet flottant.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type Card = {
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number];
  title: string;
  subtitle?: string;
  accent?: string;
};

function makeCardTexture(card: Card): THREE.CanvasTexture {
  const aspect = card.size[1] / card.size[0];
  const W = 1024;
  const H = Math.round(W * aspect);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Background gradient sombre profond
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#13091e");
  bg.addColorStop(1, "#080510");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Border accent
  if (card.accent) {
    ctx.strokeStyle = card.accent;
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 18, W - 36, H - 36);

    // Inner subtle glow rect
    ctx.strokeStyle = `${card.accent}33`;
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, W - 80, H - 80);
  }

  // Top label mono
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "300 28px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("VERTXIA · PAGE", 60, 60);

  // Title centered
  ctx.fillStyle = "#ffffff";
  ctx.font = "300 110px 'Inter', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(card.title, W / 2, H / 2 - 40);

  // Subtitle below
  if (card.subtitle) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "300 36px monospace";
    ctx.fillText(card.subtitle, W / 2, H / 2 + 60);
  }

  // Bottom right corner mark
  ctx.fillStyle = card.accent || "rgba(255,255,255,0.5)";
  ctx.font = "300 24px monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("→", W - 60, H - 60);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.anisotropy = 8;
  return tex;
}

const DEFAULT_DEMO_CARDS: Card[] = [
  {
    position: [-3.8, 0.5, -10],
    rotation: [0, 0.25, 0],
    size: [2.3, 3.0],
    title: "HOME",
    subtitle: "tonshop.com",
    accent: "#a855f7",
  },
  {
    position: [3.8, 0.8, -10.5],
    rotation: [0, -0.25, 0],
    size: [2.3, 3.0],
    title: "PRODUITS",
    subtitle: "12 ITEMS",
    accent: "#22d3ee",
  },
  {
    position: [-3.2, -0.8, -13.5],
    rotation: [0, 0.2, 0],
    size: [2.0, 2.6],
    title: "CHECKOUT",
    subtitle: "3D · STRIPE",
    accent: "#fbbf24",
  },
  {
    position: [3.2, -0.8, -13.5],
    rotation: [0, -0.2, 0],
    size: [2.0, 2.6],
    title: "À PROPOS",
    subtitle: "TON UNIVERS",
    accent: "#fb923c",
  },
  {
    position: [0, 1.8, -16.5],
    rotation: [0, 0, 0],
    size: [3.2, 2.0],
    title: "TON DOMAINE",
    subtitle: "EMAILS · DNS · SEO",
    accent: "#ffffff",
  },
];

export function FloatingCards({
  cards = DEFAULT_DEMO_CARDS,
}: {
  cards?: Card[];
}) {
  const groupRef = useRef<THREE.Group>(null);

  const cardData = useMemo(() => {
    return cards.map((card) => ({
      card,
      texture: makeCardTexture(card),
      phase: Math.random() * Math.PI * 2,
    }));
  }, [cards]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const d = cardData[i];
      if (!d) return;
      // Drift vertical + sway rotation
      child.position.y = d.card.position[1] + Math.sin(t * 0.4 + d.phase) * 0.15;
      const baseRot = d.card.rotation?.[1] ?? 0;
      child.rotation.y = baseRot + Math.sin(t * 0.2 + d.phase) * 0.04;
    });
  });

  return (
    <group ref={groupRef}>
      {cardData.map(({ card, texture }, i) => (
        <mesh
          key={i}
          position={card.position}
          rotation={card.rotation ?? [0, 0, 0]}
        >
          <planeGeometry args={card.size} />
          <meshBasicMaterial
            map={texture}
            transparent
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
