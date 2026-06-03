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
import { MobileHeader } from "@/components/mobile/mobile-header";
import {
  listEquipements,
  computeAllStatus,
  type EquipementWithStatus,
} from "@/lib/equipement";
import { listInterventions, type StoredIntervention } from "@/lib/intervention-storage";
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
  const [month, setMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    const ints = listInterventions();
    setInterventions(ints);
    setEquipements(computeAllStatus(listEquipements(), ints));
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

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;
    let LRef: typeof import("leaflet") | null = null;

    (async () => {
      // Charge Leaflet dynamiquement côté client uniquement
      const L = (await import("leaflet")).default;
      // Le CSS de Leaflet doit être chargé via une balise <link> dans le head
      // (impossible d'import "leaflet/dist/leaflet.css" en Next.js client component)
      // → on inject une fois si pas déjà présent
      if (!document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.setAttribute("data-leaflet-css", "true");
        link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
        link.crossOrigin = "";
        document.head.appendChild(link);
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
      const points: { eq: EquipementWithStatus; point: GeoPoint }[] = [];

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
        if (!point) continue;
        points.push({ eq, point });

        // Couleur du marker selon le statut
        const color =
          eq.statut === "en_retard"
            ? "#dc2626"
            : eq.statut === "a_relancer"
              ? "#ea580c"
              : eq.statut === "a_programmer"
                ? "#d97706"
                : eq.statut === "jamais"
                  ? "#2563eb"
                  : "#059669";

        const icon = L.divIcon({
          className: "vertxia-marker",
          html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
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
  }, [equipements]);

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <>
      <MobileHeader title="Planning" largeTitle backHref="/m" />

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

      {/* Détail du jour sélectionné */}
      {selectedDate && selectedEvents && (
        <div className="mx-4 mt-4 rounded-2xl bg-white ring-1 ring-black/[0.04] overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.06]">
            <div className="text-[13px] font-medium text-[#111]">
              {selectedDate.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
            <div className="text-[11px] text-black/45 mt-0.5">
              {selectedEvents.interventions.length + selectedEvents.echeances.length === 0
                ? "Aucun événement"
                : `${selectedEvents.interventions.length} intervention${selectedEvents.interventions.length > 1 ? "s" : ""} · ${selectedEvents.echeances.length} contrôle${selectedEvents.echeances.length > 1 ? "s" : ""} prévu${selectedEvents.echeances.length > 1 ? "s" : ""}`}
            </div>
          </div>
          {selectedEvents.interventions.length === 0 && selectedEvents.echeances.length === 0 && (
            <div className="px-4 py-5 text-center text-[13px] text-black/45">
              Rien de prévu ce jour
            </div>
          )}
          <div className="divide-y divide-black/[0.06]">
            {selectedEvents.interventions.map((inter) => (
              <Link
                key={inter.id}
                href={`/m/historique/${inter.id}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-black/[0.03]"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-[#111] truncate">
                    {inter.clientName ?? "Sans client"}
                  </div>
                  <div className="text-[12px] text-black/50 truncate">
                    {inter.typeIntervention.replace(/_/g, " ")} · {inter.fluide.code} ·{" "}
                    {inter.weight.toFixed(1).replace(".", ",")} kg
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            ))}
            {selectedEvents.echeances.map((eq) => (
              <Link
                key={eq.id}
                href={`/eq/${eq.id}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-black/[0.03]"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-[#111] truncate">{eq.clientName}</div>
                  <div className="text-[12px] text-black/50 truncate">
                    Contrôle étanchéité · {eq.modele}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
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
