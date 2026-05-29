/**
 * Ajoute les valeurs par defaut dev dans .env.local pour les vars
 * de config (APP_URL, etc.) si elles n'y sont pas deja.
 *
 * Idempotent. NE TOUCHE PAS aux secrets.
 *
 * Run : node scripts/ensure-env-defaults.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve(process.cwd(), ".env.local");

if (!existsSync(path)) {
  console.error(".env.local introuvable");
  process.exit(1);
}

const content = readFileSync(path, "utf-8");

const defaults = [
  { key: "APP_URL", value: "http://localhost:3000" },
  // AUTH_EMAIL_FROM laisse vide en dev (lib/env.ts fallback sur onboarding@resend.dev)
];

let added = [];
let newContent = content;
for (const { key, value } of defaults) {
  const regex = new RegExp(`^${key}=`, "m");
  if (!regex.test(newContent)) {
    const suffix = newContent.endsWith("\n") ? "" : "\n";
    newContent = `${newContent}${suffix}${key}=${value}\n`;
    added.push(key);
  }
}

if (added.length === 0) {
  console.log("Tous les defauts sont deja en place.");
} else {
  writeFileSync(path, newContent, "utf-8");
  console.log(`Ajoute : ${added.join(", ")}`);
}
