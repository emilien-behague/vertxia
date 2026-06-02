"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection } from "@/components/mobile/inset-list";
import {
  getIntervention,
  deleteIntervention,
  type StoredIntervention,
} from "@/lib/intervention-storage";
import { loadProfil } from "@/lib/profil";

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
  const [loaded, setLoaded] = useState(false);
  const [cerfaLoading, setCerfaLoading] = useState(false);
  const [cerfaError, setCerfaError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    setIntervention(getIntervention(params.id));
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
              ? `Frigoriste Cat. ${profil.categorieAttestation}`
              : "Frigoriste",
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
      </div>

      {/* Identifiant BSFF */}
      {i.bsffId && (
        <InsetListSection title="Identifiant BSFF" footer="Source : TrackDéchets — Ministère de la Transition écologique">
          <div className="px-4 py-3">
            <div className="text-[15px] font-mono text-[#111] break-all">{i.bsffId}</div>
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
