// Service Worker Vertxia — caching offline-first pour les pages /m/*
// Stratégie :
//  - Pages /m/* : stale-while-revalidate (sert le cache si dispo, met à jour en arrière-plan)
//  - Assets statiques (_next/static, /icons, /fonts) : cache-first
//  - Routes API : pas de cache, network-only (le caller gère le offline via offline-queue.ts)
//  - Autres pages : network-first avec fallback cache

const CACHE_VERSION = "vertxia-v2";
const STATIC_CACHE = "vertxia-static-v2";

self.addEventListener("install", (event) => {
  // Active immédiatement la nouvelle version sans attendre que tous les onglets soient fermés
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Nettoyage des vieux caches Vertxia (différentes versions)
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("vertxia-") && k !== CACHE_VERSION && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      );
      // Prend le contrôle des onglets ouverts immédiatement
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // On ne gère que les GET (les POST API restent network-only)
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip cross-origin (Vercel, Google Fonts, etc.)
  if (url.origin !== self.location.origin) return;

  // API routes : network-only, l'app gère le offline via offline-queue
  if (url.pathname.startsWith("/api/")) return;

  // Assets statiques Next.js : cache-first (immutables, hash dans le nom)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/") ||
    /\.(woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Pages /m/* et /eq/* (l'app mobile) + page racine : stale-while-revalidate
  if (
    url.pathname === "/" ||
    url.pathname.startsWith("/m") ||
    url.pathname.startsWith("/eq/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(staleWhileRevalidate(event, request));
    return;
  }

  // Autres pages (login, marketing, etc.) : network-first
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  // Renvoie le cache immédiatement si dispo, sinon attend le network
  if (cached) {
    // En arrière-plan, on revalide (event peut être absent si appel direct)
    if (event && typeof event.waitUntil === "function") {
      event.waitUntil(fetchPromise);
    }
    return cached;
  }
  const networkResponse = await fetchPromise;
  if (networkResponse) return networkResponse;
  // Ni cache ni network → fallback minimal
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors connexion</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:40px;text-align:center;background:#F5F4F0}</style></head><body><h2>Hors connexion</h2><p>Cette page n'a pas encore été chargée. Reconnecte-toi à internet pour y accéder.</p></body></html>`,
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response("Hors connexion", { status: 503 });
  }
}
