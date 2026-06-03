"use client";

import { useEffect, useRef, useState } from "react";

// Modal plein écran de dictée libre pour la création d'un équipement.
// Pattern identique à <VoiceFullDictation /> (intervention) mais avec
// un schema dédié et l'endpoint /api/voice/extract-equipement.

type SpeechRecognitionResult = {
  isFinal: boolean;
  0: { transcript: string; confidence: number };
};
type SpeechRecognitionEvent = {
  results: SpeechRecognitionResult[] & { length: number };
  resultIndex: number;
};
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognition };
    webkitSpeechRecognition?: { new (): SpeechRecognition };
  }
}

export type UniteExtractionResult = {
  type: string;
  modele: string | null;
  numeroSerie: string | null;
  emplacement: string | null;
};

export type EquipementExtractionResult = {
  clientName: string | null;
  clientEmail: string | null;
  clientTelephone: string | null;
  siteAdresse: string | null;
  modele: string | null;
  numeroSerie: string | null;
  fluideCode: string | null;
  chargeKg: number | null;
  detecteurFixe: boolean | null;
  dernierControle: string | null;
  notes: string | null;
  unitesInterieures: UniteExtractionResult[];
  confiance: "haute" | "moyenne" | "basse";
};

type Props = {
  open: boolean;
  onClose: () => void;
  onExtraction: (result: EquipementExtractionResult, transcript: string) => void;
};

type Phase = "idle" | "listening" | "processing" | "error";

export function VoiceFullDictationEquipement({ open, onClose, onExtraction }: Props) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState<string>("");
  const [interim, setInterim] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(Boolean(Ctor));
  }, []);

  useEffect(() => {
    if (!open) {
      stopRecognition();
      setPhase("idle");
      setTranscript("");
      setInterim("");
      setError(null);
    }
  }, [open]);

  function stopRecognition() {
    const r = recognitionRef.current;
    if (r) {
      try {
        r.stop();
      } catch {
        /* déjà arrêté */
      }
      recognitionRef.current = null;
    }
  }

  function startListening() {
    setError(null);
    setTranscript("");
    setInterim("");

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Dictée vocale non supportée — essaie Safari iOS 14+ ou Chrome");
      setPhase("error");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let accumulated = "";

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const text = r[0].transcript;
        if (r.isFinal) {
          accumulated += text + " ";
        } else {
          interimText += text;
        }
      }
      setTranscript(accumulated.trim());
      setInterim(interimText);
    };

    recognition.onerror = (event) => {
      const code = event.error;
      let msg = `Erreur dictée : ${code}`;
      if (code === "not-allowed") {
        msg = "Accès micro refusé — autorise dans Réglages → Safari → Microphone";
      } else if (code === "no-speech") {
        msg = "Aucun son détecté — réessaie en parlant plus près du micro";
      } else if (code === "audio-capture") {
        msg = "Pas de micro détecté";
      } else if (code === "network") {
        msg = "Reconnaissance vocale indisponible (réseau requis)";
      }
      setError(msg);
      setPhase("error");
      setInterim("");
    };

    recognition.onend = () => {
      /* géré par handleStop */
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setPhase("listening");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  async function handleStop() {
    stopRecognition();
    const finalText = [transcript, interim].filter(Boolean).join(" ").trim();
    setTranscript(finalText);
    setInterim("");

    if (finalText.length < 5) {
      setError("Aucune transcription captée — réessaie en parlant plus longtemps");
      setPhase("error");
      return;
    }

    setPhase("processing");

    try {
      const res = await fetch("/api/voice/extract-equipement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: finalText }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Erreur inconnue" }));
        setError(errBody?.error || `Erreur API ${res.status}`);
        setPhase("error");
        return;
      }

      const data = (await res.json()) as { extraction: EquipementExtractionResult; transcript: string };
      onExtraction(data.extraction, finalText);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  function handleRetry() {
    setError(null);
    setTranscript("");
    setInterim("");
    setPhase("idle");
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111] text-white flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div>
          <div className="text-[10px] tracking-[0.25em] text-white/40 uppercase font-mono">
            · Dictée équipement
          </div>
          <div className="text-[15px] font-medium mt-0.5">
            {phase === "idle" && "Prêt à dicter"}
            {phase === "listening" && "Je t'écoute…"}
            {phase === "processing" && "Extraction en cours…"}
            {phase === "error" && "Erreur"}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={phase === "processing"}
          className="w-10 h-10 rounded-full bg-white/10 active:bg-white/20 flex items-center justify-center disabled:opacity-50"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          aria-label="Fermer"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {phase === "idle" && (
          <div className="max-w-md mx-auto pt-8">
            <p className="text-[18px] leading-relaxed text-white/85 mb-6">
              Dicte les infos du nouvel équipement en langage naturel. L&apos;IA range tout dans les bonnes cases.
            </p>
            <div className="rounded-2xl bg-white/[0.06] p-5 mb-6">
              <div className="text-[10px] tracking-[0.25em] text-white/40 uppercase font-mono mb-3">
                · Exemple
              </div>
              <p className="text-[14px] text-white/65 leading-relaxed italic">
                «&nbsp;Nouvel équipement chez l&apos;hôtel Le Provençal à Toulon. C&apos;est un Daikin VRV cinq, numéro de série DK24VRV16001, 16 kilos de R32, détecteur fixe installé. Il y a 4 cassettes plafonnières dans les chambres.&nbsp;»
              </p>
            </div>
            <div className="text-[12px] text-white/45 leading-relaxed">
              Tu peux parler aussi longtemps que tu veux. Stop quand t&apos;as fini.
            </div>
          </div>
        )}

        {phase === "listening" && (
          <div className="max-w-md mx-auto">
            {transcript && (
              <p className="text-[20px] leading-relaxed text-white mb-4">{transcript}</p>
            )}
            {interim && (
              <p className="text-[20px] leading-relaxed text-white/50 italic">{interim}</p>
            )}
            {!transcript && !interim && (
              <p className="text-[16px] text-white/40 italic">En attente de ta voix…</p>
            )}
          </div>
        )}

        {phase === "processing" && (
          <div className="max-w-md mx-auto pt-12">
            <div className="rounded-2xl bg-white/[0.06] p-5 mb-6">
              <div className="text-[10px] tracking-[0.25em] text-white/40 uppercase font-mono mb-3">
                · Transcription
              </div>
              <p className="text-[14px] text-white/80 leading-relaxed">{transcript}</p>
            </div>
            <div className="flex items-center justify-center gap-3 text-white/65">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-[14px]">L&apos;IA range tes infos dans les cases…</span>
            </div>
          </div>
        )}

        {phase === "error" && error && (
          <div className="max-w-md mx-auto pt-8">
            <div className="rounded-2xl bg-red-500/15 ring-1 ring-red-500/30 p-5 mb-6">
              <div className="text-[10px] tracking-[0.25em] text-red-300 uppercase font-mono mb-2">
                · Erreur
              </div>
              <p className="text-[14px] text-red-100 leading-relaxed">{error}</p>
            </div>
            {transcript && (
              <div className="rounded-2xl bg-white/[0.06] p-5 mb-6">
                <div className="text-[10px] tracking-[0.25em] text-white/40 uppercase font-mono mb-2">
                  · Transcription captée
                </div>
                <p className="text-[14px] text-white/80 leading-relaxed">{transcript}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pt-3 pb-5 border-t border-white/10">
        {!supported && (
          <div className="rounded-2xl bg-red-500/15 ring-1 ring-red-500/30 p-4 mb-3 text-[13px] text-red-100">
            Dictée non supportée par ce navigateur. Essaie Safari iOS 14+ ou Chrome.
          </div>
        )}

        {phase === "idle" && supported && (
          <button
            type="button"
            onClick={startListening}
            className="w-full px-6 py-4 rounded-2xl bg-white text-[#111] text-[15px] font-semibold flex items-center justify-center gap-2 active:opacity-80"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            Démarrer la dictée
          </button>
        )}

        {phase === "listening" && (
          <button
            type="button"
            onClick={handleStop}
            className="w-full px-6 py-4 rounded-2xl bg-red-500 text-white text-[15px] font-semibold flex items-center justify-center gap-2.5 active:bg-red-600 ring-4 ring-red-500/30"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            <span className="relative flex w-2.5 h-2.5">
              <span className="absolute inset-0 rounded-full bg-white opacity-70 animate-ping" />
              <span className="relative w-2.5 h-2.5 rounded-full bg-white" />
            </span>
            Stop &amp; analyser
          </button>
        )}

        {phase === "processing" && (
          <button
            type="button"
            disabled
            className="w-full px-6 py-4 rounded-2xl bg-white/20 text-white/60 text-[15px] font-semibold flex items-center justify-center gap-2"
          >
            Analyse en cours…
          </button>
        )}

        {phase === "error" && (
          <button
            type="button"
            onClick={handleRetry}
            className="w-full px-6 py-4 rounded-2xl bg-white text-[#111] text-[15px] font-semibold active:opacity-80"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}
