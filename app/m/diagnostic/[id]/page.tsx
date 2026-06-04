"use client";

// Page détail d'un diagnostic passé (Rank 11 brainstorm).
// Lit le diagnostic stocké en localStorage via getDiagnostic(id) et affiche
// la photo + le résultat complet (réutilise le même layout que /m/diagnostic
// en phase result). Possibilité de partager ou supprimer.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/mobile-header";
import {
  getDiagnostic,
  deleteDiagnostic,
  type StoredDiagnostic,
} from "@/lib/diagnostic-storage";
import {
  GRAVITE_LABELS,
  GRAVITE_STYLES,
  DELAI_LABELS,
} from "@/lib/vision-diagnostic";
import { shareDiagnostic } from "@/lib/diagnostic-share";

function fmtDateLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DiagnosticDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [diag, setDiag] = useState<StoredDiagnostic | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  useEffect(() => {
    const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
    if (id) setDiag(getDiagnostic(id));
    setLoaded(true);
  }, [params.id]);

  async function handleShare() {
    if (!diag) return;
    const outcome = await shareDiagnostic({
      imageDataUrl: diag.imageDataUrl,
      result: diag.result,
      filenameHint: diag.createdAt.slice(0, 10),
    });
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

  function handleDelete() {
    if (!diag) return;
    if (!window.confirm("Supprimer ce diagnostic ?\n\nAction irréversible.")) return;
    deleteDiagnostic(diag.id);
    router.push("/m/diagnostic/historique");
  }

  if (loaded && !diag) {
    return (
      <>
        <MobileHeader title="Diagnostic" largeTitle backHref="/m/diagnostic/historique" />
        <div className="px-5 mt-10 text-center">
          <div className="text-[16px] text-[#111] font-medium mb-2">Diagnostic introuvable</div>
          <div className="text-[13px] text-black/55 mb-6">Ce diagnostic n&apos;existe plus dans ton historique.</div>
          <Link
            href="/m/diagnostic/historique"
            className="inline-block px-5 py-2.5 rounded-2xl bg-[#111] text-white text-[13px] font-medium active:bg-black/80 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Retour à l&apos;historique
          </Link>
        </div>
      </>
    );
  }

  if (!diag) {
    return (
      <>
        <MobileHeader title="Diagnostic" largeTitle backHref="/m/diagnostic/historique" />
      </>
    );
  }

  const r = diag.result;

  return (
    <>
      <MobileHeader title="Diagnostic" largeTitle backHref="/m/diagnostic/historique" />

      <div className="px-4 pt-2 pb-4 space-y-4">
        <div className="text-[12px] text-black/55 px-1">
          {fmtDateLong(diag.createdAt)}
        </div>

        {/* Photo */}
        <div className="rounded-2xl overflow-hidden ring-1 ring-black/[0.06] bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={diag.imageDataUrl}
            alt="Composant analysé"
            className="w-full h-auto block max-h-72 object-cover"
          />
        </div>

        {/* Contexte note si présent */}
        {diag.contexteNote && (
          <section className="rounded-2xl bg-[#A16207]/8 border border-[#A16207]/15 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-[#A16207] font-medium mb-1">
              Contexte au moment du diagnostic
            </div>
            <div className="text-[13px] text-[#111] italic leading-snug">
              «{diag.contexteNote}»
            </div>
          </section>
        )}

        {/* Composant identifié */}
        <section className="rounded-2xl bg-white ring-1 ring-black/[0.04] p-4">
          <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1">
            Composant identifié
          </div>
          <div className="text-[16px] font-semibold text-[#111] leading-tight">
            {r.composantIdentifie || "Non identifié"}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] uppercase tracking-wider text-black/45 font-medium">
              Confiance
            </span>
            <ConfianceChip confiance={r.confiance} />
          </div>
        </section>

        {/* Défauts détectés */}
        {r.defautsDetectes.length > 0 ? (
          <section className="rounded-2xl bg-white ring-1 ring-black/[0.04] p-4">
            <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-2">
              Défauts détectés ({r.defautsDetectes.length})
            </div>
            <ul className="space-y-3">
              {r.defautsDetectes.map((d, i) => {
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
        ) : (
          <section className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
            <div className="flex items-center gap-2 text-[14px] font-medium text-emerald-800">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Aucun défaut visible détecté
            </div>
          </section>
        )}

        {/* Cause + action + devis */}
        <section className="rounded-2xl bg-white ring-1 ring-black/[0.04] p-4 space-y-3">
          {r.causeProbable && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1">
                Cause probable
              </div>
              <div className="text-[13.5px] text-[#111] leading-relaxed">
                {r.causeProbable}
              </div>
            </div>
          )}
          {r.actionRecommandee && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1">
                Action recommandée
              </div>
              <div className="text-[13.5px] text-[#111] leading-relaxed">
                {r.actionRecommandee}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-black/[0.05]">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1">
                Délai
              </div>
              <div className="text-[13px] font-medium text-[#111]">
                {DELAI_LABELS[r.delaiIntervention]}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1">
                Devis estimé
              </div>
              <div className="text-[13px] font-medium text-[#111]">
                {r.devisEstimeMin !== null && r.devisEstimeMax !== null
                  ? `${r.devisEstimeMin}–${r.devisEstimeMax} € HT`
                  : "À chiffrer sur site"}
              </div>
            </div>
          </div>
        </section>

        {r.notesContexte && (
          <section className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-amber-800/70 font-medium mb-1">
              Note du diagnostic
            </div>
            <div className="text-[12.5px] text-amber-900 leading-snug">{r.notesContexte}</div>
          </section>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-2">
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
            Partager
          </button>
          <Link
            href={`/m/intervention/nouvelle?diagnosticId=${diag.id}`}
            className="block w-full px-4 py-3 rounded-2xl bg-[#111] text-white text-[14px] font-medium text-center active:bg-black/80 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Créer une intervention pour ce composant
          </Link>
          <Link
            href="/m/diagnostic"
            className="block w-full px-4 py-3 rounded-2xl bg-[#A16207] text-white text-[14px] font-medium text-center active:opacity-90 transition-opacity"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Nouveau diagnostic
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            className="w-full px-4 py-2.5 rounded-2xl text-[13px] text-red-600 active:bg-red-50 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Supprimer ce diagnostic
          </button>
        </div>

        <div className="text-[10px] text-black/35 text-center pt-2">
          Diagnostic généré par Claude Opus 4.7 vision · vertxia.com
        </div>
      </div>

      {shareToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 px-4 py-2.5 rounded-full bg-black/85 text-white text-[12.5px] font-medium shadow-lg backdrop-blur"
        >
          {shareToast}
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

