"use client";

import { useEffect, useRef, useState } from "react";

// Dictée vocale 100% on-device via Whisper Tiny (Transformers.js).
// Premier usage : download du modèle ~39 MB en background (10-30s sur 4G,
// instantané sur Wi-Fi). Ensuite cache navigateur permanent — fonctionne
// 100% offline après le 1er load.
//
// Précision FR : ~85%. Latence transcription : 2-5s pour 10s d'audio sur
// CPU iPhone. Le worker tourne en arrière-plan, le UI ne bloque jamais.

type State =
  | { type: "idle" }
  | { type: "preparing"; stage: string; percent?: number; file?: string }
  | { type: "recording"; durationMs: number }
  | { type: "processing"; stage: string }
  | { type: "error"; message: string };

export type WhisperInputProps = {
  onTranscript: (text: string) => void;
  label?: string;
  className?: string;
};

export function WhisperInput({
  onTranscript,
  label = "🎙️ Dicter (Whisper offline)",
  className = "",
}: WhisperInputProps) {
  const workerRef = useRef<Worker | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const recordingTimerRef = useRef<number | null>(null);
  const [state, setState] = useState<State>({ type: "idle" });
  const [supported, setSupported] = useState<boolean>(true);
  const [modelReady, setModelReady] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Check support MediaRecorder + Worker
    if (typeof MediaRecorder === "undefined" || typeof Worker === "undefined") {
      setSupported(false);
      return;
    }

    // Lazy-init du worker (le download du modèle ne démarre que quand on appelle)
    const worker = new Worker("/whisper-worker.js", { type: "module" });
    workerRef.current = worker;

    worker.addEventListener("message", (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === "progress") {
        setState({
          type: "preparing",
          stage: msg.stage || "",
          percent: msg.percent,
          file: msg.file,
        });
      } else if (msg.type === "ready") {
        setModelReady(true);
        setState({ type: "idle" });
      } else if (msg.type === "result") {
        const text = String(msg.text || "").trim();
        if (text) onTranscript(text);
        setState({ type: "idle" });
      } else if (msg.type === "error") {
        setState({ type: "error", message: String(msg.message || "Erreur Whisper") });
      }
    });

    return () => {
      worker.terminate();
      workerRef.current = null;
      if (recordingTimerRef.current !== null) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function audioBlobToFloat32(blob: Blob): Promise<Float32Array> {
    const arrayBuffer = await blob.arrayBuffer();
    // Safari iOS : utilise webkit prefix si nécessaire
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) throw new Error("AudioContext non supporté");
    const audioCtx = new Ctor();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // Whisper attend 16 kHz mono. On resample via OfflineAudioContext.
    const targetSampleRate = 16000;
    const offlineCtx = new OfflineAudioContext(
      1,
      Math.ceil(audioBuffer.duration * targetSampleRate),
      targetSampleRate
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    const rendered = await offlineCtx.startRendering();
    await audioCtx.close().catch(() => {});
    return rendered.getChannelData(0);
  }

  async function startRecording() {
    if (state.type === "recording") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      });

      recorder.addEventListener("stop", async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        if (blob.size === 0) {
          setState({ type: "idle" });
          return;
        }
        try {
          setState({ type: "processing", stage: "decoding_audio" });
          const audio = await audioBlobToFloat32(blob);
          setState({ type: "processing", stage: "transcribing" });
          workerRef.current?.postMessage({
            type: "transcribe",
            audio,
            lang: "french",
          });
        } catch (e) {
          setState({
            type: "error",
            message: e instanceof Error ? e.message : "Erreur décodage audio",
          });
        }
      });

      recorder.start();
      recordingStartRef.current = Date.now();
      setState({ type: "recording", durationMs: 0 });

      recordingTimerRef.current = window.setInterval(() => {
        setState({
          type: "recording",
          durationMs: Date.now() - recordingStartRef.current,
        });
      }, 100);
    } catch (e) {
      setState({
        type: "error",
        message:
          e instanceof Error && e.name === "NotAllowedError"
            ? "Accès micro refusé — autorise dans Réglages → Safari → Microphone"
            : e instanceof Error
              ? e.message
              : "Erreur micro",
      });
    }
  }

  function stopRecording() {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }

  if (!supported) {
    return (
      <div className={`rounded-2xl bg-black/[0.03] px-4 py-3 text-[12px] text-black/55 ${className}`}>
        Whisper offline non supporté par ce navigateur (MediaRecorder requis).
      </div>
    );
  }

  const isRecording = state.type === "recording";
  const isPreparing = state.type === "preparing";
  const isProcessing = state.type === "processing";
  const disabled = isPreparing || isProcessing;

  let buttonLabel: React.ReactNode = label;
  if (isRecording) {
    const seconds = Math.floor(state.durationMs / 1000);
    buttonLabel = (
      <>
        <span className="relative flex w-2.5 h-2.5">
          <span className="absolute inset-0 rounded-full bg-white opacity-70 animate-ping" />
          <span className="relative w-2.5 h-2.5 rounded-full bg-white" />
        </span>
        <span>Stop · {seconds}s</span>
      </>
    );
  } else if (isPreparing) {
    const pct = state.percent ? ` ${state.percent}%` : "";
    buttonLabel = `Téléchargement Whisper${pct}…`;
  } else if (isProcessing) {
    buttonLabel = state.stage === "transcribing" ? "Transcription on-device…" : "Décodage audio…";
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled}
        className={`w-full px-5 py-3.5 rounded-2xl text-[14px] font-medium transition-all flex items-center justify-center gap-2.5 disabled:opacity-60 ${
          isRecording
            ? "bg-red-500 text-white active:bg-red-600 ring-4 ring-red-500/20"
            : "bg-[#A16207] text-white active:bg-[#8a5206]"
        }`}
        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
      >
        {buttonLabel}
      </button>

      {isPreparing && (
        <div className="mt-2 text-[11px] text-black/55 text-center leading-relaxed">
          Premier chargement seulement (~39 MB) — ensuite ça marche offline.
        </div>
      )}

      {!modelReady && state.type === "idle" && (
        <div className="mt-2 text-[11px] text-black/45 text-center leading-relaxed">
          1er tap : téléchargement du modèle (~39 MB, garde en cache). Ensuite : dictée 100 % offline.
        </div>
      )}

      {modelReady && state.type === "idle" && (
        <div className="mt-2 text-[11px] text-emerald-700 text-center font-medium">
          ✓ Whisper prêt · fonctionne sans réseau
        </div>
      )}

      {state.type === "error" && (
        <div className="mt-2 px-4 py-2 rounded-xl bg-red-50 ring-1 ring-red-200 text-[12px] text-red-700">
          {state.message}
        </div>
      )}
    </div>
  );
}
