import { PDFDocument } from "pdf-lib";
import { readFileSync } from "node:fs";

const bytes = readFileSync(
  new URL("../public/cerfa_15497_04_template.pdf", import.meta.url)
);
const pdf = await PDFDocument.load(bytes);
const form = pdf.getForm();
const fields = form.getFields();

console.log("=== CERFA 15497*04 INSPECTION ===");
console.log(`Pages: ${pdf.getPageCount()}`);
const page = pdf.getPage(0);
console.log(`Page 1 size: ${page.getWidth()} x ${page.getHeight()}`);
console.log(`AcroForm fields detected: ${fields.length}`);
console.log("");

if (fields.length === 0) {
  console.log("⚠️  Aucun champ AcroForm — il faudra overlay aux coordonnées x/y.");
} else {
  console.log("✅ Champs AcroForm trouvés — on peut remplir par nom :");
  for (const f of fields) {
    const name = f.getName();
    const type = f.constructor.name;
    console.log(`  [${type.padEnd(15)}] ${name}`);
  }
}
