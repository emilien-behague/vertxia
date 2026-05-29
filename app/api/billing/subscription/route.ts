/**
 * GET /api/billing/subscription
 *
 * Retourne l'abonnement Stripe actif de l'utilisateur courant (logge).
 *
 * Source de verite : user.stripe_customer_id en DB (lie au checkout).
 *
 * Reponses :
 *  - 200 { subscription: {...}, paymentMethod: {...} }      => abonnement actif
 *  - 200 { subscription: null }                              => log-in mais pas d'abo
 *  - 401 { error: "Connexion requise" }                      => pas log-in
 *  - 500                                                     => erreur Stripe
 */

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getTierByPriceId } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const customerId = user.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ subscription: null }, { status: 200 });
  }

  try {
    const stripe = getStripe();

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      expand: ["data.default_payment_method", "data.items.data.price"],
      limit: 5,
    });

    const sub =
      subs.data.find((s) => s.status === "active" || s.status === "trialing") ||
      subs.data[0];

    if (!sub) {
      return NextResponse.json({ subscription: null }, { status: 200 });
    }

    const item = sub.items.data[0];
    const price = item?.price;
    const priceId = typeof price?.id === "string" ? price.id : null;
    const tierMatch = priceId ? getTierByPriceId(priceId) : null;

    const periodEnd =
      (item as unknown as { current_period_end?: number })
        ?.current_period_end ||
      (sub as unknown as { current_period_end?: number })?.current_period_end ||
      null;

    let pm: Stripe.PaymentMethod | null = null;
    if (sub.default_payment_method && typeof sub.default_payment_method !== "string") {
      pm = sub.default_payment_method;
    } else if (typeof sub.default_payment_method === "string") {
      pm = await stripe.paymentMethods.retrieve(sub.default_payment_method);
    } else {
      const customer = (await stripe.customers.retrieve(customerId)) as Stripe.Customer;
      const cdpm =
        typeof customer.invoice_settings?.default_payment_method === "string"
          ? customer.invoice_settings.default_payment_method
          : customer.invoice_settings?.default_payment_method?.id;
      if (cdpm) pm = await stripe.paymentMethods.retrieve(cdpm);
    }

    return NextResponse.json({
      subscription: {
        id: sub.id,
        status: sub.status,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodEnd: periodEnd,
        trialEnd: sub.trial_end ?? null,
        tier: tierMatch
          ? {
              id: tierMatch.tier.id,
              name: tierMatch.tier.name,
              tagline: tierMatch.tier.tagline,
              features: tierMatch.tier.features,
              period: tierMatch.period,
              amount:
                tierMatch.period === "monthly"
                  ? tierMatch.tier.prices.monthly.amount
                  : tierMatch.tier.prices.annual.amount,
            }
          : null,
        priceId,
        currency: price?.currency || "eur",
        interval: price?.recurring?.interval || null,
      },
      paymentMethod: pm?.card
        ? {
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
          }
        : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    // eslint-disable-next-line no-console
    console.error("[billing/subscription] Stripe error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
