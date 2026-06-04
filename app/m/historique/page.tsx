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
import {
  listDiagnostics,
  type StoredDiagnostic,
} from "@/lib/diagnostic-storage";
import {
  GRAVITE_STYLES,
  type DefautGravite,
} from "@/lib/vision-diagnostic";

// Discriminated union pour le timeline mergé : une ligne = soit une
// intervention, soit un diagnostic IA. createdAt remonté en haut pour le
// tri sans avoir à creuser dans data.
type TimelineItem =
  | { kind: "intervention"; createdAt: string; data: StoredIntervention }
  | { kind: "diagnostic"; createdAt: string; data: StoredDiagnostic };

/** Renvoie la gravité max trouvée dans les défauts d'un diagnostic, ou null
 *  si aucun défaut. Ordre décroissant : critique > urgent > surveiller > info. */
function maxGraviteDiagnostic(d: StoredDiagnostic): DefautGravite | null {
  if (d.result.defautsDetectes.length === 0) return null;
  const order: DefautGravite[] = ["critique", "urgent", "surveiller", "info"];
  for (const g of order) {
    if (d.result.defautsDetectes.some((x) => x.gravite === g)) return g;
  }
  return null;
}

const GRAVITE_BADGE_LABELS: Record<DefautGravite, string> = {
  info: "INFO",
  surveiller: "SURVEILLER",
  urgent: "URGENT",
  critique: "CRITIQUE",
};

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
  const [diagnostics, setDiagnostics] = useState<StoredDiagnostic[]>([]);
  const [equipement, setEquipement] = useState<StoredEquipement | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    // 1. Interventions locales (les miennes, stockées sur ce device)
    const local = listInterventions();
    setAllInterventions(local);

    // 1bis. Diagnostics IA locaux (cappés à 20 par diagnostic-storage)
    setDiagnostics(listDiagnostics());

    // 2. Interventions sur mes équipements faites par des confrères (via lien
    //    magique). On les fetch et on merge avec les locales (dédup par id).
    (async () => {
      try {
        const res = await fetch("/api/public/my-interventions", {
          method: "GET",
          headers: { "cache-control": "no-store" },
        });
        if (!res.ok) return;
        const json = (await res.json()) as { data: Record<string, unknown>[] };
        if (!Array.isArray(json.data) || json.data.length === 0) return;
        const remote: StoredIntervention[] = json.data.map((row) => ({
          id: row.id as string,
          createdAt: row.date_iso as string,
          typeIntervention: row.type_intervention as StoredIntervention["typeIntervention"],
          fluide: {
            code: row.fluide_code as string,
            label: (row.fluide_label as string) ?? (row.fluide_code as string),
            gwp: (row.fluide_gwp as number) ?? 0,
          },
          weight: Number(row.weight_kg) || 0,
          packagingNumero: (row.packaging_numero as string) ?? "",
          clientName: (row.client_name as string) ?? null,
          modeleEquipement: (row.modele_equipement as string) ?? undefined,
          numeroSerieEquipement: (row.numero_serie_equipement as string) ?? undefined,
          lieuIntervention: (row.lieu_intervention as string) ?? undefined,
          bsffId: (row.bsff_id as string) ?? undefined,
          controleDetails: (row.controle_details as StoredIntervention["controleDetails"]) ?? undefined,
          notes: (row.notes as string) ?? undefined,
          hasDetenteurSignature: Boolean(row.has_detenteur_signature),
          detenteurName: (row.detenteur_name as string) ?? undefined,
          detenteurQuality: (row.detenteur_quality as StoredIntervention["detenteurQuality"]) ?? undefined,
        }));
        // Merge sans doublon (les interventions locales que j'ai aussi syncé
        // côté serveur arriveraient en double sinon).
        const seen = new Set(local.map((i) => i.id));
        const merged = [...local];
        for (const r of remote) {
          if (!seen.has(r.id)) {
            merged.push(r);
            seen.add(r.id);
          }
        }
        merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setAllInterventions(merged);
      } catch {
        // Network ou pas connecté → on garde juste les interventions locales
      }
    })();

    if (eqIdParam) {
      const eq = listEquipements().find((e) => e.id === eqIdParam);
      setEquipement(eq ?? null);
    } else {
      setEquipement(null);
    }
  }, [eqIdParam]);

  // Timeline mergée : interventions + diagnostics dans une seule liste,
  // triée par date descendante. Les diagnostics IA ne portent pas de lien
  // équipement aujourd'hui (pas de numeroSerie dans StoredDiagnostic), donc
  // ils ne s'affichent QUE sur la vue globale, pas sur la vue filtrée par
  // équipement. Si tu veux les voir filtrés, c'est via /m/diagnostic/historique.
  const allTimeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    for (const i of allInterventions) {
      items.push({ kind: "intervention", createdAt: i.createdAt, data: i });
    }
    for (const d of diagnostics) {
      items.push({ kind: "diagnostic", createdAt: d.createdAt, data: d });
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  }, [allInterventions, diagnostics]);

  // Filtre par n° de série d'équipement : applicable seulement aux
  // interventions (diagnostics non liés à un équipement aujourd'hui).
  const byEquipement = useMemo<TimelineItem[]>(() => {
    if (!equipement) return allTimeline;
    const target = equipement.numeroSerie.trim().toLowerCase();
    return allTimeline.filter((item) => {
      if (item.kind !== "intervention") return false;
      return item.data.numeroSerieEquipement?.trim().toLowerCase() === target;
    });
  }, [allTimeline, equipement]);

  // Recherche libre — étendue aux 2 kinds. Pour les diagnostics on indexe
  // le composant identifié, le contexte note, et les noms de défauts.
  const timeline = useMemo<TimelineItem[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return byEquipement;
    const terms = q.split(/\s+/).filter(Boolean);
    return byEquipement.filter((item) => {
      let haystack = "";
      if (item.kind === "intervention") {
        const i = item.data;
        haystack = [
          i.clientName ?? "",
          i.modeleEquipement ?? "",
          i.numeroSerieEquipement ?? "",
          i.fluide?.code ?? "",
          i.fluide?.label ?? "",
          TYPE_LABELS[i.typeIntervention] ?? i.typeIntervention,
          i.lieuIntervention ?? "",
          i.notes ?? "",
        ]
          .join(" ")
          .toLowerCase();
      } else {
        const d = item.data;
        haystack = [
          d.result.composantIdentifie ?? "",
          d.contexteNote ?? "",
          d.result.defautsDetectes.map((x) => `${x.nom} ${x.description}`).join(" "),
          d.result.actionRecommandee,
          d.result.causeProbable,
          "diagnostic ia",
        ]
          .join(" ")
          .toLowerCase();
      }
      return terms.every((t) => haystack.includes(t));
    });
  }, [byEquipement, search]);

  // Stats : restent calculées sur les interventions visibles dans la
  // timeline (post-filtre). Les diagnostics ne polluent pas les compteurs
  // BSFF/Ce mois — on les compte séparément.
  const visibleInterventions = useMemo(
    () =>
      timeline
        .filter((x): x is Extract<TimelineItem, { kind: "intervention" }> => x.kind === "intervention")
        .map((x) => x.data),
    [timeline]
  );
  const visibleDiagnosticsCount = useMemo(
    () => timeline.filter((x) => x.kind === "diagnostic").length,
    [timeline]
  );
  const stats = useMemo(() => getStats(visibleInterventions), [visibleInterventions]);

  // Regroupe par mois (YYYY-MM) — sur la timeline unifiée
  const byMonth = useMemo(() => {
    const groups: Record<string, TimelineItem[]> = {};
    for (const item of timeline) {
      const key = item.createdAt.slice(0, 7);
      (groups[key] ||= []).push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [timeline]);

  function monthLabel(key: string): string {
    const d = new Date(key + "-01");
    return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }

  // Retour : uniquement si on est en mode filtré sur une fiche équipement.
  // Sur l'historique global (accès via bottom tab), pas de bouton retour
  // (redondant avec la tab bar).
  const backHref = equipement ? `/eq/${equipement.id}` : undefined;
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

      {/* Barre de recherche libre — match sur client, modèle, n° de série,
          fluide, type, lieu, notes. */}
      <section className="px-4 mt-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Client, équipement, n° série, fluide…"
            className="w-full h-11 pl-9 pr-9 rounded-2xl bg-black/[0.04] text-[14px] text-[#111] placeholder:text-black/40 outline-none focus:bg-black/[0.06] transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center rounded-full text-black/45 active:bg-black/10"
              style={{ WebkitTapHighlightColor: "transparent" }}
              aria-label="Effacer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </section>

      {/* Stats inline — interventions + diagnostics IA visibles */}
      <section className="px-4 mt-3">
        <div className="grid grid-cols-3 gap-2.5">
          <Stat label="Interventions" value={stats.total} />
          <Stat label="Diagnostics" value={visibleDiagnosticsCount} color="text-[#A16207]" />
          <Stat label="Avec BSFF" value={stats.withBsff} color="text-emerald-600" />
        </div>
      </section>

      {timeline.length === 0 ? (
        <div className="px-5 mt-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-black/[0.04] mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
          </div>
          <div className="text-[15px] text-black/55">
            {search
              ? `Aucun résultat pour « ${search} »`
              : equipement
                ? "Aucune intervention sur cet équipement"
                : "Aucune activité enregistrée"}
          </div>
          {equipement && !search && (
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
            {items.map((item) => {
              if (item.kind === "intervention") {
                const i = item.data;
                return (
                  <InsetRow
                    key={`int-${i.id}`}
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
                );
              }
              // Diagnostic IA — icône caméra, badge gravité, tap → /m/diagnostic/[id]
              const d = item.data;
              const grav = maxGraviteDiagnostic(d);
              const composant = d.result.composantIdentifie || "Composant non identifié";
              const nbDefauts = d.result.defautsDetectes.length;
              const sublabelText = `${nbDefauts === 0 ? "Aucun défaut" : `${nbDefauts} défaut${nbDefauts > 1 ? "s" : ""}`} · ${fmtDate(d.createdAt)} · ${fmtTime(d.createdAt)}`;
              return (
                <InsetRow
                  key={`diag-${d.id}`}
                  href={`/m/diagnostic/${d.id}`}
                  showChevron
                  label={`Diagnostic IA · ${composant}`}
                  sublabel={sublabelText}
                  leading={
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#A16207]/12 text-[#A16207]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </span>
                  }
                  trailing={
                    grav ? (
                      <span
                        className={`text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded ${GRAVITE_STYLES[grav].bg} ${GRAVITE_STYLES[grav].text}`}
                      >
                        {GRAVITE_BADGE_LABELS[grav]}
                      </span>
                    ) : undefined
                  }
                />
              );
            })}
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
