"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/ui/mobile-header";
import { Tile } from "@/components/mobile/ui/tile";
import {
  listBouteilles,
  indexMouvementsParBouteille,
} from "@/lib/equipement/bouteille-storage";
import {
  computeChargeActuelle,
  computePctRemplissage,
  computeNiveauAlerte,
  colorAlerte,
  labelAlerte,
  type Bouteille,
} from "@/lib/equipement/bouteille";

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
      <MobileHeader title="🛢️ Mes bouteilles" largeTitle backHref="/m" />

      {items.length === 0 ? (
        <div className="px-5 mt-6">
          <div className="text-center mb-5">
            <div className="text-5xl mb-3">🛢️</div>
            <h2 className="text-[18px] font-bold mb-2">Aucune bouteille enregistrée</h2>
            <p className="text-[12.5px] text-black/55 leading-relaxed max-w-xs mx-auto">
              Recharge et récupération — pour suivre tes mouvements de fluide et générer ton registre conforme.
            </p>
          </div>
          <Tile
            href="/m/bouteilles/nouvelle"
            size="xl"
            variant="emerald"
            emoji="➕"
            label="Ajouter ma première bouteille"
            sublabel="Recharge ou récupération"
          />
        </div>
      ) : (
        <>
          {recharge.length > 0 && (
            <Section
              title={`📥 RECHARGE · ${recharge.length}`}
              footer="Fluide neuf, recyclé ou régénéré pour charger les équipements clients."
            >
              {recharge.map((item) => (
                <BouteilleCard key={item.bouteille.id} item={item} />
              ))}
            </Section>
          )}

          {recuperation.length > 0 && (
            <Section
              title={`📤 RÉCUPÉRATION · ${recuperation.length}`}
              footer="Bouteilles pour récupérer le fluide depuis les équipements clients. Seuil sécurité 80 % de la capacité."
            >
              {recuperation.map((item) => (
                <BouteilleCard key={item.bouteille.id} item={item} />
              ))}
            </Section>
          )}

          {archived.length > 0 && (
            <Section title="📦 EN TRANSIT / ARCHIVÉES">
              {archived.map((item) => (
                <BouteilleCard key={item.bouteille.id} item={item} />
              ))}
            </Section>
          )}

          <div className="px-4 mt-5 mb-4 space-y-3">
            <Tile
              href="/m/bouteilles/nouvelle"
              size="xl"
              variant="emerald"
              emoji="➕"
              label="Ajouter une bouteille"
              sublabel="Recharge ou récupération"
            />
            <Tile
              href="/m/registre"
              size="xl"
              variant="bronze"
              emoji="📋"
              label="Générer le registre PDF"
              sublabel="Mouvements chronologiques pour audit F-Gas"
            />
          </div>
        </>
      )}
    </>
  );
}

function Section({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 mt-5">
      <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-black/45 mb-2 px-1">
        {title}
      </div>
      <div className="space-y-2.5">{children}</div>
      {footer && (
        <p className="mt-2 px-1 text-[11px] text-black/45 leading-snug">
          {footer}
        </p>
      )}
    </section>
  );
}

function BouteilleCard({ item }: { item: BouteilleWithStock }) {
  const { bouteille, chargeActuelle, pct, niveau } = item;
  const colors = colorAlerte(niveau);
  const pctDisplay = Math.min(100, Math.max(0, pct));

  // Couleur bordure gauche = niveau alerte (rouge/orange/vert/vide).
  const accentColor = ((): string => {
    if (niveau === "rouge") return "#dc2626";
    if (niveau === "orange") return "#ea580c";
    if (niveau === "vide") return "#94a3b8";
    return "#059669"; // vert
  })();

  return (
    <Link
      href={`/m/bouteilles/${bouteille.id}`}
      className="block rounded-2xl bg-white ring-1 ring-black/[0.05] px-4 py-3.5 active:bg-black/[0.02] transition-colors"
      style={{
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
        borderLeft: `5px solid ${accentColor}`,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[16px] font-bold text-[#111]">
              {bouteille.fluide?.code ?? "Mélangé"}
            </span>
            {bouteille.compatibleInflammable && (
              <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 uppercase">
                🔥 Inflammable
              </span>
            )}
          </div>
          <div className="text-[11px] font-mono text-black/45 mt-0.5">
            #{bouteille.numeroSerie}
          </div>
        </div>
        <span
          className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider"
          style={{ background: accentColor, color: "#ffffff" }}
        >
          {pct.toFixed(0)}% · {labelAlerte(niveau)}
        </span>
      </div>

      <div className="text-[12.5px] text-black/65 mb-2">
        <strong className="text-[#111]">{chargeActuelle.toFixed(2)} kg</strong>{" "}
        / {bouteille.capaciteMaxKg.toFixed(2)} kg
      </div>

      {/* Gauge bar */}
      <div className="relative w-full h-2 rounded-full bg-black/[0.06] overflow-hidden">
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
    </Link>
  );
}
