/**
 * Page /demo (index) — URL canonique showcase pour le Reel.
 *
 * Pas besoin de générer une démo via /try : cette page rend l expérience
 * /demo/[id] complète (avec walkable portfolio chantier #5) en utilisant
 * un GLB local hardcodé (jiraya_m6.glb).
 *
 * Cas d usage :
 *   - Filmer le Reel sur une URL stable (vertxia.com/demo)
 *   - Partage TikTok / Instagram sans dépendance à une génération éphémère
 *   - Onboarding marketing — la home pointe ici pour montrer le WOW
 *
 * Le contenu (vendor, product, image) est hardcodé pour matcher
 * l esthétique de la démo Jiraya (Naruto Shippuden / buu-koff).
 */

import type { Metadata } from "next";
import { DemoView } from "./[id]/demo-view";

export const metadata: Metadata = {
  title: "Vertxia · Démo immersive 3D",
  description:
    "Découvre Vertxia — la boutique 3D générée en 4 min depuis ton Shopify. Mesh haute densité, scroll cinématique, gallery walkable.",
  openGraph: {
    title: "Vertxia · Démo immersive 3D",
    description:
      "Découvre Vertxia — la boutique 3D générée en 4 min depuis ton Shopify.",
    type: "website",
    siteName: "Vertxia",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vertxia · Démo immersive 3D",
    description:
      "Découvre Vertxia — la boutique 3D générée en 4 min depuis ton Shopify.",
  },
};

export default function DemoShowcasePage() {
  return (
    <DemoView
      id="showcase"
      glbUrl="/3d/jiraya_m6.glb"
      shop="buu-koff-2.myshopify.com"
      vendor="BUU-KOFF"
      product="Naruto Shippuden — Ichiban Kuji · Figurine Jiraya Sage Mode"
      image="https://cdn.shopify.com/s/files/1/0995/9597/7051/files/0C04CB5E-FB19-4670-BB18-4F60505AE02B.jpg?v=1779453813"
    />
  );
}
