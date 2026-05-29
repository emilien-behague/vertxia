/**
 * Test : reproduit EXACTEMENT le runBriefer du pipeline avec la schema tool complete.
 *
 * Run : cd web && node scripts/test-briefer-full.mjs <slug>
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WEB_ROOT = resolve(__dirname, "..");

function loadEnvLocal() {
  const envPath = resolve(WEB_ROOT, ".env.local");
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

loadEnvLocal();

const slug = process.argv[2] || "buu_koff_2_myshopify_com";
const scrapePath = resolve(WEB_ROOT, "data", "scrapes", `${slug}.json`);
const scrape = JSON.parse(readFileSync(scrapePath, "utf-8"));

const SYSTEM_PROMPT = `Tu es VERTXIA DIRECTOR — un creative director IA pour des sites e-commerce cinematic premium.

Mission : analyser une brand Shopify + son catalogue, et generer un BRIEF CREATIF COMPLET qui guidera la composition automatique d'un site cinematic.

Le brief doit avoir un point de vue. Une voix de marque assumee. Refuse les copys generiques type "Shop our new collection" — privilegie une voix editoriale, manifeste, ou narrative selon le mood demande par le client.

## Choix template_id (squelette structurel)
- editorial-magazine  : grid 2 col, manifesto, scroll vertical
- cinematic-narrative : scroll-snap fullscreen 1 produit/ecran
- documentary-story   : long-form article avec drop caps + photos parallax
- horizontal-slider   : scroll horizontal snap-x, 1 slide = 100vw
- brutalist-tech      : neubrutalism NB+accent, bordures 2px, hard shadows

## Choix visual_signature
- none, film-grain, halftone-print, glitch-vhs, neon-noir

Tu DOIS appeler submit_brief avec un JSON valide. N'ecris RIEN d'autre.`;

const BRIEF_TOOL = {
  name: "submit_brief",
  description: "Submit the V0.1 creative brief.",
  input_schema: {
    type: "object",
    properties: {
      template_id: {
        type: "string",
        enum: ["editorial-magazine", "cinematic-narrative", "documentary-story", "horizontal-slider", "brutalist-tech"],
      },
      visual_signature: {
        type: "string",
        enum: ["none", "film-grain", "halftone-print", "glitch-vhs", "neon-noir"],
      },
      brand: {
        type: "object",
        properties: {
          name: { type: "string" },
          category: { type: "string" },
          positioning_one_liner: { type: "string" },
          icp: { type: "string" },
          voice: { type: "string" },
        },
        required: ["name", "category", "positioning_one_liner", "icp", "voice"],
      },
      client_prompt_interpretation: { type: "string" },
      creative_direction: {
        type: "object",
        properties: {
          mood: { type: "string" },
          reference_style: { type: "string" },
          narrative_arc: { type: "string" },
        },
        required: ["mood", "reference_style", "narrative_arc"],
      },
      visual_system: {
        type: "object",
        properties: {
          palette: {
            type: "array",
            minItems: 5,
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                name: { type: "string", enum: ["background", "foreground", "accent", "muted", "surface"] },
                hex: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
              },
              required: ["name", "hex"],
            },
          },
          fonts: {
            type: "object",
            properties: { serif: { type: "string" }, sans: { type: "string" } },
            required: ["serif", "sans"],
          },
          spacing_density: { type: "string", enum: ["spacious", "balanced", "dense"] },
          imagery_treatment: { type: "string" },
        },
        required: ["palette", "fonts", "spacing_density", "imagery_treatment"],
      },
      hero: {
        type: "object",
        properties: {
          kicker: { type: "string" },
          headline: { type: "string" },
          subheadline: { type: "string" },
          primary_cta_label: { type: "string" },
          secondary_cta_label: { type: ["string", "null"] },
        },
        required: ["kicker", "headline", "subheadline", "primary_cta_label"],
      },
      site_structure: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            section: { type: "string" },
            section_role: { type: "string" },
            headline: { type: "string" },
            body_paragraphs: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
            pull_quote: { type: ["string", "null"] },
          },
          required: ["section", "section_role", "headline", "body_paragraphs"],
        },
      },
      featured_products: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            handle: { type: "string" },
            title: { type: "string" },
            hero_image_url: { type: "string" },
            price_eur: { type: ["string", "number", "null"] },
            editorial_caption: { type: "string" },
            video_prompt: { type: "string" },
            video_engine_hint: { type: "string", enum: ["kling", "runway", "veo", "higgsfield", "hailuo"] },
            video_duration_s: { type: "number", enum: [5] },
          },
          required: ["handle", "title", "hero_image_url", "editorial_caption", "video_prompt", "video_engine_hint", "video_duration_s"],
        },
      },
      footer: {
        type: "object",
        properties: { tagline: { type: "string" }, closing_line: { type: "string" } },
        required: ["tagline", "closing_line"],
      },
    },
    required: [
      "template_id", "visual_signature", "brand", "client_prompt_interpretation",
      "creative_direction", "visual_system", "hero", "site_structure",
      "featured_products", "footer",
    ],
  },
};

const products = scrape.products.slice(0, 20);
const userPrompt = "fait moi un site web interactif";

const brandBlock = [
  `Domain: ${scrape.brand.domain}`,
  `Brand name: ${scrape.brand.name}`,
  scrape.brand.description ? `Description: ${scrape.brand.description}` : null,
].filter(Boolean).join("\n");

const productsBlock = products.map(
  (p, i) =>
    `${i + 1}. handle="${p.handle}" id=${p.id}\n   title: ${p.title}` +
    (p.vendor ? ` — ${p.vendor}` : "") +
    (p.price ? ` — ${p.price}€` : "") +
    (p.imageUrl ? `\n   img: ${p.imageUrl}` : "") +
    `\n   ${p.description}`
).join("\n\n");

const userContent = `# CREATIVE BRIEF REQUEST

## Brand
${brandBlock}

## Catalog (${products.length} products)
${productsBlock}

## User mood prompt
${userPrompt}

Appelle submit_brief.`;

console.log(`Slug   : ${slug}`);
console.log(`Brand  : ${scrape.brand.name}`);
console.log(`Prompt length : ${userContent.length} chars`);
console.log();

try {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const start = Date.now();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    tools: [BRIEF_TOOL],
    tool_choice: { type: "tool", name: "submit_brief" },
    messages: [{ role: "user", content: userContent }],
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`Stop reason: ${response.stop_reason} (${elapsed}s)`);
  console.log(`Usage: in=${response.usage?.input_tokens} out=${response.usage?.output_tokens}`);

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (toolUse) {
    console.log(`\n[OK] tool_use OK`);
    const input = toolUse.input;
    console.log(`  template_id: ${input.template_id}`);
    console.log(`  signature  : ${input.visual_signature}`);
    console.log(`  brand.name : ${input.brand?.name}`);
    console.log(`  mood       : ${input.creative_direction?.mood?.slice(0, 100)}`);
    console.log(`  featured   : ${input.featured_products?.length} products`);
    console.log(`  palette    : ${input.visual_system?.palette?.map(p => p.name + '=' + p.hex).join(', ')}`);
  } else {
    console.log(`\n[KO] no tool_use!`);
    console.log(JSON.stringify(response.content, null, 2).slice(0, 1000));
  }
} catch (err) {
  console.error(`\n[KO] FAILED: ${err.name}: ${err.message}`);
  if (err.status) console.error(`     HTTP status: ${err.status}`);
  if (err.error) console.error(`     Error body: ${JSON.stringify(err.error).slice(0, 1000)}`);
  process.exit(1);
}
