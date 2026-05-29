/**
 * Vertxia Studio — galerie 3D flottante + central command Lovable-style.
 *
 * La galerie 3D devient le DECOR vivant (creations qui flottent dans l'espace).
 * Au centre, le hero Lovable-style (badge + titre + prompt box) prend les commandes.
 * Pas de Command Bar bottom (le central remplace).
 */

import { FloatingGallery } from "@/components/app/floating-gallery";
import { CentralCommand } from "@/components/app/central-command";

export default function AppPage() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Ambient gradient diffus inspire Lovable mais subtil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 110%, rgba(79,125,255,0.18) 0%, rgba(138,92,255,0.09) 35%, transparent 65%), radial-gradient(ellipse 50% 30% at 30% -10%, rgba(138,92,255,0.10) 0%, transparent 60%)",
        }}
      />

      {/* Galerie 3D — decor vivant en arriere-plan */}
      <div className="absolute inset-0 z-10">
        <FloatingGallery />
      </div>

      {/* Hero central Lovable-style — overlay au-dessus de la galerie */}
      <CentralCommand />
    </div>
  );
}
