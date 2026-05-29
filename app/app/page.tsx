/**
 * Vertxia Studio — workspace principal (route /app).
 * Refonte 2026-05-29 : remplace l'ancien dashboard Lovable-style.
 *
 * Workspace = EmptyStateCanvas (scene elegante en bg) + CommandSurface centree.
 * Pas de R3F lourd ici. Le cosmic portal R3F est declenche au click Create.
 */

import { EmptyStateCanvas } from "@/components/app/empty-state-canvas";
import { NoiseOverlay } from "@/components/app/noise-overlay";
import { CommandSurface } from "@/components/app/command-surface";

export default function AppPage() {
  return (
    <>
      <EmptyStateCanvas />
      <NoiseOverlay />
      <div className="absolute inset-0 flex items-center justify-center">
        <CommandSurface />
      </div>
    </>
  );
}
