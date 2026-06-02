"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  listInterventions,
  getStats,
  type StoredIntervention,
} from "@/lib/intervention-storage";
import {
  listEquipements,
  computeAllStatus,
  getEquipementStats,
  type EquipementWithStatus,
} from "@/lib/equipement";
import { aggregateForYear, loadManualInputs } from "@/lib/syderep";
import { loadProfil, isProfilComplete, type Profil } from "@/lib/profil";
import type { TypeIntervention } from "@/lib/cerfa";

const TYPE_LABELS: Record<TypeIntervention, string> = {
  recuperation: "Récupération",
  demantelement: "Démantèlement",
  controle_periodique: "Contrôle périodique",
  controle_non_periodique: "Contrôle non périodique",
  mise_service: "Mise en service",
  maintenance: "Maintenance",
  assemblage: "Assemblage",
  modification: "Modification",
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtJours(jours: number | null): string {
  if (jours === null) return "";
  if (jours < 0) return `${Math.abs(jours)} j en retard`;
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return "demain";
  if (jours < 31) return `dans ${jours} j`;
  if (jours < 365) return `dans ${Math.round(jours / 30)} mois`;
  return `dans ${Math.round(jours / 365)} an${jours > 730 ? "s" : ""}`;
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [interventions, setInterventions] = useState<StoredIntervention[]>([]);
  const [equipements, setEquipements] = useState<EquipementWithStatus[]>([]);
  const [profil, setProfil] = useState<Profil | null>(null);

  useEffect(() => {
    setMounted(true);
    const ints = listInterventions();
    setInterventions(ints);
    setEquipements(computeAllStatus(listEquipements(), ints));
    setProfil(loadProfil());
  }, []);

  const profilComplete = profil ? isProfilComplete(profil) : false;

  const interventionsStats = useMemo(() => getStats(interventions), [interventions]);
  const equipementsStats = useMemo(() => getEquipementStats(equipements), [equipements]);

  const currentYear = new Date().getFullYear();
  const syderepDecl = useMemo(
    () => aggregateForYear(interventions, currentYear, loadManualInputs(currentYear)),
    [interventions, currentYear]
  );

  const controlesEnRetard = equipements.filter((e) => e.statut === "en_retard");
  const controlesAProgrammer = equipements
    .filter((e) => e.statut === "a_programmer" || e.statut === "jamais" || e.statut === "en_retard")
    .slice(0, 5);
  const interventionsRecentes = interventions.slice(0, 5);

  const isEmpty = interventions.length === 0 && equipements.length === 0;

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#F5F4F0] text-[#111] font-sans antialiased">
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-10 md:py-14">
        {/* Header nav */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-between mb-10"
        >
          <a
            href="/"
            className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors"
          >
            ← VERTXIA
          </a>
          <div className="flex items-center gap-5">
            <a href="/equipements" className="font-mono text-xs tracking-[0.25em] text-black/50 hover:text-black/80 transition-colors">
              PARC
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
          </div>
        </motion.div>

        {/* Hero greeting + main CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10 grid md:grid-cols-[1fr_auto] gap-6 items-end"
        >
          <div>
            <h1 className="text-4xl md:text-5xl font-light leading-[1.05] tracking-tight">
              Tableau de bord
            </h1>
            <p className="mt-3 text-sm text-black/50 leading-relaxed max-w-xl">
              {isEmpty
                ? "Commencez par enregistrer une intervention ou un équipement. Vertxia s'occupe du reste."
                : controlesEnRetard.length > 0
                ? `${controlesEnRetard.length} contrôle${controlesEnRetard.length > 1 ? "s" : ""} d'étanchéité en retard — à traiter en priorité.`
                : controlesAProgrammer.length > 0
                ? `${controlesAProgrammer.length} contrôle${controlesAProgrammer.length > 1 ? "s" : ""} d'étanchéité à programmer prochainement.`
                : "Tout est à jour. Beau boulot."}
            </p>
          </div>
          <a
            href="/bsff"
            className="inline-flex items-center gap-3 px-6 py-3.5 bg-[#111] text-white text-xs font-mono tracking-widest uppercase rounded-xl hover:bg-[#333] transition-colors group whitespace-nowrap self-start md:self-end"
          >
            <span>+ Nouvelle intervention</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </a>
        </motion.div>

        {/* Profil incomplet — nudge */}
        {!profilComplete && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 flex items-start justify-between gap-4"
          >
            <div>
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-amber-800 mb-0.5">
                Profil entreprise incomplet
              </div>
              <div className="text-sm text-amber-900">
                Renseignez votre raison sociale, SIRET, adresse et attestation F-Gas pour que vos PDF affichent votre identité au lieu de rester génériques.
              </div>
            </div>
            <a
              href="/profil"
              className="shrink-0 px-4 py-2 rounded-lg bg-amber-900 hover:bg-amber-800 text-amber-50 text-xs font-mono tracking-widest uppercase transition-colors"
            >
              COMPLÉTER
            </a>
          </motion.div>
        )}

        {/* Alerte critique en retard */}
        {controlesEnRetard.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="mb-6 rounded-xl border border-red-300 bg-red-50/80 p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-red-700 mb-1">
                  ⚠ Action urgente
                </div>
                <div className="text-sm text-red-900">
                  <strong>{controlesEnRetard.length} contrôle{controlesEnRetard.length > 1 ? "s" : ""} d&apos;étanchéité en retard</strong>{" "}
                  sur vos équipements. Risque d&apos;amende DREAL en cas de contrôle.
                </div>
              </div>
              <a
                href="/equipements"
                className="shrink-0 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-mono tracking-widest uppercase transition-colors"
              >
                VOIR LE PARC
              </a>
            </div>
          </motion.div>
        )}

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-10"
        >
          <StatTile
            label="Interventions"
            value={interventionsStats.total}
            sub={`${interventionsStats.thisMonth} ce mois`}
            accent="text-[#111]"
          />
          <StatTile
            label="Avec BSFF"
            value={interventionsStats.withBsff}
            sub="récup signée"
            accent="text-emerald-700"
          />
          <StatTile
            label="Équipements"
            value={equipementsStats.total}
            sub="dans le parc"
            accent="text-[#111]"
          />
          <StatTile
            label="En retard"
            value={equipementsStats.enRetard}
            sub="contrôles"
            accent={equipementsStats.enRetard > 0 ? "text-red-700" : "text-black/30"}
          />
          <StatTile
            label="À programmer"
            value={equipementsStats.aProgrammer}
            sub="< 90 jours"
            accent={equipementsStats.aProgrammer > 0 ? "text-amber-700" : "text-black/30"}
          />
          <StatTile
            label={`SYDEREP ${currentYear}`}
            value={syderepDecl.totalRecupereKg.toFixed(1).replace(".", ",")}
            suffix="kg"
            sub="récupéré"
            accent="text-[#111]"
          />
        </motion.div>

        {/* 3 sections en grille */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SectionCard
            title="Contrôles à programmer"
            href="/equipements"
            cta="Voir le parc"
            empty={controlesAProgrammer.length === 0}
            emptyMsg="Aucun contrôle imminent. Tout est à jour."
          >
            <ul className="divide-y divide-black/[0.06]">
              {controlesAProgrammer.map((eq) => {
                const isRetard = eq.statut === "en_retard";
                const isJamais = eq.statut === "jamais";
                return (
                  <li key={eq.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{eq.clientName}</div>
                        <div className="text-xs text-black/50 truncate mt-0.5">
                          {eq.modele} · {eq.fluide.code} · {eq.chargeKg.toFixed(1).replace(".", ",")} kg
                        </div>
                      </div>
                      <div
                        className={`text-xs font-mono tracking-wider whitespace-nowrap ${
                          isRetard ? "text-red-700 font-medium" : isJamais ? "text-blue-700" : "text-amber-700"
                        }`}
                      >
                        {isJamais ? "Jamais" : fmtJours(eq.joursAvantControle)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          <SectionCard
            title="Interventions récentes"
            href="/historique"
            cta="Voir l'historique"
            empty={interventionsRecentes.length === 0}
            emptyMsg="Aucune intervention enregistrée."
          >
            <ul className="divide-y divide-black/[0.06]">
              {interventionsRecentes.map((it) => (
                <li key={it.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {it.clientName || "(client inconnu)"}
                      </div>
                      <div className="text-xs text-black/50 truncate mt-0.5">
                        {TYPE_LABELS[it.typeIntervention]} · {it.fluide.code}
                        {it.weight > 0 && ` · ${it.weight.toFixed(2).replace(".", ",")} kg`}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="text-xs font-mono tracking-wider text-black/40 whitespace-nowrap">
                        {fmtDateTime(it.createdAt)}
                      </div>
                      {it.bsffId && (
                        <span className="font-mono text-[9px] tracking-widest px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                          BSFF
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title={`SYDEREP ${currentYear}`}
            href="/syderep"
            cta="Préparer"
            empty={syderepDecl.rows.length === 0}
            emptyMsg={`Pas encore d'interventions pour ${currentYear}.`}
          >
            <div className="space-y-2">
              <StatRow label="Interventions" value={syderepDecl.nbInterventions} />
              <StatRow
                label="Chargé en équipement"
                value={`${syderepDecl.totalChargeKg.toFixed(2).replace(".", ",")} kg`}
              />
              <StatRow
                label="Récupéré"
                value={`${syderepDecl.totalRecupereKg.toFixed(2).replace(".", ",")} kg`}
              />
              <StatRow
                label="Cédé centre"
                value={`${syderepDecl.totalCedeKg.toFixed(2).replace(".", ",")} kg`}
              />
              <StatRow
                label="Eq. CO2"
                value={
                  syderepDecl.totalCO2eq < 1
                    ? `${(syderepDecl.totalCO2eq * 1000).toFixed(0)} kg`
                    : `${syderepDecl.totalCO2eq.toFixed(2).replace(".", ",")} t`
                }
              />
              <div className="pt-3 mt-1 border-t border-black/[0.06]">
                <div className="text-[10px] font-mono tracking-widest uppercase text-black/40 mb-1">
                  Période officielle
                </div>
                <div className="text-xs text-black/60">
                  1er fév → 31 mars {currentYear + 1}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Quick actions footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <QuickAction href="/bsff" label="Nouvelle intervention" desc="Récup, contrôle, mise en service…" primary />
          <QuickAction href="/equipements" label="Parc équipements" desc="Planning des contrôles" />
          <QuickAction href="/historique" label="Historique" desc="Re-télécharger un document" />
          <QuickAction href="/syderep" label="Préparation SYDEREP" desc="Bilan annuel F-Gas" />
        </motion.div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  suffix,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  suffix?: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-black/[0.08] bg-white px-4 py-4">
      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40">{label}</div>
      <div className={`mt-1 text-3xl font-light ${accent} flex items-baseline gap-1`}>
        {value}
        {suffix && <span className="text-sm font-normal text-black/40">{suffix}</span>}
      </div>
      {sub && <div className="text-[10px] text-black/40 mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionCard({
  title,
  href,
  cta,
  empty,
  emptyMsg,
  children,
}: {
  title: string;
  href: string;
  cta: string;
  empty: boolean;
  emptyMsg: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="rounded-2xl border border-black/[0.08] bg-white p-5 md:p-6 flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium tracking-tight">{title}</h3>
        <a
          href={href}
          className="font-mono text-[10px] tracking-[0.2em] uppercase text-black/40 hover:text-black/70 transition-colors"
        >
          {cta} →
        </a>
      </div>
      <div className="flex-1">
        {empty ? (
          <div className="text-xs text-black/40 text-center py-6">{emptyMsg}</div>
        ) : (
          children
        )}
      </div>
    </motion.div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className="text-xs text-black/50">{label}</span>
      <span className="font-mono text-sm font-medium">{value}</span>
    </div>
  );
}

function QuickAction({
  href,
  label,
  desc,
  primary,
}: {
  href: string;
  label: string;
  desc: string;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      className={`rounded-xl p-4 transition-all hover:scale-[1.02] ${
        primary
          ? "bg-[#111] text-white hover:bg-[#333]"
          : "bg-white border border-black/[0.08] hover:border-black/30"
      }`}
    >
      <div className={`text-sm font-medium ${primary ? "" : "text-[#111]"}`}>{label}</div>
      <div className={`text-[10px] mt-1 ${primary ? "text-white/60" : "text-black/40"}`}>{desc}</div>
    </a>
  );
}
