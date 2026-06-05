"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection } from "@/components/mobile/inset-list";
import {
  getIntervention,
  deleteIntervention,
  updateIntervention,
  type StoredIntervention,
} from "@/lib/intervention-storage";
import { Drawer } from "vaul";
import { loadProfil } from "@/lib/profil";
import { getDiagnostic, type StoredDiagnostic } from "@/lib/diagnostic-storage";
import { generateEtiquetteTfe } from "@/lib/etiquette-tfe";
import { GRAVITE_LABELS, GRAVITE_STYLES, DELAI_LABELS } from "@/lib/vision-diagnostic";
import Link from "next/link";

type BsffStatus = {
  bsffId: string;
  status: string;
  emission: { author: string; date: string } | null;
  transport: { author: string; date: string } | null;
  reception: { author: string; date: string } | null;
  operation: { author: string; date: string } | null;
  operationCode: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  recuperation: "Récupération de fluide",
  demantelement: "Démantèlement",
  controle_periodique: "Contrôle d'étanchéité périodique",
  controle_non_periodique: "Contrôle suite fuite",
  mise_service: "Mise en service",
  maintenance: "Maintenance",
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MobileInterventionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [intervention, setIntervention] = useState<StoredIntervention | null>(null);
  const [diagnostic, setDiagnostic] = useState<StoredDiagnostic | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [cerfaLoading, setCerfaLoading] = useState(false);
  const [cerfaError, setCerfaError] = useState<string | null>(null);
  const [etiquetteLoading, setEtiquetteLoading] = useState(false);
  const [etiquetteError, setEtiquetteError] = useState<string | null>(null);
  const [rapportLoading, setRapportLoading] = useState(false);
  const [rapportError, setRapportError] = useState<string | null>(null);
  // Devis depuis intervention — modale Vaul + handler POST
  const [devisOpen, setDevisOpen] = useState(false);
  const [devisLoading, setDevisLoading] = useState(false);
  const [devisError, setDevisError] = useState<string | null>(null);
  const [devisClientNom, setDevisClientNom] = useState("");
  const [devisClientAdresse, setDevisClientAdresse] = useState("");
  const [devisClientEmail, setDevisClientEmail] = useState("");
  const [devisHeures, setDevisHeures] = useState<number>(1);
  const [devisTauxHoraire, setDevisTauxHoraire] = useState<number>(65);
  const [devisForfaitDeplacement, setDevisForfaitDeplacement] = useState<number>(60);
  // Edition rapide (modal Vaul)
  const [editOpen, setEditOpen] = useState(false);
  const [editClientName, setEditClientName] = useState("");
  const [editModele, setEditModele] = useState("");
  const [editNumeroSerie, setEditNumeroSerie] = useState("");
  const [editLieu, setEditLieu] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Suivi BSFF — statut des 4 signatures TrackDéchets
  const [bsffStatus, setBsffStatus] = useState<BsffStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => 0);
  // Refs pour éviter de recréer l'interval polling à chaque changement de state
  const bsffStatusRef = useRef<BsffStatus | null>(null);
  bsffStatusRef.current = bsffStatus;
  const bsffIdRef = useRef<string | undefined>(undefined);

  // Signature transport (cas où le technicien = transporteur)
  const [transportSigning, setTransportSigning] = useState(false);
  const [transportError, setTransportError] = useState<string | null>(null);
  // Date de prise en charge — initialisée lazy au moment où l'utilisateur déplie
  // le formulaire (évite SSR mismatch sur new Date())
  const [takenOverAt, setTakenOverAt] = useState<string>("");
  const [showSignForm, setShowSignForm] = useState(false);

  function nowDatetimeLocal(): string {
    // Format datetime-local : YYYY-MM-DDTHH:mm en heure LOCALE (pas UTC)
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Refresh statut BSFF — appelé au mount + après signature transport + polling
  async function refreshBsffStatus(bsffId: string) {
    setStatusError(null);
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/bsff/status/${encodeURIComponent(bsffId)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Statut indisponible");
      }
      const data = (await res.json()) as BsffStatus;
      setBsffStatus(data);
      setLastFetchAt(Date.now());
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setStatusLoading(false);
    }
  }

  // Auto-refresh : polling 30s + visibility change + tick "il y a Xs"
  useEffect(() => {
    if (!intervention?.bsffId) return;
    bsffIdRef.current = intervention.bsffId;
    refreshBsffStatus(intervention.bsffId);

    // Statuts finaux où on arrête de poller (le BSFF est terminé)
    const isTerminal = (s?: string | null) =>
      s === "PROCESSED" || s === "REFUSED";

    // Polling 30s tant que pas terminal ET que l'onglet est visible
    const interval = window.setInterval(() => {
      const id = bsffIdRef.current;
      if (!id) return;
      if (isTerminal(bsffStatusRef.current?.status)) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      refreshBsffStatus(id);
    }, 30_000);

    // Refresh quand l'onglet redevient visible (retour depuis fond / autre onglet)
    const onVisibility = () => {
      const id = bsffIdRef.current;
      if (!id) return;
      if (document.visibilityState === "visible" && !isTerminal(bsffStatusRef.current?.status)) {
        refreshBsffStatus(id);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Tick 1s pour afficher "Mis à jour il y a Xs" en temps réel
    const tick = window.setInterval(() => setNowTick((n) => n + 1), 1000);

    return () => {
      window.clearInterval(interval);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervention?.bsffId]);

  // Format relatif "il y a Xs / Xm / Xh"
  function fmtAgo(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 5) return "à l'instant";
    if (seconds < 60) return `il y a ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `il y a ${minutes}min`;
    const hours = Math.floor(minutes / 60);
    return `il y a ${hours}h`;
  }
  // Référence nowTick pour forcer le re-render de l'indicateur "il y a Xs"
  void nowTick;

  async function handleSignTransport() {
    if (!intervention?.bsffId) return;
    const profil = loadProfil();
    const author = (profil.raisonSociale || "Technicien").trim();
    setTransportError(null);
    setTransportSigning(true);
    try {
      // Convertit l'input datetime-local en ISO UTC pour l'API GraphQL
      const isoTaken = takenOverAt ? new Date(takenOverAt).toISOString() : new Date().toISOString();
      const res = await fetch("/api/bsff/sign-transport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bsffId: intervention.bsffId,
          author,
          takenOverAt: isoTaken,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Échec signature transport");
      }
      await refreshBsffStatus(intervention.bsffId);
      setShowSignForm(false);
    } catch (e) {
      setTransportError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setTransportSigning(false);
    }
  }

  function openSignForm() {
    if (!takenOverAt) setTakenOverAt(nowDatetimeLocal());
    setShowSignForm(true);
  }

  useEffect(() => {
    if (!params?.id) return;
    const it = getIntervention(params.id);
    setIntervention(it);
    // Si l'intervention a ete creee depuis un diagnostic IA, charge le diag
    // pour afficher photo + composant identifie. Silencieux si diag supprime.
    if (it?.diagnosticId) {
      setDiagnostic(getDiagnostic(it.diagnosticId));
    }
    setLoaded(true);
  }, [params?.id]);

  async function handleDownloadCerfa() {
    if (!intervention) return;
    setCerfaError(null);
    setCerfaLoading(true);
    try {
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

      const payload: Record<string, unknown> = {
        fluide: intervention.fluide,
        weight: intervention.weight,
        packagingNumero: intervention.packagingNumero,
        clientName: intervention.clientName,
        modeleEquipement: intervention.modeleEquipement,
        numeroSerieEquipement: intervention.numeroSerieEquipement,
        lieuIntervention: intervention.lieuIntervention,
        bsffId: intervention.bsffId,
        destination: intervention.destination ?? null,
        typeIntervention: intervention.typeIntervention,
        operateur,
        observationsLibres: intervention.notes,
        controleDetails: intervention.controleDetails,
        // Note : on n'a pas stocké la dataURL signature détenteur (trop lourde).
        // Si présente à l'origine, on remet nom + qualité mais sans image.
        detenteurSignature:
          intervention.hasDetenteurSignature && intervention.detenteurName
            ? {
                name: intervention.detenteurName,
                quality: intervention.detenteurQuality,
                dataUrl: "",
              }
            : null,
      };
      const res = await fetch("/api/cerfa/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Échec génération CERFA");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CERFA_15497-04_${intervention.bsffId ?? intervention.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setCerfaError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setCerfaLoading(false);
    }
  }

  async function handleDownloadRapport() {
    if (!intervention) return;
    setRapportError(null);
    setRapportLoading(true);
    try {
      // Si le profil local est vide (autre device / nouveau navigateur),
      // on tente un pull depuis Supabase avant de generer.
      let profil = loadProfil();
      if (!profil.raisonSociale && !profil.numeroAttestation) {
        try {
          const res = await fetch("/api/public/my-profile", {
            method: "GET",
            headers: { "cache-control": "no-store" },
          });
          if (res.ok) {
            const j = (await res.json()) as { data: Partial<typeof profil> | null };
            if (j.data) {
              const { saveProfil } = await import("@/lib/profil");
              profil = saveProfil({ ...profil, ...j.data });
            }
          }
        } catch {
          /* pas grave, on continue avec ce qu'on a */
        }
      }

      // Charge le diagnostic IA si l'intervention en vient
      let diagPayload: import("@/lib/rapport").RapportDiagnostic | undefined;
      if (diagnostic) {
        diagPayload = {
          imageDataUrl: diagnostic.imageDataUrl,
          composantIdentifie: diagnostic.result.composantIdentifie || "",
          defautsDetectes: diagnostic.result.defautsDetectes.map((d) => ({
            nom: d.nom,
            description: d.description,
            gravite: d.gravite,
          })),
          actionRecommandee: diagnostic.result.actionRecommandee,
          delaiIntervention: diagnostic.result.delaiIntervention,
        };
      }

      // Calcul prochain controle reglementaire si on retrouve l'eq parent
      let prochainControleISO: string | undefined;
      let frequenceControleMois: number | undefined;
      try {
        const { listEquipements, computeStatus } = await import("@/lib/equipement");
        const eqs = listEquipements();
        const eq = eqs.find(
          (e) =>
            (intervention.equipementId && e.id === intervention.equipementId) ||
            (intervention.numeroSerieEquipement && e.numeroSerie === intervention.numeroSerieEquipement)
        );
        if (eq) {
          const status = computeStatus(eq, [intervention]);
          prochainControleISO = status.prochainControleISO ?? undefined;
          frequenceControleMois = status.frequenceMois ?? undefined;
        }
      } catch {
        // Pas grave, le rapport sera juste sans la section prochain controle
      }

      const operateur = {
        name: profil.raisonSociale,
        quality: profil.categorieAttestation
          ? `Technicien Cat. ${profil.categorieAttestation}`
          : "Technicien",
        signatureDataUrl: profil.signatureDataUrl,
      };

      const payload = {
        fluide: intervention.fluide,
        weight: intervention.weight,
        packagingNumero: intervention.packagingNumero,
        clientName: intervention.clientName,
        modeleEquipement: intervention.modeleEquipement,
        numeroSerieEquipement: intervention.numeroSerieEquipement,
        lieuIntervention: intervention.lieuIntervention,
        bsffId: intervention.bsffId,
        destination: intervention.destination ?? null,
        typeIntervention: intervention.typeIntervention,
        operateur,
        observationsLibres: intervention.notes,
        observationsTerrain: intervention.notes,
        controleDetails: intervention.controleDetails,
        interventionDate: intervention.createdAt,
        diagnostic: diagPayload ?? null,
        prochainControleISO,
        frequenceControleMois,
        profil,
      };

      const res = await fetch("/api/rapport/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        // On expose le detail (message technique) en priorite sur l'erreur
        // generique, parce que "Échec génération rapport" tout court ne dit
        // rien a l'utilisateur. Le detail typique : "WinAnsi cannot encode",
        // "Profil entreprise manquant", "Cannot read image", etc.
        const fullMsg = err.detail
          ? `${err.error ?? "Échec"} — ${err.detail}`
          : err.error || "Échec génération rapport (raison inconnue)";
        throw new Error(fullMsg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const clientSlug = (intervention.clientName || "client")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 30);
      a.download = `Rapport_intervention_${clientSlug}_${intervention.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setRapportError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setRapportLoading(false);
    }
  }

  // Ouvre la modale de devis avec les valeurs pre-remplies depuis l'intervention
  // + le profil (taux horaire). L'utilisateur ajuste puis valide.
  function openDevisModal() {
    if (!intervention) return;
    const profil = loadProfil();
    // Pre-remplit le nom client depuis l'intervention si dispo
    setDevisClientNom(intervention.clientName ?? "");
    setDevisClientAdresse(intervention.lieuIntervention ?? "");
    setDevisClientEmail("");
    // Heures defaut selon type intervention (helper lib/devis.ts)
    import("@/lib/devis").then(({ estimerHeuresMOFromTypeIntervention }) => {
      setDevisHeures(estimerHeuresMOFromTypeIntervention(intervention.typeIntervention));
    });
    // Taux horaire depuis profil si configure, sinon 65 EUR/h defaut
    setDevisTauxHoraire(profil.tauxHoraireDevisHT && profil.tauxHoraireDevisHT > 0
      ? profil.tauxHoraireDevisHT
      : 65);
    setDevisForfaitDeplacement(60);
    setDevisError(null);
    setDevisOpen(true);
  }

  async function handleGenerateDevisFromIntervention() {
    if (!intervention) return;
    if (!devisClientNom.trim()) {
      setDevisError("Le nom du client est obligatoire pour générer un devis.");
      return;
    }
    setDevisError(null);
    setDevisLoading(true);
    try {
      let profil = loadProfil();
      if (!profil.raisonSociale) {
        try {
          const res = await fetch("/api/public/my-profile", {
            method: "GET",
            headers: { "cache-control": "no-store" },
          });
          if (res.ok) {
            const j = (await res.json()) as { data: Partial<typeof profil> | null };
            if (j.data) {
              const { saveProfil } = await import("@/lib/profil");
              profil = saveProfil({ ...profil, ...j.data });
            }
          }
        } catch {}
      }
      if (!profil.raisonSociale) {
        throw new Error(
          "Profil entreprise manquant. Renseigne au moins la raison sociale dans /m/profil avant de générer un devis."
        );
      }

      const { buildDevisFromIntervention, generateDevisNumero } = await import("@/lib/devis");

      const devis = buildDevisFromIntervention({
        intervention: {
          id: intervention.id,
          typeIntervention: intervention.typeIntervention,
          fluide: intervention.fluide,
          weight: intervention.weight,
          bsffId: intervention.bsffId,
          modeleEquipement: intervention.modeleEquipement,
          numeroSerieEquipement: intervention.numeroSerieEquipement,
          createdAt: intervention.createdAt,
        },
        emetteur: {
          raisonSociale: profil.raisonSociale,
          siret: profil.siret,
          adresseRue: profil.adresseRue,
          adresseCp: profil.adresseCp,
          adresseVille: profil.adresseVille,
          telephone: profil.telephone,
          email: profil.email,
          siteWeb: profil.siteWeb,
          numeroAttestation: profil.numeroAttestation,
          logoDataUrl: profil.logoDataUrl,
          signatureDataUrl: profil.signatureDataUrl,
        },
        destinataire: {
          nom: devisClientNom.trim(),
          adresse: devisClientAdresse.trim() || undefined,
          email: devisClientEmail.trim() || undefined,
        },
        numero: generateDevisNumero(),
        heuresMainOeuvre: devisHeures,
        tauxHoraireHT: devisTauxHoraire,
        forfaitDeplacementHt: devisForfaitDeplacement,
      });

      const res = await fetch("/api/devis/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(devis),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Échec génération du devis");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${devis.numero ?? "DEVIS"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDevisOpen(false);
    } catch (e) {
      setDevisError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setDevisLoading(false);
    }
  }

  async function handleDownloadEtiquette() {
    if (!intervention) return;
    setEtiquetteError(null);
    setEtiquetteLoading(true);
    try {
      const profil = loadProfil();
      const origin = typeof window !== "undefined" ? window.location.origin : "https://vertxia.com";

      // Resolution de l'equipementId pour le QR :
      //   1. Si stocke dans l'intervention -> on l'utilise
      //   2. Sinon lookup dans le parc local par numeroSerie ou modele+client
      //   3. Sinon creation auto d'un equipement minimum a partir des infos
      //      de l'intervention (sync Supabase auto via saveEquipement)
      //   4. Sinon (intervention sans modele/serie) -> erreur claire
      const { listEquipements, saveEquipement } = await import("@/lib/equipement");
      const { syncEquipementToSupabase } = await import("@/lib/public-sync");

      let equipementIdOverride: string | undefined = intervention.equipementId;
      // Garde l'objet eq complet pour pouvoir forcer le re-sync apres
      let resolvedEq: import("@/lib/equipement").StoredEquipement | undefined;

      if (equipementIdOverride) {
        resolvedEq = listEquipements().find((e) => e.id === equipementIdOverride);
      }

      if (!equipementIdOverride) {
        // Etape 2 : lookup dans le parc local
        if (intervention.modeleEquipement || intervention.numeroSerieEquipement) {
          const eqs = listEquipements();
          const match = eqs.find(
            (e) =>
              (intervention.numeroSerieEquipement && e.numeroSerie === intervention.numeroSerieEquipement) ||
              (intervention.modeleEquipement && e.modele === intervention.modeleEquipement && e.clientName === intervention.clientName)
          );
          if (match) {
            equipementIdOverride = match.id;
            resolvedEq = match;
          }
        }

        // Etape 3 : creation auto si on a les infos minimum
        if (!equipementIdOverride && intervention.modeleEquipement && intervention.numeroSerieEquipement) {
          try {
            const created = saveEquipement({
              clientName: intervention.clientName || "Client à compléter",
              siteAdresse: intervention.lieuIntervention,
              modele: intervention.modeleEquipement,
              numeroSerie: intervention.numeroSerieEquipement,
              fluide: intervention.fluide,
              chargeKg: intervention.weight > 0 ? intervention.weight : 0,
              detecteurFixe: intervention.controleDetails?.detecteurPermanent ?? false,
              dernierControleISO:
                intervention.typeIntervention === "controle_periodique" ||
                intervention.typeIntervention === "controle_non_periodique"
                  ? intervention.createdAt
                  : undefined,
            });
            equipementIdOverride = created.id;
            resolvedEq = created;
          } catch {
            // Silencieux : si la creation foire (ex: quota localStorage), on
            // tombe sur l'etape 4
          }
        }

        // Etape 4 : impossible -> erreur claire
        if (!equipementIdOverride) {
          setEtiquetteError(
            "Impossible de générer une étiquette traçable : il manque le modèle et le numéro de série dans l'intervention. Modifie l'intervention pour les ajouter — sans ça, le QR ne peut pas pointer vers une fiche équipement."
          );
          setEtiquetteLoading(false);
          return;
        }
      }

      // CRITIQUE : force un re-sync await de l'eq vers Supabase AVANT de
      // generer la PDF. Sinon le QR pointe vers un ID qui n'existe pas en
      // BDD (sync background avait foire silencieusement -> scan = page
      // "Equipement introuvable"). L'upsert est idempotent (onConflict:id).
      if (resolvedEq) {
        const syncResult = await syncEquipementToSupabase(resolvedEq);
        if (!syncResult.ok) {
          if (syncResult.reason === "auth") {
            setEtiquetteError(
              "Tu dois être connecté à ton compte Vertxia pour générer une étiquette traçable. Reconnecte-toi puis réessaye."
            );
          } else if (syncResult.reason === "network") {
            setEtiquetteError(
              "Impossible de synchroniser l'équipement avec le serveur. Vérifie ta connexion internet et réessaye — sinon le QR pointerait vers une fiche introuvable."
            );
          } else {
            setEtiquetteError(
              `Synchronisation impossible : ${syncResult.message}. Réessaye dans un instant.`
            );
          }
          setEtiquetteLoading(false);
          return;
        }
      }

      const blob = await generateEtiquetteTfe(intervention, profil, origin, {
        equipementIdOverride,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Etiquette_FGas_${intervention.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setEtiquetteError(e instanceof Error ? e.message : "Erreur génération étiquette");
    } finally {
      setEtiquetteLoading(false);
    }
  }

  function openEdit() {
    if (!intervention) return;
    setEditClientName(intervention.clientName ?? "");
    setEditModele(intervention.modeleEquipement ?? "");
    setEditNumeroSerie(intervention.numeroSerieEquipement ?? "");
    setEditLieu(intervention.lieuIntervention ?? "");
    setEditNotes(intervention.notes ?? "");
    setEditOpen(true);
  }

  function handleEditSave() {
    if (!intervention || editSaving) return;
    setEditSaving(true);
    try {
      const updated = updateIntervention(intervention.id, {
        clientName: editClientName.trim() || null,
        modeleEquipement: editModele.trim() || undefined,
        numeroSerieEquipement: editNumeroSerie.trim() || undefined,
        lieuIntervention: editLieu.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
      if (updated) {
        setIntervention(updated);
        // Clear l'erreur etiquette si elle etait liee a un manque d'infos
        setEtiquetteError(null);
      }
      setEditOpen(false);
    } finally {
      setEditSaving(false);
    }
  }

  function handleDelete() {
    if (!intervention) return;
    if (!confirm("Supprimer cette intervention de l'historique local ?")) return;
    deleteIntervention(intervention.id);
    router.push("/m/historique");
  }

  if (!loaded) {
    return (
      <>
        <MobileHeader title="📋 Intervention" largeTitle backHref="/m/historique" />
        <div className="px-5 py-20 text-center">
          <div className="inline-block w-8 h-8 border-2 border-black/15 border-t-[#111] rounded-full animate-spin" />
        </div>
      </>
    );
  }

  if (!intervention) {
    return (
      <>
        <MobileHeader title="📋 Intervention" largeTitle backHref="/m/historique" />
        <div className="px-5 py-20 text-center text-[14px] text-black/55">
          Intervention introuvable — elle a peut-être été supprimée.
        </div>
      </>
    );
  }

  const i = intervention;

  return (
    <>
      <MobileHeader
        title={TYPE_LABELS[i.typeIntervention] || i.typeIntervention}
        largeTitle
        backHref="/m/historique"
      />

      {/* Badge statut */}
      <div className="px-5 mt-2">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ring-1 ${
            i.bsffId
              ? "bg-emerald-50 ring-emerald-200"
              : "bg-blue-50 ring-blue-200"
          }`}
        >
          <span className="relative flex w-2 h-2">
            <span
              className={`relative w-2 h-2 rounded-full ${
                i.bsffId ? "bg-emerald-500" : "bg-blue-500"
              }`}
            />
          </span>
          <span
            className={`font-mono text-[11px] tracking-widest uppercase font-semibold ${
              i.bsffId ? "text-emerald-700" : "text-blue-700"
            }`}
          >
            {i.bsffId ? "BSFF signé · officiel" : "CERFA généré"}
          </span>
        </div>
        <div className="mt-3 text-[13px] text-black/55">{fmtDateTime(i.createdAt)}</div>
      </div>

      {/* Documents */}
      <div className="px-4 mt-6 space-y-2">
        {i.bsffId && (
          <a
            href={`/api/bsff/download/${i.bsffId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full px-6 py-4 rounded-2xl bg-[#111] text-white text-[15px] font-medium text-center active:bg-black/90 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            ⬇ Télécharger le BSFF officiel
          </a>
        )}
        <button
          type="button"
          onClick={handleDownloadCerfa}
          disabled={cerfaLoading}
          className={`block w-full px-6 py-4 rounded-2xl text-[15px] font-medium text-center transition-colors disabled:opacity-60 ${
            i.bsffId
              ? "bg-white border border-[#111] text-[#111] active:bg-black/[0.03]"
              : "bg-[#111] text-white active:bg-black/90"
          }`}
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          {cerfaLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              Génération…
            </span>
          ) : (
            "⬇ Télécharger le CERFA 15497*04"
          )}
        </button>
        {cerfaError && (
          <div className="px-4 py-3 rounded-2xl bg-red-50 text-red-700 text-[13px] border border-red-200">
            ❌ {cerfaError}
          </div>
        )}

        {/* Rapport client (PDF humain, branding Vertxia, partage WhatsApp/mail) */}
        <button
          type="button"
          onClick={handleDownloadRapport}
          disabled={rapportLoading}
          className="block w-full px-6 py-4 rounded-2xl text-[15px] font-medium text-center transition-colors disabled:opacity-60 bg-[#A16207] text-white active:bg-[#8a5206]"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          {rapportLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              Génération…
            </span>
          ) : (
            "📄 Télécharger le rapport client"
          )}
        </button>
        <div className="text-[11px] text-black/45 leading-snug px-2 -mt-1">
          PDF brandé à ton nom, avec photo du diagnostic IA et prochain contrôle réglementaire — à envoyer au client final par mail ou WhatsApp.
        </div>
        {rapportError && (
          <div className="px-4 py-3 rounded-2xl bg-red-50 text-red-700 text-[13px] border border-red-200">
            ❌ {rapportError}
          </div>
        )}

        {/* Devis depuis intervention - pre-rempli main d'oeuvre + fluide +
            controle reglementaire + frais traitement BSFF + deplacement.
            Ouvre une modale pour saisir le client + ajuster les heures. */}
        <button
          type="button"
          onClick={openDevisModal}
          className="block w-full px-6 py-4 rounded-2xl text-[15px] font-medium text-center transition-colors bg-white border-2 border-[#A16207] text-[#A16207] active:bg-[#A16207]/[0.05]"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          💰 Générer un devis pour le client
        </button>
        <div className="text-[11px] text-black/45 leading-snug px-2 -mt-1">
          Pré-rempli depuis l&apos;intervention : main d&apos;œuvre + fluide + contrôle réglementaire + déplacement.
        </div>

        {/* Etiquette F-Gas reglementaire (a coller sur l'equipement) */}
        <button
          type="button"
          onClick={handleDownloadEtiquette}
          disabled={etiquetteLoading}
          className="block w-full px-6 py-4 rounded-2xl text-[15px] font-medium text-center transition-colors disabled:opacity-60 bg-white border border-[#A16207] text-[#A16207] active:bg-[#A16207]/[0.05]"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          {etiquetteLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              Génération…
            </span>
          ) : (
            "🏷️ Télécharger l'étiquette F-Gas"
          )}
        </button>
        <div className="text-[11px] text-black/45 leading-snug px-2 -mt-1">
          Étiquette obligatoire à apposer sur l&apos;équipement après intervention (art. R543-83 Code env.). Format A6 imprimable sur autocollant.
        </div>
        {etiquetteError && (
          <div className="px-4 py-3 rounded-2xl bg-red-50 text-red-700 text-[13px] border border-red-200">
            ❌ {etiquetteError}
          </div>
        )}
      </div>

      {/* Identifiant BSFF */}
      {i.bsffId && (
        <InsetListSection title="Identifiant BSFF" footer="Source : TrackDéchets — Ministère de la Transition écologique">
          <div className="px-4 py-3">
            <div className="text-[15px] font-mono text-[#111] break-all">{i.bsffId}</div>
          </div>
        </InsetListSection>
      )}

      {/* Timeline suivi BSFF — 4 étapes réglementaires TrackDéchets */}
      {i.bsffId && (
        <InsetListSection
          title="Suivi BSFF officiel"
          footer="Le BSFF passe par 4 signatures : émetteur (toi), transporteur, réception centre, traitement centre. Tu peux signer le transport ici si tu apportes toi-même la bouteille au centre."
        >
          <div className="px-4 py-3 space-y-3">
            <BsffStep
              order={1}
              label="Émis"
              actor="par toi"
              done={Boolean(bsffStatus?.emission)}
              date={bsffStatus?.emission?.date}
            />
            <BsffStep
              order={2}
              label="Prise en charge transport"
              actor={bsffStatus?.transport ? "par " + bsffStatus.transport.author : "par le transporteur"}
              done={Boolean(bsffStatus?.transport)}
              date={bsffStatus?.transport?.date}
            />
            <BsffStep
              order={3}
              label="Réception au centre"
              actor={bsffStatus?.reception ? "par " + bsffStatus.reception.author : "par le centre de traitement"}
              done={Boolean(bsffStatus?.reception)}
              date={bsffStatus?.reception?.date}
            />
            <BsffStep
              order={4}
              label="Traitement effectué"
              actor={
                bsffStatus?.operation
                  ? `par ${bsffStatus.operation.author}${bsffStatus.operationCode ? ` · ${bsffStatus.operationCode}` : ""}`
                  : "par le centre de traitement"
              }
              done={Boolean(bsffStatus?.operation)}
              date={bsffStatus?.operation?.date}
            />
          </div>
          {!bsffStatus?.transport && bsffStatus?.emission && (
            <div className="px-4 pb-4">
              {!showSignForm ? (
                <>
                  <button
                    type="button"
                    onClick={openSignForm}
                    className="w-full px-4 py-3 rounded-2xl bg-[#A16207] text-white text-[14px] font-medium active:bg-[#8a5206] transition-colors"
                    style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                  >
                    ✍ Signer la prise en charge transport
                  </button>
                  <div className="mt-2 text-[11px] text-black/45 leading-relaxed">
                    Signe ici quand tu mets la bouteille dans ton utilitaire pour
                    l&apos;apporter au centre de traitement.
                  </div>
                </>
              ) : (
                <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-4">
                  <div className="text-[12px] font-medium text-amber-900 mb-3">
                    Date et heure de prise en charge
                  </div>
                  <input
                    type="datetime-local"
                    value={takenOverAt}
                    onChange={(e) => setTakenOverAt(e.target.value)}
                    disabled={transportSigning}
                    className="w-full px-3 py-2.5 rounded-xl bg-white ring-1 ring-amber-200 text-[14px] text-[#111] font-mono"
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  />
                  <div className="mt-2 text-[11px] text-amber-800/80 leading-relaxed">
                    Cette date sera inscrite en section [7] du BSFF officiel.
                    Tu peux la modifier si tu as pris la bouteille à un autre
                    moment que maintenant.
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSignForm(false)}
                      disabled={transportSigning}
                      className="px-4 py-3 rounded-2xl bg-white ring-1 ring-black/10 text-[14px] font-medium text-black/70 active:bg-black/[0.03] disabled:opacity-50"
                      style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleSignTransport}
                      disabled={transportSigning || !takenOverAt}
                      className="px-4 py-3 rounded-2xl bg-[#A16207] text-white text-[14px] font-medium active:bg-[#8a5206] disabled:opacity-50"
                      style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                    >
                      {transportSigning ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <span className="inline-block w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Signature…
                        </span>
                      ) : (
                        "Signer"
                      )}
                    </button>
                  </div>
                </div>
              )}
              {transportError && (
                <div className="mt-2 px-3 py-2 rounded-xl bg-red-50 ring-1 ring-red-200 text-[12px] text-red-700">
                  {transportError}
                </div>
              )}
            </div>
          )}
          {/* Barre de statut "live" : indicateur pulse + dernière maj + refresh manuel */}
          <div className="px-4 pb-3 flex items-center justify-between gap-2 border-t border-black/[0.04] pt-3">
            <div className="flex items-center gap-2 min-w-0">
              {statusLoading ? (
                <>
                  <span className="relative flex w-2 h-2 shrink-0">
                    <span className="absolute inset-0 rounded-full bg-blue-500 opacity-60 animate-ping" />
                    <span className="relative w-2 h-2 rounded-full bg-blue-500" />
                  </span>
                  <span className="text-[11px] text-blue-700 truncate">Mise à jour…</span>
                </>
              ) : bsffStatus?.status === "PROCESSED" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-[11px] text-emerald-700 truncate">
                    Traitement terminé · suivi clôturé
                  </span>
                </>
              ) : bsffStatus?.status === "REFUSED" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <span className="text-[11px] text-red-700 truncate">Bouteille refusée</span>
                </>
              ) : statusError ? (
                <span className="text-[11px] text-amber-700 truncate">{statusError}</span>
              ) : lastFetchAt ? (
                <>
                  <span className="relative flex w-2 h-2 shrink-0">
                    <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-40 animate-ping" />
                    <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[11px] text-black/55 truncate">
                    En direct · maj {fmtAgo(Date.now() - lastFetchAt)}
                  </span>
                </>
              ) : (
                <span className="text-[11px] text-black/40 truncate">Connexion…</span>
              )}
            </div>
            {i.bsffId && (
              <button
                type="button"
                onClick={() => i.bsffId && refreshBsffStatus(i.bsffId)}
                disabled={statusLoading}
                className="text-[11px] px-2.5 py-1 rounded-full bg-black/[0.05] text-black/70 active:bg-black/[0.1] disabled:opacity-50 shrink-0"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                ↻ Actualiser
              </button>
            )}
          </div>
        </InsetListSection>
      )}

      {/* Diagnostic IA d'origine — affiche la photo + composant + defauts si
          l'intervention a ete creee depuis un diag IA */}
      {diagnostic && (
        <InsetListSection title="Diagnostic IA d'origine">
          <div className="px-4 py-3 space-y-3">
            {/* Photo */}
            <div className="rounded-xl overflow-hidden ring-1 ring-black/[0.06] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={diagnostic.imageDataUrl}
                alt="Composant diagnostiqué"
                className="w-full h-auto block max-h-64 object-cover"
              />
            </div>

            {/* Composant + confiance */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-0.5">
                Composant identifié
              </div>
              <div className="text-[15px] font-semibold text-[#111] leading-tight">
                {diagnostic.result.composantIdentifie || "Non identifié"}
              </div>
            </div>

            {/* Defauts list */}
            {diagnostic.result.defautsDetectes.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1.5">
                  Défauts détectés ({diagnostic.result.defautsDetectes.length})
                </div>
                <ul className="space-y-1.5">
                  {diagnostic.result.defautsDetectes.map((d, i) => {
                    const s = GRAVITE_STYLES[d.gravite];
                    return (
                      <li key={i} className="flex items-start gap-2">
                        <div className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${s.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-[#111] leading-snug">
                            {d.nom}
                            <span className={`ml-1.5 text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ring-1 ${s.bg} ${s.text} ${s.ring}`}>
                              {GRAVITE_LABELS[d.gravite]}
                            </span>
                          </div>
                          <div className="text-[12px] text-black/60 mt-0.5 leading-snug">
                            {d.description}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Action + delai */}
            {diagnostic.result.actionRecommandee && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-0.5">
                  Action recommandée · {DELAI_LABELS[diagnostic.result.delaiIntervention]}
                </div>
                <div className="text-[13px] text-[#111] leading-snug">
                  {diagnostic.result.actionRecommandee}
                </div>
              </div>
            )}

            {/* Lien vers le diagnostic complet */}
            <Link
              href={`/m/diagnostic/${diagnostic.id}`}
              className="block w-full text-center px-4 py-2.5 rounded-xl bg-[#A16207]/10 text-[#A16207] text-[13px] font-medium active:bg-[#A16207]/20 transition-colors"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Voir le diagnostic complet
            </Link>
          </div>
        </InsetListSection>
      )}

      {/* Détails intervention */}
      <InsetListSection title="Détails intervention">
        <DetailRow label="Type" value={TYPE_LABELS[i.typeIntervention] || i.typeIntervention} />
        <DetailRow label="Fluide" value={`${i.fluide.code} — GWP ${i.fluide.gwp}`} />
        {i.weight > 0 && (
          <DetailRow
            label="Quantité"
            value={`${i.weight.toFixed(2)} kg · ${(i.weight * i.fluide.gwp).toLocaleString("fr-FR")} kg eq. CO₂`}
          />
        )}
        {i.packagingNumero && <DetailRow label="N° emballage" value={i.packagingNumero} />}
        {i.lieuIntervention && <DetailRow label="Lieu" value={i.lieuIntervention} />}
      </InsetListSection>

      {/* Client / équipement */}
      {(i.clientName || i.modeleEquipement || i.numeroSerieEquipement) && (
        <InsetListSection title="Client / équipement">
          {i.clientName && <DetailRow label="Client" value={i.clientName} />}
          {i.modeleEquipement && <DetailRow label="Modèle" value={i.modeleEquipement} />}
          {i.numeroSerieEquipement && (
            <DetailRow label="N° série" value={i.numeroSerieEquipement} />
          )}
        </InsetListSection>
      )}

      {/* Contrôle d'étanchéité */}
      {i.controleDetails && (
        <InsetListSection title="Contrôle d'étanchéité">
          {i.controleDetails.detecteurId && (
            <DetailRow label="Détecteur" value={i.controleDetails.detecteurId} />
          )}
          <DetailRow
            label="Détecteur permanent"
            value={i.controleDetails.detecteurPermanent ? "Oui" : "Non"}
          />
          <DetailRow
            label="Fuite détectée"
            value={i.controleDetails.fuiteDetectee ? "Oui" : "Non"}
          />
          {i.controleDetails.fuiteLocalisation && (
            <DetailRow label="Localisation fuite" value={i.controleDetails.fuiteLocalisation} />
          )}
        </InsetListSection>
      )}

      {/* Signature client */}
      {i.hasDetenteurSignature && (
        <InsetListSection
          title="Signature client"
          footer="La signature manuscrite n'est pas conservée localement (vie privée + place). Le nom et la qualité du signataire ont été embed dans le CERFA original."
        >
          {i.detenteurName && <DetailRow label="Nom" value={i.detenteurName} />}
          {i.detenteurQuality && <DetailRow label="Qualité" value={i.detenteurQuality} />}
        </InsetListSection>
      )}

      {/* Notes */}
      {i.notes && (
        <InsetListSection title="Notes / Observations">
          <div className="px-4 py-3 text-[14px] text-black/80 whitespace-pre-wrap leading-relaxed">
            {i.notes}
          </div>
        </InsetListSection>
      )}

      {/* Actions secondaires */}
      <div className="px-4 mt-6 mb-8 space-y-2">
        <button
          type="button"
          onClick={openEdit}
          className="w-full px-6 py-3 rounded-2xl bg-white border border-black/10 text-[#111] text-[14px] font-medium active:bg-black/[0.03] transition-colors"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          ✏️ Modifier cette intervention
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="w-full px-6 py-3 rounded-2xl bg-white border border-red-200 text-red-600 text-[14px] font-medium active:bg-red-50 transition-colors"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          Supprimer de l&apos;historique
        </button>
      </div>

      {/* Drawer edition rapide — utile notamment pour completer modele/serie
          quand on veut generer l'etiquette F-Gas */}
      <Drawer.Root open={editOpen} onOpenChange={setEditOpen} shouldScaleBackground>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Drawer.Content
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl bg-[#F5F4F0] outline-none"
            style={{ maxHeight: "92dvh" }}
          >
            <Drawer.Title className="sr-only">Modifier l&apos;intervention</Drawer.Title>
            <div className="mx-auto mt-2 mb-1 h-1.5 w-12 rounded-full bg-black/20" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06]">
              <div className="text-[16px] font-semibold text-[#111]">Modifier l&apos;intervention</div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full bg-black/[0.06] flex items-center justify-center active:bg-black/[0.12] transition-colors"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain px-5 py-5 space-y-4">
              <p className="text-[12.5px] text-black/55 leading-relaxed">
                Tu peux corriger les infos clés de l&apos;intervention ici. Les champs réglementaires figés (type, fluide, BSFF) ne sont pas modifiables — pour les changer, supprime et recrée.
              </p>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-black/45 font-medium mb-1.5">
                  Client / Détenteur
                </label>
                <input
                  type="text"
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  placeholder="Nom ou raison sociale"
                  className="w-full px-4 py-3 rounded-xl bg-white border border-black/[0.08] text-[14px] text-[#111] placeholder:text-black/35 outline-none focus:border-[#A16207]/40"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-black/45 font-medium mb-1.5">
                  Modèle équipement <span className="text-[#A16207]">*</span>
                </label>
                <input
                  type="text"
                  value={editModele}
                  onChange={(e) => setEditModele(e.target.value)}
                  placeholder="Ex : Daikin FTXM35M"
                  className="w-full px-4 py-3 rounded-xl bg-white border border-black/[0.08] text-[14px] text-[#111] placeholder:text-black/35 outline-none focus:border-[#A16207]/40"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-black/45 font-medium mb-1.5">
                  N° de série équipement <span className="text-[#A16207]">*</span>
                </label>
                <input
                  type="text"
                  value={editNumeroSerie}
                  onChange={(e) => setEditNumeroSerie(e.target.value)}
                  placeholder="Ex : DK24042587"
                  className="w-full px-4 py-3 rounded-xl bg-white border border-black/[0.08] text-[14px] text-[#111] placeholder:text-black/35 outline-none focus:border-[#A16207]/40 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-black/45 font-medium mb-1.5">
                  Lieu d&apos;intervention
                </label>
                <input
                  type="text"
                  value={editLieu}
                  onChange={(e) => setEditLieu(e.target.value)}
                  placeholder="Adresse du chantier"
                  className="w-full px-4 py-3 rounded-xl bg-white border border-black/[0.08] text-[14px] text-[#111] placeholder:text-black/35 outline-none focus:border-[#A16207]/40"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-black/45 font-medium mb-1.5">
                  Notes / Observations
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={4}
                  placeholder="Observations terrain, contexte…"
                  className="w-full px-4 py-3 rounded-xl bg-white border border-black/[0.08] text-[14px] text-[#111] placeholder:text-black/35 outline-none focus:border-[#A16207]/40 resize-none"
                />
              </div>

              <div className="text-[11px] text-black/45 leading-snug -mt-2">
                <span className="text-[#A16207]">*</span> Modèle + n° de série sont obligatoires pour générer l&apos;étiquette F-Gas traçable.
              </div>
            </div>

            <div className="px-5 py-4 border-t border-black/[0.06] bg-[#F5F4F0]" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
              <button
                type="button"
                onClick={handleEditSave}
                disabled={editSaving}
                className="w-full px-6 py-3.5 rounded-2xl bg-[#111] text-white text-[15px] font-medium active:bg-black/90 transition-colors disabled:opacity-60"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                {editSaving ? "Enregistrement…" : "✓ Enregistrer"}
              </button>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* Drawer Generer un devis depuis l'intervention - saisie client + heures */}
      <Drawer.Root open={devisOpen} onOpenChange={setDevisOpen} shouldScaleBackground>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Drawer.Content
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl bg-[#F5F4F0] outline-none"
            style={{ maxHeight: "92dvh" }}
          >
            <Drawer.Title className="sr-only">Générer un devis pour le client</Drawer.Title>
            <div className="mx-auto mt-2 mb-1 h-1.5 w-12 rounded-full bg-black/20" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06]">
              <div className="text-[16px] font-semibold text-[#111]">Devis depuis l&apos;intervention</div>
              <button
                type="button"
                onClick={() => setDevisOpen(false)}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full bg-black/[0.06] flex items-center justify-center active:bg-black/[0.12] transition-colors"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain px-5 py-3 space-y-4 flex-1">
              <div>
                <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-1">
                  Client (destinataire du devis)
                </label>
                <input
                  type="text"
                  value={devisClientNom}
                  onChange={(e) => setDevisClientNom(e.target.value)}
                  placeholder="Nom ou raison sociale"
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-white ring-1 ring-black/[0.06] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#A16207]/30"
                />
              </div>

              <div>
                <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-1">
                  Adresse client (optionnelle)
                </label>
                <input
                  type="text"
                  value={devisClientAdresse}
                  onChange={(e) => setDevisClientAdresse(e.target.value)}
                  placeholder="Adresse de facturation"
                  className="w-full px-4 py-3 rounded-2xl bg-white ring-1 ring-black/[0.06] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#A16207]/30"
                />
              </div>

              <div>
                <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-1">
                  Email client (optionnel)
                </label>
                <input
                  type="email"
                  value={devisClientEmail}
                  onChange={(e) => setDevisClientEmail(e.target.value)}
                  placeholder="email@client.fr"
                  className="w-full px-4 py-3 rounded-2xl bg-white ring-1 ring-black/[0.06] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#A16207]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-1">
                    Heures M.O.
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.5"
                    step="0.5"
                    value={devisHeures}
                    onChange={(e) => setDevisHeures(Math.max(0.5, parseFloat(e.target.value) || 0))}
                    className="w-full px-4 py-3 rounded-2xl bg-white ring-1 ring-black/[0.06] text-[15px] font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#A16207]/30"
                  />
                </div>
                <div>
                  <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-1">
                    Taux €/h HT
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    value={devisTauxHoraire}
                    onChange={(e) => setDevisTauxHoraire(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-4 py-3 rounded-2xl bg-white ring-1 ring-black/[0.06] text-[15px] font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#A16207]/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] tracking-widest uppercase font-mono text-black/40 mb-1">
                  Forfait déplacement HT
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="5"
                  value={devisForfaitDeplacement}
                  onChange={(e) => setDevisForfaitDeplacement(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-4 py-3 rounded-2xl bg-white ring-1 ring-black/[0.06] text-[15px] font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#A16207]/30"
                />
                <div className="mt-1 text-[11px] text-black/45 leading-snug px-1">
                  Mettre 0 pour ne pas inclure le déplacement.
                </div>
              </div>

              {/* Resume lignes auto-generees */}
              {intervention && (
                <div className="px-4 py-3 rounded-2xl bg-[#A16207]/8 ring-1 ring-[#A16207]/15">
                  <div className="text-[10px] font-mono tracking-widest uppercase text-[#A16207] mb-2">
                    Lignes pré-remplies (modifiables après génération)
                  </div>
                  <ul className="space-y-1.5 text-[12px] text-[#111] leading-snug">
                    <li>• Main d&apos;œuvre : {devisHeures}h × {devisTauxHoraire}€ = {(devisHeures * devisTauxHoraire).toFixed(2)}€</li>
                    {intervention.weight > 0 &&
                      intervention.typeIntervention !== "recuperation" &&
                      intervention.typeIntervention !== "demantelement" && (
                        <li>• Fluide {intervention.fluide.code} : {intervention.weight.toFixed(3)} kg</li>
                      )}
                    {(intervention.typeIntervention === "controle_periodique" ||
                      intervention.typeIntervention === "controle_non_periodique") && (
                      <li>• Contrôle d&apos;étanchéité CERFA 15497*04 : 45€</li>
                    )}
                    {intervention.bsffId &&
                      (intervention.typeIntervention === "recuperation" ||
                        intervention.typeIntervention === "demantelement") && (
                        <li>• Frais traitement filière + BSFF officiel : {intervention.weight.toFixed(3)} kg</li>
                      )}
                    {devisForfaitDeplacement > 0 && (
                      <li>• Déplacement : {devisForfaitDeplacement}€ HT</li>
                    )}
                  </ul>
                </div>
              )}

              {devisError && (
                <div className="px-4 py-3 rounded-2xl bg-red-50 text-red-700 text-[13px] border border-red-200">
                  ❌ {devisError}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-black/[0.06]">
              <button
                type="button"
                onClick={handleGenerateDevisFromIntervention}
                disabled={devisLoading || !devisClientNom.trim()}
                className="block w-full px-6 py-4 rounded-2xl bg-[#A16207] text-white text-[15px] font-medium text-center active:bg-[#8a5206] transition-colors disabled:opacity-60"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                {devisLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    Génération du devis…
                  </span>
                ) : (
                  "💰 Générer le devis PDF"
                )}
              </button>
              <div className="text-[10.5px] text-black/40 leading-snug text-center mt-2">
                PDF avec ton logo + signature + CGV. Téléchargement direct.
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex items-start gap-4">
      <div className="text-[13px] text-black/50 min-w-[100px] shrink-0">{label}</div>
      <div className="text-[14px] text-[#111] flex-1 break-words">{value}</div>
    </div>
  );
}

function BsffStep({
  order,
  label,
  actor,
  done,
  date,
}: {
  order: number;
  label: string;
  actor: string;
  done: boolean;
  date?: string;
}) {
  const dateFmt = date
    ? new Date(date).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return (
    <div className="flex items-start gap-3">
      <div
        className={`relative shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold ${
          done
            ? "bg-emerald-500 text-white"
            : "bg-black/[0.06] text-black/40 ring-1 ring-black/10"
        }`}
      >
        {done ? "✓" : order}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className={`text-[14px] font-medium ${done ? "text-[#111]" : "text-black/55"}`}>
          {label}
        </div>
        <div className="text-[12px] text-black/45 mt-0.5">{actor}</div>
        {dateFmt && (
          <div className="text-[11px] text-emerald-700 mt-1 font-mono">{dateFmt}</div>
        )}
        {!done && (
          <div className="text-[11px] text-black/35 mt-1">En attente</div>
        )}
      </div>
    </div>
  );
}
