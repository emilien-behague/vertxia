// Geocoding via Nominatim (OpenStreetMap) — gratuit, sans clé API, rate-limit
// à 1 req/sec selon les terms of use. On cache TOUT en localStorage pour
// éviter de re-geocoder à chaque ouverture de la carte.
//
// Usage : geocodeAddress("14 avenue de la République, Toulon")
//   → { lat: 43.124, lng: 5.928 } ou null si introuvable.

import { scopedKey } from "@/lib/user-scope";

export type GeoPoint = { lat: number; lng: number };

const CACHE_KEY_BASE = "vertxia:geocache";
function cacheKey(): string {
  return scopedKey(CACHE_KEY_BASE);
}

type CacheEntry = {
  point: GeoPoint | null;
  ts: number;
};

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

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
 */
let lastRequestTs = 0;
const MIN_INTERVAL_MS = 1100;

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const norm = normalize(address);
  if (!norm) return null;

  const cache = loadCache();
  const entry = cache[norm];
  if (entry && Date.now() - entry.ts < TTL_MS) {
    return entry.point;
  }

  // Throttle pour respecter le TOS Nominatim
  const elapsed = Date.now() - lastRequestTs;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTs = Date.now();

  try {
    const params = new URLSearchParams({
      q: address,
      format: "json",
      limit: "1",
      countrycodes: "fr",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        // Nominatim demande un User-Agent identifiant l'app
        "Accept-Language": "fr",
      },
    });
    if (!res.ok) {
      cache[norm] = { point: null, ts: Date.now() };
      saveCache(cache);
      return null;
    }
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = data[0];
    if (!first) {
      cache[norm] = { point: null, ts: Date.now() };
      saveCache(cache);
      return null;
    }
    const point: GeoPoint = {
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
    };
    cache[norm] = { point, ts: Date.now() };
    saveCache(cache);
    return point;
  } catch {
    return null;
  }
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
