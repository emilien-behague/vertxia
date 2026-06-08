"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/mobile/ui/mobile-header";
import { InsetListSection } from "@/components/mobile/ui/inset-list";
import { createBouteille, createMouvement, findBouteilleByCodeBarre } from "@/lib/equipement/bouteille-storage";
import { fluideEstInflammable, type BouteilleType } from "@/lib/equipement/bouteille";
import {
  ScanBouteilleButton,
  type BouteilleVisionData,
} from "@/components/mobile/bouteilles/scan-bouteille-button";

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
  const [codeBarre, setCodeBarre] = useState("");
  const [tareKg, setTareKg] = useState("10.5");
  const [capaciteMaxKg, setCapaciteMaxKg] = useState("12.0");
  const [chargeInitialeKg, setChargeInitialeKg] = useState("");
  const [fournisseur, setFournisseur] = useState("");
  const [dateAchat, setDateAchat] = useState(new Date().toISOString().split("T")[0]);
  const [compatibleInflammable, setCompatibleInflammable] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Callback scan IA bouteille : Claude Vision retourne codeBarre + bonus
  // (marque, fluide, capacite, n.serie, type). Si codeBarre deja connu en base
  // -> redirect vers la fiche. Sinon -> pre-remplit le formulaire avec TOUS
  // les champs detectes (gain de temps massif sur le formulaire 8 champs).
  function handleScanDetect(data: BouteilleVisionData): string | null {
    // Lookup en base par code-barres
    if (data.codeBarre) {
      const existing = findBouteilleByCodeBarre(data.codeBarre);
      if (existing) {
        setTimeout(() => router.push(`/m/bouteilles/${existing.id}`), 600);
        return `✅ Bouteille deja en stock — ouverture de la fiche`;
      }
    }

    // Nouveau scan : pre-remplit tous les champs detectes
    // Priorite numeroSerie : GS1 AI 21 (serial bouteille standard) > Claude OCR > codeBarre fallback
    const gs1Serial = data.gs1Decoded?.serial ?? null;
    if (data.codeBarre) {
      setCodeBarre(data.codeBarre);
      if (!numeroSerie) {
        setNumeroSerie(gs1Serial || data.numeroSerie || data.codeBarre);
      }
    } else if (data.numeroSerie) {
      setNumeroSerie(data.numeroSerie);
    }
    if (data.marque) setFournisseur(data.marque);
    if (data.fluide && data.fluide !== "melange" && FLUIDES.some((f) => f.code === data.fluide)) {
      handleFluideChange(data.fluide);
    } else if (data.fluide === "melange") {
      setFluideMix(true);
    }
    if (typeof data.capaciteMaxKg === "number" && data.capaciteMaxKg > 0) {
      setCapaciteMaxKg(String(data.capaciteMaxKg));
      // Si recharge et pas de charge initiale custom, on suppose pleine
      if (type === "recharge" && !chargeInitialeKg) {
        setChargeInitialeKg(String(data.capaciteMaxKg));
      }
    }
    if (typeof data.tareKg === "number" && data.tareKg > 0) {
      setTareKg(String(data.tareKg));
    }
    if (data.type) {
      handleTypeChange(data.type);
    }

    // Enrichissement GS1 : si le codeBarre est decode, on exploite les AIs
    // pour pre-remplir des champs additionnels que Claude n'aurait pas vus.
    if (data.gs1Decoded) {
      const gs1 = data.gs1Decoded;
      // Poids net GS1 (AI 3103) = charge fluide actuelle de la bouteille
      // Si Claude n'a pas detecte de capacite/charge mais GS1 a le poids net,
      // on l'utilise comme charge initiale (= ce que contient la bouteille a reception).
      if (typeof gs1.poidsNetKg === "number" && gs1.poidsNetKg > 0 && !chargeInitialeKg) {
        setChargeInitialeKg(String(gs1.poidsNetKg));
      }
      // Date d'embouteillage (GS1 AI 11 OU heuristique YYMMDD sur code proprietaire Linde Sentry)
      // -> pre-remplit dateAchat comme bon proxy si pas deja modifie
      const dateGS1 = gs1.dateProductionISO || gs1.dateProbableISO;
      if (dateGS1) {
        setDateAchat(dateGS1);
      }
    }

    // Message de succes recapitulatif
    const fields: string[] = [];
    if (data.codeBarre) fields.push(`code ${data.codeBarre}`);
    if (data.marque) fields.push(data.marque);
    if (data.fluide) fields.push(data.fluide);
    if (typeof data.capaciteMaxKg === "number" && data.capaciteMaxKg > 0) {
      fields.push(`${data.capaciteMaxKg} kg`);
    }
    // GS1 bonus : si parser a tire de l'info structuree du codeBarre, on l'affiche
    if (data.gs1Decoded?.format === "gs1-standard") {
      fields.push(`GTIN valide`);
      if (data.gs1Decoded.lot) fields.push(`lot ${data.gs1Decoded.lot}`);
      if (data.gs1Decoded.poidsNetKg) fields.push(`${data.gs1Decoded.poidsNetKg} kg net`);
    } else if (data.gs1Decoded?.format === "proprietary" && data.gs1Decoded.dateProbableISO) {
      fields.push(`embouteillage ${data.gs1Decoded.dateProbableISO}`);
    }
    if (fields.length === 0) {
      return `❌ Rien detecte sur la photo — reessaie ou saisis a la main`;
    }

    // Detection "photo trop centree" : Claude le signale dans notes quand il
    // n'a vu que le sticker code-barres. On affiche le hint pour que l'utilisateur
    // refasse une 2e photo plus large s'il veut les bonus champs.
    const photoTooClose =
      data.notes &&
      /photo trop centr|prends une photo|montre toute la bouteille|vise plus large/i.test(data.notes);

    const confianceTag =
      data.confiance === "haute" ? "" : ` (confiance ${data.confiance})`;
    const baseMsg = `✅ Detecte${confianceTag} : ${fields.join(" · ")}`;

    // Badge memoire collective : si la bouteille a deja ete scannee par
    // d'autres pros Vertxia, on l'affiche pour donner confiance dans le
    // pre-remplissage et matérialiser l'effet réseau.
    const collectiveSuffix =
      (data.nombreScansPartage ?? 0) >= 2
        ? `\n📚 Bouteille verifiee par ${data.nombreScansPartage} pros Vertxia — donnees fiables`
        : data.nombreScansPartage === 1
          ? "\n📚 Premiere fois que cette bouteille est ajoutee au catalogue Vertxia"
          : "";

    if (photoTooClose) {
      return `${baseMsg}${collectiveSuffix}\n💡 Refais une photo qui montre TOUTE la bouteille (corps + etiquette + sticker) pour que l'IA detecte aussi le fluide, la capacite et la tare.`;
    }

    const missing: string[] = [];
    if (!data.fluide) missing.push("fluide");
    if (!data.capaciteMaxKg) missing.push("capacite");
    if (!data.tareKg) missing.push("tare");
    if (missing.length > 0) {
      return `${baseMsg}${collectiveSuffix}\n💡 Manque ${missing.join(" / ")} : refais une photo avec l'etiquette principale visible, OU complete a la main ci-dessous.`;
    }

    return `${baseMsg}${collectiveSuffix}\nCompletez les champs manquants ci-dessous.`;
  }

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
        codeBarre: codeBarre.trim() || undefined,
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

      // Mémoire collective : si on a un code-barres, enrichit le catalogue
      // partagé Vertxia pour aider tous les autres pros à pré-remplir cette
      // bouteille au prochain scan. Fire-and-forget : pas d'await pour ne
      // pas bloquer la redirection. Si l'upsert échoue (offline, RLS), tant pis.
      if (codeBarre.trim()) {
        fetch("/api/catalog/bouteille/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            codeBarre: codeBarre.trim(),
            marque: fournisseur.trim() || null,
            fluideCode: fluideMix ? "melange" : fluideCode,
            capaciteMaxKg: capacite,
            tareKg: tare,
            typeBouteille: type,
            dateEmbouteillageISO: dateAchat || null,
          }),
        }).catch((e) => {
          console.warn("[bouteille] catalog upsert failed:", e);
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

      {/* CTA scan bouteille IA — photo + Claude Vision lit le code-barres ET
          enrichit avec marque/fluide/capacite/n.serie en bonus. Si codeBarre
          deja en base : redirect direct vers la fiche existante. */}
      <div className="px-4 pt-2 pb-1">
        <ScanBouteilleButton
          onScanned={() => {}}
          successMessageFn={handleScanDetect}
          disabled={saving}
        />
      </div>

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
        footer="N° d'identification ESP transportable gravé sur la bouteille (obligatoire pour le registre). Le code-barres est optionnel mais utile pour retrouver la bouteille au scan."
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
        <FormRow label="Code-barres (optionnel)">
          <input
            type="text"
            value={codeBarre}
            onChange={(e) => setCodeBarre(e.target.value)}
            placeholder="Scanné ou saisi à la main"
            className="input-mobile font-mono"
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
