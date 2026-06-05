"use client";

// useSearchParams = obligatoire de wrap dans <Suspense> en Next.js 16 (cf bug
// déjà rencontré sur /m/intervention/nouvelle, commit bde449a).
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MobileHeader } from "@/components/mobile/mobile-header";
import {
  listInterventions,
  getStats,
  getDeletedInterventionIds,
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
  // Filtres specifiques poussee depuis le drawer compliance-score :
  // - cerfa_non_signe : controles d'etancheite sans signature detenteur
  // - bsff_manquant : recuperations/demantelements sans bsffId
  // Si absent ou autre valeur, comportement V1 inchange.
  const filterParam = searchParams.get("filter");

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

    // Tombstones : IDs d'interventions supprimées localement. Sans ce filtre,
    // une intervention supprimée réapparaît au merge remote tant que le delete
    // Supabase n'a pas réussi (offline) ou tant qu'un confrère la garde.
    const deleted = getDeletedInterventionIds();

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
        const remote: StoredIntervention[] = json.data
          .filter((row) => !deleted.has(row.id as string))
          .map((row) => ({
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

  // Filtre poussee depuis le drawer compliance-score (param ?filter=).
  // S'applique APRES le filtre equipement et AVANT la recherche libre.
  // - cerfa_non_signe : controles d'etancheite sans signature detenteur
  // - bsff_manquant : recuperations/demantelements sans bsffId
  const byPushedFilter = useMemo<TimelineItem[]>(() => {
    if (!filterParam) return byEquipement;
    if (filterParam === "cerfa_non_signe") {
      return byEquipement.filter((item) => {
        if (item.kind !== "intervention") return false;
        const i = item.data;
        const estControle =
          i.typeIntervention === "controle_periodique" ||
          i.typeIntervention === "controle_non_periodique";
        if (!estControle) return false;
        return !i.hasDetenteurSignature;
      });
    }
    if (filterParam === "bsff_manquant") {
      return byEquipement.filter((item) => {
        if (item.kind !== "intervention") return false;
        const i = item.data;
        const necessiteBsff =
          i.typeIntervention === "recuperation" ||
          i.typeIntervention === "demantelement";
        if (!necessiteBsff) return false;
        return !i.bsffId;
      });
    }
    return byEquipement;
  }, [byEquipement, filterParam]);

  // Recherche libre — étendue aux 2 kinds. Pour les diagnostics on indexe
  // le composant identifié, le contexte note, et les noms de défauts.
  const timeline = useMemo<TimelineItem[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return byPushedFilter;
    const terms = q.split(/\s+/).filter(Boolean);
    return byPushedFilter.filter((item) => {
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
  }, [byPushedFilter, search]);

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
  const title = equipement ? "📋 Historique de l'installation" : "📋 Mon historique";

  return (
    <>
      <MobileHeader title={title} largeTitle backHref={backHref} />

      {/* Bandeau contexte filter pousse depuis le drawer compliance-score */}
      {filterParam === "cerfa_non_signe" && (
        <div className="mx-4 mt-2 mb-3 px-4 py-3 rounded-2xl bg-orange-50 ring-1 ring-orange-200">
          <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-orange-700">
            Vue filtrée
          </div>
          <div className="mt-1 text-[14px] font-medium text-[#111]">
            CERFA sans signature détenteur
          </div>
          <Link
            href="/m/historique"
            className="mt-2 inline-block text-[11px] text-orange-700 underline active:opacity-70"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Voir tout l&apos;historique →
          </Link>
        </div>
      )}
      {filterParam === "bsff_manquant" && (
        <div className="mx-4 mt-2 mb-3 px-4 py-3 rounded-2xl bg-orange-50 ring-1 ring-orange-200">
          <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-orange-700">
            Vue filtrée
          </div>
          <div className="mt-1 text-[14px] font-medium text-[#111]">
            Récupérations sans BSFF signé
          </div>
          <Link
            href="/m/historique"
            className="mt-2 inline-block text-[11px] text-orange-700 underline active:opacity-70"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Voir tout l&apos;historique →
          </Link>
        </div>
      )}

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
          <section key={month} className="px-4 mt-5">
            <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-black/45 mb-2 px-1">
              {monthLabel(month)}
            </div>
            <div className="space-y-2.5">
              {items.map((item) => {
                if (item.kind === "intervention") {
                  const i = item.data;
                  const isBsff = Boolean(i.bsffId);
                  const accentColor = isBsff ? "#059669" : "#2563eb";
                  const accentBg = isBsff ? "#ecfdf5" : "#eff6ff";
                  return (
                    <Link
                      key={`int-${i.id}`}
                      href={`/m/historique/${i.id}`}
                      className="block rounded-2xl bg-white ring-1 ring-black/[0.05] px-4 py-3 active:bg-black/[0.02] transition-colors"
                      style={{
                        WebkitTapHighlightColor: "transparent",
                        touchAction: "manipulation",
                        borderLeft: `5px solid ${accentColor}`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <span
                              className="text-[9.5px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase"
                              style={{ background: accentBg, color: accentColor }}
                            >
                              {isBsff ? "BSFF" : "INTERVENTION"}
                            </span>
                          </div>
                          <div className="text-[14.5px] font-bold text-[#111] leading-tight">
                            {TYPE_LABELS[i.typeIntervention] || i.typeIntervention}
                          </div>
                          <div className="text-[11.5px] text-black/55 truncate mt-0.5">
                            {i.clientName ?? "Sans client"} · {fmtDate(i.createdAt)} · {fmtTime(i.createdAt)}
                          </div>
                        </div>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="rgba(0,0,0,0.3)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="shrink-0 mt-1.5"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </div>
                    </Link>
                  );
                }
                // Diagnostic IA — accent bronze Vertxia
                const d = item.data;
                const grav = maxGraviteDiagnostic(d);
                const composant = d.result.composantIdentifie || "Composant non identifié";
                const nbDefauts = d.result.defautsDetectes.length;
                return (
                  <Link
                    key={`diag-${d.id}`}
                    href={`/m/diagnostic/${d.id}`}
                    className="block rounded-2xl bg-white ring-1 ring-black/[0.05] px-4 py-3 active:bg-black/[0.02] transition-colors"
                    style={{
                      WebkitTapHighlightColor: "transparent",
                      touchAction: "manipulation",
                      borderLeft: "5px solid #A16207",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span
                            className="text-[9.5px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase"
                            style={{ background: "#fef3c7", color: "#A16207" }}
                          >
                            🤖 DIAGNOSTIC IA
                          </span>
                          {grav && (
                            <span
                              className={`text-[9.5px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase ${GRAVITE_STYLES[grav].bg} ${GRAVITE_STYLES[grav].text}`}
                            >
                              {GRAVITE_BADGE_LABELS[grav]}
                            </span>
                          )}
                        </div>
                        <div className="text-[14.5px] font-bold text-[#111] leading-tight truncate">
                          {composant}
                        </div>
                        <div className="text-[11.5px] text-black/55 truncate mt-0.5">
                          {nbDefauts === 0
                            ? "Aucun défaut"
                            : `${nbDefauts} défaut${nbDefauts > 1 ? "s" : ""}`}{" "}
                          · {fmtDate(d.createdAt)} · {fmtTime(d.createdAt)}
                        </div>
                      </div>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgba(0,0,0,0.3)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 mt-1.5"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
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
