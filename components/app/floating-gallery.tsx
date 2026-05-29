"use client";

/**
 * FloatingGallery — galerie 3D des projets Vertxia (Apple Vision Pro style).
 *
 * 8 cartes-projets disposees organiquement dans l'espace 3D (pas de grille),
 * chacune avec une vraie preview image. Lentement floating + parallax mouse
 * subtle sur le group entier. Hover-reveal label + scale.
 *
 * Pas de scene cosmique, pas de particules, pas de nebuleuse.
 * Les CARTES SONT le contenu. Le decor c'est elles.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Image as DreiImage, Html } from "@react-three/drei";
import { useRouter } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import * as THREE from "three";
import { MOCK_PROJECTS, type MockProject } from "@/lib/mock-projects";

/** Plan plat (4:3 ratio default) textured avec une image projet. */
function ProjectCard3D({ project }: { project: MockProject }) {
  const router = useRouter();
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Anim hover : lerp position.z + scale
  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const targetZ = hovered ? project.position[2] + 0.7 : project.position[2];
    const targetScale = hovered ? 1.06 : 1;
    meshRef.current.position.z = THREE.MathUtils.lerp(
      meshRef.current.position.z,
      targetZ,
      delta * 6
    );
    meshRef.current.scale.x = THREE.MathUtils.lerp(
      meshRef.current.scale.x,
      targetScale,
      delta * 6
    );
    meshRef.current.scale.y = THREE.MathUtils.lerp(
      meshRef.current.scale.y,
      targetScale,
      delta * 6
    );
  });

  function onClick() {
    if (project.liveSlug) {
      router.push(`/lite/${project.liveSlug}`);
    }
    // Sinon V0.1 : pas de page projet → no-op
  }

  return (
    <Float
      speed={0.6 + (project.id.length % 4) * 0.12}
      rotationIntensity={0.15}
      floatIntensity={0.5}
      floatingRange={[-0.18, 0.18]}
    >
      <mesh
        ref={meshRef}
        position={project.position}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          if (typeof document !== "undefined") {
            document.body.style.cursor = "pointer";
          }
        }}
        onPointerOut={() => {
          setHovered(false);
          if (typeof document !== "undefined") {
            document.body.style.cursor = "default";
          }
        }}
        onClick={onClick}
      >
        <DreiImage
          url={project.imageUrl}
          scale={project.scale}
          transparent
          radius={0.08}
          toneMapped={false}
        />

        {/* Overlay label en HTML — visible en permanence (faible opacity) ou plus fort au hover */}
        <Html
          position={[0, -project.scale[1] / 2 - 0.18, 0.05]}
          center
          distanceFactor={6}
          zIndexRange={[100, 0]}
          style={{
            opacity: hovered ? 1 : 0.55,
            transition: "opacity 0.3s ease",
            pointerEvents: "none",
            transform: "translate(-50%, 0)",
          }}
        >
          <div
            className="whitespace-nowrap text-center"
            style={{
              fontFamily: "Inter, sans-serif",
              minWidth: "200px",
            }}
          >
            <p
              className="text-[10px] tracking-[0.18em] uppercase font-medium"
              style={{
                color: hovered ? "rgba(214, 185, 110, 1)" : "rgba(214, 185, 110, 0.6)",
              }}
            >
              {project.category}
            </p>
            <p
              className="text-white font-medium mt-0.5"
              style={{
                fontSize: hovered ? "13px" : "12px",
                transition: "font-size 0.3s ease",
              }}
            >
              {project.label}
            </p>
            {hovered && (
              <p
                className="text-[10.5px] text-white/55 mt-1"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {project.hint}
              </p>
            )}
          </div>
        </Html>
      </mesh>
    </Float>
  );
}

/** Group container avec parallax mouse subtle (rotation Y/X). */
function GalleryGroup() {
  const groupRef = useRef<THREE.Group>(null);
  const { mouse } = useThree();

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    // Lerp soft toward mouse-driven rotation
    const targetRY = mouse.x * 0.08;
    const targetRX = -mouse.y * 0.06;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRY,
      delta * 2
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetRX,
      delta * 2
    );
  });

  return (
    <group ref={groupRef}>
      {MOCK_PROJECTS.map((p) => (
        <ProjectCard3D key={p.id} project={p} />
      ))}
    </group>
  );
}

export function FloatingGallery() {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        {/* Lumieres minimales — drei Image utilise MeshBasicMaterial donc light = decoratif */}
        <ambientLight intensity={0.5} />

        <Suspense fallback={null}>
          <GalleryGroup />
        </Suspense>
      </Canvas>
    </div>
  );
}
