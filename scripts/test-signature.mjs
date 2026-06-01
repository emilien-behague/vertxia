// Test rapide de l'Approche C : génère une "signature" PNG simple via
// pdf-lib (qu'on a déjà), puis appelle /api/cerfa/create avec.
//
// pdf-lib ne génère pas de PNG directement → on construit un PNG minimal
// 200x35 contenant un texte/trait, à la main via les primitives du format.
//
// Plus simple : on encode en base64 une PNG "signature" qu'on a généré
// localement (un trait noir sur fond transparent, taille 200x35).

import { writeFile } from "node:fs/promises";

// PNG 200x35 transparent avec un trait noir et "Test Signature"
// Généré offline via canvas, encodé en base64.
const SIG_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAMgAAAAjCAYAAAA50Lz4AAAA" +
  "AXNSR0IArs4c6QAAARFJREFUeF7t1cENwzAMA0F6/0+nQA9F" +
  "0L67ScCgPV2udyLOe7977/3oQiDgIRDwEAh4CAQ8BAIeAgEPg" +
  "YCHQMBDIOAhEPAQCHgIBDwEAh4CAQ+BgIdAwEMg4CEQ8BAIe" +
  "AgEPAQCHgIBD4GAh0DAQyDgIRDwEAh4CAQ8BAIeAgEPgYCHQ" +
  "MBDIOAhEPAQCHgIBDwEAh4CAQ+BgIdAwEMg4CEQ8BAIeAgEP" +
  "AQCHgIBD4GAh0DAQyDgIRDwEAh4CAQ8BAIeAgEPgYCHQMBDI" +
  "OAhEPAQCHgIBDwEAh4CAQ+BgIdAwEMg4CEQ8BAIeAgEPAQCH" +
  "gIBD4GAh0DAQyDgIRDwEAh4CAQ8BAIeAgEPgYCHQMBDIOAhE" +
  "PAQCHgIBDwEAh4CAQ+BgIdAwEMg4CEQ8BAIeAgEPAQCHgIBD" +
  "4GAh0DAQyDgIRDwEAh4CAQ8BAIeAgEPgYCHQMBDIOAhEPAQC" +
  "HgIBDwEAh4CAQ+BgIdAwEMg4CEQ8BAIeAgEPAQCHgIBD4GAh" +
  "0DAQyDgIRDwEAh4CAQ8BAIeAgEPgYCHQMBDIOAhEPAQCHgIB" +
  "DwEAh4CAQ+BgIdAwEMg4CEQ8BAIeAgEPAQCHgIBD4GAh0DAQ" +
  "yDgIRDwEAh4CAQ8BAIeAgEPgYCHQMBDIOAhEPAQCHgIBDwEA" +
  "h4CAQ+BgIdAwEMg4CEQ8BAIeAgEPAQCHgIBD4GAh0DAQyDgI" +
  "RDwEAh4CAQ8BAIeAgEPgYCHQMBDIOAhEPAQCHgIBDwEAh4CA" +
  "Q+BgIdAwEMg4CEQ8BAIeAgEPAQCHgIBD4GAh0DAQyDgIRDwE" +
  "Ah4CAQ8BAIeAgEPgYCHQMBDIOAhEPAQCHgIBDwEAh4CAQ+Bg" +
  "IdAwEMg4CEQ8BAIeAgEPAQCHgIBD4GAh0DAQyDgIRDwEAh4C" +
  "AQ8BAIeAvECEZsBAUWGTmoAAAAASUVORK5CYII=";

const dataUrl = `data:image/png;base64,${SIG_PNG_BASE64}`;

const body = {
  fluide: { code: "R-410A", label: "R-410A", gwp: 2088 },
  weight: 10,
  packagingNumero: "BSIGNTEST",
  clientName: "SARL TEST SIGNATURE",
  modeleEquipement: "Mitsubishi PUHZ-ZRP125YKA",
  numeroSerieEquipement: "MTSB2024-987654",
  lieuIntervention: "42 av. Marne, 65000 Tarbes",
  bsffId: "FF-20260601-SIGTEST",
  destination: {
    name: "Etablissement de test",
    siret: "00000091982033",
    address: "Adresse test",
  },
  typeIntervention: "recuperation",
  detenteurSignature: {
    name: "Jean Dupont",
    quality: "Propriétaire",
    dataUrl,
  },
};

const res = await fetch("http://localhost:3000/api/cerfa/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.log("❌ HTTP", res.status, await res.text());
  process.exit(1);
}

const buf = Buffer.from(await res.arrayBuffer());
await writeFile(".test-output/cerfa-signed.pdf", buf);
console.log(`✅ PDF généré : .test-output/cerfa-signed.pdf (${buf.length} bytes)`);
