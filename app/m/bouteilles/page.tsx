"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection } from "@/components/mobile/inset-list";
import {
  listBouteilles,
  indexMouvementsParBouteille,
} from "@/lib/bouteille-storage";
import {
  computeChargeActuelle,
  computePctRemplissage,
  computeNiveauAlerte,
  colorAlerte,
  labelAlerte,
  type Bouteille,
} from "@/lib/bouteille";

type BouteilleWithStock = {
  bouteille: Bouteille;
  chargeActuelle: number;
  pct: number;
  niveau: ReturnType<typeof computeNiveauAlerte>;
};

export default function MobileBouteillesPage() {
  const [items, setItems] = useState<BouteilleWithStock[]>([]);

  useEffect(() => {
    const bouteilles = listBouteilles();
    const mouvementsIdx = indexMouvementsParBouteille();
    const enriched = bouteilles.map((b) => {
      const mvs = mouvementsIdx.get(b.id) ?? [];
      const chargeActuelle = computeChargeActuelle(b, mvs);
      const pct = computePctRemplissage(b, chargeActuelle);
      return {
        bouteille: b,
        chargeActuelle,
        pct,
        niveau: computeNiveauAlerte(pct),
      };
    });
    setItems(enriched);
  }, []);

  const recharge = useMemo(
    () => items.filter((x) => x.bouteille.type === "recharge" && x.bouteille.statut === "active"),
    [items]
  );
  const recuperation = useMemo(
    () => items.filter((x) => x.bouteille.type === "recuperation" && x.bouteille.statut === "active"),
    [items]
  );
  const archived = useMemo(() => items.filter((x) => x.bouteille.statut !== "active"), [items]);

  return (
    <>
      <MobileHeader title="Bouteilles" largeTitle backHref="/m" />

      {items.length === 0 && (
        <div className="px-5 mt-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-black/[0.04] mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-black/35">
              <path d="M8 2v6a4 4 0 0 0 8 0V2" />
              <path d="M6 8h12v12a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" />
            </svg>
          </div>
          <h2 className="text-[18px] font-semibold mb-2">Aucune bouteille enregistrée</h2>
          <p className="text-[13px] text-black/55 leading-relaxed max-w-xs mx-auto mb-6">
            Enregistre tes bouteilles de recharge (R-32, R-410A…) et tes bouteilles de récupération pour suivre tes mouvements de fluide et générer ton registre conforme.
          </p>
          <Link
            href="/m/bouteilles/nouvelle"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-[#111] text-white text-[14px] font-medium active:bg-black/90 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            + Ajouter ma première bouteille
          </Link>
        </div>
      )}

      {recharge.length > 0 && (
        <InsetListSection
          title="Recharge"
          footer={`${recharge.length} bouteille${recharge.length > 1 ? "s" : ""} de fluide neuf, recyclé ou régénéré pour charger les équipements clients.`}
        >
          {recharge.map((item) => (
            <BouteilleRow key={item.bouteille.id} item={item} />
          ))}
        </InsetListSection>
      )}

      {recuperation.length > 0 && (
        <InsetListSection
          title="Récupération"
          footer={`${recuperation.length} bouteille${recuperation.length > 1 ? "s" : ""} pour récupérer le fluide depuis les équipements clients avant intervention. Seuil sécurité 80 % de la capacité.`}
        >
          {recuperation.map((item) => (
            <BouteilleRow key={item.bouteille.id} item={item} />
          ))}
        </InsetListSection>
      )}

      {archived.length > 0 && (
        <InsetListSection title="En transit / archivées">
          {archived.map((item) => (
            <BouteilleRow key={item.bouteille.id} item={item} />
          ))}
        </InsetListSection>
      )}

      <div className="px-4 mt-6 mb-8">
        <Link
          href="/m/registre"
          className="block w-full px-6 py-4 rounded-2xl bg-white border border-[#111] text-[#111] text-[15px] font-medium text-center active:bg-black/[0.03] transition-colors"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          📋 Générer le registre des mouvements (PDF)
        </Link>
        <div className="mt-2 text-[11px] text-black/45 text-center leading-relaxed">
          PDF chronologique conforme attestation de capacité F-Gas pour audit.
        </div>
      </div>
    </>
  );
}

function BouteilleRow({ item }: { item: BouteilleWithStock }) {
  const { bouteille, chargeActuelle, pct, niveau } = item;
  const colors = colorAlerte(niveau);
  const pctDisplay = Math.min(100, Math.max(0, pct));

  return (
    <Link
      href={`/m/bouteilles/${bouteille.id}`}
      className="block px-4 py-3 active:bg-black/[0.03] transition-colors"
      style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[15px] font-medium text-[#111] truncate">
              {bouteille.fluide?.code ?? "Mélangé"}
            </span>
            <span className="text-[11px] font-mono text-black/40">
              #{bouteille.numeroSerie}
            </span>
          </div>
          <div className="text-[12px] text-black/55 mb-2">
            {chargeActuelle.toFixed(2)} kg / {bouteille.capaciteMaxKg.toFixed(2)} kg
            {bouteille.compatibleInflammable && (
              <span className="ml-2 text-[10px] font-mono uppercase tracking-wider text-orange-700">
                Inflammable
              </span>
            )}
          </div>
          {/* Gauge */}
          <div className="relative w-full h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 ${colors.barFill} transition-all`}
              style={{ width: `${pctDisplay}%` }}
            />
            {bouteille.type === "recuperation" && (
              <div
                className="absolute inset-y-0 w-0.5 bg-red-600"
                style={{ left: "80%" }}
                aria-label="Seuil sécurité 80 %"
              />
            )}
          </div>
        </div>
        <span
          className={`shrink-0 px-2 py-1 rounded-md text-[10px] font-mono uppercase tracking-widest ${colors.bg} ring-1 ${colors.ring} ${colors.text}`}
        >
          {pct.toFixed(0)}% · {labelAlerte(niveau)}
        </span>
      </div>
    </Link>
  );
}
