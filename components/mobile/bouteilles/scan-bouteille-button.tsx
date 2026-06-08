"use client";

// Bouton de scan bouteille via IA Vision Claude.
//
// Remplace l'ancien scan code-barres camera live (BarcodeDetector / ZXing /
// html5-qrcode) qui echouait sur Safari iOS avec les Code-128 GS1 industriels.
//
// Workflow :
//  1. Tap bouton -> input file capture=environment -> appareil photo iOS natif
//  2. Photo prise -> upload base64 vers /api/vision/bouteille
//  3. Claude Vision lit le code-barres + marque + fluide + capacite + n.serie
//  4. Callback onScanned(BouteilleVisionData) au parent
//
// Pattern aligne sur scan-plaque-button : le parent decide quoi faire des donnees
// (lookup en base, pre-remplit form, redirige si deja en stock, etc.).

import { useRef, useState } from "react";

export type BouteilleVisionData = {
  codeBarre: string | null;
  marque: string | null;
  fluide: string | null;
  numeroSerie: string | null;
  capaciteMaxKg: number | null;
  tareKg: number | null;
  type: "recharge" | "recuperation" | null;
  confiance: "haute" | "moyenne" | "basse";
  notes: string | null;
};

type Props = {
  /** Callback appele apres scan reussi avec les donnees structurees */
  onScanned: (data: BouteilleVisionData) => void;
  /** Message custom apres scan ; sinon recap des champs detectes */
  successMessageFn?: (data: BouteilleVisionData) => string | null;
  /** Desactive le bouton (ex: enregistrement en cours) */
  disabled?: boolean;
};

export function ScanBouteilleButton({
  onScanned,
  successMessageFn,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [scanning, setScanning] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // L'OCR IA necessite reseau (API Anthropic). Si hors ligne, fallback saisie manuelle.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setFeedback(
        "📷 Hors connexion : l'IA vision necessite du reseau. Saisis le code-barres a la main."
      );
      return;
    }

    setScanning(true);
    setFeedback(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Lecture echouee"));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/vision/bouteille", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });

      if (!res.ok) {
        setFeedback("❌ Echec analyse. Reessaie avec une photo plus nette du code-barres.");
        return;
      }

      const data = (await res.json()) as BouteilleVisionData;

      // Callback au parent qui decide quoi faire (lookup, pre-remplit, redirect…)
      onScanned(data);

      if (successMessageFn) {
        const custom = successMessageFn(data);
        setFeedback(custom);
      } else {
        const found: string[] = [];
        if (data.codeBarre) found.push(`code ${data.codeBarre}`);
        if (data.marque) found.push(`marque ${data.marque}`);
        if (data.fluide) found.push(`fluide ${data.fluide}`);
        if (typeof data.capaciteMaxKg === "number" && data.capaciteMaxKg > 0) {
          found.push(`${data.capaciteMaxKg} kg`);
        }
        setFeedback(
          found.length > 0
            ? `✅ Detecte : ${found.join(", ")}`
            : "❌ Rien detecte — reessaie en visant mieux le code-barres"
        );
      }
    } catch (err) {
      setFeedback("❌ Erreur : " + (err instanceof Error ? err.message : "reseau"));
    } finally {
      setScanning(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleScan}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={scanning || disabled}
        className="w-full px-5 py-4 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 text-emerald-900 active:bg-emerald-100 transition-colors flex items-center gap-3 disabled:opacity-60"
        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
      >
        {scanning ? (
          <>
            <span className="inline-block w-5 h-5 rounded-full border-2 border-emerald-900/30 border-t-emerald-900 animate-spin shrink-0" />
            <div className="flex-1 text-left">
              <div className="text-[14px] font-semibold leading-tight">
                Analyse IA en cours…
              </div>
              <div className="text-[11.5px] text-emerald-800/75 mt-0.5">
                Claude lit la bouteille (~2-3 sec)
              </div>
            </div>
          </>
        ) : (
          <>
            <span className="text-2xl">📷</span>
            <div className="flex-1 text-left">
              <div className="text-[14px] font-semibold leading-tight">
                Scanner la bouteille (photo + IA)
              </div>
              <div className="text-[11.5px] text-emerald-800/75 mt-0.5">
                Vise le sticker code-barres — l&apos;IA pre-remplit le formulaire
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </>
        )}
      </button>
      {feedback && (
        <div
          className={`mt-2 px-3 py-2 rounded-xl text-[12.5px] leading-relaxed whitespace-pre-line ${
            feedback.startsWith("✅")
              ? "bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800"
              : feedback.startsWith("📷")
                ? "bg-amber-50 ring-1 ring-amber-200 text-amber-800"
                : "bg-red-50 ring-1 ring-red-200 text-red-700"
          }`}
        >
          {feedback}
        </div>
      )}
    </div>
  );
}
