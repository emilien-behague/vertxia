"use client";

// Planning Vertxia — calendrier mensuel des interventions/échéances + carte
// des installations géocodées via Nominatim OpenStreetMap (gratuit, sans
// clé API). Markers cliquables → fiche équipement.
//
// Pas de lib calendrier (DayPicker etc.) — vue mois custom suffit.
// Leaflet plain JS (pas react-leaflet) pour éviter les soucis de compat
// React 19.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/ui/mobile-header";
import {
  listEquipements,
  computeAllStatus,
  type EquipementWithStatus,
} from "@/lib/equipement/equipement";
import { listInterventions, type StoredIntervention } from "@/lib/intervention/intervention-storage";
import { listDiagnostics } from "@/lib/intervention/diagnostic-storage";
import { detectPredictiveSignals, type SignalGravite } from "@/lib/intervention/predictive-maintenance";
import { geocodeAddress, type GeoPoint } from "@/lib/geocoding";

// ─── Calendrier helpers ──────────────────────────────────────────────────────

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

type DayEvents = {
  date: Date;
  interventions: StoredIntervention[];
  echeances: EquipementWithStatus[]; // contrôles prévus ce jour-là
};

function buildMonthGrid(month: Date): Date[] {
  // Lundi de la 1re semaine qui contient le 1er du mois
  const first = startOfMonth(month);
  const dayOfWeek = (first.getDay() + 6) % 7; // 0=lundi
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - dayOfWeek);
  // 6 semaines × 7 jours = 42 cases (toujours la même grille)
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }
  return cells;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const [equipements, setEquipements] = useState<EquipementWithStatus[]>([]);
  const [interventions, setInterventions] = useState<StoredIntervention[]>([]);
  // Map eqId -> pire signal predictif detecte (critique > alerte). Permet de
  // rendre les markers ROUGES quand un eq a un signal critique meme s'il est
  // techniquement "ok" cote controle d'etancheite reglementaire. Coherent avec
  // l'affichage de la liste parc (/m/equipements).
  const [equipementsARisque, setEquipementsARisque] = useState<Map<string, SignalGravite>>(
    new Map()
  );
  const [month, setMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    const ints = listInterventions();
    const eqs = listEquipements();
    const diags = listDiagnostics();
    setInterventions(ints);
    const withStatus = computeAllStatus(eqs, ints);
    setEquipements(withStatus);

    // Calcul des signaux predictifs pour chaque eq (critique > alerte > rien).
    // Meme logique que la liste parc, pour que la map soit ROUGE quand le
    // dot dans la liste est ROUGE (signal critique).
    const risk = new Map<string, SignalGravite>();
    for (const eq of withStatus) {
      const signals = detectPredictiveSignals(eq, ints, diags);
      let worst: SignalGravite | null = null;
      for (const s of signals) {
        if (s.gravite === "critique") {
          worst = "critique";
          break;
        }
        if (s.gravite === "alerte") worst = "alerte";
      }
      if (worst) risk.set(eq.id, worst);
    }
    setEquipementsARisque(risk);
  }, []);

  const monthCells = useMemo(() => buildMonthGrid(month), [month]);

  // Index des events par jour (YYYY-MM-DD)
  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayEvents>();
    const key = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    for (const cell of monthCells) {
      map.set(key(cell), { date: cell, interventions: [], echeances: [] });
    }
    for (const inter of interventions) {
      const d = new Date(inter.createdAt);
      const k = key(d);
      const slot = map.get(k);
      if (slot) slot.interventions.push(inter);
    }
    for (const eq of equipements) {
      if (!eq.prochainControleISO) continue;
      const d = new Date(eq.prochainControleISO);
      const k = key(d);
      const slot = map.get(k);
      if (slot) slot.echeances.push(eq);
    }
    return map;
  }, [monthCells, interventions, equipements]);

  function cellKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const selectedEvents: DayEvents | null = selectedDate
    ? eventsByDay.get(cellKey(selectedDate)) ?? null
    : null;

  const today = new Date();

  // ─── Carte Leaflet ──────────────────────────────────────────────────
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<unknown>(null);
  const [geocodingStatus, setGeocodingStatus] = useState<{
    total: number;
    done: number;
    found: number;
  }>({ total: 0, done: 0, found: 0 });
  const [failedEquipements, setFailedEquipements] = useState<EquipementWithStatus[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;
    let LRef: typeof import("leaflet") | null = null;

    (async () => {
      // Charge Leaflet dynamiquement côté client uniquement
      const L = (await import("leaflet")).default;
      // CSS Leaflet self-hosted depuis /public/leaflet.css pour respecter
      // la CSP `style-src 'self'` (un link vers unpkg.com serait bloque).
      if (!document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/leaflet.css";
        link.setAttribute("data-leaflet-css", "true");
        document.head.appendChild(link);
      }
      // Animation pulse pour les markers critiques (rouge clignotant)
      if (!document.querySelector("style[data-vertxia-pulse]")) {
        const styleEl = document.createElement("style");
        styleEl.setAttribute("data-vertxia-pulse", "true");
        styleEl.textContent = `@keyframes vertxia-pulse { 0% { transform: scale(0.85); opacity: 0.55; } 100% { transform: scale(1.7); opacity: 0; } }`;
        document.head.appendChild(styleEl);
      }
      LRef = L;

      if (cancelled || !mapRef.current) return;

      // Centre France par défaut, zoom assez large
      const map = L.map(mapRef.current, {
        center: [46.6, 2.5],
        zoom: 6,
        scrollWheelZoom: false,
        touchZoom: true,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      leafletMapRef.current = map;

      // Géocode chaque équipement avec adresse, dans l'ordre. On affiche au
      // fur et à mesure pour qu'on voie les markers apparaître.
      const equipementsAvecAdresse = equipements.filter((e) => e.siteAdresse?.trim());
      setGeocodingStatus({ total: equipementsAvecAdresse.length, done: 0, found: 0 });
      setFailedEquipements([]);
      const points: { eq: EquipementWithStatus; point: GeoPoint }[] = [];
      const failed: EquipementWithStatus[] = [];

      for (let i = 0; i < equipementsAvecAdresse.length; i++) {
        if (cancelled) break;
        const eq = equipementsAvecAdresse[i];
        const point = await geocodeAddress(eq.siteAdresse!);
        if (cancelled) break;
        setGeocodingStatus((s) => ({
          ...s,
          done: s.done + 1,
          found: point ? s.found + 1 : s.found,
        }));
        if (!point) {
          failed.push(eq);
          setFailedEquipements([...failed]);
          continue;
        }
        points.push({ eq, point });

        // Couleur du marker = priorite au signal predictif (critique/alerte)
        // sinon statut reglementaire. Coherent avec le dot de la liste parc :
        //   critique / en_retard         → ROUGE
        //   alerte / a_relancer          → ORANGE
        //   a_programmer                 → AMBRE
        //   jamais (controle initial du) → BLEU
        //   ok / exempt                  → VERT
        const risque = equipementsARisque.get(eq.id);
        const color =
          risque === "critique" || eq.statut === "en_retard"
            ? "#dc2626"
            : risque === "alerte" || eq.statut === "a_relancer"
              ? "#ea580c"
              : eq.statut === "a_programmer"
                ? "#d97706"
                : eq.statut === "jamais"
                  ? "#2563eb"
                  : "#059669";

        // Anneau pulsant pour les markers critiques (visibilite immediate).
        const html =
          risque === "critique" || eq.statut === "en_retard"
            ? `<div style="position:relative;width:18px;height:18px;">
                 <span style="position:absolute;inset:-4px;border-radius:50%;background:${color};opacity:0.35;animation:vertxia-pulse 1.4s ease-out infinite;"></span>
                 <span style="position:relative;display:block;width:18px;height:18px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></span>
               </div>`
            : `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`;

        const icon = L.divIcon({
          className: "vertxia-marker",
          html,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker([point.lat, point.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:system-ui;font-size:13px;">
              <div style="font-weight:600;color:#111;">${escapeHtml(eq.modele)}</div>
              <div style="color:#555;margin-top:2px;">${escapeHtml(eq.clientName)}</div>
              <div style="color:#888;font-size:11px;margin-top:2px;">${escapeHtml(eq.siteAdresse ?? "")}</div>
              <a href="/eq/${eq.id}" style="display:inline-block;margin-top:6px;padding:4px 10px;background:#111;color:white;border-radius:6px;text-decoration:none;font-size:11px;">Ouvrir la fiche</a>
            </div>`
          );
      }

      // Auto-fit sur tous les markers si on en a
      if (points.length > 0) {
        const bounds = L.latLngBounds(points.map((p) => [p.point.lat, p.point.lng]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    })();

    return () => {
      cancelled = true;
      if (leafletMapRef.current && LRef) {
        try {
          (leafletMapRef.current as { remove: () => void }).remove();
        } catch {
          /* déjà supprimé */
        }
        leafletMapRef.current = null;
      }
    };
  }, [equipements, equipementsARisque]);

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <>
      <MobileHeader title="🗓️ Mon planning" largeTitle backHref="/m" />

      {/* Header navigation mois */}
      <div className="px-4 mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, -1))}
          className="w-9 h-9 rounded-full bg-black/[0.05] active:bg-black/10 flex items-center justify-center"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          aria-label="Mois précédent"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="text-[16px] font-semibold text-[#111] tracking-tight">
          {MONTH_LABELS[month.getMonth()]} {month.getFullYear()}
        </div>
        <button
          type="button"
          onClick={() => setMonth(addMonths(month, 1))}
          className="w-9 h-9 rounded-full bg-black/[0.05] active:bg-black/10 flex items-center justify-center"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          aria-label="Mois suivant"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Grille calendrier */}
      <div className="mx-4 mt-3 rounded-2xl bg-white ring-1 ring-black/[0.04] overflow-hidden">
        {/* En-tête jours */}
        <div className="grid grid-cols-7 border-b border-black/[0.06]">
          {DAY_LABELS.map((d, i) => (
            <div
              key={i}
              className="text-center text-[11px] font-medium text-black/40 uppercase tracking-wide py-2"
            >
              {d}
            </div>
          ))}
        </div>
        {/* Cases */}
        <div className="grid grid-cols-7">
          {monthCells.map((cell, i) => {
            const inCurrentMonth = cell.getMonth() === month.getMonth();
            const isToday = isSameDay(cell, today);
            const isSelected = selectedDate && isSameDay(cell, selectedDate);
            const events = eventsByDay.get(cellKey(cell));
            const nInter = events?.interventions.length ?? 0;
            const nEch = events?.echeances.length ?? 0;
            const hasEvents = nInter > 0 || nEch > 0;

            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedDate(cell)}
                className={`aspect-square flex flex-col items-center justify-center text-[13px] border-r border-b border-black/[0.04] last-in-row:border-r-0 transition-colors ${
                  isSelected
                    ? "bg-[#A16207]/10"
                    : hasEvents
                      ? "active:bg-black/[0.04]"
                      : "active:bg-black/[0.02]"
                } ${(i + 1) % 7 === 0 ? "border-r-0" : ""}`}
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                <span
                  className={`${
                    isToday
                      ? "inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#A16207] text-white font-semibold"
                      : inCurrentMonth
                        ? "text-[#111]"
                        : "text-black/25"
                  }`}
                >
                  {cell.getDate()}
                </span>
                {/* Pastilles d'events */}
                {hasEvents && (
                  <div className="flex gap-0.5 mt-1">
                    {nInter > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                    {nEch > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Légende */}
      <div className="px-5 mt-3 flex items-center gap-4 text-[11px] text-black/55">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Intervention faite
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Contrôle prévu
        </span>
      </div>

      {/* Detail du jour selectionne — refonte cards bordure couleur evenement */}
      {selectedDate && selectedEvents && (
        <section className="px-4 mt-4">
          <div className="rounded-2xl bg-white ring-1 ring-black/[0.05] px-4 py-3 mb-3">
            <div className="text-[14px] font-bold text-[#111] capitalize">
              {selectedDate.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
            <div className="text-[11px] text-black/55 mt-0.5">
              {selectedEvents.interventions.length + selectedEvents.echeances.length === 0
                ? "Aucun événement prévu"
                : `${selectedEvents.interventions.length} intervention${selectedEvents.interventions.length > 1 ? "s" : ""} · ${selectedEvents.echeances.length} contrôle${selectedEvents.echeances.length > 1 ? "s" : ""}`}
            </div>
          </div>

          {selectedEvents.interventions.length === 0 && selectedEvents.echeances.length === 0 && (
            <div className="rounded-2xl bg-black/[0.03] ring-1 ring-black/[0.04] px-4 py-5 text-center">
              <div className="text-3xl mb-1">📭</div>
              <div className="text-[12.5px] text-black/55">Rien de prévu ce jour</div>
            </div>
          )}

          <div className="space-y-2.5">
            {selectedEvents.interventions.map((inter) => (
              <Link
                key={inter.id}
                href={`/m/historique/${inter.id}`}
                className="block rounded-2xl bg-white ring-1 ring-black/[0.05] px-4 py-3 active:bg-black/[0.02] transition-colors"
                style={{
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                  borderLeft: "5px solid #059669",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span
                      className="inline-block text-[9.5px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase mb-1"
                      style={{ background: "#ecfdf5", color: "#059669" }}
                    >
                      ✅ INTERVENTION FAITE
                    </span>
                    <div className="text-[14.5px] font-bold text-[#111] leading-tight">
                      {inter.clientName ?? "Sans client"}
                    </div>
                    <div className="text-[11.5px] text-black/55 truncate mt-0.5">
                      {inter.typeIntervention.replace(/_/g, " ")} · {inter.fluide.code} ·{" "}
                      {inter.weight.toFixed(1).replace(".", ",")} kg
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
            ))}
            {selectedEvents.echeances.map((eq) => (
              <Link
                key={eq.id}
                href={`/eq/${eq.id}`}
                className="block rounded-2xl bg-white ring-1 ring-black/[0.05] px-4 py-3 active:bg-black/[0.02] transition-colors"
                style={{
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                  borderLeft: "5px solid #d97706",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span
                      className="inline-block text-[9.5px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase mb-1"
                      style={{ background: "#fffbeb", color: "#d97706" }}
                    >
                      📅 CONTRÔLE PRÉVU
                    </span>
                    <div className="text-[14.5px] font-bold text-[#111] leading-tight">
                      {eq.clientName}
                    </div>
                    <div className="text-[11.5px] text-black/55 truncate mt-0.5">
                      Contrôle étanchéité · {eq.modele}
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
            ))}
          </div>
        </section>
      )}

      {/* Carte des installations */}
      <div className="mt-6 px-5">
        <div className="text-[13px] font-medium text-black/45 uppercase tracking-wide mb-2">
          Carte des installations
        </div>
        {geocodingStatus.total > 0 && geocodingStatus.done < geocodingStatus.total && (
          <div className="text-[11px] text-black/45 mb-2">
            Géolocalisation en cours… {geocodingStatus.done}/{geocodingStatus.total}
          </div>
        )}
        {geocodingStatus.total > 0 && geocodingStatus.done === geocodingStatus.total && (
          <div className="text-[11px] text-black/45 mb-2">
            {geocodingStatus.found}/{geocodingStatus.total} équipement{geocodingStatus.total > 1 ? "s" : ""} localisé{geocodingStatus.total > 1 ? "s" : ""}
            {geocodingStatus.found < geocodingStatus.total && " (adresses manquantes ou introuvables)"}
          </div>
        )}
      </div>
      <div className="mx-4 mt-1 rounded-2xl overflow-hidden ring-1 ring-black/[0.06]">
        <div
          ref={mapRef}
          style={{
            height: "60vh",
            minHeight: "320px",
            width: "100%",
            background: "#e8e6e0",
          }}
        />
      </div>

      {equipements.filter((e) => e.siteAdresse?.trim()).length === 0 && (
        <div className="mx-4 mt-3 rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-4 text-[13px] text-amber-900 leading-relaxed">
          Aucun équipement n&apos;a d&apos;adresse renseignée. Ajoute l&apos;adresse du site dans la fiche
          de chaque équipement pour les voir sur la carte.
        </div>
      )}

      {/* Adresses introuvables — l'user doit les corriger */}
      {failedEquipements.length > 0 && (
        <>
          <div className="px-5 mt-6 text-[13px] font-medium text-black/45 uppercase tracking-wide mb-2">
            Adresses à corriger ({failedEquipements.length})
          </div>
          <div className="mx-4 rounded-2xl bg-amber-50 ring-1 ring-amber-200 overflow-hidden">
            <div className="px-4 py-3 text-[12px] text-amber-900 leading-relaxed border-b border-amber-200/60">
              Ces adresses n&apos;ont pas pu être localisées sur la carte. Ajoute le code postal,
              la ville, ou précise le numéro et le nom de rue.
              <br />
              <span className="text-[11px] text-amber-800/70">
                Exemple qui marche : <em>« 14 avenue de la République, 83000 Toulon »</em>
              </span>
            </div>
            <div className="divide-y divide-amber-200/50">
              {failedEquipements.map((eq) => (
                <Link
                  key={eq.id}
                  href={`/eq/${eq.id}`}
                  className="flex items-center gap-3 px-4 py-3 active:bg-amber-100/60"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-amber-950 truncate">{eq.clientName}</div>
                    <div className="text-[12px] text-amber-800/70 truncate italic">
                      « {eq.siteAdresse} »
                    </div>
                  </div>
                  <span className="text-[11px] text-amber-700 font-medium shrink-0">
                    Corriger
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(146,64,14,0.5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
