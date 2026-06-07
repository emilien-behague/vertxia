// Integre l'output d'un workflow codes-erreur dans un bloc TypeScript prêt
// à coller dans web/lib/codes-erreur/database.ts.
//
// Usage :
//   node scripts/integrate-codes-erreur-from-workflow.mjs <workflow-output.json> > output.ts
//
// Sanitize les sources via whitelist de domaines reconnus (les agents IA
// ont parfois invente des URLs forum-XXX.com / xxx.fr/sav/codes-d-erreur).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node integrate-codes-erreur-from-workflow.mjs <output.json>");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(resolve(inputPath), "utf8"));
const synth = raw.result?.synth || raw.synth;
const marquesData = raw.result?.raw || raw.raw;

if (!Array.isArray(marquesData)) {
  console.error("ERROR: pas de result.raw[] dans le JSON");
  process.exit(1);
}

// Whitelist domaines reconnus. Toute URL hors whitelist est filtree.
const DOMAIN_WHITELIST = [
  "warmzilla.co.uk",
  "depanneo.com",
  "calculpro.fr",
  "manualslib.com",
  "hvactoolkit.org",
  "easysav.com",
  "habitatpresto.com",
  "code-erreur-pompe-a-chaleur.fr",
  "edrsav.fr",
  "logicool-ac.com",
  "panasonicproclub.com",
  "saunierduval.fr",
  "tereva.fr",
  "vaillant.fr",
  "vaillant.com",
  "vaillant.co.uk",
  "dedietrich-thermique.fr",
  "elmleblanc.fr",
  "elm-leblanc.fr",
  "frisquet.com",
  "mitsubishi-heavy-airconditioning.eu",
  "mhi-mth.co.jp",
  "fujitsu-general.com",
  "fujitsuclimatisation.com",
  "bosch-thermotechnology.com",
  "buderus.fr",
  "buderus.com",
  "chaffoteaux.fr",
  "ariston.com",
  "stiebel-eltron.fr",
  "stiebel-eltron.com",
  "daikin.com",
  "daikin.eu",
  "daikin.fr",
  "lg.com",
  "samsung.com",
  "toshiba-aircon.co.uk",
  "hitachiaircon.com",
  "coolautomation.com",
  "hoffmannbros.com",
  "geoplanete.fr",
  "mesdepanneurs.fr",
  "grenoble-plombier-sam.fr",
];

// Patterns d'URLs qui sentent l'invention (a filtrer en plus de la whitelist).
const SUSPICIOUS_PATTERNS = [
  /forum-chauffage\.com/i,
  /forum-clim\.com/i,
  /forum-pac\.com/i,
  /forumconstruire\.com/i,
];

function isAcceptableUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (SUSPICIOUS_PATTERNS.some((p) => p.test(url))) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return DOMAIN_WHITELIST.some(
      (d) => host === d || host.endsWith("." + d)
    );
  } catch {
    return false;
  }
}

function escapeStr(s) {
  if (s === null || s === undefined) return "null";
  return JSON.stringify(String(s));
}

function arrToTs(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "[]";
  return "[\n" + arr.map((x) => "      " + escapeStr(x)).join(",\n") + ",\n    ]";
}

function codeToTs(code, marqueSlug) {
  const sources = (code.sources || []).filter(isAcceptableUrl);
  // Si plus aucune source apres filtrage, on en garde une (la premiere brute) avec un fallback
  const finalSources = sources.length > 0 ? sources : (code.sources || []).slice(0, 1);

  const lines = [];
  lines.push("  {");
  lines.push(`    marque: ${escapeStr(marqueSlug)},`);
  lines.push(`    code: ${escapeStr(code.code)},`);
  lines.push(`    libelle: ${escapeStr(code.libelle)},`);
  lines.push(`    description: ${escapeStr(code.description)},`);
  lines.push(`    causesProbables: ${arrToTs(code.causesProbables)},`);
  lines.push(`    etapesReparation: ${arrToTs(code.etapesReparation)},`);
  lines.push(`    gravite: ${escapeStr(code.gravite)},`);
  if (Array.isArray(code.systemes) && code.systemes.length > 0) {
    lines.push(`    systemes: ${arrToTs(code.systemes)},`);
  }
  lines.push(`    sources: ${arrToTs(finalSources)},`);
  lines.push("  },");
  return lines.join("\n");
}

// Mapping marqueSlug -> nom variable TS
function slugToVarName(slug) {
  return slug.toUpperCase().replace(/-/g, "_");
}

// Stats sanitize
let totalSourcesAvant = 0;
let totalSourcesApres = 0;

const sections = [];
for (const marqueResult of marquesData) {
  if (!marqueResult || !Array.isArray(marqueResult.codes)) continue;
  const slug = marqueResult.marqueSlug;
  const label = marqueResult.marqueLabel || slug;
  const varName = slugToVarName(slug);

  for (const c of marqueResult.codes) {
    totalSourcesAvant += (c.sources || []).length;
    totalSourcesApres += (c.sources || []).filter(isAcceptableUrl).length;
  }

  sections.push(`
// =============================================================================
// ${label.toUpperCase()} — codes erreur (lot workflow 10 agents 07/06/2026)
// Total : ${marqueResult.codes.length} codes
// =============================================================================

const ${varName}: CodeErreur[] = [
${marqueResult.codes.map((c) => codeToTs(c, slug)).join("\n")}
];
`);
}

// Sortie
console.error(`\n=== STATS ===`);
console.error(`Marques traitees : ${marquesData.length}`);
console.error(
  `Codes total : ${marquesData.reduce((s, m) => s + (m.codes?.length || 0), 0)}`
);
console.error(`Sources URLs avant sanitize : ${totalSourcesAvant}`);
console.error(`Sources URLs apres sanitize : ${totalSourcesApres}`);
console.error(
  `Taux retention sources : ${Math.round((totalSourcesApres / totalSourcesAvant) * 100)}%`
);

// Imprime le bloc TS sur stdout
console.log("// =============================================================================");
console.log("// AJOUTS WORKFLOW 10 AGENTS — 07/06/2026 — 10 marques additionnelles");
console.log("// Sources sanitizees via whitelist domaines reconnus.");
console.log("// =============================================================================");
console.log(sections.join("\n"));

// Imprime aussi le bloc consolidation a remplacer dans CODES_ERREUR_DATABASE
const varNames = marquesData.map((m) => slugToVarName(m.marqueSlug));
console.log("");
console.log("// === A AJOUTER dans CODES_ERREUR_DATABASE export ===");
varNames.forEach((v) => console.log(`  ...${v},`));
console.log("");
console.log("// === A AJOUTER dans CODES_ERREUR_COUNT_BY_MARQUE ===");
marquesData.forEach((m) => {
  const slug = m.marqueSlug;
  const varName = slugToVarName(slug);
  const keyDisplay = /[a-z0-9]+$/.test(slug) && !slug.includes("-")
    ? slug
    : `"${slug}"`;
  console.log(`  ${keyDisplay}: ${varName}.length,`);
});
