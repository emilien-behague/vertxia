/**
 * Migration DB Vertxia V0.8 — tables users + magic_links.
 *
 * Idempotent : utilise CREATE TABLE IF NOT EXISTS et ignore les recreations.
 *
 * Run : node scripts/migrate-db.mjs
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

const sql = postgres(env.DATABASE_URL, { prepare: false });

async function main() {
  console.log("Migration Vertxia V0.8...\n");

  console.log("1. Table users...");
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email           TEXT NOT NULL UNIQUE,
      stripe_customer_id TEXT UNIQUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at   TIMESTAMPTZ
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);`;
  console.log("   OK");

  console.log("2. Table magic_links...");
  await sql`
    CREATE TABLE IF NOT EXISTS magic_links (
      id          BIGSERIAL PRIMARY KEY,
      email       TEXT NOT NULL,
      token_hash  TEXT NOT NULL UNIQUE,
      expires_at  TIMESTAMPTZ NOT NULL,
      used_at     TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_magic_links_token_hash ON magic_links(token_hash);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(email);`;
  console.log("   OK");

  console.log("\nMigration terminee.");
  await sql.end();
}

main().catch(async (err) => {
  console.error("Erreur migration :", err.message);
  await sql.end();
  process.exit(1);
});
