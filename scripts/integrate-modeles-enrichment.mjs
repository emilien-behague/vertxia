// Genere lib/codes-erreur/modeles-enrichment.ts a partir de l'output du
// workflow d'enrichissement modeles[].
//
// Usage :
//   node scripts/integrate-modeles-enrichment.mjs <workflow-output.json>
//
// L'output est un fichier TypeScript pret a coller (ou directement ecrit a la
// destination si pas de redirection).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node integrate-modeles-enrichment.mjs <output.json>");
  process.exit(1);
}

const destPath = resolve(
  process.cwd(),
  "lib/codes-erreur/modeles-enrichment.ts"
);

const raw = JSON.parse(readFileSync(resolve(inputPath), "utf8"));
const enrichments = raw.result?.enrichments || raw.enrichments;

if (!enrichments || typeof enrichments !== "object") {
  console.error("ERROR: pas de result.enrichments dans le JSON workflow");
  process.exit(1);
}

// Nettoyage : on garde uniquement les codes dont modeles[] est non vide
// ET respecte un format raisonnable (pas de string trop longue, pas d'espaces parasites).
function cleanModele(m) {
  if (typeof m !== "string") return null;
  const trimmed = m.trim();
  if (trimmed.length < 2 || trimmed.length > 30) return null;
  return trimmed;
}

let totalEnrichies = 0;
let totalGardees = 0;
const sortedMarques = Object.keys(enrichments).sort();
const cleaned = {};

for (const marque of sortedMarques) {
  const codes = enrichments[marque] || {};
  const cleanedCodes = {};
  for (const [code, modeles] of Object.entries(codes)) {
    totalEnrichies++;
    if (!Array.isArray(modeles) || modeles.length === 0) continue;
    const cleanedModeles = modeles
      .map(cleanModele)
      .filter((m) => m !== null);
    if (cleanedModeles.length === 0) continue;
    // Dedup case-insensitive
    const seen = new Set();
    const dedup = [];
    for (const m of cleanedModeles) {
      const k = m.toUpperCase().replace(/[\s\-_./]+/g, "");
      if (seen.has(k)) continue;
      seen.add(k);
      dedup.push(m);
    }
    cleanedCodes[code] = dedup;
    totalGardees++;
  }
  if (Object.keys(cleanedCodes).length > 0) {
    cleaned[marque] = cleanedCodes;
  }
}

// Stats
console.error(`=== STATS ===`);
console.error(`Codes traites par agents : ${totalEnrichies}`);
console.error(`Codes avec modeles[] gardes : ${totalGardees}`);
console.error(`Codes generiques (modeles: []) : ${totalEnrichies - totalGardees}`);
console.error(`Marques avec au moins 1 enrich : ${Object.keys(cleaned).length}`);
for (const [marque, codes] of Object.entries(cleaned)) {
  console.error(`  ${marque.padEnd(20)} ${Object.keys(codes).length} codes enrichis`);
}

// Generation TypeScript
function escapeStr(s) {
  return JSON.stringify(String(s));
}

const lines = [];
lines.push("// Enrichissement modeles[] pour les codes de la base.");
lines.push("// Genere automatiquement via scripts/integrate-modeles-enrichment.mjs");
lines.push("// a partir d'un workflow LLM (10 agents paralleles, 07/06/2026).");
lines.push("//");
lines.push("// Format : { marqueSlug -> { code -> [familles de modeles] } }");
lines.push("// Les codes absents de ce map = generiques marque (visibles sur tous modeles).");
lines.push("// Les codes presents = filtres : visibles uniquement si modeleQuery matche");
lines.push("//   au moins un des prefixes listes (matching prefix bidirectionnel).");
lines.push("//");
lines.push("// Merge fait au runtime dans search.ts via getEnrichedModeles().");
lines.push("");
lines.push("export const MODELES_ENRICHMENT: Record<string, Record<string, string[]>> = {");
for (const marque of Object.keys(cleaned).sort()) {
  const codes = cleaned[marque];
  lines.push(`  ${JSON.stringify(marque)}: {`);
  for (const code of Object.keys(codes).sort()) {
    const arr = codes[code].map(escapeStr).join(", ");
    lines.push(`    ${escapeStr(code)}: [${arr}],`);
  }
  lines.push("  },");
}
lines.push("};");
lines.push("");
lines.push(`export const MODELES_ENRICHMENT_META = {`);
lines.push(`  generatedAt: "2026-06-07",`);
lines.push(`  totalCodesEnrichies: ${totalGardees},`);
lines.push(`  totalCodesTraites: ${totalEnrichies},`);
lines.push(`  marquesCount: ${Object.keys(cleaned).length},`);
lines.push("};");
lines.push("");

const output = lines.join("\n");
writeFileSync(destPath, output);
console.error(`\n=== WRITTEN ===`);
console.error(`Path : ${destPath}`);
console.error(`Size : ${output.length} chars`);
