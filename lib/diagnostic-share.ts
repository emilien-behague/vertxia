// Partage d'un diagnostic IA via Web Share API niveau 2 (avec image jointe).
//
// Stratégie en cascade :
//   1. Tenter navigator.share avec files: [image] + text (iOS Safari + Chrome
//      Android récents). C'est ce qui ouvre la sheet native iMessage / WhatsApp
//      / Mail avec la PHOTO + le texte pré-rempli.
//   2. Si canShare({ files }) renvoie false (vieux navigateurs, desktop sans
//      Web Share Level 2) → fallback navigator.share avec text seul.
//   3. Si navigator.share absent (Firefox desktop, etc.) → clipboard.writeText.

import {
  GRAVITE_LABELS,
  DELAI_LABELS,
  type DiagnosticResult,
} from "./vision-diagnostic";

/** Convertit un data URL base64 en File partageable. */
function dataUrlToFile(dataUrl: string, filename: string): File | null {
  try {
    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match) return null;
    const mime = match[1];
    const b64 = match[2];
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  } catch {
    return null;
  }
}

/** Sérialise le diagnostic en texte propre pour le partage / le presse-papier. */
export function formatDiagnosticForShare(r: DiagnosticResult): string {
  const lines: string[] = [];
  lines.push("DIAGNOSTIC VERTXIA");
  if (r.composantIdentifie) lines.push(`Composant : ${r.composantIdentifie}`);
  if (r.defautsDetectes.length > 0) {
    lines.push("");
    lines.push("Défauts détectés :");
    for (const d of r.defautsDetectes) {
      lines.push(`• [${GRAVITE_LABELS[d.gravite]}] ${d.nom} — ${d.description}`);
    }
  } else {
    lines.push("État apparent nominal.");
  }
  if (r.causeProbable) {
    lines.push("");
    lines.push(`Cause probable : ${r.causeProbable}`);
  }
  if (r.actionRecommandee) {
    lines.push(`Action : ${r.actionRecommandee}`);
  }
  lines.push(`Délai : ${DELAI_LABELS[r.delaiIntervention]}`);
  if (r.devisEstimeMin !== null && r.devisEstimeMax !== null) {
    lines.push(`Devis estimé : ${r.devisEstimeMin}–${r.devisEstimeMax} € HT`);
  }
  lines.push("");
  lines.push(`Diagnostic généré par Vertxia · vertxia.com`);
  return lines.join("\n");
}

export type ShareDiagnosticInput = {
  imageDataUrl: string;
  result: DiagnosticResult;
  /** Suffixe optionnel pour le nom de fichier (ex: date ISO) */
  filenameHint?: string;
};

export type ShareOutcome = "shared_with_image" | "shared_text_only" | "clipboard" | "cancelled" | "failed";

export async function shareDiagnostic(input: ShareDiagnosticInput): Promise<ShareOutcome> {
  const text = formatDiagnosticForShare(input.result);
  const title = "Diagnostic Vertxia";

  const baseName = (input.result.composantIdentifie || "diagnostic")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "diagnostic";
  const suffix = input.filenameHint ? `-${input.filenameHint}` : "";
  const filename = `vertxia-${baseName}${suffix}.jpg`;

  const file = dataUrlToFile(input.imageDataUrl, filename);

  // 1) Web Share API Level 2 (image + texte)
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    file
  ) {
    const payload: ShareData = { title, text, files: [file] };
    const canShareFiles =
      typeof navigator.canShare === "function" ? navigator.canShare(payload) : true;
    if (canShareFiles) {
      try {
        await navigator.share(payload);
        return "shared_with_image";
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return "cancelled";
        // Continue vers fallback texte
      }
    }
  }

  // 2) Web Share texte seul
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text });
      return "shared_text_only";
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return "cancelled";
    }
  }

  // 3) Clipboard fallback
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return "clipboard";
    } catch {
      return "failed";
    }
  }

  return "failed";
}
