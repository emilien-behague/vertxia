/**
 * Stripe server-side client singleton.
 *
 * NE PAS importer dans du code client — secret key strictement server-only.
 * Routes API uniquement (app/api/...).
 *
 * Configuration :
 *  - STRIPE_SECRET_KEY (sk_test_... ou sk_live_...) dans .env.local
 *  - API version pinning pour eviter les changements imprevus de schema
 */

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY absent de .env.local — Settings > Developers > API keys"
    );
  }
  _stripe = new Stripe(key, {
    apiVersion: "2026-05-27.dahlia",
    typescript: true,
    appInfo: { name: "Vertxia Lite", version: "0.7.0" },
  });
  return _stripe;
}
