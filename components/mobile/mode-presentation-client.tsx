"use client";

// Mode "Présentation client" — overlay plein écran épuré qui transforme
// la fiche équipement en "carte d'identité" lisible à 1 mètre de distance.
//
// Cas d'usage : le frigoriste arrive sur site, ouvre l'app, tend le
// téléphone au client. Le client voit en 2 secondes : sa machine, son
// fluide, son statut de conformité, sa prochaine échéance. Argument
// commercial fort — confiance immédiate, vente facile d'un nouveau
// contrat de maintenance ou d'une mise à niveau.
//
// Design : zéro UI complexe, gros texte, 1 couleur de statut dominante.
// Branding subtil de l'entreprise frigoriste en haut (logo + nom).

import { useEffect } from "react";
import type { EquipementWithStatus, ControleStatut } from "@/lib/equipement";
import type { Profil } from "@/lib/profil";
import { PannesConnuesCard } from "./pannes-connues-card";

type Props = {
  eq: EquipementWithStatus;
  profil: Profil | null;
  onClose: () => void;
};

// Statut "client-friendly" : on traduit les codes en messages simples
// et rassurants/alarmants pour le client final qui ne connaît pas la
// réglementation F-Gas.
const STATUT_CLIENT: Record<
  ControleStatut,
  {
    emoji: string;
    titre: string;
    sousTitre: string;
    bg: string;
    text: string;
    accent: string;
  }
> = {
  ok: {
    emoji: "✅",
    titre: "Installation conforme",
    sousTitre: "Tout est à jour. Aucune action requise pour le moment.",
    bg: "bg-emerald-50",
    text: "text-emerald-900",
    accent: "bg-emerald-500",
  },
  a_programmer: {
    emoji: "📅",
    titre: "Prochain contrôle à programmer",
    sousTitre: "Le contrôle d'étanchéité approche. Nous prendrons contact avec vous.",
    bg: "bg-amber-50",
    text: "text-amber-900",
    accent: "bg-amber-500",
  },
  a_relancer: {
    emoji: "📧",
    titre: "Contrôle à programmer rapidement",
    sousTitre: "L'échéance arrive dans moins de 30 jours.",
    bg: "bg-orange-50",
    text: "text-orange-900",
    accent: "bg-orange-500",
  },
  en_retard: {
    emoji: "🚨",
    titre: "Contrôle en retard",
    sousTitre: "Conformément à la réglementation, un contrôle est requis sans délai.",
    bg: "bg-red-50",
    text: "text-red-900",
    accent: "bg-red-500",
  },
  jamais: {
    emoji: "🆕",
    titre: "Premier contrôle à planifier",
    sousTitre: "Cette installation n'a pas encore reçu de contrôle d'étanchéité.",
    bg: "bg-blue-50",
    text: "text-blue-900",
    accent: "bg-blue-500",
  },
  exempt: {
    emoji: "🌿",
    titre: "Installation exemptée",
    sousTitre: "La charge fluide est en dessous du seuil de contrôle obligatoire.",
    bg: "bg-slate-50",
    text: "text-slate-900",
    accent: "bg-slate-400",
  },
};

function fmtDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDateCourt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ModePresentationClient({ eq, profil, onClose }: Props) {
  const statutInfo = STATUT_CLIENT[eq.statut];

  // Bloque le scroll de la page parente pendant que l'overlay est ouvert.
  // Permet aussi de fermer avec la touche Escape (utile en mode desktop).
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const aujourdhui = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      {/* Bouton fermer flottant */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Quitter le mode présentation"
        className="fixed top-4 right-4 z-10 w-11 h-11 rounded-full bg-black/85 text-white flex items-center justify-center active:scale-95 transition-transform shadow-lg"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="min-h-screen flex flex-col px-6 pt-10 pb-8">
        {/* Header pro — logo + nom entreprise frigoriste (signature pro) */}
        <div className="flex items-center gap-3 mb-8">
          {profil?.logoDataUrl ? (
            <img
              src={profil.logoDataUrl}
              alt={profil.raisonSociale || "Logo"}
              className="w-12 h-12 rounded-xl object-cover ring-1 ring-black/[0.06]"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[#A16207]/10 flex items-center justify-center text-[22px]">
              🔧
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-black/40">
              Suivi assuré par
            </div>
            <div className="text-[15px] font-semibold text-[#111] leading-tight truncate">
              {profil?.raisonSociale || "Votre frigoriste"}
            </div>
            {profil?.numeroAttestation && (
              <div className="text-[10.5px] text-black/50 mt-0.5">
                Attestation F-Gas n° {profil.numeroAttestation}
              </div>
            )}
          </div>
        </div>

        {/* Hero — équipement */}
        <div className="mb-6">
          <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-black/40 mb-2">
            Votre installation
          </div>
          <h1 className="text-[40px] font-bold leading-[1.05] tracking-tight text-[#111] break-words">
            {eq.modele || "Installation"}
          </h1>
          {eq.siteAdresse && (
            <div className="mt-2 text-[15px] text-black/65 leading-snug">
              {eq.siteAdresse}
            </div>
          )}
        </div>

        {/* GROS BADGE STATUT — l'info dominante de l'écran */}
        <div
          className={`rounded-3xl ${statutInfo.bg} px-6 py-7 mb-6 ring-1 ring-black/[0.04]`}
        >
          <div className="flex items-start gap-4">
            <div className="text-5xl leading-none shrink-0">
              {statutInfo.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={`inline-flex items-center gap-1.5 text-[10px] font-mono tracking-[0.2em] uppercase font-semibold ${statutInfo.text} opacity-80 mb-1`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${statutInfo.accent}`}
                />
                État au {aujourdhui}
              </div>
              <div className={`text-[22px] font-bold leading-tight ${statutInfo.text}`}>
                {statutInfo.titre}
              </div>
              <div className={`mt-2 text-[14px] leading-relaxed ${statutInfo.text} opacity-85`}>
                {statutInfo.sousTitre}
              </div>
            </div>
          </div>
        </div>

        {/* Fiche technique — 3 stats clés, gros, lisibles */}
        <div className="space-y-3 mb-6">
          <FicheRow
            label="Fluide frigorigène"
            value={eq.fluide.code}
            sub={`GWP ${eq.fluide.gwp.toLocaleString("fr-FR")} — ${eq.tCO2eq.toFixed(2).replace(".", ",")} tonnes éq. CO₂`}
          />
          <FicheRow
            label="Charge nominale"
            value={`${eq.chargeKg.toFixed(2).replace(".", ",")} kg`}
          />
          {eq.frequenceMois && (
            <FicheRow
              label="Fréquence de contrôle réglementaire"
              value={`Tous les ${eq.frequenceMois} mois`}
              sub="Règlement UE 2024/573 (anciennement 517/2014)"
            />
          )}
          {eq.dernierControleISO && (
            <FicheRow
              label="Dernier contrôle"
              value={fmtDateCourt(eq.dernierControleISO)}
            />
          )}
          {eq.prochainControleISO && (
            <FicheRow
              label="Prochain contrôle"
              value={fmtDateLong(eq.prochainControleISO)}
              highlight
            />
          )}
        </div>

        {/* Unités intérieures rattachées (si applicable) */}
        {eq.unitesInterieures && eq.unitesInterieures.length > 0 && (
          <div className="mb-6 px-5 py-4 rounded-2xl bg-black/[0.02] ring-1 ring-black/[0.04]">
            <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-black/40 mb-2">
              Unités intérieures rattachées
            </div>
            <div className="text-[15px] font-medium text-[#111]">
              {eq.unitesInterieures.length} unité
              {eq.unitesInterieures.length > 1 ? "s" : ""} sur le même circuit
            </div>
          </div>
        )}

        {/* Pannes connues sur ce modèle (mémoire collective Vertxia).
            S'affiche seulement si modele renseigné. */}
        {eq.modele && (
          <div className="mb-6">
            <PannesConnuesCard modeleComplet={eq.modele} />
          </div>
        )}

        {/* Footer pro — coordonnées + branding Vertxia discret */}
        <div className="mt-auto pt-6 border-t border-black/[0.06]">
          <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-black/40 mb-2">
            Contact
          </div>
          {profil?.telephone && (
            <a
              href={`tel:${profil.telephone}`}
              className="block text-[18px] font-semibold text-[#A16207] active:opacity-70"
            >
              {profil.telephone}
            </a>
          )}
          {profil?.email && (
            <a
              href={`mailto:${profil.email}`}
              className="block text-[14px] text-[#111]/75 mt-1 active:opacity-70 truncate"
            >
              {profil.email}
            </a>
          )}
          <div className="mt-5 flex items-center justify-between text-[10.5px] text-black/40">
            <span>Conformité suivie via Vertxia</span>
            <span>vertxia.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FicheRow({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`px-5 py-4 rounded-2xl ${
        highlight
          ? "bg-[#A16207]/8 ring-1 ring-[#A16207]/20"
          : "bg-black/[0.02] ring-1 ring-black/[0.04]"
      }`}
    >
      <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-black/40">
        {label}
      </div>
      <div
        className={`mt-1 text-[20px] font-semibold leading-tight ${
          highlight ? "text-[#A16207]" : "text-[#111]"
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-black/45 mt-0.5 leading-snug">
          {sub}
        </div>
      )}
    </div>
  );
}
