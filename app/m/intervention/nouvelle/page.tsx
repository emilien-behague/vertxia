"use client";

// Page dynamique : useSearchParams lit ?equipement=ID&type=X qui ne sont connus
// qu'au runtime. Next.js 16 exige un <Suspense> boundary explicite, même avec
// force-dynamic. On wrap le composant interne dans Suspense (cf. default export en bas).
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Drawer } from "vaul";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { DocumentsForInterventionCard } from "@/components/mobile/documents-for-intervention-card";
import { InsetListSection } from "@/components/mobile/inset-list";
import { VoiceInput } from "@/components/mobile/voice-input";
import { VoiceFullDictation, type ExtractionResult } from "@/components/mobile/voice-full-dictation";
import { SignaturePad } from "@/components/mobile/signature-pad";
import { listEquipements, saveEquipement, updateEquipement } from "@/lib/equipement";
import {
  saveIntervention,
  listInterventions,
  type StoredIntervention,
} from "@/lib/intervention-storage";
import { loadProfil } from "@/lib/profil";
import { getDiagnostic, type StoredDiagnostic } from "@/lib/diagnostic-storage";
import { summarizeDiagnosticForCerfa, DELAI_LABELS } from "@/lib/vision-diagnostic";
import {
  listBouteilles,
  indexMouvementsParBouteille,
  createMouvement,
} from "@/lib/bouteille-storage";
import {
  bouteillesCompatibles,
  quantiteDepuisPesee,
  type Bouteille,
} from "@/lib/bouteille";
import {
  checkInterventionIntegrity,
  SEVERITE_STYLES,
  type IntegrityReport,
  type DraftIntervention,
} from "@/lib/integrity-checks";

// Formulaire intervention mobile-native — wizard simplifié sur une seule page
// avec sections conditionnelles selon le type d'intervention.
// Appelle les API serveur existantes (/api/bsff/create, /api/cerfa/create).

type TypeIntervention =
  | "recuperation"
  | "demantelement"
  | "controle_periodique"
  | "controle_non_periodique"
  | "mise_service"
  | "maintenance"
  | "assemblage"
  | "modification";

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
  { v: "assemblage", label: "Assemblage", desc: "Montage initial de l'équipement", needsBsff: false, needsControle: false },
  { v: "modification", label: "Modification", desc: "Modification d'un équipement existant", needsBsff: false, needsControle: false },
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
  | {
      type: "success";
      bsffId?: string;
      cerfaUrl: string;
      /** Fiche de visite client (rapport "humain" brandable) — optionnel,
       *  manque si le profil entreprise n'est pas encore configuré. */
      rapportUrl?: string;
      /** Email du client final si renseigné (pour bouton 'Envoyer au client') */
      clientEmail?: string;
      clientName?: string;
      typeIntervention: string;
      modeleEquipement?: string;
    }
  | { type: "error"; message: string };

function NouvelleInterventionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const typeParam = searchParams.get("type") as TypeIntervention | null;
  const eqIdParam = searchParams.get("equipement");
  const diagIdParam = searchParams.get("diagnosticId");

  const [typeIntervention, setTypeIntervention] = useState<TypeIntervention>(
    typeParam && INTERVENTIONS.find((i) => i.v === typeParam) ? typeParam : "controle_periodique"
  );
  const [fluide, setFluide] = useState(FLUIDES[0].code);
  const [weight, setWeight] = useState("2.5");
  const [packagingNumero, setPackagingNumero] = useState("");
  const [clientName, setClientName] = useState("");
  const [modeleEquipement, setModeleEquipement] = useState("");
  const [numeroSerieEquipement, setNumeroSerieEquipement] = useState("");
  const [lieuIntervention, setLieuIntervention] = useState("");

  // Détenteur — info légale en plus du clientName
  const [clientSiret, setClientSiret] = useState("");
  const [clientAdresse, setClientAdresse] = useState("");
  // Email du client final — sert au bouton 'Envoyer au client' post-validation
  const [clientEmail, setClientEmail] = useState("");

  const [detecteurId, setDetecteurId] = useState("");
  const [detecteurPermanent, setDetecteurPermanent] = useState<"oui" | "non">("non");
  const [fuiteDetectee, setFuiteDetectee] = useState<"oui" | "non">("non");
  // Multi-fuites — jusqu'à 3 lignes sur le CERFA officiel
  type FuiteForm = { localisation: string; reparee: "" | "realisee" | "a_faire" };
  const [fuites, setFuites] = useState<FuiteForm[]>([{ localisation: "", reparee: "" }]);
  const [notes, setNotes] = useState("");

  // Section [11] décomposition du fluide manipulé (optionnelle, conformité audit)
  const [showFluideDecompose, setShowFluideDecompose] = useState(false);
  const [fluideVierge, setFluideVierge] = useState("");
  const [fluideRecycle, setFluideRecycle] = useState("");
  const [fluideRegenere, setFluideRegenere] = useState("");
  const [fluideTraitement, setFluideTraitement] = useState("");
  const [fluideReutilisation, setFluideReutilisation] = useState("");

  // Signature client (détenteur) — capturée sur canvas tactile en fin d'intervention
  const [detenteurName, setDetenteurName] = useState("");
  const [detenteurQuality, setDetenteurQuality] = useState("");
  const [detenteurSignatureDataUrl, setDetenteurSignatureDataUrl] = useState<string | null>(null);
  const [signatureClearKey, setSignatureClearKey] = useState(0);

  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [eqContext, setEqContext] = useState<{ modele: string; clientName: string } | null>(null);
  // Derniere intervention enregistree sur cet equipement (si on arrive via
  // ?equipement=ID). Sert au bouton "Reprendre la meme intervention" qui
  // pre-remplit le type + parametres metier (detecteur, detenteur, packaging).
  const [lastInterventionOnEq, setLastInterventionOnEq] = useState<StoredIntervention | null>(null);
  // Garde-fou qualite — rapport d'integrite affiche dans une modal AVANT
  // la generation du CERFA / BSFF. Bloque les erreurs reglementaires graves
  // (R-22, signature manquante, attestation absente) et alerte sur les
  // incoherences metier (charge >150% nominal, recharge repetee sans recherche).
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const [integrityModalOpen, setIntegrityModalOpen] = useState(false);
  const [diagContext, setDiagContext] = useState<StoredDiagnostic | null>(null);

  // Vision IA scan plaque
  const [scanning, setScanning] = useState(false);
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  // Dictée IA — modal plein écran + tracking des champs remplis vocalement
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [dictedFields, setDictedFields] = useState<Set<string>>(new Set());
  const [voiceInfo, setVoiceInfo] = useState<string | null>(null);

  // Mouvements de gaz cette intervention — saisies simples qui mappent
  // sur les cases A (vierge) et D (récupéré traitement) du CERFA. Plus
  // accessible que la décomposition A/B/C/D/E pour les premiers usages.
  const [gazAjouteKg, setGazAjouteKg] = useState("");
  const [gazRetireKg, setGazRetireKg] = useState("");
  // Saisie libre du n° de bouteille si pas encore enregistrée dans le stock
  const [numBouteilleAjoutLibre, setNumBouteilleAjoutLibre] = useState("");
  const [numBouteilleRetraitLibre, setNumBouteilleRetraitLibre] = useState("");

  // Bouteilles — sélecteurs liés au stock pour traçabilité fluide
  const [bouteilleRechargeId, setBouteilleRechargeId] = useState<string>("");
  const [bouteilleRecuperationId, setBouteilleRecuperationId] = useState<string>("");
  const [methodePesee, setMethodePesee] = useState<"balance" | "declarative">("declarative");
  const [poidsAvantRecharge, setPoidsAvantRecharge] = useState("");
  const [poidsApresRecharge, setPoidsApresRecharge] = useState("");
  const [poidsAvantRecup, setPoidsAvantRecup] = useState("");
  const [poidsApresRecup, setPoidsApresRecup] = useState("");
  const [allBouteilles, setAllBouteilles] = useState<Bouteille[]>([]);

  const config = useMemo(
    () => INTERVENTIONS.find((t) => t.v === typeIntervention) ?? INTERVENTIONS[0],
    [typeIntervention]
  );
  const selectedFluide = useMemo(
    () => FLUIDES.find((f) => f.code === fluide) ?? FLUIDES[0],
    [fluide]
  );

  // Charge les bouteilles existantes au mount + après ajout depuis modal
  useEffect(() => {
    setAllBouteilles(listBouteilles());
  }, []);

  // Auto-fill du n° de contenant BSFF depuis la bouteille de récupération
  // (priorité), sinon recharge. Préserve une saisie manuelle si elle existe.
  useEffect(() => {
    let resolved = "";
    if (bouteilleRecuperationId) {
      const b = allBouteilles.find((x) => x.id === bouteilleRecuperationId);
      if (b?.numeroSerie) resolved = b.numeroSerie;
    } else if (numBouteilleRetraitLibre.trim()) {
      resolved = numBouteilleRetraitLibre.trim();
    } else if (bouteilleRechargeId) {
      const b = allBouteilles.find((x) => x.id === bouteilleRechargeId);
      if (b?.numeroSerie) resolved = b.numeroSerie;
    } else if (numBouteilleAjoutLibre.trim()) {
      resolved = numBouteilleAjoutLibre.trim();
    }
    if (resolved) setPackagingNumero(resolved);
  }, [
    bouteilleRecuperationId,
    numBouteilleRetraitLibre,
    bouteilleRechargeId,
    numBouteilleAjoutLibre,
    allBouteilles,
  ]);

  // Quantités à tracer dans les bouteilles, dérivées des saisies simples
  // (gazAjouteKg / gazRetireKg) OU de la décomposition expert A/B/C/D/E.
  const qteRecharge = useMemo(() => {
    // Priorité 1 : décomposition expert si activée
    if (showFluideDecompose) {
      const v = parseFloat(fluideVierge) || 0;
      const r = parseFloat(fluideRecycle) || 0;
      const g = parseFloat(fluideRegenere) || 0;
      return v + r + g;
    }
    // Priorité 2 : saisie simple "gaz ajouté"
    const simple = parseFloat(gazAjouteKg) || 0;
    if (simple > 0) return simple;
    return 0;
  }, [showFluideDecompose, fluideVierge, fluideRecycle, fluideRegenere, gazAjouteKg]);

  const qteRecuperation = useMemo(() => {
    if (showFluideDecompose) {
      // D (traitement) + E (réutilisation) — partent dans la bouteille de récup
      const d = parseFloat(fluideTraitement) || 0;
      const e = parseFloat(fluideReutilisation) || 0;
      return d + e;
    }
    // Priorité 2 : saisie simple "gaz retiré"
    const simple = parseFloat(gazRetireKg) || 0;
    if (simple > 0) return simple;
    // Fallback : pour récupération sans décomposition → weight global
    if (config.needsBsff) return parseFloat(weight) || 0;
    return 0;
  }, [showFluideDecompose, fluideTraitement, fluideReutilisation, gazRetireKg, config.needsBsff, weight]);

  // Filtres bouteilles compatibles selon fluide + quantité
  const mouvementsIdx = useMemo(() => indexMouvementsParBouteille(), [allBouteilles]);

  const bouteillesRecharge = useMemo(
    () =>
      bouteillesCompatibles(allBouteilles, mouvementsIdx, {
        type: "recharge",
        fluideCode: selectedFluide.code,
        quantiteKg: qteRecharge > 0 ? qteRecharge : undefined,
      }),
    [allBouteilles, mouvementsIdx, selectedFluide.code, qteRecharge]
  );

  const bouteillesRecup = useMemo(
    () =>
      bouteillesCompatibles(allBouteilles, mouvementsIdx, {
        type: "recuperation",
        fluideCode: selectedFluide.code,
        quantiteKg: qteRecuperation > 0 ? qteRecuperation : undefined,
      }),
    [allBouteilles, mouvementsIdx, selectedFluide.code, qteRecuperation]
  );

  // Pré-remplissage depuis ?equipement=ID
  useEffect(() => {
    if (!eqIdParam) return;
    const eq = listEquipements().find((e) => e.id === eqIdParam);
    if (!eq) return;
    setClientName(eq.clientName);
    setModeleEquipement(eq.modele);
    setNumeroSerieEquipement(eq.numeroSerie);
    if (eq.clientEmail) setClientEmail(eq.clientEmail);
    if (eq.siteAdresse) {
      setLieuIntervention(eq.siteAdresse);
      // L'adresse du détenteur = par défaut l'adresse du site d'intervention
      setClientAdresse(eq.siteAdresse);
    }
    if (FLUIDES.some((f) => f.code === eq.fluide.code)) setFluide(eq.fluide.code);
    if (eq.chargeKg > 0) setWeight(eq.chargeKg.toFixed(2));
    setEqContext({ modele: eq.modele, clientName: eq.clientName });

    // Cherche la derniere intervention sur cet equipement (par n° de serie)
    // pour proposer "reprendre la meme intervention". On exclut la
    // typeIntervention "recuperation" qui declenche un BSFF — on ne propose
    // pas de la pre-cocher en aveugle (declenche un workflow TrackDechets
    // qui doit etre un choix explicite).
    const interventionsHere = listInterventions().filter(
      (i) =>
        i.numeroSerieEquipement?.trim().toLowerCase() ===
          eq.numeroSerie.trim().toLowerCase() &&
        i.typeIntervention !== "recuperation" &&
        i.typeIntervention !== "demantelement"
    );
    if (interventionsHere.length > 0) {
      // sort desc, plus recent en premier
      interventionsHere.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setLastInterventionOnEq(interventionsHere[0]);
    }
  }, [eqIdParam]);

  // Pré-remplissage depuis ?diagnosticId=ID (depuis /m/diagnostic après une
  // analyse photo IA → "Créer une intervention pour ce composant")
  useEffect(() => {
    if (!diagIdParam) return;
    const diag = getDiagnostic(diagIdParam);
    if (!diag) return;
    setDiagContext(diag);

    // Type par défaut : contrôle non périodique (= contrôle suite à fuite /
    // défaut détecté). C'est ce qui correspond le mieux au cas "un diagnostic
    // IA a détecté un défaut sur la photo, donc on déclenche une vérification
    // d'étanchéité hors du calendrier annuel". Le technicien peut switcher
    // vers maintenance / mise_service si le diag montre autre chose qu'une fuite.
    // On ne force que si pas déjà override par ?type=
    if (!typeParam) setTypeIntervention("controle_non_periodique");

    // Pre-remplissage des notes : version CONDENSEE (~250 chars) qui rentre
    // dans la case "Observations" du CERFA 15497*04. Le diagnostic complet
    // (photo + tous les defauts detailles + cause + devis) reste accessible
    // dans la page detail intervention via le lien diagnosticId — pas besoin
    // de tout repeter dans les observations CERFA qui ont peu de place.
    const summary = summarizeDiagnosticForCerfa(diag.result);
    const contextePrefix = diag.contexteNote?.trim()
      ? `Contexte : ${diag.contexteNote.trim()}. `
      : "";
    const prefilled = `${contextePrefix}${summary}`;
    setNotes((prev) => (prev.trim() ? `${prev.trim()}\n${prefilled}` : prefilled));
  }, [diagIdParam, typeParam]);

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

  function handleVoiceExtraction(extraction: ExtractionResult, transcript: string) {
    const filled = new Set<string>(dictedFields);
    const filledLabels: string[] = [];

    if (extraction.typeIntervention && INTERVENTIONS.find((i) => i.v === extraction.typeIntervention)) {
      setTypeIntervention(extraction.typeIntervention as TypeIntervention);
      filled.add("typeIntervention");
      filledLabels.push("type");
    }
    if (extraction.fluide && FLUIDES.find((f) => f.code === extraction.fluide)) {
      setFluide(extraction.fluide);
      filled.add("fluide");
      filledLabels.push("fluide");
    }
    if (typeof extraction.weight === "number" && extraction.weight > 0) {
      setWeight(extraction.weight.toFixed(3));
      filled.add("weight");
      filledLabels.push("poids");
    }
    if (extraction.packagingNumero) {
      setPackagingNumero(extraction.packagingNumero);
      filled.add("packagingNumero");
      filledLabels.push("contenant");
    }
    if (extraction.detecteurId) {
      setDetecteurId(extraction.detecteurId);
      filled.add("detecteurId");
    }
    if (extraction.detecteurPermanent) {
      setDetecteurPermanent(extraction.detecteurPermanent);
      filled.add("detecteurPermanent");
    }
    if (extraction.fuiteDetectee) {
      setFuiteDetectee(extraction.fuiteDetectee);
      filled.add("fuiteDetectee");
      filledLabels.push("étanchéité");
    }
    if (Array.isArray(extraction.fuites) && extraction.fuites.length > 0) {
      const newFuites = extraction.fuites
        .filter((f) => f.localisation && f.localisation.trim())
        .slice(0, 3)
        .map((f) => ({
          localisation: f.localisation.trim(),
          reparee: (f.reparee === "realisee" || f.reparee === "a_faire" ? f.reparee : "") as "" | "realisee" | "a_faire",
        }));
      if (newFuites.length > 0) {
        setFuites(newFuites);
        filled.add("fuites");
        filledLabels.push(`${newFuites.length} fuite${newFuites.length > 1 ? "s" : ""}`);
      }
    }

    // Propage les quantités extraites vers les champs SIMPLES (gazAjouté/Retiré)
    // visibles en haut + également vers la décomposition expert A/B/C/D/E.
    let anyDecompo = false;
    let anyGazSimple = false;
    if (typeof extraction.fluideVierge === "number" && extraction.fluideVierge > 0) {
      setFluideVierge(extraction.fluideVierge.toFixed(3));
      setGazAjouteKg(extraction.fluideVierge.toFixed(3));
      anyDecompo = true;
      anyGazSimple = true;
      filled.add("fluideVierge");
      filled.add("gazAjouteKg");
    }
    if (typeof extraction.fluideRecycle === "number" && extraction.fluideRecycle > 0) {
      setFluideRecycle(extraction.fluideRecycle.toFixed(3));
      // Recyclé = aussi du gaz ajouté côté pratique technicien
      setGazAjouteKg((prev) =>
        (parseFloat(prev || "0") + (extraction.fluideRecycle ?? 0)).toFixed(3)
      );
      anyDecompo = true;
      filled.add("fluideRecycle");
    }
    if (typeof extraction.fluideRegenere === "number" && extraction.fluideRegenere > 0) {
      setFluideRegenere(extraction.fluideRegenere.toFixed(3));
      setGazAjouteKg((prev) =>
        (parseFloat(prev || "0") + (extraction.fluideRegenere ?? 0)).toFixed(3)
      );
      anyDecompo = true;
      filled.add("fluideRegenere");
    }
    if (typeof extraction.fluideTraitement === "number" && extraction.fluideTraitement > 0) {
      setFluideTraitement(extraction.fluideTraitement.toFixed(3));
      setGazRetireKg(extraction.fluideTraitement.toFixed(3));
      anyDecompo = true;
      anyGazSimple = true;
      filled.add("fluideTraitement");
      filled.add("gazRetireKg");
    }
    if (typeof extraction.fluideReutilisation === "number" && extraction.fluideReutilisation > 0) {
      setFluideReutilisation(extraction.fluideReutilisation.toFixed(3));
      // Réutilisé = aussi du gaz retiré côté pratique technicien
      setGazRetireKg((prev) =>
        (parseFloat(prev || "0") + (extraction.fluideReutilisation ?? 0)).toFixed(3)
      );
      anyDecompo = true;
      filled.add("fluideReutilisation");
    }
    if (anyDecompo) {
      setShowFluideDecompose(true);
      filledLabels.push("décomposition fluide");
    }
    if (anyGazSimple) {
      filledLabels.push("gaz ajouté/retiré");
    }

    if (extraction.clientName && !clientName.trim()) {
      setClientName(extraction.clientName);
      filled.add("clientName");
      filledLabels.push("client");

      // Propage vers le signataire CERFA case [2] : 99% du temps,
      // le client EST le détenteur signataire. Si déjà rempli manuellement,
      // on respecte. L'utilisateur peut toujours override avant signature.
      if (!detenteurName.trim()) {
        setDetenteurName(extraction.clientName);
        filled.add("detenteurName");
      }
    }
    // Qualité signataire : "gérant", "propriétaire", "locataire"…
    // Si non dictée, on met "Détenteur" par défaut (valeur conforme CERFA).
    if (!detenteurQuality.trim()) {
      const quality = extraction.clientQuality?.trim() || (extraction.clientName ? "Détenteur" : "");
      if (quality) {
        setDetenteurQuality(quality);
        filled.add("detenteurQuality");
        if (extraction.clientQuality?.trim()) filledLabels.push("qualité signataire");
      }
    }
    if (extraction.clientAdresse && !clientAdresse.trim()) {
      setClientAdresse(extraction.clientAdresse);
      filled.add("clientAdresse");
    }
    if (extraction.lieuIntervention && !lieuIntervention.trim()) {
      setLieuIntervention(extraction.lieuIntervention);
      filled.add("lieuIntervention");
    }

    // Notes : on append (ne pas écraser ce qui existe), prefixé "Dicté : "
    if (extraction.notes && extraction.notes.trim()) {
      const dictee = extraction.notes.trim();
      setNotes((prev) => (prev.trim() ? `${prev.trim()}\n\nDicté : ${dictee}` : `Dicté : ${dictee}`));
      filled.add("notes");
    } else if (transcript && !notes.trim()) {
      // Si l'IA n'a rien mis en notes mais qu'on a un transcript, le mettre brut
      setNotes(`Dicté : ${transcript.trim()}`);
      filled.add("notes");
    }

    setDictedFields(filled);

    const summary =
      filledLabels.length > 0
        ? `✓ ${filledLabels.length} champ${filledLabels.length > 1 ? "s" : ""} rempli${filledLabels.length > 1 ? "s" : ""} : ${filledLabels.join(", ")}. Confiance ${extraction.confiance}.`
        : `Aucun champ détecté dans la dictée — réessaie avec plus de détails. Confiance ${extraction.confiance}.`;
    setVoiceInfo(summary);
    setVoiceOpen(false);
  }

  /**
   * Construit un DraftIntervention depuis les states actuels du formulaire
   * et lance les checks d'integrite. Retourne le rapport. Pure fonction —
   * pas de side effect. Utilise par handleValidateThenSubmit (au click du
   * bouton final) et eventuellement en V2 pour du live-feedback inline.
   */
  function runIntegrityChecks(): IntegrityReport {
    const eqFromPark = eqIdParam ? listEquipements().find((e) => e.id === eqIdParam) : undefined;
    const draft: DraftIntervention = {
      typeIntervention,
      fluide: { code: selectedFluide.code, gwp: selectedFluide.gwp },
      weight: parseFloat(weight) || 0,
      packagingNumero: packagingNumero.trim() || undefined,
      clientName: clientName.trim() || null,
      modeleEquipement: modeleEquipement.trim() || undefined,
      numeroSerieEquipement: numeroSerieEquipement.trim() || undefined,
      lieuIntervention: lieuIntervention.trim() || undefined,
      controleDetails: config.needsControle
        ? { detecteurPermanent: detecteurPermanent === "oui" }
        : undefined,
      notes: notes.trim() || undefined,
      hasDetenteurSignature: Boolean(detenteurSignatureDataUrl),
      detenteurName: detenteurName.trim() || undefined,
      detenteurQuality: detenteurQuality.trim() || undefined,
      hasOperateurSignature: Boolean(loadProfil().signatureDataUrl),
      dateInterventionISO: new Date().toISOString(),
    };
    return checkInterventionIntegrity({
      intervention: draft,
      equipement: eqFromPark ?? null,
      profil: loadProfil(),
      historiqueInterventions: listInterventions(),
    });
  }

  /**
   * Wrapper du submit qui passe par le garde-fou qualite. Si on detecte
   * des issues blocantes ou des alertes, on ouvre la modal au lieu de
   * lancer la generation. Si rien ou que des "info", on submit direct.
   */
  async function handleValidateThenSubmit() {
    const report = runIntegrityChecks();
    if (report.hasBlocking || report.hasAlertes) {
      setIntegrityReport(report);
      setIntegrityModalOpen(true);
      return;
    }
    // Que des infos OU rien → on laisse passer direct
    await handleSubmit();
  }

  async function handleSubmit() {
    let bsffId: string | undefined;
    let destination: unknown = null;

    // Validation : BSFF requis = il faut un n° de contenant.
    // Le packagingNumero est auto-rempli depuis la bouteille sélectionnée,
    // mais si rien n'a été saisi → bloque avec message clair.
    if (config.needsBsff && !packagingNumero.trim()) {
      setStatus({
        type: "error",
        message:
          "Pour générer le BSFF officiel, renseigne la bouteille de récupération (section Mouvements de gaz) — son n° de série sera utilisé comme contenant BSFF.",
      });
      return;
    }

    try {
      if (config.needsBsff) {
        const profilTransport = loadProfil();
        const liveMode =
          profilTransport.trackdechetsMode === "production" &&
          Boolean(profilTransport.trackdechetsToken?.trim());
        setStatus({
          type: "loading",
          step: liveMode
            ? "Signature officielle du BSFF (TrackDéchets prod)…"
            : "Création du bordereau BSFF (mode démo)…",
        });
        // En mode officiel : on envoie token + identité user + destination du profil.
        // En mode démo : champs vides → fallback sandbox Vertxia côté serveur.
        const emitterCompany = liveMode && profilTransport.siret
          ? {
              siret: profilTransport.siret.replace(/\s+/g, ""),
              name: profilTransport.raisonSociale,
              address: [
                profilTransport.adresseRue,
                profilTransport.adresseCp,
                profilTransport.adresseVille,
              ]
                .filter(Boolean)
                .join(", "),
              contact: profilTransport.raisonSociale,
              phone: profilTransport.telephone,
              mail: profilTransport.email,
            }
          : undefined;
        const destinationCompany = liveMode && profilTransport.bsffDestinationSiret
          ? {
              siret: profilTransport.bsffDestinationSiret.replace(/\s+/g, ""),
              name: profilTransport.bsffDestinationName || "",
              address: profilTransport.bsffDestinationAddress || "",
            }
          : undefined;
        const res = await fetch("/api/bsff/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fluide: selectedFluide,
            weight: parseFloat(weight),
            packagingNumero,
            clientName: clientName.trim() || null,
            immatriculation: profilTransport.immatriculationVehicule || undefined,
            userToken: liveMode ? profilTransport.trackdechetsToken : undefined,
            apiMode: liveMode ? "production" : "sandbox",
            emitterCompany,
            destinationCompany,
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
      let profil = loadProfil();
      // Si le profil local est vide (autre device / nouveau navigateur), pull
      // depuis Supabase pour avoir au moins raison sociale + tel + email +
      // numero attestation avant de generer CERFA + fiche de visite.
      if (!profil.raisonSociale && !profil.numeroAttestation) {
        try {
          const res = await fetch("/api/public/my-profile", {
            method: "GET",
            headers: { "cache-control": "no-store" },
          });
          if (res.ok) {
            const j = (await res.json()) as {
              data: {
                raisonSociale?: string;
                telephone?: string;
                email?: string;
                numeroAttestation?: string;
              } | null;
            };
            if (j.data && (j.data.raisonSociale || j.data.numeroAttestation)) {
              const { saveProfil } = await import("@/lib/profil");
              profil = saveProfil({ ...profil, ...j.data });
            }
          }
        } catch {
          /* silent : on continue avec profil local meme vide */
        }
      }
      const operateur = profil.raisonSociale
        ? {
            name: profil.raisonSociale,
            quality: profil.categorieAttestation
              ? `Technicien Cat. ${profil.categorieAttestation}`
              : "Technicien",
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

      const detenteurInfoPayload =
        clientSiret.trim() || clientAdresse.trim()
          ? {
              siret: clientSiret.trim() || undefined,
              adresse: clientAdresse.trim() || undefined,
            }
          : undefined;

      // Multi-fuites : ne garde que les fuites avec une localisation non vide
      const fuitesPayload =
        config.needsControle && fuiteDetectee === "oui"
          ? fuites
              .filter((f) => f.localisation.trim())
              .slice(0, 3)
              .map((f) => ({
                localisation: f.localisation.trim(),
                reparee: f.reparee === "" ? undefined : f.reparee,
              }))
          : undefined;

      // Décomposition fluide A/B/C/D/E
      // Priorité 1 : si décomposition expert activée → utilise ces valeurs fines
      // Priorité 2 : sinon → mappe les saisies simples gazAjoute/Retire vers A/D
      const parseKg = (s: string): number | undefined => {
        const v = parseFloat(s.replace(",", "."));
        return Number.isFinite(v) && v > 0 ? v : undefined;
      };
      const fluideManipulePayload = config.needsBsff
        ? showFluideDecompose
          ? (() => {
              const fm = {
                vierge: parseKg(fluideVierge),
                recycle: parseKg(fluideRecycle),
                regenere: parseKg(fluideRegenere),
                recupereTraitement: parseKg(fluideTraitement),
                recupereReutilisation: parseKg(fluideReutilisation),
              };
              return Object.values(fm).some((v) => v !== undefined) ? fm : undefined;
            })()
          : (() => {
              // Pas de décomposition expert → on convertit les saisies simples
              const vierge = parseKg(gazAjouteKg);
              const traitement = parseKg(gazRetireKg);
              if (vierge !== undefined || traitement !== undefined) {
                return { vierge, recupereTraitement: traitement };
              }
              return undefined;
            })()
        : undefined;

      // N° bouteilles saisies à la main (pas dans le stock) → trace dans notes
      const numBouteilleNotes = [
        numBouteilleAjoutLibre.trim() ? `Bouteille recharge n° ${numBouteilleAjoutLibre.trim()}` : null,
        numBouteilleRetraitLibre.trim() ? `Bouteille récupération n° ${numBouteilleRetraitLibre.trim()}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const notesAvecBouteilles = [
        notes.trim() || null,
        numBouteilleNotes || null,
      ]
        .filter(Boolean)
        .join("\n");

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
        detenteur: detenteurInfoPayload,
        detenteurSignature: detenteurSignaturePayload,
        fluideManipule: fluideManipulePayload,
        observationsLibres: notesAvecBouteilles || undefined,
        controleDetails: config.needsControle
          ? {
              detecteurId: detecteurId.trim() || undefined,
              detecteurPermanent: detecteurPermanent === "oui",
              fuiteDetectee: fuiteDetectee === "oui",
              fuites: fuitesPayload && fuitesPayload.length > 0 ? fuitesPayload : undefined,
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
        const msg = err.detail
          ? `${err.error || "Échec CERFA"} — ${err.detail}`
          : err.error || "Échec CERFA";
        setStatus({ type: "error", message: msg });
        return;
      }
      const cerfaBlob = await cerfaRes.blob();
      const cerfaUrl = URL.createObjectURL(cerfaBlob);

      // Mouvements bouteilles — créés AVANT le rapport pour pouvoir les
      // référencer dans le registre. Non-bloquant : si erreur ou pas de
      // bouteille sélectionnée, on continue silencieusement.
      try {
        const interventionTimestamp = new Date().toISOString();
        const interventionLabel = `Intervention ${typeIntervention} · ${clientName.trim() || "client n/c"}`;

        if (bouteilleRechargeId && qteRecharge > 0) {
          const pa = methodePesee === "balance" ? parseFloat(poidsAvantRecharge) || undefined : undefined;
          const pap = methodePesee === "balance" ? parseFloat(poidsApresRecharge) || undefined : undefined;
          const qte =
            methodePesee === "balance" && typeof pa === "number" && typeof pap === "number"
              ? quantiteDepuisPesee(pa, pap)
              : qteRecharge;
          createMouvement({
            dateMouvementISO: interventionTimestamp,
            bouteilleId: bouteilleRechargeId,
            type: "sortie",
            quantiteKg: qte,
            methode: methodePesee,
            poidsAvantKg: pa,
            poidsApresKg: pap,
            equipementId: eqIdParam ?? undefined,
            clientName: clientName.trim() || undefined,
            operateurName: profil.raisonSociale,
            notes: interventionLabel,
          });
        }

        if (bouteilleRecuperationId && qteRecuperation > 0) {
          const pa = methodePesee === "balance" ? parseFloat(poidsAvantRecup) || undefined : undefined;
          const pap = methodePesee === "balance" ? parseFloat(poidsApresRecup) || undefined : undefined;
          const qte =
            methodePesee === "balance" && typeof pa === "number" && typeof pap === "number"
              ? quantiteDepuisPesee(pa, pap)
              : qteRecuperation;
          createMouvement({
            dateMouvementISO: interventionTimestamp,
            bouteilleId: bouteilleRecuperationId,
            type: "entree",
            quantiteKg: qte,
            methode: methodePesee,
            poidsAvantKg: pa,
            poidsApresKg: pap,
            equipementId: eqIdParam ?? undefined,
            bsffId,
            clientName: clientName.trim() || undefined,
            operateurName: profil.raisonSociale,
            notes: interventionLabel,
          });
        }
      } catch (e) {
        console.warn("[bouteilles] création mouvements échouée :", e);
      }

      // Fiche de visite client (PDF "humain" brandable) — non-bloquant :
      // si le profil entreprise n'est pas rempli, on continue sans (silent).
      let rapportUrl: string | undefined;
      try {
        setStatus({ type: "loading", step: "Génération de la fiche de visite client…" });
        const rapportRes = await fetch("/api/rapport/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...cerfaPayload, profil }),
        });
        if (rapportRes.ok) {
          const rapportBlob = await rapportRes.blob();
          rapportUrl = URL.createObjectURL(rapportBlob);
        } else {
          // Profil pas rempli ou autre erreur — on log mais on continue
          console.warn("[rapport] non généré :", await rapportRes.text());
        }
      } catch (e) {
        console.warn("[rapport] exception :", e);
      }

      // Synchronisation du parc d'équipements :
      // - Cas A (form vierge avec infos minimales) → CRÉE l'équipement dans le parc
      //   pour qu'il apparaisse dans /m/equipements et soit relancable à 30j.
      // - Cas B (intervention sur équipement déjà enregistré) → UPDATE le
      //   dernierControleISO si c'est un contrôle (déclenche le compteur 12 mois).
      // Bloc try/catch silencieux : si ça plante, l'intervention reste sauvée.
      // Le résultat (linkedEquipementId) sert à lier l'intervention à l'équipement
      // dans Supabase pour le partage public (Niveau 1).
      let linkedEquipementId: string | undefined = eqIdParam ?? undefined;
      try {
        const isControle = config.needsControle;
        if (!eqIdParam) {
          // Form vierge : on crée si on a les champs minimum
          const hasMinimum =
            clientName.trim().length > 0 &&
            modeleEquipement.trim().length > 0 &&
            numeroSerieEquipement.trim().length > 0;
          if (hasMinimum) {
            const chargeKgRaw = parseFloat(weight);
            const chargeKg =
              !config.needsBsff && Number.isFinite(chargeKgRaw) && chargeKgRaw > 0
                ? chargeKgRaw
                : 0;
            const createdEq = saveEquipement({
              clientName: clientName.trim(),
              clientEmail: clientEmail.trim() || undefined,
              siteAdresse: clientAdresse.trim() || lieuIntervention.trim() || undefined,
              modele: modeleEquipement.trim(),
              numeroSerie: numeroSerieEquipement.trim(),
              fluide: selectedFluide,
              chargeKg,
              detecteurFixe: detecteurPermanent === "oui",
              dernierControleISO: isControle ? new Date().toISOString() : undefined,
            });
            linkedEquipementId = createdEq.id;
          }
        } else if (isControle) {
          // Équipement existant : on bump le dernier contrôle d'étanchéité
          updateEquipement(eqIdParam, {
            dernierControleISO: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn("[parc] sync équipement échouée :", e);
      }

      try {
        saveIntervention({
          equipementId: linkedEquipementId,
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
                // Rétrocompat : on stocke la 1ère localisation dans le champ legacy
                fuiteLocalisation:
                  fuitesPayload && fuitesPayload.length > 0
                    ? fuitesPayload.map((f) => f.localisation).join(" | ")
                    : undefined,
              }
            : undefined,
          notes: notes.trim() || undefined,
          hasDetenteurSignature: Boolean(detenteurSignaturePayload),
          detenteurName: detenteurSignaturePayload ? detenteurSignaturePayload.name : undefined,
          detenteurQuality: detenteurSignaturePayload?.quality,
          diagnosticId: diagIdParam || undefined,
        });
      } catch {}

      setStatus({
        type: "success",
        bsffId,
        cerfaUrl,
        rapportUrl,
        clientEmail: clientEmail.trim() || undefined,
        clientName: clientName.trim() || undefined,
        typeIntervention,
        modeleEquipement: modeleEquipement.trim() || undefined,
      });
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

      {/* Documents officiels lies au type d'intervention en cours -
          le frigoriste a le CERFA + le modele de registre + la note DGEC
          pertinents en 1 tap, meme offline. Plie par defaut (compteur visible). */}
      <DocumentsForInterventionCard type={typeIntervention} />

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

      {/* "Reprendre la meme intervention" — si on a une intervention precedente
          enregistree sur cet equipement, on propose un raccourci qui pre-remplit
          tous les champs metier identiques. Aligne avec le brief #6 et le north
          star "l'utilisateur ne remplit plus rien". */}
      {lastInterventionOnEq && (
        <div className="mx-4 mt-2 mb-1 px-4 py-3 rounded-2xl bg-[#111]/5 ring-1 ring-[#111]/10">
          <div className="flex items-start gap-3">
            <div className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#111] text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9" />
                <path d="M3 4v5h5" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-mono tracking-widest uppercase text-black/55">
                Intervention précédente
              </div>
              <div className="mt-0.5 text-[13.5px] text-[#111] leading-snug">
                {(INTERVENTIONS.find((i) => i.v === lastInterventionOnEq.typeIntervention)?.label ?? lastInterventionOnEq.typeIntervention)} · {new Date(lastInterventionOnEq.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
              </div>
              <button
                type="button"
                onClick={() => {
                  const last = lastInterventionOnEq;
                  if (INTERVENTIONS.find((i) => i.v === last.typeIntervention)) {
                    setTypeIntervention(last.typeIntervention);
                  }
                  if (last.controleDetails?.detecteurPermanent !== undefined) {
                    setDetecteurPermanent(last.controleDetails.detecteurPermanent ? "oui" : "non");
                  }
                  if (last.detenteurName) setDetenteurName(last.detenteurName);
                  if (last.detenteurQuality) setDetenteurQuality(last.detenteurQuality);
                  if (last.packagingNumero) setPackagingNumero(last.packagingNumero);
                  if (last.lieuIntervention && !lieuIntervention.trim()) {
                    setLieuIntervention(last.lieuIntervention);
                  }
                  const dateFR = new Date(last.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  });
                  setNotes((prev) => {
                    const ref = `Cf. intervention précédente du ${dateFR}.`;
                    if (!prev.trim()) return ref;
                    if (prev.includes(ref)) return prev;
                    return `${prev.trim()}\n${ref}`;
                  });
                  setLastInterventionOnEq(null);
                }}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111] text-white text-[12px] font-medium active:bg-black/85 transition-colors"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Reprendre la même intervention
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contexte diagnostic IA si pré-rempli */}
      {diagContext && (
        <div className="mx-4 mt-2 mb-1 px-4 py-3 rounded-2xl bg-[#A16207]/8 ring-1 ring-[#A16207]/20">
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={diagContext.imageDataUrl}
              alt="Composant diagnostiqué"
              className="shrink-0 w-16 h-16 rounded-xl object-cover ring-1 ring-black/10"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-mono tracking-widest uppercase text-[#A16207]">
                Intervention issue d&apos;un diagnostic IA
              </div>
              <div className="mt-0.5 text-[14px] text-[#111] font-medium leading-snug">
                {diagContext.result.composantIdentifie || "Composant non identifié"}
              </div>
              <div className="mt-0.5 text-[12px] text-black/60 leading-snug">
                {diagContext.result.defautsDetectes.length > 0
                  ? `${diagContext.result.defautsDetectes.length} défaut${diagContext.result.defautsDetectes.length > 1 ? "s" : ""} · ${DELAI_LABELS[diagContext.result.delaiIntervention]}`
                  : "État apparent nominal"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DICTÉE IA — remplit le formulaire vocal */}
      <div className="mx-4 mt-3 mb-2">
        <button
          type="button"
          onClick={() => setVoiceOpen(true)}
          disabled={isLoading}
          className="w-full px-5 py-4 rounded-2xl bg-[#111] text-white text-[15px] font-semibold flex items-center justify-center gap-3 active:bg-black/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] disabled:opacity-50"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
          <span>Dicter l&apos;intervention complète</span>
        </button>
        <div className="mt-2 text-[11px] text-black/45 text-center leading-relaxed">
          Parle 30 secondes, l&apos;IA range tout dans les bonnes cases du CERFA
        </div>
        {voiceInfo && (
          <div className="mt-3 px-4 py-3 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 text-[13px] text-emerald-900 leading-relaxed">
            {voiceInfo}
          </div>
        )}
      </div>

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
        <FormRow label="Email du client (optionnel)">
          <input
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            placeholder="Pour l'envoi auto du CERFA"
            disabled={isLoading}
            className="input-mobile"
            autoComplete="off"
            autoCapitalize="off"
          />
        </FormRow>
        <FormRow label="SIRET détenteur (optionnel)">
          <input
            type="text"
            inputMode="numeric"
            value={clientSiret}
            onChange={(e) => setClientSiret(e.target.value)}
            placeholder="14 chiffres si entreprise"
            disabled={isLoading}
            className="input-mobile font-mono"
          />
        </FormRow>
        <FormRow label="Adresse détenteur (optionnel)">
          <input
            type="text"
            value={clientAdresse}
            onChange={(e) => setClientAdresse(e.target.value)}
            placeholder="Si différente du lieu d'intervention"
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
            {/* N° de bouteille : géré dans la section "Mouvements de gaz" ci-dessous.
                Le n° du contenant BSFF = automatiquement le n° de la bouteille
                de récupération sélectionnée. Si pas de bouteille, fallback recharge. */}
          </>
        )}
      </InsetListSection>

      {/* Décomposition fluide manipulé [11] — optionnelle, pour audit DREAL/DREETS */}
      {config.needsBsff && (
        <InsetListSection
          title="Décomposition fluide (optionnel)"
          footer="Pour les contrôles audit DREAL/DREETS, tu peux détailler la part de fluide vierge, recyclé, régénéré chargée et la part destinée au traitement vs réutilisation. Si tu laisses vide, tout est considéré comme récupéré pour réutilisation."
        >
          <div className="px-4 py-3">
            <button
              type="button"
              onClick={() => setShowFluideDecompose((v) => !v)}
              className="w-full px-4 py-2.5 rounded-xl bg-black/[0.04] text-[13px] font-medium text-black/70 active:bg-black/[0.08] flex items-center justify-center gap-2"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              <span>{showFluideDecompose ? "Masquer le détail" : "Détailler A+B+C / D+E"}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transform: showFluideDecompose ? "rotate(180deg)" : "none" }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
          {showFluideDecompose && (
            <>
              <FormRow label="A — Fluide vierge chargé (kg)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={fluideVierge}
                  onChange={(e) => setFluideVierge(e.target.value)}
                  placeholder="0.00"
                  disabled={isLoading}
                  className="input-mobile"
                />
              </FormRow>
              <FormRow label="B — Fluide recyclé chargé (kg)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={fluideRecycle}
                  onChange={(e) => setFluideRecycle(e.target.value)}
                  placeholder="0.00"
                  disabled={isLoading}
                  className="input-mobile"
                />
              </FormRow>
              <FormRow label="C — Fluide régénéré chargé (kg)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={fluideRegenere}
                  onChange={(e) => setFluideRegenere(e.target.value)}
                  placeholder="0.00"
                  disabled={isLoading}
                  className="input-mobile"
                />
              </FormRow>
              <FormRow label="D — Récupéré pour traitement (kg)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={fluideTraitement}
                  onChange={(e) => setFluideTraitement(e.target.value)}
                  placeholder="0.00"
                  disabled={isLoading}
                  className="input-mobile"
                />
              </FormRow>
              <FormRow label="E — Récupéré pour réutilisation (kg)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={fluideReutilisation}
                  onChange={(e) => setFluideReutilisation(e.target.value)}
                  placeholder="0.00"
                  disabled={isLoading}
                  className="input-mobile"
                />
              </FormRow>
            </>
          )}
        </InsetListSection>
      )}

      {/* Mouvements de gaz — toujours visibles, saisies simples ajouté/retiré */}
      <InsetListSection
        title="Mouvements de gaz · cette intervention"
        footer="Saisis simplement combien de gaz tu as ajouté et/ou retiré. La bouteille (n° de série) peut être choisie dans ton stock ou saisie à la main. Le n° de la bouteille de récupération sert aussi de n° de contenant pour le BSFF officiel."
      >
        {/* Bandeau charge nominale (read-only, contexte) */}
        {eqContext && parseFloat(weight) > 0 && (
          <div className="px-4 py-2.5 bg-black/[0.03] border-b border-black/[0.06]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-black/55">
                📊 Charge nominale du circuit
              </span>
              <span className="text-[14px] font-mono text-[#111]">
                {weight} kg de {selectedFluide.code}
              </span>
            </div>
          </div>
        )}

        {/* Méthode de saisie */}
        <div className="px-4 py-3 border-b border-black/[0.06]">
          <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-2">
            Méthode de saisie
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMethodePesee("declarative")}
              className={`px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                methodePesee === "declarative"
                  ? "bg-[#111] text-white"
                  : "bg-black/[0.04] text-[#111] active:bg-black/[0.08]"
              }`}
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              Saisie directe
            </button>
            <button
              type="button"
              onClick={() => setMethodePesee("balance")}
              className={`px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                methodePesee === "balance"
                  ? "bg-[#111] text-white"
                  : "bg-black/[0.04] text-[#111] active:bg-black/[0.08]"
              }`}
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              Pesée balance
            </button>
          </div>
        </div>

        {/* ── GAZ AJOUTÉ (recharge) ───────────────────────────────────── */}
        <div className="px-4 py-3 border-b border-black/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-[14px] font-bold">+</span>
            <span className="text-[14px] font-semibold text-[#111]">Gaz AJOUTÉ (recharge)</span>
          </div>

          {methodePesee === "declarative" ? (
            <div className="mb-3">
              <label className="block text-[10px] uppercase tracking-wider text-black/40 mb-1">
                Quantité ajoutée (kg)
              </label>
              <input
                type="number"
                step="0.001"
                value={gazAjouteKg}
                onChange={(e) => setGazAjouteKg(e.target.value)}
                placeholder="Ex : 0.200"
                inputMode="decimal"
                disabled={isLoading}
                className="input-mobile"
              />
            </div>
          ) : (
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-black/40 mb-1">Poids bouteille AVANT (kg)</label>
                <input
                  type="number"
                  step="0.001"
                  value={poidsAvantRecharge}
                  onChange={(e) => {
                    setPoidsAvantRecharge(e.target.value);
                    const a = parseFloat(e.target.value);
                    const b = parseFloat(poidsApresRecharge);
                    if (Number.isFinite(a) && Number.isFinite(b)) {
                      setGazAjouteKg(Math.abs(a - b).toFixed(3));
                    }
                  }}
                  inputMode="decimal"
                  className="input-mobile"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-black/40 mb-1">Poids bouteille APRÈS (kg)</label>
                <input
                  type="number"
                  step="0.001"
                  value={poidsApresRecharge}
                  onChange={(e) => {
                    setPoidsApresRecharge(e.target.value);
                    const a = parseFloat(poidsAvantRecharge);
                    const b = parseFloat(e.target.value);
                    if (Number.isFinite(a) && Number.isFinite(b)) {
                      setGazAjouteKg(Math.abs(a - b).toFixed(3));
                    }
                  }}
                  inputMode="decimal"
                  className="input-mobile"
                />
              </div>
              {gazAjouteKg && (
                <div className="col-span-2 text-[12px] text-emerald-700">
                  Quantité calculée : {gazAjouteKg} kg
                </div>
              )}
            </div>
          )}

          {/* Sélection bouteille — depuis stock OU saisie libre */}
          {(parseFloat(gazAjouteKg) > 0 || methodePesee === "balance") && (
            <>
              <label className="block text-[10px] uppercase tracking-wider text-black/40 mb-1">
                Bouteille de recharge ({selectedFluide.code})
              </label>
              {bouteillesRecharge.length > 0 && (
                <select
                  value={bouteilleRechargeId}
                  onChange={(e) => {
                    setBouteilleRechargeId(e.target.value);
                    if (e.target.value) setNumBouteilleAjoutLibre(""); // évite double saisie
                  }}
                  className="input-mobile mb-2"
                  disabled={isLoading}
                >
                  <option value="">— Choisir dans mon stock —</option>
                  {bouteillesRecharge.map(({ bouteille: b, chargeActuelle, pct, compatible, raison }) => (
                    <option key={b.id} value={b.id} disabled={!compatible}>
                      #{b.numeroSerie} · {chargeActuelle.toFixed(2)}kg ({pct.toFixed(0)}%){compatible ? "" : ` · ${raison}`}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={numBouteilleAjoutLibre}
                onChange={(e) => {
                  setNumBouteilleAjoutLibre(e.target.value);
                  if (e.target.value) setBouteilleRechargeId(""); // évite double saisie
                }}
                placeholder={bouteillesRecharge.length > 0 ? "ou saisir un n° de série libre" : "N° de série de la bouteille (ex : B112026047)"}
                disabled={isLoading}
                className="input-mobile"
                autoCapitalize="characters"
              />
              {bouteillesRecharge.length === 0 && (
                <div className="mt-1 text-[11px] text-black/50">
                  Aucune bouteille {selectedFluide.code} dans ton stock.{" "}
                  <a href="/m/bouteilles/nouvelle" className="text-[#A16207] underline">Enregistrer une bouteille</a>{" "}
                  pour le suivi automatique, ou saisis juste son n° de série ci-dessus pour le tracer dans le CERFA.
                </div>
              )}
            </>
          )}
        </div>

        {/* ── GAZ RETIRÉ (récupération) ────────────────────────────────── */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-700 text-[14px] font-bold">−</span>
            <span className="text-[14px] font-semibold text-[#111]">Gaz RETIRÉ (récupération)</span>
          </div>

          {methodePesee === "declarative" ? (
            <div className="mb-3">
              <label className="block text-[10px] uppercase tracking-wider text-black/40 mb-1">
                Quantité retirée (kg)
              </label>
              <input
                type="number"
                step="0.001"
                value={gazRetireKg}
                onChange={(e) => setGazRetireKg(e.target.value)}
                placeholder="Ex : 0.800"
                inputMode="decimal"
                disabled={isLoading}
                className="input-mobile"
              />
            </div>
          ) : (
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-black/40 mb-1">Poids bouteille AVANT (kg)</label>
                <input
                  type="number"
                  step="0.001"
                  value={poidsAvantRecup}
                  onChange={(e) => {
                    setPoidsAvantRecup(e.target.value);
                    const a = parseFloat(e.target.value);
                    const b = parseFloat(poidsApresRecup);
                    if (Number.isFinite(a) && Number.isFinite(b)) {
                      setGazRetireKg(Math.abs(b - a).toFixed(3));
                    }
                  }}
                  inputMode="decimal"
                  className="input-mobile"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-black/40 mb-1">Poids bouteille APRÈS (kg)</label>
                <input
                  type="number"
                  step="0.001"
                  value={poidsApresRecup}
                  onChange={(e) => {
                    setPoidsApresRecup(e.target.value);
                    const a = parseFloat(poidsAvantRecup);
                    const b = parseFloat(e.target.value);
                    if (Number.isFinite(a) && Number.isFinite(b)) {
                      setGazRetireKg(Math.abs(b - a).toFixed(3));
                    }
                  }}
                  inputMode="decimal"
                  className="input-mobile"
                />
              </div>
              {gazRetireKg && (
                <div className="col-span-2 text-[12px] text-red-700">
                  Quantité calculée : {gazRetireKg} kg
                </div>
              )}
            </div>
          )}

          {(parseFloat(gazRetireKg) > 0 || methodePesee === "balance") && (
            <>
              <label className="block text-[10px] uppercase tracking-wider text-black/40 mb-1">
                Bouteille de récupération ({selectedFluide.code})
              </label>
              {bouteillesRecup.length > 0 && (
                <select
                  value={bouteilleRecuperationId}
                  onChange={(e) => {
                    setBouteilleRecuperationId(e.target.value);
                    if (e.target.value) setNumBouteilleRetraitLibre("");
                  }}
                  className="input-mobile mb-2"
                  disabled={isLoading}
                >
                  <option value="">— Choisir dans mon stock —</option>
                  {bouteillesRecup.map(({ bouteille: b, chargeActuelle, pct, compatible, raison }) => (
                    <option key={b.id} value={b.id} disabled={!compatible}>
                      #{b.numeroSerie} · {chargeActuelle.toFixed(2)}kg ({pct.toFixed(0)}%){compatible ? "" : ` · ${raison}`}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={numBouteilleRetraitLibre}
                onChange={(e) => {
                  setNumBouteilleRetraitLibre(e.target.value);
                  if (e.target.value) setBouteilleRecuperationId("");
                }}
                placeholder={bouteillesRecup.length > 0 ? "ou saisir un n° de série libre" : "N° de série de la bouteille (ex : RC2026-089)"}
                disabled={isLoading}
                className="input-mobile"
                autoCapitalize="characters"
              />
              {bouteillesRecup.length === 0 && (
                <div className="mt-1 text-[11px] text-black/50">
                  Aucune bouteille de récupération {selectedFluide.code} dans ton stock.{" "}
                  <a href="/m/bouteilles/nouvelle" className="text-[#A16207] underline">Enregistrer une bouteille</a>{" "}
                  pour le suivi automatique, ou saisis juste son n° de série ci-dessus.
                </div>
              )}
            </>
          )}
        </div>
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
            <>
              {fuites.map((fuite, idx) => (
                <div key={idx} className="px-4 py-3 border-t border-black/[0.04] first:border-t-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] font-medium text-black/45 uppercase tracking-wide">
                      Fuite {idx + 1}
                    </div>
                    {fuites.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setFuites((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-[11px] text-red-600 active:underline"
                        style={{ WebkitTapHighlightColor: "transparent" }}
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={fuite.localisation}
                    onChange={(e) =>
                      setFuites((prev) =>
                        prev.map((f, i) => (i === idx ? { ...f, localisation: e.target.value } : f))
                      )
                    }
                    placeholder="Ex : Raccord côté liquide unité ext."
                    disabled={isLoading}
                    className="input-mobile"
                  />
                  <div className="mt-3">
                    <div className="text-[11px] font-medium text-black/45 uppercase tracking-wide mb-2">
                      Réparation
                    </div>
                    <div className="flex bg-black/[0.05] rounded-xl p-1">
                      {[
                        { v: "", label: "—" },
                        { v: "realisee", label: "Réalisée" },
                        { v: "a_faire", label: "À faire" },
                      ].map((opt) => (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() =>
                            setFuites((prev) =>
                              prev.map((f, i) =>
                                i === idx
                                  ? { ...f, reparee: opt.v as "" | "realisee" | "a_faire" }
                                  : f
                              )
                            )
                          }
                          className={`flex-1 px-2 py-2 rounded-lg text-[13px] font-medium transition-all ${
                            fuite.reparee === opt.v
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
                </div>
              ))}
              {fuites.length < 3 && (
                <div className="px-4 py-3 border-t border-black/[0.04]">
                  <button
                    type="button"
                    onClick={() =>
                      setFuites((prev) => [...prev, { localisation: "", reparee: "" }])
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-black/[0.04] text-[13px] font-medium text-black/70 active:bg-black/[0.08]"
                    style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                  >
                    + Ajouter une fuite ({fuites.length}/3)
                  </button>
                </div>
              )}
            </>
          )}
        </InsetListSection>
      )}

      {/* Notes + dictée vocale */}
      <InsetListSection
        title="Notes / Observations terrain"
        footer="Tape ou DICTE — ces observations sont intégrées à la case [14] Observations du CERFA officiel 15497*04."
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
        <div className="px-4 py-3">
          <VoiceInput
            onTranscript={(text, isFinal) => {
              if (isFinal) {
                setNotes((prev) => (prev ? `${prev} ${text}`.trim() : text));
              }
            }}
            mode="append"
            label="🎤 Dicter au lieu de taper"
            hint="Reconnaissance vocale native iPhone"
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

      {/* Submit — passe par le garde-fou qualite (checkInterventionIntegrity)
          AVANT la generation. Bloque les erreurs reglementaires graves et
          alerte sur les incoherences metier. Si rien a signaler, lance le
          submit direct. Sinon ouvre la modal qui demande correction ou
          confirmation explicite. */}
      <div className="px-4 mt-8 mb-4">
        <button
          type="button"
          onClick={handleValidateThenSubmit}
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

      {/* Modal du garde-fou qualite — s'ouvre si checkInterventionIntegrity
          a detecte des issues. Drawer Vaul (memoir UI app). */}
      <Drawer.Root open={integrityModalOpen} onOpenChange={setIntegrityModalOpen} shouldScaleBackground>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Drawer.Content
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl bg-[#F5F4F0] outline-none"
            style={{ maxHeight: "92dvh" }}
          >
            <Drawer.Title className="sr-only">Verifications avant envoi</Drawer.Title>
            <div className="mx-auto mt-2 mb-1 h-1.5 w-12 rounded-full bg-black/20" />

            <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06]">
              <div className="min-w-0">
                <div className="text-[10px] font-mono tracking-widest uppercase text-black/45">
                  Garde-fou qualité
                </div>
                <div className="text-[16px] font-semibold text-[#111]">Vérifications avant envoi</div>
              </div>
              <button
                type="button"
                onClick={() => setIntegrityModalOpen(false)}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full bg-black/[0.06] flex items-center justify-center active:bg-black/[0.12] transition-colors shrink-0"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {integrityReport && (
              <>
                {/* Compteurs par severite */}
                <div className="px-5 py-3 flex items-center gap-2 text-[12px] border-b border-black/[0.04]">
                  {integrityReport.countBySeverite.blocant > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 ring-1 ring-red-200 font-medium">
                      🚫 {integrityReport.countBySeverite.blocant} bloquant{integrityReport.countBySeverite.blocant > 1 ? "s" : ""}
                    </span>
                  )}
                  {integrityReport.countBySeverite.alerte > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 text-orange-700 ring-1 ring-orange-200 font-medium">
                      ⚠️ {integrityReport.countBySeverite.alerte} alerte{integrityReport.countBySeverite.alerte > 1 ? "s" : ""}
                    </span>
                  )}
                  {integrityReport.countBySeverite.info > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200 font-medium">
                      ℹ️ {integrityReport.countBySeverite.info} info
                    </span>
                  )}
                </div>

                {/* Liste des issues */}
                <div className="overflow-y-auto overscroll-contain px-5 py-4 space-y-3 text-[#111] flex-1">
                  {integrityReport.issues.map((issue, idx) => {
                    const style = SEVERITE_STYLES[issue.severite];
                    return (
                      <div
                        key={`${issue.code}-${idx}`}
                        className={`rounded-2xl ${style.bg} ring-1 ${style.ring} px-4 py-3`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 text-[18px] leading-none mt-0.5">{style.icon}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[14px] font-semibold ${style.text}`}>{issue.titre}</span>
                              <span className={`text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded ${style.bg} ${style.text} ring-1 ${style.ring}`}>
                                {style.label}
                              </span>
                            </div>
                            <p className={`mt-1 text-[12.5px] leading-snug ${style.text}/80`}>{issue.message}</p>
                            {issue.suggestion && (
                              <div className="mt-2 pl-3 border-l-2 border-current/30">
                                <div className={`text-[10px] uppercase tracking-wider font-medium ${style.text}/70 mb-0.5`}>
                                  À faire
                                </div>
                                <p className={`text-[12.5px] ${style.text}`}>{issue.suggestion}</p>
                              </div>
                            )}
                            {issue.articleRef && (
                              <div className={`mt-1.5 text-[10px] font-mono ${style.text}/55`}>
                                Ref. {issue.articleRef}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer actions */}
                <div className="px-5 py-3 border-t border-black/[0.06] flex flex-col gap-2 bg-white">
                  {integrityReport.hasBlocking ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIntegrityModalOpen(false)}
                        className="w-full px-5 py-3.5 rounded-2xl bg-[#111] text-white text-[14px] font-medium active:bg-black/85"
                        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                      >
                        Corriger maintenant
                      </button>
                      <div className="text-[11px] text-black/45 text-center leading-snug">
                        Soumission impossible tant qu&apos;une issue bloquante est présente — ces erreurs entraîneraient un rejet réglementaire (DREAL, TrackDéchets) ou un CERFA juridiquement nul.
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIntegrityModalOpen(false);
                          handleSubmit();
                        }}
                        className="w-full px-5 py-3.5 rounded-2xl bg-orange-600 text-white text-[14px] font-medium active:bg-orange-700"
                        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                      >
                        Continuer quand même
                      </button>
                      <button
                        type="button"
                        onClick={() => setIntegrityModalOpen(false)}
                        className="w-full px-5 py-2.5 rounded-2xl bg-white ring-1 ring-black/10 text-[#111] text-[13px] font-medium active:bg-black/[0.03]"
                        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                      >
                        Corriger d&apos;abord
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

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

      {/* Modal dictée IA — overlay plein écran */}
      <VoiceFullDictation
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onExtraction={handleVoiceExtraction}
        equipementContext={
          eqContext
            ? {
                modele: eqContext.modele,
                fluide: selectedFluide.code,
                chargeKg: parseFloat(weight) || undefined,
                clientName: eqContext.clientName,
              }
            : undefined
        }
      />
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

const TYPE_INTERVENTION_LABELS_MAIL: Record<string, string> = {
  recuperation: "récupération de fluide frigorigène",
  demantelement: "démantèlement avec récupération",
  controle_periodique: "contrôle d'étanchéité périodique",
  controle_non_periodique: "contrôle d'étanchéité suite fuite",
  mise_service: "mise en service",
  maintenance: "maintenance",
  assemblage: "assemblage d'équipement",
  modification: "modification d'équipement",
};

function buildClientMailto(status: {
  bsffId?: string;
  clientEmail?: string;
  clientName?: string;
  typeIntervention: string;
  modeleEquipement?: string;
}): string {
  const dateFR = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const labelType =
    TYPE_INTERVENTION_LABELS_MAIL[status.typeIntervention] ||
    status.typeIntervention;
  const subject = `Attestation F-Gas — ${labelType} du ${dateFR}`;

  const lines: string[] = [];
  lines.push(`Bonjour${status.clientName ? " " + status.clientName : ""},`);
  lines.push("");
  lines.push(
    `Suite à mon intervention du ${dateFR}${status.modeleEquipement ? " sur votre " + status.modeleEquipement : ""}, vous trouverez ci-joint votre attestation officielle CERFA 15497*04.`
  );
  if (status.bsffId) {
    lines.push("");
    lines.push(
      `Le bordereau de suivi de déchets (BSFF) associé est référencé sous le numéro ${status.bsffId} et a été enregistré auprès du Ministère de la Transition écologique via TrackDéchets.`
    );
  }
  lines.push("");
  lines.push(
    "Conservez ces documents au moins 5 ans, conformément à l'article R. 543-82 du Code de l'environnement."
  );
  lines.push("");
  lines.push("À votre disposition pour toute question.");
  lines.push("");
  lines.push("Cordialement,");

  return `mailto:${encodeURIComponent(status.clientEmail || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

function SuccessView({
  status,
  onReset,
}: {
  status: {
    type: "success";
    bsffId?: string;
    cerfaUrl: string;
    rapportUrl?: string;
    clientEmail?: string;
    clientName?: string;
    typeIntervention: string;
    modeleEquipement?: string;
  };
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
        {status.rapportUrl && (
          <a
            href={status.rapportUrl}
            download={`Fiche_visite_${status.bsffId ?? "intervention"}.pdf`}
            className="block w-full px-6 py-4 rounded-2xl text-[15px] font-medium text-center transition-colors bg-white border border-[#111] text-[#111] active:bg-black/[0.03]"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            ⬇ Télécharger la fiche de visite client
          </a>
        )}
        {!status.rapportUrl && (
          <div className="px-4 py-3 rounded-2xl bg-amber-50 ring-1 ring-amber-200 text-[12px] text-amber-900 leading-relaxed">
            ⚠️ Fiche de visite client non générée — remplis ton profil entreprise sur la page Profil pour l&apos;activer (logo, raison sociale, signature).
          </div>
        )}
      </div>

      {/* Bouton 'Envoyer au client' — toujours visible, mailto pré-rempli */}
      <div className="px-4 mt-3">
        <a
          href={buildClientMailto(status)}
          className="block w-full px-6 py-4 rounded-2xl bg-[#A16207] text-white text-[15px] font-medium text-center active:bg-[#8a5206] transition-colors"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          ✉️ Envoyer au client{status.clientEmail ? ` (${status.clientEmail})` : ""}
        </a>
        <div className="mt-2 text-[11px] text-black/50 leading-relaxed text-center">
          {status.clientEmail
            ? "Ouvre Mail iOS avec destinataire + objet + corps pré-remplis."
            : "Ouvre Mail iOS avec objet + corps pré-remplis — tape juste l'adresse du client."}
          <br />
          Pense à attacher le CERFA téléchargé juste avant.
        </div>
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
