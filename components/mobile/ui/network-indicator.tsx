"use client";

import { useEffect, useState } from "react";
import { countPendingOperations, flushQueue } from "@/lib/sync/offline-queue";

// Badge réseau affiché en haut de l'app mobile :
//  - 🟢 "En ligne" si online + 0 opération en attente (caché par défaut)
//  - 🟠 "Hors connexion · N en attente" si offline ou opérations queued
//  - 🟢 "✓ Synchronisé" flash 2 sec après sync réussie
//
// S'auto-refresh quand l'event window "online" / "offline" fire.

type Status =
  | { type: "online_clean" }
  | { type: "offline"; pending: number }
  | { type: "online_pending"; pending: number }
  | { type: "synced"; count: number };

export function NetworkIndicator() {
  const [status, setStatus] = useState<Status>({ type: "online_clean" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    async function refresh() {
      const online = typeof navigator === "undefined" ? true : navigator.onLine;
      const pending = await countPendingOperations();
      if (!online) {
        setStatus({ type: "offline", pending });
      } else if (pending > 0) {
        setStatus({ type: "online_pending", pending });
      } else {
        setStatus({ type: "online_clean" });
      }
    }

    refresh();

    async function handleOnline() {
      const beforePending = await countPendingOperations();
      if (beforePending > 0) {
        const result = await flushQueue();
        if (result.succeeded > 0) {
          setStatus({ type: "synced", count: result.succeeded });
          setTimeout(() => {
            refresh();
          }, 2500);
        } else {
          refresh();
        }
      } else {
        setStatus({ type: "online_clean" });
      }
    }

    function handleOffline() {
      refresh();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Refresh périodique léger pour catch les sync silencieuses
    const interval = setInterval(refresh, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (!mounted) return null;

  // Quand tout va bien et qu'il n'y a rien à signaler, on ne montre RIEN
  // pour ne pas polluer l'UI. Le badge n'apparaît que sur changement d'état.
  if (status.type === "online_clean") return null;

  let label: string;
  let bg: string;
  let dot: string;

  if (status.type === "offline") {
    label = status.pending > 0
      ? `Hors connexion · ${status.pending} en attente`
      : "Hors connexion";
    bg = "bg-orange-100 text-orange-800 ring-orange-200";
    dot = "bg-orange-500";
  } else if (status.type === "online_pending") {
    label = `Sync · ${status.pending} en cours`;
    bg = "bg-blue-100 text-blue-800 ring-blue-200";
    dot = "bg-blue-500 animate-pulse";
  } else {
    label = `✓ ${status.count} synchronisé${status.count > 1 ? "s" : ""}`;
    bg = "bg-emerald-100 text-emerald-800 ring-emerald-200";
    dot = "bg-emerald-500";
  }

  return (
    <div
      className="fixed top-0 inset-x-0 z-50 flex justify-center pointer-events-none"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}
    >
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ring-1 text-[11px] font-medium tracking-tight ${bg} pointer-events-auto`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {label}
      </div>
    </div>
  );
}
