/**
 * Reset stripe_customer_id sur tous les users (ou un email cible).
 *
 * A utiliser quand on bascule TEST -> LIVE : les customers test
 * (cus_*) n'existent pas en live, on les vire pour que le prochain
 * checkout LIVE en cree de nouveaux.
 *
 * Run :
 *   node scripts/reset-stripe-customer-ids.mjs                    # tous les users
 *   node scripts/reset-stripe-customer-ids.mjs <email>            # un user precis
 */

import postgres from "postgres";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL absent de .env.local");
  process.exit(1);
}

const targetEmail = process.argv[2];
const sql = postgres(env.DATABASE_URL, { prepare: false });

async function main() {
  console.log("Avant reset :");
  const before = targetEmail
    ? await sql`SELECT id, email, stripe_customer_id FROM users WHERE email = ${targetEmail}`
    : await sql`SELECT id, email, stripe_customer_id FROM users WHERE stripe_customer_id IS NOT NULL`;
  for (const u of before) {
    console.log(`  - ${u.email} -> ${u.stripe_customer_id || "(vide)"}`);
  }
  if (before.length === 0) {
    console.log("  (aucun user a reset)");
    await sql.end();
    return;
  }

  const updated = targetEmail
    ? await sql`UPDATE users SET stripe_customer_id = NULL WHERE email = ${targetEmail} RETURNING id, email`
    : await sql`UPDATE users SET stripe_customer_id = NULL WHERE stripe_customer_id IS NOT NULL RETURNING id, email`;

  console.log(`\nReset effectue sur ${updated.length} user(s).`);
  await sql.end();
}

main().catch(async (err) => {
  console.error("Erreur :", err.message);
  await sql.end();
  process.exit(1);
});
