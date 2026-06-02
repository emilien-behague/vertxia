import type { ReactNode } from "react";
import { BottomTabBar } from "@/components/mobile/bottom-tab-bar";

// Layout app mobile — wrapper minimal qui ajoute la BottomTabBar fixée en bas.
// Le MobileHeader est rendu par chaque page individuellement pour pouvoir
// customiser title/backHref/largeTitle selon la page.
//
// padding-bottom : ~80px pour laisser la place à la tab bar (qui est fixed).

export default function MobileAppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#111] font-sans antialiased">
      <main className="max-w-md mx-auto" style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}>
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
