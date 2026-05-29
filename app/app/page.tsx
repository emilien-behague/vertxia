/**
 * Vertxia Studio — workspace principal (route /app).
 * Refonte v2 (2026-05-29) : showcase magazine au centre, Command Bar Raycast en bas.
 *
 * Plus de grille perspective, plus de particules cosmiques, plus de gros titre centre,
 * plus de Command Surface centrale. Le centre est plein de previews magazine, le
 * prompt devient secondaire (Command Bar bottom Raycast-style).
 */

import { ShowcaseBento } from "@/components/app/showcase-bento";
import { CommandBar } from "@/components/app/command-bar";

export default function AppPage() {
  return (
    <div className="relative h-screen overflow-y-auto">
      {/* Ambient gradient ultra subtil — pas une scene, juste un wash */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(79,125,255,0.05) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(138,92,255,0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10">
        <ShowcaseBento />
      </div>

      <CommandBar />
    </div>
  );
}
