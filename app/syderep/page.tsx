"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { listInterventions } from "@/lib/intervention-storage";
import {
  aggregateForYear,
  loadManualInputs,
  saveManualInputs,
  toCsv,
  type SyderepManualInputs,
  type SyderepDeclaration,
} from "@/lib/syderep";

// Période officielle SYDEREP : 1er fév → 31 mars (données année N-1).
// Source : ADEME — https://syderep.ademe.fr
const SYDEREP_URL = "https://syderep.ademe.fr/";

function currentYear(): number {
  return new Date().getFullYear();
}

function availableYears(): number[] {
  const cy = currentYear();
  // On propose : année courante, N-1, N-2, N-3, N-4
  return [cy, cy - 1, cy - 2, cy - 3, cy - 4];
}

function fmtKg(kg: number): string {
  if (kg === 0) return "—";
  return kg.toFixed(2).replace(".", ",");
}

function fmtCO2(t: number): string {
  if (t === 0) return "—";
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

export default function SyderepPage() {
  const [mounted, setMounted] = useState(false);
  const [year, setYear] = useState<number>(currentYear() - 1);
  const [manual, setManual] = useState<SyderepManualInputs>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setManual(loadManualInputs(year));
  }, [year, mounted]);

  const interventions = useMemo(
    () => (mounted ? listInterventions() : []),
    [mounted]
  );

  const decl: SyderepDeclaration = useMemo(
    () => aggregateForYear(interventions, year, manual),
    [interventions, year, manual]
  );

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

  function handlePrint() {
    window.print();
  }

  if (!mounted) return null;

  const submissionWindow = `1er février → 31 mars ${year + 1}`;
  const isCurrentYear = year === currentYear();

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#111] font-sans antialiased">
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-12 md:py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10 print:mb-6"
        >
          <div className="flex items-center justify-between print:hidden">
            <a
              href="/"
              className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors"
            >
              ← VERTXIA
            </a>
            <div className="flex items-center gap-5">
              <a
                href="/equipements"
                className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors"
              >
                PARC
              </a>
              <a
                href="/historique"
                className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors"
              >
                HISTORIQUE
              </a>
              <a
                href="/bsff"
                className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors inline-flex items-center gap-2"
              >
                NOUVELLE INTERVENTION
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </a>
            </div>
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl font-light leading-[1.05] tracking-tight">
            Préparation SYDEREP {year}
          </h1>
          <p className="mt-4 text-sm text-black/50 leading-relaxed max-w-2xl">
            <strong className="text-black/70">Outil interne de préparation.</strong>{" "}
            Vertxia agrège automatiquement vos interventions de l&apos;année et
            pré-calcule vos rubriques par fluide. <strong className="text-black/70">La déclaration officielle se fait sur le portail ADEME</strong> —
            ici, vous préparez les chiffres exacts à reporter dans SYDEREP, avec une preuve interne datée.
          </p>
        </motion.div>

        {/* Bandeau officiel ADEME */}
        <div className="mb-4 rounded-xl border border-amber-200/60 bg-amber-50/80 px-5 py-4 print:hidden">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="space-y-1">
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-amber-800">
                ⚠ La déclaration officielle se fait sur le portail ADEME
              </div>
              <div className="text-sm text-amber-900">
                Vertxia pré-calcule vos chiffres. La saisie / l&apos;upload final se fait sur{" "}
                <strong>syderep.ademe.fr</strong> entre le <strong>{submissionWindow}</strong>.
              </div>
            </div>
            <a
              href={SYDEREP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start md:self-auto px-4 py-2 rounded-lg bg-amber-900 text-amber-50 text-xs font-mono tracking-widest uppercase hover:bg-amber-800 transition-colors inline-flex items-center gap-2"
            >
              OUVRIR SYDEREP
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
            </a>
          </div>
        </div>

        {/* Roadmap bandeau */}
        <div className="mb-8 rounded-xl border border-blue-200/50 bg-blue-50/50 px-5 py-3 print:hidden">
          <div className="flex items-start gap-3">
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-blue-700 mt-0.5">ROADMAP</span>
            <p className="text-xs text-blue-900/80 leading-relaxed">
              SYDEREP accepte un import CSV/Excel via le menu <em>Import acteurs</em>. Vertxia travaille
              à générer un export directement compatible avec ce format ADEME pour passer de
              &quot;outil de préparation&quot; à <strong>&quot;upload 1 clic&quot;</strong>.
            </p>
          </div>
        </div>

        {/* Sélecteur année + actions */}
        <div className="mb-8 flex flex-wrap items-center gap-3 print:hidden">
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40 mr-1">
            Année :
          </span>
          {availableYears().map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-4 py-2 rounded-full text-xs font-mono tracking-widest transition-all ${
                year === y
                  ? "bg-[#111] text-white"
                  : "bg-white text-black/60 border border-black/10 hover:border-black/30"
              }`}
            >
              {y}
              {y === currentYear() && (
                <span className="ml-1.5 text-[9px] opacity-60">EN COURS</span>
              )}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={handleExportCsv}
            disabled={decl.rows.length === 0}
            className="px-4 py-2 rounded-lg bg-white border border-black/10 text-xs font-mono tracking-widest uppercase hover:border-black/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Format Vertxia. L'export au format CSV ADEME directement importable arrive bientôt."
          >
            EXPORT CSV
          </button>
          <button
            onClick={handlePrint}
            disabled={decl.rows.length === 0}
            className="px-4 py-2 rounded-lg bg-[#111] text-white text-xs font-mono tracking-widest uppercase hover:bg-[#333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            IMPRIMER / PDF
          </button>
        </div>

        {/* Stats résumé */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
        >
          {[
            { label: "Interventions", value: decl.nbInterventions.toString() },
            { label: "Chargé en équipement", value: `${fmtKg(decl.totalChargeKg)} kg` },
            { label: "Récupéré", value: `${fmtKg(decl.totalRecupereKg)} kg` },
            { label: "Eq. CO2", value: fmtCO2(decl.totalCO2eq) },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-black/[0.08] bg-white px-4 py-4"
            >
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40">
                {stat.label}
              </div>
              <div className="mt-1 text-2xl font-light text-[#111]">{stat.value}</div>
            </div>
          ))}
        </motion.div>

        {/* Tableau principal */}
        {decl.rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white/40 p-12 text-center">
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40 mb-3">
              Aucune donnée pour {year}
            </div>
            <p className="text-sm text-black/60 max-w-md mx-auto">
              {isCurrentYear
                ? "Vos interventions de l'année apparaîtront ici au fur et à mesure. Vous pouvez aussi saisir manuellement votre stock initial et vos achats fournisseurs pour démarrer."
                : `Aucune intervention enregistrée pour ${year}. Sélectionnez une autre année ou saisissez manuellement vos données.`}
            </p>
            <button
              onClick={() => {
                // Ajoute une ligne vide R-32 pour démarrer une saisie manuelle.
                const seed: SyderepManualInputs = {
                  ...manual,
                  "R-32": manual["R-32"] ?? { stockInitialKg: 0, achatsKg: 0 },
                };
                setManual(seed);
                saveManualInputs(year, seed);
              }}
              className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#111] text-white text-xs tracking-widest font-medium rounded-xl hover:bg-[#333] transition-colors"
            >
              AJOUTER UNE LIGNE R-32 MANUELLE
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="rounded-2xl border border-black/[0.08] bg-white overflow-hidden print:rounded-none print:border-black/20 print:overflow-visible"
          >
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full text-sm">
                <thead className="bg-black/[0.03] border-b border-black/[0.08]">
                  <tr>
                    <th className="text-left px-4 py-3 font-mono text-[10px] tracking-widest uppercase text-black/50 whitespace-nowrap">
                      Fluide
                    </th>
                    <th className="text-right px-3 py-3 font-mono text-[10px] tracking-widest uppercase text-black/50 whitespace-nowrap">
                      Stock 01/01<br />
                      <span className="text-[8px] text-amber-700/80 font-normal normal-case tracking-normal">à saisir</span>
                    </th>
                    <th className="text-right px-3 py-3 font-mono text-[10px] tracking-widest uppercase text-black/50 whitespace-nowrap">
                      Achats<br />
                      <span className="text-[8px] text-amber-700/80 font-normal normal-case tracking-normal">à saisir</span>
                    </th>
                    <th className="text-right px-3 py-3 font-mono text-[10px] tracking-widest uppercase text-black/50 whitespace-nowrap">
                      Mise svc<br />
                      <span className="text-[8px] text-emerald-700/80 font-normal normal-case tracking-normal">auto</span>
                    </th>
                    <th className="text-right px-3 py-3 font-mono text-[10px] tracking-widest uppercase text-black/50 whitespace-nowrap">
                      Maintenance<br />
                      <span className="text-[8px] text-emerald-700/80 font-normal normal-case tracking-normal">auto</span>
                    </th>
                    <th className="text-right px-3 py-3 font-mono text-[10px] tracking-widest uppercase text-black/50 whitespace-nowrap">
                      Récupéré<br />
                      <span className="text-[8px] text-emerald-700/80 font-normal normal-case tracking-normal">auto</span>
                    </th>
                    <th className="text-right px-3 py-3 font-mono text-[10px] tracking-widest uppercase text-black/50 whitespace-nowrap">
                      Cédé<br />
                      <span className="text-[8px] text-emerald-700/80 font-normal normal-case tracking-normal">auto</span>
                    </th>
                    <th className="text-right px-3 py-3 font-mono text-[10px] tracking-widest uppercase text-black/50 whitespace-nowrap">
                      Stock 31/12<br />
                      <span className="text-[8px] text-black/40 font-normal normal-case tracking-normal">calculé</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {decl.rows.map((row, idx) => {
                    const stockNegative = row.stockFinalKg < 0;
                    return (
                      <tr
                        key={row.fluideCode}
                        className={`border-b border-black/[0.05] ${idx % 2 === 1 ? "bg-black/[0.015]" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm font-medium">{row.fluideCode}</div>
                          {row.gwp > 0 && (
                            <div className="text-[10px] text-black/40 mt-0.5">GWP {row.gwp.toLocaleString("fr-FR")}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.stockInitialKg || ""}
                            onChange={(e) =>
                              updateManual(row.fluideCode, "stockInitialKg", parseFloat(e.target.value) || 0)
                            }
                            placeholder="0"
                            className="w-24 px-2 py-1 text-right text-sm font-mono bg-amber-50/60 border border-amber-200/60 rounded focus:outline-none focus:border-amber-500 focus:bg-amber-50 print:bg-transparent print:border-transparent"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.achatsKg || ""}
                            onChange={(e) =>
                              updateManual(row.fluideCode, "achatsKg", parseFloat(e.target.value) || 0)
                            }
                            placeholder="0"
                            className="w-24 px-2 py-1 text-right text-sm font-mono bg-amber-50/60 border border-amber-200/60 rounded focus:outline-none focus:border-amber-500 focus:bg-amber-50 print:bg-transparent print:border-transparent"
                          />
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-sm">{fmtKg(row.chargeMiseServiceKg)}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm">{fmtKg(row.chargeMaintenanceKg)}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm">{fmtKg(row.recupereKg)}</td>
                        <td className="px-3 py-3 text-right font-mono text-sm">{fmtKg(row.cedeKg)}</td>
                        <td
                          className={`px-4 py-3 text-right font-mono text-sm font-medium ${
                            stockNegative ? "text-red-600" : ""
                          }`}
                          title={stockNegative ? "Stock final négatif : votre stock initial + achats ne couvre pas les charges. Vérifie tes saisies." : undefined}
                        >
                          {fmtKg(row.stockFinalKg)}
                          {stockNegative && (
                            <span className="ml-1 text-[10px]">⚠</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-black/[0.04] border-t-2 border-black/10">
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs tracking-widest uppercase">TOTAL</td>
                    <td className="px-3 py-3 text-right font-mono text-sm">
                      {fmtKg(decl.rows.reduce((s, r) => s + r.stockInitialKg, 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm">
                      {fmtKg(decl.rows.reduce((s, r) => s + r.achatsKg, 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm">
                      {fmtKg(decl.rows.reduce((s, r) => s + r.chargeMiseServiceKg, 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm">
                      {fmtKg(decl.rows.reduce((s, r) => s + r.chargeMaintenanceKg, 0))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm">{fmtKg(decl.totalRecupereKg)}</td>
                    <td className="px-3 py-3 text-right font-mono text-sm">{fmtKg(decl.totalCedeKg)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-medium">
                      {fmtKg(decl.rows.reduce((s, r) => s + r.stockFinalKg, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </motion.div>
        )}

        {/* Notice mode opératoire */}
        <div className="mt-10 grid md:grid-cols-2 gap-4 print:hidden">
          <div className="rounded-xl border border-black/[0.08] bg-white p-5">
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40 mb-3">
              Comment Vertxia calcule
            </div>
            <ul className="space-y-2 text-sm text-black/70 leading-relaxed">
              <li>
                <span className="font-mono text-xs text-emerald-700">AUTO</span> — Mise en service, maintenance,
                récupération, cession : agrégé depuis vos interventions {year}.
              </li>
              <li>
                <span className="font-mono text-xs text-amber-700">SAISIE</span> — Stock initial (01/01) et
                achats fournisseurs : Vertxia ne tracke pas encore les factures, à saisir manuellement.
              </li>
              <li>
                <span className="font-mono text-xs text-black/50">CALCUL</span> — Stock final = stock initial
                + achats + récupéré − chargé en équipement − cédé.
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-black/[0.08] bg-white p-5">
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40 mb-3">
              Mode opératoire SYDEREP (aujourd&apos;hui)
            </div>
            <ol className="space-y-2 text-sm text-black/70 leading-relaxed list-decimal list-inside">
              <li>Téléchargez le CSV / imprimez la page de préparation ci-dessus.</li>
              <li>
                Connectez-vous sur{" "}
                <a href={SYDEREP_URL} target="_blank" rel="noopener noreferrer" className="underline">
                  syderep.ademe.fr
                </a>{" "}
                entre le 1er février et le 31 mars {year + 1}.
              </li>
              <li>
                Soit vous reportez les valeurs ligne par ligne dans le formulaire web (mode IHM),
                soit vous utilisez le menu <em>Import acteurs &gt; Import</em> avec le template
                Excel officiel ADEME.
              </li>
              <li>Conservez le CSV / PDF Vertxia comme preuve interne datée.</li>
            </ol>
          </div>
        </div>

        {/* Footer dispatch */}
        <div className="mt-12 text-center print:hidden">
          <a
            href="/historique"
            className="font-mono text-xs tracking-[0.25em] text-black/40 hover:text-black/70 transition-colors"
          >
            ← Retour à l&apos;historique
          </a>
        </div>
      </div>

      {/* Print styles pour version PDF — paysage A4, tableau full-width */}
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 1cm;
        }
        @media print {
          html, body {
            background: white !important;
            font-size: 10pt;
          }
          /* Tableau : zéro scroll, tout doit rentrer dans la page paysage */
          table {
            width: 100% !important;
            font-size: 9pt !important;
            page-break-inside: avoid;
          }
          table th, table td {
            padding: 4px 6px !important;
            white-space: nowrap;
          }
          /* Sub-labels "à saisir / auto / calculé" : compact */
          table th span {
            display: inline-block;
            margin-left: 4px;
          }
          table th br {
            display: none;
          }
          /* Inputs de saisie deviennent du texte propre */
          input[type="number"] {
            -webkit-appearance: none !important;
            appearance: none !important;
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            width: auto !important;
            min-width: 40px;
            text-align: right;
            color: #111 !important;
            font-family: ui-monospace, monospace !important;
          }
          input[type="number"]::-webkit-outer-spin-button,
          input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none !important;
            margin: 0 !important;
          }
          /* Stats grid : 4 colonnes mais compactes en print */
          .grid {
            page-break-inside: avoid;
          }
          h1 {
            font-size: 22pt !important;
          }
          /* Forcer le conteneur principal à prendre toute la largeur paysage */
          .max-w-5xl {
            max-width: 100% !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
