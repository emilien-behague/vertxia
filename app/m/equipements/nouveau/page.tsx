"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection } from "@/components/mobile/inset-list";
import { VoiceInput } from "@/components/mobile/voice-input";
import { ScanPlaqueButton, type PlaqueData } from "@/components/mobile/scan-plaque-button";
import {
  VoiceFullDictationEquipement,
  type EquipementExtractionResult,
} from "@/components/mobile/voice-full-dictation-equipement";
import {
  saveEquipement,
  UNITE_INTERIEURE_LABELS,
  type UniteInterieure,
  type UniteInterieureType,
} from "@/lib/equipement";

const VALID_UNITE_TYPES = new Set<UniteInterieureType>([
  "cassette_plafond",
  "cassette_4_voies",
  "cassette_1_voie",
  "murale",
  "gainable",
  "plafonnier",
  "console",
  "vitrine_murale",
  "chambre_froide_positive",
  "chambre_froide_negative",
]);

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

const UNITE_TYPES: UniteInterieureType[] = [
  "cassette_plafond",
  "cassette_4_voies",
  "cassette_1_voie",
  "murale",
  "gainable",
  "plafonnier",
  "console",
  "vitrine_murale",
  "chambre_froide_positive",
  "chambre_froide_negative",
];

// Wrapper Suspense — useSearchParams() doit être dans un Suspense boundary
// pour que Next.js puisse pre-render la page (sinon erreur build prod).
export default function MobileAjoutEquipementPage() {
  return (
    <Suspense fallback={null}>
      <MobileAjoutEquipementContent />
    </Suspense>
  );
}

function MobileAjoutEquipementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scan QR Vertxia — pré-remplit le form depuis un équipement existant
  const [qrInfo, setQrInfo] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const [form, setForm] = useState({
    clientName: "",
    clientEmail: "",
    clientTelephone: "",
    siteAdresse: "",
    modele: "",
    numeroSerie: "",
    fluideCode: "R-32",
    chargeKg: "",
    detecteurFixe: false,
    dernierControle: "",
    notes: "",
  });

  const [unites, setUnites] = useState<UniteInterieure[]>([]);
  const [showUniteForm, setShowUniteForm] = useState(false);
  const [uniteDraft, setUniteDraft] = useState<UniteInterieure>({
    type: "cassette_plafond",
    modele: "",
    numeroSerie: "",
    emplacement: "",
  });

  // Scan plaque signalétique — IA vision pré-remplit modèle, n° série, fluide, charge
  // L'état (loading, feedback) est géré par <ScanPlaqueButton/>.
  // Ici on ne capture que le callback pour brancher les données dans le form.

  // Au mount, si on revient du scanner QR avec ?fromQr=<id>, pré-remplit
  // le formulaire avec les données publiques de l'équipement scanné.
  // Use case : reprendre une machine sur laquelle un autre technicien
  // était déjà passé — gain de temps massif (pas de re-saisie).
  useEffect(() => {
    const fromQr = searchParams.get("fromQr");
    if (!fromQr) return;
    setQrLoading(true);
    setQrInfo("Récupération de l'équipement scanné…");
    (async () => {
      try {
        const res = await fetch(
          `/api/public/equipement/${encodeURIComponent(fromQr)}`,
          { headers: { "cache-control": "no-store" } }
        );
        if (!res.ok) {
          setQrInfo("❌ Équipement scanné non trouvé.");
          return;
        }
        const json = await res.json();
        if (!json.data) {
          setQrInfo("❌ Équipement scanné non trouvé.");
          return;
        }
        const d = json.data as Record<string, unknown>;
        const filled: string[] = [];
        setForm((prev) => {
          const next = { ...prev };
          if (typeof d.client_name === "string" && d.client_name) {
            next.clientName = d.client_name;
            filled.push("client");
          }
          if (typeof d.client_email === "string" && d.client_email) {
            next.clientEmail = d.client_email;
            filled.push("email");
          }
          if (typeof d.client_telephone === "string" && d.client_telephone) {
            next.clientTelephone = d.client_telephone;
            filled.push("téléphone");
          }
          if (typeof d.site_adresse === "string" && d.site_adresse) {
            next.siteAdresse = d.site_adresse;
            filled.push("adresse");
          }
          if (typeof d.modele === "string" && d.modele) {
            next.modele = d.modele;
            filled.push("modèle");
          }
          if (typeof d.numero_serie === "string" && d.numero_serie) {
            next.numeroSerie = d.numero_serie;
            filled.push("n° série");
          }
          if (typeof d.fluide_code === "string" && FLUIDES.some((f) => f.code === d.fluide_code)) {
            next.fluideCode = d.fluide_code;
            filled.push("fluide");
          }
          const charge = typeof d.charge_kg === "number" ? d.charge_kg : Number(d.charge_kg);
          if (Number.isFinite(charge) && charge > 0) {
            next.chargeKg = String(charge);
            filled.push("charge");
          }
          if (typeof d.detecteur_fixe === "boolean") {
            next.detecteurFixe = d.detecteur_fixe;
            if (d.detecteur_fixe) filled.push("détecteur");
          }
          if (typeof d.dernier_controle_iso === "string" && d.dernier_controle_iso) {
            next.dernierControle = d.dernier_controle_iso.slice(0, 10);
            filled.push("dernier contrôle");
          }
          if (typeof d.notes === "string" && d.notes) {
            next.notes = d.notes;
            filled.push("notes");
          }
          return next;
        });
        if (Array.isArray(d.unites_interieures) && d.unites_interieures.length > 0) {
          const valids = (d.unites_interieures as UniteInterieure[]).filter((u) =>
            VALID_UNITE_TYPES.has(u.type)
          );
          if (valids.length > 0) {
            setUnites((prev) => [...prev, ...valids]);
            filled.push(`${valids.length} unité${valids.length > 1 ? "s" : ""} intérieure${valids.length > 1 ? "s" : ""}`);
          }
        }
        setQrInfo(
          filled.length > 0
            ? `✅ ${filled.length} champ${filled.length > 1 ? "s" : ""} pré-remplis — vérifie et complète si besoin.`
            : "⚠️ QR scanné mais aucune donnée exploitable récupérée."
        );
      } catch (e) {
        setQrInfo("❌ Erreur réseau : " + (e instanceof Error ? e.message : "inconnue"));
      } finally {
        setQrLoading(false);
        // Clean l'URL pour ne pas re-fetcher si l'utilisateur navigue back/forward
        router.replace("/m/equipements/nouveau", { scroll: false });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handoff depuis le scan plaque UNIVERSEL sur /m/equipements (liste parc).
  // Quand le scan ne matche AUCUN n°série du parc, la liste pousse les données
  // dans sessionStorage et redirige ici avec ?fromPlaqueScan=1. On les lit + on
  // pré-remplit + on nettoie pour éviter résidu sur navigation suivante.
  useEffect(() => {
    if (searchParams.get("fromPlaqueScan") !== "1") return;
    try {
      const raw = sessionStorage.getItem("vertxia:plaqueScanHandoff");
      if (raw) {
        const plaque = JSON.parse(raw) as PlaqueData;
        handlePlaqueScanned(plaque);
      }
      sessionStorage.removeItem("vertxia:plaqueScanHandoff");
    } catch {
      // sessionStorage indispo / JSON cassé → on laisse le form vide
    }
    router.replace("/m/equipements/nouveau", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dictée vocale plein écran — IA extrait tout l'équipement d'un coup
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceInfo, setVoiceInfo] = useState<string | null>(null);

  function handleVoiceExtraction(ex: EquipementExtractionResult) {
    const filled: string[] = [];

    setForm((prev) => {
      const next = { ...prev };
      if (ex.clientName?.trim()) {
        next.clientName = ex.clientName.trim();
        filled.push("client");
      }
      if (ex.clientEmail?.trim()) {
        next.clientEmail = ex.clientEmail.trim().toLowerCase();
        filled.push("email");
      }
      if (ex.clientTelephone?.trim()) {
        next.clientTelephone = ex.clientTelephone.trim();
        filled.push("téléphone");
      }
      if (ex.siteAdresse?.trim()) {
        next.siteAdresse = ex.siteAdresse.trim();
        filled.push("adresse");
      }
      if (ex.modele?.trim()) {
        next.modele = ex.modele.trim();
        filled.push("modèle");
      }
      if (ex.numeroSerie?.trim()) {
        next.numeroSerie = ex.numeroSerie.trim();
        filled.push("n° série");
      }
      if (ex.fluideCode && FLUIDES.some((f) => f.code === ex.fluideCode)) {
        next.fluideCode = ex.fluideCode;
        filled.push("fluide");
      }
      if (typeof ex.chargeKg === "number" && ex.chargeKg > 0) {
        next.chargeKg = String(ex.chargeKg);
        filled.push("charge");
      }
      if (typeof ex.detecteurFixe === "boolean") {
        next.detecteurFixe = ex.detecteurFixe;
        if (ex.detecteurFixe) filled.push("détecteur");
      }
      if (ex.dernierControle && /^\d{4}-\d{2}-\d{2}$/.test(ex.dernierControle)) {
        next.dernierControle = ex.dernierControle;
        filled.push("dernier contrôle");
      }
      if (ex.notes?.trim()) {
        next.notes = ex.notes.trim();
        filled.push("notes");
      }
      return next;
    });

    if (Array.isArray(ex.unitesInterieures) && ex.unitesInterieures.length > 0) {
      const validUnites: UniteInterieure[] = ex.unitesInterieures
        .filter((u) => VALID_UNITE_TYPES.has(u.type as UniteInterieureType))
        .map((u) => ({
          type: u.type as UniteInterieureType,
          modele: u.modele?.trim() || "À compléter",
          numeroSerie: u.numeroSerie?.trim() || "À compléter",
          emplacement: u.emplacement?.trim() || undefined,
        }));
      if (validUnites.length > 0) {
        setUnites((prev) => [...prev, ...validUnites]);
        filled.push(`${validUnites.length} unité${validUnites.length > 1 ? "s" : ""} intérieure${validUnites.length > 1 ? "s" : ""}`);
      }
    }

    setVoiceInfo(
      filled.length > 0
        ? `✅ ${filled.length} champ${filled.length > 1 ? "s" : ""} rempli${filled.length > 1 ? "s" : ""} : ${filled.join(", ")}`
        : "❌ Rien détecté — réessaie en parlant plus précisément"
    );
    setVoiceOpen(false);
  }

  function handlePlaqueScanned(plaque: PlaqueData) {
    // Garde-fou : l'IA Vision confond parfois n serie et modele sur des
    // plaques peu lisibles. Si le "modele" extrait est purement numerique
    // (ex: "472882"), c'est tres probablement un n serie qui s'est glisse
    // dans le mauvais champ. On le redirige vers numeroSerie si ce dernier
    // est vide, sinon on ignore (l'utilisateur corrigera).
    const modeleLooksLikeSerial =
      plaque.modele && /^[\d\s\-_/]+$/.test(plaque.modele.trim());

    if (plaque.modele && !modeleLooksLikeSerial) {
      const fullModele = [plaque.marque, plaque.modele].filter(Boolean).join(" ").trim();
      update("modele", fullModele);
    } else if (plaque.marque && !plaque.modele) {
      // Marque seule extraite -> on remplit au moins ca, l'utilisateur
      // completera le modele a la main.
      update("modele", plaque.marque.trim());
    }

    if (plaque.numeroSerie) {
      update("numeroSerie", plaque.numeroSerie);
    } else if (modeleLooksLikeSerial && plaque.modele) {
      // Le "modele" extrait etait un n serie -> on le met au bon endroit.
      update("numeroSerie", plaque.modele.trim());
    }

    if (plaque.fluide && FLUIDES.some((f) => f.code === plaque.fluide)) {
      update("fluideCode", plaque.fluide);
    }
    if (typeof plaque.chargeNominaleKg === "number" && plaque.chargeNominaleKg > 0) {
      update("chargeKg", String(plaque.chargeNominaleKg));
    }
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addUnite() {
    if (!uniteDraft.modele.trim() || !uniteDraft.numeroSerie.trim()) {
      setError("Modèle et n°série de l'unité intérieure obligatoires.");
      return;
    }
    setError(null);
    setUnites((prev) => [
      ...prev,
      {
        type: uniteDraft.type,
        modele: uniteDraft.modele.trim(),
        numeroSerie: uniteDraft.numeroSerie.trim(),
        emplacement: uniteDraft.emplacement?.trim() || undefined,
      },
    ]);
    setUniteDraft({ type: uniteDraft.type, modele: "", numeroSerie: "", emplacement: "" });
    setShowUniteForm(false);
  }

  function removeUnite(idx: number) {
    setUnites((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fluide = FLUIDES.find((f) => f.code === form.fluideCode);
    if (!fluide) {
      setError("Fluide invalide");
      return;
    }
    const chargeKg = parseFloat(form.chargeKg);
    if (!Number.isFinite(chargeKg) || chargeKg <= 0) {
      setError("Charge en kg invalide");
      return;
    }
    if (!form.clientName.trim() || !form.modele.trim() || !form.numeroSerie.trim()) {
      setError("Les champs Client, Modèle et N° de série sont obligatoires.");
      return;
    }
    setBusy(true);
    try {
      saveEquipement({
        clientName: form.clientName.trim(),
        clientEmail: form.clientEmail.trim() || undefined,
        clientTelephone: form.clientTelephone.trim() || undefined,
        siteAdresse: form.siteAdresse.trim() || undefined,
        modele: form.modele.trim(),
        numeroSerie: form.numeroSerie.trim(),
        fluide,
        chargeKg,
        detecteurFixe: form.detecteurFixe,
        dernierControleISO: form.dernierControle
          ? new Date(form.dernierControle).toISOString()
          : undefined,
        unitesInterieures: unites.length > 0 ? unites : undefined,
        notes: form.notes.trim() || undefined,
      });
      router.push("/m/equipements");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <MobileHeader title="➕ Nouvel équipement" largeTitle backHref="/m/equipements" />

      <form onSubmit={handleSubmit}>
        {/* Dictée vocale — IA extrait tout l'équipement (client + machine + unités) d'un coup */}
        <InsetListSection
          title="Dictée vocale (recommandée)"
          footer="Décris à voix haute ton équipement complet (client, modèle, fluide, charge, unités intérieures). L'IA range tout dans les bonnes cases — tu n'as plus qu'à valider."
        >
          <div className="px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setVoiceInfo(null);
                setVoiceOpen(true);
              }}
              disabled={busy}
              className="w-full px-5 py-3.5 rounded-2xl bg-[#111] text-white text-[14px] font-medium active:bg-black/90 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2.5"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
              <span>🎤 Dicter tout l&apos;équipement</span>
            </button>
            {voiceInfo && (
              <div
                className={`mt-2 px-3 py-2 rounded-xl text-[12px] leading-relaxed ${
                  voiceInfo.startsWith("✅")
                    ? "bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800"
                    : "bg-red-50 ring-1 ring-red-200 text-red-700"
                }`}
              >
                {voiceInfo}
              </div>
            )}
          </div>
        </InsetListSection>

        {/* Scan QR Vertxia — rapatrie un équipement existant (autre technicien,
            ou ton propre équipement à dupliquer) en pré-remplissant tout le form. */}
        <InsetListSection
          title="Scanner un QR Vertxia (optionnel)"
          footer="Si la machine porte déjà une étiquette QR Vertxia (collée par un autre technicien ou par toi), scanne-la pour récupérer toutes les infos d'un coup."
        >
          <div className="px-4 py-3">
            <button
              type="button"
              onClick={() =>
                router.push("/m/scan?returnTo=/m/equipements/nouveau")
              }
              disabled={busy || qrLoading}
              className="w-full px-5 py-3.5 rounded-2xl bg-white ring-1 ring-black/15 text-[#111] text-[14px] font-medium active:bg-black/[0.04] transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2.5"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <path d="M14 14h2v2h-2zM18 14h3M14 18h3M18 21h3M21 18v3" />
              </svg>
              <span>{qrLoading ? "Chargement…" : "Scanner un QR Vertxia"}</span>
            </button>
            {qrInfo && (
              <div className="mt-3 text-[12px] text-black/65 leading-relaxed">
                {qrInfo}
              </div>
            )}
          </div>
        </InsetListSection>

        {/* Scan plaque signalétique — pré-remplit modèle, n° série, fluide, charge */}
        <InsetListSection
          title="Scan rapide (optionnel)"
          footer="Vise la plaque signalétique de l'unité extérieure. L'IA détecte modèle, n° série, fluide et charge nominale automatiquement."
        >
          <div className="px-4 py-3">
            <ScanPlaqueButton onScanned={handlePlaqueScanned} disabled={busy} />
          </div>
        </InsetListSection>

        {/* Client */}
        <InsetListSection
          title="Client"
          footer="Email et téléphone activent les relances automatiques 30 jours avant chaque échéance de contrôle réglementaire."
        >
          <FormRow label="Nom / Raison sociale" required>
            <input
              type="text"
              required
              value={form.clientName}
              onChange={(e) => update("clientName", e.target.value)}
              placeholder="Ex : Hôtel Le Provençal"
              className="input-mobile"
            />
          </FormRow>
          <FormRow label="Email du client">
            <input
              type="email"
              value={form.clientEmail}
              onChange={(e) => update("clientEmail", e.target.value)}
              placeholder="Ex : direction@hotel-leprovencal.fr"
              className="input-mobile"
              autoComplete="off"
              autoCapitalize="off"
            />
          </FormRow>
          <FormRow label="Téléphone du client">
            <input
              type="tel"
              value={form.clientTelephone}
              onChange={(e) => update("clientTelephone", e.target.value)}
              placeholder="Ex : 04 94 41 23 45"
              className="input-mobile"
              inputMode="tel"
            />
          </FormRow>
          <FormRow label="Site / Adresse">
            <input
              type="text"
              value={form.siteAdresse}
              onChange={(e) => update("siteAdresse", e.target.value)}
              placeholder="Ex : 14 av. République, Toulon"
              className="input-mobile"
            />
          </FormRow>
        </InsetListSection>

        {/* Unité extérieure */}
        <InsetListSection
          title="Unité extérieure"
          footer="C'est l'unité qui porte la charge fluide (compresseur). En split, VRV ou VRF, c'est elle qui est identifiée comme système principal. Bien distinguer le MODÈLE (nom commercial, partagé entre toutes les machines de cette gamme) du N° DE SÉRIE (unique à cette unité)."
        >
          <FormRow label="Modèle (nom commercial)" required>
            <input
              type="text"
              required
              value={form.modele}
              onChange={(e) => update("modele", e.target.value)}
              placeholder="Ex : Daikin RXYQ8U7Y1B, Mitsubishi PUHZ-ZRP60, Altherma 3 R"
              className="input-mobile"
            />
            <div className="mt-1 text-[10.5px] text-black/40 leading-snug">
              Marque + référence catalogue. <strong>Pas</strong> le n° de série unique. La mémoire collective Vertxia agrège les pannes par modèle.
            </div>
            {/* Warning soft : si "modele" ressemble a un n serie pur (que des
                chiffres / tirets), on previent. C'est le bug typique vu sur
                le screenshot Daikin 472882 — 472882 etait le n serie, pas
                le modele commercial. Resultat : la memoire collective ne
                matchera jamais rien (chaque machine = cle unique). */}
            {form.modele.trim().length > 0 && /^[\d\s\-_/]+$/.test(form.modele.trim()) && (
              <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 ring-1 ring-amber-200 text-[11px] text-amber-900 leading-snug">
                <strong>On dirait un n° de série</strong>, pas un modèle. Mets la référence commerciale ici (ex : <em>RXYQ8U7Y1B</em>) et le n° de série dans le champ suivant.
              </div>
            )}
          </FormRow>
          <FormRow label="N° de série (unique)" required>
            <input
              type="text"
              required
              value={form.numeroSerie}
              onChange={(e) => update("numeroSerie", e.target.value)}
              placeholder="Ex : 472882, DK24VRV16001"
              className="input-mobile font-mono"
            />
            <div className="mt-1 text-[10.5px] text-black/40 leading-snug">
              Identifiant unique de cette machine précise. Sert au SAV et au lien avec ses interventions. Ne sort jamais de ton compte.
            </div>
          </FormRow>
        </InsetListSection>

        {/* Fluide */}
        <InsetListSection title="Fluide frigorigène">
          <FormRow label="Type de fluide" required>
            <select
              required
              value={form.fluideCode}
              onChange={(e) => update("fluideCode", e.target.value)}
              className="input-mobile"
            >
              {FLUIDES.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.label} — GWP {f.gwp.toLocaleString("fr-FR")}
                </option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Charge nominale (kg)" required>
            <input
              type="number"
              required
              min="0"
              step="any"
              inputMode="decimal"
              value={form.chargeKg}
              onChange={(e) => update("chargeKg", e.target.value)}
              placeholder="Ex : 16"
              className="input-mobile"
            />
          </FormRow>
          <ToggleRow
            label="Détecteur fixe de fuites"
            sublabel="Divise par 2 la fréquence des contrôles"
            value={form.detecteurFixe}
            onChange={(v) => update("detecteurFixe", v)}
          />
        </InsetListSection>

        {/* Unités intérieures */}
        <InsetListSection
          title={`Unités intérieures${unites.length > 0 ? ` · ${unites.length}` : ""}`}
          footer="Cassettes, murales, gainables, vitrines, chambres froides… Toutes les unités du même circuit fluide. Le n°série est obligatoire pour le SAV et le suivi garantie."
        >
          {unites.map((u, idx) => (
            <div key={idx} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-black/45 uppercase tracking-wide">
                  {UNITE_INTERIEURE_LABELS[u.type]}
                </div>
                <div className="text-[15px] text-[#111] mt-0.5">{u.modele}</div>
                <div className="text-[12px] font-mono text-black/50 mt-0.5">SN : {u.numeroSerie}</div>
                {u.emplacement && (
                  <div className="text-[12px] text-black/55 italic mt-0.5">{u.emplacement}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeUnite(idx)}
                className="shrink-0 w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center active:bg-red-100 transition-colors"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                aria-label="Supprimer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}

          {!showUniteForm ? (
            <button
              type="button"
              onClick={() => setShowUniteForm(true)}
              className="w-full px-4 py-3.5 text-left active:bg-black/[0.04] transition-colors flex items-center gap-3"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#111] text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <div>
                <div className="text-[15px] text-[#111]">
                  {unites.length === 0 ? "Ajouter une unité intérieure" : "Ajouter une autre unité"}
                </div>
                <div className="text-[12px] text-black/50">Cassette, murale, vitrine, chambre froide…</div>
              </div>
            </button>
          ) : (
            <div className="px-4 py-3 bg-black/[0.02] border-y border-black/[0.06]">
              <div className="text-[11px] font-medium text-black/45 uppercase tracking-wide mb-2">
                Nouvelle unité
              </div>

              <FormRow label="Type" required>
                <select
                  value={uniteDraft.type}
                  onChange={(e) => setUniteDraft({ ...uniteDraft, type: e.target.value as UniteInterieureType })}
                  className="input-mobile"
                >
                  {UNITE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {UNITE_INTERIEURE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </FormRow>

              <FormRow label="Modèle" required>
                <input
                  type="text"
                  value={uniteDraft.modele}
                  onChange={(e) => setUniteDraft({ ...uniteDraft, modele: e.target.value })}
                  placeholder="Ex : Daikin FXFA32A"
                  className="input-mobile"
                />
              </FormRow>

              <FormRow label="N° de série" required>
                <input
                  type="text"
                  value={uniteDraft.numeroSerie}
                  onChange={(e) => setUniteDraft({ ...uniteDraft, numeroSerie: e.target.value })}
                  placeholder="Ex : DK24F32A101"
                  className="input-mobile font-mono"
                />
              </FormRow>

              <FormRow label="Emplacement (optionnel)">
                <input
                  type="text"
                  value={uniteDraft.emplacement ?? ""}
                  onChange={(e) => setUniteDraft({ ...uniteDraft, emplacement: e.target.value })}
                  placeholder="Ex : Chambre 12 / Cuisine / Allée 3"
                  className="input-mobile"
                />
              </FormRow>

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={addUnite}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#111] text-white text-[14px] font-medium active:bg-black/90 transition-colors"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  Ajouter cette unité
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUniteForm(false);
                    setUniteDraft({ type: "cassette_plafond", modele: "", numeroSerie: "", emplacement: "" });
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white border border-black/10 text-black/70 text-[14px] font-medium active:bg-black/[0.03] transition-colors"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </InsetListSection>

        {/* Historique */}
        <InsetListSection
          title="Historique"
          footer="Vide si jamais contrôlé. Les contrôles enregistrés via Vertxia seront liés automatiquement par le numéro de série."
        >
          <FormRow label="Dernier contrôle d'étanchéité">
            <input
              type="date"
              value={form.dernierControle}
              onChange={(e) => update("dernierControle", e.target.value)}
              className="input-mobile"
            />
          </FormRow>
          <FormRow label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              placeholder="Ex : VRV salle de réunion 1er étage, accès toit par échelle côté nord"
              className="input-mobile resize-none"
            />
          </FormRow>
          <div className="px-4 py-3">
            <VoiceInput
              onTranscript={(text, isFinal) => {
                if (isFinal) {
                  update("notes", form.notes ? `${form.notes} ${text}`.trim() : text);
                }
              }}
              mode="append"
              label="🎤 Dicter au lieu de taper"
              hint="Reconnaissance vocale native iPhone"
            />
          </div>
        </InsetListSection>

        {error && (
          <div className="mx-4 mt-4 px-4 py-3 rounded-2xl bg-red-50 text-red-700 text-[13px] border border-red-200">
            {error}
          </div>
        )}

        {/* CTA submit tuile XL emerald + bouton Annuler discret */}
        <div className="px-4 mt-8 space-y-3">
          <button
            type="submit"
            disabled={busy}
            className="relative block w-full text-left rounded-3xl shadow-lg shadow-black/10 active:scale-[0.98] transition-transform overflow-hidden px-5 py-5 disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #10b981 0%, #0f766e 100%)",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl leading-none drop-shadow shrink-0">
                {busy ? "⏳" : "✅"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[17px] font-bold uppercase tracking-wide text-white leading-tight">
                  {busy ? "Enregistrement…" : "Ajouter l'équipement"}
                </div>
                <div className="text-[12px] text-white/85 mt-0.5">
                  {busy ? "Saisie en cours" : "Sauvegarder cette installation"}
                </div>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={busy}
            className="w-full px-6 py-3 rounded-2xl bg-black/[0.04] text-black/65 text-[14px] font-medium active:bg-black/[0.08] transition-colors"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            Annuler
          </button>
        </div>
      </form>

      {/* Modal plein écran dictée IA */}
      <VoiceFullDictationEquipement
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onExtraction={handleVoiceExtraction}
      />

      <style jsx global>{`
        .input-mobile {
          width: 100%;
          padding: 10px 0;
          background: transparent;
          border: none;
          font-size: 16px;
          color: #111;
          outline: none;
          font-family: inherit;
        }
        .input-mobile::placeholder { color: rgba(0,0,0,0.3); }
        .input-mobile:focus { outline: none; }
        select.input-mobile { -webkit-appearance: none; appearance: none; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='rgba(0,0,0,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>"); background-repeat: no-repeat; background-position: right 4px center; padding-right: 24px; }
      `}</style>
    </>
  );
}

function FormRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-2.5">
      <div className="text-[11px] font-medium text-black/45 uppercase tracking-wide mb-0.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  sublabel,
  value,
  onChange,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between px-4 py-3 text-left active:bg-black/[0.04] transition-colors"
      style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[15px] text-[#111]">{label}</div>
        {sublabel && <div className="text-[12px] text-black/50 mt-0.5">{sublabel}</div>}
      </div>
      <div
        className={`relative w-[51px] h-[31px] rounded-full transition-colors shrink-0 ${
          value ? "bg-emerald-500" : "bg-black/15"
        }`}
      >
        <div
          className={`absolute top-0.5 w-[27px] h-[27px] rounded-full bg-white shadow-md transition-all ${
            value ? "left-[21px]" : "left-0.5"
          }`}
        />
      </div>
    </button>
  );
}
