/**
 * Page /demo/[id] — URL persistante d'une démo Vertxia générée.
 *
 * Server Component qui :
 *   1. Récupère les searchParams (u = blob URL, shop, vendor, product, image)
 *   2. Génère les meta tags OG/Twitter pour les partages sociaux
 *   3. Délègue le rendu 3D au client component DemoView
 *
 * Format URL :
 *   /demo/abc123?u=<blob-url>&shop=<shop>&vendor=<vendor>&product=<product>&image=<image>
 *
 * L'URL est destinée à être partagée (DM, cold outreach, posts Reels).
 * Chaque démo générée via /try produit une URL de ce type.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { DemoView } from "./demo-view";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    u?: string;
    shop?: string;
    vendor?: string;
    product?: string;
    image?: string;
  }>;
};

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const vendor = sp.vendor || "Une boutique Shopify";
  const product = sp.product || "";
  const title = product
    ? `${vendor} · ${product} en 3D · Vertxia`
    : `${vendor} en 3D · Vertxia`;
  const description = `Démo immersive 3D générée pour ${vendor}. Site interactif, mesh haute définition. Active la version complète pour ta boutique.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: sp.image ? [{ url: sp.image, width: 1200, height: 1200 }] : undefined,
      type: "website",
      siteName: "Vertxia",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: sp.image ? [sp.image] : undefined,
    },
  };
}

export default async function DemoPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  // Validation : on a besoin du blob URL pour pouvoir afficher la démo
  if (!sp.u || !sp.u.startsWith("http")) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <span className="font-mono text-[10px] tracking-[0.4em] text-red-400 block mb-3">
          DÉMO INTROUVABLE
        </span>
        <h1 className="text-3xl font-light tracking-tight mb-3">Lien incomplet</h1>
        <p className="text-white/50 text-sm text-center max-w-md mb-8">
          Cette URL de démo ne contient pas les paramètres nécessaires.
          Probablement un lien tronqué ou modifié.
        </p>
        <Link
          href="/try"
          className="px-6 py-3 bg-white text-black font-mono text-xs tracking-[0.3em] rounded-lg hover:bg-white/90 transition"
        >
          GÉNÉRER MA PROPRE DÉMO →
        </Link>
      </div>
    );
  }

  return (
    <DemoView
      id={id}
      glbUrl={sp.u}
      shop={sp.shop || ""}
      vendor={sp.vendor || "Boutique Shopify"}
      product={sp.product || "Produit"}
      image={sp.image || ""}
    />
  );
}
