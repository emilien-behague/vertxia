"use client";

// Historique des diagnostics IA — Rank 11 brainstorm.
// Liste les 20 derniers diagnostics réalisés (stockés en localStorage
// user-scoped) avec thumbnail photo + composant + nb défauts + date.
// Tap sur un item → /m/diagnostic/[id] qui réaffiche le résultat complet.

import { useEffect, useState } from "react";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/mobile-header";
import {
  listDiagnostics,
  clearAllDiagnostics,
  type StoredDiagnostic,
} from "@/lib/intervention/diagnostic-storage";
import { GRAVITE_STYLES, type DefautGravite } from "@/lib/intervention/vision-diagnostic";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const sameYest = d.toDateString() === yest.toDateString();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `Aujourd'hui · ${hh}h${mm}`;
  if (sameYest) return `Hier · ${hh}h${mm}`;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Renvoie la gravité max trouvée dans les défauts d'un diagnostic */
function maxGravite(d: StoredDiagnostic): DefautGravite | null {
  if (d.result.defautsDetectes.length === 0) return null;
  const order: DefautGravite[] = ["critique", "urgent", "surveiller", "info"];
  for (const g of order) {
    if (d.result.defautsDetectes.some((x) => x.gravite === g)) return g;
  }
  return null;
}

export default function DiagnosticHistoriquePage() {
  const [items, setItems] = useState<StoredDiagnostic[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(listDiagnostics());
    setLoaded(true);
  }, []);

  function handleClearAll() {
    if (!window.confirm("Effacer tout l'historique de diagnostics ?\n\nCette action est irréversible.")) return;
    clearAllDiagnostics();
    setItems([]);
  }

  return (
    <>
      <MobileHeader
        title="🤖 Historique diagnostics"
        largeTitle
        backHref="/m/diagnostic"
      />

      {/* Tuile rose XL — Nouveau diagnostic (coherent avec home + page diag) */}
      <div className="px-4 mt-2 mb-3">
        <Link
          href="/m/diagnostic"
          className="relative block rounded-3xl shadow-lg shadow-black/10 active:scale-[0.98] transition-transform overflow-hidden px-5 py-5"
          style={{
            background: "linear-gradient(135deg, #f43f5e 0%, #db2777 100%)",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl leading-none drop-shadow">📷</div>
            <div className="flex-1 min-w-0">
              <div className="text-[16px] font-bold uppercase tracking-wide text-white leading-tight">
                Nouveau diagnostic
              </div>
              <div className="text-[12px] text-white/85 mt-0.5">
                Photo → l&apos;IA détecte les défauts
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
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </Link>
      </div>

      {/* Liste */}
      {items.length > 0 && (
        <div className="px-4 space-y-2.5 pb-4">
          {items.map((d) => {
            const grav = maxGravite(d);
            const dotColor = grav ? GRAVITE_STYLES[grav].dot : "bg-emerald-500";
            return (
              <Link
                key={d.id}
                href={`/m/diagnostic/${d.id}`}
                className="flex items-stretch gap-3 rounded-2xl bg-white ring-1 ring-black/[0.04] overflow-hidden active:bg-black/[0.02] transition-colors"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {/* Thumbnail */}
                <div className="shrink-0 w-20 h-20 bg-black/[0.04] relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.imageDataUrl}
                    alt="Diagnostic"
                    className="w-full h-full object-cover"
                  />
                  <div className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${dotColor} ring-2 ring-white`} />
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0 py-2 pr-3 flex flex-col justify-center">
                  <div className="text-[14px] font-medium text-[#111] leading-tight truncate">
                    {d.result.composantIdentifie || "Composant non identifié"}
                  </div>
                  <div className="text-[12px] text-black/55 leading-snug mt-0.5 truncate">
                    {d.result.defautsDetectes.length === 0
                      ? "Aucun défaut"
                      : `${d.result.defautsDetectes.length} défaut${d.result.defautsDetectes.length > 1 ? "s" : ""}`}
                    {d.contexteNote && ` · ${d.contexteNote.slice(0, 40)}${d.contexteNote.length > 40 ? "…" : ""}`}
                  </div>
                  <div className="text-[11px] text-black/40 mt-1">
                    {fmtDate(d.createdAt)}
                  </div>
                </div>

                <div className="shrink-0 self-center pr-3 text-black/25">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* État vide */}
      {loaded && items.length === 0 && (
        <div className="px-5 mt-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-black/[0.04] mb-4 text-black/35">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </div>
          <h2 className="text-[18px] font-semibold mb-2">Aucun diagnostic enregistré</h2>
          <p className="text-[14px] text-black/55 leading-relaxed max-w-xs mx-auto">
            Tes diagnostics IA seront sauvegardés ici automatiquement. Tu peux ensuite les rouvrir pour partager au client ou comparer avec une intervention future.
          </p>
        </div>
      )}

      {/* Footer : effacer tout */}
      {items.length > 0 && (
        <div className="px-4 mt-6 mb-2">
          <button
            type="button"
            onClick={handleClearAll}
            className="w-full px-4 py-2.5 rounded-2xl text-[13px] text-red-600 active:bg-red-50 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Effacer tout l&apos;historique
          </button>
          <div className="text-[10px] text-black/35 text-center mt-2">
            {items.length}/20 diagnostics stockés · plus ancien supprimé auto au-delà
          </div>
        </div>
      )}
    </>
  );
}
