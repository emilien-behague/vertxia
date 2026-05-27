/**
 * Page /demo — Vertxia Lab portfolio.
 *
 * Pivot 27/05/2026 : ce n'est plus une démo "voici ce qu'on ferait avec ton
 *   produit" (mesh-centric). C'est un portfolio qui démontre la capacité à
 *   concevoir un site 3D incroyable. Le site EST la preuve.
 *
 * Pour les démos clients spécifiques (mesh d'un produit Shopify généré via
 *   /try), voir /demo/[id] qui rend toujours <DemoView /> (le composant
 *   mesh-centric initial).
 */

import type { Metadata } from "next";
import { PortfolioView } from "./portfolio-view";

export const metadata: Metadata = {
  title: "Vertxia · Lab — L'IA qui transforme ton Shopify en site 3D cinéma",
  description:
    "Build in public solo. Un dev, une IA, des sites 3D cinéma en 4 minutes à partir d'une URL Shopify. Particules GPU, postprocess ACES, palette Magic Window.",
  openGraph: {
    title: "Vertxia · Lab",
    description:
      "L'IA qui transforme ton Shopify en site 3D cinéma. Build in public solo.",
    type: "website",
    siteName: "Vertxia",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vertxia · Lab",
    description: "L'IA qui transforme ton Shopify en site 3D cinéma.",
  },
};

export default function VertxiaLabPage() {
  return <PortfolioView />;
}
