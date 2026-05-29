/**
 * Types partages entre les etapes du pipeline Vertxia Lite.
 *
 * Le pipeline tourne en chaine :
 *   scrape  -> ScrapeResult     (stocke dans data/scrapes/{slug}.json)
 *   brief   -> CreativeBrief    (stocke dans data/briefs/{slug}.json — format V0.1 complet
 *                                conforme a `Brief` de lib/brief.ts, consomme par /lite/[domain])
 *   videos  -> VideoAsset[]     (stocke dans public/lite/videos/{slug}/ + brief enrichi)
 *   compose -> SiteManifest     (stocke dans data/sites/{slug}.json)
 *
 * CreativeBrief = type alias de Brief (lib/brief.ts) pour rester pipeline-centric.
 */

import type { Brief } from "@/lib/brief";

/** Alias du Brief V0.1 consomme par les templates. Etend avec curated flag optionnel. */
export type CreativeBrief = Brief & { curated?: boolean };

/* =========================================================
 *  SCRAPE — sortie de l'etape 1
 * ========================================================= */

export type ScrapedProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  /** Premiere image principale (URL absolue). */
  imageUrl: string | null;
  /** Toutes les images dispos. */
  images: string[];
  price: number | null;
  currency: string | null;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  url: string;
};

export type ScrapedBrand = {
  /** Nom de la brand extrait (meta og:site_name, title, fallback domain). */
  name: string;
  /** Domaine raw : "allbirds.com". */
  domain: string;
  /** Description (meta description ou og:description). */
  description: string | null;
  /** Favicon URL absolue. */
  faviconUrl: string | null;
  /** Cover image (og:image). */
  coverImageUrl: string | null;
  /** Couleurs detectees (parsing CSS, V2). Vide en V1. */
  palette: string[];
};

export type ScrapeResult = {
  brand: ScrapedBrand;
  products: ScrapedProduct[];
  /** Source du scrape : "shopify_products_json" ou "html_fallback". */
  source: "shopify_products_json" | "html_fallback";
  scrapedAt: number;
};

/* =========================================================
 *  VIDEOS — sortie de l'etape 3
 * ========================================================= */

export type VideoAsset = {
  productId: string;
  /** Chemin public servable : "/lite/{slug}/videos/{id}.mp4". */
  url: string;
  durationSec: number;
  engine: "kling" | "runway" | "veo" | "higgsfield" | "hailuo";
  generatedAt: number;
};

/* =========================================================
 *  SITE — sortie de l'etape 4 (composer)
 * ========================================================= */

export type SiteManifest = {
  slug: string;
  brief: CreativeBrief;
  scrape: ScrapeResult;
  videos: VideoAsset[];
  /** URL publique du site : "/lite/{slug}". */
  url: string;
  composedAt: number;
};
