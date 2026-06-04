import type { ReactNode } from "react";
import { BottomTabBar } from "@/components/mobile/bottom-tab-bar";
import { NetworkIndicator } from "@/components/mobile/network-indicator";
import { ServiceWorkerRegister } from "@/components/mobile/service-worker-register";
import { AuthSync } from "@/components/mobile/auth-sync";
import { ScrollToTopOnNav } from "@/components/mobile/scroll-to-top-on-nav";
import { ChatAssistant } from "@/components/mobile/chat-assistant";

// Layout app mobile — wrapper minimal qui ajoute la BottomTabBar fixée en bas
// + le badge réseau (NetworkIndicator) en haut + l'enregistrement Service Worker
// pour le caching offline-first (public/sw.js).
//
// padding-bottom : ~80px pour laisser la place à la tab bar (qui est fixed).
//
// IMPORTANT : pas de min-h-screen / min-h-dvh sur le wrapper — créait une zone
// vide énorme sous le contenu quand la page est courte (le wrapper s'étirait
// à 100vh même si le contenu fait 500px → 300-400px de cream vide en bas, et
// l'utilisateur scrollait dans le vide). Le body a déjà bg #F5F4F0 globalement,
// donc le viewport est cream même si le wrapper ne fait pas 100vh.

export default function MobileAppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#F5F4F0] text-[#111] font-sans antialiased">
      <AuthSync />
      <ScrollToTopOnNav />
      <ServiceWorkerRegister />
      <NetworkIndicator />
      <main className="max-w-md mx-auto" style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}>
        {children}
      </main>
      <BottomTabBar />
      <ChatAssistant />
    </div>
  );
}
