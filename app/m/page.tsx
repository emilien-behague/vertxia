"use client";

import { useEffect, useMemo, useState } from "react";
import { MobileHeader } from "@/components/mobile/mobile-header";
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

// Dashboard mobile — accueil Vertxia.
//
// Refonte 05/06/2026 post-feedback SIDV ("simplifier pour les idiots") :
// inspiration du style "tuiles colorees pleines" type Fluid 360 (l'app que
// les frigoristes du metier connaissent) MAIS avec une identite Vertxia
// distincte : gradients subtils, palette plus profonde, typo Inter, pas
// de Tutoriels (qu'on n'a pas), badges chiffres en coin de tuile pour
// signaler les actions a faire dans chaque section sans verbosite.

function MobileHomePage() {
  const [equipements, setEquipements] = useState<EquipementWithStatus[]>([]);
  const [interventions, setInterventions] = useState<StoredIntervention[]>([]);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [hydrationToast, setHydrationToast] = useState<string | null>(null);

  useEffect(() => {
    const ints = listInterventions();
    setInterventions(ints);
    setEquipements(computeAllStatus(listEquipements(), ints));
    setProfil(loadProfil());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await hydrateFromSupabaseIfNeeded();
      if (cancelled || !result.attempted || !result.ok) return;
      const added = result.equipementsAdded + result.interventionsAdded;
      if (added > 0) {
        const ints = listInterventions();
        setInterventions(ints);
        setEquipements(computeAllStatus(listEquipements(), ints));
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

  // Total "actions a gerer" — agrege pour le badge en haut + sur la tuile Parc
  const aGererCount = stats.enRetard + stats.aRelancer;

  // Hero "Action du jour" — UNE chose claire a faire MAINTENANT
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
        sous: "Risque amende DREAL — agir vite",
        bouton: "Voir les retards",
        href: "/m/equipements?filter=en_retard",
      };
    }
    if (stats.aRelancer > 0) {
      return {
        emoji: "📧",
        couleur: "orange",
        titre: `${stats.aRelancer} client${stats.aRelancer > 1 ? "s" : ""} à relancer`,
        sous: "Échéance dans moins de 30 jours",
        bouton: "Envoyer les rappels",
        href: "/m/equipements?filter=a_relancer",
      };
    }
    if (stats.jamais > 0) {
      return {
        emoji: "🆕",
        couleur: "bleu",
        titre: `${stats.jamais} jamais contrôlé${stats.jamais > 1 ? "s" : ""}`,
        sous: "Démarre le suivi périodique",
        bouton: "Faire un contrôle",
        href: "/m/equipements",
      };
    }
    if (stats.total === 0) {
      return {
        emoji: "👋",
        couleur: "bleu",
        titre: "Ajoute ton premier équipement",
        sous: "Scanne une plaque en 3 secondes",
        bouton: "Scanner une plaque",
        href: "/m/equipements/nouveau",
      };
    }
    return {
      emoji: "✅",
      couleur: "vert",
      titre: "Tout est à jour !",
      sous: "Rien à faire en urgence",
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

  return (
    <>
      <MobileHeader title="Vertxia" largeTitle />

      {/* Bandeau infraction reglementaire — uniquement si >0, prend toute
          la largeur, gros et rouge. */}
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
                Non-conformité UE 2024/573. Risque DREAL.
              </div>
            </div>
            <svg className="shrink-0 text-red-600/60" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </Link>
      )}

      {/* Hero "Action du jour" — gros gradient, l'unique chose a faire */}
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

      {/* Grille de tuiles principales — refonte fi360-inspired, palette Vertxia.
          Logique : 1 tuile XL en haut (action principale du metier = nouvelle
          intervention) + grille 2x2 de raccourcis + tuile XL paperasse +
          grille 2x2 secondaire. Couleurs gradient subtils, pas plats pour se
          differencier de fi360. */}
      <section className="px-4 mt-4 space-y-3">
        {/* Tuile XL — Nouvelle intervention (l'action principale du metier) */}
        <Tuile
          href="/m/intervention"
          size="xl"
          variant="emerald"
          emoji="➕"
          label="Nouvelle intervention"
          sublabel="Démarrer un chantier"
        />

        {/* Grille 2x2 — outils terrain quotidiens */}
        <div className="grid grid-cols-2 gap-3">
          <Tuile
            href="/m/equipements"
            variant="sky"
            emoji="🏭"
            label="Mon parc"
            sublabel={`${stats.total} installation${stats.total > 1 ? "s" : ""}`}
            badge={aGererCount > 0 ? aGererCount : undefined}
          />
          <Tuile
            href="/m/scan"
            variant="violet"
            emoji="📷"
            label="Scanner QR"
            sublabel="Reprendre une machine"
          />
          <Tuile
            href="/m/diagnostic"
            variant="rose"
            emoji="🤖"
            label="Diagnostic IA"
            sublabel="Photo → cause"
          />
          <Tuile
            href="/m/planning"
            variant="teal"
            emoji="🗓️"
            label="Planning"
            sublabel="Carte + agenda"
          />
        </div>

        {/* Tuile XL — Paperasse officielle */}
        <Tuile
          href="/m/registre"
          size="xl"
          variant="bronze"
          emoji="📋"
          label="Mon registre officiel"
          sublabel="Prêt pour les contrôles DREAL"
        />

        {/* Grille 2x2 — gestion matos + paperasse annuelle */}
        <div className="grid grid-cols-2 gap-3">
          <Tuile
            href="/m/bouteilles"
            variant="slate"
            emoji="🛢️"
            label="Bouteilles"
            sublabel="Stock + récup"
          />
          <Tuile
            href="/m/syderep"
            variant="amber"
            emoji="📊"
            label="SYDEREP"
            sublabel="Bilan annuel"
          />
          <Tuile
            href="/m/historique"
            variant="indigo"
            emoji="📂"
            label="Historique"
            sublabel={`${interventions.length} intervention${interventions.length > 1 ? "s" : ""}`}
          />
          <Tuile
            href="/m/documents"
            variant="zinc"
            emoji="📎"
            label="Documents"
            sublabel="CERFA + BSFF"
          />
        </div>
      </section>

      {/* Profil incomplet — banniere discrete en bas, pas un blocage */}
      {!profil?.raisonSociale && (
        <section className="px-4 mt-4 mb-4">
          <Link
            href="/m/profil"
            className="block rounded-2xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3 active:bg-amber-100/60 transition-colors"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-[18px]">
                ⚠️
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-amber-900 leading-tight">
                  Finis ton profil
                </div>
                <div className="text-[11.5px] text-amber-800/85 mt-0.5">
                  Quelques infos manquantes — 1 minute
                </div>
              </div>
              <svg className="shrink-0 text-amber-700/60" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
          </Link>
        </section>
      )}

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

export default MobileHomePage;

// ──────────────────────────────────────────────────────────────────────────
// Composant Tuile — l'unite visuelle de la home post-refonte SIDV.
// Inspire des tuiles plates "Fluid 360" mais retravaillee identite Vertxia :
//   - Gradient diagonal subtil (pas plat fi360)
//   - Rounded-3xl (plus arrondi)
//   - Typo bold uppercase white + emoji XL en coin
//   - Badge chiffre rouge en coin haut-droit si actions a faire
//   - Fleche -> blanche translucide sur les tuiles XL (pas le triangle play)
//
// 2 tailles : "xl" (full-width, hero) + default (grid item).
// 8 variants de couleurs pour eviter monotone et bien differencier les sections.
// ──────────────────────────────────────────────────────────────────────────

type TuileVariant =
  | "emerald"
  | "bronze"
  | "sky"
  | "slate"
  | "rose"
  | "violet"
  | "teal"
  | "amber"
  | "indigo"
  | "zinc";

// IMPORTANT : gradients passes en STYLE INLINE et non en classes Tailwind.
// Raison : si on met "bg-gradient-to-br from-X to-Y" dans un objet JS, le
// tree-shaker Tailwind ne voit pas les classes (composees dynamiquement) et
// ne genere pas le CSS correspondant -> fond blanc + texte blanc = illisible.
// Bug observe 05/06/2026 sur la home post-refonte fi360-inspired.
const VARIANTS: Record<TuileVariant, string> = {
  emerald: "linear-gradient(135deg, #10b981 0%, #0f766e 100%)",
  bronze: "linear-gradient(135deg, #A16207 0%, #7A4A05 100%)",
  sky: "linear-gradient(135deg, #0ea5e9 0%, #1d4ed8 100%)",
  slate: "linear-gradient(135deg, #334155 0%, #0f172a 100%)",
  rose: "linear-gradient(135deg, #f43f5e 0%, #db2777 100%)",
  violet: "linear-gradient(135deg, #7c3aed 0%, #6b21a8 100%)",
  teal: "linear-gradient(135deg, #14b8a6 0%, #0891b2 100%)",
  amber: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
  indigo: "linear-gradient(135deg, #6366f1 0%, #1d4ed8 100%)",
  zinc: "linear-gradient(135deg, #52525b 0%, #27272a 100%)",
};

function Tuile({
  href,
  variant,
  emoji,
  label,
  sublabel,
  size = "regular",
  badge,
}: {
  href: string;
  variant: TuileVariant;
  emoji: string;
  label: string;
  sublabel?: string;
  size?: "xl" | "regular";
  badge?: number;
}) {
  const isXl = size === "xl";
  return (
    <Link
      href={href}
      className={`relative block rounded-3xl shadow-lg shadow-black/10 active:scale-[0.98] transition-transform overflow-hidden ${
        isXl ? "px-5 py-6" : "px-4 py-5 min-h-[120px]"
      }`}
      style={{
        background: VARIANTS[variant],
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      {/* Badge chiffre (notif) en haut-droite. Visible meme sur tuile reguliere. */}
      {typeof badge === "number" && badge > 0 && (
        <span className="absolute top-3 right-3 min-w-[26px] h-[26px] px-1.5 rounded-full bg-red-500 text-white text-[12px] font-bold flex items-center justify-center shadow-md ring-2 ring-white/80">
          {badge > 99 ? "99+" : badge}
        </span>
      )}

      {isXl ? (
        <div className="flex items-center gap-4">
          <div className="text-5xl leading-none drop-shadow">{emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[18px] font-bold uppercase tracking-wide text-white leading-tight">
              {label}
            </div>
            {sublabel && (
              <div className="text-[12.5px] text-white/80 mt-1 leading-snug">
                {sublabel}
              </div>
            )}
          </div>
          <svg className="shrink-0 text-white/70" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="text-[34px] leading-none drop-shadow mb-2">{emoji}</div>
          <div className="text-[14px] font-bold uppercase tracking-wide text-white leading-tight">
            {label}
          </div>
          {sublabel && (
            <div className="text-[11px] text-white/75 mt-0.5 leading-snug">
              {sublabel}
            </div>
          )}
        </div>
      )}
    </Link>
  );
}
