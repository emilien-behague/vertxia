"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection, InsetRow } from "@/components/mobile/inset-list";
import { listEquipements, type StoredEquipement } from "@/lib/equipement";
import {
  countDocumentsForIntervention,
  type TypeIntervention,
} from "@/lib/documents-officiels";

// Page intervention mobile — hub d'entrée vers le formulaire intervention.
// 2 chemins : (a) intervention sur équipement existant → /bsff?equipement=ID
//             (b) intervention libre → /bsff (form vierge)

const INTERVENTION_TYPES: { v: TypeIntervention; label: string; desc: string; emoji: string }[] = [
  { v: "recuperation", emoji: "🧊", label: "Récupération de gaz", desc: "Je vide la machine de son fluide" },
  { v: "demantelement", emoji: "🔧", label: "Démantèlement", desc: "Je démonte une installation" },
  { v: "controle_periodique", emoji: "🔍", label: "Contrôle anti-fuite", desc: "Le contrôle annuel obligatoire" },
  { v: "controle_non_periodique", emoji: "🔎", label: "Contrôle après réparation", desc: "Vérification suite à une fuite" },
  { v: "mise_service", emoji: "⚡", label: "Mise en route", desc: "Je démarre une installation neuve" },
  { v: "maintenance", emoji: "🛠️", label: "Entretien", desc: "Maintenance préventive" },
  { v: "assemblage", emoji: "🔩", label: "Assemblage", desc: "Je monte une installation" },
  { v: "modification", emoji: "✏️", label: "Modification", desc: "Je modifie une installation existante" },
];

export default function MobileInterventionPage() {
  const [equipements, setEquipements] = useState<StoredEquipement[]>([]);

  useEffect(() => {
    setEquipements(listEquipements().slice(0, 5));
  }, []);

  return (
    <>
      <MobileHeader title="Nouvelle intervention" largeTitle />

      <div className="px-5 mt-1 mb-2">
        <p className="text-[13px] text-black/55 leading-relaxed">
          Choisis l&apos;équipement sur lequel tu interviens, ou démarre un chantier neuf.
        </p>
      </div>

      {/* Scan QR shortcut */}
      <InsetListSection title="🚀 Le plus rapide">
        <InsetRow
          href="/m/scan"
          leading={
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-[#A16207]/10 text-[22px] leading-none">
              📷
            </span>
          }
          label="Scanner le QR Code"
          sublabel="Ouvre la caméra → la fiche apparaît"
          showChevron
        />
      </InsetListSection>

      {/* Équipements récents */}
      {equipements.length > 0 && (
        <InsetListSection title="🏭 Tes équipements récents">
          {equipements.map((eq) => (
            <InsetRow
              key={eq.id}
              href={`/m/intervention/nouvelle?equipement=${eq.id}`}
              label={eq.modele}
              sublabel={`${eq.clientName} · ${eq.fluide.code}`}
              leading={
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              }
              showChevron
            />
          ))}
        </InsetListSection>
      )}

      {/* Types d'intervention */}
      <InsetListSection
        title="✨ Choisis le type de chantier"
        footer="L'équipement n'est pas encore enregistré ? Pas grave — tu pourras le saisir dans le formulaire."
      >
        {INTERVENTION_TYPES.map((t) => {
          const nbDocs = countDocumentsForIntervention(t.v);
          const sublabel =
            nbDocs > 0
              ? `${t.desc} · 📄 ${nbDocs} doc${nbDocs > 1 ? "s" : ""} officiel${nbDocs > 1 ? "s" : ""}`
              : t.desc;
          return (
            <InsetRow
              key={t.v}
              href={`/m/intervention/nouvelle?type=${t.v}`}
              label={t.label}
              sublabel={sublabel}
              leading={
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-black/[0.04] text-[22px] leading-none">
                  {t.emoji}
                </span>
              }
              showChevron
            />
          );
        })}
      </InsetListSection>
    </>
  );
}
