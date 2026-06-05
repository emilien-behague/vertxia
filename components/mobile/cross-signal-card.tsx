"use client";

// Carte affichee sur la fiche /eq/[id] entre la maintenance predictive
// et la memoire collective. Elle materialise le CROISEMENT des deux :
// signaux locaux specifiques a cet equipement + pannes connues sur le
// meme modele chez tous les techniciens Vertxia.
//
// C'est la concretisation de la promesse "Vertxia a un cerveau" :
// l'information collective n'est pas juste affichee passivement, elle
// est mise en relation avec la situation actuelle du pro pour produire
// une recommandation actionnable pendant qu'il est sur place.

import { useEffect, useState } from "react";
import { computeCrossSignals, type CrossSignal, type PanneConnue } from "@/lib/cross-signals";
import type { SignalPredictif } from "@/lib/predictive-maintenance";

type Props = {
  /** Signaux predictifs locaux deja calcules par la page parente. */
  predictiveSignals: SignalPredictif[];
  /** Modele complet "Daikin FTXM35M" — on split sur le premier espace. */
  modeleComplet: string;
};

// Gradient violet/indigo : la couleur "intelligence Vertxia". Distincte
// du rouge/orange (signaux urgents) et de l'ambre (memoire collective brute).
const TYPE_STYLES: Record<
  CrossSignal["type"],
  { icon: string; labelType: string; gradient: string; ringColor: string }
> = {
  confirmation_point_chaud: {
    icon: "✓",
    labelType: "Confirmation",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
    ringColor: "ring-violet-200",
  },
  vigilance_preventive: {
    icon: "👁",
    labelType: "Vigilance",
    gradient: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
    ringColor: "ring-indigo-200",
  },
  modele_historique_charge: {
    icon: "📊",
    labelType: "Historique modele",
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
    ringColor: "ring-violet-200",
  },
};

const GRAVITE_DOT: Record<CrossSignal["gravite"], string> = {
  critique: "bg-red-500",
  alerte: "bg-orange-500",
  surveillance: "bg-amber-500",
};

export function CrossSignalCard({ predictiveSignals, modeleComplet }: Props) {
  const [pannes, setPannes] = useState<PanneConnue[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const parts = modeleComplet.trim().split(/\s+/);
    const marque = parts[0];
    const modele = parts.slice(1).join(" ");
    if (!marque || !modele) {
      setLoading(false);
      setPannes([]);
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `/api/catalog/failure/lookup?marque=${encodeURIComponent(marque)}&modele=${encodeURIComponent(modele)}`,
          { method: "GET" }
        );
        if (!res.ok) {
          if (!cancelled) {
            setPannes([]);
            setLoading(false);
          }
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          setPannes(json.pannes ?? []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setPannes([]);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modeleComplet]);

  if (loading) return null; // pas d'etat de chargement, on attend le resultat
  if (!pannes) return null;

  const signals = computeCrossSignals(predictiveSignals, pannes);
  if (signals.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white ring-1 ring-violet-200/60 mb-3 overflow-hidden shadow-sm">
      <div className="px-5 pt-4 pb-2 flex items-baseline justify-between">
        <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-violet-700">
          Vertxia recommande
        </div>
        <div className="text-[10px] font-medium text-violet-600/75">
          Signal croise
        </div>
      </div>
      <div className="divide-y divide-violet-100">
        {signals.map((s) => {
          const styles = TYPE_STYLES[s.type];
          return (
            <div key={s.id} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div
                  className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white text-[15px] font-bold shadow shadow-violet-900/15"
                  style={{ background: styles.gradient }}
                  aria-hidden
                >
                  {styles.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-[#111] leading-snug">
                      {s.titre}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${GRAVITE_DOT[s.gravite]}`} />
                      {styles.labelType}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-black/65 leading-snug">
                    {s.description}
                  </p>
                  <div className="mt-2 pl-3 border-l-2 border-violet-200">
                    <div className="text-[10px] uppercase tracking-wider font-medium text-violet-700/70 mb-0.5">
                      Action
                    </div>
                    <p className="text-[12.5px] text-[#111] leading-snug">
                      {s.actionRecommandee}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-5 py-2 bg-violet-50/40 border-t border-violet-100 text-[10px] text-violet-700/70 text-center font-mono tracking-wider">
        Croisement memoire collective × diagnostic local
      </div>
    </div>
  );
}
