"use client";

import { useEffect, useMemo, useState } from "react";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { InsetListSection, InsetRow } from "@/components/mobile/inset-list";
import Link from "next/link";
import {
  listEquipements,
  computeAllStatus,
  getEquipementStats,
  getInfractions,
  type EquipementWithStatus,
} from "@/lib/equipement";
import { listInterventions, type StoredIntervention } from "@/lib/intervention-storage";
import { loadProfil, type Profil } from "@/lib/profil";
import { hydrateFromSupabaseIfNeeded } from "@/lib/hydrate-on-login";

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
  recuperation: "🧊 Récupération de gaz",
  demantelement: "🔧 Démantèlement",
  controle_periodique: "🔍 Contrôle anti-fuite",
  controle_non_periodique: "🔎 Contrôle après réparation",
  mise_service: "⚡ Mise en route",
  maintenance: "🛠️ Entretien",
  assemblage: "🔩 Assemblage",
  modification: "✏️ Modification",
};

export default function MobileHomePage() {
  const [equipements, setEquipements] = useState<EquipementWithStatus[]>([]);
  const [interventions, setInterventions] = useState<StoredIntervention[]>([]);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [hydrationToast, setHydrationToast] = useState<string | null>(null);

  // Charge depuis localStorage immediatement (UX snappy : pas d'ecran blanc)
  useEffect(() => {
    const ints = listInterventions();
    setInterventions(ints);
    setEquipements(computeAllStatus(listEquipements(), ints));
    setProfil(loadProfil());
  }, []);

  // Hydrate depuis Supabase au mount (1ere fois session) si user connecte.
  // Recharge l'UI si des donnees ont ete ajoutees (nouveau device).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await hydrateFromSupabaseIfNeeded();
      if (cancelled || !result.attempted || !result.ok) return;
      const added = result.equipementsAdded + result.interventionsAdded;
      if (added > 0) {
        // Recharge l'UI avec les nouvelles donnees
        const ints = listInterventions();
        setInterventions(ints);
        setEquipements(computeAllStatus(listEquipements(), ints));
        // Toast discret
        const parts: string[] = [];
        if (result.equipementsAdded > 0) {
          parts.push(`${result.equipementsAdded} équipement${result.equipementsAdded > 1 ? "s" : ""}`);
        }
        if (result.interventionsAdded > 0) {
          parts.push(`${result.interventionsAdded} intervention${result.interventionsAdded > 1 ? "s" : ""}`);
        }
        setHydrationToast(`✓ Synchronisé : ${parts.join(" + ")} récupéré${added > 1 ? "s" : ""}`);
        setTimeout(() => setHydrationToast(null), 4000);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => getEquipementStats(equipements), [equipements]);
  const infractions = useMemo(() => getInfractions(equipements), [equipements]);
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

  // Hero card "Action du jour" — détermine l'unique chose la plus urgente
  // que l'artisan doit faire MAINTENANT, en mode ludique style Pokémon Go.
  // Logique de priorité descendante : retard > relance > jamais contrôlé >
  // équipement à créer > tout va bien.
  const actionDuJour = useMemo<{
    emoji: string;
    couleur: "rouge" | "orange" | "bleu" | "vert";
    titre: string;
    sous: string;
    bouton: string;
    href: string;
  }>(() => {
    if (stats.enRetard > 0) {
      return {
        emoji: "🚨",
        couleur: "rouge",
        titre: `${stats.enRetard} contrôle${stats.enRetard > 1 ? "s" : ""} en retard !`,
        sous: "Il faut agir vite — risque amende DREAL",
        bouton: "Voir les retards",
        href: "/m/equipements?filter=en_retard",
      };
    }
    if (stats.aRelancer > 0) {
      return {
        emoji: "📧",
        couleur: "orange",
        titre: `${stats.aRelancer} client${stats.aRelancer > 1 ? "s" : ""} à relancer`,
        sous: "Contrôle dans moins de 30 jours — envoie le rappel",
        bouton: "Envoyer les rappels",
        href: "/m/equipements?filter=a_relancer",
      };
    }
    if (stats.jamais > 0) {
      return {
        emoji: "🆕",
        couleur: "bleu",
        titre: `${stats.jamais} équipement${stats.jamais > 1 ? "s" : ""} jamais contrôlé${stats.jamais > 1 ? "s" : ""}`,
        sous: "Démarre le suivi périodique sur ces machines",
        bouton: "Faire un contrôle",
        href: "/m/equipements",
      };
    }
    if (stats.total === 0) {
      return {
        emoji: "👋",
        couleur: "bleu",
        titre: "Ajoute ton premier équipement",
        sous: "Scanne une plaque signalétique en 3 secondes",
        bouton: "Scanner une plaque",
        href: "/m/equipements/nouveau",
      };
    }
    return {
      emoji: "✅",
      couleur: "vert",
      titre: "Tout est à jour !",
      sous: "Profite de ta journée — rien à faire en urgence",
      bouton: "Voir mon parc",
      href: "/m/equipements",
    };
  }, [stats]);

  const heroStyles = {
    rouge: {
      bg: "bg-gradient-to-br from-red-500 to-red-600",
      text: "text-white",
      sub: "text-red-50/90",
      btn: "bg-white text-red-700 active:bg-red-50",
    },
    orange: {
      bg: "bg-gradient-to-br from-orange-500 to-amber-500",
      text: "text-white",
      sub: "text-orange-50/90",
      btn: "bg-white text-orange-700 active:bg-orange-50",
    },
    bleu: {
      bg: "bg-gradient-to-br from-blue-500 to-indigo-600",
      text: "text-white",
      sub: "text-blue-50/90",
      btn: "bg-white text-blue-700 active:bg-blue-50",
    },
    vert: {
      bg: "bg-gradient-to-br from-emerald-500 to-teal-600",
      text: "text-white",
      sub: "text-emerald-50/90",
      btn: "bg-white text-emerald-700 active:bg-emerald-50",
    },
  }[actionDuJour.couleur];

  // Le dashboard est rendu DANS TOUS LES CAS — même parc vide / zéro
  // intervention. On veut que la page d'accueil de l'app expose toujours
  // les raccourcis et actions rapides, pas un EmptyState "Bienvenue" qui
  // masquerait les boutons Scanner QR / Nouvelle intervention / Mon parc.
  // Quand vide, les stats montrent 0 et seules les sections "Actions rapides"
  // + "Compléter mon profil" s'affichent.

  return (
    <>
      <MobileHeader title="Vertxia" largeTitle />

      {/* Bandeau alerte infractions réglementaires — affiché en haut si > 0
          pour activer la peur réglementaire (UE 2024/573) et inciter à
          ouvrir la page /m/infractions où l'enjeu est détaillé. */}
      {infractions.length > 0 && (
        <Link
          href="/m/infractions"
          className="block mx-4 mt-2 mb-3 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 active:bg-red-100/70 transition-colors"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 animate-pulse">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14.5px] font-semibold text-red-900 leading-tight">
                {infractions.length} équipement{infractions.length > 1 ? "s" : ""} en infraction
              </div>
              <div className="text-[11.5px] text-red-800/80 leading-snug mt-0.5">
                Non-conformité UE 2024/573. Risque sanctions DREAL.
              </div>
            </div>
            <svg className="shrink-0 text-red-600/60" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </Link>
      )}

      {/* Hero Card — "Action du jour" : UNE seule chose claire à faire,
          style Pokémon Go badge géant. C'est le premier truc que l'artisan
          voit. Pas de chichi : emoji XL + 1 titre + 1 bouton. */}
      <section className="px-4 mt-3">
        <Link
          href={actionDuJour.href}
          className={`block rounded-3xl ${heroStyles.bg} px-5 py-6 shadow-lg active:scale-[0.99] transition-transform`}
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          <div className="flex items-center gap-4">
            <div className="text-5xl leading-none drop-shadow-sm">
              {actionDuJour.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-[10px] font-mono tracking-[0.25em] uppercase ${heroStyles.sub} mb-1`}>
                Action du jour
              </div>
              <div className={`text-[18px] font-bold leading-tight ${heroStyles.text}`}>
                {actionDuJour.titre}
              </div>
              <div className={`text-[12.5px] mt-1 leading-snug ${heroStyles.sub}`}>
                {actionDuJour.sous}
              </div>
            </div>
          </div>
          <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full ${heroStyles.btn} text-[13px] font-semibold transition-colors`}>
            {actionDuJour.bouton}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </Link>
      </section>

      {/* Stats grid 2x2 — mini compteurs avec emoji devant */}
      <section className="px-4 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <StatCard emoji="🏭" label="Équipements" value={stats.total} sub="au parc" color="text-[#111]" />
              <StatCard emoji="🚨" label="En retard" value={stats.enRetard} sub="à traiter" color="text-red-600" pulse={stats.enRetard > 0} />
              <StatCard emoji="📧" label="À relancer" value={stats.aRelancer} sub="≤ 30 j" color="text-orange-600" pulse={stats.aRelancer > 0} />
              <StatCard
                emoji="✅"
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
              title="🎯 À gérer en priorité"
              footer={`${stats.enRetard + stats.aRelancer + stats.aProgrammer + stats.jamais} installation${stats.enRetard + stats.aRelancer + stats.aProgrammer + stats.jamais > 1 ? "s" : ""} attendent un contrôle anti-fuite.`}
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
            <InsetListSection title="📋 Dernières interventions">
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

          {/* Actions principales — gros boutons accessibles, emoji devant */}
          <InsetListSection title="Que veux-tu faire ?">
            <InsetRow
              href="/m/intervention"
              leading={<BigEmoji>➕</BigEmoji>}
              label="Démarrer un chantier"
              sublabel="Nouvelle intervention sur une installation"
              showChevron
            />
            <InsetRow
              href="/m/scan"
              leading={<BigEmoji>📷</BigEmoji>}
              label="Scanner un QR code"
              sublabel="Reprendre une machine en 1 sec"
              showChevron
            />
            <InsetRow
              href="/m/diagnostic"
              leading={<BigEmoji>🤖</BigEmoji>}
              label="Diagnostiquer une panne"
              sublabel="Une photo → l'IA trouve la cause"
              showChevron
            />
            <InsetRow
              href="/m/planning"
              leading={<BigEmoji>🗓️</BigEmoji>}
              label="Voir mon planning"
              sublabel="Calendrier + carte des chantiers"
              showChevron
            />
          </InsetListSection>

          {/* Mon matos — gestion équipements, bouteilles, paperasse */}
          <InsetListSection title="Mon matos & paperasse">
            <InsetRow
              href="/m/equipements"
              leading={<BigEmoji>🏭</BigEmoji>}
              label="Mon parc d'installations"
              trailingValue={`${stats.total}`}
              showChevron
            />
            <InsetRow
              href="/m/bouteilles"
              leading={<BigEmoji>🛢️</BigEmoji>}
              label="Mes bouteilles de gaz"
              sublabel="Stock recharge + récup"
              showChevron
            />
            <InsetRow
              href="/m/registre"
              leading={<BigEmoji>📋</BigEmoji>}
              label="Mon registre officiel"
              sublabel="Pour les contrôles DREAL"
              showChevron
            />
            <InsetRow
              href="/m/syderep"
              leading={<BigEmoji>📊</BigEmoji>}
              label="Bilan annuel SYDEREP"
              sublabel="Déclaration HFC une fois par an"
              showChevron
            />
          </InsetListSection>

      {/* Profil section */}
      {!profil?.raisonSociale && (
        <InsetListSection footer="Ton nom + numéro d'attestation pour que les papiers officiels soient à ton nom.">
          <InsetRow
            href="/m/profil"
            leading={<BigEmoji>⚠️</BigEmoji>}
            label="Finis ton profil"
            sublabel="Quelques infos manquantes — 1 min"
            showChevron
          />
        </InsetListSection>
      )}

      {/* Toast hydratation Supabase (multi-device sync) */}
      {hydrationToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 px-4 py-2.5 rounded-full bg-emerald-600 text-white text-[12.5px] font-medium shadow-lg"
        >
          {hydrationToast}
        </div>
      )}
    </>
  );
}

function StatCard({
  emoji,
  label,
  value,
  sub,
  color,
  pulse,
}: {
  emoji?: string;
  label: string;
  value: number;
  sub: string;
  color: string;
  pulse?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white px-4 py-4 ring-1 ring-black/[0.04]">
      <div className="flex items-center gap-1.5">
        {emoji && <span className="text-[15px] leading-none">{emoji}</span>}
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

function BigEmoji({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-black/[0.04] text-[22px] leading-none">
      {children}
    </span>
  );
}

function ActionIcon({ name }: { name: "plus" | "list" | "doc" | "warning" | "qr" | "calendar" | "camera" }) {
  const colors = {
    plus: "bg-[#111] text-white",
    list: "bg-blue-50 text-blue-700",
    doc: "bg-purple-50 text-purple-700",
    warning: "bg-amber-50 text-amber-700",
    qr: "bg-[#A16207]/10 text-[#A16207]",
    calendar: "bg-emerald-50 text-emerald-700",
    camera: "bg-pink-50 text-pink-700",
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
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
    camera: (
      <>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
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

