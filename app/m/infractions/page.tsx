"use client";

// Page Infractions réglementaires F-Gas — Rank 2 du brainstorm features.
// Activation par bandeau rouge sur dashboard /m si infractions > 0.
//
// Affiche la liste des équipements en non-conformité avec le règlement UE
// 2024/573, classée par sévérité, avec pour chacun la raison + l'action
// recommandée + lien direct vers la fiche pour agir.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/ui/mobile-header";
import { Tile } from "@/components/mobile/ui/tile";
import {
  listEquipements,
  computeAllStatus,
  getInfractions,
  type Infraction,
  type InfractionSeverite,
} from "@/lib/equipement/equipement";
import { listInterventions } from "@/lib/intervention/intervention-storage";

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
      <MobileHeader title="⚠️ Infractions" largeTitle backHref="/m" />

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

      {/* Cards equipements en infraction — bordure gauche couleur severite */}
      {infractions.length > 0 && (
        <section className="px-4 mt-3">
          <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-black/45 mb-2 px-1">
            🚨 Équipements concernés
          </div>
          <div className="space-y-2.5">
            {infractions.map((inf) => {
              const accentColor =
                inf.severite === "critique"
                  ? "#dc2626"
                  : inf.severite === "haute"
                    ? "#ea580c"
                    : "#d97706";
              const accentBg =
                inf.severite === "critique"
                  ? "#fef2f2"
                  : inf.severite === "haute"
                    ? "#fff7ed"
                    : "#fffbeb";
              return (
                <Link
                  key={inf.equipement.id}
                  href={`/eq/${inf.equipement.id}`}
                  className="block rounded-2xl bg-white ring-1 ring-black/[0.05] px-4 py-3 active:bg-black/[0.02] transition-colors"
                  style={{
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "manipulation",
                    borderLeft: `5px solid ${accentColor}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <span
                      className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded uppercase"
                      style={{ background: accentBg, color: accentColor }}
                    >
                      {SEVERITE_STYLES[inf.severite].label}
                    </span>
                    <svg
                      width="14"
                      height="14"
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
                  <div className="text-[15.5px] font-bold text-[#111] leading-tight truncate">
                    {inf.equipement.modele}
                  </div>
                  <div className="text-[12px] text-black/60 mt-0.5 truncate">
                    {inf.equipement.clientName}
                    {inf.equipement.siteAdresse && ` · ${inf.equipement.siteAdresse}`}
                  </div>
                  <div className="text-[12.5px] text-[#111] font-medium leading-snug mt-2">
                    {inf.raison}
                  </div>
                  <div className="text-[11.5px] text-black/65 mt-1 leading-snug">
                    → {inf.actionRecommandee}
                  </div>
                  <div className="text-[9.5px] text-black/40 mt-2 font-mono uppercase tracking-wider">
                    {inf.articleRef}
                  </div>
                </Link>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-[11px] text-black/45 leading-snug">
            Tap sur un équipement pour ouvrir sa fiche et programmer le contrôle.
          </p>
        </section>
      )}

      {/* Zero infraction — tuile emerald felicitations */}
      {loaded && infractions.length === 0 && (
        <section className="px-4 mt-6 mb-4">
          <div className="text-center mb-5">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-[20px] font-bold mb-2 text-[#111]">
              Tout est en règle !
            </h2>
            <p className="text-[13px] text-black/60 leading-relaxed max-w-xs mx-auto">
              Tous tes équipements sont à jour réglementairement. Tu protèges tes clients de toute sanction DREAL.
            </p>
          </div>
          <Tile
            href="/m/equipements"
            size="xl"
            variant="emerald"
            emoji="🏭"
            label="Voir mon parc"
            sublabel="Tous mes équipements à jour"
          />
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
