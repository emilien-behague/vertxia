// Web Worker Whisper on-device — Vertxia Phase 2 V3
//
// Charge Whisper Tiny (~39MB) via Transformers.js depuis CDN au premier usage,
// cache le modèle dans IndexedDB du navigateur, puis transcrit l'audio entièrement
// côté device — zéro appel cloud, fonctionne offline.
//
// Précision attendue sur FR : ~85% (Whisper Tiny). Largement suffisant pour des
// notes terrain de frigoriste. Pour de la précision pro, V3+ passera sur
// Whisper Base (74MB) ou Distil-Whisper-Small.

import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js";

// Force l'utilisation du cache navigateur et désactive les chemins locaux
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriberPromise = null;

async function getTranscriber(reportProgress) {
  if (!transcriberPromise) {
    transcriberPromise = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
      progress_callback: (p) => {
        // p.status: "initiate" | "download" | "progress" | "done"
        if (p.status === "progress" && typeof p.progress === "number") {
          reportProgress({ stage: "downloading", percent: Math.round(p.progress), file: p.file });
        } else if (p.status === "done") {
          reportProgress({ stage: "downloaded", file: p.file });
        }
      },
    });
  }
  return transcriberPromise;
}

self.addEventListener("message", async (event) => {
  const { type, audio, lang } = event.data;

  if (type === "preload") {
    try {
      await getTranscriber((info) => self.postMessage({ type: "progress", ...info }));
      self.postMessage({ type: "ready" });
    } catch (e) {
      self.postMessage({ type: "error", message: e?.message || String(e) });
    }
    return;
  }

  if (type === "transcribe") {
    try {
      self.postMessage({ type: "progress", stage: "loading_model" });
      const transcriber = await getTranscriber((info) =>
        self.postMessage({ type: "progress", ...info })
      );

      self.postMessage({ type: "progress", stage: "transcribing" });
      const output = await transcriber(audio, {
        language: lang || "french",
        task: "transcribe",
        return_timestamps: false,
        chunk_length_s: 30,
      });

      self.postMessage({ type: "result", text: output.text || "" });
    } catch (e) {
      self.postMessage({ type: "error", message: e?.message || String(e) });
    }
  }
});
