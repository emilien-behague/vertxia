"use client";

// Page préparation démo CAPEB — mobile native + React standard.
// Source unique du seed : lib/demo-seed.ts (inclut les unités intérieures multi).
// On NE duplique PAS la logique ici pour éviter qu'un fix dans un seed soit oublié
// dans l'autre. Bug rencontré le 02/06/2026 : duplication faisait perdre les 19 unités
// intérieures ajoutées suite retour terrain père d'Emilien (frigo pro).

import { useState } from "react";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { seedDemoCapeb, clearAllVertxiaData } from "@/lib/demo-seed";

type Status =
  | { type: "idle" }
  | { type: "ok"; message: string }
  | { type: "err"; message: string };

export default function MobileAdminSeedPage() {
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [busy, setBusy] = useState(false);

  function handleSeed() {
    if (busy) return;
    setBusy(true);
    try {
      const r = seedDemoCapeb();
      setStatus({
        type: "ok",
        message: `✅ Démo seedée : ${r.equipements} équipements (avec unités intérieures multi-systèmes) + ${r.interventions} interventions + profil entreprise.`,
      });
    } catch (e) {
      setStatus({ type: "err", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  function handleClear() {
    if (busy) return;
    if (!confirm("Vider TOUT le localStorage Vertxia ? Irréversible.")) return;
    setBusy(true);
    try {
      clearAllVertxiaData();
      setStatus({ type: "ok", message: "✅ Toutes les données Vertxia ont été supprimées." });
    } catch (e) {
      setStatus({ type: "err", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <MobileHeader title="Démo CAPEB" largeTitle backHref="/m/profil" />

      <div className="px-5 mt-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-[10px] font-semibold tracking-widest uppercase">Zone admin</span>
        </div>
        <p className="mt-3 text-[14px] text-black/55 leading-relaxed">
          Réinitialise l&apos;app dans un état propre + crédible avant une démo terrain
          (CAPEB 25 juin, JL, prospects). 1 entreprise · 5 équipements · 2 interventions.
        </p>
      </div>

      <div className="px-4 mt-6 space-y-3">
        <button
          type="button"
          onClick={handleSeed}
          disabled={busy}
          className="w-full px-5 py-5 rounded-2xl bg-[#111] text-white text-left active:bg-black/90 transition-colors disabled:opacity-60"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-white/55">
                Action principale
              </div>
              <div className="mt-1 text-[15px] font-medium">
                {busy ? "Seed en cours…" : "RÉINITIALISER EN MODE DÉMO CAPEB"}
              </div>
              <div className="text-[12px] text-white/60 mt-0.5">
                Couvre tous les statuts visuels
              </div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0">
              <path d="M3 12a9 9 0 1 0 9-9 9.74 9.74 0 0 0-6.74 2.74L3 8" />
              <polyline points="3 3 3 8 8 8" />
            </svg>
          </div>
        </button>

        <button
          type="button"
          onClick={handleClear}
          disabled={busy}
          className="w-full px-5 py-4 rounded-2xl bg-white border border-red-200 text-red-700 text-[13px] tracking-widest uppercase font-medium active:bg-red-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          Vider tout (clean state)
        </button>
      </div>

      {status.type !== "idle" && (
        <div
          className={`mx-4 mt-4 px-5 py-4 rounded-2xl text-[14px] ${
            status.type === "ok"
              ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
              : "bg-red-50 text-red-700 ring-1 ring-red-200"
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="px-5 mt-10 text-[12px] text-black/45 leading-relaxed">
        <div className="font-semibold text-black/65 mb-2">À faire avant chaque démo :</div>
        <ol className="space-y-1.5 list-decimal list-inside">
          <li>Cliquer « Réinitialiser en mode démo »</li>
          <li>
            Aller sur <span className="text-[#A16207]">Parc</span> → bouton « Imprimer stickers QR »
          </li>
          <li>Imprimer + coller 2-3 stickers sur des équipements démo</li>
          <li>Pendant la démo : scanner QR avec iPhone → flow scan → intervention → CERFA</li>
          <li>À la fin : revenir ici, « Vider tout »</li>
        </ol>
      </div>
    </>
  );
}
