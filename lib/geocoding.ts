// Geocoding via Nominatim (OpenStreetMap) — gratuit, sans clé API, rate-limit
// à 1 req/sec selon les terms of use. On cache TOUT en localStorage pour
// éviter de re-geocoder à chaque ouverture de la carte.
//
// Usage : geocodeAddress("14 avenue de la République, Toulon")
//   → { lat: 43.124, lng: 5.928 } ou null si introuvable.

import { scopedKey } from "@/lib/user-scope";

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
