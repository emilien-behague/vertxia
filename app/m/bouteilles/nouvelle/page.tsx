"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/mobile/ui/mobile-header";
import { InsetListSection } from "@/components/mobile/ui/inset-list";
import { createBouteille, createMouvement } from "@/lib/equipement/bouteille-storage";
import { fluideEstInflammable, type BouteilleType } from "@/lib/equipement/bouteille";

const FLUIDES = [
  { code: "R-32", label: "R-32 (HFC)", gwp: 675 },
  { code: "R-410A", label: "R-410A (HFC)", gwp: 2088 },
  { code: "R-134a", label: "R-134a (HFC)", gwp: 1430 },
  { code: "R-1234yf", label: "R-1234yf (HFO)", gwp: 4 },
  { code: "R-407C", label: "R-407C (HFC)", gwp: 1774 },
  { code: "R-449A", label: "R-449A (HFC)", gwp: 1397 },
  { code: "R-404A", label: "R-404A (HFC)", gwp: 3922 },
  { code: "R-290", label: "R-290 (propane)", gwp: 3 },
  { code: "R-454B", label: "R-454B (HFO/HFC)", gwp: 466 },
];

export default function NouvelleBouteillePage() {
  const router = useRouter();
  const [type, setType] = useState<BouteilleType>("recharge");
  const [fluideMix, setFluideMix] = useState(false);
  const [fluideCode, setFluideCode] = useState("R-32");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [tareKg, setTareKg] = useState("10.5");
  const [capaciteMaxKg, setCapaciteMaxKg] = useState("12.0");
  const [chargeInitialeKg, setChargeInitialeKg] = useState("");
  const [fournisseur, setFournisseur] = useState("");
  const [dateAchat, setDateAchat] = useState(new Date().toISOString().split("T")[0]);
  const [compatibleInflammable, setCompatibleInflammable] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedFluide = useMemo(
    () => FLUIDES.find((f) => f.code === fluideCode) ?? FLUIDES[0],
    [fluideCode]
  );

  // Auto-set inflammable selon le fluide choisi
  function handleFluideChange(code: string) {
    setFluideCode(code);
    if (fluideEstInflammable(code) && !compatibleInflammable) {
      setCompatibleInflammable(true);
    }
  }

  // Auto-set charge initiale par défaut pour récupération
  function handleTypeChange(t: BouteilleType) {
    setType(t);
    if (t === "recuperation" && !chargeInitialeKg) {
      setChargeInitialeKg("0");
    } else if (t === "recharge" && !chargeInitialeKg) {
      setChargeInitialeKg(capaciteMaxKg);
    }
  }

  async function handleSubmit() {
    if (saving) return;
    setError(null);

    const tare = parseFloat(tareKg.replace(",", "."));
    const capacite = parseFloat(capaciteMaxKg.replace(",", "."));
    const charge = parseFloat((chargeInitialeKg || "0").replace(",", "."));

    if (!numeroSerie.trim()) {
      setError("Le numéro de série de la bouteille est obligatoire (ESP transportable).");
      return;
    }
    if (!Number.isFinite(tare) || tare <= 0) {
      setError("La tare (poids à vide) doit être positive.");
      return;
    }
    if (!Number.isFinite(capacite) || capacite <= 0) {
      setError("La capacité max doit être positive.");
      return;
    }
    if (charge < 0 || charge > capacite) {
      setError(`La charge initiale doit être entre 0 et ${capacite} kg.`);
      return;
    }
    if (!fluideMix && fluideEstInflammable(fluideCode) && !compatibleInflammable) {
      setError(`${fluideCode} est inflammable — coche "Compatible inflammable" pour confirmer le matériel adapté.`);
      return;
    }

    setSaving(true);
    try {
      const bouteille = createBouteille({
        type,
        fluide: fluideMix ? null : selectedFluide,
        fluideMix,
        numeroSerie: numeroSerie.trim(),
        tareKg: tare,
        capaciteMaxKg: capacite,
        chargeInitialeKg: charge,
        fournisseur: fournisseur.trim() || undefined,
        dateAchatISO: dateAchat || undefined,
        compatibleInflammable,
        statut: "active",
        notes: notes.trim() || undefined,
      });

      // Si recharge avec charge initiale > 0 → mouvement "réception fournisseur"
      if (type === "recharge" && charge > 0) {
        createMouvement({
          dateMouvementISO: dateAchat || new Date().toISOString(),
          bouteilleId: bouteille.id,
          type: "remplissage_initial",
          quantiteKg: charge,
          methode: "declarative",
          notes: fournisseur ? `Réception depuis ${fournisseur}` : undefined,
        });
      }

      router.push(`/m/bouteilles/${bouteille.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <>
      <MobileHeader title="🛢️ Nouvelle bouteille" largeTitle backHref="/m/bouteilles" />

      <InsetListSection title="Type de bouteille">
        <div className="px-2 py-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleTypeChange("recharge")}
            className={`px-3 py-3 rounded-xl text-left transition-colors ${
              type === "recharge"
                ? "bg-[#111] text-white"
                : "bg-black/[0.04] text-[#111] active:bg-black/[0.08]"
            }`}
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            <div className="text-[14px] font-medium">Recharge</div>
            <div className={`text-[11px] mt-0.5 ${type === "recharge" ? "text-white/65" : "text-black/45"}`}>
              Fluide neuf → équipement client
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange("recuperation")}
            className={`px-3 py-3 rounded-xl text-left transition-colors ${
              type === "recuperation"
                ? "bg-[#111] text-white"
                : "bg-black/[0.04] text-[#111] active:bg-black/[0.08]"
            }`}
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            <div className="text-[14px] font-medium">Récupération</div>
            <div className={`text-[11px] mt-0.5 ${type === "recuperation" ? "text-white/65" : "text-black/45"}`}>
              Équipement client → bouteille vide
            </div>
          </button>
        </div>
      </InsetListSection>

      <InsetListSection
        title="Fluide"
        footer={
          fluideMix
            ? "Bouteille de mélange/déchet : accepte plusieurs fluides, destinée à traitement BSFF."
            : `${fluideCode} ${fluideEstInflammable(fluideCode) ? "— inflammable (A2L/A3)" : ""}`
        }
      >
        <div className="px-4 py-3">
          <label className="flex items-center gap-3 mb-3">
            <input
              type="checkbox"
              checked={fluideMix}
              onChange={(e) => setFluideMix(e.target.checked)}
              className="w-5 h-5"
            />
            <span className="text-[14px] text-[#111]">Bouteille mélange / déchet (multi-fluides)</span>
          </label>
          {!fluideMix && (
            <select
              value={fluideCode}
              onChange={(e) => handleFluideChange(e.target.value)}
              className="input-mobile"
            >
              {FLUIDES.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </InsetListSection>

      <InsetListSection
        title="Identification"
        footer="N° d'identification ESP transportable gravé sur la bouteille (obligatoire pour le registre)."
      >
        <FormRow label="N° de série">
          <input
            type="text"
            value={numeroSerie}
            onChange={(e) => setNumeroSerie(e.target.value)}
            placeholder="Ex : B112026047"
            className="input-mobile"
            autoCapitalize="characters"
          />
        </FormRow>
        <FormRow label="Fournisseur (optionnel)">
          <input
            type="text"
            value={fournisseur}
            onChange={(e) => setFournisseur(e.target.value)}
            placeholder="Climalife, Westfalen, Air Liquide…"
            className="input-mobile"
          />
        </FormRow>
        <FormRow label="Date d'achat">
          <input
            type="date"
            value={dateAchat}
            onChange={(e) => setDateAchat(e.target.value)}
            className="input-mobile"
          />
        </FormRow>
      </InsetListSection>

      <InsetListSection
        title="Poids et capacité"
        footer="La tare = poids à vide (gravé sur la bouteille). La capacité max = poids brut max acceptable (généralement charge nominale + tare)."
      >
        <FormRow label="Tare (poids à vide, kg)">
          <input
            type="number"
            step="0.01"
            value={tareKg}
            onChange={(e) => setTareKg(e.target.value)}
            inputMode="decimal"
            className="input-mobile"
          />
        </FormRow>
        <FormRow label="Capacité max fluide (kg)">
          <input
            type="number"
            step="0.01"
            value={capaciteMaxKg}
            onChange={(e) => setCapaciteMaxKg(e.target.value)}
            inputMode="decimal"
            className="input-mobile"
          />
        </FormRow>
        <FormRow label={type === "recuperation" ? "Charge actuelle (kg)" : "Charge initiale (kg)"}>
          <input
            type="number"
            step="0.01"
            value={chargeInitialeKg}
            onChange={(e) => setChargeInitialeKg(e.target.value)}
            placeholder={type === "recuperation" ? "0 si bouteille vide" : "Souvent = capacité max"}
            inputMode="decimal"
            className="input-mobile"
          />
        </FormRow>
      </InsetListSection>

      <InsetListSection
        title="Sécurité"
        footer="Cocher si la bouteille + matériel manipulation sont compatibles fluides inflammables (R-32, R-290, R-454B, R-1234yf…)."
      >
        <label className="flex items-center gap-3 px-4 py-3">
          <input
            type="checkbox"
            checked={compatibleInflammable}
            onChange={(e) => setCompatibleInflammable(e.target.checked)}
            className="w-5 h-5"
          />
          <span className="text-[14px] text-[#111]">Compatible fluide inflammable (A2L/A3)</span>
        </label>
      </InsetListSection>

      <InsetListSection title="Notes (optionnel)">
        <div className="px-4 py-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Particularités, dernière vérif, étiquettes…"
            rows={3}
            className="input-mobile resize-none"
          />
        </div>
      </InsetListSection>

      {error && (
        <div className="mx-4 mt-2 mb-2 px-4 py-3 rounded-2xl bg-red-50 ring-1 ring-red-200 text-[13px] text-red-700">
          ❌ {error}
        </div>
      )}

      {/* CTA tuile XL emerald — enregistrer la bouteille */}
      <div className="px-4 mt-6 mb-8">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="relative block w-full text-left rounded-3xl shadow-lg shadow-black/10 active:scale-[0.98] transition-transform overflow-hidden px-5 py-5 disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, #10b981 0%, #0f766e 100%)",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl leading-none drop-shadow shrink-0">
              {saving ? "⏳" : "🛢️"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[17px] font-bold uppercase tracking-wide text-white leading-tight">
                {saving ? "Enregistrement…" : "Enregistrer la bouteille"}
              </div>
              <div className="text-[12px] text-white/85 mt-0.5">
                {saving ? "Sauvegarde en cours" : "Ajouter au stock"}
              </div>
            </div>
          </div>
        </button>
      </div>

      <style jsx global>{`
        .input-mobile {
          width: 100%; padding: 10px 0; background: transparent; border: none;
          font-size: 16px; color: #111; outline: none; font-family: inherit;
        }
        .input-mobile::placeholder { color: rgba(0,0,0,0.3); }
        select.input-mobile {
          -webkit-appearance: none; appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='rgba(0,0,0,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
          background-repeat: no-repeat; background-position: right 4px center; padding-right: 24px;
        }
      `}</style>
    </>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5 border-b border-black/[0.06] last:border-b-0">
      <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
