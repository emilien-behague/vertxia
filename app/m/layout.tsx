import type { ReactNode } from "react";
import { BottomTabBar } from "@/components/mobile/bottom-tab-bar";
import { NetworkIndicator } from "@/components/mobile/network-indicator";
import { ServiceWorkerRegister } from "@/components/mobile/service-worker-register";
import { AuthSync } from "@/components/mobile/auth-sync";
import { ScrollToTopOnNav } from "@/components/mobile/scroll-to-top-on-nav";

// Layout app mobile — wrapper minimal qui ajoute la BottomTabBar fixée en bas
// + le badge réseau (NetworkIndicator) en haut + l'enregistrement Service Worker
// pour le caching offline-first (public/sw.js).
//
// padding-bottom : ~80px pour laisser la place à la tab bar (qui est fixed).

export default function MobileAppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#111] font-sans antialiased">
      <AuthSync />
      <ScrollToTopOnNav />
      <ServiceWorkerRegister />
      <NetworkIndicator />
      <main className="max-w-md mx-auto" style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}>
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
