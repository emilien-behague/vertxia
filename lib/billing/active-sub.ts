/**
 * Check si un user a un abonnement Stripe actif.
 *
 * Utilise par les endpoints qui declenchent un cout reel (generate, kling, etc.).
 * Sans abonnement actif → bloque l'action et redirige vers /pricing.
 *
 * Statuts acceptes :
 *  - "active"    : abonnement payant en cours
 *  - "trialing"  : essai gratuit (rare maintenant, on ne cree plus de trial,
 *                  mais on continue d'accepter les essais legacy)
 *
 * Bloque :
 *  - "past_due", "unpaid"   : paiement en echec
 *  - "canceled", "incomplete", "incomplete_expired" : abonnement non-actif
 */

import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getTierByPriceId } from "@/lib/pricing";

export type ActiveSubResult =
  | { active: true; sub: Stripe.Subscription; tierId: "starter" | "studio" | "agency" | null }
  | { active: false; reason: "no_customer_id" | "no_active_sub" | "stripe_error"; detail?: string };

export async function hasActiveSubscription(
  stripeCustomerId: string | null | undefined
): Promise<ActiveSubResult> {
  if (!stripeCustomerId) {
    return { active: false, reason: "no_customer_id" };
  }

  try {
    const stripe = getStripe();
    const subs = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      expand: ["data.items.data.price"],
      limit: 5,
    });

    const sub = subs.data.find(
      (s) => s.status === "active" || s.status === "trialing"
    );

    if (!sub) {
      return { active: false, reason: "no_active_sub" };
    }

    const priceId = sub.items.data[0]?.price?.id || null;
    const tierMatch = priceId ? getTierByPriceId(priceId) : null;

    return {
      active: true,
      sub,
      tierId: tierMatch?.tier.id || null,
    };
  } catch (err) {
    return {
      active: false,
      reason: "stripe_error",
      detail: err instanceof Error ? err.message : "unknown",
    };
  }
}
