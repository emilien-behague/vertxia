/**
 * Genere AUTH_COOKIE_SECRET (64 bytes hex aleatoires) et l'ajoute a .env.local
 * uniquement s'il n'existe pas deja. Idempotent.
 *
 * Run : node scripts/ensure-auth-secret.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

const path = resolve(process.cwd(), ".env.local");

if (!existsSync(path)) {
  console.error(".env.local introuvable");
  process.exit(1);
}

const content = readFileSync(path, "utf-8");

if (/^AUTH_COOKIE_SECRET=/m.test(content)) {
  console.log("AUTH_COOKIE_SECRET deja present, rien a faire.");
  process.exit(0);
}

const secret = randomBytes(64).toString("hex");
const suffix = content.endsWith("\n") ? "" : "\n";
writeFileSync(path, `${content}${suffix}AUTH_COOKIE_SECRET=${secret}\n`, "utf-8");

console.log("AUTH_COOKIE_SECRET ajoute (64 bytes hex aleatoires).");
