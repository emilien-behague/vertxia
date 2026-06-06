"use client";

// Carte affichee sur la fiche bouteille [id] indiquant ou et comment
// deposer la bouteille pleine chez un distributeur agree.
//
// Affichage automatique quand la bouteille de RECUPERATION atteint
// le seuil rouge (>= 80% capacite max). Aussi affichable manuellement
// pour preparer une cession.
//
// Strategie matching distributeur : voir lib/reprise-bouteille.ts.
// Le distributeur d'origine (fournisseur Climalife / Gazechim / etc.)
// est propose en premier (relation commerciale + bouteille consignee).

import { useMemo, useState } from "react";
import { loadProfil } from "@/lib/profil";
import type { Bouteille } from "@/lib/equipement/bouteille";
import {
  getDistributeursReprise,
  estimerFraisReprise,
  calculerFraisReprise,
  genererMailtoReprise,
  labelVoieRepriseCourt,
} from "@/lib/equipement/reprise-bouteille";

type Props = {
  bouteille: Bouteille;
  chargeActuelleKg: number;
  pourcentageRemplissage: number;
  /** Si true, la card est expansee par defaut (cas bouteille pleine rouge) */
  expandedDefault?: boolean;
};

export function BouteilleRepriseCard({
  bouteille,
  chargeActuelleKg,
  pourcentageRemplissage,
  expandedDefault = false,
}: Props) {
  const [expanded, setExpanded] = useState(expandedDefault);

  // Ne s'affiche que pour les bouteilles de RECUPERATION
  // (les bouteilles recharge se retournent au fournisseur, mais pas
  // dans le meme workflow BSFF).
  if (bouteille.type !== "recuperation") return null;

  const distributeurs = useMemo(() => getDistributeursReprise(bouteille), [bouteille]);
  const estimation = useMemo(
    () => estimerFraisReprise(bouteille.fluide?.code, bouteille.fluideMix),
    [bouteille]
  );
  const fraisTotal = useMemo(
    () => calculerFraisReprise(estimation, chargeActuelleKg),
    [estimation, chargeActuelleKg]
  );

  const profil = typeof window !== "undefined" ? loadProfil() : null;
  const nomFrigoriste = profil?.raisonSociale || undefined;

  const couleurUrgence = pourcentageRemplissage >= 80 ? "rouge" : pourcentageRemplissage >= 70 ? "orange" : "neutre";

  return (
    <div
      className={`mx-4 mt-2 mb-1 rounded-2xl overflow-hidden ring-1 ${
        couleurUrgence === "rouge"
          ? "bg-red-50/60 ring-red-200"
          : couleurUrgence === "orange"
            ? "bg-amber-50/60 ring-amber-200"
            : "bg-white ring-black/[0.05]"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-4 py-3 active:bg-black/[0.04] transition-colors"
        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
      >
        <span
          className={`inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${
            couleurUrgence === "rouge"
              ? "bg-red-100"
              : couleurUrgence === "orange"
                ? "bg-amber-100"
                : "bg-[#A16207]/10"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={couleurUrgence === "rouge" ? "#b91c1c" : couleurUrgence === "orange" ? "#b45309" : "#A16207"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7h18l-2 14H5z" />
            <path d="M8 3h8v4H8z" />
          </svg>
        </span>
        <span className="flex-1 text-left min-w-0">
          <span className={`block text-[13.5px] font-semibold leading-tight ${
            couleurUrgence === "rouge" ? "text-red-900" : couleurUrgence === "orange" ? "text-amber-900" : "text-[#111]"
          }`}>
            {couleurUrgence === "rouge"
              ? "Bouteille pleine → à déposer maintenant"
              : couleurUrgence === "orange"
                ? "Bouteille proche du seuil — préparer la reprise"
                : "Module reprise bouteille"}
          </span>
          <span className={`block text-[11.5px] leading-snug mt-0.5 ${
            couleurUrgence === "rouge" ? "text-red-800" : couleurUrgence === "orange" ? "text-amber-800" : "text-black/55"
          }`}>
            {distributeurs.length} distributeur{distributeurs.length > 1 ? "s" : ""} agréé{distributeurs.length > 1 ? "s" : ""} · {labelVoieRepriseCourt(estimation.voieReprise)}
          </span>
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(0,0,0,0.4)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-black/[0.05] divide-y divide-black/[0.04]">
          {/* Resume contexte + estimation frais */}
          <div className="px-4 py-3 bg-white/60 space-y-2">
            <Row label="Quantité à reprendre" value={`${chargeActuelleKg.toFixed(3)} kg`} />
            <Row label="Fluide" value={bouteille.fluideMix ? "Mélange déchet (à trier)" : bouteille.fluide?.code || "Non identifié"} />
            <Row label="Filière obligatoire" value={labelVoieRepriseCourt(estimation.voieReprise)} />
            <Row
              label="Frais estimés"
              value={
                fraisTotal.totalMin === 0 && fraisTotal.totalMax === 0
                  ? "Souvent gratuit (relation distributeur)"
                  : fraisTotal.totalMin === fraisTotal.totalMax
                    ? `${fraisTotal.totalMin.toFixed(2)} € HT`
                    : `${fraisTotal.totalMin.toFixed(2)} - ${fraisTotal.totalMax.toFixed(2)} € HT`
              }
            />
            <div className="text-[10.5px] text-black/45 leading-snug pt-1">
              {estimation.motif}
            </div>
          </div>

          {/* Liste distributeurs */}
          <div className="px-3 py-2 bg-black/[0.02]">
            <div className="text-[10px] font-mono tracking-widest uppercase text-black/45 px-1 mb-1">
              Distributeurs agréés ({distributeurs.length})
            </div>
            <div className="space-y-1.5">
              {distributeurs.map((distrib, idx) => {
                const mailto = genererMailtoReprise({
                  distributeur: distrib,
                  bouteille,
                  chargeActuelleKg,
                  estimation,
                  nomFrigoriste,
                });
                const estPrioritaire = idx === 0;
                return (
                  <div
                    key={distrib.id}
                    className={`rounded-xl px-3 py-2.5 ${
                      estPrioritaire
                        ? "bg-[#A16207]/8 ring-1 ring-[#A16207]/15"
                        : "bg-white ring-1 ring-black/[0.04]"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="text-[13px] font-semibold text-[#111] leading-tight">
                            {distrib.nom}
                          </div>
                          {estPrioritaire && (
                            <span className="text-[9px] font-mono tracking-wider text-[#A16207] bg-[#A16207]/15 px-1.5 py-0.5 rounded">
                              ★ RECOMMANDÉ
                            </span>
                          )}
                          {distrib.urlConfirmee && (
                            <span className="text-[9px] font-mono tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              VÉRIFIÉ
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-black/55 leading-snug mt-0.5 line-clamp-2">
                          {distrib.specialite}
                        </div>
                        <div className="mt-1 text-[10px] font-mono tracking-wider text-black/40">
                          {distrib.zonesLivraisonFr} · Reprise {distrib.delaiLivraisonJoursEstimes.min}-{distrib.delaiLivraisonJoursEstimes.max}j
                        </div>
                        {distrib.urlOfficielle && (
                          <a
                            href={distrib.urlOfficielle}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-1 text-[10.5px] text-[#A16207] active:opacity-60"
                            style={{ WebkitTapHighlightColor: "transparent" }}
                          >
                            {distrib.urlOfficielle
                              .replace(/^https?:\/\//, "")
                              .replace(/\/$/, "")
                              .split("/")[0]}{" "}
                            ↗
                          </a>
                        )}
                      </div>
                    </div>
                    <a
                      href={mailto}
                      className="block w-full mt-2 px-3 py-2 rounded-lg bg-[#111] text-white text-[12px] font-medium text-center active:opacity-90 transition-opacity"
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      Demander la reprise →
                    </a>
                  </div>
                );
              })}
            </div>
            <div className="text-[9.5px] text-black/40 leading-snug px-1 pt-2 text-center">
              Email pré-rempli (n° série, fluide, quantité, filière)
              <br />
              Vertxia en CC pour suivre la cession + BSFF officiel à émettre côté Vertxia
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <div className="text-[10.5px] font-mono tracking-wider uppercase text-black/45 shrink-0 min-w-[110px]">
        {label}
      </div>
      <div className="text-[12.5px] text-[#111] flex-1 text-right tabular-nums">{value}</div>
    </div>
  );
}
