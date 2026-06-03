"use client";

// useSearchParams = obligatoire de wrap dans <Suspense> en Next.js 16 (cf bug
// déjà rencontré sur /m/intervention/nouvelle, commit bde449a).
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection, InsetRow } from "@/components/mobile/inset-list";
import {
  listInterventions,
  getStats,
  type StoredIntervention,
} from "@/lib/intervention-storage";
import { listEquipements, type StoredEquipement } from "@/lib/equipement";

const TYPE_LABELS: Record<string, string> = {
  recuperation: "Récupération",
  demantelement: "Démantèlement",
  controle_periodique: "Contrôle d'étanchéité",
  controle_non_periodique: "Contrôle suite fuite",
  mise_service: "Mise en service",
  maintenance: "Maintenance",
  assemblage: "Assemblage",
  modification: "Modification",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function HistoriqueContent() {
  const searchParams = useSearchParams();
  const eqIdParam = searchParams.get("equipement");

  const [allInterventions, setAllInterventions] = useState<StoredIntervention[]>([]);
  const [equipement, setEquipement] = useState<StoredEquipement | null>(null);

  useEffect(() => {
    setAllInterventions(listInterventions());
    if (eqIdParam) {
      const eq = listEquipements().find((e) => e.id === eqIdParam);
      setEquipement(eq ?? null);
    } else {
      setEquipement(null);
    }
  }, [eqIdParam]);

  // Filtre par numéro de série de l'équipement (lien : intervention.numeroSerieEquipement)
  const interventions = useMemo(() => {
    if (!equipement) return allInterventions;
    const target = equipement.numeroSerie.trim().toLowerCase();
    return allInterventions.filter(
      (i) => i.numeroSerieEquipement?.trim().toLowerCase() === target
    );
  }, [allInterventions, equipement]);

  const stats = useMemo(() => getStats(interventions), [interventions]);

  // Regroupe par mois (YYYY-MM)
  const byMonth = useMemo(() => {
    const groups: Record<string, StoredIntervention[]> = {};
    for (const i of interventions) {
      const key = i.createdAt.slice(0, 7);
      (groups[key] ||= []).push(i);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [interventions]);

  function monthLabel(key: string): string {
    const d = new Date(key + "-01");
    return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }

  // Retour : si on est en mode filtré, retour sur la fiche équipement
  const backHref = equipement ? `/eq/${equipement.id}` : "/m";
  const title = equipement ? "Historique équipement" : "Historique";

  return (
    <>
      <MobileHeader title={title} largeTitle backHref={backHref} />

      {/* Bandeau contexte équipement si filtré */}
      {equipement && (
        <div className="mx-4 mt-2 mb-3 px-4 py-3 rounded-2xl bg-[#A16207]/8 ring-1 ring-[#A16207]/15">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-[#A16207]">
                Filtré sur cet équipement
              </div>
              <div className="mt-1 text-[14px] font-medium text-[#111] truncate">
                {equipement.modele}
              </div>
              <div className="text-[12px] text-black/55 truncate">
                {equipement.clientName} · SN {equipement.numeroSerie}
              </div>
            </div>
          </div>
          <Link
            href="/m/historique"
            className="mt-2 inline-block text-[11px] text-[#A16207] underline active:opacity-70"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Voir tout l&apos;historique →
          </Link>
        </div>
      )}

      {/* Stats inline */}
      <section className="px-4 mt-2">
        <div className="grid grid-cols-3 gap-2.5">
          <Stat label="Total" value={stats.total} />
          <Stat label="Ce mois" value={stats.thisMonth} />
          <Stat label="Avec BSFF" value={stats.withBsff} color="text-emerald-600" />
        </div>
      </section>

      {interventions.length === 0 ? (
        <div className="px-5 mt-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-black/[0.04] mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
          </div>
          <div className="text-[15px] text-black/55">
            {equipement
              ? "Aucune intervention sur cet équipement"
              : "Aucune intervention enregistrée"}
          </div>
          {equipement && (
            <Link
              href={`/m/intervention/nouvelle?equipement=${equipement.id}`}
              className="inline-block mt-4 px-5 py-3 rounded-2xl bg-[#111] text-white text-[14px] font-medium active:bg-black/90"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              + Créer la première intervention
            </Link>
          )}
        </div>
      ) : (
        byMonth.map(([month, items]) => (
          <InsetListSection key={month} title={monthLabel(month)}>
            {items.map((i) => (
              <InsetRow
                key={i.id}
                href={`/m/historique/${i.id}`}
                showChevron
                label={TYPE_LABELS[i.typeIntervention] || i.typeIntervention}
                sublabel={`${i.clientName ?? "Sans client"} · ${fmtDate(i.createdAt)} · ${fmtTime(i.createdAt)}`}
                leading={
                  <span
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                      i.bsffId ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </span>
                }
                trailing={
                  i.bsffId ? (
                    <span className="text-[10px] font-mono tracking-widest text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      BSFF
                    </span>
                  ) : undefined
                }
              />
            ))}
          </InsetListSection>
        ))
      )}
    </>
  );
}

export default function MobileHistoriquePage() {
  return (
    <Suspense
      fallback={
        <div className="px-5 py-20 text-center">
          <div className="inline-block w-8 h-8 border-2 border-black/15 border-t-[#111] rounded-full animate-spin" />
        </div>
      }
    >
      <HistoriqueContent />
    </Suspense>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-black/[0.04] text-center">
      <div className={`text-2xl font-semibold tracking-tight ${color ?? "text-[#111]"}`}>{value}</div>
      <div className="text-[10px] font-medium text-black/45 uppercase tracking-wide mt-0.5">
        {label}
      </div>
    </div>
  );
}
