"use client";

// Import batch d'équipements depuis registre papier — le technicien prend
// chaque page en photo, l'IA vision extrait TOUS les équipements visibles,
// le user review/édite la liste, puis import bulk dans son parc.
//
// Use case principal : un technicien installé depuis 15 ans qui veut
// reconstituer son parc sans ressaisir 200 lignes à la main. Effort : 10 min
// (prendre les photos + valider la liste) au lieu d'une journée de saisie.

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { saveEquipement, listEquipements } from "@/lib/equipement/equipement";

type Phase = "idle" | "analyzing" | "review" | "importing" | "done";

type DetectedEquipement = {
  // Identifiant local pour le tableau review (pas persisté)
  _key: string;
  // Source : quelle photo l'a produit
  _sourcePageIdx: number;
  // Si déjà dans le parc local (dédup auto par n°série)
  _alreadyExists: boolean;
  // Si sélectionné pour import
  selected: boolean;
  clientName: string;
  siteAdresse: string;
  marque: string;
  modele: string;
  numeroSerie: string;
  fluide: string;
  chargeKg: string;
  dernierControle: string;
  notes: string;
};

type PageStatus = {
  fileName: string;
  status: "pending" | "analyzing" | "done" | "error";
  detected?: number;
  error?: string;
};

const FLUIDES = [
  { code: "R-32", label: "R-32 (HFC)", gwp: 675 },
  { code: "R-410A", label: "R-410A (HFC)", gwp: 2088 },
  { code: "R-407C", label: "R-407C (HFC)", gwp: 1774 },
  { code: "R-134a", label: "R-134a (HFC)", gwp: 1430 },
  { code: "R-404A", label: "R-404A (HFC)", gwp: 3922 },
  { code: "R-22", label: "R-22 (HCFC interdit)", gwp: 1810 },
  { code: "R-1234yf", label: "R-1234yf (HFO)", gwp: 4 },
  { code: "R-1234ze", label: "R-1234ze (HFO)", gwp: 7 },
  { code: "R-290", label: "R-290 propane", gwp: 3 },
  { code: "R-744", label: "R-744 CO₂", gwp: 1 },
  { code: "R-449A", label: "R-449A (HFC)", gwp: 1397 },
];

function fluideByCode(code: string) {
  return FLUIDES.find((f) => f.code === code) ?? FLUIDES[0];
}

export default function ImportRegistrePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pages, setPages] = useState<PageStatus[]>([]);
  const [detected, setDetected] = useState<DetectedEquipement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (files.length > 20) {
      setError("Maximum 20 pages à la fois — relance pour une nouvelle salve.");
      return;
    }
    setError(null);
    setPhase("analyzing");
    setPages(
      files.map((f) => ({ fileName: f.name || "Page", status: "pending" }))
    );
    setDetected([]);

    // Dédup vs parc existant : on charge les n°série déjà connus
    const existing = listEquipements();
    const existingSerials = new Set(
      existing
        .map((e) => e.numeroSerie?.trim().toLowerCase())
        .filter(Boolean) as string[]
    );

    const allDetected: DetectedEquipement[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setPages((prev) =>
        prev.map((p, idx) => (idx === i ? { ...p, status: "analyzing" } : p))
      );

      try {
        const dataUrl = await fileToDataUrl(file);
        const res = await fetch("/api/vision/registre", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl: dataUrl }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: "?" }));
          throw new Error(errBody.error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as {
          equipements: Array<Record<string, unknown>>;
        };
        const pageDetected = (json.equipements ?? []).map((eq, k) => {
          const numSerie = String(eq.numeroSerie ?? "").trim();
          const already = numSerie
            ? existingSerials.has(numSerie.toLowerCase())
            : false;
          return {
            _key: `p${i}-${k}-${Date.now()}`,
            _sourcePageIdx: i,
            _alreadyExists: already,
            selected: !already,
            clientName: String(eq.clientName ?? ""),
            siteAdresse: String(eq.siteAdresse ?? ""),
            marque: String(eq.marque ?? ""),
            modele: String(eq.modele ?? ""),
            numeroSerie: numSerie,
            fluide: String(eq.fluide ?? "R-32"),
            chargeKg:
              typeof eq.chargeNominaleKg === "number"
                ? String(eq.chargeNominaleKg)
                : "",
            dernierControle: String(eq.dernierControle ?? ""),
            notes: String(eq.notes ?? ""),
          } as DetectedEquipement;
        });
        allDetected.push(...pageDetected);
        setPages((prev) =>
          prev.map((p, idx) =>
            idx === i
              ? { ...p, status: "done", detected: pageDetected.length }
              : p
          )
        );
        setDetected([...allDetected]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setPages((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, status: "error", error: msg } : p
          )
        );
      }
    }

    setPhase("review");
  }

  function toggleSelected(key: string) {
    setDetected((prev) =>
      prev.map((d) => (d._key === key ? { ...d, selected: !d.selected } : d))
    );
  }

  function selectAll() {
    setDetected((prev) =>
      prev.map((d) => ({ ...d, selected: !d._alreadyExists }))
    );
  }
  function selectNone() {
    setDetected((prev) => prev.map((d) => ({ ...d, selected: false })));
  }

  function updateField<K extends keyof DetectedEquipement>(
    key: string,
    field: K,
    value: DetectedEquipement[K]
  ) {
    setDetected((prev) =>
      prev.map((d) => (d._key === key ? { ...d, [field]: value } : d))
    );
  }

  async function handleImport() {
    setError(null);
    const toImport = detected.filter((d) => d.selected);

    // Validation : champs minimums obligatoires côté StoredEquipement
    const invalid = toImport.filter(
      (d) =>
        !d.clientName.trim() ||
        !d.modele.trim() ||
        !d.numeroSerie.trim() ||
        !d.chargeKg ||
        parseFloat(d.chargeKg.replace(",", ".")) <= 0
    );
    if (invalid.length > 0) {
      setError(
        `${invalid.length} équipement${invalid.length > 1 ? "s ont" : " a"} des champs obligatoires manquants (client, modèle, n° série, charge > 0). Complète-les ou désélectionne-les.`
      );
      return;
    }

    setPhase("importing");
    let count = 0;
    for (const d of toImport) {
      const fluide = fluideByCode(d.fluide);
      const charge = parseFloat(d.chargeKg.replace(",", "."));
      const dernierControleISO = d.dernierControle
        ? new Date(d.dernierControle).toISOString()
        : undefined;
      const fullModele = [d.marque.trim(), d.modele.trim()]
        .filter(Boolean)
        .join(" ")
        .trim();
      try {
        saveEquipement({
          clientName: d.clientName.trim(),
          siteAdresse: d.siteAdresse.trim() || undefined,
          modele: fullModele,
          numeroSerie: d.numeroSerie.trim(),
          fluide: { code: fluide.code, label: fluide.label, gwp: fluide.gwp },
          chargeKg: charge,
          detecteurFixe: false,
          dernierControleISO,
          notes: d.notes.trim() || undefined,
        });
        count++;
      } catch (err) {
        console.error("[import-registre] saveEquipement error:", err);
      }
    }
    setImportedCount(count);
    setPhase("done");
  }

  function reset() {
    setPhase("idle");
    setPages([]);
    setDetected([]);
    setError(null);
    setImportedCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const selectedCount = detected.filter((d) => d.selected).length;
  const dupCount = detected.filter((d) => d._alreadyExists).length;

  return (
    <>
      <MobileHeader title="📸 Importer un registre" largeTitle backHref="/m/equipements" />

      {/* PHASE IDLE — instructions + upload */}
      {phase === "idle" && (
        <>
          <div className="mx-4 mt-3 rounded-2xl bg-white ring-1 ring-black/[0.04] p-5">
            <p className="text-[14px] text-black/75 leading-relaxed">
              Reconstitue ton parc en quelques minutes : prends chaque page de
              ton registre / carnet / archive en photo, l&apos;IA lit le
              tableau et crée les équipements en bulk.
            </p>
            <ul className="mt-3 text-[13px] text-black/55 leading-relaxed space-y-1">
              <li>· Cadre la page entière, bien éclairée, sans flou</li>
              <li>· Jusqu&apos;à 20 pages d&apos;un coup, ~1 sec par équipement détecté</li>
              <li>· Tu valides la liste avant l&apos;import (édition possible)</li>
              <li>· Les doublons (même n° série déjà dans ton parc) sont décochés auto</li>
            </ul>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handleFilesSelected}
            className="hidden"
          />
          <div className="px-4 mt-5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-5 py-4 rounded-2xl bg-[#111] text-white text-[15px] font-semibold flex items-center justify-center gap-2 active:bg-black/90"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Prendre les pages en photo
            </button>
            <p className="text-[11px] text-black/40 text-center mt-2">
              Multi-sélection possible · maximum 20 pages
            </p>
          </div>

          {error && (
            <div className="mx-4 mt-4 rounded-2xl bg-red-50 ring-1 ring-red-200 p-4 text-[13px] text-red-700">
              {error}
            </div>
          )}
        </>
      )}

      {/* PHASE ANALYZING — progress page par page */}
      {phase === "analyzing" && (
        <div className="mx-4 mt-3 rounded-2xl bg-white ring-1 ring-black/[0.04] overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.06]">
            <div className="text-[14px] font-medium text-[#111]">
              Analyse en cours…
            </div>
            <div className="text-[12px] text-black/55 mt-0.5">
              {pages.filter((p) => p.status === "done").length} / {pages.length} pages traitées
            </div>
          </div>
          <div className="divide-y divide-black/[0.06]">
            {pages.map((p, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium ${
                    p.status === "done"
                      ? "bg-emerald-100 text-emerald-700"
                      : p.status === "analyzing"
                        ? "bg-blue-100 text-blue-700"
                        : p.status === "error"
                          ? "bg-red-100 text-red-700"
                          : "bg-black/[0.05] text-black/40"
                  }`}
                >
                  {p.status === "done"
                    ? "✓"
                    : p.status === "analyzing"
                      ? "…"
                      : p.status === "error"
                        ? "!"
                        : i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[#111] truncate">
                    Page {i + 1}
                  </div>
                  <div className="text-[11px] text-black/45 truncate">
                    {p.status === "done"
                      ? `${p.detected ?? 0} équipement${(p.detected ?? 0) > 1 ? "s" : ""} détecté${(p.detected ?? 0) > 1 ? "s" : ""}`
                      : p.status === "analyzing"
                        ? "Lecture IA en cours…"
                        : p.status === "error"
                          ? `Erreur : ${p.error}`
                          : "En attente"}
                  </div>
                </div>
                {p.status === "analyzing" && (
                  <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-700 rounded-full animate-spin" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PHASE REVIEW — liste éditable + checkboxes */}
      {phase === "review" && (
        <>
          <div className="mx-4 mt-3 rounded-2xl bg-white ring-1 ring-black/[0.04] p-4">
            <div className="text-[14px] font-medium text-[#111]">
              {detected.length} équipement{detected.length > 1 ? "s" : ""} détecté{detected.length > 1 ? "s" : ""}
            </div>
            <div className="text-[12px] text-black/55 mt-0.5">
              {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""} pour l&apos;import
              {dupCount > 0 && ` · ${dupCount} doublon${dupCount > 1 ? "s" : ""} déjà dans ton parc (décoché auto)`}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={selectAll}
                className="text-[12px] text-[#A16207] font-medium px-3 py-1.5 rounded-lg bg-[#A16207]/8 active:bg-[#A16207]/15"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                Tout cocher
              </button>
              <button
                type="button"
                onClick={selectNone}
                className="text-[12px] text-black/65 font-medium px-3 py-1.5 rounded-lg bg-black/[0.05] active:bg-black/10"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                Tout décocher
              </button>
            </div>
          </div>

          {error && (
            <div className="mx-4 mt-3 rounded-2xl bg-red-50 ring-1 ring-red-200 p-4 text-[13px] text-red-700">
              {error}
            </div>
          )}

          {detected.length === 0 && (
            <div className="mx-4 mt-6 rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-5 text-center">
              <div className="text-[14px] text-amber-900">
                Aucun équipement détecté sur ces pages. Vérifie que les photos sont nettes et bien cadrées.
              </div>
              <button
                type="button"
                onClick={reset}
                className="mt-3 px-4 py-2 rounded-lg bg-[#111] text-white text-[13px] font-medium"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                Recommencer
              </button>
            </div>
          )}

          {/* Liste éditable */}
          {detected.length > 0 && (
            <div className="mx-4 mt-3 space-y-2 pb-32">
              {detected.map((d) => (
                <div
                  key={d._key}
                  className={`rounded-2xl bg-white ring-1 overflow-hidden ${
                    d.selected ? "ring-[#A16207]/30" : "ring-black/[0.06] opacity-60"
                  } ${d._alreadyExists ? "bg-amber-50/40" : ""}`}
                >
                  <div className="px-4 py-3 flex items-start gap-3 border-b border-black/[0.04]">
                    <button
                      type="button"
                      onClick={() => toggleSelected(d._key)}
                      className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        d.selected
                          ? "bg-[#A16207] border-[#A16207]"
                          : "bg-white border-black/25"
                      }`}
                      style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                      aria-label="Sélectionner"
                    >
                      {d.selected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-medium text-[#111] truncate">
                        {d.clientName || <span className="text-red-600">Client manquant</span>}
                      </div>
                      <div className="text-[12px] text-black/55 truncate">
                        {[d.marque, d.modele].filter(Boolean).join(" ") || (
                          <span className="text-red-600">Modèle manquant</span>
                        )}{" "}
                        · SN {d.numeroSerie || <span className="text-red-600">manquant</span>}
                      </div>
                      <div className="text-[11px] text-black/40 mt-0.5">
                        Page {d._sourcePageIdx + 1}
                        {d._alreadyExists && " · ⚠ Déjà dans ton parc"}
                      </div>
                    </div>
                  </div>

                  {/* Champs éditables (si sélectionné) */}
                  {d.selected && (
                    <div className="px-4 py-3 space-y-2 bg-black/[0.015]">
                      <RowField
                        label="Client"
                        value={d.clientName}
                        onChange={(v) => updateField(d._key, "clientName", v)}
                        required
                      />
                      <RowField
                        label="Site / adresse"
                        value={d.siteAdresse}
                        onChange={(v) => updateField(d._key, "siteAdresse", v)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <RowField
                          label="Marque"
                          value={d.marque}
                          onChange={(v) => updateField(d._key, "marque", v)}
                        />
                        <RowField
                          label="Modèle"
                          value={d.modele}
                          onChange={(v) => updateField(d._key, "modele", v)}
                          required
                        />
                      </div>
                      <RowField
                        label="N° série"
                        value={d.numeroSerie}
                        onChange={(v) => updateField(d._key, "numeroSerie", v)}
                        required
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] uppercase tracking-wide text-black/45 font-medium">
                            Fluide *
                          </label>
                          <select
                            value={d.fluide}
                            onChange={(e) => updateField(d._key, "fluide", e.target.value)}
                            className="w-full mt-0.5 px-2 py-1.5 rounded-lg ring-1 ring-black/10 bg-white text-[13px] text-[#111]"
                          >
                            {FLUIDES.map((f) => (
                              <option key={f.code} value={f.code}>
                                {f.code}
                              </option>
                            ))}
                          </select>
                        </div>
                        <RowField
                          label="Charge (kg) *"
                          value={d.chargeKg}
                          onChange={(v) => updateField(d._key, "chargeKg", v)}
                          required
                          type="text"
                          inputMode="decimal"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wide text-black/45 font-medium">
                          Dernier contrôle
                        </label>
                        <input
                          type="date"
                          value={d.dernierControle}
                          onChange={(e) => updateField(d._key, "dernierControle", e.target.value)}
                          className="w-full mt-0.5 px-2 py-1.5 rounded-lg ring-1 ring-black/10 bg-white text-[13px] text-[#111]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Footer flottant CTA */}
          {detected.length > 0 && (
            <div
              className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-xl border-t border-black/[0.06] px-4 py-3"
              style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom) + 80px)" }}
            >
              <div className="max-w-md mx-auto flex gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="px-4 py-3 rounded-xl ring-1 ring-black/15 text-black/75 text-[14px] font-medium active:bg-black/[0.04]"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={selectedCount === 0}
                  className="flex-1 px-4 py-3 rounded-xl bg-[#111] text-white text-[14px] font-semibold active:bg-black/90 disabled:opacity-40"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  Importer {selectedCount} équipement{selectedCount > 1 ? "s" : ""}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* PHASE IMPORTING */}
      {phase === "importing" && (
        <div className="px-5 mt-10 text-center">
          <div className="inline-block w-10 h-10 border-3 border-black/15 border-t-[#111] rounded-full animate-spin mb-4" />
          <div className="text-[15px] text-[#111] font-medium">
            Création du parc…
          </div>
        </div>
      )}

      {/* PHASE DONE */}
      {phase === "done" && (
        <div className="mx-4 mt-6 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 mb-3">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="text-[18px] font-semibold text-emerald-900">
            {importedCount} équipement{importedCount > 1 ? "s" : ""} importé{importedCount > 1 ? "s" : ""}
          </div>
          <div className="text-[13px] text-emerald-800/80 mt-1">
            Ton parc Vertxia est à jour. Sync auto vers le cloud en cours.
          </div>
          <div className="flex gap-2 mt-5">
            <button
              type="button"
              onClick={reset}
              className="flex-1 px-4 py-3 rounded-xl ring-1 ring-emerald-300 text-emerald-900 text-[14px] font-medium active:bg-emerald-100"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              Importer d&apos;autres pages
            </button>
            <Link
              href="/m/equipements"
              onClick={() => router.refresh()}
              className="flex-1 px-4 py-3 rounded-xl bg-emerald-700 text-white text-[14px] font-semibold text-center active:bg-emerald-800"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              Voir mon parc
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

function RowField({
  label,
  value,
  onChange,
  required,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  inputMode?: "text" | "decimal" | "numeric" | "email" | "tel" | "url";
}) {
  const isMissing = required && !value.trim();
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wide text-black/45 font-medium">
        {label}
        {required && " *"}
      </label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full mt-0.5 px-2 py-1.5 rounded-lg bg-white text-[13px] text-[#111] ring-1 ${
          isMissing ? "ring-red-300 bg-red-50/30" : "ring-black/10"
        }`}
      />
    </div>
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Lecture fichier échouée"));
    reader.readAsDataURL(file);
  });
}
