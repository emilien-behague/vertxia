"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MobileHeader } from "@/components/mobile/ui/mobile-header";
import {
  CODE_ERREUR_GRAVITE_LABELS,
  CODE_ERREUR_GRAVITE_STYLES,
  CODE_ERREUR_MARQUE_LABELS,
  type CodeErreur,
  type CodeErreurGravite,
  type CodeErreurMarque,
  type CodeErreurSearchHit,
} from "@/lib/codes-erreur/types";

// Memoire collective : stats agregees du code dans le catalogue partage.
type ErrorCodeStats = {
  totalOccurrences: number;
  lastSeenAt: string | null;
  modeles: Array<{ modele: string; occurrences: number; lastSeenAt: string }>;
};

// Page mobile recherche dans la base de codes erreur multi-marques HVAC.
//
// UX cible (SIDV "simplifier pour idiots") :
//  1. Pills marques en haut (Daikin, Mitsubishi, Carrier...) — 1 tap pour
//     filtrer. Pill "Toutes" par defaut.
//  2. Champ de recherche text/code en gros (autofocus si query vide).
//  3. Liste de hits avec :
//     - Code en gros (mono)
//     - Libelle court
//     - Badge marque + badge gravite couleur
//     - Tap → detail (causes + etapes)
//  4. Vue detail en accordeon : sources cliquables, gravite, systemes.

const MARQUES: CodeErreurMarque[] = [
  "daikin",
  "mitsubishi",
  "carrier",
  "trane",
  "lg",
  "samsung",
  "toshiba",
  "hitachi",
];

const MARQUE_COLORS: Record<CodeErreurMarque, string> = {
  daikin: "bg-blue-100 text-blue-800 ring-blue-300",
  mitsubishi: "bg-red-100 text-red-800 ring-red-300",
  carrier: "bg-cyan-100 text-cyan-800 ring-cyan-300",
  trane: "bg-amber-100 text-amber-800 ring-amber-300",
  lg: "bg-pink-100 text-pink-800 ring-pink-300",
  samsung: "bg-indigo-100 text-indigo-800 ring-indigo-300",
  toshiba: "bg-slate-100 text-slate-800 ring-slate-300",
  hitachi: "bg-emerald-100 text-emerald-800 ring-emerald-300",
};

export default function CodesErreurPage() {
  const [query, setQuery] = useState("");
  const [marqueSel, setMarqueSel] = useState<CodeErreurMarque | null>(null);
  const [hits, setHits] = useState<CodeErreurSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  // Stats memoire collective par code (cle: "marque__code")
  const [stats, setStats] = useState<Record<string, ErrorCodeStats>>({});
  // Codes deja declares "rencontre terrain" dans cette session (anti-double-click)
  const declaredRef = useRef<Set<string>>(new Set());

  const queryDebounced = useDebounced(query, 200);

  // Quand un code est expand : on fetch SEULEMENT les stats (lecture passive).
  // L'incrementation du compteur se fait UNIQUEMENT via le bouton explicite
  // "J'ai rencontre ce code sur le terrain" — sinon le signal metier est
  // pollue par les simples consultations de curiosite / formation.
  useEffect(() => {
    if (!expandedCode) return;
    const [marque, code] = expandedCode.split("__");
    if (!marque || !code) return;

    const ctrl = new AbortController();
    (async () => {
      try {
        const url = `/api/catalog/error-code/lookup?marque=${encodeURIComponent(marque)}&code=${encodeURIComponent(code)}`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = (await res.json()) as ErrorCodeStats;
        setStats((prev) => ({ ...prev, [expandedCode]: data }));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    })();

    return () => ctrl.abort();
  }, [expandedCode]);

  // Handler : declaration explicite "j'ai rencontre ce code sur le terrain".
  // Optionnellement avec un modele (ex: "RXS35") pour enrichir les stats.
  async function declarerRencontreTerrain(
    marque: string,
    code: string,
    modele?: string
  ): Promise<{ ok: boolean; newCount?: number; error?: string }> {
    const key = `${marque}__${code}`;
    if (declaredRef.current.has(key)) {
      return { ok: false, error: "Déjà déclaré dans cette session" };
    }
    declaredRef.current.add(key);
    try {
      const res = await fetch("/api/catalog/error-code/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marque, code, modele: modele || undefined }),
      });
      if (!res.ok) {
        declaredRef.current.delete(key);
        return { ok: false, error: `HTTP ${res.status}` };
      }
      const data = await res.json();
      // Refresh stats locale (optimistic + re-fetch reel)
      const lookupUrl = `/api/catalog/error-code/lookup?marque=${encodeURIComponent(marque)}&code=${encodeURIComponent(code)}`;
      const lookupRes = await fetch(lookupUrl);
      if (lookupRes.ok) {
        const fresh = (await lookupRes.json()) as ErrorCodeStats;
        setStats((prev) => ({ ...prev, [key]: fresh }));
      }
      return { ok: true, newCount: data.nombreOccurrences };
    } catch {
      declaredRef.current.delete(key);
      return { ok: false, error: "Erreur réseau" };
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (queryDebounced.trim()) params.set("q", queryDebounced.trim());
        if (marqueSel) params.set("marque", marqueSel);
        params.set("limit", "50");
        const res = await fetch(`/api/codes-erreur?${params.toString()}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) {
          setHits([]);
          return;
        }
        const data = await res.json();
        setHits(Array.isArray(data.hits) ? data.hits : []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setHits([]);
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => ctrl.abort();
  }, [queryDebounced, marqueSel]);

  const isEmpty = !loading && hits.length === 0 && queryDebounced.trim().length > 0;

  return (
    <div className="min-h-screen">
      <MobileHeader title="Codes erreur" backHref="/m" />

      <div className="max-w-md mx-auto px-4 pt-3 pb-6">
        {/* Pills marques — scroll horizontal */}
        <div
          className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-3"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" as const }}
        >
          <FilterPill
            label="Toutes"
            active={marqueSel === null}
            onClick={() => setMarqueSel(null)}
            colorClass="bg-[#111] text-white ring-[#111]"
            inactiveClass="bg-white text-black/70 ring-black/15"
          />
          {MARQUES.map((m) => (
            <FilterPill
              key={m}
              label={CODE_ERREUR_MARQUE_LABELS[m].split(" ")[0]}
              active={marqueSel === m}
              onClick={() => setMarqueSel(marqueSel === m ? null : m)}
              colorClass={MARQUE_COLORS[m]}
              inactiveClass="bg-white text-black/65 ring-black/15"
            />
          ))}
        </div>

        {/* Champ de recherche */}
        <div className="relative mt-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              marqueSel
                ? `Code ${CODE_ERREUR_MARQUE_LABELS[marqueSel].split(" ")[0]} (ex: U4)`
                : "Code (U4, P1, CH05) ou mot-clé"
            }
            autoFocus
            inputMode="search"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="w-full h-12 rounded-2xl bg-white px-4 pr-10 text-[16px] ring-1 ring-black/10 focus:ring-2 focus:ring-[#A16207] outline-none placeholder:text-black/35"
          />
          {query.length > 0 && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/10 active:bg-black/20 flex items-center justify-center"
              style={{ WebkitTapHighlightColor: "transparent" }}
              aria-label="Effacer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Sous-bandeau infos */}
        <div className="flex items-center justify-between mt-3 px-1 text-[12px] text-black/50">
          <span>
            {loading
              ? "Recherche…"
              : queryDebounced.trim()
                ? `${hits.length} résultat${hits.length > 1 ? "s" : ""}`
                : marqueSel
                  ? `Codes ${CODE_ERREUR_MARQUE_LABELS[marqueSel]}`
                  : "Taper un code ou un mot-clé"}
          </span>
          {marqueSel && (
            <button
              onClick={() => setMarqueSel(null)}
              className="text-[#A16207] underline-offset-2 hover:underline"
            >
              Réinitialiser
            </button>
          )}
        </div>

        {/* Resultats */}
        <div className="mt-3 space-y-2">
          {isEmpty && (
            <div className="rounded-2xl bg-white ring-1 ring-black/[0.04] px-4 py-8 text-center">
              <div className="text-[40px] mb-2">🔍</div>
              <div className="text-[15px] font-semibold text-black/80">
                Pas de résultat
              </div>
              <div className="text-[13px] text-black/55 mt-1">
                Essayez un autre code, une autre marque, ou un mot-clé du libellé.
              </div>
            </div>
          )}

          {hits.map((hit) => {
            const key = `${hit.marque}__${hit.code}`;
            const expanded = expandedCode === key;
            return (
              <CodeErreurCard
                key={key}
                hit={hit}
                expanded={expanded}
                onToggle={() => setExpandedCode(expanded ? null : key)}
                stats={stats[key] ?? null}
                onDeclareTerrain={(modele) =>
                  declarerRencontreTerrain(hit.marque, hit.code, modele)
                }
                alreadyDeclared={declaredRef.current.has(key)}
              />
            );
          })}

          {!loading && queryDebounced.trim().length === 0 && !marqueSel && (
            <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 px-4 py-4 text-[13px] text-amber-900 mt-4">
              <div className="font-semibold mb-1">À savoir</div>
              <p className="leading-snug">
                La base couvre <strong>~120 codes</strong> sur les 8 marques les
                plus courantes en France. Causes et étapes sont indicatives — le
                diagnostic terrain reste prioritaire. Le détecteur de fuite
                électronique et le respect des protocoles QualiPAC sont obligatoires.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPOSANTS
// ============================================================================

function FilterPill({
  label,
  active,
  onClick,
  colorClass,
  inactiveClass,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  colorClass: string;
  inactiveClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 h-9 px-3.5 rounded-full text-[13px] font-medium ring-1 transition active:scale-95 ${
        active ? colorClass : inactiveClass
      }`}
      style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
    >
      {label}
    </button>
  );
}

function CodeErreurCard({
  hit,
  expanded,
  onToggle,
  stats,
  onDeclareTerrain,
  alreadyDeclared,
}: {
  hit: CodeErreurSearchHit;
  expanded: boolean;
  onToggle: () => void;
  stats: ErrorCodeStats | null;
  onDeclareTerrain: (modele?: string) => Promise<{ ok: boolean; newCount?: number; error?: string }>;
  alreadyDeclared: boolean;
}) {
  const graviteStyle = CODE_ERREUR_GRAVITE_STYLES[hit.gravite];

  return (
    <div
      className={`rounded-2xl bg-white ring-1 transition ${
        expanded ? "ring-[#A16207]/40 shadow-md" : "ring-black/[0.06]"
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3.5 active:bg-black/[0.02] transition-colors rounded-2xl"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0">
            <div className="inline-flex items-center justify-center min-w-[58px] h-11 px-2.5 rounded-xl bg-[#111] text-white font-mono font-bold text-[15px] tracking-tight">
              {hit.code}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className={`text-[10px] px-1.5 py-0.5 rounded ring-1 font-medium ${MARQUE_COLORS[hit.marque]}`}>
                {CODE_ERREUR_MARQUE_LABELS[hit.marque].split(" ")[0]}
              </span>
              <GraviteBadge gravite={hit.gravite} />
            </div>
            <div className="text-[14px] font-semibold text-[#111] leading-snug">
              {hit.libelle}
            </div>
          </div>
          <div className="shrink-0 pt-2">
            <svg
              className={`text-black/40 transition-transform ${expanded ? "rotate-90" : ""}`}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 -mt-1">
          {/* Badge memoire collective + CTA declaration rencontre terrain */}
          <MemoireCollectiveBadge
            stats={stats}
            onDeclareTerrain={onDeclareTerrain}
            alreadyDeclared={alreadyDeclared}
          />

          <p className="text-[13px] text-black/70 leading-relaxed mb-3">
            {hit.description}
          </p>

          <DetailSection title="Causes probables">
            <ol className="space-y-1.5 list-decimal pl-5 text-[13px] text-black/75 leading-snug">
              {hit.causesProbables.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ol>
          </DetailSection>

          <DetailSection title="Étapes de réparation">
            <ol className="space-y-1.5 list-decimal pl-5 text-[13px] text-black/75 leading-snug">
              {hit.etapesReparation.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ol>
          </DetailSection>

          {hit.systemes && hit.systemes.length > 0 && (
            <DetailSection title="Systèmes concernés">
              <div className="flex flex-wrap gap-1.5">
                {hit.systemes.map((s) => (
                  <span
                    key={s}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-black/5 text-black/70"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </DetailSection>
          )}

          {hit.sources.length > 0 && (
            <DetailSection title="Sources">
              <ul className="space-y-1 text-[11.5px]">
                {hit.sources.map((s) => (
                  <li key={s} className="truncate">
                    <a
                      href={s}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#A16207] active:opacity-60 underline underline-offset-2"
                    >
                      {s.replace(/^https?:\/\//, "")}
                    </a>
                  </li>
                ))}
              </ul>
            </DetailSection>
          )}
        </div>
      )}
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="text-[11px] font-bold uppercase tracking-wider text-black/55 mb-1.5">
        {title}
      </div>
      {children}
    </div>
  );
}

function MemoireCollectiveBadge({
  stats,
  onDeclareTerrain,
  alreadyDeclared,
}: {
  stats: ErrorCodeStats | null;
  onDeclareTerrain: (modele?: string) => Promise<{ ok: boolean; newCount?: number; error?: string }>;
  alreadyDeclared: boolean;
}) {
  const [showInput, setShowInput] = useState(false);
  const [modeleInput, setModeleInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [justDeclared, setJustDeclared] = useState(alreadyDeclared);

  async function handleSubmit() {
    setSubmitting(true);
    setFeedback(null);
    const result = await onDeclareTerrain(modeleInput.trim() || undefined);
    setSubmitting(false);
    if (result.ok) {
      setJustDeclared(true);
      setShowInput(false);
      setModeleInput("");
      setFeedback("✓ Déclaration enregistrée. Merci d'enrichir la mémoire collective Vertxia.");
      setTimeout(() => setFeedback(null), 4000);
    } else {
      setFeedback(`❌ ${result.error || "Échec"}`);
    }
  }

  if (!stats) {
    return (
      <div className="mb-3 rounded-xl bg-emerald-50/50 ring-1 ring-emerald-100 px-3 py-2 text-[12px] text-emerald-700/70">
        Lecture de la mémoire collective…
      </div>
    );
  }

  const total = stats.totalOccurrences;
  const lastSeenDate = stats.lastSeenAt
    ? new Date(stats.lastSeenAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  const topModele = stats.modeles[0]?.modele;

  return (
    <div className="mb-3 space-y-2">
      {/* Bloc stats — lecture passive, juste informatif */}
      {total === 0 ? (
        <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2.5">
          <div className="text-[12.5px] font-semibold text-slate-700 mb-0.5">
            Jamais signalé encore
          </div>
          <div className="text-[11.5px] text-slate-600 leading-snug">
            Aucun frigoriste Vertxia n&apos;a encore déclaré avoir rencontré ce code.
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[14px]">🌐</span>
            <span className="text-[12.5px] font-bold text-emerald-900">
              {total} rencontre{total > 1 ? "s" : ""} terrain dans la mémoire Vertxia
            </span>
          </div>
          <div className="text-[11.5px] text-emerald-800/85 leading-snug">
            {topModele && (
              <>
                Modèle le plus fréquent :{" "}
                <span className="font-semibold">{topModele}</span>
                {stats.modeles[0].occurrences > 1
                  ? ` (${stats.modeles[0].occurrences}×)`
                  : ""}
                .{" "}
              </>
            )}
            {lastSeenDate && <>Dernière déclaration : {lastSeenDate}.</>}
          </div>
        </div>
      )}

      {/* CTA déclaration terrain — action explicite */}
      {!justDeclared && !showInput && (
        <button
          type="button"
          onClick={() => setShowInput(true)}
          className="w-full px-3 py-2.5 rounded-xl bg-white ring-1 ring-[#A16207]/30 text-[#A16207] text-[12.5px] font-semibold active:bg-[#A16207]/5 transition-colors flex items-center justify-center gap-1.5"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          ✋ J&apos;ai rencontré ce code sur le terrain
        </button>
      )}

      {showInput && !justDeclared && (
        <div className="rounded-xl bg-white ring-1 ring-[#A16207]/40 px-3 py-3 space-y-2">
          <div className="text-[11.5px] text-black/70 leading-snug">
            Sur quel modèle l&apos;as-tu rencontré ? (facultatif — aide les autres pros à identifier les patterns)
          </div>
          <input
            type="text"
            value={modeleInput}
            onChange={(e) => setModeleInput(e.target.value)}
            placeholder="Ex : FTXM35M, PUHZ-ZRP125, RXS35..."
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="w-full h-10 rounded-lg bg-[#F5F4F0] px-3 text-[14px] ring-1 ring-black/10 focus:ring-2 focus:ring-[#A16207] outline-none placeholder:text-black/35"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowInput(false);
                setModeleInput("");
              }}
              disabled={submitting}
              className="flex-1 px-3 py-2 rounded-lg bg-black/[0.05] text-black/70 text-[12.5px] font-medium active:bg-black/[0.1] disabled:opacity-50"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 px-3 py-2 rounded-lg bg-[#A16207] text-white text-[12.5px] font-semibold active:bg-[#8a5206] disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {submitting && (
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              Confirmer
            </button>
          </div>
        </div>
      )}

      {justDeclared && (
        <div className="rounded-xl bg-emerald-100 ring-1 ring-emerald-300 px-3 py-2 text-[11.5px] text-emerald-900">
          ✓ Déclaration enregistrée dans la mémoire collective Vertxia.
        </div>
      )}

      {feedback && !justDeclared && (
        <div className="rounded-xl bg-red-50 ring-1 ring-red-200 px-3 py-2 text-[11.5px] text-red-700">
          {feedback}
        </div>
      )}
    </div>
  );
}

function GraviteBadge({ gravite }: { gravite: CodeErreurGravite }) {
  const s = CODE_ERREUR_GRAVITE_STYLES[gravite];
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ring-1 font-medium ${s.bg} ${s.text} ${s.ring}`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {CODE_ERREUR_GRAVITE_LABELS[gravite]}
    </span>
  );
}

// ============================================================================
// HOOK
// ============================================================================

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
