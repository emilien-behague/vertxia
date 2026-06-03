"use client";

import { useEffect, useMemo, useState, use } from "react";
import {
  listEquipements,
  computeStatus,
  UNITE_INTERIEURE_LABELS,
  buildRelanceMailto,
  type EquipementWithStatus,
  type ControleStatut,
} from "@/lib/equipement";
import { listInterventions } from "@/lib/intervention-storage";
import { loadProfil, type Profil } from "@/lib/profil";
import { generateQrLabel } from "@/lib/qr-label";
import { fetchPublicEquipement, fetchPublicInterventions, lastFetchDebug, type PublicEquipement } from "@/lib/public-sync";

// Page mobile premium — affichée quand un frigoriste scanne le QR Code collé sur
// un équipement. Doit s'afficher SANS bug sur Safari iOS (zéro animation initial:opacity:0
// pour éviter le bug d'hydration React 19 + framer-motion 12 qui bloque l'opacity à 0).
// Le wow factor vient du design typographique + couleurs statut + CTA géant, pas des anims.

const STATUT_VISUAL: Record<
  ControleStatut,
  { label: string; bg: string; text: string; dot: string; ring: string; pulse: boolean }
> = {
  en_retard: {
    label: "Contrôle en retard",
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
    ring: "ring-red-200",
    pulse: true,
  },
  a_relancer: {
    label: "Relance client à programmer",
    bg: "bg-orange-50",
    text: "text-orange-700",
    dot: "bg-orange-500",
    ring: "ring-orange-200",
    pulse: true,
  },
  a_programmer: {
    label: "À programmer",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    ring: "ring-amber-200",
    pulse: false,
  },
  jamais: {
    label: "Jamais contrôlé",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
    ring: "ring-blue-200",
    pulse: false,
  },
  ok: {
    label: "À jour",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    ring: "ring-emerald-200",
    pulse: false,
  },
  exempt: {
    label: "Exempté",
    bg: "bg-black/[0.04]",
    text: "text-black/50",
    dot: "bg-black/30",
    ring: "ring-black/10",
    pulse: false,
  },
};

function fmtDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtJours(j: number | null): string {
  if (j === null) return "";
  if (j < 0) return `${Math.abs(j)} jours de retard`;
  if (j === 0) return "aujourd'hui";
  if (j === 1) return "demain";
  if (j < 31) return `dans ${j} jours`;
  if (j < 365) return `dans ${Math.round(j / 30)} mois`;
  return `dans ${Math.round(j / 365)} an${j > 730 ? "s" : ""}`;
}

export default function EquipementScannedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [mounted, setMounted] = useState(false);
  const [eq, setEq] = useState<EquipementWithStatus | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  // Mode lecture seule = équipement chargé depuis Supabase, pas en local
  // (visiteur qui scan le QR d'un équipement d'un autre frigoriste)
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [ownerPublic, setOwnerPublic] = useState<PublicEquipement["ownerPublic"]>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMounted(true);
      // 1. Cherche en local (cas owner sur son propre device)
      const all = listEquipements();
      const found = all.find((e) => e.id === id);
      if (found) {
        const interventions = listInterventions();
        if (!cancelled) {
          setEq(computeStatus(found, interventions));
          setProfil(loadProfil());
          setIsReadOnly(false);
        }
        return;
      }
      // 2. Fallback Supabase (cas partage public : visiteur scan le QR d'un
      //    équipement d'un autre frigoriste). RLS policy "equipements_select_public"
      //    autorise la lecture sans login.
      setFetching(true);
      const remote = await fetchPublicEquipement(id);
      if (cancelled) return;
      if (!remote) {
        setEq(null);
        setFetching(false);
        return;
      }
      // En mode public (non-owner) on ne fetch PAS l'historique d'interventions
      // car on ne veut pas l'exposer aux visiteurs.
      const remoteInterventions = remote.isReadOnly
        ? []
        : await fetchPublicInterventions(id);
      if (cancelled) return;
      setEq(computeStatus(remote, remoteInterventions));
      setIsReadOnly(remote.isReadOnly);
      setOwnerPublic(remote.ownerPublic ?? null);
      setFetching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const visual = useMemo(() => (eq ? STATUT_VISUAL[eq.statut] : null), [eq]);

  const relanceMailto = useMemo(() => {
    if (!eq || eq.statut !== "a_relancer") return null;
    return buildRelanceMailto({
      eq,
      frigoristeEmail: profil?.email || undefined,
      frigoristeRaisonSociale: profil?.raisonSociale || undefined,
      frigoristeNumeroAttestation: profil?.numeroAttestation || undefined,
      frigoristeTelephone: profil?.telephone || undefined,
    });
  }, [eq, profil]);

  async function handleGenerateQr() {
    if (!eq) return;
    setQrError(null);
    setQrLoading(true);
    try {
      const blob = await generateQrLabel(eq, window.location.origin);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const filenameSafe = (eq.modele || "equipement")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
      a.href = url;
      a.download = `etiquette-qr-${filenameSafe}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setQrError(e instanceof Error ? e.message : "Erreur génération QR");
    } finally {
      setQrLoading(false);
    }
  }

  if (!mounted || fetching) return <LoadingState />;
  if (!eq || !visual) return <NotFoundState id={id} debug={lastFetchDebug} />;

  return (
    <div
      className="min-h-screen bg-[#F5F4F0] text-[#111] font-sans antialiased"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="max-w-md mx-auto px-5 py-6">
        {/* Bandeau "Suivi par un pro" — visible quand visiteur non-owner.
            Le client final, un confrère ou un contrôleur voit la fiche
            épurée + les coordonnées du frigoriste référent. */}
        {isReadOnly && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] tracking-widest uppercase font-mono text-emerald-800 mb-0.5">
                  · Installation suivie
                </div>
                <div className="text-[12px] text-emerald-900/80 leading-relaxed">
                  Cette installation est suivie par un professionnel certifié. Coordonnées en bas de page.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header compact — la nav vers /m/equipements (PARC) est cachée
            pour les visiteurs non-owner (le client n'a pas accès au parc). */}
        <div className="flex items-center justify-between mb-6">
          {!isReadOnly ? (
            <a
              href="/m/equipements"
              className="font-mono text-[10px] tracking-[0.25em] text-black/45 hover:text-black/80 transition-colors inline-flex items-center gap-2"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              PARC
            </a>
          ) : (
            <span />
          )}
          <div className="font-mono text-[10px] tracking-[0.25em] text-black/30">
            QR SCANNÉ
          </div>
          <a
            href="/"
            className="font-mono text-[10px] tracking-[0.25em] text-black/45 hover:text-black/80 transition-colors"
          >
            VERTXIA
          </a>
        </div>

        {/* Hero card — statut + modèle */}
        <div className={`rounded-3xl ${visual.bg} ring-1 ${visual.ring} px-6 py-7 mb-4 shadow-sm`}>
          {/* Statut badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 ${visual.text}`}>
            <span className="relative flex w-2 h-2">
              {visual.pulse && (
                <span className={`absolute inset-0 rounded-full ${visual.dot} opacity-50 animate-ping`} />
              )}
              <span className={`relative w-2 h-2 rounded-full ${visual.dot}`} />
            </span>
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase font-semibold">
              {visual.label}
            </span>
          </div>

          <h1 className="mt-5 text-3xl font-light leading-[1.1] tracking-tight text-[#111] break-words">
            {eq.modele || "(modèle inconnu)"}
          </h1>

          {!isReadOnly && (
            <div className="mt-2 text-sm text-black/65 leading-relaxed">
              <strong className="text-black/85 font-medium">{eq.clientName}</strong>
              {eq.siteAdresse && (
                <span className="block text-xs text-black/50 mt-0.5">{eq.siteAdresse}</span>
              )}
            </div>
          )}

          {eq.prochainControleISO && (
            <div className="mt-5 pt-5 border-t border-black/[0.06]">
              <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-black/40">
                Prochain contrôle
              </div>
              <div className={`mt-1 text-base font-medium ${visual.text}`}>
                {fmtDateLong(eq.prochainControleISO)}
              </div>
              {eq.joursAvantControle !== null && (
                <div className="text-xs text-black/50 mt-0.5">
                  {fmtJours(eq.joursAvantControle)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Encart RELANCE CLIENT — visible uniquement si statut a_relancer ET owner */}
        {eq.statut === "a_relancer" && !isReadOnly && (
          <div className="rounded-2xl bg-orange-50 ring-1 ring-orange-200 p-5 mb-3">
            <div className="flex items-start gap-3">
              <div className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full bg-orange-500 text-white text-xl">
                🔔
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-orange-800/70">
                  Relance client à programmer
                </div>
                <div className="mt-1 text-[15px] font-medium text-orange-900 leading-snug">
                  Contrôle d&apos;étanchéité réglementaire dû dans {Math.max(0, eq.joursAvantControle ?? 0)} jours
                </div>
                <div className="mt-1 text-[12px] text-orange-800/75">
                  Article 5 du règlement UE 2024/573 — prévenir le client maintenant pour planifier l&apos;intervention.
                </div>
              </div>
            </div>

            {eq.clientEmail && relanceMailto ? (
              <a
                href={relanceMailto}
                className="mt-4 block w-full px-5 py-3.5 rounded-xl bg-orange-600 text-white text-[14px] font-medium text-center active:bg-orange-700 transition-colors"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                📧 Préparer l&apos;email de relance
              </a>
            ) : (
              <div className="mt-4 px-4 py-3 rounded-xl bg-white border border-orange-200 text-[12px] text-orange-900 leading-relaxed">
                <strong>Email client manquant.</strong> Pour activer le bouton d&apos;envoi automatique, ajoute l&apos;email du
                client dans la fiche équipement.
              </div>
            )}

            {eq.clientTelephone && (
              <a
                href={`tel:${eq.clientTelephone.replace(/\s/g, "")}`}
                className="mt-2 block w-full px-5 py-2.5 rounded-xl bg-white ring-1 ring-orange-200 text-orange-800 text-[13px] font-medium text-center active:bg-orange-100 transition-colors"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                📞 Appeler {eq.clientTelephone}
              </a>
            )}
          </div>
        )}

        {/* CTA principal — owner uniquement (démarrer intervention) */}
        {!isReadOnly && (
          <a
            href={`/m/intervention/nouvelle?equipement=${eq.id}`}
            className="block w-full px-6 py-5 bg-[#111] text-white rounded-2xl mb-3 active:bg-black/90 active:scale-[0.98] transition-all shadow-lg shadow-black/15"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/55">
                  Action principale
                </div>
                <div className="mt-1 text-base font-medium tracking-wide">
                  Démarrer une intervention
                </div>
                <div className="text-xs text-white/55 mt-0.5">
                  Formulaire pré-rempli avec cet équipement
                </div>
              </div>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
          </a>
        )}

        {/* Bloc "Contacter votre frigoriste référent" — mode public uniquement */}
        {isReadOnly && ownerPublic && (ownerPublic.telephone || ownerPublic.email) && (
          <div className="rounded-2xl bg-[#111] text-white mb-3 overflow-hidden shadow-lg shadow-black/15">
            <div className="px-5 py-4">
              <div className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/55 mb-1">
                Frigoriste référent
              </div>
              {ownerPublic.raisonSociale && (
                <div className="text-base font-medium tracking-wide">
                  {ownerPublic.raisonSociale}
                </div>
              )}
              {ownerPublic.numeroAttestation && (
                <div className="text-[11px] text-white/55 mt-0.5">
                  Attestation F-Gas n° {ownerPublic.numeroAttestation}
                </div>
              )}
            </div>
            <div className="divide-y divide-white/10">
              {ownerPublic.telephone && (
                <a
                  href={`tel:${ownerPublic.telephone.replace(/\s/g, "")}`}
                  className="px-5 py-3.5 flex items-center gap-3 active:bg-white/5 transition-colors"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-white/45 uppercase tracking-wider">Téléphone</div>
                    <div className="text-[15px] font-medium truncate">{ownerPublic.telephone}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </a>
              )}
              {ownerPublic.email && (
                <a
                  href={`mailto:${ownerPublic.email}`}
                  className="px-5 py-3.5 flex items-center gap-3 active:bg-white/5 transition-colors"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-white/45 uppercase tracking-wider">Email</div>
                    <div className="text-[15px] font-medium truncate">{ownerPublic.email}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Coordonnées client — owner uniquement (donnée commerciale sensible) */}
        {!isReadOnly && (eq.clientEmail || eq.clientTelephone || eq.siteAdresse) && (
          <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] mb-3 overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex items-baseline justify-between">
              <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-black/45">
                Coordonnées client
              </div>
              <div className="text-[11px] font-medium text-black/55 truncate ml-3 min-w-0">
                {eq.clientName}
              </div>
            </div>
            <div className="divide-y divide-black/[0.05]">
              {eq.clientEmail && (
                <a
                  href={`mailto:${eq.clientEmail}`}
                  className="px-5 py-3 flex items-center gap-3 active:bg-black/[0.03] transition-colors"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-black/45 uppercase tracking-wide">Email</div>
                    <div className="text-[14px] text-[#111] truncate">{eq.clientEmail}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </a>
              )}
              {eq.clientTelephone && (
                <a
                  href={`tel:${eq.clientTelephone.replace(/\s/g, "")}`}
                  className="px-5 py-3 flex items-center gap-3 active:bg-black/[0.03] transition-colors"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 text-emerald-700">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-black/45 uppercase tracking-wide">Téléphone</div>
                    <div className="text-[14px] text-[#111] truncate">{eq.clientTelephone}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </a>
              )}
              {eq.siteAdresse && (
                <a
                  href={`https://maps.apple.com/?q=${encodeURIComponent(eq.siteAdresse)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 flex items-center gap-3 active:bg-black/[0.03] transition-colors"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 text-amber-700">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-black/45 uppercase tracking-wide">Adresse du site</div>
                    <div className="text-[14px] text-[#111]">{eq.siteAdresse}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Specs équipement — détails masqués en mode public (visiteur).
            Le visiteur voit juste fluide (code) + n°série + fréquence
            réglementaire indicative. Charge, GWP, tCO2eq, détecteur, dernier
            contrôle = données techniques commerciales du frigoriste. */}
        <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] divide-y divide-black/[0.06] mb-3">
          <SpecRow
            label="Fluide"
            value={isReadOnly ? eq.fluide.code : `${eq.fluide.code} · GWP ${eq.fluide.gwp.toLocaleString("fr-FR")}`}
          />
          {!isReadOnly && (
            <>
              <SpecRow label="Charge nominale" value={`${eq.chargeKg.toFixed(2).replace(".", ",")} kg`} />
              <SpecRow
                label="Équivalent CO₂"
                value={`${eq.tCO2eq.toFixed(2).replace(".", ",")} tCO₂eq`}
                sub={eq.frequenceMois ? `Contrôle tous les ${eq.frequenceMois} mois` : "Exempté de contrôle"}
              />
            </>
          )}
          <SpecRow label="Numéro de série" value={eq.numeroSerie} mono />
          {!isReadOnly && eq.detecteurFixe && (
            <SpecRow label="Détecteur fixe" value="Oui — fréquence × 2" valueClass="text-purple-700" />
          )}
          {!isReadOnly && (
            <SpecRow label="Dernier contrôle" value={fmtDateLong(eq.dernierControleISO)} />
          )}
          {isReadOnly && eq.frequenceMois && (
            <SpecRow
              label="Fréquence réglementaire"
              value={`Contrôle d'étanchéité tous les ${eq.frequenceMois} mois`}
            />
          )}
        </div>

        {!isReadOnly && eq.notes && (
          <div className="rounded-2xl bg-amber-50/60 ring-1 ring-amber-200/50 px-5 py-4 mb-3">
            <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-amber-800/70">
              Notes
            </div>
            <div className="mt-1.5 text-sm text-amber-900 italic">{eq.notes}</div>
          </div>
        )}

        {/* Unités intérieures rattachées au circuit fluide — owner uniquement
            (le visiteur n'a pas besoin de connaître la topologie de l'installation). */}
        {!isReadOnly && eq.unitesInterieures && eq.unitesInterieures.length > 0 && (
          <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] mb-3 overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex items-baseline justify-between">
              <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-black/45">
                Unités intérieures rattachées
              </div>
              <div className="text-[11px] font-mono text-black/45">{eq.unitesInterieures.length}</div>
            </div>
            <div className="divide-y divide-black/[0.05]">
              {eq.unitesInterieures.map((u, idx) => (
                <div key={idx} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-black/50 uppercase tracking-wide">
                        {UNITE_INTERIEURE_LABELS[u.type]}
                      </div>
                      <div className="text-[14px] text-[#111] mt-0.5 truncate">{u.modele}</div>
                      {u.emplacement && (
                        <div className="text-[12px] text-black/55 italic mt-0.5">{u.emplacement}</div>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-black/55 shrink-0">{u.numeroSerie}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-black/[0.02] border-t border-black/[0.05]">
              <div className="text-[11px] text-black/55 leading-relaxed">
                Toutes les unités partagent le même circuit fluide ({eq.fluide.code}). Le contrôle d&apos;étanchéité
                et la récupération s&apos;effectuent sur l&apos;installation complète, pas par unité.
              </div>
            </div>
          </div>
        )}

        {/* Actions secondaires — owner uniquement */}
        {!isReadOnly && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          <button
            type="button"
            onClick={handleGenerateQr}
            disabled={qrLoading}
            className="rounded-xl bg-white ring-1 ring-black/[0.06] px-3 py-3 text-center hover:bg-black/[0.02] active:bg-black/[0.04] transition-colors disabled:opacity-60"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-black/40">
              QR Code
            </div>
            <div className="mt-1 text-xs font-medium text-black/75">
              {qrLoading ? "Génération…" : "Étiquette PDF"}
            </div>
          </button>
          <a
            href={`/m/historique?equipement=${eq.id}`}
            className="rounded-xl bg-white ring-1 ring-black/[0.06] px-3 py-3 text-center hover:bg-black/[0.02] active:bg-black/[0.04] transition-colors"
          >
            <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-black/40">
              Historique
            </div>
            <div className="mt-1 text-xs font-medium text-black/75">Interventions</div>
          </a>
          <a
            href="/m"
            className="rounded-xl bg-white ring-1 ring-black/[0.06] px-3 py-3 text-center hover:bg-black/[0.02] active:bg-black/[0.04] transition-colors"
          >
            <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-black/40">
              Vue
            </div>
            <div className="mt-1 text-xs font-medium text-black/75">Tableau de bord</div>
          </a>
        </div>
        )}
        {!isReadOnly && qrError && (
          <div className="mt-2 px-4 py-2 rounded-xl bg-red-50 ring-1 ring-red-200 text-[12px] text-red-700 text-center">
            {qrError}
          </div>
        )}

        {/* Footer minimal */}
        <div className="mt-10 text-center opacity-60">
          <div className="font-mono text-[9px] tracking-[0.3em] text-black/35">
            VERTXIA · F-GAS · {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecRow({
  label,
  value,
  sub,
  mono,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="px-5 py-3.5 flex items-baseline justify-between gap-4">
      <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-black/40 shrink-0">
        {label}
      </div>
      <div className="text-right min-w-0">
        <div
          className={`text-sm ${mono ? "font-mono" : ""} ${valueClass ?? "text-black/85"} truncate`}
        >
          {value}
        </div>
        {sub && <div className="text-[10px] text-black/40 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-[#F5F4F0] flex items-center justify-center">
      <div className="flex items-center gap-3">
        <span className="inline-block w-4 h-4 rounded-full border-2 border-black/15 border-t-black/60 animate-spin" />
        <span className="font-mono text-[10px] tracking-[0.25em] text-black/50">
          CHARGEMENT…
        </span>
      </div>
    </div>
  );
}

type FullDiag = {
  env?: {
    SUPABASE_URL_set: boolean;
    SUPABASE_PUBLISHABLE_KEY_set: boolean;
    SUPABASE_SERVICE_ROLE_KEY_set: boolean;
    SUPABASE_URL_host: string | null;
  };
  usingServiceRole?: boolean;
  anonCount?: number | null;
  anonCountError?: string | null;
  anonSample?: Array<{ id: string; user_id: string; modele: string }> | null;
  anonSampleError?: string | null;
  anonProbe?: { id: string; user_id: string; modele: string } | null;
  anonProbeError?: string | null;
  anonClientCrash?: string;
  visitor?: { id: string; email: string | null } | null;
  visitorError?: string;
};

function NotFoundState({ id, debug }: { id: string; debug: import("@/lib/public-sync").FetchDebug | null }) {
  const [diag, setDiag] = useState<FullDiag | "loading" | "error">("loading");

  useEffect(() => {
    fetch(`/api/public/diag?id=${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { "cache-control": "no-store" },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((j: FullDiag) => setDiag(j))
      .catch(() => setDiag("error"));
  }, [id]);

  return (
    <div
      className="min-h-screen bg-[#F5F4F0] text-[#111] font-sans antialiased"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-md mx-auto px-5 py-12">
        <div className="rounded-3xl bg-amber-50 ring-1 ring-amber-200 px-6 py-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <h1 className="text-xl font-light text-[#111]">Équipement introuvable</h1>
          <p className="mt-2 text-sm text-black/55 leading-relaxed">
            Cet équipement n&apos;existe pas dans ce compte Vertxia, ou il a été supprimé.
          </p>
          <div className="mt-1 text-[10px] font-mono text-black/30">ID : {id.slice(0, 8)}…</div>
        </div>

        {/* Diagnostic technique COMPLET via /api/public/diag */}
        <div className="mt-4 rounded-2xl bg-black/[0.04] ring-1 ring-black/10 px-4 py-3">
          <details open>
            <summary className="text-[11px] font-mono tracking-widest uppercase text-black/55 cursor-pointer">
              · Diagnostic technique
            </summary>
            <div className="mt-3 text-[10px] font-mono text-black/70 leading-relaxed space-y-2">
              <div>
                <div className="text-black/90 font-semibold mb-1">CLIENT (Safari) :</div>
                <div>· ID recherché : {id}</div>
                {debug?.errorMessage && (
                  <div className="text-red-600">· Erreur fetch : {debug.errorMessage}</div>
                )}
                {typeof debug?.rowCount === "number" && (
                  <div>· Lignes reçues : {debug.rowCount}</div>
                )}
              </div>

              {diag === "loading" && <div className="text-black/40">Chargement diagnostic serveur…</div>}
              {diag === "error" && (
                <div className="text-red-600">
                  Impossible de joindre /api/public/diag. Le serveur Next.js ne répond pas — vérifier le déploiement Vercel.
                </div>
              )}
              {typeof diag === "object" && (
                <>
                  <div>
                    <div className="text-black/90 font-semibold mb-1 mt-2">SERVEUR (Vercel) :</div>
                    <div>· SUPABASE_URL : {diag.env?.SUPABASE_URL_set ? `✓ ${diag.env.SUPABASE_URL_host}` : "✗ ABSENT"}</div>
                    <div>· PUBLISHABLE_KEY : {diag.env?.SUPABASE_PUBLISHABLE_KEY_set ? "✓ set" : "✗ ABSENT"}</div>
                    <div>· SERVICE_ROLE_KEY : {diag.env?.SUPABASE_SERVICE_ROLE_KEY_set ? "✓ set" : "(optionnel, absent)"}</div>
                  </div>

                  <div>
                    <div className="text-black/90 font-semibold mb-1 mt-2">
                      LECTURE {diag.usingServiceRole ? "SERVICE-ROLE (bypass RLS)" : "ANON"} :
                    </div>
                    {diag.anonClientCrash && (
                      <div className="text-red-600">· Crash : {diag.anonClientCrash}</div>
                    )}
                    <div>· Count total : {diag.anonCount ?? "null"}</div>
                    {diag.anonCountError && (
                      <div className="text-red-600">· Count error : {diag.anonCountError}</div>
                    )}
                    <div>· Sample (3 premiers) : {diag.anonSample?.length ?? 0} ligne(s)</div>
                    {diag.anonSample?.map((s, i) => (
                      <div key={i} className="text-black/50 pl-3">
                        - {s.id.slice(0, 8)} · {s.modele}
                      </div>
                    ))}
                    {diag.anonSampleError && (
                      <div className="text-red-600">· Sample error : {diag.anonSampleError}</div>
                    )}
                    <div className="mt-1">
                      · Probe ID = {id.slice(0, 8)}… :{" "}
                      {diag.anonProbe ? (
                        <span className="text-emerald-700">✓ TROUVÉ (owner {diag.anonProbe.user_id.slice(0, 8)}…)</span>
                      ) : (
                        <span className="text-red-600">✗ pas de row visible</span>
                      )}
                    </div>
                    {diag.anonProbeError && (
                      <div className="text-red-600">· Probe error : {diag.anonProbeError}</div>
                    )}
                  </div>

                  <div>
                    <div className="text-black/90 font-semibold mb-1 mt-2">VISITEUR :</div>
                    <div>· Connecté : {diag.visitor ? `✓ ${diag.visitor.email ?? diag.visitor.id.slice(0, 8)}…` : "✗ non"}</div>
                    {diag.visitorError && (
                      <div className="text-red-600">· Error : {diag.visitorError}</div>
                    )}
                  </div>

                  {/* Verdict */}
                  <div className="mt-3 pt-2 border-t border-black/10">
                    {!diag.env?.SUPABASE_URL_set || !diag.env?.SUPABASE_PUBLISHABLE_KEY_set ? (
                      <div className="text-red-700">
                        → ENV VARS MANQUANTES côté serveur. Configurer dans Vercel → Project Settings → Environment Variables (cocher PREVIEW), puis redeploy.
                      </div>
                    ) : diag.anonCount === 0 ? (
                      diag.usingServiceRole ? (
                        <div className="text-amber-700">
                          → Table RÉELLEMENT vide (service-role bypass RLS). Aucun équipement n&apos;est jamais arrivé en Supabase.
                          Cause probable : le POST /api/public/equipement/upsert échoue silencieusement (401 not authenticated ou autre).
                          Crée un équipement maintenant, l&apos;upsert va se faire au save — reviens scanner.
                        </div>
                      ) : (
                        <div className="text-amber-700">
                          → Table VIDE en mode anon. Soit aucun équipement créé, soit policy publique non appliquée. Coller dans SQL Editor :
                          <pre className="mt-1 p-2 bg-black/5 rounded text-[9px] whitespace-pre-wrap break-all">
{`drop policy if exists "equipements_select_public" on public.equipements;
create policy "equipements_select_public" on public.equipements
  for select to anon, authenticated using (true);
drop policy if exists "interventions_select_public" on public.interventions;
create policy "interventions_select_public" on public.interventions
  for select to anon, authenticated using (true);`}
                          </pre>
                        </div>
                      )
                    ) : diag.anonProbe ? (
                      <div className="text-emerald-700">
                        → Row trouvée mais loadée en local échoue. Bug code, à investiguer.
                      </div>
                    ) : (
                      <div className="text-amber-700">
                        → Sample contient {diag.anonSample?.length ?? 0} rows mais pas l&apos;ID demandé. Soit ID inconnu, soit policy ne couvre pas cet ID.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </details>
        </div>

        <div className="mt-5 space-y-2">
          <a
            href="/m/equipements"
            className="block w-full px-5 py-3.5 bg-[#111] text-white text-sm tracking-widest font-medium rounded-xl text-center active:bg-black/90 transition-colors"
          >
            VOIR LE PARC ÉQUIPEMENTS
          </a>
        </div>
      </div>
    </div>
  );
}
