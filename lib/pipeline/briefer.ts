/**
 * Briefer Claude — etape 2 du pipeline Vertxia Lite.
 *
 * Prend un ScrapeResult + le prompt utilisateur, retourne un Brief V0.1 complet
 * conforme a `lib/brief.ts` (consomme directement par les templates /lite/[domain]).
 *
 * Implementation : Anthropic SDK + tool_use force pour garantir un output JSON
 * valide conforme au schema Brief.
 *
 * Modele : claude-sonnet-4-6 (sweet spot cost/qualite pour creative direction).
 * Cost estime : ~$0.30-0.50 par brief (5000 input + 3000 output tokens).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Brief } from "@/lib/brief";
import type { CreativeBrief, ScrapeResult } from "./types";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8192;
const MAX_PRODUCTS_IN_PROMPT = 20;

/* =========================================================
 *  System prompt
 * ========================================================= */

const SYSTEM_PROMPT = `Tu es VERTXIA DIRECTOR — un creative director IA pour des sites e-commerce cinematic premium.

Mission : analyser une brand Shopify + son catalogue, et generer un BRIEF CREATIF COMPLET qui guidera la composition automatique d'un site cinematic.

Le brief doit avoir un point de vue. Une voix de marque assumee. Refuse les copys generiques type "Shop our new collection" — privilegie une voix editoriale, manifeste, ou narrative selon le mood demande par le client.

## Choix template_id (squelette structurel)
- editorial-magazine  : grid 2 col, manifesto, scroll vertical — pour brands editoriales / lifestyle
- cinematic-narrative : scroll-snap fullscreen 1 produit/ecran — pour brands ultra-luxe minimalistes
- documentary-story   : long-form article avec drop caps + photos parallax — pour brands story-driven / heritage
- horizontal-slider   : scroll horizontal snap-x, 1 slide = 100vw — pour brands experientielles / mode
- brutalist-tech      : neubrutalism NB+accent, bordures 2px, hard shadows — pour brands tech / streetwear

## Choix visual_signature (overlay applique sur n'importe quel template)
- none           : pass-through pur
- film-grain     : grain 16/35mm + warm grade + vignette
- halftone-print : dots overlay + grain papier (print magazine)
- glitch-vhs     : scanlines + chromatic aberration (Y2K)
- neon-noir      : dark gradient + accent glow CTA

## Palette
5 couleurs hex avec noms semantiques OBLIGATOIRES :
- background, foreground, accent, muted, surface

## Typography
2 polices reelles dispo via Google Fonts :
- serif (display titles) — privilegie Cormorant Garamond, Fraunces, Italiana, EB Garamond
- sans (body)            — privilegie Inter, Söhne (fallback Inter), Geist

## site_structure
3 sections minimum : manifesto + collection + closing (ou variations equivalentes).
Chaque section : section (slug), section_role (1 phrase intent), headline, body_paragraphs (2-4 paragraphes), pull_quote optional.
COPY FINALE, PRETE A PUBLIER — pas de placeholders.

## featured_products
Selectionne 3-6 produits ICONIC du catalogue (pas tous). Pour chacun :
- handle : reutilise le handle Shopify du scrape EXACTEMENT
- title : reutilise le title du scrape
- hero_image_url : reutilise l'imageUrl du scrape
- price_eur : reutilise le price si dispo
- editorial_caption : 1-2 phrases qui racontent la PIECE avec voix de marque (pas du marketing plat)
- video_prompt : ~30-50 mots, ultra-cinematic, technique (cadrage, lumiere, mouvement camera). Compatible Kling V2.
- video_engine_hint : "kling" par defaut
- video_duration_s : TOUJOURS 5 (cost cap — pas de 10s sur les heros)

## hero
- kicker : 3-6 mots positionnement court
- headline : 3-12 mots impactants, peut etre multi-ligne avec \\n
- subheadline : 1-2 phrases poseuses du ton
- primary_cta_label, secondary_cta_label (optional)

## footer
- tagline : punchy 4-10 mots
- closing_line : 1 phrase qui ferme la narration

## Langue
Tous les textes en FRANCAIS si la brand est francaise OU si le client_prompt est en francais. Sinon anglais.

Tu DOIS appeler submit_brief avec un JSON valide. N'ecris RIEN d'autre.`;

/* =========================================================
 *  Tool schema — Brief V0.1 complet
 * ========================================================= */

const BRIEF_TOOL: Anthropic.Tool = {
  name: "submit_brief",
  description: "Submit the V0.1 creative brief for the Vertxia Lite site composition pipeline.",
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
          category: { type: "string", description: "Ex: 'Mode homme responsable', 'Activewear premium'" },
          positioning_one_liner: { type: "string", description: "1 phrase de positionnement clair." },
          icp: { type: "string", description: "Persona client ideal en 1 phrase descriptive." },
          voice: { type: "string", description: "Style de voix : 'manifeste', 'editorial', 'narrative', 'minimal-luxe', etc." },
        },
        required: ["name", "category", "positioning_one_liner", "icp", "voice"],
      },
      client_prompt_interpretation: {
        type: "string",
        description: "1 phrase qui resume comment tu as interprete le prompt du client.",
      },
      creative_direction: {
        type: "object",
        properties: {
          mood: { type: "string", description: "Description mood evocatrice 1-2 phrases." },
          reference_style: { type: "string", description: "References visuelles/editoriales reelles (ex: 'Lemaire lookbook 2022, Aesop manifestos')." },
          narrative_arc: { type: "string", description: "Comment l'utilisateur traverse le site en 1 phrase." },
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
            properties: {
              serif: { type: "string", description: "Google Font display (Cormorant Garamond, Fraunces, etc.)" },
              sans: { type: "string", description: "Google Font body (Inter, Geist, etc.)" },
            },
            required: ["serif", "sans"],
          },
          spacing_density: { type: "string", enum: ["spacious", "balanced", "dense"] },
          imagery_treatment: { type: "string", description: "1 phrase sur le traitement visuel des images produits." },
        },
        required: ["palette", "fonts", "spacing_density", "imagery_treatment"],
      },
      hero: {
        type: "object",
        properties: {
          kicker: { type: "string" },
          headline: { type: "string", description: "Peut contenir des \\n pour multi-ligne." },
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
            section: { type: "string", description: "Slug section : manifesto, collection, closing, etc." },
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
            handle: { type: "string", description: "Handle Shopify EXACT du scrape." },
            title: { type: "string" },
            hero_image_url: { type: "string" },
            price_eur: { type: ["string", "number", "null"] },
            editorial_caption: { type: "string", description: "1-2 phrases avec voix de marque." },
            video_prompt: { type: "string", description: "~30-50 mots, cinematic, technique." },
            video_engine_hint: { type: "string", enum: ["kling", "runway", "veo", "higgsfield", "hailuo"] },
            video_duration_s: { type: "number", enum: [5], description: "TOUJOURS 5s — cost cap Kling v2.1." },
          },
          required: ["handle", "title", "hero_image_url", "editorial_caption", "video_prompt", "video_engine_hint", "video_duration_s"],
        },
      },
      footer: {
        type: "object",
        properties: {
          tagline: { type: "string" },
          closing_line: { type: "string" },
        },
        required: ["tagline", "closing_line"],
      },
    },
    required: [
      "template_id",
      "visual_signature",
      "brand",
      "client_prompt_interpretation",
      "creative_direction",
      "visual_system",
      "hero",
      "site_structure",
      "featured_products",
      "footer",
    ],
  },
};

/* =========================================================
 *  Entry point
 * ========================================================= */

export async function runBriefer(
  scrape: ScrapeResult,
  userPrompt: string
): Promise<CreativeBrief> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY absent de .env.local");
  }

  const startedAt = Date.now();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Truncate les produits pour ne pas exploser les tokens
  const products = scrape.products.slice(0, MAX_PRODUCTS_IN_PROMPT);
  const userContent = buildUserPrompt(scrape, products, userPrompt);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [BRIEF_TOOL],
    tool_choice: { type: "tool", name: "submit_brief" },
    messages: [{ role: "user", content: userContent }],
  });

  const toolUse = response.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
  );
  if (!toolUse || toolUse.name !== "submit_brief") {
    throw new Error(
      `Claude n'a pas appele submit_brief. Stop reason: ${response.stop_reason}`
    );
  }

  // Claude output partiel — on enrichit avec les fields auto (domain, _meta)
  const partial = toolUse.input as Omit<Brief, "brand"> & {
    brand: Omit<Brief["brand"], "domain">;
  };

  const elapsedSec = (Date.now() - startedAt) / 1000;

  const brief: Brief = {
    ...partial,
    brand: {
      ...partial.brand,
      domain: scrape.brand.domain,
    },
    _meta: {
      model: MODEL,
      client_prompt: userPrompt,
      source_json: `${scrape.brand.domain}_scrape.json`,
      product_count_total: scrape.products.length,
      featured_count: partial.featured_products.length,
      generated_in_seconds: Math.round(elapsedSec * 10) / 10,
    },
  };

  return brief;
}

/* =========================================================
 *  User prompt builder
 * ========================================================= */

function buildUserPrompt(
  scrape: ScrapeResult,
  products: Array<{
    id: string;
    title: string;
    handle: string;
    description: string;
    imageUrl: string | null;
    price: number | null;
    vendor: string | null;
    productType: string | null;
  }>,
  userPrompt: string
): string {
  const brandBlock = [
    `Domain: ${scrape.brand.domain}`,
    `Brand name (raw, peut etre nettoye dans ton output): ${scrape.brand.name}`,
    scrape.brand.description ? `Description: ${scrape.brand.description}` : null,
    scrape.brand.coverImageUrl ? `Cover image: ${scrape.brand.coverImageUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const productsBlock = products
    .map(
      (p, i) =>
        `${i + 1}. handle="${p.handle}" id=${p.id}\n   title: ${p.title}` +
        (p.vendor ? ` — ${p.vendor}` : "") +
        (p.price ? ` — ${p.price}€` : "") +
        (p.productType ? ` — type:${p.productType}` : "") +
        (p.imageUrl ? `\n   img: ${p.imageUrl}` : "") +
        `\n   ${p.description}`
    )
    .join("\n\n");

  return `# CREATIVE BRIEF REQUEST

## Brand
${brandBlock}

## Catalog (${products.length} products scraped from Shopify)
${productsBlock}

## User mood prompt
${userPrompt}

---

Compose le brief V0.1 complet :
- Choisis template_id et visual_signature qui matchent le mood (justifie via creative_direction.reference_style)
- Selectionne 3-6 produits ICONIC pour featured_products (reutilise handle/title/hero_image_url EXACTS du scrape)
- Ecris tous les textes prets a publier, voix editoriale assumee, pas de remplissage
- Palette : 5 couleurs hex avec noms semantiques background/foreground/accent/muted/surface

Appelle submit_brief.`;
}
