"use client";

/**
 * /pricing — page publique de tarification Vertxia Lite.
 *
 * 2 tiers : Studio (149€/mo) + Agency (499€/mo). Toggle Monthly/Annual avec savings %.
 * CTAs lancent /api/checkout/session puis redirigent vers Stripe Checkout.
 *
 * Design : dark, premium, coherent avec /app (galerie 3D + central command).
 * Ambient gradient, glass cards, accent gold #D6B96E pour le tier highlighted.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import {
  PRICING_TIERS,
  monthlyEquivalent,
  type PricingPeriod,
  type PricingTier,
} from "@/lib/pricing";
import { IconArrowRight, IconSparkles } from "@/components/app/icons";

const ANIM = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

export default function PricingPage() {
  const [period, setPeriod] = useState<PricingPeriod>("annual");
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  async function handleCheckout(tier: PricingTier) {
    setLoadingTier(tier.id);
    try {
      const priceId = tier.prices[period].priceId;
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (res.status === 401) {
        // Pas log-in -> direction login, on garde /pricing en retour
        window.location.href = data.redirectTo || "/login?from=/pricing";
        return;
      }
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Erreur Stripe");
      }
      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert(
        "Impossible de lancer le paiement : " +
          (err instanceof Error ? err.message : "erreur inconnue")
      );
      setLoadingTier(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white antialiased relative overflow-hidden">
      {/* Ambient gradient */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(214,185,110,0.10) 0%, rgba(138,92,255,0.05) 35%, transparent 65%), radial-gradient(ellipse 60% 40% at 50% 110%, rgba(79,125,255,0.12) 0%, transparent 60%)",
        }}
      />

      {/* Nav */}
      <nav className="relative z-20 px-8 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3" aria-label="Vertxia home">
          <div
            className="w-8 h-8 rounded-lg grid place-items-center text-black font-black text-[13px]"
            style={{
              background:
                "linear-gradient(135deg, #FFC533 0%, #FF7A3D 40%, #FF5A8A 100%)",
            }}
          >
            V
          </div>
          <span className="text-[14px] font-semibold tracking-tight">
            Vertxia
          </span>
        </Link>
        <Link
          href="/app"
          className="text-[13px] text-white/65 hover:text-white transition-colors"
        >
          Studio →
        </Link>
      </nav>

      {/* Header */}
      <header className="relative z-10 px-8 pt-12 pb-8 text-center max-w-3xl mx-auto">
        <motion.p
          {...ANIM}
          className="text-[11px] tracking-[0.22em] uppercase font-medium text-[#D6B96E]/85 mb-4"
        >
          Pricing
        </motion.p>
        <motion.h1
          {...ANIM}
          transition={{ ...ANIM.transition, delay: 0.05 }}
          className="text-[44px] md:text-[60px] font-semibold tracking-[-0.025em] leading-[1.05]"
          style={{
            fontFamily: "Inter, -apple-system, sans-serif",
            textShadow: "0 4px 32px rgba(0,0,0,0.5)",
          }}
        >
          Un studio cinematic
          <br />
          <span style={{ color: "#D6B96E" }}>par abonnement.</span>
        </motion.h1>
        <motion.p
          {...ANIM}
          transition={{ ...ANIM.transition, delay: 0.1 }}
          className="mt-6 text-[15px] text-white/60 leading-relaxed max-w-xl mx-auto"
        >
          Tarifs HT. Paiement immédiat par CB, résiliable à tout moment.
          Facturation à l'usage au-delà du quota inclus.
        </motion.p>

        {/* Toggle Monthly / Annual */}
        <motion.div
          {...ANIM}
          transition={{ ...ANIM.transition, delay: 0.15 }}
          className="mt-10 inline-flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/[0.08]"
        >
          {(["monthly", "annual"] as const).map((p) => {
            const isActive = period === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={[
                  "relative px-5 py-2 rounded-lg text-[13px] transition-all",
                  isActive
                    ? "bg-white text-black font-medium"
                    : "text-white/65 hover:text-white",
                ].join(" ")}
              >
                {p === "monthly" ? "Mensuel" : "Annuel"}
                {p === "annual" && (
                  <span
                    className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-semibold tracking-[0.1em] uppercase"
                    style={{
                      background: isActive
                        ? "rgba(214,185,110,0.20)"
                        : "rgba(214,185,110,0.15)",
                      color: "#D6B96E",
                    }}
                  >
                    -17%
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>
      </header>

      {/* Pricing cards */}
      <section className="relative z-10 px-6 pb-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PRICING_TIERS.map((tier, i) => (
            <PricingCard
              key={tier.id}
              tier={tier}
              period={period}
              loading={loadingTier === tier.id}
              onCheckout={() => handleCheckout(tier)}
              animDelay={0.25 + i * 0.08}
            />
          ))}
        </div>

        {/* Enterprise hint */}
        <motion.div
          {...ANIM}
          transition={{ ...ANIM.transition, delay: 0.45 }}
          className="mt-10 text-center"
        >
          <p className="text-[13px] text-white/45">
            Volume supérieur, SSO, API custom ou SLA dédié ?{" "}
            <a
              href="mailto:emilien@vertxia.com?subject=Vertxia%20Enterprise"
              className="text-white/85 underline underline-offset-2 decoration-white/30 hover:decoration-white"
            >
              Contacte-nous pour un plan Enterprise
            </a>
            .
          </p>
        </motion.div>
      </section>

      {/* Trust signals + FAQ ultra-condensée */}
      <section className="relative z-10 px-8 pb-20 max-w-3xl mx-auto">
        <motion.div
          {...ANIM}
          transition={{ ...ANIM.transition, delay: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 pt-12 border-t border-white/[0.06]"
        >
          {[
            { label: "Accès", value: "Immédiat" },
            { label: "Résiliable", value: "À tout moment" },
            { label: "Paiement", value: "Stripe sécurisé" },
            { label: "Support", value: "Email réactif" },
          ].map((t) => (
            <div key={t.label} className="text-center">
              <p className="text-[10px] tracking-[0.18em] uppercase text-white/35 mb-1.5">
                {t.label}
              </p>
              <p className="text-[13px] text-white font-medium">{t.value}</p>
            </div>
          ))}
        </motion.div>
      </section>
    </div>
  );
}

/* =========================================================
 *  Pricing card
 * ========================================================= */

function PricingCard({
  tier,
  period,
  loading,
  onCheckout,
  animDelay,
}: {
  tier: PricingTier;
  period: PricingPeriod;
  loading: boolean;
  onCheckout: () => void;
  animDelay: number;
}) {
  const monthly = monthlyEquivalent(tier, period);
  const isHighlighted = tier.highlighted === true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.6,
        delay: animDelay,
        ease: [0.22, 1, 0.36, 1] as const,
      }}
      className="relative rounded-2xl p-7 flex flex-col"
      style={{
        background: isHighlighted ? "rgba(214,185,110,0.04)" : "rgba(255,255,255,0.02)",
        border: isHighlighted
          ? "1px solid rgba(214,185,110,0.25)"
          : "1px solid rgba(255,255,255,0.08)",
        boxShadow: isHighlighted
          ? "0 20px 60px rgba(214,185,110,0.06), inset 0 1px 0 rgba(255,255,255,0.06)"
          : "0 12px 40px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* Most popular badge */}
      {isHighlighted && (
        <div
          className="absolute -top-3 right-6 px-3 py-1 rounded-full text-[10px] tracking-[0.18em] uppercase font-semibold flex items-center gap-1.5"
          style={{
            background: "#D6B96E",
            color: "#050505",
          }}
        >
          <IconSparkles size={12} /> Recommandé
        </div>
      )}

      {/* Header */}
      <div>
        <h2
          className="text-[24px] font-semibold tracking-tight"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          {tier.name}
        </h2>
        <p className="mt-1 text-[13px] text-white/55">{tier.tagline}</p>
      </div>

      {/* Price */}
      <div className="mt-6 flex items-baseline gap-2">
        <span
          className="text-[44px] font-bold tracking-[-0.03em] leading-none"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          {monthly}€
        </span>
        <span className="text-[13px] text-white/45">/ mois HT</span>
      </div>
      {period === "annual" && (
        <p className="mt-1.5 text-[11.5px] text-[#D6B96E]/85">
          Facturé {tier.prices.annual.amount}€/an — économie {tier.annualSavingsPct}%
        </p>
      )}
      {period === "monthly" && (
        <p className="mt-1.5 text-[11.5px] text-white/35">
          Sans engagement, résiliable à tout moment
        </p>
      )}

      {/* Description */}
      <p className="mt-5 text-[13px] text-white/65 leading-relaxed">
        {tier.description}
      </p>

      {/* Features */}
      <ul className="mt-6 space-y-2.5 mb-7">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-white/80">
            <span
              className="shrink-0 mt-[6px] w-1 h-1 rounded-full"
              style={{ background: isHighlighted ? "#D6B96E" : "rgba(255,255,255,0.4)" }}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        type="button"
        onClick={onCheckout}
        disabled={loading}
        className={[
          "mt-auto inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl text-[13.5px] font-medium transition-all",
          isHighlighted
            ? "bg-white text-black hover:scale-[1.02] active:scale-[0.98]"
            : "bg-white/[0.06] border border-white/[0.10] text-white hover:bg-white/[0.10]",
          loading ? "opacity-60 cursor-wait" : "",
        ].join(" ")}
      >
        {loading ? (
          <span className="flex items-center gap-1.5">
            <span className="vsig-dot vsig-dot-1" />
            <span className="vsig-dot vsig-dot-2" />
            <span className="vsig-dot vsig-dot-3" />
          </span>
        ) : (
          <>
            {tier.ctaLabel} <IconArrowRight size={13} />
          </>
        )}
      </button>

      <p className="mt-3 text-center text-[11px] text-white/35">
        Paiement immédiat · Résiliable à tout moment · Sans engagement
      </p>

      <style>{`
        @keyframes vsig-dot-pulse {
          0%, 100% { opacity: 0.25; transform: scale(0.8); }
          50%      { opacity: 1;    transform: scale(1.1); }
        }
        .vsig-dot {
          width: 5px; height: 5px; border-radius: 9999px;
          background: currentColor;
          display: inline-block;
        }
        .vsig-dot-1 { animation: vsig-dot-pulse 1.1s ease-in-out infinite; }
        .vsig-dot-2 { animation: vsig-dot-pulse 1.1s ease-in-out 0.15s infinite; }
        .vsig-dot-3 { animation: vsig-dot-pulse 1.1s ease-in-out 0.30s infinite; }
      `}</style>
    </motion.div>
  );
}
