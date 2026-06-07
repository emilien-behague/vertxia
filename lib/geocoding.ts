// Geocoding via Nominatim (OpenStreetMap) — gratuit, sans clé API, rate-limit
// à 1 req/sec selon les terms of use. On cache TOUT en localStorage pour
// éviter de re-geocoder à chaque ouverture de la carte.
//
// Usage : geocodeAddress("14 avenue de la République, Toulon")
//   → { lat: 43.124, lng: 5.928 } ou null si introuvable.

import { scopedKey } from "@/lib/auth/user-scope";

export type GeoPoint = { lat: number; lng: number };

// v2 du cache : les anciens caches v1 stockaient des null longue durée, ce qui
// empêchait le geocoding tolérant (introduit le 04/06/2026) de retenter. On
// change la clé pour invalider tout l'ancien cache.
const CACHE_KEY_BASE = "vertxia:geocache:v2";
function cacheKey(): string {
  return scopedKey(CACHE_KEY_BASE);
}

type CacheEntry = {
  point: GeoPoint | null;
  ts: number;
};

const TTL_SUCCESS_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours pour les hits
const TTL_FAILURE_MS = 60 * 60 * 1000; // 1 heure pour les misses (l'user peut corriger l'adresse)

function loadCache(): Record<string, CacheEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(cacheKey());
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CacheEntry>;
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, CacheEntry>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(cacheKey(), JSON.stringify(cache));
  } catch {
    /* quota dépassé, on ignore */
  }
}

function normalize(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Géocode une adresse via Nominatim. Cache 30 jours en localStorage.
 * Retourne null si l'adresse n'a pas été trouvée.
 *
 * Respecte un délai de 1100ms entre 2 requêtes réseau (TOS Nominatim).
 *
 * Stratégie tolérante : si l'adresse complète n'est pas trouvée, on retente
 * avec des variantes simplifiées :
 *   1. adresse complète
 *   2. adresse sans le numéro de rue de tête (ex "14 avenue..." → "avenue...")
 *   3. partie après la dernière virgule (souvent = ville)
 *   4. dernier segment de mots après séparation par virgules ou tirets
 * On stoppe au premier hit. Cache uniquement le résultat final (par adresse
 * originale), donc si tu corriges l'adresse plus tard, on regéocode.
 */
let lastRequestTs = 0;
const MIN_INTERVAL_MS = 1100;

async function queryNominatim(query: string): Promise<GeoPoint | null> {
  // Throttle pour respecter le TOS Nominatim (1 req/s max)
  const elapsed = Date.now() - lastRequestTs;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTs = Date.now();

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: "1",
      countrycodes: "fr",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { "Accept-Language": "fr" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = data[0];
    if (!first) return null;
    return { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
  } catch {
    return null;
  }
}

function buildAddressVariants(address: string): string[] {
  const variants: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const v = s.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      variants.push(v);
    }
  };

  // 1. Adresse brute
  push(address);

  // 2. Sans le numéro de rue de tête (ex: "14 avenue de la République")
  const noNumber = address.replace(/^\s*\d+\s*(bis|ter)?\s*,?\s*/i, "");
  push(noNumber);

  // 3. Partie après la dernière virgule (souvent la ville)
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    push(parts[parts.length - 1]);
    // 4. Combinaison ville + département/code postal si présent
    push(parts.slice(-2).join(", "));
  }

  // 5. Si l'adresse contient un code postal (5 chiffres) + texte, on extrait
  const cpMatch = address.match(/\b(\d{5})\b\s*([A-Za-zÀ-ÿ\s'-]+)/);
  if (cpMatch) {
    push(`${cpMatch[1]} ${cpMatch[2]}`.trim());
  }

  return variants;
}

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const norm = normalize(address);
  if (!norm) return null;

  const cache = loadCache();
  const entry = cache[norm];
  if (entry) {
    const ttl = entry.point ? TTL_SUCCESS_MS : TTL_FAILURE_MS;
    if (Date.now() - entry.ts < ttl) {
      return entry.point;
    }
  }

  for (const variant of buildAddressVariants(address)) {
    const point = await queryNominatim(variant);
    if (point) {
      cache[norm] = { point, ts: Date.now() };
      saveCache(cache);
      return point;
    }
  }

  // Aucune variante n'a marché → cache court (1h) pour ne pas re-spammer
  // Nominatim mais permettre re-tentative rapide si l'user corrige l'adresse
  cache[norm] = { point: null, ts: Date.now() };
  saveCache(cache);
  return null;
}

/**
 * Géocode plusieurs adresses en parallèle (mais en respectant le throttle).
 * Retourne un tableau aligné avec les inputs : index N de input = index N de output.
 * Null pour les adresses introuvables ou erreur réseau.
 */
export async function geocodeMany(addresses: string[]): Promise<(GeoPoint | null)[]> {
  const results: (GeoPoint | null)[] = [];
  for (const addr of addresses) {
    results.push(await geocodeAddress(addr));
  }
  return results;
}

// ─── Routing (distance routière entre 2 points) ─────────────────────────
// OSRM public demo (https://router.project-osrm.org) : pas de clé API, gratuit,
// open-source. Suffisant pour V1.5. Si rate-limit en prod : self-host OSRM
// ou bascule vers Geoapify/OpenRouteService (key + paramètre identique).
//
// On cache 90 jours en localStorage — une route entre 2 points fixes ne change
// quasi jamais (sauf travaux majeurs).

const ROUTE_CACHE_KEY_BASE = "vertxia:routecache:v1";
function routeCacheKey(): string {
  return scopedKey(ROUTE_CACHE_KEY_BASE);
}

type RouteEntry = {
  km: number;
  durationMin: number;
  ts: number;
};

const ROUTE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 jours

function loadRouteCache(): Record<string, RouteEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(routeCacheKey());
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, RouteEntry>;
  } catch {
    return {};
  }
}

function saveRouteCache(cache: Record<string, RouteEntry>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(routeCacheKey(), JSON.stringify(cache));
  } catch {
    /* quota dépassé, on ignore */
  }
}

function routeKey(from: GeoPoint, to: GeoPoint): string {
  // Arrondi 5 décimales (≈1m précision) pour réutiliser le cache même si les
  // geocodes différent à la 6ème décimale.
  return `${from.lat.toFixed(5)},${from.lng.toFixed(5)}|${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
}

/**
 * Calcule la distance routière entre 2 points (un sens, pas aller-retour).
 * Retourne null si erreur réseau ou route impossible (île, etc.).
 * Cache 90 jours en localStorage.
 */
export async function routeDistanceKm(
  from: GeoPoint,
  to: GeoPoint
): Promise<{ km: number; durationMin: number } | null> {
  const key = routeKey(from, to);
  const cache = loadRouteCache();
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < ROUTE_TTL_MS) {
    return { km: entry.km, durationMin: entry.durationMin };
  }
  try {
    // OSRM format : /route/v1/{profile}/{coordinates}?overview=false
    // Coordonnees = lon,lat (ATTENTION : pas lat,lng comme partout ailleurs)
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: Array<{ distance?: number; duration?: number }>;
      code?: string;
    };
    if (data.code && data.code !== "Ok") return null;
    const route = data.routes?.[0];
    if (!route || typeof route.distance !== "number") return null;
    const km = Math.round(route.distance / 1000);
    const durationMin = Math.round((route.duration ?? 0) / 60);
    cache[key] = { km, durationMin, ts: Date.now() };
    saveRouteCache(cache);
    return { km, durationMin };
  } catch {
    return null;
  }
}

/**
 * Calcule la distance routière ALLER-RETOUR entre 2 adresses texte.
 * Geocode les 2 adresses (cache 30j) puis calcule la route (cache 90j).
 *
 * @returns kmAR = distance × 2 (AR), durationMinAR = duration × 2, plus les
 *   points geocodés pour debug / réutilisation. Null si une étape échoue.
 */
export async function computeRoadDistanceAR(
  fromAddr: string,
  toAddr: string
): Promise<{
  kmAR: number;
  durationMinAR: number;
  from: GeoPoint;
  to: GeoPoint;
} | null> {
  if (!fromAddr.trim() || !toAddr.trim()) return null;
  const [from, to] = await Promise.all([
    geocodeAddress(fromAddr),
    geocodeAddress(toAddr),
  ]);
  if (!from || !to) return null;
  const route = await routeDistanceKm(from, to);
  if (!route) return null;
  return {
    kmAR: route.km * 2,
    durationMinAR: route.durationMin * 2,
    from,
    to,
  };
}
