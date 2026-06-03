#!/usr/bin/env node
// Transcription d'un appel verbatim via Replicate Whisper diarization.
//
// Usage : node --env-file=.env.local scripts/transcribe-call.mjs <chemin_audio> <slug>
// Ex :    node --env-file=.env.local scripts/transcribe-call.mjs "C:\Users\behag\Desktop\Jean_louis.m4a" jean_louis
//
// Sortie : 2 fichiers dans BOS-main/Output/
//   - 2026-06-02_Appel_jean_louis_RAW.json   (réponse Replicate brute)
//   - 2026-06-02_Appel_jean_louis_DIALOGUE.md (dialogue propre Speaker A / Speaker B)

import path from "node:path";
import fs from "node:fs";
import Replicate from "replicate";

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
if (!REPLICATE_TOKEN) {
  console.error("❌ REPLICATE_API_TOKEN manquant dans .env.local");
  process.exit(1);
}

// Arguments CLI
const audioPath = process.argv[2];
const slug = process.argv[3] || "appel";

if (!audioPath) {
  console.error("❌ Usage : node scripts/transcribe-call.mjs <chemin_audio> <slug>");
  process.exit(1);
}

if (!fs.existsSync(audioPath)) {
  console.error(`❌ Fichier audio introuvable : ${audioPath}`);
  process.exit(1);
}

const stats = fs.statSync(audioPath);
const sizeMb = (stats.size / 1024 / 1024).toFixed(1);
console.log(`📁 Audio : ${audioPath}`);
console.log(`📦 Taille : ${sizeMb} Mo`);
console.log(`🎙️  Modèle : thomasmol/whisper-diarization (large-v3 + speaker separation)`);
console.log(`⏳ Upload + transcription en cours (estimé 2-5 min pour 30 min d'audio)...\n`);

const replicate = new Replicate({ auth: REPLICATE_TOKEN });

// Output dir : c:\Users\behag\Desktop\BOS-main\Output\
const outputDir = "C:\\Users\\behag\\Desktop\\BOS-main\\Output";
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Date du jour pour le préfixe
const today = new Date().toISOString().slice(0, 10);
const baseName = `${today}_Appel_${slug}`;
const rawPath = path.join(outputDir, `${baseName}_RAW.json`);
const mdPath = path.join(outputDir, `${baseName}_DIALOGUE.md`);

const start = Date.now();

try {
  // Upload du fichier audio (Replicate accepte les Files via fs.createReadStream)
  const audioFile = fs.readFileSync(audioPath);
  console.log("📤 Upload du fichier audio à Replicate...");

  // Modèle whisper-diarization de thomasmol (large-v3, diarisation, FR natif)
  const output = await replicate.run(
    "thomasmol/whisper-diarization:cbd15da9f839c5f932742f86ce7def3a03c22e2b4171d42823e83e314547003f",
    {
      input: {
        file: audioFile,
        num_speakers: 2,
        language: "fr",
        prompt: "Conversation téléphonique entre Emilien Behague (créateur de Vertxia, outil F-Gas pour frigoristes) et Jean-Louis Lapierre (frigoriste depuis 1998). Vocabulaire métier : BSFF, CERFA, SYDEREP, TrackDéchets, fluide frigorigène, contrôle d'étanchéité, ADEME, DREAL.",
      },
    }
  );

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✅ Transcription reçue en ${elapsed}s\n`);

  // Sauve la réponse brute
  fs.writeFileSync(rawPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`📄 Raw : ${rawPath}`);

  // Construit le dialogue propre
  const segments = output.segments || [];
  if (segments.length === 0) {
    console.warn("⚠️  Aucun segment retourné, vérifie le RAW JSON");
  } else {
    const lines = [];
    lines.push(`# 📞 Appel Jean-Louis Lapierre — ${today}`);
    lines.push("");
    lines.push(`> Transcription Whisper large-v3 (Replicate · thomasmol/whisper-diarization)`);
    lines.push(`> Audio : ${path.basename(audioPath)} (${sizeMb} Mo)`);
    lines.push(`> Durée transcription : ${elapsed}s`);
    lines.push("");
    lines.push("---");
    lines.push("");

    // Détection automatique du Speaker 0 / Speaker 1 et mapping vers EB / JL
    // L'hypothèse : le premier qui parle est probablement Emilien (il a rappelé)
    // Mais on laisse Speaker A / Speaker B et Emilien identifiera après lecture
    const speakerMap = {};
    let speakerCounter = 0;
    for (const seg of segments) {
      if (!(seg.speaker in speakerMap)) {
        speakerMap[seg.speaker] = String.fromCharCode(65 + speakerCounter); // A, B, C...
        speakerCounter++;
      }
    }

    let lastSpeaker = null;
    for (const seg of segments) {
      const label = speakerMap[seg.speaker] || "?";
      const start = formatTime(seg.start);
      const text = (seg.text || "").trim();
      if (!text) continue;

      if (label !== lastSpeaker) {
        if (lastSpeaker !== null) lines.push("");
        lines.push(`**[${start}] Speaker ${label}** :`);
        lastSpeaker = label;
      }
      lines.push(text);
    }

    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## 🎯 À identifier après lecture");
    lines.push("");
    lines.push("- [ ] Speaker A = Emilien (EB) ou Jean-Louis (JL) ?");
    lines.push("- [ ] Speaker B = Emilien (EB) ou Jean-Louis (JL) ?");
    lines.push("");
    lines.push("Une fois identifié, BOS va extraire les verbatims-or pour le dossier kill switch.");
    lines.push("");

    fs.writeFileSync(mdPath, lines.join("\n"), "utf-8");
    console.log(`📝 Dialogue : ${mdPath}`);
    console.log(`👥 ${speakerCounter} speakers détectés (${Object.keys(speakerMap).join(", ")} → ${Object.values(speakerMap).join(", ")})`);
    console.log(`🔢 ${segments.length} segments transcrits`);
  }

  console.log("\n✅ Terminé. Ouvre le fichier DIALOGUE.md pour lire la transcription.");
} catch (err) {
  console.error("\n❌ Erreur transcription :", err.message);
  if (err.response) {
    console.error("Détails :", await err.response.text?.());
  }
  process.exit(1);
}

function formatTime(seconds) {
  if (typeof seconds !== "number") return "??:??";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
