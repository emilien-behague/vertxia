"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { listInterventions } from "@/lib/intervention-storage";
import {
  listEquipements,
  saveEquipement,
  updateEquipement,
  deleteEquipement,
  computeAllStatus,
  getEquipementStats,
  equipementsToCsv,
  type StoredEquipement,
  type EquipementWithStatus,
  type ControleStatut,
} from "@/lib/equipement";
import {
  qrSvgFor,
  equipementUrl,
  downloadQrPng,
  downloadStickerSheet,
} from "@/lib/qrcode-client";

// Liste des fluides courants en France pour la sélection rapide.
// GWP issus du Règlement (UE) 2024/573 annexe I.
const FLUIDES = [
  { code: "R-32", label: "R-32 (HFC)", gwp: 675 },
  { code: "R-410A", label: "R-410A (HFC)", gwp: 2088 },
  { code: "R-407C", label: "R-407C (HFC)", gwp: 1774 },
  { code: "R-134a", label: "R-134a (HFC)", gwp: 1430 },
  { code: "R-404A", label: "R-404A (HFC)", gwp: 3922 },
  { code: "R-22", label: "R-22 (HCFC — interdit)", gwp: 1810 },
  { code: "R-1234yf", label: "R-1234yf (HFO)", gwp: 4 },
  { code: "R-1234ze", label: "R-1234ze (HFO)", gwp: 7 },
  { code: "R-290", label: "R-290 propane", gwp: 3 },
  { code: "R-744", label: "R-744 CO₂", gwp: 1 },
];

const STATUT_CONFIG: Record<
  ControleStatut,
  { label: string; color: string; bg: string; ring: string; dot: string }
> = {
  en_retard: {
    label: "EN RETARD",
    color: "text-red-700",
    bg: "bg-red-50",
    ring: "border-red-300",
    dot: "bg-red-500",
  },
  a_relancer: {
    label: "RELANCE CLIENT",
    color: "text-orange-700",
    bg: "bg-orange-50",
    ring: "border-orange-300",
    dot: "bg-orange-500",
  },
  a_programmer: {
    label: "À PROGRAMMER",
    color: "text-amber-700",
    bg: "bg-amber-50",
    ring: "border-amber-300",
    dot: "bg-amber-500",
  },
  jamais: {
    label: "JAMAIS CONTRÔLÉ",
    color: "text-blue-700",
    bg: "bg-blue-50",
    ring: "border-blue-300",
    dot: "bg-blue-500",
  },
  ok: {
    label: "À JOUR",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    ring: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  exempt: {
    label: "EXEMPTÉ",
    color: "text-black/50",
    bg: "bg-black/[0.03]",
    ring: "border-black/10",
    dot: "bg-black/30",
  },
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtJours(jours: number | null): string {
  if (jours === null) return "";
  if (jours < 0) return `${Math.abs(jours)} j de retard`;
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return "demain";
  if (jours < 31) return `dans ${jours} j`;
  if (jours < 365) return `dans ${Math.round(jours / 30)} mois`;
  return `dans ${Math.round(jours / 365)} an${jours > 730 ? "s" : ""}`;
}

type FormState = {
  clientName: string;
  siteAdresse: string;
  modele: string;
  numeroSerie: string;
  fluideCode: string;
  chargeKg: string;
  detecteurFixe: boolean;
  dernierControle: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  clientName: "",
  siteAdresse: "",
  modele: "",
  numeroSerie: "",
  fluideCode: "R-32",
  chargeKg: "",
  detecteurFixe: false,
  dernierControle: "",
  notes: "",
};

export default function EquipementsPage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<EquipementWithStatus[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  function refresh() {
    const equipements = listEquipements();
    const interventions = listInterventions();
    setItems(computeAllStatus(equipements, interventions));
  }

  useEffect(() => {
    setMounted(true);
    refresh();
  }, []);

  const stats = useMemo(() => getEquipementStats(items), [items]);

  // QR Code modale — affiche le QR + URL + actions download.
  const [qrModalEq, setQrModalEq] = useState<EquipementWithStatus | null>(null);
  const [qrSvg, setQrSvg] = useState<string>("");
  const [stickersLoading, setStickersLoading] = useState(false);
  useEffect(() => {
    if (!qrModalEq) {
      setQrSvg("");
      return;
    }
    let cancelled = false;
    qrSvgFor(qrModalEq.id, 8).then((svg) => {
      if (!cancelled) setQrSvg(svg);
    });
    return () => {
      cancelled = true;
    };
  }, [qrModalEq]);

  async function handleDownloadAllStickers() {
    if (items.length === 0) return;
    setStickersLoading(true);
    try {
      await downloadStickerSheet(
        items.map((e) => ({ id: e.id, modele: e.modele, numeroSerie: e.numeroSerie }))
      );
    } catch (e) {
      console.error("[stickers]", e);
    } finally {
      setStickersLoading(false);
    }
  }

  function openNewForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(eq: EquipementWithStatus) {
    setEditingId(eq.id);
    setForm({
      clientName: eq.clientName,
      siteAdresse: eq.siteAdresse ?? "",
      modele: eq.modele,
      numeroSerie: eq.numeroSerie,
      fluideCode: eq.fluide.code,
      chargeKg: String(eq.chargeKg),
      detecteurFixe: eq.detecteurFixe,
      dernierControle: eq.dernierControleISO ? eq.dernierControleISO.slice(0, 10) : "",
      notes: eq.notes ?? "",
    });
    setShowForm(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const fluide = FLUIDES.find((f) => f.code === form.fluideCode);
    if (!fluide) return;
    const chargeKg = parseFloat(form.chargeKg);
    if (!Number.isFinite(chargeKg) || chargeKg <= 0) return;
    const payload: Omit<StoredEquipement, "id" | "createdAt"> = {
      clientName: form.clientName.trim(),
      siteAdresse: form.siteAdresse.trim() || undefined,
      modele: form.modele.trim(),
      numeroSerie: form.numeroSerie.trim(),
      fluide,
      chargeKg,
      detecteurFixe: form.detecteurFixe,
      dernierControleISO: form.dernierControle
        ? new Date(form.dernierControle).toISOString()
        : undefined,
      notes: form.notes.trim() || undefined,
    };
    if (editingId) {
      updateEquipement(editingId, payload);
    } else {
      saveEquipement(payload);
    }
    setShowForm(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
    refresh();
  }

  function handleDelete(id: string) {
    if (!confirm("Supprimer cet équipement et son historique ? Action irréversible.")) return;
    deleteEquipement(id);
    refresh();
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#111] font-sans antialiased">
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-12 md:py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10"
        >
          <div className="flex items-center justify-between">
            <a
              href="/"
              className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors"
            >
              ← VERTXIA
            </a>
            <div className="flex items-center gap-5">
              <a href="/dashboard" className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors">
                TABLEAU DE BORD
              </a>
              <a href="/historique" className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors">
                HISTORIQUE
              </a>
              <a href="/syderep" className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors">
                SYDEREP
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
            Parc équipements
          </h1>
          <p className="mt-4 text-sm text-black/50 leading-relaxed max-w-2xl">
            Tous les équipements F-Gas de vos clients, avec le planning automatique
            des contrôles d&apos;étanchéité réglementaires (Règlement UE 2024/573).
            Les contrôles enregistrés via Vertxia sont liés automatiquement au
            numéro de série.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8"
        >
          {[
            { label: "Total", value: stats.total, color: "text-[#111]" },
            { label: "En retard", value: stats.enRetard, color: "text-red-700" },
            { label: "À programmer", value: stats.aProgrammer, color: "text-amber-700" },
            { label: "À jour", value: stats.ok, color: "text-emerald-700" },
            { label: "Jamais", value: stats.jamais, color: "text-blue-700" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-black/[0.08] bg-white px-4 py-4">
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40">
                {s.label}
              </div>
              <div className={`mt-1 text-3xl font-light ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </motion.div>

        {/* Action button */}
        <div className="mb-8 flex items-center justify-between">
          <p className="text-xs text-black/40 max-w-md">
            Source réglementaire :{" "}
            <a
              href="https://eur-lex.europa.eu/eli/reg/2024/573/oj"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-black/70"
            >
              Règlement UE 2024/573 article 5
            </a>
            . Calcul de fréquence basé sur les seuils HFC en tCO₂eq.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (items.length === 0) return;
                const csv = equipementsToCsv(items);
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                const date = new Date().toISOString().slice(0, 10);
                a.href = url;
                a.download = `vertxia_parc_equipements_${date}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              disabled={items.length === 0}
              className="px-4 py-2.5 rounded-xl bg-white border border-black/10 text-xs font-mono tracking-widest uppercase hover:border-black/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
              title="Exporter le parc complet en CSV (compatible Excel FR)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              EXPORT CSV
            </button>
            <button
              onClick={handleDownloadAllStickers}
              disabled={items.length === 0 || stickersLoading}
              className="px-4 py-2.5 rounded-xl bg-white border border-black/10 text-xs font-mono tracking-widest uppercase hover:border-black/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
              title="PDF A4 — 8 stickers QR par feuille, à découper et coller sur les équipements"
            >
              {stickersLoading ? (
                <>
                  <span className="inline-block w-3 h-3 rounded-full border-2 border-black/20 border-t-black/60 animate-spin" />
                  GÉNÉRATION…
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                  </svg>
                  STICKERS QR PDF
                </>
              )}
            </button>
            <button
              onClick={openNewForm}
              className="px-5 py-2.5 rounded-xl bg-[#111] text-white text-xs font-mono tracking-widest uppercase hover:bg-[#333] transition-colors inline-flex items-center gap-2"
            >
              + AJOUTER UN ÉQUIPEMENT
            </button>
          </div>
        </div>

        {/* Liste */}
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white/40 p-12 text-center">
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40 mb-3">
              Aucun équipement enregistré
            </div>
            <p className="text-sm text-black/60 max-w-md mx-auto">
              Commencez par enregistrer les équipements F-Gas de vos clients pour
              générer automatiquement leur planning de contrôles d&apos;étanchéité.
            </p>
            <button
              onClick={openNewForm}
              className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#111] text-white text-xs tracking-widest font-medium rounded-xl hover:bg-[#333] transition-colors"
            >
              AJOUTER MON PREMIER ÉQUIPEMENT
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((eq, idx) => {
              const cfg = STATUT_CONFIG[eq.statut];
              return (
                <motion.div
                  key={eq.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: Math.min(idx * 0.03, 0.3),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={`rounded-2xl border ${cfg.ring} bg-white p-5 md:p-6 group`}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 font-mono text-[9px] tracking-widest px-2 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        {eq.detecteurFixe && (
                          <span className="font-mono text-[9px] tracking-widest px-2 py-1 rounded-full bg-purple-50 text-purple-700">
                            DÉTECTEUR FIXE
                          </span>
                        )}
                        {eq.isHFO && (
                          <span className="font-mono text-[9px] tracking-widest px-2 py-1 rounded-full bg-teal-50 text-teal-700">
                            HFO
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="text-lg font-medium">{eq.modele || "(modèle inconnu)"}</div>
                        <div className="text-sm text-black/60">
                          <strong className="text-black/80">{eq.clientName}</strong>
                          {eq.siteAdresse && <> · {eq.siteAdresse}</>}
                          {eq.numeroSerie && <> · S/N {eq.numeroSerie}</>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-black/60 pt-1">
                        <span>
                          <span className="text-black/40">Fluide</span>{" "}
                          <strong className="text-black/80">{eq.fluide.code}</strong>{" "}
                          <span className="text-black/40">(GWP {eq.fluide.gwp.toLocaleString("fr-FR")})</span>
                        </span>
                        <span>
                          <span className="text-black/40">Charge</span>{" "}
                          <strong className="text-black/80">{eq.chargeKg.toFixed(2).replace(".", ",")} kg</strong>
                        </span>
                        <span>
                          <span className="text-black/40">tCO₂eq</span>{" "}
                          <strong className="text-black/80">{eq.tCO2eq.toFixed(2).replace(".", ",")}</strong>
                        </span>
                        <span>
                          <span className="text-black/40">Fréquence</span>{" "}
                          <strong className="text-black/80">
                            {eq.frequenceMois !== null
                              ? `${eq.frequenceMois} mois`
                              : eq.isHFO
                              ? "HFO : seuils kg (V2)"
                              : "exempté <5 tCO₂eq"}
                          </strong>
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-black/60 pt-1">
                        <span>
                          <span className="text-black/40">Dernier contrôle</span>{" "}
                          <strong className="text-black/80">{fmtDate(eq.dernierControleISO)}</strong>
                        </span>
                        <span>
                          <span className="text-black/40">Prochain contrôle</span>{" "}
                          <strong className={cfg.color}>
                            {fmtDate(eq.prochainControleISO)}
                            {eq.joursAvantControle !== null && (
                              <span className="ml-1 font-normal">({fmtJours(eq.joursAvantControle)})</span>
                            )}
                          </strong>
                        </span>
                      </div>
                      {eq.notes && (
                        <div className="text-xs text-black/50 italic pt-1">{eq.notes}</div>
                      )}
                    </div>
                    <div className="flex md:flex-col gap-2 shrink-0">
                      <a
                        href={`/bsff?equipement=${eq.id}`}
                        className="px-3 py-1.5 rounded-lg bg-[#111] hover:bg-[#333] text-white text-xs font-mono tracking-widest uppercase transition-colors inline-flex items-center gap-1.5"
                        title="Démarrer une intervention sur cet équipement (formulaire pré-rempli)"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        Intervention
                      </a>
                      <button
                        onClick={() => setQrModalEq(eq)}
                        className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-mono tracking-widest uppercase transition-colors inline-flex items-center gap-1.5"
                        title="Voir / télécharger le QR Code de cet équipement"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                          <rect x="14" y="14" width="3" height="3" />
                          <path d="M21 14h-3v3M18 21h3v-3" />
                        </svg>
                        QR
                      </button>
                      <button
                        onClick={() => openEditForm(eq)}
                        className="px-3 py-1.5 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-xs font-mono tracking-widest uppercase transition-colors md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      >
                        Éditer
                      </button>
                      <button
                        onClick={() => handleDelete(eq.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-mono tracking-widest uppercase transition-colors md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      >
                        Suppr.
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Footer dispatch */}
        <div className="mt-12 text-center">
          <a
            href="/historique"
            className="font-mono text-xs tracking-[0.25em] text-black/40 hover:text-black/70 transition-colors"
          >
            ← Retour à l&apos;historique
          </a>
        </div>
      </div>

      {/* Modal formulaire */}
      {showForm &&
        createPortal(
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setShowForm(false)}
            >
              <motion.div
                initial={{ scale: 0.96, y: 8 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <form onSubmit={handleSave} className="p-6 md:p-8 space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-light">
                      {editingId ? "Éditer l'équipement" : "Ajouter un équipement"}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="text-black/40 hover:text-black/80 text-2xl leading-none"
                    >
                      ×
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Client *">
                      <input
                        required
                        value={form.clientName}
                        onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                        placeholder="Ex : Hôtel Le Provençal"
                        className="input-vertxia"
                      />
                    </Field>
                    <Field label="Site / Adresse">
                      <input
                        value={form.siteAdresse}
                        onChange={(e) => setForm({ ...form, siteAdresse: e.target.value })}
                        placeholder="Ex : 14 av. République, Toulon"
                        className="input-vertxia"
                      />
                    </Field>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Modèle équipement *">
                      <input
                        required
                        value={form.modele}
                        onChange={(e) => setForm({ ...form, modele: e.target.value })}
                        placeholder="Ex : Daikin FTXM35M"
                        className="input-vertxia"
                      />
                    </Field>
                    <Field label="N° de série *">
                      <input
                        required
                        value={form.numeroSerie}
                        onChange={(e) => setForm({ ...form, numeroSerie: e.target.value })}
                        placeholder="Ex : DA1234567"
                        className="input-vertxia"
                      />
                    </Field>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Fluide frigorigène *">
                      <select
                        required
                        value={form.fluideCode}
                        onChange={(e) => setForm({ ...form, fluideCode: e.target.value })}
                        className="input-vertxia"
                      >
                        {FLUIDES.map((f) => (
                          <option key={f.code} value={f.code}>
                            {f.label} — GWP {f.gwp.toLocaleString("fr-FR")}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Charge nominale (kg) *">
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.chargeKg}
                        onChange={(e) => setForm({ ...form, chargeKg: e.target.value })}
                        placeholder="Ex : 2.5"
                        className="input-vertxia"
                      />
                    </Field>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Dernier contrôle d'étanchéité">
                      <input
                        type="date"
                        value={form.dernierControle}
                        onChange={(e) => setForm({ ...form, dernierControle: e.target.value })}
                        className="input-vertxia"
                      />
                      <span className="text-[10px] text-black/40 mt-1 block">
                        Vide si jamais contrôlé. Les contrôles Vertxia liés au N° de série sont auto-détectés.
                      </span>
                    </Field>
                    <Field label="Détecteur fixe">
                      <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-black/10 bg-white cursor-pointer hover:border-black/30 transition-colors h-[42px]">
                        <input
                          type="checkbox"
                          checked={form.detecteurFixe}
                          onChange={(e) => setForm({ ...form, detecteurFixe: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Équipement avec détecteur fixe (× 2 fréquence)</span>
                      </label>
                    </Field>
                  </div>

                  <Field label="Notes">
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={2}
                      placeholder="Ex : split mural salle de réunion 1er étage"
                      className="input-vertxia"
                    />
                  </Field>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-black/[0.06]">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-5 py-2.5 rounded-xl bg-black/[0.04] hover:bg-black/[0.08] text-xs font-mono tracking-widest uppercase transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-[#111] text-white text-xs font-mono tracking-widest uppercase hover:bg-[#333] transition-colors"
                    >
                      {editingId ? "Enregistrer" : "Ajouter l'équipement"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}

      {/* QR Code modale — sticker à coller sur l'équipement */}
      {qrModalEq &&
        createPortal(
          <AnimatePresence>
            <motion.div
              key="qr-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setQrModalEq(null)}
            >
              <motion.div
                initial={{ scale: 0.96, y: 8, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.96, y: 8, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="bg-[#F5F4F0] rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8 space-y-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-black/40">
                      QR Code équipement
                    </div>
                    <h2 className="mt-1 text-xl font-light tracking-tight text-[#111] truncate">
                      {qrModalEq.modele}
                    </h2>
                    <div className="text-xs text-black/55 mt-0.5 truncate">
                      {qrModalEq.clientName} · S/N {qrModalEq.numeroSerie}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQrModalEq(null)}
                    className="text-black/40 hover:text-black/80 text-2xl leading-none shrink-0 ml-3"
                    aria-label="Fermer"
                  >
                    ×
                  </button>
                </div>

                {/* QR Code grand */}
                <div className="bg-white rounded-2xl p-6 ring-1 ring-black/[0.06] flex items-center justify-center">
                  {qrSvg ? (
                    <div
                      className="w-[240px] h-[240px] [&>svg]:w-full [&>svg]:h-full"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  ) : (
                    <div className="w-[240px] h-[240px] flex items-center justify-center">
                      <span className="inline-block w-5 h-5 rounded-full border-2 border-black/15 border-t-black/60 animate-spin" />
                    </div>
                  )}
                </div>

                {/* URL */}
                <div className="rounded-xl bg-white ring-1 ring-black/[0.06] px-4 py-3">
                  <div className="font-mono text-[9px] tracking-[0.25em] uppercase text-black/40 mb-1">
                    URL encodée
                  </div>
                  <a
                    href={equipementUrl(qrModalEq.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-[#111] break-all hover:text-amber-700 transition-colors"
                  >
                    {equipementUrl(qrModalEq.id)}
                  </a>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadQrPng(
                        qrModalEq.id,
                        `vertxia_qr_${qrModalEq.numeroSerie || qrModalEq.id.slice(0, 8)}`
                      )
                    }
                    className="px-4 py-3 rounded-xl bg-[#111] text-white text-xs font-mono tracking-widest uppercase hover:bg-[#333] active:bg-black/90 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    PNG
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(equipementUrl(qrModalEq.id));
                      } catch (e) {
                        console.warn("[clipboard]", e);
                      }
                    }}
                    className="px-4 py-3 rounded-xl bg-white ring-1 ring-black/10 text-[#111] text-xs font-mono tracking-widest uppercase hover:bg-black/[0.03] transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copier URL
                  </button>
                </div>

                <a
                  href={equipementUrl(qrModalEq.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full px-4 py-3 rounded-xl bg-white ring-1 border border-dashed border-black/20 text-[#111] text-xs font-mono tracking-widest uppercase text-center hover:border-black/40 hover:bg-black/[0.02] transition-all inline-flex items-center justify-center gap-2"
                >
                  Tester le scan dans un nouvel onglet
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17 17 7M7 7h10v10" />
                  </svg>
                </a>

                <p className="text-[11px] text-black/40 leading-relaxed text-center pt-1">
                  Collez ce QR Code sur l&apos;équipement. Quand un technicien le scanne,
                  il accède directement à la fiche pour démarrer une intervention.
                </p>
              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}

      <style jsx global>{`
        .input-vertxia {
          width: 100%;
          padding: 0.625rem 0.875rem;
          background: white;
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: #111;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input-vertxia:focus {
          outline: none;
          border-color: rgba(0, 0, 0, 0.5);
          box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.05);
        }
        .input-vertxia::placeholder {
          color: rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/40 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
