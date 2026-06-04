"use client";

// Photo diagnostic visuel IA — Rank 11 du brainstorm features.
// Le technicien prend une photo d'un composant suspect (échangeur, brasure,
// compresseur, raccord…) + note libre optionnelle → Claude Opus 4.7 vision
// retourne : composant identifié, défauts détectés avec gravité, cause
// probable, action recommandée, devis estimé, délai intervention.
//
// Aucune persistence Supabase en V1 : juste la dernière analyse en localStorage
// pour éviter de la perdre si la page se recharge accidentellement.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Drawer } from "vaul";
import { MobileHeader } from "@/components/mobile/mobile-header";
import {
  compressImage,
  GRAVITE_LABELS,
  GRAVITE_STYLES,
  DELAI_LABELS,
  type DiagnosticResult,
} from "@/lib/vision-diagnostic";
import { saveDiagnostic, listDiagnostics } from "@/lib/diagnostic-storage";
import { shareDiagnostic } from "@/lib/diagnostic-share";

type Phase = "idle" | "analyzing" | "result" | "error";

export default function DiagnosticPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [contexteNote, setContexteNote] = useState("");
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [currentDiagId, setCurrentDiagId] = useState<string | null>(null);
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
        const saved = saveDiagnostic({
          imageDataUrl: dataUrl,
          contexteNote: contexteNote.trim() || undefined,
          result: data,
        });
        setCurrentDiagId(saved.id);
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
    setCurrentDiagId(null);
    setPhase("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleShare() {
    if (!result || !imageDataUrl) return;
    const outcome = await shareDiagnostic({ imageDataUrl, result });
    if (outcome === "clipboard") {
      setShareToast("Diagnostic copié dans le presse-papier (image non partageable)");
      setTimeout(() => setShareToast(null), 3000);
    } else if (outcome === "shared_text_only") {
      setShareToast("Partagé en texte seul (image non supportée par cible)");
      setTimeout(() => setShareToast(null), 3000);
    } else if (outcome === "failed") {
      setShareToast("Échec du partage");
      setTimeout(() => setShareToast(null), 3000);
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

          <button
            type="button"
            onClick={() => setAboutOpen(true)}
            className="w-full px-4 py-2.5 rounded-2xl bg-white border border-black/[0.08] text-[13px] text-[#111] font-medium active:bg-black/[0.03] transition-colors flex items-center justify-center gap-2"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            Comment ça marche ? Limites et fiabilité
          </button>
        </div>
      )}

      {/* Drawer "Comment ça marche ?" — transparence sur capacités et limites IA */}
      <Drawer.Root open={aboutOpen} onOpenChange={setAboutOpen} shouldScaleBackground>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl bg-[#F5F4F0] outline-none" style={{ maxHeight: "92dvh" }}>
            <Drawer.Title className="sr-only">Comment fonctionne le diagnostic IA</Drawer.Title>
            <div className="mx-auto mt-2 mb-1 h-1.5 w-12 rounded-full bg-black/20" />

            <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06]">
              <div className="text-[16px] font-semibold text-[#111]">Comment ça marche ?</div>
              <button
                type="button"
                onClick={() => setAboutOpen(false)}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full bg-black/[0.06] flex items-center justify-center active:bg-black/[0.12] transition-colors"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain px-5 py-5 space-y-5 text-[#111]">
              {/* Sur quoi se base le diagnostic */}
              <section>
                <h3 className="text-[15px] font-semibold mb-2">Sur quoi est basé le diagnostic ?</h3>
                <p className="text-[13.5px] text-black/70 leading-relaxed">
                  Le diagnostic est fait par <strong>Claude Opus 4.7</strong> (modèle IA d&apos;Anthropic), entraîné sur des centaines de millions d&apos;images publiques (web, docs techniques, manuels de maintenance, forums techniciens). Il a vu des milliers d&apos;échangeurs corrodés, brasures défectueuses, raccords avec traces d&apos;huile, etc. Il reconnaît ces patterns visuels comme le ferait un expert humain avec 25 ans de terrain.
                </p>
                <p className="text-[13.5px] text-black/70 leading-relaxed mt-2">
                  En plus, Vertxia lui injecte un contexte métier précis (réglementation UE 2024/573, fluides HFC/HFO, défauts typiques, barème devis terrain 2026 FR) pour cadrer ses réponses.
                </p>
              </section>

              {/* Ce qu'il peut faire */}
              <section className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-emerald-800 mb-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Ce que l&apos;IA peut faire
                </div>
                <ul className="text-[13px] text-emerald-900/85 space-y-1.5 leading-snug">
                  <li>• Identifier le composant (compresseur, échangeur, raccord, etc.)</li>
                  <li>• Détecter corrosion, oxydation, traces d&apos;huile (= fuite probable)</li>
                  <li>• Repérer givre anormal, encrassement, calorifuge dégradé</li>
                  <li>• Voir soudure défectueuse, fissure visible</li>
                  <li>• Proposer une cause probable + une action recommandée</li>
                  <li>• Estimer une fourchette devis €HT indicative</li>
                </ul>
              </section>

              {/* Ce qu'il ne peut PAS faire */}
              <section className="rounded-2xl bg-red-50 border border-red-200 p-4">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-red-800 mb-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  Ce que l&apos;IA NE peut PAS faire
                </div>
                <ul className="text-[13px] text-red-900/85 space-y-1.5 leading-snug">
                  <li>• Mesurer pression, température, courant, débit</li>
                  <li>• Entendre un bruit anormal (compresseur, détendeur)</li>
                  <li>• Sentir une odeur (huile brûlée, NH3)</li>
                  <li>• Tester l&apos;étanchéité (azote + savon, détecteur électronique)</li>
                  <li>• Voir l&apos;intérieur d&apos;un compresseur hermétique</li>
                  <li>• Détecter une fuite invisible (micro-fissure sans trace d&apos;huile)</li>
                  <li>• Connaître l&apos;historique terrain non-visible</li>
                </ul>
              </section>

              {/* Niveau de fiabilité réel */}
              <section>
                <h3 className="text-[15px] font-semibold mb-2">Niveau de fiabilité réel</h3>
                <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] divide-y divide-black/[0.06] overflow-hidden">
                  <FiabiliteRow label="Identification du composant" value="~90%" sub="si photo nette" />
                  <FiabiliteRow label="Détection défauts évidents" value="~85%" sub="corrosion, huile, encrassement" />
                  <FiabiliteRow label="Diagnostic cause probable" value="~70%" sub="hypothèse plausible, pas certitude" />
                  <FiabiliteRow label="Devis estimé" value="±30-50%" sub="indicatif, chiffrage final sur site" />
                </div>
              </section>

              {/* Disclaimer responsabilité */}
              <section className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-start gap-2.5">
                  <svg className="shrink-0 mt-0.5 text-amber-700" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <div className="text-[12.5px] text-amber-900 leading-relaxed">
                    <strong>Le diagnostic IA est une AIDE, pas un remplacement.</strong> La responsabilité technique et réglementaire reste celle du technicien qui intervient. Toujours valider sur site avec tes outils (détecteur de fuite, manomètre, station de récup) avant toute action irréversible.
                  </div>
                </div>
              </section>

              <div className="text-[11px] text-black/40 text-center pb-2">
                Modèle : Claude Opus 4.7 vision · Anthropic
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

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
              href={
                currentDiagId
                  ? `/m/intervention/nouvelle?diagnosticId=${currentDiagId}`
                  : "/m/intervention/nouvelle"
              }
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

      {/* Toast partage (fallback non-natif uniquement) */}
      {shareToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 px-4 py-2.5 rounded-full bg-black/85 text-white text-[12.5px] font-medium shadow-lg backdrop-blur"
        >
          {shareToast}
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

function FiabiliteRow({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-[#111] font-medium leading-tight">{label}</div>
        <div className="text-[11px] text-black/50 mt-0.5">{sub}</div>
      </div>
      <div className="text-[15px] font-semibold text-[#A16207] tabular-nums shrink-0 ml-3">
        {value}
      </div>
    </div>
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

