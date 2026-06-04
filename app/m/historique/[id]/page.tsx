"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection } from "@/components/mobile/inset-list";
import {
  getIntervention,
  deleteIntervention,
  type StoredIntervention,
} from "@/lib/intervention-storage";
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

  async function handleDownloadEtiquette() {
    if (!intervention) return;
    setEtiquetteError(null);
    setEtiquetteLoading(true);
    try {
      const profil = loadProfil();
      const origin = typeof window !== "undefined" ? window.location.origin : "https://vertxia.com";
      const blob = await generateEtiquetteTfe(intervention, profil, origin);
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

  function handleDelete() {
    if (!intervention) return;
    if (!confirm("Supprimer cette intervention de l'historique local ?")) return;
    deleteIntervention(intervention.id);
    router.push("/m/historique");
  }

  if (!loaded) {
    return (
      <>
        <MobileHeader title="Intervention" largeTitle backHref="/m/historique" />
        <div className="px-5 py-20 text-center">
          <div className="inline-block w-8 h-8 border-2 border-black/15 border-t-[#111] rounded-full animate-spin" />
        </div>
      </>
    );
  }

  if (!intervention) {
    return (
      <>
        <MobileHeader title="Intervention" largeTitle backHref="/m/historique" />
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
      <div className="px-4 mt-6 mb-8">
        <button
          type="button"
          onClick={handleDelete}
          className="w-full px-6 py-3 rounded-2xl bg-white border border-red-200 text-red-600 text-[14px] font-medium active:bg-red-50 transition-colors"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          Supprimer de l'historique
        </button>
      </div>
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
