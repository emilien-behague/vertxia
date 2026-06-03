"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection, InsetRow } from "@/components/mobile/inset-list";
import {
  listEquipements,
  computeAllStatus,
  getEquipementStats,
  type EquipementWithStatus,
} from "@/lib/equipement";
import { listInterventions, type StoredIntervention } from "@/lib/intervention-storage";
import { loadProfil, type Profil } from "@/lib/profil";
import { useUser } from "@/lib/supabase/use-user";

// Dashboard mobile — l'écran d'accueil de l'app Vertxia.
// 3 sections : KPIs grid 2x2 / Équipements urgents / Dernières interventions.

function fmtJours(j: number | null): string {
  if (j === null) return "";
  if (j < 0) return `${Math.abs(j)} j de retard`;
  if (j === 0) return "aujourd'hui";
  if (j === 1) return "demain";
  if (j < 31) return `dans ${j} j`;
  if (j < 365) return `dans ${Math.round(j / 30)} mois`;
  return `dans ${Math.round(j / 365)} an`;
}

const TYPE_LABELS: Record<string, string> = {
  recuperation: "Récupération",
  demantelement: "Démantèlement",
  controle_periodique: "Contrôle étanchéité",
  controle_non_periodique: "Contrôle (suite fuite)",
  mise_service: "Mise en service",
  maintenance: "Maintenance",
};

export default function MobileHomePage() {
  const [equipements, setEquipements] = useState<EquipementWithStatus[]>([]);
  const [interventions, setInterventions] = useState<StoredIntervention[]>([]);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ints = listInterventions();
    setInterventions(ints);
    setEquipements(computeAllStatus(listEquipements(), ints));
    setProfil(loadProfil());
    setReady(true);
  }, []);

  const stats = useMemo(() => getEquipementStats(equipements), [equipements]);
  const urgents = useMemo(
    () =>
      equipements
        .filter(
          (e) =>
            e.statut === "en_retard" ||
            e.statut === "a_relancer" ||
            e.statut === "a_programmer" ||
            e.statut === "jamais"
        )
        .slice(0, 5),
    [equipements]
  );
  const relances = useMemo(
    () => equipements.filter((e) => e.statut === "a_relancer"),
    [equipements]
  );
  const recentes = useMemo(() => interventions.slice(0, 3), [interventions]);

  const isEmpty = ready && equipements.length === 0 && interventions.length === 0;
  const { user, signOut, configured } = useUser();

  return (
    <>
      <MobileHeader title="Vertxia" largeTitle />

      {/* Bandeau compte connecté — affiché si Supabase configuré + user présent
          (mode hybride : si Supabase pas configuré, pas de bandeau du tout). */}
      {configured && user && (
        <div className="px-4 mt-2 mb-2">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="inline-flex w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center text-[12px] font-semibold shrink-0">
                {(user.email?.[0] ?? "?").toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="text-[10px] tracking-widest uppercase font-mono text-emerald-700">
                  Compte connecté
                </div>
                <div className="text-[12px] text-emerald-900 truncate">{user.email}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="text-[11px] text-emerald-700 underline shrink-0"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              Déconnexion
            </button>
          </div>
        </div>
      )}

      {isEmpty && <EmptyState />}

      {!isEmpty && (
        <>
          {/* Stats grid 2x2 */}
          <section className="px-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Équipements" value={stats.total} sub="au parc" color="text-[#111]" />
              <StatCard label="En retard" value={stats.enRetard} sub="à traiter" color="text-red-600" pulse={stats.enRetard > 0} />
              <StatCard label="À relancer" value={stats.aRelancer} sub="≤ 30 j" color="text-orange-600" pulse={stats.aRelancer > 0} />
              <StatCard
                label="Interventions"
                value={interventions.length}
                sub={`${interventions.filter((i) => i.bsffId).length} avec BSFF`}
                color="text-emerald-600"
              />
            </div>
          </section>

          {/* Relances client à envoyer ce mois-ci */}
          {relances.length > 0 && (
            <InsetListSection
              title={`🔔 Relances client · ${relances.length}`}
              footer="Échéance contrôle dans moins de 30 jours. Tap pour envoyer l'email de rappel pré-rempli."
            >
              {relances.slice(0, 4).map((eq) => (
                <InsetRow
                  key={eq.id}
                  href={`/eq/${eq.id}`}
                  leading={<StatusDot statut={eq.statut} />}
                  label={eq.clientName}
                  sublabel={`${eq.modele} · ${fmtJours(eq.joursAvantControle)}`}
                  trailing={
                    eq.clientEmail ? (
                      <span className="text-[10px] font-medium text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded uppercase tracking-wide">
                        Email prêt
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-black/40 bg-black/[0.04] px-1.5 py-0.5 rounded uppercase tracking-wide">
                        Manque email
                      </span>
                    )
                  }
                  showChevron
                />
              ))}
            </InsetListSection>
          )}

          {/* Équipements urgents */}
          {urgents.length > 0 && (
            <InsetListSection
              title="À traiter en priorité"
              footer={`${stats.enRetard + stats.aRelancer + stats.aProgrammer + stats.jamais} équipements nécessitent un contrôle d'étanchéité.`}
            >
              {urgents.map((eq) => (
                <InsetRow
                  key={eq.id}
                  href={`/eq/${eq.id}`}
                  leading={<StatusDot statut={eq.statut} />}
                  label={eq.modele}
                  sublabel={`${eq.clientName} · ${fmtJours(eq.joursAvantControle)}`}
                  showChevron
                />
              ))}
            </InsetListSection>
          )}

          {/* Dernières interventions */}
          {recentes.length > 0 && (
            <InsetListSection title="Activité récente">
              {recentes.map((i) => (
                <InsetRow
                  key={i.id}
                  href="/m/historique"
                  leading={<InterventionIcon type={i.typeIntervention} />}
                  label={TYPE_LABELS[i.typeIntervention] || i.typeIntervention}
                  sublabel={`${i.clientName ?? "Client inconnu"} · ${new Date(i.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}
                  trailing={
                    i.bsffId ? (
                      <span className="text-[10px] font-mono tracking-widest text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        BSFF
                      </span>
                    ) : undefined
                  }
                  showChevron
                />
              ))}
            </InsetListSection>
          )}

          {/* Quick actions */}
          <InsetListSection title="Actions rapides">
            <InsetRow
              href="/m/scan"
              leading={<ActionIcon name="qr" />}
              label="Scanner QR équipement"
              sublabel="Caméra → fiche en 1 sec"
              showChevron
            />
            <InsetRow href="/m/intervention" leading={<ActionIcon name="plus" />} label="Nouvelle intervention" showChevron />
            <InsetRow
              href="/m/equipements"
              leading={<ActionIcon name="list" />}
              label="Voir tout le parc"
              trailingValue={`${stats.total}`}
              showChevron
            />
            <InsetRow
              href="/m/bouteilles"
              leading={<ActionIcon name="list" />}
              label="Mes bouteilles"
              sublabel="Stock recharge + récupération"
              showChevron
            />
            <InsetRow
              href="/m/registre"
              leading={<ActionIcon name="doc" />}
              label="Registre fluides (PDF)"
              sublabel="Traçabilité attestation F-Gas"
              showChevron
            />
            <InsetRow
              href="/m/syderep"
              leading={<ActionIcon name="doc" />}
              label="Déclaration SYDEREP"
              sublabel="Bilan annuel HFC"
              showChevron
            />
          </InsetListSection>

          {/* Profil section */}
          {!profil?.raisonSociale && (
            <InsetListSection footer="Renseignez votre raison sociale et numéro d'attestation pour signer les CERFA automatiquement.">
              <InsetRow
                href="/m/profil"
                leading={<ActionIcon name="warning" />}
                label="Compléter mon profil"
                sublabel="Profil entreprise incomplet"
                showChevron
              />
            </InsetListSection>
          )}
        </>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
  pulse,
}: {
  label: string;
  value: number;
  sub: string;
  color: string;
  pulse?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-black/[0.04]">
      <div className="flex items-center gap-1.5">
        <div className="text-[11px] font-medium text-black/45 uppercase tracking-wide">{label}</div>
        {pulse && (
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-red-500 opacity-50 animate-ping" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-red-500" />
          </span>
        )}
      </div>
      <div className={`mt-1 text-3xl font-semibold tracking-tight ${color}`}>{value}</div>
      <div className="text-[11px] text-black/40 mt-0.5">{sub}</div>
    </div>
  );
}

function StatusDot({ statut }: { statut: EquipementWithStatus["statut"] }) {
  const colors: Record<EquipementWithStatus["statut"], string> = {
    en_retard: "bg-red-500",
    a_relancer: "bg-orange-500",
    a_programmer: "bg-amber-500",
    jamais: "bg-blue-500",
    ok: "bg-emerald-500",
    exempt: "bg-black/25",
  };
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/[0.04]">
      <span className={`w-2.5 h-2.5 rounded-full ${colors[statut]}`} />
    </span>
  );
}

function InterventionIcon({ type }: { type: string }) {
  const isBsff = type === "recuperation" || type === "demantelement";
  return (
    <span
      className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
        isBsff ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {isBsff ? (
          <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 7 12 12 15 14" />
          </>
        )}
      </svg>
    </span>
  );
}

function ActionIcon({ name }: { name: "plus" | "list" | "doc" | "warning" | "qr" }) {
  const colors = {
    plus: "bg-[#111] text-white",
    list: "bg-blue-50 text-blue-700",
    doc: "bg-purple-50 text-purple-700",
    warning: "bg-amber-50 text-amber-700",
    qr: "bg-[#A16207]/10 text-[#A16207]",
  };
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    list: (
      <>
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <circle cx="4" cy="6" r="1" />
        <circle cx="4" cy="12" r="1" />
        <circle cx="4" cy="18" r="1" />
      </>
    ),
    doc: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </>
    ),
    warning: (
      <>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </>
    ),
    qr: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <path d="M14 14h3v3h-3zM18 18h3v3h-3z" />
      </>
    ),
  };
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${colors[name]}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {paths[name]}
      </svg>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="px-5 py-10">
      <div className="rounded-3xl bg-white ring-1 ring-black/[0.04] p-7 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#A16207]/10 mb-4">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#A16207" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="32" y1="32" x2="32" y2="7" />
            <line x1="32" y1="32" x2="55" y2="45.5" />
            <line x1="32" y1="32" x2="9" y2="45.5" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Bienvenue sur Vertxia</h2>
        <p className="mt-2 text-sm text-black/55 leading-relaxed">
          Commencez par ajouter vos premiers équipements ou lancez votre première intervention.
        </p>
        <div className="mt-5 space-y-2">
          <Link
            href="/m/equipements"
            className="block w-full px-5 py-3.5 bg-[#111] text-white text-sm font-medium rounded-xl active:bg-black/90 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            + Ajouter un équipement
          </Link>
          <Link
            href="/m/intervention/nouvelle"
            className="block w-full px-5 py-3 ring-1 ring-black/10 text-black/70 text-sm font-medium rounded-xl text-center"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            Nouvelle intervention
          </Link>
        </div>
      </div>
    </div>
  );
}
