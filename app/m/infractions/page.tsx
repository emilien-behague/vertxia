"use client";

// Page Infractions réglementaires F-Gas — Rank 2 du brainstorm features.
// Activation par bandeau rouge sur dashboard /m si infractions > 0.
//
// Affiche la liste des équipements en non-conformité avec le règlement UE
// 2024/573, classée par sévérité, avec pour chacun la raison + l'action
// recommandée + lien direct vers la fiche pour agir.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection } from "@/components/mobile/inset-list";
import {
  listEquipements,
  computeAllStatus,
  getInfractions,
  type Infraction,
  type InfractionSeverite,
} from "@/lib/equipement";
import { listInterventions } from "@/lib/intervention-storage";

const SEVERITE_STYLES: Record<
  InfractionSeverite,
  { dot: string; chip: string; label: string }
> = {
  critique: {
    dot: "bg-red-600",
    chip: "bg-red-50 text-red-700 ring-red-200",
    label: "Critique",
  },
  haute: {
    dot: "bg-orange-500",
    chip: "bg-orange-50 text-orange-700 ring-orange-200",
    label: "Haute",
  },
  moyenne: {
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 ring-amber-200",
    label: "Moyenne",
  },
};

export default function InfractionsPage() {
  const [infractions, setInfractions] = useState<Infraction[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const ints = listInterventions();
    const eqs = computeAllStatus(listEquipements(), ints);
    setInfractions(getInfractions(eqs));
    setLoaded(true);
  }, []);

  const stats = useMemo(() => {
    return {
      critique: infractions.filter((i) => i.severite === "critique").length,
      haute: infractions.filter((i) => i.severite === "haute").length,
      moyenne: infractions.filter((i) => i.severite === "moyenne").length,
    };
  }, [infractions]);

  return (
    <>
      <MobileHeader title="Infractions" largeTitle backHref="/m" />

      {/* Bandeau d'alerte dramatique */}
      {infractions.length > 0 && (
        <section className="mx-4 mt-2 mb-4 rounded-2xl bg-red-50 border border-red-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-semibold text-red-900 leading-tight">
                {infractions.length} équipement{infractions.length > 1 ? "s" : ""} en infraction réglementaire
              </div>
              <div className="text-[12.5px] text-red-800/85 mt-1 leading-snug">
                Non-conformité au règlement UE 2024/573. La responsabilité pénale du détenteur ET du technicien est engagée. Sanctions possibles : amende administrative et pénale, suspension d&apos;activité.
              </div>
              <div className="text-[11px] text-red-700/70 mt-2 leading-snug">
                Référence : Code de l&apos;environnement, art. L173-1 et L173-12.
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Compteurs par sévérité */}
      {infractions.length > 0 && (
        <section className="px-4 mb-2">
          <div className="grid grid-cols-3 gap-2.5">
            <SeveriteCard
              label="Critique"
              value={stats.critique}
              color="text-red-600"
              sub="> 6 mois retard"
            />
            <SeveriteCard
              label="Haute"
              value={stats.haute}
              color="text-orange-600"
              sub="< 6 mois retard"
            />
            <SeveriteCard
              label="Moyenne"
              value={stats.moyenne}
              color="text-amber-600"
              sub="< 3 mois retard"
            />
          </div>
        </section>
      )}

      {/* Liste des équipements en infraction */}
      {infractions.length > 0 && (
        <InsetListSection
          title="Équipements concernés"
          footer="Tap sur un équipement pour ouvrir sa fiche et programmer le contrôle."
        >
          {infractions.map((inf) => {
            const style = SEVERITE_STYLES[inf.severite];
            return (
              <Link
                key={inf.equipement.id}
                href={`/eq/${inf.equipement.id}`}
                className="block px-4 py-3 active:bg-black/[0.03] transition-colors"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`shrink-0 w-2.5 h-2.5 rounded-full mt-1.5 ${style.dot}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[15px] font-medium text-[#111] truncate">
                        {inf.equipement.modele}
                      </span>
                      <span
                        className={`shrink-0 text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ring-1 ${style.chip}`}
                      >
                        {style.label}
                      </span>
                    </div>
                    <div className="text-[12px] text-black/60 mb-1.5 leading-snug">
                      {inf.equipement.clientName}
                      {inf.equipement.siteAdresse && ` · ${inf.equipement.siteAdresse}`}
                    </div>
                    <div className="text-[12.5px] text-[#111] font-medium leading-snug">
                      {inf.raison}
                    </div>
                    <div className="text-[11.5px] text-black/65 mt-1 leading-snug">
                      → {inf.actionRecommandee}
                    </div>
                    <div className="text-[10px] text-black/40 mt-1 font-mono uppercase tracking-wider">
                      {inf.articleRef}
                    </div>
                  </div>
                  <svg className="shrink-0 mt-1 text-black/25" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </InsetListSection>
      )}

      {/* État zéro infraction */}
      {loaded && infractions.length === 0 && (
        <section className="px-5 mt-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4 text-emerald-600">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 className="text-[18px] font-semibold mb-2 text-[#111]">
            Aucune infraction détectée
          </h2>
          <p className="text-[14px] text-black/55 leading-relaxed max-w-xs mx-auto">
            Tous tes équipements sont à jour réglementairement. Tu protèges tes clients de toute sanction DREAL.
          </p>
          <Link
            href="/m/equipements"
            className="inline-block mt-6 px-5 py-2.5 rounded-2xl bg-[#111] text-white text-[13px] font-medium active:bg-black/80 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Voir tous mes équipements
          </Link>
        </section>
      )}

      {/* Réglementation référence */}
      {loaded && (
        <section className="mx-4 mt-6 mb-2 px-4 py-3 rounded-2xl bg-black/[0.03] border border-black/[0.06]">
          <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1.5">
            Cadre réglementaire
          </div>
          <ul className="text-[11.5px] text-black/65 space-y-1 leading-snug">
            <li>• <strong>Règlement UE 2024/573</strong> (mars 2024, remplace 517/2014) — contrôles d&apos;étanchéité périodiques obligatoires selon tCO2eq</li>
            <li>• <strong>Décret n° 2015-1790</strong> (transposition FR) + <strong>arrêté du 29 février 2016</strong> (registre)</li>
            <li>• <strong>Code de l&apos;environnement, art. L173-12</strong> — sanctions pénales en cas de non-respect</li>
            <li>• Contrôleur DREAL peut intervenir sans préavis</li>
          </ul>
        </section>
      )}
    </>
  );
}

type SeveriteCardProps = {
  label: string;
  value: number;
  color: string;
  sub: string;
};

function SeveriteCard({ label, value, color, sub }: SeveriteCardProps) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-black/[0.04] px-3 py-2.5 text-center">
      <div className={`text-[24px] font-semibold ${color} leading-none`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-black/55 font-medium mt-1">
        {label}
      </div>
      <div className="text-[10px] text-black/40 mt-0.5">{sub}</div>
    </div>
  );
}
