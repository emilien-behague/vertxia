/**
 * POST /api/checkout/session
 *
 * Cree une Stripe Checkout Session en mode subscription pour un tier Vertxia.
 * REQUIERT une session authentifiee (sinon 401).
 *
 * Body : { priceId: string }
 * Retourne : { url: string } (URL Stripe vers laquelle rediriger)
 *
 * Securite :
 *  - priceId doit etre un des 6 tarifs declares (Starter|Studio|Agency × monthly|annual)
 *  - L'email du checkout est celui du user logge (pas de double saisie)
 *  - client_reference_id = user.id (pour que le webhook puisse lier la sub au user)
 *
 * Config :
 *  - Paiement immediat (TRIAL_PERIOD_DAYS = 0). Si > 0, applique un trial.
 *  - tax_id_collection actif (reverse charge B2B EU si VAT ID)
 *  - automatic_tax actif (Stripe Tax gere les TVA EU)
 *
 * Note : pas de rate limit dans cette V0 — a ajouter quand on aura > 10 visiteurs/min.
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getTierByPriceId, TRIAL_PERIOD_DAYS } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/session";
import { checkOrigin } from "@/lib/origin-check";
import { appUrl } from "@/lib/env";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // [SECURITY M3] CSRF defense-in-depth
  const oc = checkOrigin(req);
  if (!oc.ok) {
    // eslint-disable-next-line no-console
    console.warn("[checkout/session] Origin check failed:", oc.reason);
    return NextResponse.json({ error: "Origin invalide" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Connexion requise", redirectTo: "/login?from=/pricing" },
      { status: 401 }
    );
  }

  // [SECURITY M5] Rate limit (anti enum / spam Stripe API)
  const limit = checkRateLimit(`user:${user.id}`, "checkout-session", {
    max: 10,
    windowMs: 60 * 60_000,
  });
  if (limit.blocked) {
    return NextResponse.json(
      { error: "Trop de tentatives", retryAfter: limit.retryAfterSec },
      { status: 429 }
    );
  }
  const ipLimit = checkRateLimit(getClientIp(req), "checkout-session-ip", {
    max: 30,
    windowMs: 60 * 60_000,
  });
  if (ipLimit.blocked) {
    return NextResponse.json({ error: "Rate limit IP" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("priceId" in body)) {
    return NextResponse.json(
      { error: "Body doit contenir { priceId }" },
      { status: 400 }
    );
  }

  const priceId = String((body as { priceId: unknown }).priceId || "").trim();
  if (!priceId || !priceId.startsWith("price_")) {
    return NextResponse.json({ error: "priceId invalide" }, { status: 400 });
  }

  const tier = getTierByPriceId(priceId);
  if (!tier) {
    return NextResponse.json(
      { error: "priceId inconnu (pas dans la liste des tiers Vertxia)" },
      { status: 400 }
    );
  }

  // [SECURITY L2] APP_URL pin (pas de fallback Host header)
  const origin = appUrl();

  try {
    const stripe = getStripe();

    // Si le user a deja un Stripe customer_id, on le reutilise pour eviter
    // les doublons cote Stripe.
    const reuseCustomerArgs = user.stripe_customer_id
      ? { customer: user.stripe_customer_id }
      : { customer_email: user.email };

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        vertxia_tier: tier.tier.id,
        vertxia_period: tier.period,
        vertxia_user_id: user.id,
      },
    };
    if (TRIAL_PERIOD_DAYS > 0) {
      subscriptionData.trial_period_days = TRIAL_PERIOD_DAYS;
      subscriptionData.trial_settings = {
        end_behavior: { missing_payment_method: "pause" },
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: subscriptionData,
      ...reuseCustomerArgs,
      client_reference_id: user.id,
      payment_method_collection: "always",
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: true },
      success_url: `${origin}/api/checkout/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?canceled=1`,
      metadata: {
        vertxia_tier: tier.tier.id,
        vertxia_period: tier.period,
        vertxia_user_id: user.id,
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe n'a pas retourne d'URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    // eslint-disable-next-line no-console
    console.error("[checkout/session] Stripe error:", msg);
    return NextResponse.json(
      { error: `Stripe checkout failed: ${msg}` },
      { status: 500 }
    );
  }
}
