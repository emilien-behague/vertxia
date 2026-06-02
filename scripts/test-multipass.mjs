/**
 * Test multi-pass briefer sur Fellow.
 *
 * - Charge data/scrapes/fellowproducts_com.json
 * - Charge data/briefs/fellowproducts_com.json (brief V1 existant)
 * - Pass 2 : audit V1
 * - Pass 3 : improve → brief V2
 * - Sauve audit + V2
 *
 * Run : cd web && node scripts/test-multipass-fellow.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
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

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY missing");
  process.exit(1);
}

const SLUG = process.argv[2] || "fellowproducts_com";
const scrapePath = resolve(WEB_ROOT, "data", "scrapes", `${SLUG}.json`);
const briefPath = resolve(WEB_ROOT, "data", "briefs", `${SLUG}.json`);

const scrape = JSON.parse(readFileSync(scrapePath, "utf-8"));
const briefV1 = JSON.parse(readFileSync(briefPath, "utf-8"));

console.log(`Slug: ${SLUG}`);
console.log(`Brand: ${scrape.brand.name}`);
console.log(`Brief V1: template=${briefV1.template_id} signature=${briefV1.visual_signature}`);
console.log(`Hero V1: "${briefV1.hero?.headline?.replace(/\n/g, ' ')?.slice(0, 80)}"`);
console.log();

/* ============== AUDIT SCHEMA ============== */

const AUDIT_DIMENSIONS = [
  "brand_voice_distinctiveness",
  "icp_relevance",
  "copy_quality",
  "palette_mood_coherence",
  "video_prompts_quality",
  "narrative_arc",
  "section_length_appropriate",
  "template_choice_fit",
  "signature_choice_fit",
  "hero_punchline",
];

const AUDIT_TOOL = {
  name: "submit_audit",
  description: "Submit a critical audit of the generated brief V1.",
  input_schema: {
    type: "object",
    properties: {
      scores: {
        type: "array", minItems: 10, maxItems: 10,
        description: "One score 1-5 per dimension. Be CRITICAL.",
        items: {
          type: "object",
          properties: {
            dimension: { type: "string", enum: AUDIT_DIMENSIONS },
            score: { type: "integer", minimum: 1, maximum: 5 },
            comment: { type: "string" },
          },
          required: ["dimension", "score", "comment"],
        },
      },
      overall_score: { type: "number", minimum: 1, maximum: 5 },
      verdict: { type: "string", enum: ["publish-ready", "needs-improvement", "reject-regenerate"] },
      priorities: {
        type: "array", minItems: 1, maxItems: 3,
        items: {
          type: "object",
          properties: {
            rank: { type: "integer", minimum: 1, maximum: 3 },
            what: { type: "string" },
            why: { type: "string" },
            how: { type: "string" },
          },
          required: ["rank", "what", "why", "how"],
        },
      },
      summary: { type: "string" },
    },
    required: ["scores", "overall_score", "verdict", "priorities", "summary"],
  },
};

const AUDIT_SYSTEM_PROMPT = `Tu es VERTXIA REVIEWER — un critique IA severe et exigeant.

Mission : analyser un brief creatif Vertxia genere par VERTXIA DIRECTOR et l'evaluer sur 10 dimensions. Tu compares avec le scrape original Shopify pour verifier la pertinence.

## Posture critique

Tu es un reviewer Awwwards-tier. Tu compares le brief a ce que produirait une AGENCE creative premium (Pentagram, Sagmeister, Buck Studio, Mother Design). Tu refuses la mediocrite.

**Standards minimums** :
- Voix de marque DISTINCTIVE : si le brief sonne "generique e-commerce IA", score <= 2
- Copy : aucun buzzword startup ("game-changer", "revolutionary", "innovative", "next-gen", "disrupt", "seamless", "best-in-class"), score severement si present
- Hero headline : doit etre MEMORABLE en moins de 8 mots. Si c'est descriptif/factuel sans hook, score <= 3
- Prompts video : doivent etre cinematic specifiques, pas generiques
- Cohérence palette + mood + typo : si mismatch, score 1-2
- Template choice : si mismatch avec mood, score 2

## Echelle des scores
- 1 = casse / inacceptable
- 2 = faible / a refaire largement
- 3 = correct mais ameliorable
- 4 = bien / publish-ready avec petits polish
- 5 = excellent / niveau agence premium

La plupart des briefs IA meritent 2-3 sur la moitie des dimensions. Si tu mets >= 4 sur tout, tu n'es pas assez critique.

Tu DOIS appeler submit_audit. N'ecris RIEN d'autre.`;

/* ============== BRIEF TOOL (pour Pass 3) ============== */

const BRIEF_TOOL = {
  name: "submit_brief",
  description: "Submit the V0.1 creative brief.",
  input_schema: {
    type: "object",
    properties: {
      template_id: { type: "string", enum: ["editorial-magazine", "cinematic-narrative", "documentary-story", "horizontal-slider", "brutalist-tech", "museum-curated", "kinetic-typography", "noir-magazine", "cyberpunk-noir"] },
      visual_signature: { type: "string", enum: ["none", "film-grain", "halftone-print", "glitch-vhs", "neon-noir"] },
      brand: {
        type: "object",
        properties: { name: { type: "string" }, category: { type: "string" }, positioning_one_liner: { type: "string" }, icp: { type: "string" }, voice: { type: "string" } },
        required: ["name", "category", "positioning_one_liner", "icp", "voice"],
      },
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

const IMPROVE_SYSTEM_PROMPT = `Tu es VERTXIA DIRECTOR en mode IMPROVEMENT PASS.

Tu vas recevoir : 1) un brief V1 que tu as produit, 2) un audit severe par REVIEWER, 3) le scrape original.

Mission : reecrire le brief en :
- Conservant ce qui marche (dimensions >= 4 dans l'audit)
- Reparant ce qui est faible (dimensions <= 3) selon les 3 priorites de l'audit

Standards : voix de marque DISTINCTIVE, aucun buzzword startup, headline MEMORABLE en 3-12 mots, prompts video cinematic specifiques, palette + mood + typo coherents, copy finale prete a publier.

Privilegie typo : Fraunces / Instrument Serif / Newsreader / Geist / Manrope. Evite : Playfair / Cormorant / Söhne / Roboto.

Tu DOIS appeler submit_brief avec un JSON valide. N'ecris RIEN d'autre.`;

/* ============== Pass 2 — Audit ============== */

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const productsBrief = scrape.products.slice(0, 18).map((p, i) =>
  `${i + 1}. ${p.title} (handle: ${p.handle})` + (p.price ? ` — ${p.price}€` : "")
).join("\n");

const auditUserContent = `# BRIEF AUDIT REQUEST

## Original Scrape Context
Brand domain: ${scrape.brand.domain}
Brand name (raw): ${scrape.brand.name}
${scrape.brand.description ? `Description: ${scrape.brand.description}` : ""}

Products available in catalog:
${productsBrief}

## Generated Brief V1 (a critiquer)
\`\`\`json
${JSON.stringify(briefV1, null, 2)}
\`\`\`

## Ta tache
Audite ce brief sur les 10 dimensions. Sois SEVERE. Cite le brief verbatim quand pertinent. Donne 3 priorites ACTIONABLES.

Appelle submit_audit.`;

console.log("[Pass 2] Lancement audit...");
const startAudit = Date.now();
const auditResponse = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  system: AUDIT_SYSTEM_PROMPT,
  tools: [AUDIT_TOOL],
  tool_choice: { type: "tool", name: "submit_audit" },
  messages: [{ role: "user", content: auditUserContent }],
});
const auditSec = ((Date.now() - startAudit) / 1000).toFixed(1);

const auditToolUse = auditResponse.content.find((c) => c.type === "tool_use");
if (!auditToolUse) {
  console.error("[Pass 2] FAIL — no tool_use");
  process.exit(1);
}
const audit = auditToolUse.input;

console.log(`[Pass 2] OK en ${auditSec}s`);
console.log(`         verdict: ${audit.verdict}`);
console.log(`         overall: ${audit.overall_score}/5`);
console.log(`         scores:`);
for (const s of audit.scores) {
  console.log(`           - ${s.dimension.padEnd(38)}: ${s.score}/5  ${s.comment.slice(0, 90)}`);
}
console.log(`         priorities:`);
for (const p of audit.priorities) {
  console.log(`           ${p.rank}. ${p.what}`);
  console.log(`              WHY: ${p.why.slice(0, 100)}`);
  console.log(`              HOW: ${p.how.slice(0, 100)}`);
}
console.log(`         summary: ${audit.summary.slice(0, 200)}`);
console.log();

// Save audit
const auditDir = resolve(WEB_ROOT, "data", "audits");
if (!existsSync(auditDir)) mkdirSync(auditDir, { recursive: true });
writeFileSync(resolve(auditDir, `${SLUG}.json`), JSON.stringify(audit, null, 2));

/* ============== Pass 3 — Improve ============== */

const auditSummary = `
VERDICT: ${audit.verdict} (overall ${audit.overall_score}/5)

Scores par dimension :
${audit.scores.map((s) => `- ${s.dimension}: ${s.score}/5 — ${s.comment}`).join("\n")}

3 PRIORITES D'AMELIORATION :
${audit.priorities.map((p) => `${p.rank}. WHAT: ${p.what}\n   WHY: ${p.why}\n   HOW: ${p.how}`).join("\n\n")}

Summary REVIEWER : ${audit.summary}
`;

const productsBlockFull = scrape.products.slice(0, 18).map((p, i) =>
  `${i + 1}. handle="${p.handle}" id=${p.id}\n   title: ${p.title}` +
  (p.vendor ? ` — ${p.vendor}` : "") +
  (p.price ? ` — ${p.price}€` : "") +
  (p.imageUrl ? `\n   img: ${p.imageUrl}` : "") +
  `\n   ${p.description}`
).join("\n\n");

const improveUserContent = `# CREATIVE BRIEF — IMPROVEMENT PASS

## Brand context
Domain: ${scrape.brand.domain}
Brand name: ${scrape.brand.name}

## Catalog (${scrape.products.length} produits dispos)
${productsBlockFull}

## Original user mood prompt
${briefV1._meta?.client_prompt || "site cinematic premium"}

## Brief V1 (a ameliorer)
\`\`\`json
${JSON.stringify(briefV1, null, 2)}
\`\`\`

## Audit V1 (par REVIEWER)
${auditSummary}

## Ta tache
Reecris le brief en appliquant les 3 priorites de l'audit. Garde ce qui scorait >= 4. Reecris ce qui scorait <= 3.

Appelle submit_brief avec le brief V2 ameliore.`;

console.log("[Pass 3] Lancement improve...");
const startImprove = Date.now();
const improveResponse = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 8192,
  system: IMPROVE_SYSTEM_PROMPT,
  tools: [BRIEF_TOOL],
  tool_choice: { type: "tool", name: "submit_brief" },
  messages: [{ role: "user", content: improveUserContent }],
});
const improveSec = ((Date.now() - startImprove) / 1000).toFixed(1);

const improveToolUse = improveResponse.content.find((c) => c.type === "tool_use");
if (!improveToolUse) {
  console.error("[Pass 3] FAIL — no tool_use");
  process.exit(1);
}
const briefV2 = {
  ...improveToolUse.input,
  brand: { ...improveToolUse.input.brand, domain: scrape.brand.domain },
  _meta: {
    model: "claude-sonnet-4-6",
    client_prompt: briefV1._meta?.client_prompt || "site cinematic premium",
    source_json: `${scrape.brand.domain}_scrape.json`,
    product_count_total: scrape.products.length,
    featured_count: improveToolUse.input.featured_products.length,
    generated_in_seconds: Number(improveSec),
    multi_pass: true,
    pass_index: 3,
    audit_overall_v1: audit.overall_score,
  },
};

console.log(`[Pass 3] OK en ${improveSec}s`);
console.log();

// Save V2
writeFileSync(
  resolve(WEB_ROOT, "data", "briefs", `${SLUG}_v2.json`),
  JSON.stringify(briefV2, null, 2)
);

/* ============== Diff display ============== */

console.log("\n=== DIFF V1 vs V2 ===\n");
const fields = [
  ["template_id", briefV1.template_id, briefV2.template_id],
  ["visual_signature", briefV1.visual_signature, briefV2.visual_signature],
  ["hero.kicker", briefV1.hero?.kicker, briefV2.hero?.kicker],
  ["hero.headline", briefV1.hero?.headline?.replace(/\n/g, " "), briefV2.hero?.headline?.replace(/\n/g, " ")],
  ["hero.cta", briefV1.hero?.primary_cta_label, briefV2.hero?.primary_cta_label],
  ["brand.voice", briefV1.brand?.voice, briefV2.brand?.voice],
  ["brand.positioning", briefV1.brand?.positioning_one_liner, briefV2.brand?.positioning_one_liner],
  ["mood", briefV1.creative_direction?.mood, briefV2.creative_direction?.mood],
  ["footer.tagline", briefV1.footer?.tagline, briefV2.footer?.tagline],
];
for (const [field, v1, v2] of fields) {
  const changed = v1 !== v2;
  console.log(`${changed ? "🔄" : "  "} ${field}`);
  console.log(`   V1: ${String(v1).slice(0, 140)}`);
  console.log(`   V2: ${String(v2).slice(0, 140)}`);
  console.log();
}

console.log(`\n=== METRICS ===`);
console.log(`Pass 2 (audit)   : ${auditSec}s`);
console.log(`Pass 3 (improve) : ${improveSec}s`);
console.log(`Total pass 2+3   : ${(Number(auditSec) + Number(improveSec)).toFixed(1)}s`);
console.log(`Audit usage      : in=${auditResponse.usage?.input_tokens} out=${auditResponse.usage?.output_tokens}`);
console.log(`Improve usage    : in=${improveResponse.usage?.input_tokens} out=${improveResponse.usage?.output_tokens}`);

const totalInputTokens = (auditResponse.usage?.input_tokens || 0) + (improveResponse.usage?.input_tokens || 0);
const totalOutputTokens = (auditResponse.usage?.output_tokens || 0) + (improveResponse.usage?.output_tokens || 0);
const costPass23 = (totalInputTokens / 1_000_000) * 3 + (totalOutputTokens / 1_000_000) * 15;
console.log(`Cost pass 2+3    : $${costPass23.toFixed(3)}`);
console.log(`\nSaved:`);
console.log(`  data/audits/${SLUG}.json`);
console.log(`  data/briefs/${SLUG}_v2.json`);
