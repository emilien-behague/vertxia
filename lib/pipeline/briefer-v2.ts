/**
 * Briefer V2 — multi-pass brief generation pour Vertxia Lite.
 *
 * 3 passes :
 *  1. GENERATION  — pass 1, identique au briefer.ts existant (DIRECTOR mode)
 *  2. AUDIT       — pass 2, Claude critique le brief V1 sur 10 dimensions (REVIEWER mode)
 *  3. IMPROVEMENT — pass 3, Claude reecrit le brief en appliquant l'audit (DIRECTOR mode + audit context)
 *
 * Trade-off :
 *  - Single pass V1 : ~70s + $0.50 (default, rapide + cheap)
 *  - Multi-pass V2  : ~170s + $1.50 (premium, qualite ++)
 *
 * Marketing : "Vertxia est le seul outil qui auto-critique ses briefs avant livraison."
 *
 * Usage :
 *   const result = await runMultiPassBrief(scrape, userPrompt, { passCount: 3 });
 *   result.brief    // brief final V2
 *   result.audit    // audit du V1
 *   result.briefV1  // brief V1 pour comparaison
 *   result.metrics  // temps + cout estime
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Brief } from "@/lib/brief";
import type { CreativeBrief, ScrapeResult } from "./types";
import { runBriefer } from "./briefer";
import {
  AUDIT_TOOL,
  AUDIT_SYSTEM_PROMPT,
  type AuditResult,
} from "./audit-schema";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS_AUDIT = 4096;
const MAX_TOKENS_IMPROVE = 8192;
const MAX_PRODUCTS_IN_PROMPT = 20;

// Cost estimates (Claude sonnet 4.6 pricing 2026)
const COST_INPUT_PER_1M = 3; // $3 per 1M input tokens
const COST_OUTPUT_PER_1M = 15; // $15 per 1M output tokens

/* =========================================================
 *  Multi-pass entry point
 * ========================================================= */

export type MultiPassOptions = {
  passCount?: 1 | 3;
};

export type MultiPassResult = {
  brief: CreativeBrief;
  audit: AuditResult | null;
  briefV1: CreativeBrief | null;
  metrics: {
    pass1_seconds: number;
    pass2_seconds: number | null;
    pass3_seconds: number | null;
    total_seconds: number;
    cost_estimate_usd: number;
    pass_count: 1 | 3;
  };
};

export async function runMultiPassBrief(
  scrape: ScrapeResult,
  userPrompt: string,
  opts: MultiPassOptions = {}
): Promise<MultiPassResult> {
  const passCount = opts.passCount ?? 1;

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY absent de .env.local");
  }

  const startTotal = Date.now();

  // ----- PASS 1 : Generation (delegate to existing briefer) -----
  const startPass1 = Date.now();
  const briefV1 = await runBriefer(scrape, userPrompt);
  const pass1Sec = Math.round((Date.now() - startPass1) / 100) / 10;

  if (passCount === 1) {
    const totalSec = Math.round((Date.now() - startTotal) / 100) / 10;
    return {
      brief: briefV1,
      audit: null,
      briefV1: null,
      metrics: {
        pass1_seconds: pass1Sec,
        pass2_seconds: null,
        pass3_seconds: null,
        total_seconds: totalSec,
        cost_estimate_usd: estimateCost(1, scrape.products.length),
        pass_count: 1,
      },
    };
  }

  // ----- PASS 2 : Audit -----
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const startPass2 = Date.now();
  const audit = await auditBrief(briefV1, scrape, client);
  const pass2Sec = Math.round((Date.now() - startPass2) / 100) / 10;

  // ----- PASS 3 : Improvement -----
  const startPass3 = Date.now();
  const briefV2 = await improveBrief(briefV1, audit, scrape, userPrompt, client);
  const pass3Sec = Math.round((Date.now() - startPass3) / 100) / 10;

  const totalSec = Math.round((Date.now() - startTotal) / 100) / 10;

  return {
    brief: briefV2,
    audit,
    briefV1,
    metrics: {
      pass1_seconds: pass1Sec,
      pass2_seconds: pass2Sec,
      pass3_seconds: pass3Sec,
      total_seconds: totalSec,
      cost_estimate_usd: estimateCost(3, scrape.products.length),
      pass_count: 3,
    },
  };
}

/* =========================================================
 *  Pass 2 — Audit (REVIEWER mode)
 * ========================================================= */

export async function auditBrief(
  brief: CreativeBrief,
  scrape: ScrapeResult,
  client: Anthropic
): Promise<AuditResult> {
  const auditUserContent = buildAuditUserPrompt(brief, scrape);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS_AUDIT,
    system: AUDIT_SYSTEM_PROMPT,
    tools: [AUDIT_TOOL as unknown as Anthropic.Tool],
    tool_choice: { type: "tool", name: "submit_audit" },
    messages: [{ role: "user", content: auditUserContent }],
  });

  const toolUse = response.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
  );
  if (!toolUse || toolUse.name !== "submit_audit") {
    throw new Error(
      `REVIEWER n'a pas appele submit_audit. Stop reason: ${response.stop_reason}`
    );
  }

  return toolUse.input as AuditResult;
}

function buildAuditUserPrompt(brief: CreativeBrief, scrape: ScrapeResult): string {
  const briefJson = JSON.stringify(brief, null, 2);
  const productsBrief = scrape.products
    .slice(0, MAX_PRODUCTS_IN_PROMPT)
    .map(
      (p, i) =>
        `${i + 1}. ${p.title} (handle: ${p.handle})` +
        (p.price ? ` — ${p.price}€` : "")
    )
    .join("\n");

  return `# BRIEF AUDIT REQUEST

## Original Scrape Context (la source de verite — qu'est-ce que la brand FAIT vraiment)
Brand domain: ${scrape.brand.domain}
Brand name (raw): ${scrape.brand.name}
${scrape.brand.description ? `Description: ${scrape.brand.description}` : ""}

Products available in catalog:
${productsBrief}

## Generated Brief V1 (a critiquer)
\`\`\`json
${briefJson}
\`\`\`

## Ta tache
Audite ce brief sur les 10 dimensions du schema. Sois SEVERE :
- Compare la voix proposee avec ce que ferait une AGENCE creative premium (Pentagram, Mother, Buck Studio)
- Detecte les buzzwords startup, les copies plates, les choix template/signature mismatchs
- Pour chaque dimension, score 1-5 + commentaire SPECIFIQUE (cite le brief verbatim)
- Donne 3 priorites d'amelioration ACTIONABLES

Si le brief est mediocre, donne des scores 2-3. Si il est juste correct, 3-4. Reserve les 5 pour l'exceptionnel.

Appelle submit_audit.`;
}

/* =========================================================
 *  Pass 3 — Improvement (DIRECTOR mode with audit feedback)
 * ========================================================= */

export async function improveBrief(
  briefV1: CreativeBrief,
  audit: AuditResult,
  scrape: ScrapeResult,
  userPrompt: string,
  client: Anthropic
): Promise<CreativeBrief> {
  // Re-import the BRIEF_TOOL from briefer.ts via re-using the tool name
  // We can't directly import BRIEF_TOOL (not exported), so we recreate it inline
  // OR we leverage that briefer.ts already calls submit_brief with the same schema.
  // Cleanest path : call runBriefer again BUT with an enriched user prompt.

  // Stratégie : on construit un NEW user prompt qui contient le brief V1 + l'audit
  // + le scrape original, et on relance Claude DIRECTOR avec instruction d'ameliorer.

  const enrichedSystemPrompt = `${SYSTEM_PROMPT_IMPROVE_PREFIX}

${await readBaseSystemPrompt()}`;

  const products = scrape.products.slice(0, MAX_PRODUCTS_IN_PROMPT);
  const userContent = buildImproveUserPrompt(briefV1, audit, scrape, products, userPrompt);

  // On reutilise le tool BRIEF_TOOL — meme schema, output identique
  const briefToolForImprove = await getBriefTool();

  const startedAt = Date.now();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS_IMPROVE,
    system: enrichedSystemPrompt,
    tools: [briefToolForImprove],
    tool_choice: { type: "tool", name: "submit_brief" },
    messages: [{ role: "user", content: userContent }],
  });

  const toolUse = response.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
  );
  if (!toolUse || toolUse.name !== "submit_brief") {
    throw new Error(
      `DIRECTOR (improve pass) n'a pas appele submit_brief. Stop reason: ${response.stop_reason}`
    );
  }

  const partial = toolUse.input as Omit<Brief, "brand"> & {
    brand: Omit<Brief["brand"], "domain">;
  };

  const elapsedSec = (Date.now() - startedAt) / 1000;

  const briefV2: Brief = {
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
      multi_pass: true,
      pass_index: 3,
    } as Brief["_meta"] & { multi_pass: boolean; pass_index: number },
  };

  return briefV2;
}

const SYSTEM_PROMPT_IMPROVE_PREFIX = `# IMPORTANT — IMPROVEMENT PASS

Tu vas recevoir :
1. Un brief V1 que tu as deja produit
2. Un audit severe par VERTXIA REVIEWER (scores + 3 priorites d'amelioration)
3. Le scrape original

Ta mission : reecrire le brief en :
- Conservant ce qui marche (dimensions notees >= 4 dans l'audit)
- Reparant ce qui est faible (dimensions <= 3) selon les priorites de l'audit
- Appliquant rigoureusement les 3 ameliorations du REVIEWER

Output : un nouveau brief complet via submit_brief. Meme schema que le V1.

---

# SYSTEM PROMPT DE BASE (DIRECTOR mode) :

`;

function buildImproveUserPrompt(
  briefV1: CreativeBrief,
  audit: AuditResult,
  scrape: ScrapeResult,
  products: ScrapeResult["products"],
  userPrompt: string
): string {
  const productsBlock = products
    .map(
      (p, i) =>
        `${i + 1}. handle="${p.handle}" id=${p.id}\n   title: ${p.title}` +
        (p.vendor ? ` — ${p.vendor}` : "") +
        (p.price ? ` — ${p.price}€` : "") +
        (p.imageUrl ? `\n   img: ${p.imageUrl}` : "") +
        `\n   ${p.description}`
    )
    .join("\n\n");

  const auditSummary = `
VERDICT: ${audit.verdict} (overall ${audit.overall_score}/5)

Scores par dimension :
${audit.scores.map((s) => `- ${s.dimension}: ${s.score}/5 — ${s.comment}`).join("\n")}

3 PRIORITES D'AMELIORATION (a appliquer rigoureusement) :
${audit.priorities
  .map(
    (p) =>
      `${p.rank}. WHAT: ${p.what}\n   WHY: ${p.why}\n   HOW: ${p.how}`
  )
  .join("\n\n")}

Summary REVIEWER : ${audit.summary}
`;

  return `# CREATIVE BRIEF — IMPROVEMENT PASS

## Brand context (scrape original)
Domain: ${scrape.brand.domain}
Brand name: ${scrape.brand.name}
${scrape.brand.description ? `Description: ${scrape.brand.description}` : ""}

## Catalog (${products.length} produits dispos)
${productsBlock}

## Original user mood prompt
${userPrompt}

## Brief V1 (a ameliorer)
\`\`\`json
${JSON.stringify(briefV1, null, 2)}
\`\`\`

## Audit V1 (par VERTXIA REVIEWER)
${auditSummary}

## Ta tache
Reecris le brief en applicant les 3 priorites de l'audit. Garde ce qui scorait >= 4. Reecris ce qui scorait <= 3.

Appelle submit_brief avec le brief V2 ameliore.`;
}

/* =========================================================
 *  Helpers — lazy load BRIEF_TOOL and SYSTEM_PROMPT from briefer.ts
 *  (briefer.ts n'exporte pas BRIEF_TOOL ni SYSTEM_PROMPT, on lit le fichier)
 * ========================================================= */

let _briefToolCache: Anthropic.Tool | null = null;
let _systemPromptCache: string | null = null;

async function getBriefTool(): Promise<Anthropic.Tool> {
  if (_briefToolCache) return _briefToolCache;
  // Dans Next.js runtime, on ne peut pas lire le fichier .ts directement.
  // On reconstruit le BRIEF_TOOL inline (synchro avec briefer.ts schema).
  const tool: Anthropic.Tool = {
    name: "submit_brief",
    description:
      "Submit the V0.1 creative brief for the Vertxia Lite site composition pipeline.",
    input_schema: {
      type: "object",
      properties: {
        template_id: {
          type: "string",
          enum: [
            "editorial-magazine",
            "cinematic-narrative",
            "documentary-story",
            "horizontal-slider",
            "brutalist-tech",
            "museum-curated",
            "kinetic-typography",
            "noir-magazine",
            "cyberpunk-noir",
            "agentic-hero",
          ],
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
                  name: {
                    type: "string",
                    enum: ["background", "foreground", "accent", "muted", "surface"],
                  },
                  hex: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
                },
                required: ["name", "hex"],
              },
            },
            fonts: {
              type: "object",
              properties: {
                serif: { type: "string" },
                sans: { type: "string" },
              },
              required: ["serif", "sans"],
            },
            spacing_density: {
              type: "string",
              enum: ["spacious", "balanced", "dense"],
            },
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
              body_paragraphs: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
                maxItems: 4,
              },
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
              video_engine_hint: {
                type: "string",
                enum: ["kling", "runway", "veo", "higgsfield", "hailuo"],
              },
              video_duration_s: { type: "number", enum: [5] },
            },
            required: [
              "handle",
              "title",
              "hero_image_url",
              "editorial_caption",
              "video_prompt",
              "video_engine_hint",
              "video_duration_s",
            ],
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
  _briefToolCache = tool;
  return tool;
}

async function readBaseSystemPrompt(): Promise<string> {
  if (_systemPromptCache) return _systemPromptCache;
  // Le SYSTEM_PROMPT du briefer.ts n'est pas exporte — on inline une version condensee
  // (synchronisée avec briefer.ts:26-110).
  _systemPromptCache = `Tu es VERTXIA DIRECTOR — creative director IA pour sites e-commerce cinematic premium.

Le brief doit avoir une voix de marque distincte. Refuse les copies generiques. Privilegie editorial / manifeste / narrative selon le mood.

Choix template_id : editorial-magazine | cinematic-narrative | documentary-story | horizontal-slider | brutalist-tech | museum-curated | kinetic-typography | noir-magazine | cyberpunk-noir.
- museum-curated : OBLIGATOIRE si mood = ultra minimal / musee / epure / luxe discret (Maison Margiela, Lemaire, Aesop, Phoebe Philo, COS, slow fashion, ceramique, parfum, joaillerie discrete).
- kinetic-typography : OBLIGATOIRE si mood = bold / loud / monumental / kinetic / type-heavy / agency / streetwear / underground / raw (Lululemon, Off-White, Nike SB, Wodniack, agences creatives).
- noir-magazine : OBLIGATOIRE si mood = magazine luxe noir / spirits / single malt / niche perfume / travel premium / editorial underground (Voyager Press, Wallpaper, Mr Porter Journal, Cabana). ZERO glitch.
- cyberpunk-noir : OBLIGATOIRE si mood = cyberpunk / neon / tech moody / blade runner / dark glitch / underground tech / techwear / gaming / vape / spirits dark (videos dark + serif italique + scanlines + accent neon vif).
Choix visual_signature : none | film-grain | halftone-print | glitch-vhs | neon-noir.

Palette : 5 hex avec noms semantiques (background, foreground, accent, muted, surface).
Typography : 2 Google Fonts (serif + sans) qui matchent le mood. Privilegie Fraunces / Instrument Serif / Newsreader / Geist / Manrope. Evite Playfair / Cormorant / Söhne / Roboto.

site_structure : 3-5 sections (manifesto + collection + closing minimum). Copy finale prete a publier.

featured_products : 3-6 produits ICONIC du catalogue. video_prompt cinematic 30-50 mots compatible Kling V2. video_duration_s TOUJOURS 5.

hero : kicker (3-6 mots) + headline (3-12 mots impactants) + subheadline (1-2 phrases) + primary_cta_label.
footer : tagline (4-10 mots) + closing_line.

Langue : francais si brand francaise OU prompt en francais. Sinon anglais.

Appelle submit_brief.`;
  return _systemPromptCache;
}

/* =========================================================
 *  Cost estimation
 * ========================================================= */

function estimateCost(passCount: 1 | 3, productCount: number): number {
  // Approximations basees sur les mesures reelles :
  // Pass 1 : ~5k input + ~7k output tokens
  // Pass 2 : ~7k input (brief V1 entier) + ~1.5k output (audit)
  // Pass 3 : ~10k input (brief V1 + audit + scrape) + ~7k output (brief V2)

  const productFactor = Math.min(productCount / 18, 1.5); // plus de produits = plus de tokens input

  const pass1InputTokens = 5000 * productFactor;
  const pass1OutputTokens = 7000;

  const pass2InputTokens = 7000;
  const pass2OutputTokens = 1500;

  const pass3InputTokens = 10000 * productFactor;
  const pass3OutputTokens = 7000;

  let totalInput = pass1InputTokens;
  let totalOutput = pass1OutputTokens;
  if (passCount === 3) {
    totalInput += pass2InputTokens + pass3InputTokens;
    totalOutput += pass2OutputTokens + pass3OutputTokens;
  }

  const cost =
    (totalInput / 1_000_000) * COST_INPUT_PER_1M +
    (totalOutput / 1_000_000) * COST_OUTPUT_PER_1M;

  return Math.round(cost * 100) / 100;
}
