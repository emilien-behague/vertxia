"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import SignatureCanvas from "react-signature-canvas";
import { saveIntervention } from "@/lib/intervention/intervention-storage";
import { loadProfil } from "@/lib/profil";
import { listEquipements } from "@/lib/equipement/equipement";

type Fluide = {
  code: string;
  label: string;
  gwp: number;
  wasteCode: string;
};

const FLUIDES: Fluide[] = [
  { code: "R-32", label: "R-32 (clim split, PAC air-air récents)", gwp: 675, wasteCode: "14 06 01*" },
  { code: "R-410A", label: "R-410A (clim split, PAC anciennes)", gwp: 2088, wasteCode: "14 06 01*" },
  { code: "R-134a", label: "R-134a (froid commercial, auto)", gwp: 1430, wasteCode: "14 06 01*" },
  { code: "R-1234yf", label: "R-1234yf (climatisation auto récente)", gwp: 4, wasteCode: "14 06 01*" },
  { code: "R-407C", label: "R-407C (PAC, clim tertiaire)", gwp: 1774, wasteCode: "14 06 01*" },
  { code: "R-449A", label: "R-449A (froid commercial, supermarchés)", gwp: 1397, wasteCode: "14 06 01*" },
  { code: "R-290", label: "R-290 propane (PAC neuves, faible GWP)", gwp: 3, wasteCode: "14 06 01*" },
];

type Status =
  | { type: "idle" }
  | { type: "loading"; step: string }
  | {
      type: "success";
      // BSFF facultatif : si l'intervention ne nécessite pas de récupération
      // (contrôle d'étanchéité, mise en service, maintenance), pas de bordereau.
      bsffId?: string;
      pdfUrl?: string;
      signedAt?: string;
      cerfaUrl: string;
    }
  | { type: "error"; message: string };

type TypeIntervention =
  | "recuperation"
  | "demantelement"
  | "controle_periodique"
  | "controle_non_periodique"
  | "mise_service"
  | "maintenance";

type InterventionConfig = {
  v: TypeIntervention;
  label: string;
  desc: string;
  needsBsff: boolean;     // doit créer un BSFF TrackDéchets (récup de fluide)
  needsControle: boolean; // doit remplir les sections 5-10 du CERFA
};

const INTERVENTIONS: InterventionConfig[] = [
  { v: "recuperation", label: "Récupération de fluide", desc: "Transfert vers contenant agréé + BSFF officiel", needsBsff: true, needsControle: false },
  { v: "demantelement", label: "Démantèlement", desc: "Récupération obligatoire + BSFF", needsBsff: true, needsControle: false },
  { v: "controle_periodique", label: "Contrôle d'étanchéité périodique", desc: "Annuel · selon palier t éq. CO2", needsBsff: false, needsControle: true },
  { v: "controle_non_periodique", label: "Contrôle non périodique", desc: "Suite à fuite signalée ou réparation", needsBsff: false, needsControle: true },
  { v: "mise_service", label: "Mise en service", desc: "Première mise en route de l'équipement", needsBsff: false, needsControle: false },
  { v: "maintenance", label: "Maintenance", desc: "Entretien préventif sans manipulation", needsBsff: false, needsControle: false },
];

export default function BsffPage() {
  const [fluide, setFluide] = useState(FLUIDES[0].code);
  const [weight, setWeight] = useState("2.5");
  const [packagingNumero, setPackagingNumero] = useState("B112026047");
  const [clientName, setClientName] = useState("");
  const [modeleEquipement, setModeleEquipement] = useState("Daikin FTXM35M");
  const [numeroSerieEquipement, setNumeroSerieEquipement] = useState("DK2024042587");
  const [attestation, setAttestation] = useState("");
  const [lieuIntervention, setLieuIntervention] = useState("");

  // Pré-remplissage depuis ?equipement=<id> — navigation depuis /equipements
  // pour démarrer une intervention sur un équipement déjà au parc.
  const [equipementContext, setEquipementContext] = useState<{
    modele: string;
    clientName: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const eqId = params.get("equipement");
    if (!eqId) return;
    const eq = listEquipements().find((e) => e.id === eqId);
    if (!eq) return;
    setClientName(eq.clientName);
    setModeleEquipement(eq.modele);
    setNumeroSerieEquipement(eq.numeroSerie);
    if (eq.siteAdresse) setLieuIntervention(eq.siteAdresse);
    // Match fluide par code dans la liste FLUIDES connue, sinon garde le défaut.
    if (FLUIDES.some((f) => f.code === eq.fluide.code)) {
      setFluide(eq.fluide.code);
    }
    // Pour récup : on suggère la charge nominale comme quantité par défaut.
    // L'opérateur peut la modifier (récup partielle, par exemple).
    if (eq.chargeKg > 0) {
      setWeight(eq.chargeKg.toFixed(2));
    }
    setEquipementContext({ modele: eq.modele, clientName: eq.clientName });
  }, []);

  // Wizard "Type d'intervention" — débloque les sections 5-10 du CERFA.
  const [typeIntervention, setTypeIntervention] = useState<TypeIntervention>("recuperation");
  const [detecteurId, setDetecteurId] = useState("");
  const [detecteurPermanent, setDetecteurPermanent] = useState<"oui" | "non">("non");
  const [fuiteDetectee, setFuiteDetectee] = useState<"oui" | "non">("non");
  const [fuiteLocalisation, setFuiteLocalisation] = useState("");
  const [fuiteReparee, setFuiteReparee] = useState<"realisee" | "a_faire">("realisee");

  const [status, setStatus] = useState<Status>({ type: "idle" });
  const config = INTERVENTIONS.find(t => t.v === typeIntervention) ?? INTERVENTIONS[0];
  const needsBsff = config.needsBsff;
  const aFaitControle = config.needsControle;

  // Approche C — Modale signature détenteur
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [detenteurName, setDetenteurName] = useState("");
  const [detenteurQuality, setDetenteurQuality] = useState("");
  const [sigError, setSigError] = useState<string | null>(null);
  const [sigLoading, setSigLoading] = useState(false);
  const sigRef = useRef<SignatureCanvas | null>(null);
  // Payload CERFA mémorisé pour pouvoir re-générer après signature
  const [lastCerfaPayload, setLastCerfaPayload] = useState<Record<string, unknown> | null>(null);
  const [rapportLoading, setRapportLoading] = useState(false);
  const [rapportError, setRapportError] = useState<string | null>(null);

  // Portal mount : la modale signature est rendue dans document.body pour
  // échapper aux stacking contexts créés par framer-motion sur les parents.
  const [portalMounted, setPortalMounted] = useState(false);
  useEffect(() => { setPortalMounted(true); }, []);

  // Vision IA — scan de plaque signalétique
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  function fluideExists(code: string | null): boolean {
    if (!code) return false;
    return FLUIDES.some(f => f.code === code);
  }

  async function handleDownloadRapport() {
    if (!lastCerfaPayload) {
      setRapportError("Pas de payload d'intervention disponible. Génère d'abord BSFF + CERFA.");
      return;
    }
    setRapportLoading(true);
    setRapportError(null);
    try {
      const profil = loadProfil();
      if (!profil.raisonSociale) {
        setRapportError(
          "Profil entreprise vide. Renseigne ta raison sociale + adresse sur /profil d'abord."
        );
        setRapportLoading(false);
        return;
      }
      const payload = { ...lastCerfaPayload, profil };
      const res = await fetch("/api/rapport/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setRapportError(err.error || `Échec génération rapport (${res.status})`);
        setRapportLoading(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Rapport_intervention_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setRapportError(err instanceof Error ? err.message : String(err));
    } finally {
      setRapportLoading(false);
    }
  }

  async function handlePlaqueScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanError(null);
    setScanInfo(null);

    try {
      // Conversion fichier → dataURL base64
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Lecture du fichier échouée."));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/vision/plaque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setScanError(errJson.error || `Échec analyse (${res.status})`);
        return;
      }

      const plaque = await res.json();
      const detected: string[] = [];

      // Pré-remplissage des champs
      if (plaque.modele) {
        const m = [plaque.marque, plaque.modele].filter(Boolean).join(" ").trim();
        setModeleEquipement(m);
        detected.push(`modèle "${m}"`);
      }
      if (plaque.numeroSerie) {
        setNumeroSerieEquipement(plaque.numeroSerie);
        detected.push(`n° série "${plaque.numeroSerie}"`);
      }
      if (fluideExists(plaque.fluide)) {
        setFluide(plaque.fluide);
        detected.push(`fluide ${plaque.fluide}`);
      }
      if (typeof plaque.chargeNominaleKg === "number" && plaque.chargeNominaleKg > 0) {
        setWeight(String(plaque.chargeNominaleKg));
        detected.push(`charge ${plaque.chargeNominaleKg} kg`);
      }

      if (detected.length === 0) {
        setScanError("Aucune info extraite de la plaque. Vérifie la qualité de la photo (cadrage, lumière, netteté).");
      } else {
        setScanInfo(
          `Détecté : ${detected.join(", ")}. Confiance : ${plaque.confiance ?? "?"}.${
            plaque.notes ? ` ${plaque.notes}` : ""
          }`
        );
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setScanning(false);
      // Reset l'input pour pouvoir re-scanner la même photo si besoin
      if (scanInputRef.current) scanInputRef.current.value = "";
    }
  }

  const selectedFluide = FLUIDES.find(f => f.code === fluide) ?? FLUIDES[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let bsffId: string | undefined;
    let pdfUrl: string | undefined;
    let signedAt: string | undefined;
    let destination: { name: string; siret: string; address: string } | null = null;

    try {
      // ÉTAPE 1 (conditionnelle) — BSFF officiel via TrackDéchets
      // Seulement pour les interventions qui impliquent une récupération de fluide
      // (Récupération pure, Démantèlement). Les contrôles d'étanchéité, la mise en
      // service et la maintenance ne nécessitent pas de BSFF.
      if (needsBsff) {
        setStatus({ type: "loading", step: "Création du bordereau BSFF…" });
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
          setStatus({ type: "error", message: data.error || "Erreur inconnue" });
          return;
        }
        bsffId = data.bsffId;
        pdfUrl = data.pdfUrl;
        signedAt = data.signedAt;
        destination = data.destination ?? null;
      }

      // ÉTAPE 2 — CERFA 15497*04 PDF (toujours généré)
      setStatus({ type: "loading", step: "Génération du CERFA 15497*04…" });

      // Profil entreprise du technicien (depuis localStorage /profil).
      // Si vide → fallback démo "Emilien Behague / Technicien Cat. I" côté serveur.
      const profil = loadProfil();
      const operateur = profil.raisonSociale
        ? {
            name: profil.raisonSociale,
            quality: profil.categorieAttestation
              ? `Technicien Cat. ${profil.categorieAttestation}`
              : "Technicien",
            signatureDataUrl: profil.signatureDataUrl,
          }
        : undefined;

      const cerfaPayload: Record<string, unknown> = {
        fluide: selectedFluide,
        weight: needsBsff ? parseFloat(weight) : 0,
        packagingNumero: needsBsff ? packagingNumero : "",
        clientName: clientName.trim() || null,
        modeleEquipement: modeleEquipement.trim() || undefined,
        numeroSerieEquipement: numeroSerieEquipement.trim() || undefined,
        attestation: attestation.trim() || undefined,
        lieuIntervention: lieuIntervention.trim() || undefined,
        bsffId,
        destination,
        typeIntervention,
        operateur,
        controleDetails: aFaitControle
          ? {
              detecteurId: detecteurId.trim() || undefined,
              detecteurPermanent: detecteurPermanent === "oui",
              fuiteDetectee: fuiteDetectee === "oui",
              fuiteLocalisation:
                fuiteDetectee === "oui" ? fuiteLocalisation.trim() || undefined : undefined,
              fuiteReparee: fuiteDetectee === "oui" ? fuiteReparee : undefined,
            }
          : undefined,
      };
      setLastCerfaPayload(cerfaPayload);
      const cerfaRes = await fetch("/api/cerfa/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cerfaPayload),
      });
      if (!cerfaRes.ok) {
        const errJson = await cerfaRes.json().catch(() => ({}));
        setStatus({
          type: "error",
          message: errJson.error || "Échec génération CERFA",
        });
        return;
      }
      const cerfaBlob = await cerfaRes.blob();
      const cerfaUrl = URL.createObjectURL(cerfaBlob);

      // Sauvegarde locale (page Historique)
      try {
        saveIntervention({
          typeIntervention,
          fluide: selectedFluide,
          weight: needsBsff ? parseFloat(weight) : 0,
          packagingNumero: needsBsff ? packagingNumero : "",
          clientName: clientName.trim() || null,
          modeleEquipement: modeleEquipement.trim() || undefined,
          numeroSerieEquipement: numeroSerieEquipement.trim() || undefined,
          attestation: attestation.trim() || undefined,
          lieuIntervention: lieuIntervention.trim() || undefined,
          bsffId,
          bsffPdfUrl: pdfUrl,
          bsffSignedAt: signedAt,
          destination,
          controleDetails: aFaitControle
            ? {
                detecteurId: detecteurId.trim() || undefined,
                detecteurPermanent: detecteurPermanent === "oui",
                fuiteDetectee: fuiteDetectee === "oui",
                fuiteLocalisation:
                  fuiteDetectee === "oui" ? fuiteLocalisation.trim() || undefined : undefined,
                fuiteReparee: fuiteDetectee === "oui" ? fuiteReparee : undefined,
              }
            : undefined,
        });
      } catch (e) {
        // localStorage indisponible : on continue silencieusement.
        console.warn("[intervention-storage]", e);
      }

      setStatus({
        type: "success",
        bsffId,
        pdfUrl,
        signedAt,
        cerfaUrl,
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Erreur réseau",
      });
    }
  }

  function reset() {
    if (status.type === "success") URL.revokeObjectURL(status.cerfaUrl);
    setStatus({ type: "idle" });
    setPackagingNumero(`B${Math.floor(Math.random() * 1_000_000_000)}`);
    setDetenteurName("");
    setDetenteurQuality("");
    setLastCerfaPayload(null);
    setSigError(null);
  }

  function openSignatureModal() {
    setDetenteurName(clientName);
    setDetenteurQuality("");
    setSigError(null);
    setSigModalOpen(true);
  }

  function closeSignatureModal() {
    setSigModalOpen(false);
    setSigError(null);
    sigRef.current?.clear();
  }

  async function handleSignAndRegenerate() {
    if (!lastCerfaPayload) {
      setSigError("Payload CERFA manquant — regénère le PDF d'abord.");
      return;
    }
    if (!detenteurName.trim()) {
      setSigError("Le nom du détenteur est obligatoire.");
      return;
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setSigError("Le client doit signer sur le canvas avant de valider.");
      return;
    }

    setSigError(null);
    setSigLoading(true);
    try {
      const dataUrl = sigRef.current
        .getCanvas()
        .toDataURL("image/png");

      const signedPayload = {
        ...lastCerfaPayload,
        detenteurSignature: {
          name: detenteurName.trim(),
          quality: detenteurQuality.trim() || undefined,
          dataUrl,
        },
      };

      const res = await fetch("/api/cerfa/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signedPayload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setSigError(errJson.error || "Échec de la régénération du CERFA.");
        setSigLoading(false);
        return;
      }
      const blob = await res.blob();
      const newUrl = URL.createObjectURL(blob);

      // Remplace le blob URL du CERFA dans status (libère l'ancien)
      if (status.type === "success") {
        URL.revokeObjectURL(status.cerfaUrl);
        setStatus({ ...status, cerfaUrl: newUrl });
      }
      setSigModalOpen(false);
      sigRef.current?.clear();
    } catch (err) {
      setSigError(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setSigLoading(false);
    }
  }

  const isLoading = status.type === "loading";
  const isSuccess = status.type === "success";

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#111] font-sans antialiased">
      <div className="max-w-2xl mx-auto px-6 md:px-8 py-12 md:py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12"
        >
          <div className="flex items-center justify-between">
            <a href="/" className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors">
              ← VERTXIA
            </a>
            <a href="/historique" className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors inline-flex items-center gap-2">
              HISTORIQUE
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl font-light leading-[1.05] tracking-tight">
            Nouvelle intervention F-Gas
          </h1>
          <p className="mt-4 text-sm text-black/50 leading-relaxed max-w-md">
            Renseignez l&apos;intervention. Vertxia génère le CERFA 15497*04 pré-rempli, plus le BSFF officiel TrackDéchets si vous récupérez du fluide.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* IDLE / LOADING — Form */}
          {!isSuccess && (
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              {/* Bandeau contextuel si on vient depuis /equipements */}
              {equipementContext && (
                <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-emerald-800 mt-0.5">
                      Intervention sur équipement
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-emerald-900">
                    <strong>{equipementContext.modele}</strong> · chez{" "}
                    <strong>{equipementContext.clientName}</strong>
                    <span className="text-emerald-800/60"> · formulaire pré-rempli</span>
                  </div>
                </div>
              )}

              {/* Wizard — Type d'intervention */}
              <div>
                <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                  Type d&apos;intervention
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {INTERVENTIONS.map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setTypeIntervention(opt.v)}
                      disabled={isLoading}
                      className={`text-left px-4 py-3 rounded-xl border-2 transition-all ${
                        typeIntervention === opt.v
                          ? "border-[#111] bg-[#111] text-white"
                          : "border-black/10 bg-white text-[#111] hover:border-black/30"
                      }`}
                    >
                      <div className="text-sm font-medium flex items-center gap-2">
                        {opt.label}
                        {opt.needsBsff && (
                          <span className={`text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded ${
                            typeIntervention === opt.v ? "bg-white/15 text-white/80" : "bg-emerald-50 text-emerald-700"
                          }`}>
                            + BSFF
                          </span>
                        )}
                      </div>
                      <div className={`text-xs mt-0.5 ${typeIntervention === opt.v ? "text-white/60" : "text-black/40"}`}>
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Détails contrôle d'étanchéité (conditionnel) */}
              <AnimatePresence mode="wait">
                {aFaitControle && (
                  <motion.div
                    key="controle-details"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 pt-2 pb-1 pl-4 border-l-2 border-black/10">
                      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/35 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-black/25" />
                        Détails du contrôle d&apos;étanchéité
                      </div>

                      <div>
                        <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                          N° du détecteur manuel utilisé
                        </label>
                        <input
                          type="text"
                          value={detecteurId}
                          onChange={e => setDetecteurId(e.target.value)}
                          disabled={isLoading}
                          placeholder="Ex: DTC-T1-001"
                          className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-base text-[#111] font-mono focus:outline-none focus:border-black/40 focus:bg-[#fafaf8] transition-all disabled:opacity-50"
                        />
                      </div>

                      <div>
                        <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                          Équipement avec détecteur permanent ?
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["oui", "non"] as const).map(v => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setDetecteurPermanent(v)}
                              disabled={isLoading}
                              className={`px-4 py-2.5 rounded-xl border-2 text-sm font-medium uppercase tracking-wider transition-all ${
                                detecteurPermanent === v
                                  ? "border-[#111] bg-[#111] text-white"
                                  : "border-black/10 bg-white text-[#111] hover:border-black/30"
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                          Fuite détectée ?
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["oui", "non"] as const).map(v => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setFuiteDetectee(v)}
                              disabled={isLoading}
                              className={`px-4 py-2.5 rounded-xl border-2 text-sm font-medium uppercase tracking-wider transition-all ${
                                fuiteDetectee === v
                                  ? "border-[#111] bg-[#111] text-white"
                                  : "border-black/10 bg-white text-[#111] hover:border-black/30"
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>

                      <AnimatePresence mode="wait">
                        {fuiteDetectee === "oui" && (
                          <motion.div
                            key="fuite-details"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden space-y-4"
                          >
                            <div>
                              <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                                Localisation de la fuite
                              </label>
                              <input
                                type="text"
                                value={fuiteLocalisation}
                                onChange={e => setFuiteLocalisation(e.target.value)}
                                disabled={isLoading}
                                placeholder="Ex: Raccord côté liquide unité extérieure"
                                className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-base text-[#111] focus:outline-none focus:border-black/40 focus:bg-[#fafaf8] transition-all disabled:opacity-50"
                              />
                            </div>
                            <div>
                              <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                                Réparation
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                {([
                                  { v: "realisee", label: "Réalisée" },
                                  { v: "a_faire", label: "À faire" },
                                ] as const).map(opt => (
                                  <button
                                    key={opt.v}
                                    type="button"
                                    onClick={() => setFuiteReparee(opt.v)}
                                    disabled={isLoading}
                                    className={`px-4 py-2.5 rounded-xl border-2 text-sm font-medium uppercase tracking-wider transition-all ${
                                      fuiteReparee === opt.v
                                        ? "border-[#111] bg-[#111] text-white"
                                        : "border-black/10 bg-white text-[#111] hover:border-black/30"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Fluide */}
              <div>
                <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                  Fluide frigorigène {needsBsff ? "récupéré" : "de l'équipement"}
                </label>
                <select
                  value={fluide}
                  onChange={e => setFluide(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-base text-[#111] focus:outline-none focus:border-black/40 focus:bg-[#fafaf8] transition-all disabled:opacity-50"
                >
                  {FLUIDES.map(f => (
                    <option key={f.code} value={f.code}>
                      {f.label} · GWP {f.gwp}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantité + Contenant — uniquement si récupération (BSFF requis) */}
              <AnimatePresence mode="wait">
                {needsBsff && (
                  <motion.div
                    key="recup-fields"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden space-y-6"
                  >
                    <div>
                      <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                        Quantité récupérée (kg)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required={needsBsff}
                        value={weight}
                        onChange={e => setWeight(e.target.value)}
                        disabled={isLoading}
                        className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-base text-[#111] focus:outline-none focus:border-black/40 focus:bg-[#fafaf8] transition-all disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                        Numéro de bouteille / contenant
                      </label>
                      <input
                        type="text"
                        required={needsBsff}
                        pattern="[A-Za-z0-9]+"
                        title="Alphanumérique uniquement, pas de tirets ni d'espaces"
                        value={packagingNumero}
                        onChange={e => setPackagingNumero(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                        disabled={isLoading}
                        className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-base text-[#111] font-mono focus:outline-none focus:border-black/40 focus:bg-[#fafaf8] transition-all disabled:opacity-50"
                      />
                      <p className="mt-2 text-xs text-black/35 font-mono">
                        Alphanumérique uniquement (TrackDéchets refuse tirets / espaces)
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Client */}
              <div>
                <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                  Client / détenteur (optionnel)
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  disabled={isLoading}
                  placeholder="Nom ou raison sociale du client final"
                  className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-base text-[#111] focus:outline-none focus:border-black/40 focus:bg-[#fafaf8] transition-all disabled:opacity-50"
                />
              </div>

              {/* Bloc CERFA — informations équipement */}
              <div className="pt-2">
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/35 mb-3 flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-black/25" />
                  Informations CERFA 15497*04 (fiche d&apos;intervention)
                </div>

                {/* Vision IA — scan de plaque signalétique */}
                <div className="mb-4 rounded-xl border-2 border-dashed border-black/15 bg-white/40 p-4">
                  <input
                    ref={scanInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePlaqueScan}
                    disabled={scanning || isLoading}
                    className="hidden"
                    id="plaque-scan-input"
                  />
                  <label
                    htmlFor="plaque-scan-input"
                    className={`flex items-center justify-center gap-3 w-full px-5 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      scanning
                        ? "bg-black/[0.04] text-black/40 cursor-wait"
                        : "bg-[#111] text-white hover:bg-[#333]"
                    }`}
                  >
                    {scanning ? (
                      <>
                        <span className="inline-block w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span className="tracking-widest">ANALYSE EN COURS…</span>
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                        <span className="tracking-widest">SCANNER LA PLAQUE SIGNALÉTIQUE</span>
                      </>
                    )}
                  </label>
                  <p className="mt-2 text-[11px] text-black/40 text-center">
                    Photographiez la plaque, l&apos;IA pré-remplit modèle, n° série, fluide et charge.
                  </p>
                  {scanInfo && (
                    <div className="mt-3 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                      {scanInfo}
                    </div>
                  )}
                  {scanError && (
                    <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                      {scanError}
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                      Modèle équipement
                    </label>
                    <input
                      type="text"
                      value={modeleEquipement}
                      onChange={e => setModeleEquipement(e.target.value)}
                      disabled={isLoading}
                      placeholder="Ex: Daikin FTXM35M"
                      className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-base text-[#111] focus:outline-none focus:border-black/40 focus:bg-[#fafaf8] transition-all disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                      N° de série équipement
                    </label>
                    <input
                      type="text"
                      value={numeroSerieEquipement}
                      onChange={e => setNumeroSerieEquipement(e.target.value)}
                      disabled={isLoading}
                      placeholder="Ex: DK2024042587"
                      className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-base text-[#111] font-mono focus:outline-none focus:border-black/40 focus:bg-[#fafaf8] transition-all disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                      Lieu d&apos;intervention (optionnel)
                    </label>
                    <input
                      type="text"
                      value={lieuIntervention}
                      onChange={e => setLieuIntervention(e.target.value)}
                      disabled={isLoading}
                      placeholder="Adresse du chantier"
                      className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-base text-[#111] focus:outline-none focus:border-black/40 focus:bg-[#fafaf8] transition-all disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                      N° attestation Cat I (optionnel)
                    </label>
                    <input
                      type="text"
                      value={attestation}
                      onChange={e => setAttestation(e.target.value)}
                      disabled={isLoading}
                      placeholder="Ex: FR-CAT1-XXXXX"
                      className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-base text-[#111] font-mono focus:outline-none focus:border-black/40 focus:bg-[#fafaf8] transition-all disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-8 py-4 bg-[#111] text-white text-sm tracking-widest font-medium rounded-xl hover:bg-[#333] transition-colors disabled:opacity-60 disabled:cursor-wait inline-flex items-center justify-center gap-3"
              >
                {isLoading ? (
                  <>
                    <span className="inline-block w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>GÉNÉRATION EN COURS…</span>
                  </>
                ) : (
                  <span>{needsBsff ? "GÉNÉRER BSFF + CERFA" : "GÉNÉRER CERFA 15497*04"}</span>
                )}
              </button>

              {isLoading && status.type === "loading" && (
                <p className="text-center text-xs font-mono text-black/45 tracking-wide">
                  {status.step}
                </p>
              )}

              {status.type === "error" && (
                <div className="px-5 py-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
                  <div className="font-mono text-[10px] tracking-widest uppercase text-red-500 mb-1">Erreur</div>
                  {status.message}
                </div>
              )}
            </motion.form>
          )}

          {/* SUCCESS — Résultat */}
          {isSuccess && status.type === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-50 animate-ping" />
                  <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-mono text-[11px] tracking-widest text-emerald-700">
                  {status.bsffId ? "BSFF SIGNÉ · OFFICIEL" : "CERFA 15497*04 GÉNÉRÉ"}
                </span>
              </div>

              {/* Card résultat */}
              <div className="rounded-2xl border border-black/[0.08] bg-white p-8 space-y-5">
                {status.bsffId ? (
                  <>
                    <div>
                      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40 mb-1.5">
                        Identifiant BSFF
                      </div>
                      <div className="text-lg font-mono text-[#111] break-all">{status.bsffId}</div>
                    </div>
                    <div className="h-px bg-black/[0.06]" />
                    <div>
                      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40 mb-1.5">
                        Signé le
                      </div>
                      <div className="text-sm text-black/80">
                        {status.signedAt &&
                          new Date(status.signedAt).toLocaleString("fr-FR", {
                            dateStyle: "long",
                            timeStyle: "short",
                          })}
                      </div>
                    </div>
                    <div className="h-px bg-black/[0.06]" />
                    <div>
                      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40 mb-1.5">
                        Source
                      </div>
                      <div className="text-sm text-black/80">
                        TrackDéchets — Ministère de la Transition écologique
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40 mb-1.5">
                        Document généré
                      </div>
                      <div className="text-lg text-[#111]">
                        Fiche d&apos;intervention CERFA 15497*04
                      </div>
                    </div>
                    <div className="h-px bg-black/[0.06]" />
                    <div>
                      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40 mb-1.5">
                        BSFF
                      </div>
                      <div className="text-sm text-black/60">
                        Pas requis pour ce type d&apos;intervention.
                      </div>
                    </div>
                    <div className="h-px bg-black/[0.06]" />
                    <div>
                      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40 mb-1.5">
                        Source
                      </div>
                      <div className="text-sm text-black/80">
                        Formulaire officiel · Arrêté du 6 juillet 2024
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* CTAs téléchargement */}
              <div className="space-y-3">
                {status.bsffId && (
                  <a
                    href={`/api/bsff/download/${status.bsffId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full px-8 py-4 bg-[#111] text-white text-sm tracking-widest font-medium rounded-xl hover:bg-[#333] transition-colors inline-flex items-center justify-center gap-3"
                    title="Télécharger le BSFF officiel TrackDéchets (lien regénéré à la volée — ne périme jamais)"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    TÉLÉCHARGER LE BSFF OFFICIEL
                  </a>
                )}
                <a
                  href={status.cerfaUrl}
                  download={`CERFA_15497-04_${status.bsffId ?? "intervention"}.pdf`}
                  className={`w-full px-8 py-4 text-sm tracking-widest font-medium rounded-xl transition-colors inline-flex items-center justify-center gap-3 ${
                    status.bsffId
                      ? "bg-white border-2 border-[#111] text-[#111] hover:bg-black/[0.03]"
                      : "bg-[#111] text-white hover:bg-[#333]"
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  TÉLÉCHARGER LE CERFA 15497*04
                </a>
                <button
                  onClick={handleDownloadRapport}
                  disabled={rapportLoading}
                  className="w-full px-8 py-4 bg-emerald-700 hover:bg-emerald-800 text-white text-sm tracking-widest font-medium rounded-xl transition-colors disabled:opacity-60 disabled:cursor-wait inline-flex items-center justify-center gap-3"
                  title="Rapport pour ton client final (entête entreprise + logo + ta signature + détails)"
                >
                  {rapportLoading ? (
                    <>
                      <span className="inline-block w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>GÉNÉRATION DU RAPPORT…</span>
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      RAPPORT POUR LE CLIENT FINAL
                    </>
                  )}
                </button>
                {rapportError && (
                  <div className="px-5 py-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                    {rapportError}
                  </div>
                )}
              </div>

              {/* Approche C — Bouton signature client */}
              <button
                onClick={openSignatureModal}
                className="w-full px-8 py-4 border-2 border-dashed border-black/20 text-[#111] text-sm tracking-widest font-medium rounded-xl hover:border-black/50 hover:bg-black/[0.02] transition-all inline-flex items-center justify-center gap-3"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
                  <path d="M12 2v15" />
                  <path d="m7 11 5-5 5 5" />
                </svg>
                FAIRE SIGNER LE CLIENT (OPTIONNEL)
              </button>

              <button
                onClick={reset}
                className="w-full px-8 py-3 border border-black/10 text-black/70 text-sm tracking-widest rounded-xl hover:border-black/25 hover:bg-black/[0.03] transition-all"
              >
                NOUVELLE INTERVENTION
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modale signature détenteur — Approche C — rendue via Portal */}
        {portalMounted && createPortal((
          <AnimatePresence>
          {sigModalOpen && (
            <motion.div
              key="sig-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
              onClick={(e) => { if (e.target === e.currentTarget) closeSignatureModal(); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[#F5F4F0] rounded-2xl max-w-lg w-full p-6 md:p-8 space-y-5 shadow-2xl"
              >
                <div>
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40 mb-1">
                    Signature client
                  </div>
                  <h2 className="text-2xl font-light tracking-tight text-[#111]">
                    Le client signe sur ton téléphone
                  </h2>
                  <p className="mt-2 text-xs text-black/50">
                    La signature est embarquée dans le CERFA 15497*04 officiel et le PDF est régénéré.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                      Nom du détenteur
                    </label>
                    <input
                      type="text"
                      value={detenteurName}
                      onChange={e => setDetenteurName(e.target.value)}
                      disabled={sigLoading}
                      placeholder="Ex: Jean Dupont"
                      className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-base text-[#111] focus:outline-none focus:border-black/40 transition-all disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                      Qualité (optionnel)
                    </label>
                    <input
                      type="text"
                      value={detenteurQuality}
                      onChange={e => setDetenteurQuality(e.target.value)}
                      disabled={sigLoading}
                      placeholder="Ex: Propriétaire, Gérant…"
                      className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-base text-[#111] focus:outline-none focus:border-black/40 transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                    Signature
                  </label>
                  <div className="border-2 border-black/15 rounded-xl bg-white overflow-hidden">
                    <SignatureCanvas
                      ref={sigRef}
                      penColor="#111"
                      canvasProps={{
                        width: 460,
                        height: 180,
                        className: "w-full h-[180px] touch-none",
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { sigRef.current?.clear(); setSigError(null); }}
                    disabled={sigLoading}
                    className="mt-2 font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 hover:text-black/80 transition-colors disabled:opacity-50"
                  >
                    Effacer
                  </button>
                </div>

                {sigError && (
                  <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                    {sigError}
                  </div>
                )}

                <div className="flex flex-col-reverse md:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeSignatureModal}
                    disabled={sigLoading}
                    className="flex-1 px-6 py-3 border border-black/10 text-black/70 text-sm tracking-widest font-medium rounded-xl hover:border-black/25 hover:bg-black/[0.03] transition-all disabled:opacity-50"
                  >
                    ANNULER
                  </button>
                  <button
                    type="button"
                    onClick={handleSignAndRegenerate}
                    disabled={sigLoading}
                    className="flex-1 px-6 py-3 bg-[#111] text-white text-sm tracking-widest font-medium rounded-xl hover:bg-[#333] transition-colors disabled:opacity-60 disabled:cursor-wait inline-flex items-center justify-center gap-3"
                  >
                    {sigLoading ? (
                      <>
                        <span className="inline-block w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span>SIGNATURE EN COURS…</span>
                      </>
                    ) : (
                      <span>VALIDER LA SIGNATURE</span>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
          </AnimatePresence>
        ), document.body)}

        <div className="mt-16 pt-8 border-t border-black/[0.06] text-xs text-black/30 font-mono tracking-wide">
          ENVIRONNEMENT SANDBOX · TrackDéchets bac à sable · Aucun BSFF de production
        </div>
      </div>
    </div>
  );
}
