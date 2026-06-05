"use client";

import { useEffect, useMemo, useState } from "react";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection } from "@/components/mobile/inset-list";
import { Tile } from "@/components/mobile/tile";
import { listInterventions } from "@/lib/intervention-storage";
import {
  aggregateForYear,
  loadManualInputs,
  saveManualInputs,
  toCsv,
  type SyderepManualInputs,
} from "@/lib/syderep";

const SYDEREP_URL = "https://syderep.ademe.fr/";

function fmtKg(kg: number): string {
  if (Math.abs(kg) < 0.005) return "—";
  return `${kg.toFixed(2).replace(".", ",")} kg`;
}

function fmtCO2(t: number): string {
  if (Math.abs(t) < 0.001) return "—";
  if (t < 1) return `${(t * 1000).toFixed(0)} kg`;
  return `${t.toFixed(2).replace(".", ",")} t`;
}

function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Statut de déclaration selon le calendrier officiel ADEME.
 * - "a_declarer" : on est dans la période 1er fév → 31 mars de N et la déclaration N-1 n'est pas faite
 * - "passe" : la période est passée, déclaration N-1 dépassée
 * - "future" : on est encore dans l'année N (avant la période de déclaration)
 */
function getDeclarationStatus(year: number): {
  label: string;
  sub: string;
  color: string;
  bg: string;
} {
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  if (year >= currentYear) {
    return {
      label: "En cours d'année",
      sub: "La déclaration sera à transmettre entre le 1er février et le 31 mars suivant",
      color: "text-blue-700",
      bg: "bg-blue-50 ring-blue-200",
    };
  }
  if (year === currentYear - 1) {
    if (month <= 1) {
      return {
        label: "À transmettre bientôt",
        sub: `La période officielle de déclaration s'ouvre le 1er février ${currentYear}`,
        color: "text-amber-700",
        bg: "bg-amber-50 ring-amber-200",
      };
    }
    if (month <= 3) {
      return {
        label: "Période active",
        sub: `Déclaration à transmettre avant le 31 mars ${currentYear}`,
        color: "text-orange-700",
        bg: "bg-orange-50 ring-orange-200",
      };
    }
    return {
      label: "Période close",
      sub: `La période officielle a pris fin le 31 mars ${currentYear}`,
      color: "text-black/60",
      bg: "bg-black/[0.04] ring-black/10",
    };
  }
  return {
    label: "Période close",
    sub: `Année antérieure — déclaration ${year} clôturée`,
    color: "text-black/60",
    bg: "bg-black/[0.04] ring-black/10",
  };
}

export default function MobileSyderepPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [manual, setManual] = useState<SyderepManualInputs>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Choix année par défaut : on regarde si l'année courante a des interventions.
    // Si oui (ex : on est en juin 2026 et on a déjà bossé en 2026) → afficher 2026.
    // Sinon → afficher N-1 (la période officielle de déclaration ADEME).
    const all = listInterventions();
    const thisYearStart = `${currentYear}-01-01T00:00:00`;
    const hasCurrentYearInterventions = all.some((i) => i.createdAt >= thisYearStart);
    setYear(hasCurrentYearInterventions ? currentYear : currentYear - 1);
  }, [currentYear]);

  useEffect(() => {
    if (!mounted) return;
    setManual(loadManualInputs(year));
  }, [year, mounted]);

  const interventions = useMemo(() => (mounted ? listInterventions() : []), [mounted]);
  const decl = useMemo(
    () => aggregateForYear(interventions, year, manual),
    [interventions, year, manual]
  );

  const status = useMemo(() => getDeclarationStatus(year), [year]);

  function updateManual(
    fluideCode: string,
    field: "stockInitialKg" | "achatsKg",
    value: number
  ) {
    const next: SyderepManualInputs = {
      ...manual,
      [fluideCode]: {
        stockInitialKg: manual[fluideCode]?.stockInitialKg ?? 0,
        achatsKg: manual[fluideCode]?.achatsKg ?? 0,
        [field]: Number.isFinite(value) ? value : 0,
      },
    };
    setManual(next);
    saveManualInputs(year, next);
  }

  function handleExportCsv() {
    const csv = toCsv(decl);
    downloadBlob(csv, `syderep_${year}.csv`, "text/csv");
  }

  const availableYears = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  const hasRows = decl.rows.length > 0;

  return (
    <>
      <MobileHeader title="📊 Bilan SYDEREP" largeTitle backHref="/m" />

      <div className="px-5 mt-1 text-[14px] text-black/55 leading-relaxed">
        Déclaration annuelle obligatoire des fluides HFC manipulés (Règlement UE 2024/573).
        Période officielle : 1er février → 31 mars pour l&apos;année N-1.
      </div>

      {/* Sélecteur année */}
      <section className="px-4 mt-5">
        <div className="inline-flex bg-black/[0.05] rounded-xl p-1 w-full">
          {availableYears.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                year === y
                  ? "bg-white text-[#111] shadow-sm shadow-black/[0.06]"
                  : "text-black/60 active:text-black/90"
              }`}
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              {y}
            </button>
          ))}
        </div>
      </section>

      {/* Statut déclaration */}
      <section className="px-4 mt-3">
        <div className={`rounded-xl px-4 py-3 ring-1 ${status.bg}`}>
          <div className={`font-mono text-[9px] tracking-[0.25em] uppercase ${status.color}`}>
            Déclaration {year}
          </div>
          <div className={`mt-1 text-[14px] font-medium ${status.color}`}>{status.label}</div>
          <div className="mt-0.5 text-[12px] text-black/55 leading-snug">{status.sub}</div>
        </div>
      </section>

      {/* Stats globales */}
      <section className="px-4 mt-4">
        <div className="grid grid-cols-3 gap-2.5">
          <StatCard
            label="Récupéré"
            value={fmtKg(decl.totalRecupereKg)}
            color="text-emerald-600"
          />
          <StatCard label="Équiv. CO₂" value={fmtCO2(decl.totalCO2eq)} color="text-red-600" />
          <StatCard
            label="Interventions"
            value={`${decl.nbInterventions}`}
            color="text-[#111]"
          />
        </div>
      </section>

      {!hasRows ? (
        <div className="px-5 mt-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-black/[0.04] mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div className="text-[15px] text-black/55">
            Aucune intervention enregistrée pour {year}
          </div>
          <div className="text-[12px] text-black/40 mt-1 leading-relaxed max-w-xs mx-auto">
            Les interventions F-Gas (mise en service, maintenance, récupération, démantèlement)
            génèrent automatiquement votre déclaration SYDEREP.
          </div>
        </div>
      ) : (
        <>
          {/* Détail par fluide */}
          <InsetListSection
            title="Bilan par fluide"
            footer="Stock final = Stock initial + Achats + Récupéré − Chargé en équipement − Cédé. Renseignez stock initial et achats pour le calcul officiel."
          >
            {decl.rows.map((r) => {
              const stockInitial = manual[r.fluideCode]?.stockInitialKg ?? 0;
              const achats = manual[r.fluideCode]?.achatsKg ?? 0;
              const chargeTotal = r.chargeMiseServiceKg + r.chargeMaintenanceKg;
              return (
                <div key={r.fluideCode} className="px-4 py-3.5">
                  <div className="flex items-baseline justify-between mb-2">
                    <div>
                      <div className="text-[15px] font-medium text-[#111]">{r.fluideCode}</div>
                      <div className="text-[11px] text-black/45">
                        GWP {r.gwp.toLocaleString("fr-FR")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-medium text-black/45 uppercase tracking-wide">
                        Équiv. CO₂
                      </div>
                      <div className="text-[15px] font-semibold text-red-600">
                        {fmtCO2(r.tonnesEqCO2)}
                      </div>
                    </div>
                  </div>

                  {/* Flux annuels */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <SyderepMini label="Récupéré" value={fmtKg(r.recupereKg)} />
                    <SyderepMini label="Cédé (BSFF)" value={fmtKg(r.cedeKg)} />
                    <SyderepMini label="Chargé équipement" value={fmtKg(chargeTotal)} />
                    <SyderepMini label="Stock final 31/12" value={fmtKg(r.stockFinalKg)} />
                  </div>

                  {/* Inputs manuels — stock initial + achats */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-black/[0.06]">
                    <ManualInput
                      label="Stock 1er jan."
                      value={stockInitial}
                      onChange={(v) => updateManual(r.fluideCode, "stockInitialKg", v)}
                    />
                    <ManualInput
                      label="Achats fournisseur"
                      value={achats}
                      onChange={(v) => updateManual(r.fluideCode, "achatsKg", v)}
                    />
                  </div>

                  {r.nbInterventions > 0 && (
                    <div className="mt-2 text-[11px] text-black/45">
                      {r.nbInterventions} intervention
                      {r.nbInterventions > 1 ? "s" : ""} sur {year}
                    </div>
                  )}
                </div>
              );
            })}
          </InsetListSection>

          {/* Actions — tuiles XL coherentes home (sky / bronze) */}
          <section className="px-4 mt-5 space-y-3">
            <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-black/45 px-1">
              📤 Soumettre la déclaration
            </div>
            <Tile
              onClick={handleExportCsv}
              size="xl"
              variant="sky"
              emoji="📥"
              label="Exporter en CSV"
              sublabel="Copier-coller dans le portail ADEME ou Excel"
            />
            <a
              href={SYDEREP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block rounded-3xl shadow-lg shadow-black/10 active:scale-[0.98] transition-transform overflow-hidden px-5 py-6"
              style={{
                background: "linear-gradient(135deg, #A16207 0%, #7A4A05 100%)",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              <div className="flex items-center gap-4">
                <div className="text-5xl leading-none drop-shadow shrink-0">🌐</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[18px] font-bold uppercase tracking-wide text-white leading-tight">
                    Portail ADEME
                  </div>
                  <div className="text-[12.5px] text-white/85 mt-1 leading-snug">
                    syderep.ademe.fr · pour soumettre la déclaration
                  </div>
                </div>
                <svg
                  className="shrink-0 text-white/70"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </div>
            </a>
          </section>

          {/* Totaux pédagogiques */}
          <InsetListSection title="Récapitulatif annuel">
            <div className="px-4 py-3 divide-y divide-black/[0.05]">
              <RowKV label="Total chargé en équipement" value={fmtKg(decl.totalChargeKg)} />
              <RowKV label="Total récupéré" value={fmtKg(decl.totalRecupereKg)} positive />
              <RowKV
                label="Total cédé centre traitement"
                value={fmtKg(decl.totalCedeKg)}
                positive
              />
              <RowKV
                label="Émissions tonnes éq. CO₂"
                value={fmtCO2(decl.totalCO2eq)}
                negative
              />
            </div>
          </InsetListSection>
        </>
      )}
    </>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-black/[0.04] text-center">
      <div className={`text-[17px] font-semibold tracking-tight ${color}`}>{value}</div>
      <div className="text-[10px] font-medium text-black/45 uppercase tracking-wide mt-0.5">
        {label}
      </div>
    </div>
  );
}

function SyderepMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/[0.03] px-3 py-2">
      <div className="text-[10px] font-medium text-black/45 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-[13px] font-mono text-[#111] mt-0.5">{value}</div>
    </div>
  );
}

function ManualInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium text-black/45 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="relative">
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value || ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          placeholder="0,00"
          className="w-full px-3 py-2 rounded-lg bg-white border border-black/10 text-[14px] font-mono text-[#111] outline-none focus:border-[#A16207]"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-black/40 pointer-events-none">
          kg
        </span>
      </div>
    </div>
  );
}

function RowKV({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  const color = positive
    ? "text-emerald-700"
    : negative
      ? "text-red-700"
      : "text-[#111]";
  return (
    <div className="flex items-center justify-between py-2">
      <div className="text-[13px] text-black/65">{label}</div>
      <div className={`text-[13px] font-mono font-medium ${color}`}>{value}</div>
    </div>
  );
}
