/**
 * Scraper Shopify pour Vertxia Lite (etape 1 du pipeline).
 *
 * Strategy :
 *  1. Essaye `https://{domain}/products.json?limit=50` (endpoint public Shopify standard)
 *  2. Fallback : fetch homepage + extract meta og:* + JSON-LD Product
 *
 * Limites V0.5 :
 *  - Pas de pagination (50 produits max sur le 1er essai)
 *  - Pas de scrape des collections (juste produits)
 *  - Pas de detection palette (V2)
 */

import type {
  ScrapeResult,
  ScrapedProduct,
  ScrapedBrand,
} from "./types";

const SCRAPE_TIMEOUT_MS = 12_000;
const USER_AGENT =
  "VertxiaLiteBot/0.5 (+https://vertxia.com; scraping for cinematic site composition)";

/* =========================================================
 *  Public entry
 * ========================================================= */

export async function scrapeShopify(domain: string): Promise<ScrapeResult> {
  const cleanDomain = sanitizeDomain(domain);

  // Tentative 1 : Shopify products.json
  try {
    const products = await fetchShopifyProductsJson(cleanDomain);
    if (products.length > 0) {
      const brand = await fetchBrandFromHtml(cleanDomain).catch(() =>
        fallbackBrand(cleanDomain)
      );
      return {
        brand,
        products,
        source: "shopify_products_json",
        scrapedAt: Date.now(),
      };
    }
  } catch {
    // ignore — bascule sur le fallback HTML
  }

  // Tentative 2 : fallback HTML
  const brand = await fetchBrandFromHtml(cleanDomain).catch(() =>
    fallbackBrand(cleanDomain)
  );
  const products = await fetchProductsFromJsonLd(cleanDomain).catch(() => []);
  return {
    brand,
    products,
    source: "html_fallback",
    scrapedAt: Date.now(),
  };
}

/* =========================================================
 *  Shopify products.json
 * ========================================================= */

type ShopifyProductsResponse = {
  products: Array<{
    id: number;
    title: string;
    handle: string;
    body_html: string;
    vendor: string;
    product_type: string;
    tags: string[];
    images: Array<{ src: string; position: number }>;
    variants: Array<{ price: string }>;
  }>;
};

async function fetchShopifyProductsJson(
  domain: string
): Promise<ScrapedProduct[]> {
  const url = `https://${domain}/products.json?limit=50`;
  const res = await fetchWithTimeout(url, SCRAPE_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error(`products.json HTTP ${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(`products.json wrong content-type: ${contentType}`);
  }

  const data = (await res.json()) as ShopifyProductsResponse;
  if (!Array.isArray(data.products)) {
    throw new Error("products.json malformed (no .products array)");
  }

  return data.products.map((p) => {
    const images = (p.images || [])
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((img) => img.src)
      .filter(Boolean);
    const price =
      p.variants && p.variants[0] && p.variants[0].price
        ? parseFloat(p.variants[0].price)
        : null;

    return {
      id: String(p.id),
      title: p.title || "Untitled",
      handle: p.handle || "",
      description: stripHtml(p.body_html || ""),
      imageUrl: images[0] || null,
      images,
      price: Number.isFinite(price) ? price : null,
      currency: null, // products.json ne contient pas la currency
      vendor: p.vendor || null,
      productType: p.product_type || null,
      tags: Array.isArray(p.tags) ? p.tags : [],
      url: `https://${domain}/products/${p.handle}`,
    };
  });
}

/* =========================================================
 *  Brand extraction (homepage HTML)
 * ========================================================= */

async function fetchBrandFromHtml(domain: string): Promise<ScrapedBrand> {
  const url = `https://${domain}/`;
  const res = await fetchWithTimeout(url, SCRAPE_TIMEOUT_MS);
  if (!res.ok) {
    throw new Error(`homepage HTTP ${res.status}`);
  }
  const html = await res.text();

  const ogSiteName = extractMeta(html, "og:site_name");
  const titleTag = extractTagText(html, "title");
  const ogDescription = extractMeta(html, "og:description");
  const metaDescription = extractMeta(html, "description", "name");
  const ogImage = extractMeta(html, "og:image");

  // Favicon : link rel="icon" ou apple-touch-icon
  const faviconHref =
    extractLinkHref(html, "icon") ||
    extractLinkHref(html, "shortcut icon") ||
    extractLinkHref(html, "apple-touch-icon");

  return {
    name: ogSiteName || titleTag || domain,
    domain,
    description: ogDescription || metaDescription || null,
    faviconUrl: faviconHref ? toAbsolute(domain, faviconHref) : null,
    coverImageUrl: ogImage ? toAbsolute(domain, ogImage) : null,
    palette: [], // V2 : extraire via CSS parsing
  };
}

function fallbackBrand(domain: string): ScrapedBrand {
  return {
    name: domain,
    domain,
    description: null,
    faviconUrl: null,
    coverImageUrl: null,
    palette: [],
  };
}

/* =========================================================
 *  Fallback : JSON-LD Product (pour sites non-Shopify)
 * ========================================================= */

async function fetchProductsFromJsonLd(
  domain: string
): Promise<ScrapedProduct[]> {
  const url = `https://${domain}/`;
  const res = await fetchWithTimeout(url, SCRAPE_TIMEOUT_MS);
  if (!res.ok) return [];
  const html = await res.text();

  const blocks = extractJsonLdBlocks(html);
  const products: ScrapedProduct[] = [];

  for (const raw of blocks) {
    try {
      const data = JSON.parse(raw);
      collectJsonLdProducts(data, domain, products);
    } catch {
      // skip malformed JSON-LD
    }
  }
  return products.slice(0, 20);
}

type JsonLdMaybe = {
  "@type"?: string | string[];
  "@graph"?: unknown[];
  [key: string]: unknown;
};

function collectJsonLdProducts(
  node: unknown,
  domain: string,
  out: ScrapedProduct[]
) {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectJsonLdProducts(n, domain, out));
    return;
  }
  if (typeof node !== "object") return;

  const obj = node as JsonLdMaybe;
  const types = Array.isArray(obj["@type"])
    ? obj["@type"]
    : obj["@type"]
    ? [obj["@type"]]
    : [];

  if (types.includes("Product")) {
    const name = (obj.name as string) || "Untitled";
    const description = (obj.description as string) || "";
    const imageField = obj.image;
    const images = Array.isArray(imageField)
      ? (imageField.filter((i) => typeof i === "string") as string[])
      : typeof imageField === "string"
      ? [imageField]
      : [];
    const offers = obj.offers as JsonLdMaybe | undefined;
    const price = offers && typeof offers === "object"
      ? parseFloat(((offers as JsonLdMaybe).price as string) || "")
      : null;
    const currency =
      offers && typeof offers === "object"
        ? ((offers as JsonLdMaybe).priceCurrency as string) || null
        : null;
    out.push({
      id: (obj.sku as string) || (obj.productID as string) || name,
      title: name,
      handle: slugify(name),
      description: stripHtml(description),
      imageUrl: images[0] || null,
      images,
      price: Number.isFinite(price) ? (price as number) : null,
      currency,
      vendor: (obj.brand as JsonLdMaybe)?.name as string | null ?? null,
      productType: null,
      tags: [],
      url: (obj.url as string) || `https://${domain}/`,
    });
  }

  if (Array.isArray(obj["@graph"])) {
    obj["@graph"].forEach((n) => collectJsonLdProducts(n, domain, out));
  }
}

/* =========================================================
 *  Helpers
 * ========================================================= */

function sanitizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/\/$/, "");
  d = d.split("/")[0];
  d = d.replace(/^www\./, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) {
    throw new Error(`Invalid domain: "${input}"`);
  }
  return d;
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json, text/html;q=0.9, */*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
      },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeout);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

function extractMeta(html: string, key: string, attr: "property" | "name" = "property"): string | null {
  const re = new RegExp(
    `<meta\\s+[^>]*${attr}=["']${escapeRegex(key)}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const m = html.match(re);
  if (m) return decodeEntities(m[1]);
  // try inverted attribute order
  const re2 = new RegExp(
    `<meta\\s+[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${escapeRegex(key)}["']`,
    "i"
  );
  const m2 = html.match(re2);
  return m2 ? decodeEntities(m2[1]) : null;
}

function extractTagText(html: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = html.match(re);
  return m ? decodeEntities(m[1].trim()) : null;
}

function extractLinkHref(html: string, rel: string): string | null {
  const re = new RegExp(
    `<link\\s+[^>]*rel=["']${escapeRegex(rel)}["'][^>]*href=["']([^"']*)["']`,
    "i"
  );
  const m = html.match(re);
  if (m) return m[1];
  const re2 = new RegExp(
    `<link\\s+[^>]*href=["']([^"']*)["'][^>]*rel=["']${escapeRegex(rel)}["']`,
    "i"
  );
  const m2 = html.match(re2);
  return m2 ? m2[1] : null;
}

function extractJsonLdBlocks(html: string): string[] {
  const out: string[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    out.push(m[1].trim());
  }
  return out;
}

function toAbsolute(domain: string, url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://${domain}${url}`;
  return `https://${domain}/${url}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
