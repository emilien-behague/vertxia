#!/usr/bin/env node
// Parse le JSON de transcription Whisper-diarization et génère :
//   - 2026-06-02_Appel_Jean_Louis_RAW.json  (copie nettoyée)
//   - 2026-06-02_Appel_Jean_Louis_DIALOGUE.md  (dialogue propre EB/JL)
//
// Mapping speakers : heuristique basée sur le contenu (qui pose les questions = Emilien).
//
// Usage : node scripts/parse-call-transcript.mjs <chemin_json_brut>

import fs from "node:fs";
import path from "node:path";

const INPUT = process.argv[2] || "C:\\Users\\behag\\Desktop\\jean_louis.txt";
const OUTPUT_DIR = "C:\\Users\\behag\\Desktop\\BOS-main\\Output";
const DATE = "2026-06-02";
const BASE = `${DATE}_Appel_Jean_Louis`;

if (!fs.existsSync(INPUT)) {
  console.error(`❌ Fichier introuvable : ${INPUT}`);
  process.exit(1);
}

const raw = fs.readFileSync(INPUT, "utf-8");
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error("❌ JSON malformé :", e.message);
  console.error("Début du fichier :", raw.slice(0, 200));
  process.exit(1);
}

// Replicate retourne soit { output: { segments: [...] } } soit directement { segments: [...] }
const segments = data.output?.segments || data.segments || [];
if (segments.length === 0) {
  console.error("❌ Aucun segment trouvé dans le JSON");
  process.exit(1);
}

console.log(`✅ JSON parsé : ${segments.length} segments`);

// Sauve la copie raw dans Output/
fs.writeFileSync(
  path.join(OUTPUT_DIR, `${BASE}_RAW.json`),
  JSON.stringify(data, null, 2),
  "utf-8"
);

// ─── HEURISTIQUE DE MAPPING SPEAKER ────────────────────────────────────────
// On regarde qui parle de "ma boîte", "moi je fais", "je travaille" → JL
// vs qui dit "alors moi mon service", "l'application", "je vous propose" → EB
//
// Indices Emilien (créateur Vertxia) :
const EB_KEYWORDS = [
  "mon service", "mon application", "vertxia", "j'ai créé",
  "je vous propose", "je suis en train de construire", "mon outil",
  "je vous écris", "je développe", "la beta", "je vous prends",
  "je vous laisse me raconter", "BSFF auto", "ministère", "5 secondes",
  "ce que je construis", "j'aimerais discuter", "écouter",
];

// Indices Jean-Louis (frigoriste) :
const JL_KEYWORDS = [
  "je fais tout", "mon entreprise", "moi je", "mes clients",
  "frigoriste depuis", "1998", "27 ans", "je travaille",
  "sur le terrain", "mon métier", "ma société", "j'ai des clients",
  "70 frigoristes", "70 contacts", "directeurs", "associé",
  "ma boîte", "mes interventions", "contribue", "logiciel",
];

function scoreSpeaker(text, keywords) {
  const lc = text.toLowerCase();
  return keywords.reduce((acc, kw) => (lc.includes(kw) ? acc + 1 : acc), 0);
}

// Calcule un score par speaker label trouvé dans les segments
const speakerScores = {};
for (const seg of segments) {
  const spk = seg.speaker || "UNKNOWN";
  if (!speakerScores[spk]) speakerScores[spk] = { eb: 0, jl: 0, count: 0, words: 0 };
  speakerScores[spk].eb += scoreSpeaker(seg.text || "", EB_KEYWORDS);
  speakerScores[spk].jl += scoreSpeaker(seg.text || "", JL_KEYWORDS);
  speakerScores[spk].count += 1;
  speakerScores[spk].words += (seg.text || "").split(/\s+/).length;
}

console.log("\n📊 Scores par speaker :");
for (const [spk, s] of Object.entries(speakerScores)) {
  console.log(`   ${spk} : ${s.count} segments / ${s.words} mots — EB:${s.eb} JL:${s.jl}`);
}

// Mappe chaque speaker à EB ou JL en se basant sur le score le plus élevé
const speakerMap = {};
const speakerLabels = Object.keys(speakerScores);
if (speakerLabels.length === 2) {
  const [sp1, sp2] = speakerLabels;
  const s1 = speakerScores[sp1];
  const s2 = speakerScores[sp2];
  // sp1 est EB si son ratio EB > ratio JL et inverse pour sp2
  const sp1_isEB = s1.eb - s1.jl > s2.eb - s2.jl;
  speakerMap[sp1] = sp1_isEB ? "EB" : "JL";
  speakerMap[sp2] = sp1_isEB ? "JL" : "EB";
} else {
  // Fallback : map alphabétique
  speakerLabels.forEach((spk, i) => {
    speakerMap[spk] = i === 0 ? "EB" : i === 1 ? "JL" : `SPK${i}`;
  });
}

console.log("\n🔄 Mapping speakers :");
for (const [spk, label] of Object.entries(speakerMap)) {
  console.log(`   ${spk} → ${label}`);
}

// ─── GÉNÉRATION DU DIALOGUE PROPRE ─────────────────────────────────────────
const totalDurationS = Math.max(...segments.map((s) => s.end || 0));
const totalMin = Math.floor(totalDurationS / 60);
const totalSec = Math.floor(totalDurationS % 60);

const md = [];
md.push(`# 📞 Appel Jean-Louis Lapierre — ${DATE}`);
md.push("");
md.push(`> **Durée** : ${totalMin} min ${totalSec} s · **Segments** : ${segments.length} · **Source** : Whisper large-v3 + diarisation (Replicate · thomasmol)`);
md.push(`> **EB** = Emilien Behague (fondateur Vertxia) · **JL** = Jean-Louis Lapierre (frigoriste 1998)`);
md.push("");
md.push("---");
md.push("");

let lastLabel = null;
let buffer = [];
let blockStartTs = null;

function flushBlock() {
  if (buffer.length === 0) return;
  md.push(`**[${blockStartTs}] ${lastLabel}** :`);
  md.push("");
  md.push(buffer.join(" ").trim());
  md.push("");
}

for (const seg of segments) {
  const label = speakerMap[seg.speaker] || "?";
  const text = (seg.text || "").trim();
  if (!text) continue;

  if (label !== lastLabel) {
    flushBlock();
    buffer = [];
    blockStartTs = formatTime(seg.start);
    lastLabel = label;
  }
  buffer.push(text);
}
flushBlock();

md.push("");
md.push("---");
md.push("");
md.push("## 🔍 Vérification du mapping");
md.push("");
md.push("Si EB et JL sont inversés (rare mais possible si la diarisation a confondu en intro), tu peux faire un find&replace global : `**EB**` ↔ `**JL**`.");
md.push("");

fs.writeFileSync(path.join(OUTPUT_DIR, `${BASE}_DIALOGUE.md`), md.join("\n"), "utf-8");

console.log(`\n✅ Dialogue généré : ${OUTPUT_DIR}\\${BASE}_DIALOGUE.md`);
console.log(`📄 RAW JSON copié : ${OUTPUT_DIR}\\${BASE}_RAW.json`);
console.log(`⏱️  Durée totale : ${totalMin} min ${totalSec} s\n`);

function formatTime(seconds) {
  if (typeof seconds !== "number") return "??:??";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
