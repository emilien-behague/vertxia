/**
 * Layout dashboard SaaS Vertxia (route /app).
 * Sidebar fixed 280px gauche + main area scrollable.
 * Dark mode only, noir profond #050505.
 */
import type { Metadata } from "next";
import { Sidebar } from "@/components/app/sidebar";

export const metadata: Metadata = {
  title: "Vertxia · Build cinematic sites from a Shopify URL",
  description:
    "Transformez une URL Shopify + un prompt créatif en site cinematic avec vidéos AI par produit.",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[#050505] text-white antialiased flex">
      <Sidebar />
      <main className="flex-1 min-h-screen relative overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
