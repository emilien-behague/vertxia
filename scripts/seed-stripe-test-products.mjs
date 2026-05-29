/**
 * scripts/seed-stripe-test-products.mjs
 *
 * Cree les 4 produits/prix Vertxia en mode TEST en utilisant STRIPE_SECRET_KEY
 * (qui DOIT etre une cle sk_test_).
 *
 * Output : copie/colle les 4 price_id dans lib/pricing.ts (ou .env.local).
 *
 * Run : node scripts/seed-stripe-test-products.mjs
 */

import Stripe from "stripe";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local manually (pas de dotenv en deps)
function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const content = readFileSync(path, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnvLocal();
const key = env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY absent de .env.local");
  process.exit(1);
}
if (!key.startsWith("sk_test_")) {
  console.error(
    `Cle invalide : doit commencer par sk_test_ (recu : ${key.slice(0, 8)}...)`
  );
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });

async function main() {
  console.log("Creation des produits/prix Vertxia en mode TEST...\n");

  // Studio
  const studio = await stripe.products.create({
    name: "Vertxia Studio",
    description:
      "Pour e-commercants et marques DTC — 10 sites cinematic + 60 videos AI Kling / mois",
    metadata: { vertxia_tier: "studio" },
  });
  console.log(`Studio product : ${studio.id}`);

  const studioMonthly = await stripe.prices.create({
    product: studio.id,
    currency: "eur",
    unit_amount: 14900,
    recurring: { interval: "month" },
    metadata: { vertxia_tier: "studio", vertxia_period: "monthly" },
  });
  console.log(`  Studio monthly  149 EUR : ${studioMonthly.id}`);

  const studioAnnual = await stripe.prices.create({
    product: studio.id,
    currency: "eur",
    unit_amount: 149000,
    recurring: { interval: "year" },
    metadata: { vertxia_tier: "studio", vertxia_period: "annual" },
  });
  console.log(`  Studio annual  1490 EUR : ${studioAnnual.id}`);

  // Agency
  const agency = await stripe.products.create({
    name: "Vertxia Agency",
    description:
      "Pour agences digitales et equipes marketing — 40 sites + 250 videos AI Kling, white-label, 5 users",
    metadata: { vertxia_tier: "agency" },
  });
  console.log(`\nAgency product : ${agency.id}`);

  const agencyMonthly = await stripe.prices.create({
    product: agency.id,
    currency: "eur",
    unit_amount: 49900,
    recurring: { interval: "month" },
    metadata: { vertxia_tier: "agency", vertxia_period: "monthly" },
  });
  console.log(`  Agency monthly  499 EUR : ${agencyMonthly.id}`);

  const agencyAnnual = await stripe.prices.create({
    product: agency.id,
    currency: "eur",
    unit_amount: 499000,
    recurring: { interval: "year" },
    metadata: { vertxia_tier: "agency", vertxia_period: "annual" },
  });
  console.log(`  Agency annual  4990 EUR : ${agencyAnnual.id}`);

  console.log("\n========================================");
  console.log("COPIE CES 4 LIGNES POUR MAJ lib/pricing.ts :");
  console.log("========================================");
  console.log(`STUDIO_MONTHLY_ID = "${studioMonthly.id}"`);
  console.log(`STUDIO_ANNUAL_ID  = "${studioAnnual.id}"`);
  console.log(`AGENCY_MONTHLY_ID = "${agencyMonthly.id}"`);
  console.log(`AGENCY_ANNUAL_ID  = "${agencyAnnual.id}"`);
  console.log("========================================");
}

main().catch((err) => {
  console.error("Erreur :", err.message);
  process.exit(1);
});
