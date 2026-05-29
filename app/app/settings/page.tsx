"use client";

/**
 * /app/settings — preferences compte + billing + AI engines + API keys.
 *
 * 5 sections (sticky left nav + sections empilees) :
 *  1. Account     — nom, email, langue
 *  2. Billing     — plan, usage, factures
 *  3. AI Engines  — preference Kling/Runway/Veo + ordre fallback
 *  4. API keys    — slots Replicate/Meshy/Flux/ElevenLabs
 *  5. Notifications — emails + activity feed
 *
 * V0.1 = UI only (pas de persistance backend, formulaires inertes).
 */

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PageShell,
  PrimaryButton,
  GhostButton,
  SectionTitle,
} from "@/components/app/page-shell";
import {
  IconUser,
  IconZap,
  IconWand,
  IconCable,
  IconInbox,
  IconChevronRight,
} from "@/components/app/icons";

/* =========================================================
 *  Types billing API
 * ========================================================= */

type BillingData = {
  subscription: {
    id: string;
    status:
      | "trialing"
      | "active"
      | "past_due"
      | "canceled"
      | "incomplete"
      | "incomplete_expired"
      | "unpaid"
      | "paused";
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: number | null;
    trialEnd: number | null;
    tier: {
      id: "studio" | "agency";
      name: string;
      tagline: string;
      features: string[];
      period: "monthly" | "annual";
      amount: number;
    } | null;
    priceId: string | null;
    currency: string;
    interval: "month" | "year" | null;
  } | null;
  paymentMethod: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
};

type SectionKey = "account" | "billing" | "engines" | "keys" | "notifications";

const SECTIONS: Array<{ key: SectionKey; label: string; icon: React.ReactNode }> = [
  { key: "account",       label: "Account",       icon: <IconUser size={15} /> },
  { key: "billing",       label: "Billing",       icon: <IconZap size={15} /> },
  { key: "engines",       label: "AI Engines",    icon: <IconWand size={15} /> },
  { key: "keys",          label: "API Keys",      icon: <IconCable size={15} /> },
  { key: "notifications", label: "Notifications", icon: <IconInbox size={15} /> },
];

export default function SettingsPage() {
  const [section, setSection] = useState<SectionKey>("account");

  return (
    <PageShell
      eyebrow="Preferences"
      title="Settings"
      description="Compte, facturation, engines AI, cles API et notifications."
    >
      <div className="grid grid-cols-[200px_1fr] gap-12">
        {/* Sticky nav left */}
        <aside className="sticky top-[140px] self-start space-y-0.5">
          {SECTIONS.map((s) => {
            const isActive = section === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                className={[
                  "w-full flex items-center justify-between gap-2 h-9 px-3 rounded-lg text-[13px] transition",
                  isActive
                    ? "bg-white/[0.06] text-white"
                    : "text-white/55 hover:text-white hover:bg-white/[0.03]",
                ].join(" ")}
              >
                <span className="flex items-center gap-2.5">
                  <span className={isActive ? "text-[#D6B96E]" : "text-white/40"}>
                    {s.icon}
                  </span>
                  {s.label}
                </span>
                {isActive && (
                  <IconChevronRight size={13} className="text-white/35" />
                )}
              </button>
            );
          })}
        </aside>

        {/* Content panel */}
        <div className="min-w-0">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }}
          >
            {section === "account"       && <AccountSection />}
            {section === "billing"       && <BillingSection />}
            {section === "engines"       && <EnginesSection />}
            {section === "keys"          && <KeysSection />}
            {section === "notifications" && <NotificationsSection />}
          </motion.div>
        </div>
      </div>
    </PageShell>
  );
}

/* ---------- Sections ---------- */

function AccountSection() {
  return (
    <div className="space-y-10">
      <SectionTitle>Profil</SectionTitle>
      <div className="space-y-5 max-w-xl">
        <Field label="Nom" defaultValue="Emilien Behague" />
        <Field label="Email business" defaultValue="emilien@vertxia.com" type="email" />
        <Field label="Langue de l'interface" defaultValue="Francais" hint="Cette langue s'applique aussi aux briefings AI." />
        <Field label="Fuseau horaire" defaultValue="Europe/Paris (UTC+1)" />
      </div>
      <div className="flex items-center gap-2 pt-3">
        <PrimaryButton>Sauvegarder</PrimaryButton>
        <GhostButton>Annuler</GhostButton>
      </div>
    </div>
  );
}

function BillingSection() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/subscription")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json())?.error || "fetch failed");
        return r.json() as Promise<BillingData>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erreur Stripe");
          setData({ subscription: null, paymentMethod: null });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const r = await fetch("/api/billing/portal", { method: "POST" });
      const json = await r.json();
      if (r.ok && json.url) {
        window.location.href = json.url;
      } else {
        setError(json.error || "Erreur lors de l'ouverture du portail");
        setPortalLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur reseau");
      setPortalLoading(false);
    }
  };

  if (loading) return <BillingLoading />;
  if (!data?.subscription) return <BillingEmpty error={error} />;

  return (
    <BillingActive
      data={data}
      onOpenPortal={openPortal}
      portalLoading={portalLoading}
      error={error}
    />
  );
}

/* ---------- Billing sub-components ---------- */

function BillingLoading() {
  return (
    <div className="space-y-10">
      <SectionTitle>Plan actuel</SectionTitle>
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 max-w-xl">
        <div className="space-y-3 animate-pulse">
          <div className="h-3 w-16 bg-white/[0.05] rounded" />
          <div className="h-7 w-32 bg-white/[0.05] rounded" />
          <div className="h-3 w-64 bg-white/[0.05] rounded" />
        </div>
      </div>
    </div>
  );
}

function BillingEmpty({ error }: { error: string | null }) {
  return (
    <div className="space-y-10">
      <SectionTitle>Plan actuel</SectionTitle>
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-8 max-w-xl text-center">
        <div
          className="w-12 h-12 rounded-full mx-auto mb-4 grid place-items-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(214,185,110,0.10), rgba(214,185,110,0.04))",
            border: "1px solid rgba(214,185,110,0.20)",
          }}
        >
          <IconZap size={18} className="text-[#D6B96E]" />
        </div>
        <p className="text-[15px] font-medium text-white mb-1.5">
          Aucun abonnement actif
        </p>
        <p className="text-[12.5px] text-white/55 leading-relaxed max-w-sm mx-auto mb-5">
          Active ton abonnement pour debloquer la generation de sites cinematic
          + videos AI.
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-white text-black text-[13px] font-medium hover:scale-[1.02] active:scale-[0.98] transition"
        >
          Voir les offres →
        </Link>
        {error && (
          <p className="mt-5 text-[11.5px] text-red-400/70">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function BillingActive({
  data,
  onOpenPortal,
  portalLoading,
  error,
}: {
  data: BillingData;
  onOpenPortal: () => void;
  portalLoading: boolean;
  error: string | null;
}) {
  const sub = data.subscription!;
  const pm = data.paymentMethod;

  const periodLabel = sub.interval === "year" ? "/an" : "/mois";
  const amountStr = sub.tier
    ? new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: sub.currency.toUpperCase(),
        minimumFractionDigits: 0,
      }).format(sub.tier.amount)
    : "—";

  const tierName = sub.tier?.name || "Plan";
  const tagline = sub.tier?.tagline || "";

  // Date formatting
  const fmtDate = (ts: number | null) =>
    ts
      ? new Intl.DateTimeFormat("fr-FR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }).format(new Date(ts * 1000))
      : null;

  const trialEndDate = fmtDate(sub.trialEnd);
  const periodEndDate = fmtDate(sub.currentPeriodEnd);

  // Compute trial days left
  const trialDaysLeft =
    sub.trialEnd && sub.status === "trialing"
      ? Math.max(
          0,
          Math.ceil((sub.trialEnd * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
        )
      : null;

  return (
    <div className="space-y-10">
      <SectionTitle>Plan actuel</SectionTitle>

      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 max-w-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10.5px] tracking-[0.18em] uppercase font-medium text-[#D6B96E]/85">
                {tierName}
              </p>
              <StatusBadge sub={sub} trialDaysLeft={trialDaysLeft} />
            </div>
            <p className="text-[22px] font-semibold text-white tracking-[-0.02em]">
              {amountStr}
              <span className="text-[13px] text-white/40 font-normal">
                {periodLabel}
              </span>
            </p>
            {tagline && (
              <p className="mt-1 text-[12.5px] text-white/50">{tagline}</p>
            )}
          </div>
          <GhostButton
            onClick={onOpenPortal}
            disabled={portalLoading}
          >
            {portalLoading ? "Ouverture..." : "Changer de plan"}
          </GhostButton>
        </div>

        {/* Period / trial info */}
        <div className="mt-5 pt-5 border-t border-white/[0.06] space-y-2">
          {sub.status === "trialing" && trialEndDate && (
            <InfoRow
              label="Fin de l'essai"
              value={trialEndDate}
              accent={trialDaysLeft !== null && trialDaysLeft <= 2 ? "warn" : undefined}
            />
          )}
          {sub.status !== "trialing" && periodEndDate && (
            <InfoRow
              label={
                sub.cancelAtPeriodEnd
                  ? "Acces jusqu'au"
                  : "Prochain prelevement"
              }
              value={periodEndDate}
              accent={sub.cancelAtPeriodEnd ? "warn" : undefined}
            />
          )}
          {sub.cancelAtPeriodEnd && (
            <p className="text-[11.5px] text-orange-300/80 leading-relaxed pt-1">
              Ton abonnement est programme pour s'arreter. Tu peux le
              reactiver depuis le portail Stripe.
            </p>
          )}
        </div>

        {/* Features rappel */}
        {sub.tier?.features?.length ? (
          <div className="mt-5 pt-5 border-t border-white/[0.06]">
            <p className="text-[11px] tracking-[0.04em] uppercase font-medium text-white/40 mb-2.5">
              Inclus dans ton plan
            </p>
            <ul className="space-y-1.5">
              {sub.tier.features.slice(0, 4).map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2 text-[12.5px] text-white/65"
                >
                  <span className="w-1 h-1 rounded-full bg-[#D6B96E]" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Payment method */}
      <SectionTitle>Methode de paiement</SectionTitle>
      <div className="max-w-xl">
        {pm ? (
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-3 min-w-0">
              <CardBrandBadge brand={pm.brand} />
              <div className="min-w-0">
                <p className="text-[13px] text-white">·· {pm.last4}</p>
                <p className="text-[11.5px] text-white/40">
                  Expire{" "}
                  {String(pm.expMonth).padStart(2, "0")}/{pm.expYear}
                </p>
              </div>
            </div>
            <GhostButton onClick={onOpenPortal} disabled={portalLoading}>
              {portalLoading ? "Ouverture..." : "Modifier"}
            </GhostButton>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/[0.10]">
            <p className="text-[12.5px] text-white/55 mb-2">
              Aucune carte enregistree.
            </p>
            <GhostButton onClick={onOpenPortal} disabled={portalLoading}>
              {portalLoading ? "Ouverture..." : "Ajouter une carte"}
            </GhostButton>
          </div>
        )}
      </div>

      {/* Factures + historique via portail */}
      <SectionTitle>Factures & historique</SectionTitle>
      <div className="max-w-xl">
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="min-w-0">
            <p className="text-[13px] text-white">
              Telecharge tes factures
            </p>
            <p className="text-[11.5px] text-white/45 truncate">
              Accede au portail Stripe : factures PDF, historique paiements,
              changement de plan, annulation.
            </p>
          </div>
          <GhostButton onClick={onOpenPortal} disabled={portalLoading}>
            {portalLoading ? "Ouverture..." : "Ouvrir"}
          </GhostButton>
        </div>
      </div>

      {error && (
        <div className="max-w-xl p-3 rounded-xl bg-red-500/[0.08] border border-red-500/[0.20]">
          <p className="text-[12px] text-red-300/85">{error}</p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  sub,
  trialDaysLeft,
}: {
  sub: NonNullable<BillingData["subscription"]>;
  trialDaysLeft: number | null;
}) {
  if (sub.cancelAtPeriodEnd) {
    return (
      <Badge color="orange">
        S'arrete bientot
      </Badge>
    );
  }
  switch (sub.status) {
    case "trialing":
      return (
        <Badge color="gold">
          Essai · {trialDaysLeft ?? "?"}j restants
        </Badge>
      );
    case "active":
      return <Badge color="green">Actif</Badge>;
    case "past_due":
    case "unpaid":
      return <Badge color="red">Paiement echoue</Badge>;
    case "canceled":
      return <Badge color="red">Annule</Badge>;
    case "paused":
      return <Badge color="orange">Pause</Badge>;
    default:
      return <Badge color="neutral">{sub.status}</Badge>;
  }
}

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "gold" | "green" | "orange" | "red" | "neutral";
}) {
  const styles: Record<typeof color, { bg: string; border: string; text: string }> = {
    gold: {
      bg: "rgba(214,185,110,0.10)",
      border: "rgba(214,185,110,0.30)",
      text: "rgb(214,185,110)",
    },
    green: {
      bg: "rgba(101,229,165,0.10)",
      border: "rgba(101,229,165,0.30)",
      text: "rgb(101,229,165)",
    },
    orange: {
      bg: "rgba(255,165,90,0.10)",
      border: "rgba(255,165,90,0.30)",
      text: "rgb(255,178,110)",
    },
    red: {
      bg: "rgba(255,90,90,0.10)",
      border: "rgba(255,90,90,0.30)",
      text: "rgb(255,130,130)",
    },
    neutral: {
      bg: "rgba(255,255,255,0.05)",
      border: "rgba(255,255,255,0.10)",
      text: "rgba(255,255,255,0.65)",
    },
  };
  const s = styles[color];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-medium tracking-wide"
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
      }}
    >
      <span
        className="w-1 h-1 rounded-full"
        style={{ background: s.text }}
      />
      {children}
    </span>
  );
}

function InfoRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "warn";
}) {
  return (
    <div className="flex items-center justify-between text-[12.5px]">
      <span className="text-white/55">{label}</span>
      <span className={accent === "warn" ? "text-orange-300" : "text-white"}>
        {value}
      </span>
    </div>
  );
}

function CardBrandBadge({ brand }: { brand: string }) {
  const b = brand.toLowerCase();
  const bgClass =
    b === "visa"
      ? "bg-gradient-to-br from-blue-600 to-blue-800"
      : b === "mastercard"
      ? "bg-gradient-to-br from-orange-500 to-red-600"
      : b === "amex"
      ? "bg-gradient-to-br from-cyan-600 to-blue-700"
      : "bg-gradient-to-br from-neutral-700 to-neutral-900";
  return (
    <span
      className={`w-9 h-7 rounded grid place-items-center text-white text-[10px] font-bold uppercase ${bgClass}`}
    >
      {b === "amex" ? "AMEX" : b.slice(0, 4)}
    </span>
  );
}

function EnginesSection() {
  const ENGINES = [
    { id: "kling",      label: "Kling 2.1",        desc: "Cinematic premium, motion fluide. Default pour mood luxury." },
    { id: "runway",     label: "Runway Gen-4",     desc: "Control fin du camera move, ideal pour des shots produits." },
    { id: "veo",        label: "Veo 3",            desc: "Sound natif + cinematic Google. Solid sur les longues sequences." },
    { id: "higgsfield", label: "Higgsfield",       desc: "Camera tracking et FX. Effets speciaux et transitions." },
    { id: "hailuo",     label: "Hailuo",           desc: "Fast & cheap. Fallback economique sur volumes." },
  ];
  return (
    <div className="space-y-10">
      <SectionTitle>Ordre de priorite</SectionTitle>
      <p className="text-[13px] text-white/55 max-w-xl -mt-6">
        Vertxia route automatiquement chaque generation vers l'engine optimal. Tu peux
        forcer un ordre de preference — utilise sur les briefs ou ton premier choix
        est indispo.
      </p>
      <div className="space-y-2 max-w-xl">
        {ENGINES.map((e, i) => (
          <div
            key={e.id}
            className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
          >
            <span className="w-6 h-6 rounded-md bg-white/[0.06] grid place-items-center text-[11px] font-semibold text-white/60">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-white">{e.label}</p>
              <p className="text-[11.5px] text-white/45">{e.desc}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-9 h-5 bg-white/[0.08] peer-checked:bg-[#D6B96E] rounded-full transition relative">
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
              </div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

function KeysSection() {
  const KEYS = [
    { id: "replicate",  label: "Replicate",  status: "connected" as const },
    { id: "meshy",      label: "Meshy",      status: "connected" as const },
    { id: "flux",       label: "Flux (BFL)", status: "connected" as const },
    { id: "elevenlabs", label: "ElevenLabs", status: "disconnected" as const },
    { id: "anthropic",  label: "Anthropic",  status: "connected" as const },
  ];
  return (
    <div className="space-y-8">
      <SectionTitle>Cles API connectees</SectionTitle>
      <p className="text-[13px] text-white/55 max-w-xl -mt-4">
        Vertxia utilise tes propres cles API si tu veux router via ton compte. Sinon
        nous appliquons nos cles partagees (compris dans le plan).
      </p>
      <div className="space-y-2 max-w-xl">
        {KEYS.map((k) => {
          const isConnected = k.status === "connected";
          return (
            <div
              key={k.id}
              className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: isConnected ? "#65E5A5" : "rgba(255,255,255,0.2)" }}
                />
                <p className="text-[13px] text-white">{k.label}</p>
                <span className="text-[11px] text-white/40">
                  {isConnected ? "·· sk-***...***" : "Non connecte"}
                </span>
              </div>
              {isConnected ? (
                <GhostButton>Reset</GhostButton>
              ) : (
                <PrimaryButton>Connecter</PrimaryButton>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NotificationsSection() {
  const NOTIFS = [
    { id: "site-done",   label: "Site genere",     desc: "Email quand un site termine sa generation." },
    { id: "video-done",  label: "Video AI generee", desc: "Email quand une video est prete." },
    { id: "weekly",      label: "Recap hebdomadaire", desc: "Resume des stats chaque dimanche soir." },
    { id: "billing",     label: "Activite facturation", desc: "Alertes paiements et limites de plan." },
  ];
  return (
    <div className="space-y-8">
      <SectionTitle>Canaux</SectionTitle>
      <div className="space-y-2 max-w-xl">
        {NOTIFS.map((n) => (
          <div
            key={n.id}
            className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
          >
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-white">{n.label}</p>
              <p className="text-[11.5px] text-white/45 truncate">{n.desc}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-9 h-5 bg-white/[0.08] peer-checked:bg-[#D6B96E] rounded-full transition relative">
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
              </div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Helpers UI ---------- */

function Field({
  label,
  defaultValue,
  type = "text",
  hint,
}: {
  label: string;
  defaultValue: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-[11.5px] tracking-[0.04em] uppercase font-medium text-white/45 mb-1.5">
        {label}
      </label>
      <input
        type={type}
        defaultValue={defaultValue}
        className="w-full h-10 px-4 rounded-xl bg-white/[0.03] border border-white/[0.06] focus:border-white/[0.20] outline-none text-[13.5px] text-white placeholder:text-white/35 transition"
      />
      {hint && (
        <p className="mt-1.5 text-[11.5px] text-white/40">{hint}</p>
      )}
    </div>
  );
}
