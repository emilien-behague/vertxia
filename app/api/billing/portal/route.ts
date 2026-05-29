/**
 * POST /api/billing/portal
 *
 * Cree une session Stripe Customer Portal pour gerer abonnement / paiement / factures.
 * Stripe gere TOUTE la UI billing pro (changer plan, annuler, CB, factures PDF, etc.)
 *
 * Pre-requis cote Stripe Dashboard :
 *  Test : https://dashboard.stripe.com/test/settings/billing/portal
 *  Live : https://dashboard.stripe.com/settings/billing/portal
 *
 * Auth : requiert une session utilisateur + un stripe_customer_id lie a l'user.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/session";
import { checkOrigin } from "@/lib/origin-check";
import { appUrl } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // [SECURITY M3] CSRF defense-in-depth
  const oc = checkOrigin(req);
  if (!oc.ok) {
    return NextResponse.json({ error: "Origin invalide" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }
  if (!user.stripe_customer_id) {
    return NextResponse.json(
      { error: "Aucun abonnement actif a gerer" },
      { status: 404 }
    );
  }

  // [SECURITY M5] Rate limit
  const limit = checkRateLimit(`user:${user.id}`, "billing-portal", {
    max: 10,
    windowMs: 60 * 60_000,
  });
  if (limit.blocked) {
    return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 });
  }

  // [SECURITY L2] APP_URL pin (pas de fallback Host header)
  const origin = appUrl();

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${origin}/app/settings`,
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
    console.error("[billing/portal] Stripe error:", msg);
    return NextResponse.json(
      { error: `Customer Portal failed: ${msg}` },
      { status: 500 }
    );
  }
}
