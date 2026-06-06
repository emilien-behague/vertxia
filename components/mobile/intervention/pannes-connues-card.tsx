"use client";

// Carte affichee sur la fiche equipement /eq/[id] : agrege les pannes
// observees sur le MEME modele (marque + modele) chez tous les frigoristes
// Vertxia. C'est la materialisation de la "memoire collective" — plus il
// y a de scans + interventions sur un modele, plus la carte devient
// pertinente.
//
// Use case principal : avant d'aller faire un controle, le technicien
// voit "ce modele a 12 fuites enregistrees sur le detendeur" → il sait
// quoi verifier en priorite.
//
// Source des donnees : table shared_failure_catalog (Supabase).
// Endpoint : /api/catalog/failure/lookup?marque=X&modele=Y

import { useEffect, useState } from "react";

type Panne = {
  typePanne: string;
  localisation: string;
  nombreOccurrences: number;
  lastSeenAt: string;
};

type Props = {
  /** Modele complet "Daikin FTXM35M" — on split sur le premier espace pour
   *  obtenir marque + modele. Si pas d'espace, on assume marque inconnue. */
  modeleComplet: string;
  /** Si false, on masque la ligne "regarde les signaux de maintenance
   *  ci-dessus" (sinon elle reference du vide et le client ne pige pas). */
  hasPredictiveSignals?: boolean;
};

const TYPE_PANNE_LABELS: Record<string, string> = {
  fuite: "Fuite",
  panne_compresseur: "Panne compresseur",
  encrassement: "Encrassement",
  defaut_ventilateur: "Défaut ventilateur",
  givrage_excessif: "Givrage excessif",
  bruit_anormal: "Bruit anormal",
  autre: "Autre",
};

export function PannesConnuesCard({ modeleComplet, hasPredictiveSignals = false }: Props) {
  const [pannes, setPannes] = useState<Panne[] | null>(null);
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

  if (loading) {
    return (
      <div className="rounded-2xl bg-black/[0.02] ring-1 ring-black/[0.04] mb-3 px-4 py-3">
        <div className="text-[11px] font-mono tracking-widest uppercase text-black/35">
          Pannes connues sur ce modèle
        </div>
        <div className="mt-2 text-[12px] text-black/45">
          Recherche dans la mémoire collective Vertxia…
        </div>
      </div>
    );
  }

  if (!pannes || pannes.length === 0) {
    // Wording NEUTRE (gris) — pas vert, pour ne PAS donner l'illusion d'un
    // "tout va bien" alors qu'un signal predictif rouge peut etre present
    // juste au-dessus. L'absence de panne enregistree par d'autres frigoristes
    // n'est PAS une garantie d'absence de probleme sur cet equipement.
    return (
      <div className="rounded-2xl bg-black/[0.025] ring-1 ring-black/[0.06] mb-3 px-4 py-3">
        <div className="text-[11px] font-mono tracking-widest uppercase text-black/45">
          Mémoire collective Vertxia
        </div>
        <div className="mt-1 text-[13px] text-black/70 leading-relaxed">
          Modèle non encore documenté par d&apos;autres techniciens.
        </div>
        {hasPredictiveSignals && (
          <div className="mt-1 text-[11px] text-black/45 leading-snug">
            Cela ne dit rien sur l&apos;état de l&apos;équipement — regarde les signaux de maintenance prédictive ci-dessus.
          </div>
        )}
      </div>
    );
  }

  const total = pannes.reduce((s, p) => s + p.nombreOccurrences, 0);

  return (
    <div className="rounded-2xl bg-amber-50/50 ring-1 ring-amber-200/50 mb-3 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-200/40">
        <div className="text-[11px] font-mono tracking-widest uppercase text-amber-800/80">
          Pannes connues sur ce modèle · Vertxia
        </div>
        <div className="mt-1 text-[14px] font-semibold text-amber-900">
          {total} occurrence{total > 1 ? "s" : ""} enregistrée{total > 1 ? "s" : ""}
        </div>
        <div className="text-[11px] text-amber-800/70 mt-0.5">
          Agrégées sur tous les techniciens Vertxia. À surveiller en priorité.
        </div>
      </div>
      <div className="divide-y divide-amber-200/30">
        {pannes.map((p, idx) => {
          const typeLabel = TYPE_PANNE_LABELS[p.typePanne] || p.typePanne;
          return (
            <div
              key={`${p.typePanne}-${p.localisation}-${idx}`}
              className="px-4 py-2.5 flex items-baseline justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[#111] leading-tight">
                  {typeLabel}
                </div>
                <div className="text-[11.5px] text-black/55 leading-snug mt-0.5 truncate">
                  {p.localisation}
                </div>
              </div>
              <div className="text-[13px] font-mono tabular-nums text-amber-900 shrink-0">
                {p.nombreOccurrences}
                <span className="text-[10px] text-amber-700/70 ml-0.5">
                  cas
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
