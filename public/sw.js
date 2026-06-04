// Service Worker Vertxia — caching offline-first pour les pages /m/*
// Stratégie :
//  - /m/scan : NETWORK-ONLY (jamais de cache, sinon nouveau code pas vu)
//  - Autres pages /m/* : stale-while-revalidate
//  - Assets statiques (_next/static, /icons, /fonts) : cache-first
//  - Routes API : pas de cache, network-only
//  - Workers .js dans public/ : network-only (content-type strict)
//  - Autres pages : network-first avec fallback cache

const CACHE_VERSION = "vertxia-v8";
const STATIC_CACHE = "vertxia-static-v8";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Nettoyage TOTAL des anciens caches (toutes versions, tout type).
      // On garde uniquement la version courante.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API routes : network-only
  if (url.pathname.startsWith("/api/")) return;

  // Workers .js dans public/ : network-only (content-type strict)
  if (
    url.pathname === "/qr-scanner-worker.min.js" ||
    url.pathname.endsWith(".wasm")
  ) {
    return;
  }

  // /m/scan + sous-pages : NETWORK-ONLY pour garantir que l'utilisateur
  // voit toujours la dernière version du scanner (changements fréquents
  // de lib, et un cache obsolète casserait la démo CAPEB).
  if (url.pathname === "/m/scan" || url.pathname.startsWith("/m/scan/")) {
    return; // pas de respondWith → fetch direct du navigateur
  }

  // Page de reset SW : JAMAIS cachée, sinon elle ne peut pas se mettre
  // à jour pour exécuter ses dernières instructions de nettoyage.
  if (url.pathname === "/reset-app.html") {
    return;
  }

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

  // Pages /m/* : NETWORK-FIRST (pas stale-while-revalidate).
  // Raison : ces pages dépendent de la session Supabase. Si le SW sert
  // une version cachée HTML, le state cookie côté serveur peut ne pas
  // correspondre à ce que la page affiche (ex: "tu te déconnectes au
  // refresh" car le HTML cached ne déclenche pas updateSession middleware).
  // Network-first garantit que chaque navigation passe par le middleware
  // Next.js et donc rafraîchit les cookies de session.
  if (
    url.pathname.startsWith("/m") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // /eq/* : NETWORK-FIRST (le code change souvent — partage QR, diagnostic).
  // stale-while-revalidate servait du vieux HTML jusqu'au prochain scan, ce
  // qui masquait les fixes deployes. Network-first force chaque scan a tenter
  // le reseau et tombe sur le cache uniquement si offline.
  if (url.pathname.startsWith("/eq/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Home : stale-while-revalidate (rarement modifiee)
  if (url.pathname === "/") {
    event.respondWith(staleWhileRevalidate(event, request));
    return;
  }

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

  if (cached) {
    if (event && typeof event.waitUntil === "function") {
      event.waitUntil(fetchPromise);
    }
    return cached;
  }
  const networkResponse = await fetchPromise;
  if (networkResponse) return networkResponse;
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
