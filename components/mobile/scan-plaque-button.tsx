"use client";

// Bouton reutilisable de scan de plaque signaletique (IA vision Claude).
//
// Encapsule : ouverture camera (input file capture=environment) + envoi de l'image
// a /api/vision/plaque + parsing du retour + callback onScanned vers le parent.
//
// Le parent decide quoi faire avec les donnees (pre-remplir un formulaire,
// chercher un equipement existant par n.serie, etc.).
//
// Gere l'etat de loading + feedback visuel (success / erreur / hors ligne)
// directement dans le bouton — le parent n'a rien a coder pour ca.

import { useRef, useState } from "react";

export type PlaqueData = {
  marque: string | null;
  modele: string | null;
  numeroSerie: string | null;
  fluide: string | null;
  chargeNominaleKg: number | null;
  typeEquipement: string | null;
  confiance: "haute" | "moyenne" | "basse";
  notes: string | null;
};

type Variant = "primary" | "secondary" | "compact";

type Props = {
  /** Callback appele apres scan reussi avec les donnees structurees */
  onScanned: (plaque: PlaqueData) => void;
  /** Message personnalise apres scan reussi (ex: "Equipement existant - ouverture...").
   *  Si non fourni, affiche les champs detectes. Retourner null masque le feedback. */
  successMessageFn?: (plaque: PlaqueData) => string | null;
  /** Texte du bouton — defaut "Scanner la plaque signaletique" */
  label?: string;
  /** Style du bouton */
  variant?: Variant;
  /** Desactive le bouton (ex: un autre traitement en cours) */
  disabled?: boolean;
};

export function ScanPlaqueButton({
  onScanned,
  successMessageFn,
  label = "Scanner la plaque signalétique",
  variant = "primary",
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [scanning, setScanning] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Fallback offline : l'OCR IA necessite reseau (Claude API).
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setFeedback(
        "📷 Hors connexion : photo conservée mais l'OCR IA nécessite du réseau. Remplis les champs manuellement."
      );
      return;
    }

    setScanning(true);
    setFeedback(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Lecture échouée"));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/vision/plaque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });

      if (!res.ok) {
        setFeedback("❌ Échec analyse. Réessaie avec une photo plus nette.");
        return;
      }

      const plaque = (await res.json()) as PlaqueData;

      // Callback au parent — c'est lui qui decide quoi faire des donnees
      onScanned(plaque);

      // Feedback visuel par defaut, sauf si le parent en fournit un custom
      if (successMessageFn) {
        const custom = successMessageFn(plaque);
        setFeedback(custom);
      } else {
        const found: string[] = [];
        if (plaque.modele) found.push("modèle");
        if (plaque.numeroSerie) found.push("n° série");
        if (plaque.fluide) found.push("fluide");
        if (typeof plaque.chargeNominaleKg === "number" && plaque.chargeNominaleKg > 0) {
          found.push("charge");
        }
        setFeedback(
          found.length > 0
            ? `✅ Détecté : ${found.join(", ")}`
            : "❌ Rien détecté — réessaie en visant mieux la plaque"
        );
      }
    } catch (err) {
      setFeedback(
        "❌ Erreur : " + (err instanceof Error ? err.message : "réseau")
      );
    } finally {
      setScanning(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const buttonStyles: Record<Variant, string> = {
    primary:
      "w-full px-5 py-3.5 rounded-2xl bg-[#A16207] text-white text-[14px] font-medium active:bg-[#8a5206] transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2.5",
    secondary:
      "w-full px-5 py-3 rounded-2xl bg-white ring-1 ring-[#A16207]/40 text-[#A16207] text-[14px] font-medium active:bg-[#A16207]/5 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2.5",
    compact:
      "px-3 py-2 rounded-xl bg-[#A16207] text-white text-[12px] font-medium active:bg-[#8a5206] transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2",
  };

  const iconSize = variant === "compact" ? 14 : 18;

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
        className={buttonStyles[variant]}
        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
      >
        {scanning ? (
          <>
            <span
              className={`inline-block rounded-full border-2 border-white/30 border-t-white animate-spin ${
                variant === "compact" ? "w-3 h-3" : "w-4 h-4"
              }`}
            />
            <span>Analyse IA en cours…</span>
          </>
        ) : (
          <>
            <svg
              width={iconSize}
              height={iconSize}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>📷 {label}</span>
          </>
        )}
      </button>
      {feedback && (
        <div
          className={`mt-2 px-3 py-2 rounded-xl text-[12px] leading-relaxed ${
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
