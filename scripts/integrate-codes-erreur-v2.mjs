// Integre les codes erreur additionnels du workflow v2 dans database.ts.
//
// Differences vs v1 :
// - Charge web/lib/codes-erreur/database.ts comme texte
// - Extrait les codes existants via regex (marque: "X", code: "Y")
// - Filtre les codes du workflow qui sont des DOUBLONS (memes marque+code)
// - Sanitize URLs via whitelist (comme v1)
//
// Usage :
//   node scripts/integrate-codes-erreur-v2.mjs <workflow-output.json> > output.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node integrate-codes-erreur-v2.mjs <output.json>");
  process.exit(1);
}

const databasePath = resolve(
  process.cwd(),
  "lib/codes-erreur/database.ts"
);

const raw = JSON.parse(readFileSync(resolve(inputPath), "utf8"));
const marquesData = raw.result?.raw || raw.raw;

if (!Array.isArray(marquesData)) {
  console.error("ERROR: pas de result.raw[] dans le JSON workflow");
  process.exit(1);
}

// ===== 1. Charger codes existants =====
const dbContent = readFileSync(databasePath, "utf8");

// Regex : capture { marque: "X", ... code: "Y" } (sur 2 lignes consecutives)
const existingPairs = new Set();
const PAIR_RE = /marque:\s*"([^"]+)",\s+code:\s*"([^"]+)",/g;
let match;
while ((match = PAIR_RE.exec(dbContent)) !== null) {
  const marque = match[1].toLowerCase();
  const code = match[2].toUpperCase().replace(/\s+/g, "");
  existingPairs.add(`${marque}|${code}`);
}

console.error(`\n=== BASE EXISTANTE ===`);
console.error(`Codes deja en base : ${existingPairs.size}`);

// ===== 2. Whitelist domaines =====
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
  "carrier.com",
  "carrier.fr",
  "atlantic.fr",
  "ariston.fr",
  "viessmann.fr",
  "alfea.fr",
];

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

function slugToVarName(slug) {
  return slug.toUpperCase().replace(/-/g, "_") + "_V2";
}

// ===== 3. Filtrer doublons + sanitize =====
let totalCandidats = 0;
let totalRetenus = 0;
let totalDoublonsBase = 0;
let totalDoublonsLot = 0;
let totalSourcesAvant = 0;
let totalSourcesApres = 0;

const sections = [];
const statsByMarque = [];

for (const marqueResult of marquesData) {
  if (!marqueResult || !Array.isArray(marqueResult.codes)) continue;
  const slug = marqueResult.marqueSlug;
  const label = marqueResult.marqueLabel || slug;
  const varName = slugToVarName(slug);

  // Dedup intra-lot
  const seenInLot = new Set();
  const kept = [];

  for (const c of marqueResult.codes) {
    totalCandidats++;
    totalSourcesAvant += (c.sources || []).length;

    const codeKey = String(c.code).toUpperCase().replace(/\s+/g, "");
    const pairKey = `${slug.toLowerCase()}|${codeKey}`;

    if (existingPairs.has(pairKey)) {
      totalDoublonsBase++;
      continue;
    }
    if (seenInLot.has(pairKey)) {
      totalDoublonsLot++;
      continue;
    }
    seenInLot.add(pairKey);
    kept.push(c);
    totalSourcesApres += (c.sources || []).filter(isAcceptableUrl).length;
    totalRetenus++;
  }

  statsByMarque.push({
    slug,
    label,
    candidats: marqueResult.codes.length,
    retenus: kept.length,
    doublonsBase: marqueResult.codes.length - kept.length,
  });

  if (kept.length > 0) {
    sections.push(`
// =============================================================================
// ${label.toUpperCase()} — codes erreur additionnels (workflow v2 07/06/2026)
// Total : ${kept.length} codes (sur ${marqueResult.codes.length} candidats apres dedup)
// =============================================================================

const ${varName}: CodeErreur[] = [
${kept.map((c) => codeToTs(c, slug)).join("\n")}
];
`);
  }
}

// ===== 4. Stats =====
console.error(`\n=== STATS ENRICHISSEMENT ===`);
console.error(`Marques traitees : ${marquesData.length}`);
console.error(`Candidats agents : ${totalCandidats}`);
console.error(`Doublons vs base : ${totalDoublonsBase}`);
console.error(`Doublons intra-lot : ${totalDoublonsLot}`);
console.error(`Retenus : ${totalRetenus}`);
console.error(`Sources URLs avant sanitize : ${totalSourcesAvant}`);
console.error(`Sources URLs apres sanitize : ${totalSourcesApres}`);
if (totalSourcesAvant > 0) {
  console.error(
    `Taux retention sources : ${Math.round((totalSourcesApres / totalSourcesAvant) * 100)}%`
  );
}
console.error(`\n=== PAR MARQUE ===`);
for (const s of statsByMarque) {
  console.error(
    `  ${s.slug.padEnd(18)} ${String(s.retenus).padStart(3)}/${String(s.candidats).padStart(3)} retenus (${s.doublonsBase} doublons)`
  );
}

// ===== 5. Sortie TypeScript =====
console.log("// =============================================================================");
console.log("// AJOUTS WORKFLOW V2 — 07/06/2026 — codes additionnels 10 marques");
console.log("// Dedup contre base existante via integrate-codes-erreur-v2.mjs");
console.log("// =============================================================================");
console.log(sections.join("\n"));

console.log("");
console.log("// === A AJOUTER dans CODES_ERREUR_DATABASE export ===");
for (const s of statsByMarque) {
  if (s.retenus > 0) {
    console.log(`  ...${slugToVarName(s.slug)},`);
  }
}

console.log("");
console.log("// === COUNT_BY_MARQUE deltas (ajouter aux totaux existants) ===");
for (const s of statsByMarque) {
  if (s.retenus > 0) {
    const slug = s.slug;
    const keyDisplay = /[a-z0-9]+$/.test(slug) && !slug.includes("-")
      ? slug
      : `"${slug}"`;
    console.log(`  // ${keyDisplay}: +${s.retenus} (${slugToVarName(slug)}.length)`);
  }
}
