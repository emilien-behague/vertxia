"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

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
  | { type: "success"; bsffId: string; pdfUrl: string; signedAt: string }
  | { type: "error"; message: string };

export default function BsffPage() {
  const [fluide, setFluide] = useState(FLUIDES[0].code);
  const [weight, setWeight] = useState("2.5");
  const [packagingNumero, setPackagingNumero] = useState("B112026047");
  const [clientName, setClientName] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const selectedFluide = FLUIDES.find(f => f.code === fluide) ?? FLUIDES[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ type: "loading", step: "Création du bordereau…" });
    try {
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
      setStatus({
        type: "success",
        bsffId: data.bsffId,
        pdfUrl: data.pdfUrl,
        signedAt: data.signedAt,
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Erreur réseau",
      });
    }
  }

  function reset() {
    setStatus({ type: "idle" });
    setPackagingNumero(`B${Math.floor(Math.random() * 1_000_000_000)}`);
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
          <a href="/" className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors">
            ← VERTXIA
          </a>
          <h1 className="mt-6 text-4xl md:text-5xl font-light leading-[1.05] tracking-tight">
            Nouvelle intervention F-Gas
          </h1>
          <p className="mt-4 text-sm text-black/50 leading-relaxed max-w-md">
            Renseignez l&apos;intervention. Vertxia génère le BSFF officiel signé par le Ministère via TrackDéchets en quelques secondes.
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
              {/* Fluide */}
              <div>
                <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                  Fluide frigorigène récupéré
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

              {/* Quantité */}
              <div>
                <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                  Quantité récupérée (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-base text-[#111] focus:outline-none focus:border-black/40 focus:bg-[#fafaf8] transition-all disabled:opacity-50"
                />
              </div>

              {/* Numéro contenant */}
              <div>
                <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                  Numéro de bouteille / contenant
                </label>
                <input
                  type="text"
                  required
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

              {/* Client */}
              <div>
                <label className="block font-mono text-[10px] tracking-[0.2em] uppercase text-black/45 mb-2">
                  Client (optionnel — pour vos archives)
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  disabled={isLoading}
                  placeholder="Nom du client final"
                  className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white text-base text-[#111] focus:outline-none focus:border-black/40 focus:bg-[#fafaf8] transition-all disabled:opacity-50"
                />
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
                  <span>GÉNÉRER LE BSFF OFFICIEL</span>
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
              {/* Badge SIGNÉ */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-50 animate-ping" />
                  <span className="relative w-2 h-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-mono text-[11px] tracking-widest text-emerald-700">
                  BSFF SIGNÉ · OFFICIEL
                </span>
              </div>

              {/* Card résultat */}
              <div className="rounded-2xl border border-black/[0.08] bg-white p-8 space-y-5">
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
                    {new Date(status.signedAt).toLocaleString("fr-FR", {
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
              </div>

              {/* CTA téléchargement */}
              <a
                href={status.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-8 py-4 bg-[#111] text-white text-sm tracking-widest font-medium rounded-xl hover:bg-[#333] transition-colors inline-flex items-center justify-center gap-3"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                TÉLÉCHARGER LE PDF OFFICIEL
              </a>

              <button
                onClick={reset}
                className="w-full px-8 py-3 border border-black/10 text-black/70 text-sm tracking-widest rounded-xl hover:border-black/25 hover:bg-black/[0.03] transition-all"
              >
                NOUVELLE INTERVENTION
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-16 pt-8 border-t border-black/[0.06] text-xs text-black/30 font-mono tracking-wide">
          ENVIRONNEMENT SANDBOX · TrackDéchets bac à sable · Aucun BSFF de production
        </div>
      </div>
    </div>
  );
}
