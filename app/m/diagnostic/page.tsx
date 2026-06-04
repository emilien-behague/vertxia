"use client";

// Photo diagnostic visuel IA — Rank 11 du brainstorm features.
// Le frigoriste prend une photo d'un composant suspect (échangeur, brasure,
// compresseur, raccord…) + note libre optionnelle → Claude Opus 4.7 vision
// retourne : composant identifié, défauts détectés avec gravité, cause
// probable, action recommandée, devis estimé, délai intervention.
//
// Aucune persistence Supabase en V1 : juste la dernière analyse en localStorage
// pour éviter de la perdre si la page se recharge accidentellement.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/mobile-header";
import {
  compressImage,
  GRAVITE_LABELS,
  GRAVITE_STYLES,
  DELAI_LABELS,
  type DiagnosticResult,
} from "@/lib/vision-diagnostic";
import { saveDiagnostic, listDiagnostics } from "@/lib/diagnostic-storage";

type Phase = "idle" | "analyzing" | "result" | "error";

export default function DiagnosticPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [contexteNote, setContexteNote] = useState("");
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Compteur d'historique pour décider d'afficher le bouton "Historique" en haut
  useEffect(() => {
    setHistoryCount(listDiagnostics().length);
  }, []);

  async function handleFile(file: File) {
    setError(null);
    setPhase("analyzing");
    try {
      const dataUrl = await compressImage(file);
      setImageDataUrl(dataUrl);

      const res = await fetch("/api/vision/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: dataUrl,
          contexteNote: contexteNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as DiagnosticResult;
      setResult(data);
      setPhase("result");

      // Auto-save dans l'historique (localStorage user-scoped)
      try {
        saveDiagnostic({
          imageDataUrl: dataUrl,
          contexteNote: contexteNote.trim() || undefined,
          result: data,
        });
        setHistoryCount(listDiagnostics().length);
      } catch (e) {
        console.warn("[diagnostic] save failed:", e);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur diagnostic");
      setPhase("error");
    }
  }

  function reset() {
    setImageDataUrl(null);
    setResult(null);
    setError(null);
    setContexteNote("");
    setPhase("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleShare() {
    if (!result) return;
    const txt = formatDiagnosticForShare(result);
    if (navigator.share) {
      navigator
        .share({
          title: "Diagnostic Vertxia",
          text: txt,
        })
        .catch(() => {
          navigator.clipboard.writeText(txt);
        });
    } else {
      navigator.clipboard.writeText(txt);
    }
  }

  return (
    <>
      <MobileHeader
        title="Diagnostic"
        largeTitle
        backHref="/m"
        rightAction={
          historyCount > 0
            ? { label: `Historique (${historyCount})`, href: "/m/diagnostic/historique" }
            : undefined
        }
      />

      {/* PHASE IDLE — capture photo */}
      {phase === "idle" && (
        <div className="px-4 pt-2 space-y-4">
          <p className="text-[13.5px] text-black/65 leading-relaxed px-1">
            Prends une photo d&apos;un composant suspect (compresseur, échangeur, brasure, évaporateur…) et Vertxia te retourne un diagnostic : défauts détectés, cause probable, action recommandée, devis estimé.
          </p>

          <div className="rounded-2xl bg-white ring-1 ring-black/[0.04] p-4">
            <label className="text-[10px] uppercase tracking-wider text-black/45 font-medium block mb-2">
              Contexte (optionnel)
            </label>
            <textarea
              value={contexteNote}
              onChange={(e) => setContexteNote(e.target.value)}
              placeholder="Ex : compresseur fait du bruit depuis 2 jours, baisse de rendement…"
              rows={2}
              maxLength={300}
              className="w-full bg-transparent border-none text-[14px] text-[#111] placeholder:text-black/35 resize-none outline-none"
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="hidden"
            id="diagnostic-input"
          />
          <label
            htmlFor="diagnostic-input"
            className="block w-full px-6 py-4 rounded-2xl bg-[#A16207] text-white text-[15px] font-medium text-center active:opacity-90 transition-opacity cursor-pointer"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            <span className="inline-flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Prendre une photo du composant
            </span>
          </label>

          <div className="text-[11px] text-black/45 text-center px-3 leading-snug">
            Compression auto à 2000px max + JPEG 80%. Analyse via Claude Opus 4.7 vision (~3-5 sec).
          </div>
        </div>
      )}

      {/* PHASE ANALYZING */}
      {phase === "analyzing" && (
        <div className="px-4 pt-4 text-center">
          {imageDataUrl && (
            <div className="mx-auto max-w-xs mb-4 rounded-2xl overflow-hidden ring-1 ring-black/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageDataUrl} alt="Diagnostic en cours" className="w-full h-auto block" />
            </div>
          )}
          <div className="inline-flex items-center gap-2.5 text-[14px] text-black/65">
            <span className="w-4 h-4 border-2 border-black/15 border-t-[#A16207] rounded-full animate-spin" />
            Analyse de l&apos;image en cours…
          </div>
          <div className="text-[11.5px] text-black/40 mt-1">
            Claude Opus 4.7 inspecte la photo (~3-5 sec)
          </div>
        </div>
      )}

      {/* PHASE RESULT */}
      {phase === "result" && result && (
        <div className="px-4 pt-2 pb-4 space-y-4">
          {imageDataUrl && (
            <div className="rounded-2xl overflow-hidden ring-1 ring-black/[0.06] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageDataUrl} alt="Composant analysé" className="w-full h-auto block max-h-64 object-cover" />
            </div>
          )}

          {/* Composant identifié + confiance */}
          <section className="rounded-2xl bg-white ring-1 ring-black/[0.04] p-4">
            <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1">
              Composant identifié
            </div>
            <div className="text-[16px] font-semibold text-[#111] leading-tight">
              {result.composantIdentifie || "Non identifié"}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] uppercase tracking-wider text-black/45 font-medium">
                Confiance
              </span>
              <ConfianceChip confiance={result.confiance} />
            </div>
          </section>

          {/* Défauts détectés */}
          {result.defautsDetectes.length > 0 && (
            <section className="rounded-2xl bg-white ring-1 ring-black/[0.04] p-4">
              <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-2">
                Défauts détectés ({result.defautsDetectes.length})
              </div>
              <ul className="space-y-3">
                {result.defautsDetectes.map((d, i) => {
                  const s = GRAVITE_STYLES[d.gravite];
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <div className={`shrink-0 w-2.5 h-2.5 rounded-full mt-1.5 ${s.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[14px] font-medium text-[#111] leading-snug">
                            {d.nom}
                          </span>
                          <span className={`text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ring-1 ${s.bg} ${s.text} ${s.ring}`}>
                            {GRAVITE_LABELS[d.gravite]}
                          </span>
                        </div>
                        <div className="text-[12.5px] text-black/65 mt-0.5 leading-snug">
                          {d.description}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {result.defautsDetectes.length === 0 && (
            <section className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
              <div className="flex items-center gap-2 text-[14px] font-medium text-emerald-800">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Aucun défaut visible détecté
              </div>
              <div className="text-[12.5px] text-emerald-700/80 mt-1">État apparent nominal. Continue tes contrôles périodiques.</div>
            </section>
          )}

          {/* Cause + action + devis */}
          <section className="rounded-2xl bg-white ring-1 ring-black/[0.04] p-4 space-y-3">
            {result.causeProbable && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1">
                  Cause probable
                </div>
                <div className="text-[13.5px] text-[#111] leading-relaxed">
                  {result.causeProbable}
                </div>
              </div>
            )}
            {result.actionRecommandee && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1">
                  Action recommandée
                </div>
                <div className="text-[13.5px] text-[#111] leading-relaxed">
                  {result.actionRecommandee}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-black/[0.05]">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1">
                  Délai
                </div>
                <div className="text-[13px] font-medium text-[#111]">
                  {DELAI_LABELS[result.delaiIntervention]}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1">
                  Devis estimé
                </div>
                <div className="text-[13px] font-medium text-[#111]">
                  {result.devisEstimeMin !== null && result.devisEstimeMax !== null
                    ? `${result.devisEstimeMin}–${result.devisEstimeMax} € HT`
                    : "À chiffrer sur site"}
                </div>
              </div>
            </div>
          </section>

          {/* Notes contexte */}
          {result.notesContexte && (
            <section className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider text-amber-800/70 font-medium mb-1">
                Note du diagnostic
              </div>
              <div className="text-[12.5px] text-amber-900 leading-snug">{result.notesContexte}</div>
            </section>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleShare}
              className="w-full px-4 py-3 rounded-2xl bg-white border border-black/[0.08] text-[14px] font-medium text-[#111] active:bg-black/[0.03] transition-colors flex items-center justify-center gap-2"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Partager le diagnostic
            </button>
            <button
              type="button"
              onClick={reset}
              className="w-full px-4 py-3 rounded-2xl bg-[#A16207] text-white text-[14px] font-medium active:opacity-90 transition-opacity"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Nouveau diagnostic
            </button>
            <Link
              href="/m/intervention"
              className="block w-full px-4 py-3 rounded-2xl bg-[#111] text-white text-[14px] font-medium text-center active:bg-black/80 transition-colors"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Créer une intervention pour ce composant
            </Link>
          </div>

          <div className="text-[10px] text-black/35 text-center pt-2">
            Diagnostic généré par Claude Opus 4.7 vision · à valider sur site
          </div>
        </div>
      )}

      {/* PHASE ERROR */}
      {phase === "error" && (
        <div className="px-4 pt-4">
          <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-red-700">
            {error || "Erreur inconnue"}
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-4 w-full px-4 py-3 rounded-2xl bg-[#A16207] text-white text-[14px] font-medium active:opacity-90 transition-opacity"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Réessayer
          </button>
        </div>
      )}
    </>
  );
}

function ConfianceChip({ confiance }: { confiance: "haute" | "moyenne" | "basse" }) {
  const styles =
    confiance === "haute"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : confiance === "moyenne"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-red-50 text-red-700 ring-red-200";
  return (
    <span className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ring-1 ${styles}`}>
      {confiance}
    </span>
  );
}

function formatDiagnosticForShare(r: DiagnosticResult): string {
  const lines: string[] = [];
  lines.push("DIAGNOSTIC VERTXIA");
  if (r.composantIdentifie) lines.push(`Composant : ${r.composantIdentifie}`);
  if (r.defautsDetectes.length > 0) {
    lines.push("");
    lines.push("Défauts détectés :");
    for (const d of r.defautsDetectes) {
      lines.push(`• [${GRAVITE_LABELS[d.gravite]}] ${d.nom} — ${d.description}`);
    }
  } else {
    lines.push("État apparent nominal.");
  }
  if (r.causeProbable) {
    lines.push("");
    lines.push(`Cause probable : ${r.causeProbable}`);
  }
  if (r.actionRecommandee) {
    lines.push(`Action : ${r.actionRecommandee}`);
  }
  lines.push(`Délai : ${DELAI_LABELS[r.delaiIntervention]}`);
  if (r.devisEstimeMin !== null && r.devisEstimeMax !== null) {
    lines.push(`Devis estimé : ${r.devisEstimeMin}–${r.devisEstimeMax} € HT`);
  }
  lines.push("");
  lines.push(`Diagnostic généré par Claude Opus 4.7 vision via vertxia.com`);
  return lines.join("\n");
}
