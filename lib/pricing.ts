/**
 * Vertxia Lite — pricing configuration centralisee.
 *
 * Les price_id Stripe sont publics (visibles dans le DOM checkout), donc OK de les
 * stocker en config. On les expose via env vars pour pouvoir staging/prod separe
 * facilement (NEXT_PUBLIC_STRIPE_PRICE_*).
 *
 * Source des price_id : Stripe Dashboard > Catalogue de produits > [Studio|Agency] > Tarifs
 *
 * Trial : 7 jours, CB obligatoire au checkout (mode CARD), auto-converge en payant.
 */

export type PricingPeriod = "monthly" | "annual";

export type PricingTier = {
  id: "studio" | "agency";
  name: string;
  tagline: string;
  description: string;
  /** Prix HT affiches sur la pricing page. */
  prices: {
    monthly: { amount: number; priceId: string };
    annual: { amount: number; priceId: string };
  };
  /** Discount annual vs monthly × 12 (calcule auto pour le badge). */
  annualSavingsPct: number;
  /** Caracteristiques affichees dans la card. */
  features: string[];
  /** CTA label du bouton. */
  ctaLabel: string;
  /** Si true, affiche un badge "Most popular". */
  highlighted?: boolean;
};

// Fallbacks = price_id TEST MODE (cree par scripts/seed-stripe-test-products.mjs).
// En prod, override avec les vrais price_id live via NEXT_PUBLIC_STRIPE_PRICE_*.
// Live IDs (a injecter en prod) :
//   Studio monthly  : price_1TcPbPBnV2SwnvVRn9ZEyP5g
//   Studio annual   : price_1TcPckBnV2SwnvVRH8wRQj0t
//   Agency monthly  : price_1TcPe2BnV2SwnvVRPTmq4qNE
//   Agency annual   : price_1TcPegBnV2SwnvVRKRzBHYJD
const STUDIO_MONTHLY_ID =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_STUDIO_MONTHLY ||
  "price_1TcQFZBnV2SwnvVRlTwQ9Yj9";
const STUDIO_ANNUAL_ID =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_STUDIO_ANNUAL ||
  "price_1TcQFZBnV2SwnvVRxYuBRR0d";
const AGENCY_MONTHLY_ID =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY_MONTHLY ||
  "price_1TcQFaBnV2SwnvVRBPaNaY5x";
const AGENCY_ANNUAL_ID =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY_ANNUAL ||
  "price_1TcQFaBnV2SwnvVRo6bDnHQO";

/* =========================================================
 *  Tiers config
 * ========================================================= */

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "studio",
    name: "Studio",
    tagline: "Pour e-commerçants et marques DTC",
    description:
      "Tout ce dont tu as besoin pour générer des sites cinematic et des vidéos AI à partir de tes URLs Shopify.",
    prices: {
      monthly: { amount: 149, priceId: STUDIO_MONTHLY_ID },
      annual: { amount: 1490, priceId: STUDIO_ANNUAL_ID },
    },
    annualSavingsPct: Math.round(((149 * 12 - 1490) / (149 * 12)) * 100),
    features: [
      "10 sites cinematic / mois",
      "60 vidéos AI Kling / mois",
      "5 templates × 5 signatures = 25 looks",
      "Direction artistique IA Claude V0.1",
      "URL unique partageable",
      "Génération en ~3 min",
      "Support par email",
    ],
    ctaLabel: "Commencer l'essai",
    highlighted: true,
  },
  {
    id: "agency",
    name: "Agency",
    tagline: "Pour agences digitales et équipes marketing",
    description:
      "Volume élevé, white-label, plusieurs utilisateurs. Conçu pour les agences qui produisent pour leurs clients.",
    prices: {
      monthly: { amount: 499, priceId: AGENCY_MONTHLY_ID },
      annual: { amount: 4990, priceId: AGENCY_ANNUAL_ID },
    },
    annualSavingsPct: Math.round(((499 * 12 - 4990) / (499 * 12)) * 100),
    features: [
      "40 sites cinematic / mois",
      "250 vidéos AI Kling / mois",
      "White-label complet",
      "5 utilisateurs inclus",
      "Domaine personnalisé",
      "Branding entièrement personnalisable",
      "Support prioritaire",
    ],
    ctaLabel: "Commencer l'essai",
  },
];

/* =========================================================
 *  Helpers
 * ========================================================= */

/** Resolve un price_id depuis tierId + period. */
export function getPriceId(
  tierId: PricingTier["id"],
  period: PricingPeriod
): string | null {
  const tier = PRICING_TIERS.find((t) => t.id === tierId);
  if (!tier) return null;
  return tier.prices[period].priceId;
}

/** Resolve un tier depuis un price_id (utile cote webhook). */
export function getTierByPriceId(priceId: string): {
  tier: PricingTier;
  period: PricingPeriod;
} | null {
  for (const tier of PRICING_TIERS) {
    if (tier.prices.monthly.priceId === priceId) {
      return { tier, period: "monthly" };
    }
    if (tier.prices.annual.priceId === priceId) {
      return { tier, period: "annual" };
    }
  }
  return null;
}

/** Calcul du prix mensuel-equivalent affiche sur la card en mode Annual. */
export function monthlyEquivalent(
  tier: PricingTier,
  period: PricingPeriod
): number {
  if (period === "monthly") return tier.prices.monthly.amount;
  return Math.round(tier.prices.annual.amount / 12);
}

/* =========================================================
 *  Trial config
 * ========================================================= */

export const TRIAL_PERIOD_DAYS = 7;
