"use client";

import { useEffect } from "react";

// Composant invisible qui enregistre le Service Worker au mount de l'app mobile.
// À inclure dans /m/layout.tsx pour activer le caching offline-first.
// Le SW est dans public/sw.js et gère stale-while-revalidate pour les pages /m/*.

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Enregistre le SW avec scope "/" pour couvrir toutes les routes.
    // On retarde de 1s pour ne pas concurrencer le rendu initial.
    const timeoutId = window.setTimeout(() => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          // Si une nouvelle version SW est trouvée, on l'active immédiatement
          // (le SW lui-même fait skipWaiting + clients.claim).
          registration.update();
        })
        .catch((error) => {
          // SW non critique — on ignore en cas d'échec (HTTP local, etc.)
          console.warn("[Vertxia SW] Enregistrement échoué :", error);
        });
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return null;
}
