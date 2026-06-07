// Integre l'output workflow v3 dans database.ts :
//
// - 8 nouvelles marques (aldes, unelvent, zehnder, lennox, york, aermec, haier, sanyo)
// - 2 lots speciaux dispatches vers marques existantes via parsing du champ `systemes` :
//   * service-installateur -> daikin / mitsubishi / vaillant / saunier-duval
//   * cet-ballons -> atlantic / chaffoteaux / de-dietrich / stiebel-eltron / saunier-duval
//
// Dedup contre base existante (838 codes) via regex sur database.ts.
// Sanitize URLs via whitelist elargie.
//
// Usage :
//   node scripts/integrate-codes-erreur-v3.mjs <output.json> > /tmp/codes-v3-output.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node integrate-codes-erreur-v3.mjs <output.json>");
  process.exit(1);
}

const databasePath = resolve(process.cwd(), "lib/codes-erreur/database.ts");

const raw = JSON.parse(readFileSync(resolve(inputPath), "utf8"));
const marquesData = raw.result?.raw || raw.raw;

if (!Array.isArray(marquesData)) {
  console.error("ERROR: pas de result.raw[] dans le JSON workflow");
  process.exit(1);
}

// ===== 1. Charger codes existants (838 codes) =====
const dbContent = readFileSync(databasePath, "utf8");
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

// ===== 2. Whitelist domaines elargie (v3) =====
const DOMAIN_WHITELIST = [
  // v1+v2 (HVAC general)
  "warmzilla.co.uk", "depanneo.com", "calculpro.fr", "manualslib.com",
  "hvactoolkit.org", "easysav.com", "habitatpresto.com",
  "code-erreur-pompe-a-chaleur.fr", "edrsav.fr", "logicool-ac.com",
  "panasonicproclub.com", "saunierduval.fr", "tereva.fr",
  "vaillant.fr", "vaillant.com", "vaillant.co.uk",
  "dedietrich-thermique.fr", "elmleblanc.fr", "elm-leblanc.fr",
  "frisquet.com", "mitsubishi-heavy-airconditioning.eu", "mhi-mth.co.jp",
  "fujitsu-general.com", "fujitsuclimatisation.com",
  "bosch-thermotechnology.com", "buderus.fr", "buderus.com",
  "chaffoteaux.fr", "ariston.com", "ariston.fr",
  "stiebel-eltron.fr", "stiebel-eltron.com",
  "daikin.com", "daikin.eu", "daikin.fr",
  "lg.com", "samsung.com", "toshiba-aircon.co.uk", "hitachiaircon.com",
  "coolautomation.com", "hoffmannbros.com", "geoplanete.fr",
  "mesdepanneurs.fr", "grenoble-plombier-sam.fr",
  "carrier.com", "carrier.fr", "atlantic.fr",
  // v3 (nouvelles marques)
  "aldes.fr", "aldes.com",
  "unelvent.com", "atlantic-ventilation.fr",
  "zehnder.fr", "zehnder.com", "zehndergroup.com",
  "lennox.fr", "lennox-emea.com", "lennox.com", "lennoxinternational.com",
  "york.com", "johnsoncontrols.com", "jci.com",
  "aermec.fr", "aermec.com", "aermec.it",
  "haier.com", "haier-europe.com", "fr.haier.com", "haierhvac.com",
  "sanyo.com", "panasonic.com",
  "thermor.fr", "climalife.dehon.com", "proxiclim.fr",
];

const SUSPICIOUS_PATTERNS = [
  /forum-chauffage\.com/i,
  /forum-clim\.com/i,
  /forum-pac\.com/i,
  /forumconstruire\.com/i,
  /forums?-/i,
];

function isAcceptableUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (SUSPICIOUS_PATTERNS.some((p) => p.test(url))) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return DOMAIN_WHITELIST.some((d) => host === d || host.endsWith("." + d));
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
  if (Array.isArray(code.modeles) && code.modeles.length > 0) {
    lines.push(`    modeles: ${arrToTs(code.modeles)},`);
  }
  lines.push(`    sources: ${arrToTs(finalSources)},`);
  lines.push("  },");
  return lines.join("\n");
}

function slugToVarName(slug) {
  return slug.toUpperCase().replace(/-/g, "_") + "_V3";
}

// ===== 3. Dispatch des lots speciaux =====
// Pour chaque code d'un lot special, on parse le champ `systemes` (ou
// description en fallback) pour deviner la marque cible reelle.
function dispatchSpecialLot(codes, lotName) {
  const dispatched = {}; // { marqueCible -> [codes] }
  const matchers = lotName === "service-installateur"
    ? [
        { marque: "daikin", patterns: [/daikin/i, /vrv/i, /altherma/i, /sky\s*air/i] },
        { marque: "mitsubishi", patterns: [/mitsubishi(?!\s*heavy)/i, /city\s*multi/i, /ecodan/i, /mr\.?\s*slim/i, /\bmsz/i, /\bmuz/i, /\bpac-sc/i, /puhz/i] },
        { marque: "vaillant", patterns: [/vaillant/i, /ecotec/i, /arotherm/i, /geotherm/i, /\bvc[ws]?\b/i] },
        { marque: "saunier-duval", patterns: [/saunier/i, /thelia/i, /thema/i, /themis/i, /genia/i, /diagosys/i, /isofast/i] },
      ]
    : [
        // cet-ballons
        { marque: "atlantic", patterns: [/atlantic(?!\s*ventilation)/i, /calypso/i, /egalia/i, /\bcet\b/i, /thermor/i, /aeromax/i, /odyssee/i] },
        { marque: "chaffoteaux", patterns: [/chaffoteaux/i, /ariston/i, /\bnuos/i] },
        { marque: "de-dietrich", patterns: [/de[\s-]?dietrich/i, /kaliko/i] },
        { marque: "stiebel-eltron", patterns: [/stiebel/i, /\bshz\b/i, /\bwwk\b/i] },
        { marque: "saunier-duval", patterns: [/saunier/i, /\bmagna\b/i, /\baquaplus\b/i] },
      ];

  for (const c of codes) {
    const blob = [
      c.libelle || "",
      c.description || "",
      ...(Array.isArray(c.systemes) ? c.systemes : []),
      ...(Array.isArray(c.modeles) ? c.modeles : []),
    ].join(" ");
    let matched = null;
    for (const m of matchers) {
      if (m.patterns.some((p) => p.test(blob))) {
        matched = m.marque;
        break;
      }
    }
    if (!matched) {
      console.error(`  [${lotName}] code "${c.code}" non dispatche (blob: ${blob.slice(0, 100)})`);
      continue;
    }
    if (!dispatched[matched]) dispatched[matched] = [];
    dispatched[matched].push(c);
  }
  return dispatched;
}

// ===== 4. Traitement =====
const realMarques = []; // [{ slug, label, codes }]
const dispatchedExtras = {}; // { marqueCible -> [codes] } pour merge avec realMarques si overlap

let totalSourcesAvant = 0;
let totalSourcesApres = 0;
let totalCandidats = 0;
let totalDoublons = 0;

for (const marqueResult of marquesData) {
  if (!marqueResult || !Array.isArray(marqueResult.codes)) continue;
  const slug = marqueResult.marqueSlug;

  // Lot special ?
  if (slug === "service-installateur" || slug === "cet-ballons") {
    console.error(`\n[Lot special] ${slug} - dispatch ${marqueResult.codes.length} codes`);
    const dispatched = dispatchSpecialLot(marqueResult.codes, slug);
    for (const [target, codes] of Object.entries(dispatched)) {
      if (!dispatchedExtras[target]) dispatchedExtras[target] = [];
      dispatchedExtras[target].push(...codes);
      console.error(`  -> ${target}: ${codes.length} codes`);
    }
    continue;
  }

  // Vraie nouvelle marque
  realMarques.push({
    slug,
    label: marqueResult.marqueLabel || slug,
    codes: marqueResult.codes,
  });
}

// Fusion : pour chaque marqueCible des dispatch, on cree une "vraie marque"
// supplementaire si elle n'existe pas deja dans realMarques.
for (const [target, extraCodes] of Object.entries(dispatchedExtras)) {
  const existing = realMarques.find((m) => m.slug === target);
  if (existing) {
    existing.codes.push(...extraCodes);
  } else {
    realMarques.push({
      slug: target,
      label: target,
      codes: extraCodes,
    });
  }
}

// ===== 5. Dedup + sanitize + generation TS =====
const sections = [];
const statsByMarque = [];
const consolidatedCounts = {};

for (const m of realMarques.sort((a, b) => a.slug.localeCompare(b.slug))) {
  const slug = m.slug;
  const varName = slugToVarName(slug);

  const seenInLot = new Set();
  const kept = [];
  for (const c of m.codes) {
    totalCandidats++;
    totalSourcesAvant += (c.sources || []).length;
    const codeKey = String(c.code).toUpperCase().replace(/\s+/g, "");
    const pairKey = `${slug.toLowerCase()}|${codeKey}`;
    if (existingPairs.has(pairKey)) { totalDoublons++; continue; }
    if (seenInLot.has(pairKey)) { totalDoublons++; continue; }
    seenInLot.add(pairKey);
    kept.push(c);
    totalSourcesApres += (c.sources || []).filter(isAcceptableUrl).length;
  }

  statsByMarque.push({ slug, label: m.label, candidats: m.codes.length, retenus: kept.length });
  consolidatedCounts[slug] = kept.length;

  if (kept.length > 0) {
    sections.push(`
// =============================================================================
// ${m.label.toUpperCase()} — codes erreur v3 (workflow 10 agents 07/06/2026)
// Total : ${kept.length} codes
// =============================================================================

const ${varName}: CodeErreur[] = [
${kept.map((c) => codeToTs(c, slug)).join("\n")}
];
`);
  }
}

// ===== 6. Stats =====
console.error(`\n=== STATS V3 ===`);
console.error(`Candidats : ${totalCandidats}`);
console.error(`Doublons (base + intra-lot) : ${totalDoublons}`);
console.error(`Retenus : ${totalCandidats - totalDoublons}`);
console.error(`Sources avant sanitize : ${totalSourcesAvant}`);
console.error(`Sources apres sanitize : ${totalSourcesApres}`);
if (totalSourcesAvant > 0) {
  console.error(`Retention : ${Math.round((totalSourcesApres / totalSourcesAvant) * 100)}%`);
}
console.error(`\n=== PAR MARQUE ===`);
for (const s of statsByMarque) {
  console.error(`  ${s.slug.padEnd(20)} ${String(s.retenus).padStart(3)}/${String(s.candidats).padStart(3)} retenus`);
}

// ===== 7. Sortie TypeScript =====
console.log("// =============================================================================");
console.log("// AJOUTS WORKFLOW V3 — 07/06/2026");
console.log("// 8 nouvelles marques + 2 lots speciaux (service-installateur + CET) dispatches");
console.log("// vers marques existantes via parsing systemes.");
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
console.log("// === COUNT_BY_MARQUE deltas ===");
for (const s of statsByMarque) {
  if (s.retenus > 0) {
    const keyDisplay = /[a-z0-9]+$/.test(s.slug) && !s.slug.includes("-") ? s.slug : `"${s.slug}"`;
    console.log(`  // ${keyDisplay}: +${s.retenus} via ${slugToVarName(s.slug)}.length`);
  }
}
