"use client";

import { useEffect, useRef, useState } from "react";

// Bouton dictée vocale Web Speech API native iOS/Android.
// Sur Safari iOS, la reconnaissance vocale est faite côté Apple — généralement
// on-device sur iOS 15+ via le moteur de dictée système. Pas de coût API.
//
// Usage :
//   <VoiceInput onTranscript={(text) => setNotes(text)} placeholder="Dicte tes notes…" />
//
// V2 prévue : Whisper local via @xenova/transformers pour 100% offline garanti
// + extraction structurée GPT-4 pour pré-remplir tous les champs du form.

// Type minimal pour SpeechRecognition (pas dans TS DOM lib par défaut)
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

export type VoiceInputProps = {
  onTranscript: (text: string, isFinal: boolean) => void;
  /** Append vs replace : append concatène à la valeur existante, replace écrase */
  mode?: "append" | "replace";
  /** Texte d'accompagnement sous le bouton */
  hint?: string;
  /** Label custom du bouton */
  label?: string;
  className?: string;
};

export function VoiceInput({
  onTranscript,
  mode = "append",
  hint = "Tape pour dicter — ta voix devient texte automatiquement",
  label = "Dicter au lieu de taper",
  className = "",
}: VoiceInputProps) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [supported, setSupported] = useState<boolean>(false);
  const [listening, setListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(Boolean(Ctor));
  }, []);

  function startListening() {
    if (listening) return;
    setError(null);

    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Dictée vocale non supportée par ce navigateur");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "fr-FR";
    recognition.continuous = true; // continue jusqu'au stop manuel
    recognition.interimResults = true; // affiche le texte au fil de la parole
    recognition.maxAlternatives = 1;

    let accumulated = "";

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const text = r[0].transcript;
        if (r.isFinal) {
          accumulated += text;
          onTranscript(text, true);
        } else {
          interimText += text;
        }
      }
      setInterim(interimText);
      if (interimText) onTranscript(interimText, false);
    };

    recognition.onerror = (event) => {
      const code = event.error;
      if (code === "not-allowed") {
        setError("Accès micro refusé — autorise dans Réglages → Safari → Microphone");
      } else if (code === "no-speech") {
        setError("Aucun son détecté — réessaie en parlant plus près du micro");
      } else if (code === "audio-capture") {
        setError("Pas de micro détecté");
      } else if (code === "network") {
        setError("Reconnaissance vocale indisponible (réseau requis sur ce device)");
      } else {
        setError(`Erreur dictée : ${code}`);
      }
      setListening(false);
      setInterim("");
    };

    recognition.onend = () => {
      setListening(false);
      setInterim("");
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function stopListening() {
    const r = recognitionRef.current;
    if (r) {
      r.stop();
      recognitionRef.current = null;
    }
    setListening(false);
    setInterim("");
  }

  if (!supported) {
    return (
      <div className={`rounded-2xl bg-black/[0.03] px-4 py-3 text-[12px] text-black/55 ${className}`}>
        Dictée vocale non supportée par ce navigateur (essaie Safari iOS 14+ ou Chrome).
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={listening ? stopListening : startListening}
        className={`w-full px-5 py-3.5 rounded-2xl text-[14px] font-medium transition-all flex items-center justify-center gap-2.5 ${
          listening
            ? "bg-red-500 text-white active:bg-red-600 ring-4 ring-red-500/20"
            : "bg-[#111] text-white active:bg-black/90"
        }`}
        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
      >
        {listening ? (
          <>
            <span className="relative flex w-2.5 h-2.5">
              <span className="absolute inset-0 rounded-full bg-white opacity-70 animate-ping" />
              <span className="relative w-2.5 h-2.5 rounded-full bg-white" />
            </span>
            <span>Stop · Je t&apos;écoute…</span>
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            <span>{label}</span>
          </>
        )}
      </button>

      {listening && interim && (
        <div className="mt-2 px-4 py-2 rounded-xl bg-red-50 ring-1 ring-red-200 text-[13px] text-red-900 italic leading-relaxed">
          &laquo; {interim} &raquo;
        </div>
      )}

      {!listening && !error && hint && (
        <div className="mt-2 text-[11px] text-black/45 text-center leading-relaxed">{hint}</div>
      )}

      {error && (
        <div className="mt-2 px-4 py-2 rounded-xl bg-red-50 ring-1 ring-red-200 text-[12px] text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
