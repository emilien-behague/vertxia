/**
 * Migration V0.8+ : table stripe_events_seen pour idempotence webhook.
 *
 * Run : node scripts/migrate-db-v2.mjs
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
const sql = postgres(env.DATABASE_URL, { prepare: false });

async function main() {
  console.log("Migration V0.8+ : stripe_events_seen ...");
  await sql`
    CREATE TABLE IF NOT EXISTS stripe_events_seen (
      event_id    TEXT PRIMARY KEY,
      event_type  TEXT NOT NULL,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  // TTL : on garde 30 jours (Stripe retry 3 jours max)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_stripe_events_processed
    ON stripe_events_seen(processed_at);
  `;
  console.log("OK");
  await sql.end();
}

main().catch(async (err) => {
  console.error("Erreur :", err.message);
  await sql.end();
  process.exit(1);
});
