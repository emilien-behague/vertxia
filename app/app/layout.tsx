/**
 * Layout Vertxia Studio (route /app).
 *
 * 3 colonnes :
 * - Sidebar gauche : 80px compacte (hover -> 120px expand)
 * - Workspace centre : flex-1
 * - Context Panel droite : 320px (collapsible -> 56px)
 *
 * Dark mode only, noir profond #050505.
 * Refonte 2026-05-29 : remplace l'ancien dashboard Lovable-style.
 */
import type { Metadata } from "next";
import { Sidebar } from "@/components/app/sidebar";
import { ContextPanel } from "@/components/app/context-panel";

export const metadata: Metadata = {
  title: "Vertxia Studio",
  description:
    "Studio de creation IA — transformez une URL Shopify en site cinematic complet avec videos AI.",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-full bg-[#050505] text-white antialiased flex overflow-hidden">
      <Sidebar />
      <main className="flex-1 h-screen relative overflow-hidden">
        {children}
      </main>
      <ContextPanel />
    </div>
  );
}
