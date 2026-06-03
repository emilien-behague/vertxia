"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection, InsetRow } from "@/components/mobile/inset-list";
import { listEquipements, type StoredEquipement } from "@/lib/equipement";

// Page intervention mobile — hub d'entrée vers le formulaire intervention.
// 2 chemins : (a) intervention sur équipement existant → /bsff?equipement=ID
//             (b) intervention libre → /bsff (form vierge)

const INTERVENTION_TYPES = [
  { v: "recuperation", label: "Récupération de fluide", desc: "+ BSFF officiel" },
  { v: "demantelement", label: "Démantèlement", desc: "+ BSFF officiel" },
  { v: "controle_periodique", label: "Contrôle d'étanchéité", desc: "Annuel · CERFA 15497*04" },
  { v: "controle_non_periodique", label: "Contrôle suite fuite", desc: "CERFA 15497*04" },
  { v: "mise_service", label: "Mise en service", desc: "Première mise en route" },
  { v: "maintenance", label: "Maintenance", desc: "Entretien préventif" },
];

export default function MobileInterventionPage() {
  const [equipements, setEquipements] = useState<StoredEquipement[]>([]);

  useEffect(() => {
    setEquipements(listEquipements().slice(0, 5));
  }, []);

  return (
    <>
      <MobileHeader title="Nouvelle intervention" largeTitle backHref="/m" />

      <div className="px-5 mt-1 mb-2">
        <p className="text-[13px] text-black/55 leading-relaxed">
          Sélectionnez un équipement de votre parc ou choisissez le type d&apos;intervention pour
          démarrer un formulaire vierge.
        </p>
      </div>

      {/* Scan QR shortcut */}
      <InsetListSection title="Méthode la plus rapide">
        <InsetRow
          href="/m/scan"
          leading={
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#A16207]/10 text-[#A16207]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="3" height="3" />
                <path d="M21 14h-3v3M18 21h3v-3" />
              </svg>
            </span>
          }
          label="Scanner le QR Code de l'équipement"
          sublabel="Ouvre la caméra · détection auto · fiche directe"
          showChevron
        />
      </InsetListSection>

      {/* Équipements récents */}
      {equipements.length > 0 && (
        <InsetListSection title="Équipements récents">
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
        title="Démarrer un formulaire vierge"
        footer="Si vous n'avez pas encore enregistré l'équipement, vous pourrez le saisir directement dans le formulaire."
      >
        {INTERVENTION_TYPES.map((t) => (
          <InsetRow
            key={t.v}
            href={`/m/intervention/nouvelle?type=${t.v}`}
            label={t.label}
            sublabel={t.desc}
            leading={
              <span
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                  t.v === "recuperation" || t.v === "demantelement"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
            }
            showChevron
          />
        ))}
      </InsetListSection>
    </>
  );
}
