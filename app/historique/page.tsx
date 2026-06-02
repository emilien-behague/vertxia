"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  listInterventions,
  deleteIntervention,
  getStats,
  type StoredIntervention,
} from "@/lib/intervention-storage";
import { loadProfil } from "@/lib/profil";
import type { TypeIntervention } from "@/lib/cerfa";

const TYPE_LABELS: Record<TypeIntervention, string> = {
  recuperation: "Récupération de fluide",
  demantelement: "Démantèlement",
  controle_periodique: "Contrôle périodique",
  controle_non_periodique: "Contrôle non périodique",
  mise_service: "Mise en service",
  maintenance: "Maintenance",
};

const TYPE_FILTERS: { v: "all" | "recup" | "controle" | "autre"; label: string }[] = [
  { v: "all", label: "Tout" },
  { v: "recup", label: "Avec récup + BSFF" },
  { v: "controle", label: "Contrôles d'étanchéité" },
  { v: "autre", label: "Mise en service / Maintenance" },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function matchesFilter(
  intervention: StoredIntervention,
  filter: typeof TYPE_FILTERS[number]["v"]
): boolean {
  if (filter === "all") return true;
  if (filter === "recup") return ["recuperation", "demantelement"].includes(intervention.typeIntervention);
  if (filter === "controle")
    return ["controle_periodique", "controle_non_periodique"].includes(intervention.typeIntervention);
  if (filter === "autre")
    return ["mise_service", "maintenance"].includes(intervention.typeIntervention);
  return true;
}

export default function HistoriquePage() {
  const [items, setItems] = useState<StoredIntervention[]>([]);
  const [filter, setFilter] = useState<typeof TYPE_FILTERS[number]["v"]>("all");
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [rapportId, setRapportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setItems(listInterventions());
  }, []);

  const stats = useMemo(() => getStats(items), [items]);
  const filtered = useMemo(
    () => items.filter(i => matchesFilter(i, filter)),
    [items, filter]
  );

  async function handleDownloadRapport(intervention: StoredIntervention) {
    setRapportId(intervention.id);
    setError(null);
    try {
      const profil = loadProfil();
      if (!profil.raisonSociale) {
        setError(
          "Profil entreprise vide. Renseigne ta raison sociale + adresse sur /profil d'abord."
        );
        return;
      }
      const payload = {
        fluide: intervention.fluide,
        weight: intervention.weight,
        packagingNumero: intervention.packagingNumero,
        clientName: intervention.clientName,
        modeleEquipement: intervention.modeleEquipement,
        numeroSerieEquipement: intervention.numeroSerieEquipement,
        attestation: intervention.attestation,
        lieuIntervention: intervention.lieuIntervention,
        bsffId: intervention.bsffId,
        destination: intervention.destination,
        typeIntervention: intervention.typeIntervention,
        controleDetails: intervention.controleDetails,
        profil,
      };
      const res = await fetch("/api/rapport/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error || "Échec génération rapport");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Rapport_intervention_${intervention.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRapportId(null);
    }
  }

  async function handleRegenerateCerfa(intervention: StoredIntervention) {
    setRegeneratingId(intervention.id);
    setError(null);
    try {
      const payload = {
        fluide: intervention.fluide,
        weight: intervention.weight,
        packagingNumero: intervention.packagingNumero,
        clientName: intervention.clientName,
        modeleEquipement: intervention.modeleEquipement,
        numeroSerieEquipement: intervention.numeroSerieEquipement,
        attestation: intervention.attestation,
        lieuIntervention: intervention.lieuIntervention,
        bsffId: intervention.bsffId,
        destination: intervention.destination,
        typeIntervention: intervention.typeIntervention,
        controleDetails: intervention.controleDetails,
      };
      const res = await fetch("/api/cerfa/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error || "Échec régénération CERFA");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CERFA_15497-04_${intervention.bsffId ?? intervention.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setRegeneratingId(null);
    }
  }

  function handleDelete(id: string) {
    if (!confirm("Supprimer cette intervention de l'historique local ? Le BSFF chez TrackDéchets n'est pas affecté.")) return;
    deleteIntervention(id);
    setItems(listInterventions());
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#111] font-sans antialiased">
      <div className="max-w-4xl mx-auto px-6 md:px-8 py-12 md:py-20">
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
            <div className="flex items-center gap-5">
              <a href="/dashboard" className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors">
                TABLEAU DE BORD
              </a>
              <a href="/equipements" className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors">
                PARC ÉQUIPEMENTS
              </a>
              <a href="/syderep" className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors">
                DÉCLARATION SYDEREP
              </a>
              <a href="/profil" className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors">
                PROFIL
              </a>
              <a href="/bsff" className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors inline-flex items-center gap-2">
                NOUVELLE INTERVENTION
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </a>
            </div>
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl font-light leading-[1.05] tracking-tight">
            Historique des interventions
          </h1>
          <p className="mt-4 text-sm text-black/50 leading-relaxed max-w-md">
            Toutes les fiches CERFA 15497*04 et bordereaux BSFF générés via Vertxia. Re-téléchargez n&apos;importe quel document à tout moment.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
        >
          {[
            { label: "Total", value: stats.total },
            { label: "Ce mois", value: stats.thisMonth },
            { label: "Cette année", value: stats.thisYear },
            { label: "Avec BSFF", value: stats.withBsff },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-black/[0.08] bg-white px-4 py-4">
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40">{stat.label}</div>
              <div className="mt-1 text-3xl font-light text-[#111]">{stat.value}</div>
            </div>
          ))}
        </motion.div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`px-4 py-2 rounded-full text-xs font-mono tracking-widest uppercase transition-all ${
                filter === f.v
                  ? "bg-[#111] text-white"
                  : "bg-white text-black/60 border border-black/10 hover:border-black/30"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 px-5 py-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
            <div className="font-mono text-[10px] tracking-widest uppercase text-red-500 mb-1">Erreur</div>
            {error}
          </div>
        )}

        {/* Liste */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white/40 p-12 text-center">
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40 mb-3">
              {items.length === 0 ? "Aucune intervention" : "Aucun résultat"}
            </div>
            <p className="text-sm text-black/60 max-w-md mx-auto">
              {items.length === 0
                ? "Vos interventions F-Gas apparaîtront ici après la première génération de BSFF ou CERFA."
                : "Aucune intervention ne correspond au filtre sélectionné."}
            </p>
            {items.length === 0 && (
              <a
                href="/bsff"
                className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#111] text-white text-xs tracking-widest font-medium rounded-xl hover:bg-[#333] transition-colors"
              >
                CRÉER MA PREMIÈRE INTERVENTION
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((it, idx) => (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(idx * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl border border-black/[0.08] bg-white p-5 md:p-6"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40">
                        {fmtDate(it.createdAt)}
                      </span>
                      <span className={`font-mono text-[9px] tracking-widest px-2 py-0.5 rounded-full ${
                        it.bsffId
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-black/[0.04] text-black/60"
                      }`}>
                        {TYPE_LABELS[it.typeIntervention]}
                      </span>
                      {it.hasDetenteurSignature && (
                        <span className="font-mono text-[9px] tracking-widest px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          Signé client
                        </span>
                      )}
                    </div>
                    <div className="text-base text-[#111]">
                      {it.clientName ?? "Client non renseigné"}
                      <span className="text-black/40"> · </span>
                      <span className="text-black/70">{it.modeleEquipement ?? "Équipement"}</span>
                    </div>
                    <div className="font-mono text-xs text-black/55 flex flex-wrap gap-x-4 gap-y-1">
                      <span>{it.fluide.code}</span>
                      {it.weight > 0 && <span>{it.weight} kg</span>}
                      {it.packagingNumero && <span>Contenant : {it.packagingNumero}</span>}
                      {it.bsffId && <span className="break-all">BSFF : {it.bsffId}</span>}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 md:items-end shrink-0">
                    <button
                      onClick={() => handleRegenerateCerfa(it)}
                      disabled={regeneratingId === it.id}
                      className="px-4 py-2 bg-[#111] text-white text-xs tracking-widest font-medium rounded-lg hover:bg-[#333] transition-colors disabled:opacity-60 disabled:cursor-wait inline-flex items-center gap-2"
                    >
                      {regeneratingId === it.id ? (
                        <>
                          <span className="inline-block w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          <span>…</span>
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          CERFA
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDownloadRapport(it)}
                      disabled={rapportId === it.id}
                      className="px-4 py-2 bg-emerald-700 text-white text-xs tracking-widest font-medium rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-60 disabled:cursor-wait inline-flex items-center gap-2"
                      title="Rapport client final (entête entreprise + signature)"
                    >
                      {rapportId === it.id ? (
                        <>
                          <span className="inline-block w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          <span>…</span>
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                          </svg>
                          RAPPORT
                        </>
                      )}
                    </button>
                    {it.bsffId && (
                      <a
                        href={`/api/bsff/download/${it.bsffId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 border border-black/15 text-[#111] text-xs tracking-widest font-medium rounded-lg hover:bg-black/[0.03] transition-colors inline-flex items-center gap-2"
                        title="Télécharger le BSFF officiel TrackDéchets (lien regénéré à la volée)"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        BSFF
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(it.id)}
                      className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/35 hover:text-red-600 transition-colors px-2 py-1"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-16 pt-8 border-t border-black/[0.06] text-xs text-black/30 font-mono tracking-wide">
          ENVIRONNEMENT SANDBOX · Historique stocké localement sur votre appareil
        </div>
      </div>
    </div>
  );
}
