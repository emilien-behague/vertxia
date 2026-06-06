"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/ui/mobile-header";
import { Tile, type TileVariant } from "@/components/mobile/ui/tile";
import { listEquipements, type StoredEquipement } from "@/lib/equipement/equipement";
import {
  countDocumentsForIntervention,
  type TypeIntervention,
} from "@/lib/cerfa/documents-officiels";

// Page intervention mobile — refonte 05/06/2026 style tuiles colorees.
// Hub d'entree vers le formulaire intervention. 2 chemins :
//  (a) intervention sur equipement existant (carte cliquable)
//  (b) choix du type d'intervention (8 tuiles colorees)

const INTERVENTION_TYPES: {
  v: TypeIntervention;
  label: string;
  emoji: string;
  variant: TileVariant;
}[] = [
  { v: "recuperation", emoji: "🧊", label: "Récupération", variant: "sky" },
  { v: "demantelement", emoji: "🔧", label: "Démantèlement", variant: "slate" },
  { v: "controle_periodique", emoji: "🔍", label: "Contrôle annuel", variant: "emerald" },
  { v: "controle_non_periodique", emoji: "🔎", label: "Contrôle réparation", variant: "teal" },
  { v: "mise_service", emoji: "⚡", label: "Mise en route", variant: "amber" },
  { v: "maintenance", emoji: "🛠️", label: "Entretien", variant: "indigo" },
  { v: "assemblage", emoji: "🔩", label: "Assemblage", variant: "bronze" },
  { v: "modification", emoji: "✏️", label: "Modification", variant: "rose" },
];

export default function MobileInterventionPage() {
  const [equipements, setEquipements] = useState<StoredEquipement[]>([]);

  useEffect(() => {
    setEquipements(listEquipements().slice(0, 5));
  }, []);

  return (
    <>
      <MobileHeader title="🛠️ Nouvelle intervention" largeTitle />

      <div className="px-5 mt-1 mb-3">
        <p className="text-[13px] text-black/60 leading-relaxed">
          Scanne, choisis un équipement ou démarre direct par le type de chantier.
        </p>
      </div>

      {/* Le plus rapide — tuile XL violet (cohérent avec home tuile SCANNER QR) */}
      <section className="px-4 mb-4">
        <Tile
          href="/m/scan"
          size="xl"
          variant="violet"
          emoji="📷"
          label="Scanner le QR"
          sublabel="Ouvre la caméra → la fiche apparaît"
        />
      </section>

      {/* Equipements recents — cartes compactes blanches avec accent bleu */}
      {equipements.length > 0 && (
        <section className="px-4 mb-5">
          <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-black/45 mb-2 px-1">
            🏭 Équipements récents
          </div>
          <div className="space-y-2">
            {equipements.map((eq) => (
              <Link
                key={eq.id}
                href={`/m/intervention/nouvelle?equipement=${eq.id}`}
                className="block rounded-2xl bg-white ring-1 ring-black/[0.05] px-4 py-3 active:bg-black/[0.02] transition-colors"
                style={{
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                  borderLeft: "4px solid #3b82f6",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold text-[#111] truncate">
                      {eq.modele}
                    </div>
                    <div className="text-[11.5px] text-black/55 truncate mt-0.5">
                      {eq.clientName} · {eq.fluide.code}
                    </div>
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Types intervention — grille 2x4 de tuiles colorees */}
      <section className="px-4 mb-4">
        <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-black/45 mb-2 px-1">
          ✨ Choisir le type de chantier
        </div>
        <div className="grid grid-cols-2 gap-3">
          {INTERVENTION_TYPES.map((t) => {
            const nbDocs = countDocumentsForIntervention(t.v);
            return (
              <Tile
                key={t.v}
                href={`/m/intervention/nouvelle?type=${t.v}`}
                variant={t.variant}
                emoji={t.emoji}
                label={t.label}
                sublabel={
                  nbDocs > 0
                    ? `${nbDocs} doc${nbDocs > 1 ? "s" : ""} officiel${nbDocs > 1 ? "s" : ""}`
                    : undefined
                }
              />
            );
          })}
        </div>
        <p className="mt-3 px-1 text-[11px] text-black/45 leading-snug">
          Pas d&apos;équipement enregistré ? Tu pourras le saisir dans le formulaire.
        </p>
      </section>
    </>
  );
}
