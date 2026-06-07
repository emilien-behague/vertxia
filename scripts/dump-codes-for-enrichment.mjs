// Dump compact des codes existants par marque, format JSON pret a passer aux
// agents d'enrichissement modeles[].
//
// Usage :
//   node scripts/dump-codes-for-enrichment.mjs > /tmp/codes-by-marque.json

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const databasePath = resolve(process.cwd(), "lib/codes-erreur/database.ts");
const txt = readFileSync(databasePath, "utf8");

// Parse les blocs { marque: "X", code: "Y", libelle: "...", ..., systemes: [...] (optional), ... }
// Strategy : split sur les debuts de bloc puis parse champ par champ via regex.

// Capture marque, code, libelle, et systemes[] si present.
// Multiline mode car les blocs s'etalent sur 15+ lignes.
const BLOCK_RE = /marque:\s*"([^"]+)",\s*\n?\s*code:\s*"([^"]+)",\s*\n?\s*libelle:\s*"([^"]+)"/g;

const byMarque = {};

let m;
while ((m = BLOCK_RE.exec(txt)) !== null) {
  const marque = m[1];
  const code = m[2];
  const libelle = m[3];
  if (!byMarque[marque]) byMarque[marque] = [];
  byMarque[marque].push({ code, libelle });
}

// Stats sur stderr
console.error(`=== STATS ===`);
const totalCodes = Object.values(byMarque).reduce((s, arr) => s + arr.length, 0);
console.error(`Marques : ${Object.keys(byMarque).length}`);
console.error(`Codes total : ${totalCodes}`);
for (const [marque, codes] of Object.entries(byMarque)) {
  console.error(`  ${marque.padEnd(20)} ${codes.length}`);
}

// Output JSON sur stdout
console.log(JSON.stringify(byMarque, null, 2));
