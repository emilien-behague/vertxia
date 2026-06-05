"use client";

// Bouton + mini-modal pour qu'un frigoriste ajoute une panne detectee
// sur SON equipement a la memoire collective Vertxia (shared_failure_catalog).
//
// Affiche sous chaque signal de maintenance predictive qui correspond a une
// panne documentable (fuite, defaut compresseur, encrassement, etc.). Permet
// au pro d'enrichir la base partagee en 2 taps, sans saisie verbeuse :
//   1. Tape sur "Documenter dans la memoire collective"
//   2. Choisit la localisation (vanne service, raccord brase, evaporateur...)
//   3. Confirme -> POST /api/catalog/failure/upsert
//
// Le type de panne est pre-rempli depuis le signal predictif. La marque +
// modele viennent de l'equipement. Aucune PII (n serie, client) ne sort.

import { useState } from "react";
import type { SignalPredictif } from "@/lib/predictive-maintenance";

type TypePanne =
  | "fuite"
  | "panne_compresseur"
  | "encrassement"
  | "defaut_ventilateur"
  | "givrage_excessif"
  | "bruit_anormal"
  | "autre";

const TYPE_PANNE_LABELS: Record<TypePanne, string> = {
  fuite: "Fuite frigorigène",
  panne_compresseur: "Panne compresseur",
  encrassement: "Encrassement",
  defaut_ventilateur: "Défaut ventilateur",
  givrage_excessif: "Givrage excessif",
  bruit_anormal: "Bruit anormal",
  autre: "Autre",
};

// Localisations communes proposees par type de panne. Le pro peut aussi
// taper sa propre localisation dans le champ "Autre".
const LOCALISATIONS_PAR_TYPE: Record<TypePanne, string[]> = {
  fuite: [
    "Raccord brasé",
    "Vanne de service",
    "Détendeur",
    "Évaporateur",
    "Condenseur",
    "Joint flare",
    "Soudure compresseur",
    "Liaison frigorifique",
  ],
  panne_compresseur: [
    "Compresseur scroll",
    "Compresseur piston",
    "Compresseur rotatif",
    "Klixon (sécurité thermique)",
    "Démarreur / condensateur",
  ],
  encrassement: [
    "Condenseur",
    "Évaporateur",
    "Filtre déshydrateur",
    "Filtre air reprise",
  ],
  defaut_ventilateur: [
    "Ventilateur extérieur",
    "Ventilateur intérieur",
    "Moteur ventilateur",
    "Roulement",
  ],
  givrage_excessif: [
    "Évaporateur",
    "Détendeur",
    "Filtre déshydrateur",
  ],
  bruit_anormal: [
    "Compresseur",
    "Ventilateur",
    "Liaisons frigorifiques",
    "Châssis",
  ],
  autre: [],
};

// Mappe un signal predictif vers le type de panne le plus probable.
// Retourne null si le signal n'est PAS une panne documentable (ex: fluide
// en phase-out, controle reglementaire jamais fait -> ce ne sont pas des
// "pannes" au sens technique du terme).
export function signalToTypePanne(signal: SignalPredictif): TypePanne | null {
  if (signal.id === "fuite-recurrente") return "fuite";
  if (signal.id === "charge-cumulee-excessive") return "fuite";
  if (signal.id === "tendance-fuite-croissante") return "fuite";
  if (signal.id === "defaut-chronique") {
    // Le titre est de la forme "Defaut chronique : <nom> sur <composant>"
    const titre = signal.titre.toLowerCase();
    if (titre.includes("compresseur")) return "panne_compresseur";
    if (titre.includes("ventilateur")) return "defaut_ventilateur";
    if (titre.includes("givrage") || titre.includes("givre")) return "givrage_excessif";
    if (titre.includes("encrass") || titre.includes("salete")) return "encrassement";
    if (titre.includes("bruit")) return "bruit_anormal";
    return "autre";
  }
  // fluide-phase-out, controle-jamais-fait => pas une panne
  return null;
}

type Props = {
  signal: SignalPredictif;
  marque: string;
  modele: string;
};

type Status =
  | { kind: "idle" }
  | { kind: "open" }
  | { kind: "busy" }
  | { kind: "done"; occurrences: number }
  /** Mode offline : panne stockee localement, sera publiee au retour de connexion. */
  | { kind: "queued" }
  | { kind: "error"; message: string };

export function DocumenterPanneButton({ signal, marque, modele }: Props) {
  const typePanneDefault = signalToTypePanne(signal);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [typePanne, setTypePanne] = useState<TypePanne>(
    typePanneDefault ?? "autre"
  );
  const [localisation, setLocalisation] = useState<string>("");
  const [localisationLibre, setLocalisationLibre] = useState<string>("");

  // Signal non documentable (ex: phase-out fluide) -> pas de bouton du tout
  if (!typePanneDefault) return null;

  // Pas de marque/modele exploitables -> pas de bouton (la memoire collective
  // a besoin d'une cle pour aggreger)
  if (!marque.trim() || !modele.trim()) return null;

  const localisationFinale =
    localisation === "__autre__" ? localisationLibre.trim() : localisation;

  async function handleSubmit() {
    if (!localisationFinale || localisationFinale.length < 2) {
      setStatus({ kind: "error", message: "Précise la localisation." });
      return;
    }
    setStatus({ kind: "busy" });
    const payload = {
      marque,
      modele,
      typePanne,
      localisation: localisationFinale,
    };
    // Offline detecte cote client : on enqueue direct, message "sera publie"
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      try {
        const { enqueueOperation } = await import("@/lib/offline-queue");
        await enqueueOperation("/api/catalog/failure/upsert", "POST", payload);
        setStatus({ kind: "queued" });
      } catch {
        setStatus({ kind: "error", message: "Impossible de mettre en file d'attente locale." });
      }
      return;
    }
    try {
      const res = await fetch("/api/catalog/failure/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: json?.error ?? `HTTP ${res.status}`,
        });
        return;
      }
      setStatus({
        kind: "done",
        occurrences:
          typeof json?.nombreOccurrences === "number"
            ? json.nombreOccurrences
            : 1,
      });
    } catch (e) {
      // Network error : enqueue pour rejouer plus tard plutot que perdre la contribution
      try {
        const { enqueueOperation } = await import("@/lib/offline-queue");
        await enqueueOperation("/api/catalog/failure/upsert", "POST", payload);
        setStatus({ kind: "queued" });
      } catch {
        setStatus({
          kind: "error",
          message: e instanceof Error ? e.message : "Erreur réseau",
        });
      }
    }
  }

  if (status.kind === "done") {
    return (
      <div className="mt-2.5 px-3 py-2 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 text-[12px] text-emerald-900 leading-snug">
        <strong>✓ Ajouté à la mémoire collective.</strong>{" "}
        {status.occurrences > 1
          ? `${status.occurrences} techniciens ont déjà observé cette panne sur ce modèle.`
          : "Tu es le premier à documenter cette panne sur ce modèle."}
      </div>
    );
  }

  if (status.kind === "queued") {
    return (
      <div className="mt-2.5 px-3 py-2 rounded-xl bg-amber-50 ring-1 ring-amber-200 text-[12px] text-amber-900 leading-snug">
        <strong>📡 En file d&apos;attente locale.</strong>{" "}
        Ta contribution sera publiée à la mémoire collective dès que ton téléphone retrouve du réseau.
      </div>
    );
  }

  // Etat ferme (idle) -> juste le bouton declencheur. Sur error, on garde
  // le form ouvert pour afficher le message + retry possible.
  if (status.kind === "idle") {
    return (
      <button
        type="button"
        onClick={() => setStatus({ kind: "open" })}
        className="mt-2.5 w-full px-3 py-2 rounded-xl bg-white ring-1 ring-black/15 text-[12px] font-medium text-[#111] active:bg-black/[0.04] transition-colors inline-flex items-center justify-center gap-1.5"
        style={{
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        <span className="text-[14px] leading-none">📚</span>
        <span>Documenter dans la mémoire collective</span>
      </button>
    );
  }

  const localisations = LOCALISATIONS_PAR_TYPE[typePanne] ?? [];

  return (
    <div className="mt-2.5 rounded-xl bg-white ring-1 ring-black/10 px-3.5 py-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-mono tracking-widest uppercase text-black/55">
          Documenter cette panne
        </div>
        <button
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
          aria-label="Fermer"
          className="w-6 h-6 rounded-full bg-black/[0.05] flex items-center justify-center active:bg-black/[0.1]"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div>
        <label className="text-[10px] font-mono tracking-widest uppercase text-black/45 block mb-1">
          Type de panne
        </label>
        <select
          value={typePanne}
          onChange={(e) => {
            setTypePanne(e.target.value as TypePanne);
            setLocalisation("");
          }}
          className="w-full px-3 py-2 rounded-lg bg-black/[0.04] text-[13px] outline-none focus:bg-black/[0.06]"
        >
          {(Object.keys(TYPE_PANNE_LABELS) as TypePanne[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_PANNE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[10px] font-mono tracking-widest uppercase text-black/45 block mb-1">
          Localisation sur l&apos;équipement
        </label>
        <select
          value={localisation}
          onChange={(e) => setLocalisation(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-black/[0.04] text-[13px] outline-none focus:bg-black/[0.06]"
        >
          <option value="">— Choisir —</option>
          {localisations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
          <option value="__autre__">Autre (préciser…)</option>
        </select>
        {localisation === "__autre__" && (
          <input
            type="text"
            value={localisationLibre}
            onChange={(e) => setLocalisationLibre(e.target.value)}
            placeholder="Ex : raccord brasé sortie compresseur"
            maxLength={80}
            className="mt-1.5 w-full px-3 py-2 rounded-lg bg-black/[0.04] text-[13px] outline-none focus:bg-black/[0.06]"
          />
        )}
      </div>

      {status.kind === "error" && (
        <div className="px-3 py-2 rounded-lg bg-red-50 ring-1 ring-red-200 text-[11.5px] text-red-700 leading-snug">
          {status.message}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={status.kind === "busy" || !localisationFinale}
        className="w-full px-3 py-2.5 rounded-lg bg-[#111] text-white text-[13px] font-medium active:bg-black/85 transition-colors disabled:opacity-50"
        style={{
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        {status.kind === "busy"
          ? "Envoi…"
          : "Ajouter à la mémoire collective"}
      </button>

      <p className="text-[10.5px] text-black/40 leading-snug">
        Anonyme — seules la marque, le modèle, le type et la localisation sont
        partagés. Aucune donnée client ni n° de série ne sort.
      </p>
    </div>
  );
}
