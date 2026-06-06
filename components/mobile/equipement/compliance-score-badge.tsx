"use client";

// Badge pastille "Score conformite" affiche en permanence dans le top-right
// de l'app /m/*. Tap -> drawer Vaul avec la decomposition par categorie
// + actions correctives.
//
// Brief Vertxia #4 du top 10 ideation IA : "Synthese metier d'un score
// reglementaire vs dashboard de donnees brutes". Differenciateur fort vs
// F.i360°/Praxedo qui restent "outils neutres" sans parti-pris.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Drawer } from "vaul";
import { listEquipements, computeAllStatus } from "@/lib/equipement/equipement";
import { listInterventions } from "@/lib/intervention/intervention-storage";
import { listDiagnostics } from "@/lib/intervention/diagnostic-storage";
import { loadProfil } from "@/lib/profil";
import {
  computeComplianceScore,
  SCORE_COLOR_STYLES,
  type ComplianceScore,
} from "@/lib/equipement/compliance-score";

export function ComplianceScoreBadge() {
  const [score, setScore] = useState<ComplianceScore | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Recalcul du score : (a) au mount, (b) sur visibilitychange + focus
  // (l'utilisateur revient sur l'app -> on rafraichit), (c) toutes les 30s
  // pendant que l'app est ouverte (auto-refresh leger).
  useEffect(() => {
    const refresh = () => {
      const rawEquipements = listEquipements();
      const interventions = listInterventions();
      const equipementsWithStatus = computeAllStatus(rawEquipements, interventions);
      const diagnostics = listDiagnostics();
      const profil = loadProfil();
      setScore(
        computeComplianceScore({
          equipementsWithStatus,
          rawEquipements,
          interventions,
          diagnostics,
          profil,
        })
      );
    };
    setMounted(true);
    refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const intervalId = window.setInterval(refresh, 30000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.clearInterval(intervalId);
    };
  }, []);

  // Pas d'affichage avant le mount cote client (evite hydration mismatch SSR)
  if (!mounted || !score) return null;

  const style = SCORE_COLOR_STYLES[score.color];

  return (
    <>
      {/* Pastille flottante en top-right, sous le notch + au-dessus du header
          sticky. z-index > header (30) + chat assistant (40) pour rester
          accessible meme quand un drawer global est ouvert.

          Position : sous la safe-area-inset-top + 6px de respiration. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Score de conformité ${score.total}/100 — ${score.label}`}
        className={`fixed right-3 z-[35] inline-flex flex-col items-center justify-center w-12 h-12 rounded-full ring-1 shadow-sm shadow-black/5 transition-transform active:scale-95 ${style.bg} ${style.ring}`}
        style={{
          top: "calc(env(safe-area-inset-top) + 6px)",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        {style.dotPulse && (
          <span className={`absolute inset-0 rounded-full ${style.dot} opacity-25 animate-ping`} />
        )}
        <span className={`relative text-[14px] font-bold leading-none ${style.text}`}>
          {score.parcVide ? "—" : score.total}
        </span>
        <span className={`relative text-[8px] font-mono tracking-wider mt-0.5 ${style.text}/70`}>
          /100
        </span>
      </button>

      <Drawer.Root open={open} onOpenChange={setOpen} shouldScaleBackground>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Drawer.Content
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl bg-[#F5F4F0] outline-none"
            style={{ maxHeight: "92dvh" }}
          >
            <Drawer.Title className="sr-only">
              Score de conformité réglementaire
            </Drawer.Title>
            <div className="mx-auto mt-2 mb-1 h-1.5 w-12 rounded-full bg-black/20" />

            {/* Header drawer : score gros + label */}
            <div className={`mx-5 mt-3 mb-2 px-5 py-4 rounded-2xl ring-1 ${style.bg} ${style.ring}`}>
              <div className="flex items-center gap-4">
                <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-full ring-2 ring-white/60 ${style.bg}`}>
                  <span className={`text-[22px] font-bold leading-none ${style.text}`}>
                    {score.parcVide ? "—" : score.total}
                  </span>
                  <span className={`text-[9px] font-mono tracking-wider mt-1 ${style.text}/70`}>
                    /100
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-[10px] font-mono tracking-widest uppercase ${style.text}/70`}>
                    Conformité du parc
                  </div>
                  <div className={`mt-0.5 text-[16px] font-semibold leading-tight ${style.text}`}>
                    {score.label}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                  className="shrink-0 w-8 h-8 rounded-full bg-black/[0.06] flex items-center justify-center active:bg-black/[0.12] transition-colors"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Parc vide */}
            {score.parcVide && (
              <div className="mx-5 mb-4 px-5 py-6 text-center text-[13px] text-black/55 leading-relaxed">
                Ton parc est en cours de constitution. Ajoute tes premiers équipements pour voir ton score conformité en temps réel.
                <Link
                  href="/m/equipements/nouveau"
                  className="block mt-4 px-5 py-2.5 rounded-2xl bg-[#111] text-white text-[13px] font-medium"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                  onClick={() => setOpen(false)}
                >
                  + Ajouter un équipement
                </Link>
              </div>
            )}

            {/* Decomposition par categorie */}
            {!score.parcVide && (
              <div className="overflow-y-auto overscroll-contain px-5 py-2 space-y-2.5 flex-1">
                {score.categories.map((cat) => {
                  const catStyle = SCORE_COLOR_STYLES[cat.statut];
                  return (
                    <div
                      key={cat.key}
                      className="rounded-2xl bg-white ring-1 ring-black/[0.05] overflow-hidden"
                    >
                      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-semibold text-[#111] leading-tight">
                            {cat.label}
                          </div>
                          <div className="text-[12px] text-black/65 leading-snug mt-0.5">
                            {cat.message}
                          </div>
                        </div>
                        <div className={`shrink-0 inline-flex items-center justify-center min-w-[58px] px-2 py-1 rounded-lg ring-1 ${catStyle.bg} ${catStyle.ring}`}>
                          <span className={`text-[13px] font-bold tabular-nums ${catStyle.text}`}>
                            {cat.obtenu}<span className={`text-[10px] font-normal ${catStyle.text}/60`}>/{cat.max}</span>
                          </span>
                        </div>
                      </div>
                      {cat.actions && cat.actions.length > 0 && (
                        <div className="px-4 pb-3 pt-1 space-y-1.5">
                          {cat.actions.map((action, idx) =>
                            action.href ? (
                              <Link
                                key={idx}
                                href={action.href}
                                onClick={() => setOpen(false)}
                                className="block w-full px-3 py-2 rounded-xl bg-black/[0.04] text-[12px] font-medium text-[#111] text-center active:bg-black/[0.08] transition-colors"
                                style={{ WebkitTapHighlightColor: "transparent" }}
                              >
                                {action.titre} →
                              </Link>
                            ) : (
                              <div
                                key={idx}
                                className="px-3 py-2 rounded-xl bg-black/[0.04] text-[12px] text-black/70 text-center"
                              >
                                {action.titre}
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer info */}
            <div className="px-5 py-3 mt-2 border-t border-black/[0.05] text-center">
              <div className="text-[10px] font-mono tracking-wider text-black/40">
                Score recalculé en temps réel · sur 100 pts
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
