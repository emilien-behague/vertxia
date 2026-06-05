"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { ScanPlaqueButton, type PlaqueData } from "@/components/mobile/scan-plaque-button";
import { ActionTile } from "@/components/mobile/tile";
import { listInterventions } from "@/lib/intervention-storage";
import { listDiagnostics } from "@/lib/diagnostic-storage";
import {
  listEquipements,
  computeAllStatus,
  getEquipementStats,
  type EquipementWithStatus,
} from "@/lib/equipement";
import { detectPredictiveSignals, type SignalGravite } from "@/lib/predictive-maintenance";
import { downloadStickerSheet } from "@/lib/qrcode-client";

// Cle sessionStorage utilisee pour passer les donnees de plaque scannees
// vers l'ecran de creation. La cle est lue au mount par /m/equipements/nouveau
// (et nettoyee apres lecture pour eviter pre-remplissage residuel).
const PLAQUE_SCAN_HANDOFF_KEY = "vertxia:plaqueScanHandoff";

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

export default function MobileEquipementsPage() {
  const router = useRouter();
  const [items, setItems] = useState<EquipementWithStatus[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [stickersBusy, setStickersBusy] = useState(false);

  useEffect(() => {
    setItems(computeAllStatus(listEquipements(), listInterventions()));
    // Pre-applique le filtre si ?filter=X est present dans l'URL. Cas
    // d'usage : le drawer du compliance-score (header) propose des liens
    // vers /m/equipements?filter=en_retard pour aller directement aux eqs
    // concernes par une categorie de score basse.
    if (typeof window !== "undefined") {
      const f = new URLSearchParams(window.location.search).get("filter");
      const valid: Filter[] = ["all", "a_risque", "en_retard", "a_relancer", "a_programmer", "ok"];
      if (f && (valid as string[]).includes(f)) {
        setFilter(f as Filter);
      }
    }
  }, []);

  const stats = useMemo(() => getEquipementStats(items), [items]);

  // Map des IDs d'equipements -> gravite max du signal predictif detecte.
  // Permet d'afficher visuellement le dot en rouge (critique) ou orange
  // (alerte) directement sur la ligne dans la liste. Surveillance seul ne
  // compte pas (trop bruyant pour un dashboard).
  const equipementsARisque = useMemo(() => {
    const allInterv = listInterventions();
    const allDiag = listDiagnostics();
    const map = new Map<string, SignalGravite>();
    for (const eq of items) {
      const sigs = detectPredictiveSignals(eq, allInterv, allDiag);
      let worstGravite: SignalGravite | null = null;
      for (const s of sigs) {
        if (s.gravite === "critique") {
          worstGravite = "critique";
          break;
        }
        if (s.gravite === "alerte") {
          worstGravite = "alerte";
          // pas de break — on continue a chercher un eventuel "critique"
        }
      }
      if (worstGravite) {
        map.set(eq.id, worstGravite);
      }
    }
    return map;
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

  // Scan plaque UNIVERSEL : sur la liste parc, scanner une plaque doit
  // soit ouvrir la fiche d'un equipement deja connu (matching n.serie),
  // soit ouvrir le formulaire de creation pre-rempli avec les donnees
  // de la plaque (handoff via sessionStorage).
  function handleUniversalPlaqueScan(plaque: PlaqueData) {
    const sn = plaque.numeroSerie?.toLowerCase().trim();
    if (sn) {
      const match = items.find(
        (eq) => eq.numeroSerie.toLowerCase().trim() === sn
      );
      if (match) {
        router.push(`/eq/${match.id}`);
        return;
      }
    }
    // Pas de match → on stocke la plaque pour pre-remplir le formulaire creation
    try {
      sessionStorage.setItem(PLAQUE_SCAN_HANDOFF_KEY, JSON.stringify(plaque));
    } catch {
      // sessionStorage indisponible (mode prive iOS rare) → on perd les donnees
      // mais on continue vers le formulaire vide
    }
    router.push("/m/equipements/nouveau?fromPlaqueScan=1");
  }

  return (
    <>
      <MobileHeader title="🏭 Mon parc" largeTitle />

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

      {/* Scan plaque UNIVERSEL — entrée terrain :
          (a) équipement déjà en base → ouvre sa fiche
          (b) inconnu → ouvre le formulaire création pré-rempli */}
      <section className="px-4 mt-4">
        <ScanPlaqueButton
          onScanned={handleUniversalPlaqueScan}
          label="Identifier un équipement par sa plaque"
          successMessageFn={(p) => {
            const sn = p.numeroSerie?.toLowerCase().trim();
            if (sn && items.some((e) => e.numeroSerie.toLowerCase().trim() === sn)) {
              return "✅ Équipement reconnu — ouverture de la fiche…";
            }
            return "✅ Nouvel équipement — ouverture du formulaire pré-rempli…";
          }}
        />
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

      {/* Liste équipements — refonte 05/06/2026 post-feedback SIDV :
          cartes pleines avec bordure gauche coloree statut (lisible chantier
          a bout de bras), badge statut en haut a droite, gros modele, fond
          legerement teinte selon urgence. Plus de minuscule dot 9px qu'on
          ne voit pas — la couleur DOMINE la carte. */}
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
        </div>
      ) : (
        <section className="px-4 mt-4 space-y-3">
          {filtered.map((eq) => (
            <EquipementCard
              key={eq.id}
              eq={eq}
              risque={equipementsARisque.get(eq.id) ?? null}
            />
          ))}
        </section>
      )}

      {/* Actions globales — refonte tuiles 2x1 (style cohérent home) */}
      <section className="px-4 mt-5 mb-4 space-y-3">
        <ActionTile
          href="/m/equipements/nouveau"
          variant="emerald"
          emoji="➕"
          label="Ajouter un équipement"
          sublabel="Saisie rapide depuis le téléphone"
        />
        <div className="grid grid-cols-2 gap-3">
          <ActionTile
            href="/m/import-registre"
            variant="violet"
            emoji="📸"
            label="Importer registre"
            sublabel="Photos → IA bulk"
          />
          {items.length > 0 ? (
            <ActionTile
              onClick={handleStickers}
              variant="amber"
              emoji="🏷️"
              label={stickersBusy ? "Génération…" : "Stickers QR PDF"}
              sublabel="8 par feuille A4"
            />
          ) : (
            <ActionTile
              href="/m/scan"
              variant="amber"
              emoji="📷"
              label="Scanner un QR"
              sublabel="Reprendre une machine"
            />
          )}
        </div>
      </section>
    </>
  );
}

// Carte equipement — la nouvelle unite visuelle de la liste parc.
// Couleur statut DOMINANTE (bordure gauche 6px + fond pastel + badge), pas
// un dot 9px qu'on ne voit pas a bout de bras sur un chantier. Cliquable
// pleine surface vers /eq/[id].
function EquipementCard({
  eq,
  risque,
}: {
  eq: EquipementWithStatus;
  risque: SignalGravite | null;
}) {
  // Determine couleur dominante : risque predictif > statut reglementaire.
  // Hierarchie : risque critique > en_retard > a_relancer > a_programmer/jamais > ok > exempt.
  const styles = ((): {
    barColor: string;
    bgColor: string;
    badgeBg: string;
    badgeText: string;
    badgeLabel: string;
    emoji: string;
  } => {
    if (risque === "critique") {
      return {
        barColor: "#dc2626",
        bgColor: "#fef2f2",
        badgeBg: "#dc2626",
        badgeText: "#ffffff",
        badgeLabel: "RISQUE CRITIQUE",
        emoji: "🚨",
      };
    }
    if (risque === "alerte") {
      return {
        barColor: "#ea580c",
        bgColor: "#fff7ed",
        badgeBg: "#ea580c",
        badgeText: "#ffffff",
        badgeLabel: "RISQUE",
        emoji: "⚠️",
      };
    }
    if (eq.statut === "en_retard") {
      return {
        barColor: "#dc2626",
        bgColor: "#fef2f2",
        badgeBg: "#dc2626",
        badgeText: "#ffffff",
        badgeLabel: "EN RETARD",
        emoji: "🚨",
      };
    }
    if (eq.statut === "a_relancer") {
      return {
        barColor: "#ea580c",
        bgColor: "#fff7ed",
        badgeBg: "#ea580c",
        badgeText: "#ffffff",
        badgeLabel: "À RELANCER",
        emoji: "📧",
      };
    }
    if (eq.statut === "a_programmer") {
      return {
        barColor: "#d97706",
        bgColor: "#fffbeb",
        badgeBg: "#d97706",
        badgeText: "#ffffff",
        badgeLabel: "À PROGRAMMER",
        emoji: "📅",
      };
    }
    if (eq.statut === "jamais") {
      return {
        barColor: "#2563eb",
        bgColor: "#eff6ff",
        badgeBg: "#2563eb",
        badgeText: "#ffffff",
        badgeLabel: "JAMAIS CONTRÔLÉ",
        emoji: "🆕",
      };
    }
    if (eq.statut === "ok") {
      return {
        barColor: "#059669",
        bgColor: "#ecfdf5",
        badgeBg: "#059669",
        badgeText: "#ffffff",
        badgeLabel: "À JOUR",
        emoji: "✅",
      };
    }
    // exempt
    return {
      barColor: "#94a3b8",
      bgColor: "#f8fafc",
      badgeBg: "#cbd5e1",
      badgeText: "#475569",
      badgeLabel: "EXEMPTÉ",
      emoji: "🌿",
    };
  })();

  return (
    <Link
      href={`/eq/${eq.id}`}
      className="block rounded-2xl shadow-sm shadow-black/[0.04] active:scale-[0.99] transition-transform overflow-hidden"
      style={{
        background: styles.bgColor,
        borderLeft: `6px solid ${styles.barColor}`,
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      <div className="px-4 py-3.5">
        {/* Ligne 1 : badge statut + jours restants */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider"
            style={{ background: styles.badgeBg, color: styles.badgeText }}
          >
            <span className="text-[11px] leading-none">{styles.emoji}</span>
            {styles.badgeLabel}
          </span>
          {eq.joursAvantControle !== null && (
            <span className="text-[12px] font-bold" style={{ color: styles.barColor }}>
              {fmtJours(eq.joursAvantControle)}
            </span>
          )}
        </div>

        {/* Ligne 2 : modele gros + client */}
        <div className="text-[17px] font-bold text-[#111] leading-tight">
          {eq.modele}
        </div>
        <div className="text-[13px] text-black/65 mt-0.5 truncate">
          {eq.clientName}
        </div>

        {/* Ligne 3 : specs techniques compactes */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <SpecPill text={eq.fluide.code} />
          <SpecPill text={`${eq.chargeKg.toFixed(1).replace(".", ",")} kg`} />
          {eq.unitesInterieures && eq.unitesInterieures.length > 0 && (
            <SpecPill
              text={`${eq.unitesInterieures.length} unité${eq.unitesInterieures.length > 1 ? "s" : ""} int.`}
            />
          )}
          {eq.detecteurFixe && <SpecPill text="détecteur" />}
        </div>
      </div>
    </Link>
  );
}

function SpecPill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/70 text-[10.5px] font-medium text-black/70 ring-1 ring-black/[0.05]">
      {text}
    </span>
  );
}

// ActionTile : composant partage components/mobile/tile.tsx (cf. import en
// haut). Pas de definition locale -> evite hydration mismatch + duplication.

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
