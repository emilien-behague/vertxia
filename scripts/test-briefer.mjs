/**
 * Test isole : appelle directement Anthropic pour valider que la cle marche
 * et que le runBriefer ne crash pas silencieusement.
 *
 * Run : cd web && node scripts/test-briefer.mjs <slug>
 *
 * Ex : node scripts/test-briefer.mjs buu_koff_2_myshopify_com
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const WEB_ROOT = resolve(__dirname, "..");

// Load .env.local
function loadEnvLocal() {
  const envPath = resolve(WEB_ROOT, ".env.local");
  if (!existsSync(envPath)) throw new Error(".env.local introuvable");
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

loadEnvLocal();

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/test-briefer.mjs <slug>");
  process.exit(1);
}

const scrapePath = resolve(WEB_ROOT, "data", "scrapes", `${slug}.json`);
if (!existsSync(scrapePath)) {
  console.error(`Scrape introuvable : ${scrapePath}`);
  process.exit(1);
}

const scrape = JSON.parse(readFileSync(scrapePath, "utf-8"));

console.log(`=== Test briefer pour ${slug} ===`);
console.log(`Scrape : ${scrape.products.length} produits`);
console.log(`Brand  : ${scrape.brand.name} (${scrape.brand.domain})`);
console.log(`Anthropic key  : ${process.env.ANTHROPIC_API_KEY ? "set" : "MISSING"}`);
console.log(`Anthropic key prefix : ${(process.env.ANTHROPIC_API_KEY || "").slice(0, 12)}...`);
console.log();

// Test 1 : simple hello world Claude (verifie que la cle marche)
console.log("--- Test 1 : ping Claude API ---");
try {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const pong = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16,
    messages: [{ role: "user", content: "Reply with the single word PONG." }],
  });
  const text = pong.content.find((c) => c.type === "text")?.text || "(no text)";
  console.log(`[OK] Claude reply: ${text.trim()}`);
} catch (err) {
  console.error(`[KO] Claude ping failed: ${err.name}: ${err.message}`);
  if (err.status) console.error(`     HTTP status: ${err.status}`);
  if (err.error) console.error(`     Error body: ${JSON.stringify(err.error).slice(0, 300)}`);
  process.exit(1);
}

// Test 2 : appel briefer reel
console.log();
console.log("--- Test 2 : runBriefer reel (avec tool_use submit_brief) ---");

// On charge briefer.ts via tsx
// Plus simple : on copie-colle la logique ici en ESM
try {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const products = scrape.products.slice(0, 20);
  const prompt = "fait moi un site web interactif";

  const SYSTEM = "Tu es VERTXIA DIRECTOR. Tu DOIS appeler submit_brief avec un JSON valide.";
  const TOOL = {
    name: "submit_brief",
    description: "Submit a creative brief.",
    input_schema: {
      type: "object",
      properties: {
        template_id: { type: "string", enum: ["editorial-magazine"] },
        brand_name: { type: "string" },
        mood: { type: "string" },
      },
      required: ["template_id", "brand_name", "mood"],
    },
  };

  const userContent = `Brand: ${scrape.brand.name}\nCatalog: ${products.length} produits\nPrompt client: ${prompt}\n\nAppelle submit_brief.`;

  const start = Date.now();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "submit_brief" },
    messages: [{ role: "user", content: userContent }],
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`[OK] Stop reason: ${response.stop_reason} (${elapsed}s)`);
  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (toolUse) {
    console.log(`     Tool called: ${toolUse.name}`);
    console.log(`     Input: ${JSON.stringify(toolUse.input).slice(0, 300)}`);
  } else {
    console.log(`     [WARN] no tool_use in response. Content:`);
    console.log(JSON.stringify(response.content, null, 2).slice(0, 500));
  }
} catch (err) {
  console.error(`[KO] Briefer test failed: ${err.name}: ${err.message}`);
  if (err.status) console.error(`     HTTP status: ${err.status}`);
  if (err.error) console.error(`     Error body: ${JSON.stringify(err.error).slice(0, 500)}`);
  process.exit(1);
}
