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
import { validateExternalUrl } from "@/lib/ssrf-guard";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB max pour /products.json

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
  // Rate limit : 20 scrapes / min / IP (gentil, le scrape coûte rien chez nous
  // mais bombarde des serveurs Shopify tiers)
  const rl = checkRateLimit(getClientIp(req), "scrape", { max: 20, windowMs: 60_000 });
  if (rl.blocked) {
    return NextResponse.json<ScrapeError>(
      { error: `Trop de requêtes — réessaie dans ${rl.retryAfterSec}s` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

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

  // SSRF guard : refuse les hostnames qui résolvent en IPs privées / metadata
  const guard = await validateExternalUrl(`${url}/products.json`);
  if (!guard.ok) {
    return NextResponse.json<ScrapeError>(
      { error: `URL bloquée : ${guard.reason}` },
      { status: 400 },
    );
  }

  let shopifyData: { products: unknown[] };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout
    const res = await fetch(`${url}/products.json?limit=20`, {
      headers: { "User-Agent": "Vertxia/1.0 (demo)" },
      redirect: "error", // refuse les redirects (anti-SSRF post-DNS-rebinding)
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // Cap la taille de la réponse pour éviter qu'un serveur ennemi nous envoie
    // un /products.json de 500 MB et fasse OOM la fonction.
    const len = res.headers.get("content-length");
    if (len && parseInt(len, 10) > MAX_RESPONSE_BYTES) {
      return NextResponse.json<ScrapeError>(
        { error: "Réponse trop volumineuse" },
        { status: 400 },
      );
    }

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
