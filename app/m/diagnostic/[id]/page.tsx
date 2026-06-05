"use client";

// Page détail d'un diagnostic passé (Rank 11 brainstorm).
// Lit le diagnostic stocké en localStorage via getDiagnostic(id) et affiche
// la photo + le résultat complet (réutilise le même layout que /m/diagnostic
// en phase result). Possibilité de partager ou supprimer.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/mobile-header";
import {
  getDiagnostic,
  deleteDiagnostic,
  type StoredDiagnostic,
} from "@/lib/diagnostic-storage";
import {
  GRAVITE_LABELS,
  GRAVITE_STYLES,
  DELAI_LABELS,
} from "@/lib/vision-diagnostic";
import {
  shareDiagnostic,
  buildDiagnosticWhatsAppUrl,
  buildDiagnosticMailtoUrl,
  downloadDiagnosticImage,
} from "@/lib/diagnostic-share";
import { loadProfil } from "@/lib/profil";
import {
  buildDevisFromDiagnostic,
  generateDevisNumero,
  whyDevisBlocked,
  estimerHeuresMainOeuvre,
} from "@/lib/devis";

function fmtDateLong(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DiagnosticDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [diag, setDiag] = useState<StoredDiagnostic | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  useEffect(() => {
    const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
    if (id) setDiag(getDiagnostic(id));
    setLoaded(true);
  }, [params.id]);

  async function handleShare() {
    if (!diag) return;
    const outcome = await shareDiagnostic({
      imageDataUrl: diag.imageDataUrl,
      result: diag.result,
      filenameHint: diag.createdAt.slice(0, 10),
    });
    if (outcome === "clipboard") {
      setShareToast("Diagnostic copié dans le presse-papier (image non partageable)");
      setTimeout(() => setShareToast(null), 3000);
    } else if (outcome === "shared_text_only") {
      setShareToast("Partagé en texte seul (image non supportée par cible)");
      setTimeout(() => setShareToast(null), 3000);
    } else if (outcome === "failed") {
      setShareToast("Échec du partage");
      setTimeout(() => setShareToast(null), 3000);
    }
  }

  function handleSendWhatsApp() {
    if (!diag) return;
    // 1. Download la photo dans Downloads pour attachement manuel
    const filenameHint = `${diag.result.composantIdentifie || "diagnostic"}-${diag.createdAt.slice(0, 10)}`;
    downloadDiagnosticImage(diag.imageDataUrl, filenameHint);
    // 2. Ouvre WhatsApp avec le texte pre-rempli
    const profil = loadProfil();
    const url = buildDiagnosticWhatsAppUrl(diag.result, profil);
    window.open(url, "_blank", "noopener,noreferrer");
    setShareToast("Photo téléchargée — attache-la dans WhatsApp avant d'envoyer");
    setTimeout(() => setShareToast(null), 5000);
  }

  function handleSendEmail() {
    if (!diag) return;
    // 1. Download la photo dans Downloads pour attachement manuel
    const filenameHint = `${diag.result.composantIdentifie || "diagnostic"}-${diag.createdAt.slice(0, 10)}`;
    downloadDiagnosticImage(diag.imageDataUrl, filenameHint);
    // 2. Ouvre l'app mail avec subject + body pre-remplis
    const profil = loadProfil();
    const url = buildDiagnosticMailtoUrl(diag.result, profil);
    window.location.href = url;
    setShareToast("Photo téléchargée — attache-la dans le mail avant d'envoyer");
    setTimeout(() => setShareToast(null), 5000);
  }

  /** Genere un devis depuis ce diagnostic stocke + identite pro. Telecharge
   *  direct le PDF (V1). Le pro saisit le client via prompt. */
  async function handleGenerateDevis() {
    if (!diag) return;
    // Garde-fou : refuse si diagnostic invalide (cf lib/devis whyDevisBlocked).
    const blocked = whyDevisBlocked(diag.result);
    if (blocked) {
      setShareToast(blocked);
      setTimeout(() => setShareToast(null), 6000);
      return;
    }
    const profil = loadProfil();
    if (!profil.raisonSociale?.trim()) {
      setShareToast("Profil entreprise incomplet — renseigne ta raison sociale dans /m/profil");
      setTimeout(() => setShareToast(null), 5000);
      return;
    }
    const clientName = window.prompt("Nom du client destinataire du devis :", "");
    if (!clientName?.trim()) return;
    const clientAdresse = window.prompt("Adresse du client (optionnel) :", "") || undefined;

    // Heures main d'œuvre : taux horaire depuis profil + estimation auto
    const tauxHoraire = profil.tauxHoraireDevisHT && profil.tauxHoraireDevisHT > 0
      ? profil.tauxHoraireDevisHT
      : 65;
    const heuresEstimees = estimerHeuresMainOeuvre(diag.result, tauxHoraire);
    const heuresInput = window.prompt(
      `Nombre d'heures de main d'œuvre prévues (taux ${tauxHoraire} €/h) :`,
      String(heuresEstimees).replace(".", ",")
    );
    if (heuresInput === null) return;
    const heuresParse = parseFloat(heuresInput.replace(",", "."));
    const heuresMainOeuvre = !isNaN(heuresParse) && heuresParse > 0
      ? heuresParse
      : heuresEstimees;

    setShareToast("Génération du devis en cours…");
    try {
      const devis = buildDevisFromDiagnostic({
        diagnostic: diag.result,
        diagnosticId: diag.id,
        diagnosticDateISO: diag.createdAt,
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
          nom: clientName.trim(),
          adresse: clientAdresse?.trim() || undefined,
        },
        numero: generateDevisNumero(),
        heuresMainOeuvre,
        tauxHoraireHT: tauxHoraire,
      });
      const res = await fetch("/api/devis/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(devis),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${devis.numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShareToast("Devis téléchargé — prêt à envoyer au client");
      setTimeout(() => setShareToast(null), 4000);
    } catch (e) {
      setShareToast(
        "Échec génération devis : " + (e instanceof Error ? e.message : "erreur réseau")
      );
      setTimeout(() => setShareToast(null), 5000);
    }
  }

  function handleDelete() {
    if (!diag) return;
    if (!window.confirm("Supprimer ce diagnostic ?\n\nAction irréversible.")) return;
    deleteDiagnostic(diag.id);
    router.push("/m/diagnostic/historique");
  }

  if (loaded && !diag) {
    return (
      <>
        <MobileHeader title="🤖 Diagnostic" largeTitle backHref="/m/diagnostic/historique" />
        <div className="px-5 mt-10 text-center">
          <div className="text-[16px] text-[#111] font-medium mb-2">Diagnostic introuvable</div>
          <div className="text-[13px] text-black/55 mb-6">Ce diagnostic n&apos;existe plus dans ton historique.</div>
          <Link
            href="/m/diagnostic/historique"
            className="inline-block px-5 py-2.5 rounded-2xl bg-[#111] text-white text-[13px] font-medium active:bg-black/80 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Retour à l&apos;historique
          </Link>
        </div>
      </>
    );
  }

  if (!diag) {
    return (
      <>
        <MobileHeader title="🤖 Diagnostic" largeTitle backHref="/m/diagnostic/historique" />
      </>
    );
  }

  const r = diag.result;

  return (
    <>
      <MobileHeader title="🤖 Diagnostic" largeTitle backHref="/m/diagnostic/historique" />

      <div className="px-4 pt-2 pb-4 space-y-4">
        <div className="text-[12px] text-black/55 px-1">
          {fmtDateLong(diag.createdAt)}
        </div>

        {/* Photo */}
        <div className="rounded-2xl overflow-hidden ring-1 ring-black/[0.06] bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={diag.imageDataUrl}
            alt="Composant analysé"
            className="w-full h-auto block max-h-72 object-cover"
          />
        </div>

        {/* Contexte note si présent */}
        {diag.contexteNote && (
          <section className="rounded-2xl bg-[#A16207]/8 border border-[#A16207]/15 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-[#A16207] font-medium mb-1">
              Contexte au moment du diagnostic
            </div>
            <div className="text-[13px] text-[#111] italic leading-snug">
              «{diag.contexteNote}»
            </div>
          </section>
        )}

        {/* Composant identifié */}
        <section className="rounded-2xl bg-white ring-1 ring-black/[0.04] p-4">
          <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1">
            Composant identifié
          </div>
          <div className="text-[16px] font-semibold text-[#111] leading-tight">
            {r.composantIdentifie || "Non identifié"}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] uppercase tracking-wider text-black/45 font-medium">
              Confiance
            </span>
            <ConfianceChip confiance={r.confiance} />
          </div>
        </section>

        {/* Défauts détectés */}
        {r.defautsDetectes.length > 0 ? (
          <section className="rounded-2xl bg-white ring-1 ring-black/[0.04] p-4">
            <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-2">
              Défauts détectés ({r.defautsDetectes.length})
            </div>
            <ul className="space-y-3">
              {r.defautsDetectes.map((d, i) => {
                const s = GRAVITE_STYLES[d.gravite];
                return (
                  <li key={i} className="flex items-start gap-3">
                    <div className={`shrink-0 w-2.5 h-2.5 rounded-full mt-1.5 ${s.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-medium text-[#111] leading-snug">
                          {d.nom}
                        </span>
                        <span className={`text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ring-1 ${s.bg} ${s.text} ${s.ring}`}>
                          {GRAVITE_LABELS[d.gravite]}
                        </span>
                      </div>
                      <div className="text-[12.5px] text-black/65 mt-0.5 leading-snug">
                        {d.description}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <section className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
            <div className="flex items-center gap-2 text-[14px] font-medium text-emerald-800">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Aucun défaut visible détecté
            </div>
          </section>
        )}

        {/* Cause + action + devis */}
        <section className="rounded-2xl bg-white ring-1 ring-black/[0.04] p-4 space-y-3">
          {r.causeProbable && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1">
                Cause probable
              </div>
              <div className="text-[13.5px] text-[#111] leading-relaxed">
                {r.causeProbable}
              </div>
            </div>
          )}
          {r.actionRecommandee && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1">
                Action recommandée
              </div>
              <div className="text-[13.5px] text-[#111] leading-relaxed">
                {r.actionRecommandee}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-black/[0.05]">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1">
                Délai
              </div>
              <div className="text-[13px] font-medium text-[#111]">
                {DELAI_LABELS[r.delaiIntervention]}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-black/45 font-medium mb-1">
                Devis estimé
              </div>
              <div className="text-[13px] font-medium text-[#111]">
                {r.devisEstimeMin !== null && r.devisEstimeMax !== null
                  ? `${r.devisEstimeMin}–${r.devisEstimeMax} € HT`
                  : "À chiffrer sur site"}
              </div>
            </div>
          </div>
        </section>

        {r.notesContexte && (
          <section className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-amber-800/70 font-medium mb-1">
              Note du diagnostic
            </div>
            <div className="text-[12.5px] text-amber-900 leading-snug">{r.notesContexte}</div>
          </section>
        )}

        {/* Actions de partage : WhatsApp + Email + Partager natif (fallback).
            Sur clic WhatsApp ou Email, la photo est telechargee dans Downloads
            puis l'app cible s'ouvre avec le texte pre-rempli — l'utilisateur
            attache la photo manuellement (limite URL scheme). */}
        <div className="space-y-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="px-4 py-3 rounded-2xl bg-[#25D366] text-white text-[14px] font-semibold active:bg-[#1da851] transition-colors flex items-center justify-center gap-2"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              WhatsApp
            </button>
            <button
              type="button"
              onClick={handleSendEmail}
              className="px-4 py-3 rounded-2xl bg-[#111] text-white text-[14px] font-semibold active:bg-black/80 transition-colors flex items-center justify-center gap-2"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Email
            </button>
          </div>
          <button
            type="button"
            onClick={handleShare}
            className="w-full px-4 py-3 rounded-2xl bg-white border border-black/[0.08] text-[13px] font-medium text-black/70 active:bg-black/[0.03] transition-colors flex items-center justify-center gap-2"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Autre app (Messages, Drive…)
          </button>
          {/* Generer un devis client depuis ce diagnostic — brief Vertxia #7.
              Bouton remplace par un bloc explicatif si le diagnostic n'est
              pas fiable (composant non identifie / photo non frigorifique). */}
          {(() => {
            const blocked = whyDevisBlocked(diag.result);
            if (blocked) {
              return (
                <div className="rounded-2xl bg-black/[0.04] ring-1 ring-black/[0.06] px-4 py-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-black/45 font-mono mb-1">
                    Devis indisponible
                  </div>
                  <div className="text-[12.5px] text-black/65 leading-snug">
                    {blocked}
                  </div>
                </div>
              );
            }
            return (
              <button
                type="button"
                onClick={handleGenerateDevis}
                className="w-full px-4 py-3 rounded-2xl bg-emerald-600 text-white text-[14px] font-semibold active:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                Générer un devis client
              </button>
            );
          })()}
          <Link
            href={`/m/intervention/nouvelle?diagnosticId=${diag.id}`}
            className="block w-full px-4 py-3 rounded-2xl bg-[#111] text-white text-[14px] font-medium text-center active:bg-black/80 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Créer une intervention pour ce composant
          </Link>
          <Link
            href="/m/diagnostic"
            className="block w-full px-4 py-3 rounded-2xl bg-[#A16207] text-white text-[14px] font-medium text-center active:opacity-90 transition-opacity"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Nouveau diagnostic
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            className="w-full px-4 py-2.5 rounded-2xl text-[13px] text-red-600 active:bg-red-50 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Supprimer ce diagnostic
          </button>
        </div>

        <div className="text-[10px] text-black/35 text-center pt-2">
          Diagnostic généré par Vertxia · vertxia.com
        </div>
      </div>

      {shareToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 px-4 py-2.5 rounded-full bg-black/85 text-white text-[12.5px] font-medium shadow-lg backdrop-blur"
        >
          {shareToast}
        </div>
      )}
    </>
  );
}

function ConfianceChip({ confiance }: { confiance: "haute" | "moyenne" | "basse" }) {
  const styles =
    confiance === "haute"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : confiance === "moyenne"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-red-50 text-red-700 ring-red-200";
  return (
    <span className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ring-1 ${styles}`}>
      {confiance}
    </span>
  );
}

