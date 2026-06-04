"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection, InsetRow } from "@/components/mobile/inset-list";
import { listInterventions } from "@/lib/intervention-storage";
import { listDiagnostics } from "@/lib/diagnostic-storage";
import {
  listEquipements,
  computeAllStatus,
  getEquipementStats,
  type EquipementWithStatus,
  type ControleStatut,
} from "@/lib/equipement";
import { detectPredictiveSignals } from "@/lib/predictive-maintenance";
import { downloadStickerSheet } from "@/lib/qrcode-client";

type Filter = "all" | "a_risque" | "en_retard" | "a_relancer" | "a_programmer" | "ok";

const FILTER_LABELS: Record<Filter, string> = {
  all: "Tous",
  a_risque: "Risque",
  en_retard: "Retard",
  a_relancer: "Relance",
  a_programmer: "À prog.",
  ok: "À jour",
};

function fmtJours(j: number | null): string {
  if (j === null) return "";
  if (j < 0) return `${Math.abs(j)} j de retard`;
  if (j === 0) return "aujourd'hui";
  if (j === 1) return "demain";
  if (j < 31) return `dans ${j} j`;
  if (j < 365) return `dans ${Math.round(j / 30)} mois`;
  return `dans ${Math.round(j / 365)} an`;
}

const STATUS_DOT: Record<ControleStatut, string> = {
  en_retard: "bg-red-500",
  a_relancer: "bg-orange-500",
  a_programmer: "bg-amber-500",
  jamais: "bg-blue-500",
  ok: "bg-emerald-500",
  exempt: "bg-black/25",
};

const STATUS_TEXT: Record<ControleStatut, string> = {
  en_retard: "text-red-600",
  a_relancer: "text-orange-600",
  a_programmer: "text-amber-600",
  jamais: "text-blue-600",
  ok: "text-emerald-600",
  exempt: "text-black/45",
};

export default function MobileEquipementsPage() {
  const [items, setItems] = useState<EquipementWithStatus[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [stickersBusy, setStickersBusy] = useState(false);

  useEffect(() => {
    setItems(computeAllStatus(listEquipements(), listInterventions()));
  }, []);

  const stats = useMemo(() => getEquipementStats(items), [items]);

  // Set des IDs d'equipements avec signaux predictifs (alerte ou critique).
  // Surveillance seul ne compte pas — trop bruyant pour un filtre dashboard.
  const equipementsARisque = useMemo(() => {
    const allInterv = listInterventions();
    const allDiag = listDiagnostics();
    const set = new Set<string>();
    for (const eq of items) {
      const sigs = detectPredictiveSignals(eq, allInterv, allDiag);
      if (sigs.some((s) => s.gravite === "critique" || s.gravite === "alerte")) {
        set.add(eq.id);
      }
    }
    return set;
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "a_risque") {
      return items.filter((e) => equipementsARisque.has(e.id));
    }
    if (filter === "a_programmer") {
      return items.filter((e) => e.statut === "a_programmer" || e.statut === "jamais");
    }
    if (filter === "a_relancer") {
      return items.filter((e) => e.statut === "a_relancer");
    }
    return items.filter((e) => e.statut === filter);
  }, [items, filter, equipementsARisque]);

  async function handleStickers() {
    if (stickersBusy || items.length === 0) return;
    setStickersBusy(true);
    try {
      await downloadStickerSheet(
        items.map((e) => ({ id: e.id, modele: e.modele, numeroSerie: e.numeroSerie }))
      );
    } finally {
      setStickersBusy(false);
    }
  }

  return (
    <>
      <MobileHeader title="Parc équipements" largeTitle />

      {/* Stats inline */}
      <section className="px-4 mt-2">
        <div className="grid grid-cols-4 gap-2">
          <MiniStat label="Total" value={stats.total} color="text-[#111]" />
          <MiniStat
            label="Risque"
            value={equipementsARisque.size}
            color="text-orange-600"
            pulse={equipementsARisque.size > 0}
          />
          <MiniStat label="Retard" value={stats.enRetard} color="text-red-600" pulse={stats.enRetard > 0} />
          <MiniStat label="À jour" value={stats.ok} color="text-emerald-600" />
        </div>
      </section>

      {/* Filter segmented control */}
      <section className="px-4 mt-5">
        <div className="inline-flex bg-black/[0.05] rounded-xl p-1 w-full">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                filter === f
                  ? "bg-white text-[#111] shadow-sm shadow-black/[0.06]"
                  : "text-black/60 active:text-black/90"
              }`}
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </section>

      {/* Liste équipements */}
      {filtered.length === 0 ? (
        <div className="px-5 mt-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-black/[0.04] mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="14" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="text-[15px] text-black/55">
            {items.length === 0 ? "Aucun équipement enregistré" : "Aucun équipement dans cette catégorie"}
          </div>
          {items.length === 0 && (
            <Link
              href="/m/equipements/nouveau"
              className="inline-block mt-5 px-5 py-3 bg-[#111] text-white text-[14px] font-medium rounded-xl active:bg-black/90 transition-colors"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              + Ajouter un équipement
            </Link>
          )}
        </div>
      ) : (
        <InsetListSection>
          {filtered.map((eq) => (
            <InsetRow
              key={eq.id}
              href={`/eq/${eq.id}`}
              leading={
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/[0.04]">
                  <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[eq.statut]}`} />
                </span>
              }
              label={eq.modele}
              sublabel={
                `${eq.clientName} · ${eq.fluide.code} · ${eq.chargeKg.toFixed(1).replace(".", ",")} kg` +
                (eq.unitesInterieures && eq.unitesInterieures.length > 0
                  ? ` · ${eq.unitesInterieures.length} unité${eq.unitesInterieures.length > 1 ? "s" : ""} int.`
                  : "")
              }
              trailing={
                eq.joursAvantControle !== null ? (
                  <span className={`text-[12px] font-medium ${STATUS_TEXT[eq.statut]}`}>
                    {fmtJours(eq.joursAvantControle)}
                  </span>
                ) : eq.statut === "exempt" ? (
                  <span className="text-[12px] text-black/35">Exempté</span>
                ) : (
                  <span className="text-[12px] text-blue-600 font-medium">À programmer</span>
                )
              }
              showChevron
            />
          ))}
        </InsetListSection>
      )}

      {/* Actions globales */}
      {items.length > 0 && (
        <InsetListSection title="Actions">
          <InsetRow
            onClick={handleStickers}
            label={stickersBusy ? "Génération du PDF…" : "Imprimer stickers QR (PDF A4)"}
            sublabel="8 stickers par feuille · à coller sur les équipements"
            leading={
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 text-amber-700">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="3" height="3" />
                  <path d="M21 14h-3v3M18 21h3v-3" />
                </svg>
              </span>
            }
          />
          <InsetRow
            href="/m/equipements/nouveau"
            label="+ Ajouter un équipement"
            sublabel="Saisie rapide depuis le téléphone"
            leading={
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#111] text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            }
            showChevron
          />
          <InsetRow
            href="/m/import-registre"
            label="Importer un registre papier"
            sublabel="Photos → IA détecte le parc → import bulk"
            leading={
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </span>
            }
            showChevron
          />
        </InsetListSection>
      )}
      {/* Si parc vide : on propose quand meme l'import registre (gros usecase
          pour les nouveaux users qui veulent migrer leur ancien systeme) */}
      {items.length === 0 && (
        <InsetListSection title="Migration depuis l'ancien système">
          <InsetRow
            href="/m/import-registre"
            label="Importer un registre papier"
            sublabel="Photos → IA détecte le parc → import bulk en 10 min"
            leading={
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </span>
            }
            showChevron
          />
        </InsetListSection>
      )}
    </>
  );
}

function MiniStat({
  label,
  value,
  color,
  pulse,
}: {
  label: string;
  value: number;
  color: string;
  pulse?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-black/[0.04] text-center">
      <div className="flex items-center justify-center gap-1">
        <div className={`text-2xl font-semibold tracking-tight ${color}`}>{value}</div>
        {pulse && value > 0 && (
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-red-500 opacity-50 animate-ping" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-red-500" />
          </span>
        )}
      </div>
      <div className="text-[10px] font-medium text-black/45 uppercase tracking-wide mt-0.5">
        {label}
      </div>
    </div>
  );
}
