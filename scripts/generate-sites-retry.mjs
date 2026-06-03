/**
 * Retry — tente une liste de candidats Shopify et garde les N premiers OK.
 *
 * Run : cd web && node scripts/generate-sites-retry.mjs <N=3>
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WEB_ROOT = resolve(__dirname, "..");

function loadEnvLocal() {
  const envPath = resolve(WEB_ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}
loadEnvLocal();

const TARGET_OK_COUNT = Number(process.argv[2] || 3);

const CANDIDATES = [
  { domain: "maap.cc", prompt: "cycling premium aussie, mood dark moody performance, vibe matiere technique haut de gamme" },
  { domain: "rapha.cc", prompt: "cycling heritage UK, narrative film-grain documentaire route, mood roadbook editoriale" },
  { domain: "darntough.com", prompt: "outdoor heritage Vermont, manifeste lifetime warranty, mood mountains-and-grit cinematic" },
  { domain: "huckberry.com", prompt: "lifestyle outdoor narrative, mood explorer-magazine, palette warm rugged" },
  { domain: "uglydrinks.com", prompt: "boisson disruptive UK, branding fun assume, palette acidulee maximalist" },
  { domain: "trueclassic.com", prompt: "menswear essentials, mood confidence accessible, palette neutral premium" },
  { domain: "rhone.com", prompt: "performance wear tech, mood athleisure premium, palette charcoal-flux" },
  { domain: "stio.com", prompt: "outdoor mountain Wyoming, mood quiet-confidence-alpine, palette earth-sky" },
  { domain: "branchbasics.com", prompt: "menage clean refill, mood manifeste-clarity, palette pastel naturel" },
  { domain: "manscaped.com", prompt: "grooming masculin disruptif, mood tech-bold, palette dark-accent" },
];

const SYSTEM_PROMPT = `Tu es VERTXIA DIRECTOR — un creative director IA pour des sites e-commerce cinematic premium.

Mission : analyser une brand Shopify + son catalogue, et generer un BRIEF CREATIF COMPLET qui guidera la composition automatique d'un site cinematic.

Le brief doit avoir un point de vue. Une voix de marque assumee. Refuse les copys generiques type "Shop our new collection" — privilegie une voix editoriale, manifeste, ou narrative selon le mood demande par le client.

## Choix template_id (squelette structurel)
- editorial-magazine  : grid 2 col, manifesto, scroll vertical
- cinematic-narrative : scroll-snap fullscreen 1 produit/ecran
- documentary-story   : long-form article avec drop caps + photos parallax
- horizontal-slider   : scroll horizontal snap-x, 1 slide = 100vw
- brutalist-tech      : neubrutalism NB+accent, bordures 2px, hard shadows
- museum-curated      : fond blanc, photos petites centrees, vide vertical, typo serif legere — luxe ultra-minimal (Margiela/Lemaire/Aesop)
- kinetic-typography  : photo brutaliste full-bleed + ENORME typo overlay + marquees — mode/streetwear/sport (Lululemon/Off-White/Wodniack)
- noir-magazine       : fond noir + enorme wordmark serif Fraunces + 3 teasers couleur + drop cap — luxe noir / spirits / niche perfume / travel premium (Voyager Press, Wallpaper, Mr Porter Journal)
- cyberpunk-noir      : video dark fullscreen + serif italique + scanlines + accent neon vif + glitch hover + terminal footer — tech moody / cyberpunk / techwear / gaming / vape (Sarah Mitchell / Blade Runner)

## Choix visual_signature
- none, film-grain, halftone-print, glitch-vhs, neon-noir

Tu DOIS appeler submit_brief avec un JSON valide. N'ecris RIEN d'autre.`;

const BRIEF_TOOL = {
  name: "submit_brief",
  description: "Submit the V0.1 creative brief.",
  input_schema: {
    type: "object",
    properties: {
      template_id: { type: "string", enum: ["editorial-magazine", "cinematic-narrative", "documentary-story", "horizontal-slider", "brutalist-tech", "museum-curated", "kinetic-typography", "noir-magazine", "cyberpunk-noir"] },
      visual_signature: { type: "string", enum: ["none", "film-grain", "halftone-print", "glitch-vhs", "neon-noir"] },
      brand: { type: "object", properties: { name: { type: "string" }, category: { type: "string" }, positioning_one_liner: { type: "string" }, icp: { type: "string" }, voice: { type: "string" } }, required: ["name", "category", "positioning_one_liner", "icp", "voice"] },
      client_prompt_interpretation: { type: "string" },
      creative_direction: { type: "object", properties: { mood: { type: "string" }, reference_style: { type: "string" }, narrative_arc: { type: "string" } }, required: ["mood", "reference_style", "narrative_arc"] },
      visual_system: {
        type: "object",
        properties: {
          palette: { type: "array", minItems: 5, maxItems: 5, items: { type: "object", properties: { name: { type: "string", enum: ["background", "foreground", "accent", "muted", "surface"] }, hex: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" } }, required: ["name", "hex"] } },
          fonts: { type: "object", properties: { serif: { type: "string" }, sans: { type: "string" } }, required: ["serif", "sans"] },
          spacing_density: { type: "string", enum: ["spacious", "balanced", "dense"] },
          imagery_treatment: { type: "string" },
        },
        required: ["palette", "fonts", "spacing_density", "imagery_treatment"],
      },
      hero: { type: "object", properties: { kicker: { type: "string" }, headline: { type: "string" }, subheadline: { type: "string" }, primary_cta_label: { type: "string" }, secondary_cta_label: { type: ["string", "null"] } }, required: ["kicker", "headline", "subheadline", "primary_cta_label"] },
      site_structure: { type: "array", minItems: 3, maxItems: 5, items: { type: "object", properties: { section: { type: "string" }, section_role: { type: "string" }, headline: { type: "string" }, body_paragraphs: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 }, pull_quote: { type: ["string", "null"] } }, required: ["section", "section_role", "headline", "body_paragraphs"] } },
      featured_products: { type: "array", minItems: 3, maxItems: 6, items: { type: "object", properties: { handle: { type: "string" }, title: { type: "string" }, hero_image_url: { type: "string" }, price_eur: { type: ["string", "number", "null"] }, editorial_caption: { type: "string" }, video_prompt: { type: "string" }, video_engine_hint: { type: "string", enum: ["kling", "runway", "veo", "higgsfield", "hailuo"] }, video_duration_s: { type: "number", enum: [5] } }, required: ["handle", "title", "hero_image_url", "editorial_caption", "video_prompt", "video_engine_hint", "video_duration_s"] } },
      footer: { type: "object", properties: { tagline: { type: "string" }, closing_line: { type: "string" } }, required: ["tagline", "closing_line"] },
    },
    required: ["template_id", "visual_signature", "brand", "client_prompt_interpretation", "creative_direction", "visual_system", "hero", "site_structure", "featured_products", "footer"],
  },
};

const USER_AGENT = "VertxiaLiteBot/0.5 (+https://vertxia.com)";

async function fetchJson(url, timeoutMs = 12_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

async function fetchText(url, timeoutMs = 12_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } , signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally { clearTimeout(t); }
}

async function scrapeShopify(domain) {
  const json = await fetchJson(`https://${domain}/products.json?limit=50`);
  const products = (json.products || []).map((p) => ({
    id: p.id, handle: p.handle, title: p.title, vendor: p.vendor || "",
    description: (p.body_html || "").replace(/<[^>]+>/g, "").slice(0, 400),
    price: p.variants?.[0]?.price ? Number(p.variants[0].price) : null,
    imageUrl: p.images?.[0]?.src || "",
  }));
  let brand = { name: domain.split(".")[0], domain, description: "" };
  try {
    const html = await fetchText(`https://${domain}/`);
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const ogSite = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
    if (ogSite) brand.name = ogSite[1].trim();
    else if (titleMatch) brand.name = titleMatch[1].split(/[|·–-]/)[0].trim().slice(0, 80);
    if (descMatch) brand.description = descMatch[1].slice(0, 400);
  } catch {}
  return { brand, products, source: "shopify_products_json", scrapedAt: Date.now() };
}

const slugify = (d) => d.replace(/[.-]/g, "_");

async function buildBrief(scrape, userPrompt, client) {
  const products = scrape.products.slice(0, 18);
  const brandBlock = [`Domain: ${scrape.brand.domain}`, `Brand name: ${scrape.brand.name}`, scrape.brand.description ? `Description: ${scrape.brand.description}` : null].filter(Boolean).join("\n");
  const productsBlock = products.map((p, i) => `${i + 1}. handle="${p.handle}" id=${p.id}\n   title: ${p.title}` + (p.vendor ? ` — ${p.vendor}` : "") + (p.price ? ` — ${p.price}€` : "") + (p.imageUrl ? `\n   img: ${p.imageUrl}` : "") + `\n   ${p.description}`).join("\n\n");
  const userContent = `# CREATIVE BRIEF REQUEST\n\n## Brand\n${brandBlock}\n\n## Catalog (${products.length} products)\n${productsBlock}\n\n## User mood prompt\n${userPrompt}\n\nAppelle submit_brief.`;
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    tools: [BRIEF_TOOL],
    tool_choice: { type: "tool", name: "submit_brief" },
    messages: [{ role: "user", content: userContent }],
  });
  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse) throw new Error("Claude n'a pas appele submit_brief");
  return { ...toolUse.input, _meta: { model: "claude-sonnet-4-6", client_prompt: userPrompt, source_json: `${scrape.brand.domain}_scrape.json`, product_count_total: scrape.products.length, featured_count: toolUse.input.featured_products?.length || 0, generated_in_seconds: 0, usage: response.usage } };
}

function injectImageUrls(brief, scrape) {
  const handleToImage = new Map(scrape.products.map((p) => [p.handle, p.imageUrl]));
  brief.featured_products = (brief.featured_products || []).map((p) => {
    if (!p.hero_image_url || p.hero_image_url.startsWith("placeholder")) {
      const img = handleToImage.get(p.handle);
      if (img) p.hero_image_url = img;
    }
    return p;
  });
  return brief;
}

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const results = [];
let okCount = 0;

for (const target of CANDIDATES) {
  if (okCount >= TARGET_OK_COUNT) break;
  const slug = slugify(target.domain);
  console.log(`\n[${target.domain}] start (${okCount}/${TARGET_OK_COUNT} OK so far)`);

  let scrape;
  try {
    scrape = await scrapeShopify(target.domain);
    console.log(`  scrape OK : ${scrape.products.length} products, brand="${scrape.brand.name}"`);
  } catch (err) {
    console.error(`  scrape KO : ${err.message}`);
    results.push({ slug, domain: target.domain, status: "scrape_failed", error: err.message });
    continue;
  }

  if (scrape.products.length === 0) {
    results.push({ slug, domain: target.domain, status: "no_products" });
    continue;
  }

  const scrapeDir = resolve(WEB_ROOT, "data", "scrapes");
  if (!existsSync(scrapeDir)) mkdirSync(scrapeDir, { recursive: true });
  writeFileSync(resolve(scrapeDir, `${slug}.json`), JSON.stringify(scrape, null, 2));

  let brief;
  try {
    const start = Date.now();
    brief = await buildBrief(scrape, target.prompt, client);
    brief = injectImageUrls(brief, scrape);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`  brief OK : template=${brief.template_id} signature=${brief.visual_signature} (${elapsed}s)`);
    console.log(`    palette : ${brief.visual_system?.palette?.map(p => p.hex).join(' ')}`);
  } catch (err) {
    console.error(`  brief KO : ${err.message}`);
    results.push({ slug, domain: target.domain, status: "brief_failed", error: err.message });
    continue;
  }

  const briefDir = resolve(WEB_ROOT, "data", "briefs");
  if (!existsSync(briefDir)) mkdirSync(briefDir, { recursive: true });
  writeFileSync(resolve(briefDir, `${slug}.json`), JSON.stringify(brief, null, 2));

  okCount++;
  results.push({ slug, domain: target.domain, status: "ok", template: brief.template_id, signature: brief.visual_signature });
}

console.log("\n\n=== RESUME ===");
for (const r of results) {
  if (r.status === "ok") console.log(`OK  ${r.domain.padEnd(28)} -> /lite/${r.slug}  [${r.template} / ${r.signature}]`);
  else console.log(`KO  ${r.domain.padEnd(28)} -> ${r.status}: ${r.error || ""}`);
}
console.log(`\n${okCount}/${TARGET_OK_COUNT} cibles OK`);
