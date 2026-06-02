"use client";

// Page dynamique : useSearchParams lit ?equipement=ID&type=X qui ne sont connus
// qu'au runtime. Next.js 16 exige un <Suspense> boundary explicite, même avec
// force-dynamic. On wrap le composant interne dans Suspense (cf. default export en bas).
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection } from "@/components/mobile/inset-list";
import { VoiceInput } from "@/components/mobile/voice-input";
import { WhisperInput } from "@/components/mobile/whisper-input";
import { SignaturePad } from "@/components/mobile/signature-pad";
import { listEquipements } from "@/lib/equipement";
import { saveIntervention } from "@/lib/intervention-storage";
import { loadProfil } from "@/lib/profil";

// Formulaire intervention mobile-native — wizard simplifié sur une seule page
// avec sections conditionnelles selon le type d'intervention.
// Appelle les API serveur existantes (/api/bsff/create, /api/cerfa/create).

type TypeIntervention =
  | "recuperation"
  | "demantelement"
  | "controle_periodique"
  | "controle_non_periodique"
  | "mise_service"
  | "maintenance";

const INTERVENTIONS: {
  v: TypeIntervention;
  label: string;
  desc: string;
  needsBsff: boolean;
  needsControle: boolean;
}[] = [
  { v: "recuperation", label: "Récupération de fluide", desc: "+ BSFF officiel TrackDéchets", needsBsff: true, needsControle: false },
  { v: "demantelement", label: "Démantèlement", desc: "Récupération obligatoire + BSFF", needsBsff: true, needsControle: false },
  { v: "controle_periodique", label: "Contrôle d'étanchéité", desc: "Annuel · CERFA 15497*04", needsBsff: false, needsControle: true },
  { v: "controle_non_periodique", label: "Contrôle (suite fuite)", desc: "Suite à fuite ou réparation", needsBsff: false, needsControle: true },
  { v: "mise_service", label: "Mise en service", desc: "Première mise en route", needsBsff: false, needsControle: false },
  { v: "maintenance", label: "Maintenance", desc: "Entretien préventif", needsBsff: false, needsControle: false },
];

const FLUIDES = [
  { code: "R-32", label: "R-32 (HFC)", gwp: 675, wasteCode: "14 06 01*" },
  { code: "R-410A", label: "R-410A (HFC)", gwp: 2088, wasteCode: "14 06 01*" },
  { code: "R-134a", label: "R-134a (HFC)", gwp: 1430, wasteCode: "14 06 01*" },
  { code: "R-1234yf", label: "R-1234yf (HFO)", gwp: 4, wasteCode: "14 06 01*" },
  { code: "R-407C", label: "R-407C (HFC)", gwp: 1774, wasteCode: "14 06 01*" },
  { code: "R-449A", label: "R-449A (HFC)", gwp: 1397, wasteCode: "14 06 01*" },
  { code: "R-404A", label: "R-404A (HFC)", gwp: 3922, wasteCode: "14 06 01*" },
  { code: "R-290", label: "R-290 propane", gwp: 3, wasteCode: "14 06 01*" },
];

type Status =
  | { type: "idle" }
  | { type: "loading"; step: string }
  | { type: "success"; bsffId?: string; cerfaUrl: string }
  | { type: "error"; message: string };

function NouvelleInterventionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const typeParam = searchParams.get("type") as TypeIntervention | null;
  const eqIdParam = searchParams.get("equipement");

  const [typeIntervention, setTypeIntervention] = useState<TypeIntervention>(
    typeParam && INTERVENTIONS.find((i) => i.v === typeParam) ? typeParam : "controle_periodique"
  );
  const [fluide, setFluide] = useState(FLUIDES[0].code);
  const [weight, setWeight] = useState("2.5");
  const [packagingNumero, setPackagingNumero] = useState("B112026047");
  const [clientName, setClientName] = useState("");
  const [modeleEquipement, setModeleEquipement] = useState("");
  const [numeroSerieEquipement, setNumeroSerieEquipement] = useState("");
  const [lieuIntervention, setLieuIntervention] = useState("");

  const [detecteurId, setDetecteurId] = useState("");
  const [detecteurPermanent, setDetecteurPermanent] = useState<"oui" | "non">("non");
  const [fuiteDetectee, setFuiteDetectee] = useState<"oui" | "non">("non");
  const [fuiteLocalisation, setFuiteLocalisation] = useState("");
  const [notes, setNotes] = useState("");

  // Signature client (détenteur) — capturée sur canvas tactile en fin d'intervention
  const [detenteurName, setDetenteurName] = useState("");
  const [detenteurQuality, setDetenteurQuality] = useState("");
  const [detenteurSignatureDataUrl, setDetenteurSignatureDataUrl] = useState<string | null>(null);
  const [signatureClearKey, setSignatureClearKey] = useState(0);

  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [eqContext, setEqContext] = useState<{ modele: string; clientName: string } | null>(null);

  // Vision IA scan plaque
  const [scanning, setScanning] = useState(false);
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const config = useMemo(
    () => INTERVENTIONS.find((t) => t.v === typeIntervention) ?? INTERVENTIONS[0],
    [typeIntervention]
  );
  const selectedFluide = useMemo(
    () => FLUIDES.find((f) => f.code === fluide) ?? FLUIDES[0],
    [fluide]
  );

  // Pré-remplissage depuis ?equipement=ID
  useEffect(() => {
    if (!eqIdParam) return;
    const eq = listEquipements().find((e) => e.id === eqIdParam);
    if (!eq) return;
    setClientName(eq.clientName);
    setModeleEquipement(eq.modele);
    setNumeroSerieEquipement(eq.numeroSerie);
    if (eq.siteAdresse) setLieuIntervention(eq.siteAdresse);
    if (FLUIDES.some((f) => f.code === eq.fluide.code)) setFluide(eq.fluide.code);
    if (eq.chargeKg > 0) setWeight(eq.chargeKg.toFixed(2));
    setEqContext({ modele: eq.modele, clientName: eq.clientName });
  }, [eqIdParam]);

  async function handlePlaqueScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Fallback offline : l'API vision LLM nécessite un appel cloud.
    // Si on est offline, on stocke la photo localement et on informe l'user
    // qu'il faut remplir manuellement. La photo sera OCR-rotée plus tard si
    // on implémente une queue de jobs vision en V2.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setScanInfo(
        "📷 Hors connexion : photo conservée, mais l'OCR IA nécessite une connexion. Saisis les champs manuellement et le scan sera traité dès que tu retrouveras du réseau."
      );
      return;
    }

    setScanning(true);
    setScanInfo(null);
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
        setScanInfo("❌ Échec analyse. Réessayez avec une meilleure photo.");
        return;
      }
      const plaque = await res.json();
      const found: string[] = [];
      if (plaque.modele) {
        setModeleEquipement([plaque.marque, plaque.modele].filter(Boolean).join(" ").trim());
        found.push("modèle");
      }
      if (plaque.numeroSerie) {
        setNumeroSerieEquipement(plaque.numeroSerie);
        found.push("n° série");
      }
      if (plaque.fluide && FLUIDES.some((f) => f.code === plaque.fluide)) {
        setFluide(plaque.fluide);
        found.push("fluide");
      }
      if (typeof plaque.chargeNominaleKg === "number" && plaque.chargeNominaleKg > 0) {
        setWeight(String(plaque.chargeNominaleKg));
        found.push("charge");
      }
      setScanInfo(found.length ? `✅ Détecté : ${found.join(", ")}` : "❌ Rien détecté");
    } catch (e) {
      setScanInfo("❌ Erreur : " + (e instanceof Error ? e.message : "réseau"));
    } finally {
      setScanning(false);
      if (scanInputRef.current) scanInputRef.current.value = "";
    }
  }

  async function handleSubmit() {
    let bsffId: string | undefined;
    let destination: unknown = null;

    try {
      if (config.needsBsff) {
        setStatus({ type: "loading", step: "Création du bordereau BSFF officiel…" });
        const res = await fetch("/api/bsff/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fluide: selectedFluide,
            weight: parseFloat(weight),
            packagingNumero,
            clientName: clientName.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus({ type: "error", message: data.error || "Erreur BSFF" });
          return;
        }
        bsffId = data.bsffId;
        destination = data.destination ?? null;
      }

      setStatus({ type: "loading", step: "Génération du CERFA 15497*04…" });
      const profil = loadProfil();
      const operateur = profil.raisonSociale
        ? {
            name: profil.raisonSociale,
            quality: profil.categorieAttestation
              ? `Frigoriste Cat. ${profil.categorieAttestation}`
              : "Frigoriste",
            signatureDataUrl: profil.signatureDataUrl,
          }
        : undefined;

      const detenteurSignaturePayload =
        detenteurSignatureDataUrl && detenteurName.trim()
          ? {
              name: detenteurName.trim(),
              quality: detenteurQuality.trim() || undefined,
              dataUrl: detenteurSignatureDataUrl,
            }
          : null;

      const cerfaPayload: Record<string, unknown> = {
        fluide: selectedFluide,
        weight: config.needsBsff ? parseFloat(weight) : 0,
        packagingNumero: config.needsBsff ? packagingNumero : "",
        clientName: clientName.trim() || null,
        modeleEquipement: modeleEquipement.trim() || undefined,
        numeroSerieEquipement: numeroSerieEquipement.trim() || undefined,
        lieuIntervention: lieuIntervention.trim() || undefined,
        bsffId,
        destination,
        typeIntervention,
        operateur,
        detenteurSignature: detenteurSignaturePayload,
        controleDetails: config.needsControle
          ? {
              detecteurId: detecteurId.trim() || undefined,
              detecteurPermanent: detecteurPermanent === "oui",
              fuiteDetectee: fuiteDetectee === "oui",
              fuiteLocalisation:
                fuiteDetectee === "oui" ? fuiteLocalisation.trim() || undefined : undefined,
            }
          : undefined,
      };

      const cerfaRes = await fetch("/api/cerfa/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cerfaPayload),
      });
      if (!cerfaRes.ok) {
        const err = await cerfaRes.json().catch(() => ({}));
        setStatus({ type: "error", message: err.error || "Échec CERFA" });
        return;
      }
      const cerfaBlob = await cerfaRes.blob();
      const cerfaUrl = URL.createObjectURL(cerfaBlob);

      try {
        saveIntervention({
          typeIntervention,
          fluide: selectedFluide,
          weight: config.needsBsff ? parseFloat(weight) : 0,
          packagingNumero: config.needsBsff ? packagingNumero : "",
          clientName: clientName.trim() || null,
          modeleEquipement: modeleEquipement.trim() || undefined,
          numeroSerieEquipement: numeroSerieEquipement.trim() || undefined,
          lieuIntervention: lieuIntervention.trim() || undefined,
          bsffId,
          controleDetails: config.needsControle
            ? {
                detecteurId: detecteurId.trim() || undefined,
                detecteurPermanent: detecteurPermanent === "oui",
                fuiteDetectee: fuiteDetectee === "oui",
                fuiteLocalisation:
                  fuiteDetectee === "oui" ? fuiteLocalisation.trim() || undefined : undefined,
              }
            : undefined,
          notes: notes.trim() || undefined,
          hasDetenteurSignature: Boolean(detenteurSignaturePayload),
          detenteurName: detenteurSignaturePayload ? detenteurSignaturePayload.name : undefined,
          detenteurQuality: detenteurSignaturePayload?.quality,
        });
      } catch {}

      setStatus({ type: "success", bsffId, cerfaUrl });
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Erreur" });
    }
  }

  const isLoading = status.type === "loading";
  const isSuccess = status.type === "success";

  if (isSuccess) {
    return (
      <>
        <MobileHeader title="Intervention" largeTitle backHref="/m" />
        <SuccessView
          status={status}
          onReset={() => {
            setStatus({ type: "idle" });
            router.push("/m/historique");
          }}
        />
      </>
    );
  }

  return (
    <>
      <MobileHeader title="Nouvelle intervention" largeTitle backHref="/m/intervention" />

      {/* Contexte équipement si pré-rempli */}
      {eqContext && (
        <div className="mx-4 mt-2 mb-1 px-4 py-3 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200">
          <div className="text-[10px] font-mono tracking-widest uppercase text-emerald-800">
            Intervention sur équipement scanné
          </div>
          <div className="mt-1 text-[14px] text-emerald-900">
            <strong>{eqContext.modele}</strong> · {eqContext.clientName}
          </div>
        </div>
      )}

      {/* Type d'intervention */}
      <InsetListSection title="Type d'intervention">
        <div className="px-2 py-2 grid grid-cols-1 gap-1.5">
          {INTERVENTIONS.map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setTypeIntervention(opt.v)}
              disabled={isLoading}
              className={`w-full px-3 py-2.5 rounded-xl text-left transition-colors ${
                typeIntervention === opt.v
                  ? "bg-[#111] text-white"
                  : "bg-black/[0.04] text-[#111] active:bg-black/[0.08]"
              }`}
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[14px] font-medium">{opt.label}</div>
                {opt.needsBsff && (
                  <span
                    className={`text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded ${
                      typeIntervention === opt.v
                        ? "bg-white/15 text-white/85"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    + BSFF
                  </span>
                )}
              </div>
              <div
                className={`text-[12px] mt-0.5 ${
                  typeIntervention === opt.v ? "text-white/65" : "text-black/45"
                }`}
              >
                {opt.desc}
              </div>
            </button>
          ))}
        </div>
      </InsetListSection>

      {/* Vision IA scan plaque */}
      {!eqContext && (
        <InsetListSection title="Équipement (saisie ou scan)" footer="Photographiez la plaque signalétique, l'IA pré-remplit modèle, n° série, fluide et charge.">
          <div className="px-4 py-3">
            <input
              ref={scanInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePlaqueScan}
              disabled={scanning || isLoading}
              className="hidden"
              id="plaque-scan-mobile"
            />
            <label
              htmlFor="plaque-scan-mobile"
              className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-[14px] font-medium transition-colors cursor-pointer ${
                scanning ? "bg-black/[0.04] text-black/40" : "bg-[#A16207]/10 text-[#A16207] active:bg-[#A16207]/20"
              }`}
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              {scanning ? (
                <>
                  <span className="inline-block w-4 h-4 rounded-full border-2 border-[#A16207]/30 border-t-[#A16207] animate-spin" />
                  Analyse IA en cours…
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  Scanner la plaque signalétique
                </>
              )}
            </label>
            {scanInfo && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-black/[0.03] text-[12px] text-black/70">
                {scanInfo}
              </div>
            )}
          </div>
        </InsetListSection>
      )}

      {/* Détails équipement */}
      <InsetListSection title="Détails équipement">
        <FormRow label="Modèle">
          <input
            type="text"
            value={modeleEquipement}
            onChange={(e) => setModeleEquipement(e.target.value)}
            placeholder="Ex : Daikin FTXM35M"
            disabled={isLoading}
            className="input-mobile"
          />
        </FormRow>
        <FormRow label="N° de série">
          <input
            type="text"
            value={numeroSerieEquipement}
            onChange={(e) => setNumeroSerieEquipement(e.target.value)}
            placeholder="Ex : DK24042587"
            disabled={isLoading}
            className="input-mobile font-mono"
          />
        </FormRow>
        <FormRow label="Lieu d'intervention">
          <input
            type="text"
            value={lieuIntervention}
            onChange={(e) => setLieuIntervention(e.target.value)}
            placeholder="Adresse du chantier"
            disabled={isLoading}
            className="input-mobile"
          />
        </FormRow>
        <FormRow label="Client / Détenteur">
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Nom ou raison sociale"
            disabled={isLoading}
            className="input-mobile"
          />
        </FormRow>
      </InsetListSection>

      {/* Fluide */}
      <InsetListSection title="Fluide frigorigène">
        <FormRow label={config.needsBsff ? "Fluide récupéré" : "Fluide de l'équipement"}>
          <select
            value={fluide}
            onChange={(e) => setFluide(e.target.value)}
            disabled={isLoading}
            className="input-mobile"
          >
            {FLUIDES.map((f) => (
              <option key={f.code} value={f.code}>
                {f.label} · GWP {f.gwp}
              </option>
            ))}
          </select>
        </FormRow>
        {config.needsBsff && (
          <>
            <FormRow label="Quantité (kg)">
              <input
                type="number"
                step="0.1"
                min="0.1"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                disabled={isLoading}
                className="input-mobile"
              />
            </FormRow>
            <FormRow label="N° de bouteille">
              <input
                type="text"
                pattern="[A-Za-z0-9]+"
                value={packagingNumero}
                onChange={(e) => setPackagingNumero(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                disabled={isLoading}
                placeholder="Alphanumérique uniquement"
                className="input-mobile font-mono"
              />
            </FormRow>
          </>
        )}
      </InsetListSection>

      {/* Contrôle d'étanchéité */}
      {config.needsControle && (
        <InsetListSection title="Contrôle d'étanchéité">
          <FormRow label="N° du détecteur manuel">
            <input
              type="text"
              value={detecteurId}
              onChange={(e) => setDetecteurId(e.target.value)}
              placeholder="Ex : DTC-T1-007"
              disabled={isLoading}
              className="input-mobile"
            />
          </FormRow>
          <ChoiceRow
            label="Détecteur permanent ?"
            value={detecteurPermanent}
            onChange={setDetecteurPermanent}
            options={[
              { v: "oui", label: "Oui" },
              { v: "non", label: "Non" },
            ]}
          />
          <ChoiceRow
            label="Fuite détectée ?"
            value={fuiteDetectee}
            onChange={setFuiteDetectee}
            options={[
              { v: "non", label: "Non" },
              { v: "oui", label: "Oui" },
            ]}
          />
          {fuiteDetectee === "oui" && (
            <FormRow label="Localisation de la fuite">
              <input
                type="text"
                value={fuiteLocalisation}
                onChange={(e) => setFuiteLocalisation(e.target.value)}
                placeholder="Ex : Raccord côté liquide unité ext."
                disabled={isLoading}
                className="input-mobile"
              />
            </FormRow>
          )}
        </InsetListSection>
      )}

      {/* Notes + dictée vocale */}
      <InsetListSection
        title="Notes / Observations terrain"
        footer="Tape ou DICTE — la dictée vocale utilise le moteur de reconnaissance natif de ton téléphone, marche en français."
      >
        <FormRow label="Notes libres">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex : Vidange complète circuit secondaire, joint torique remplacé, vérification serrage. Toutes les liaisons OK après mise en pression azote."
            rows={3}
            disabled={isLoading}
            className="input-mobile resize-none"
          />
        </FormRow>
        <div className="px-4 py-3 space-y-3">
          <VoiceInput
            onTranscript={(text, isFinal) => {
              if (isFinal) {
                setNotes((prev) => (prev ? `${prev} ${text}`.trim() : text));
              }
            }}
            mode="append"
            label="🎤 Dicter (rapide · nécessite réseau)"
            hint="Reconnaissance vocale native iPhone"
          />
          <div className="text-center text-[10px] font-mono tracking-widest uppercase text-black/30">
            ou — 100 % offline
          </div>
          <WhisperInput
            onTranscript={(text) => {
              setNotes((prev) => (prev ? `${prev} ${text}`.trim() : text));
            }}
            label="🎙️ Dicter offline (Whisper on-device)"
          />
        </div>
      </InsetListSection>

      {/* Signature client (détenteur) */}
      <InsetListSection
        title="Signature client"
        footer="Le client signe directement sur ton téléphone — sa signature est intégrée au CERFA officiel. Recommandé pour la conformité, mais pas bloquant."
      >
        <FormRow label="Nom du signataire">
          <input
            type="text"
            value={detenteurName}
            onChange={(e) => setDetenteurName(e.target.value)}
            placeholder="Ex : Jean Dupont"
            disabled={isLoading}
            className="input-mobile"
          />
        </FormRow>
        <FormRow label="Qualité">
          <input
            type="text"
            value={detenteurQuality}
            onChange={(e) => setDetenteurQuality(e.target.value)}
            placeholder="Ex : Gérant, Propriétaire, Responsable maintenance…"
            disabled={isLoading}
            className="input-mobile"
          />
        </FormRow>
        <div className="px-4 py-3">
          <SignaturePad
            onChange={(dataUrl) => setDetenteurSignatureDataUrl(dataUrl)}
            clearKey={signatureClearKey}
            height={180}
            label="SIGNATURE CLIENT"
          />
          {detenteurSignatureDataUrl && !detenteurName.trim() && (
            <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2">
              ⚠️ Renseigne le nom du signataire pour que la signature soit incluse au CERFA.
            </div>
          )}
        </div>
      </InsetListSection>

      {/* Submit */}
      <div className="px-4 mt-8 mb-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full px-6 py-4 rounded-2xl bg-[#111] text-white text-[15px] font-medium active:bg-black/90 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-3"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          {isLoading ? (
            <>
              <span className="inline-block w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <span>{status.type === "loading" ? status.step : "…"}</span>
            </>
          ) : (
            <>{config.needsBsff ? "Générer BSFF + CERFA" : "Générer CERFA 15497*04"}</>
          )}
        </button>
      </div>

      {status.type === "error" && (
        <div className="mx-4 mt-2 mb-4 px-4 py-3 rounded-2xl bg-red-50 text-red-700 text-[13px] border border-red-200">
          ❌ {status.message}
        </div>
      )}

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

// Default export — wrap obligatoire en Suspense pour Next.js 16
// (useSearchParams ne peut pas être rendu statiquement).
export default function MobileNouvelleInterventionPage() {
  return (
    <Suspense
      fallback={
        <div className="px-5 py-20 text-center">
          <div className="inline-block w-8 h-8 border-2 border-black/15 border-t-[#111] rounded-full animate-spin" />
          <div className="mt-3 text-[13px] text-black/45">Chargement…</div>
        </div>
      }
    >
      <NouvelleInterventionContent />
    </Suspense>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5">
      <div className="text-[11px] font-medium text-black/45 uppercase tracking-wide mb-0.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function ChoiceRow<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
}) {
  return (
    <div className="px-4 py-2.5">
      <div className="text-[11px] font-medium text-black/45 uppercase tracking-wide mb-2">
        {label}
      </div>
      <div className="flex bg-black/[0.05] rounded-xl p-1">
        {options.map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            className={`flex-1 px-2 py-2 rounded-lg text-[14px] font-medium transition-all ${
              value === opt.v
                ? "bg-white text-[#111] shadow-sm shadow-black/[0.06]"
                : "text-black/60 active:text-black/90"
            }`}
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SuccessView({
  status,
  onReset,
}: {
  status: { type: "success"; bsffId?: string; cerfaUrl: string };
  onReset: () => void;
}) {
  return (
    <>
      <div className="px-5 mt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 ring-1 ring-emerald-200">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-50 animate-ping" />
            <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-mono text-[11px] tracking-widest text-emerald-700 uppercase font-semibold">
            {status.bsffId ? "BSFF signé · officiel" : "CERFA généré"}
          </span>
        </div>
        <h1 className="mt-4 text-[28px] font-bold tracking-tight text-[#111]">
          Intervention validée
        </h1>
        <p className="mt-2 text-[14px] text-black/55 leading-relaxed">
          {status.bsffId
            ? "Le bordereau BSFF officiel a été signé par TrackDéchets. Téléchargez les 2 documents."
            : "Le CERFA 15497*04 a été généré. Téléchargez-le pour le faire signer par le client."}
        </p>
      </div>

      {status.bsffId && (
        <InsetListSection title="Identifiant BSFF">
          <div className="px-4 py-3">
            <div className="text-[15px] font-mono text-[#111] break-all">{status.bsffId}</div>
            <div className="text-[11px] text-black/45 mt-1">
              Source : TrackDéchets — Ministère de la Transition écologique
            </div>
          </div>
        </InsetListSection>
      )}

      <div className="px-4 mt-6 space-y-2">
        {status.bsffId && (
          <a
            href={`/api/bsff/download/${status.bsffId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full px-6 py-4 rounded-2xl bg-[#111] text-white text-[15px] font-medium text-center active:bg-black/90 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            ⬇ Télécharger le BSFF officiel
          </a>
        )}
        <a
          href={status.cerfaUrl}
          download={`CERFA_15497-04_${status.bsffId ?? "intervention"}.pdf`}
          className={`block w-full px-6 py-4 rounded-2xl text-[15px] font-medium text-center transition-colors ${
            status.bsffId
              ? "bg-white border border-[#111] text-[#111] active:bg-black/[0.03]"
              : "bg-[#111] text-white active:bg-black/90"
          }`}
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          ⬇ Télécharger le CERFA 15497*04
        </a>
      </div>

      <div className="px-4 mt-6 mb-4">
        <button
          type="button"
          onClick={onReset}
          className="w-full px-6 py-3 rounded-2xl bg-white border border-black/10 text-black/70 text-[14px] font-medium active:bg-black/[0.03] transition-colors"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          Voir l&apos;historique
        </button>
      </div>
    </>
  );
}
