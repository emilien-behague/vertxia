/**
 * API Route /api/scrape
 *
 * Scrape une boutique Shopify via son endpoint /products.json public (exposé
 * par défaut sur ~95% des boutiques Shopify). Retourne vendor, count, et les
 * 5 premiers produits avec packshots.
 *
 * Pour la démo /try : confirme à l'utilisateur que sa boutique est détectable
 * et donne un aperçu du contenu qu'on pourrait transformer en 3D.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ScrapedProduct = {
  id: number;
  title: string;
  handle: string;
  image: string | null;
  price: string | null;
  url: string;
};

type ScrapeResult = {
  shop: string;
  vendor: string;
  count: number;
  products: ScrapedProduct[];
};

type ScrapeError = {
  error: string;
};

function normalizeUrl(input: string): string {
  let url = input.trim().toLowerCase();
  // Strip path / query, keep only origin
  url = url.replace(/^https?:\/\//, "");
  url = url.split("/")[0];
  url = url.split("?")[0];
  return `https://${url}`;
}

export async function POST(req: NextRequest) {
  let url: string;
  try {
    const body = await req.json();
    if (typeof body.url !== "string" || body.url.length < 5) {
      return NextResponse.json<ScrapeError>(
        { error: "URL invalide" },
        { status: 400 }
      );
    }
    url = normalizeUrl(body.url);
  } catch {
    return NextResponse.json<ScrapeError>(
      { error: "Body JSON invalide" },
      { status: 400 }
    );
  }

  let shopifyData: { products: unknown[] };
  try {
    const res = await fetch(`${url}/products.json?limit=20`, {
      headers: { "User-Agent": "Vertxia/1.0 (demo)" },
      // Timeout via AbortController serait plus propre, mais fetch native Node a un timeout par défaut
    });

    if (!res.ok) {
      return NextResponse.json<ScrapeError>(
        {
          error:
            res.status === 404
              ? "Pas une boutique Shopify (404 sur /products.json)"
              : `Erreur HTTP ${res.status}`,
        },
        { status: 400 }
      );
    }

    shopifyData = await res.json();

    if (!Array.isArray(shopifyData?.products)) {
      return NextResponse.json<ScrapeError>(
        { error: "Format /products.json inattendu — probablement pas Shopify" },
        { status: 400 }
      );
    }
  } catch (err) {
    return NextResponse.json<ScrapeError>(
      {
        error:
          err instanceof Error
            ? `Erreur réseau : ${err.message}`
            : "Erreur réseau inconnue",
      },
      { status: 500 }
    );
  }

  // Cast type-safe : on a vérifié que products est un array
  type ShopifyProduct = {
    id: number;
    title: string;
    handle: string;
    vendor: string;
    images: Array<{ src: string }>;
    variants: Array<{ price: string }>;
  };
  const products = shopifyData.products as ShopifyProduct[];

  const result: ScrapeResult = {
    shop: url.replace(/^https?:\/\//, ""),
    vendor: products[0]?.vendor || "Boutique inconnue",
    count: products.length,
    products: products.slice(0, 5).map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      image: p.images?.[0]?.src || null,
      price: p.variants?.[0]?.price || null,
      url: `${url}/products/${p.handle}`,
    })),
  };

  return NextResponse.json<ScrapeResult>(result);
}
