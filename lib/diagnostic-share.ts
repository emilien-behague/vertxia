// Partage d'un diagnostic IA — multi-canal.
//
// 3 chemins explicites :
//   - WhatsApp : ouvre wa.me/?text=... avec texte pre-rempli. La photo doit
//     etre attachee manuellement (limitation URL scheme WhatsApp).
//   - Email : ouvre mailto:?subject=...&body=... avec sujet + corps pre-remplis.
//     Idem pour la photo : pas d'attachement via mailto: (RFC 2368).
//   - Partage natif (Web Share API L2) : ouvre la sheet iOS/Android avec la
//     PHOTO + texte attaches. Marche sur mobile, pas sur desktop.
//
// Helper downloadDiagnosticImage : declenche le telechargement de la photo
// dans Downloads pour que l'utilisateur l'attache facilement apres avoir
// clique WhatsApp ou Email.

import type { Profil } from "./profil";
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

/** Construit le texte enrichi (multi-lignes) du diagnostic pour envoi
 *  WhatsApp ou Email. Inclut signature avec raison sociale + n° attestation
 *  du technicien si fournis dans le profil. */
function formatDiagnosticForMessage(r: DiagnosticResult, profil?: Profil): string {
  const lines: string[] = [];
  lines.push("Diagnostic technique");
  lines.push("");
  if (r.composantIdentifie) {
    lines.push(`Composant : ${r.composantIdentifie}`);
    lines.push("");
  }
  if (r.defautsDetectes.length > 0) {
    lines.push(`Défauts détectés (${r.defautsDetectes.length}) :`);
    for (const d of r.defautsDetectes) {
      lines.push(`• ${d.nom} [${GRAVITE_LABELS[d.gravite]}]`);
      if (d.description) lines.push(`  ${d.description}`);
    }
    lines.push("");
  } else {
    lines.push("État apparent nominal — aucun défaut visible détecté.");
    lines.push("");
  }
  if (r.causeProbable) {
    lines.push(`Cause probable : ${r.causeProbable}`);
  }
  if (r.actionRecommandee) {
    lines.push(`Action recommandée : ${r.actionRecommandee}`);
  }
  lines.push(`Délai d'intervention : ${DELAI_LABELS[r.delaiIntervention]}`);
  if (r.devisEstimeMin !== null && r.devisEstimeMax !== null) {
    lines.push(`Estimation indicative : ${r.devisEstimeMin}–${r.devisEstimeMax} € HT`);
  }
  lines.push("");
  lines.push("Photo du composant jointe à ce message.");

  // Signature
  if (profil?.raisonSociale) {
    lines.push("");
    lines.push("---");
    lines.push(profil.raisonSociale);
    if (profil.numeroAttestation) {
      lines.push(`Attestation F-Gas n° ${profil.numeroAttestation}`);
    }
    if (profil.telephone) lines.push(profil.telephone);
    if (profil.email) lines.push(profil.email);
  }
  lines.push("");
  lines.push("Diagnostic généré par Vertxia · vertxia.com");
  return lines.join("\n");
}

/** Sujet d'email court mais identifiable. */
function buildSubject(r: DiagnosticResult): string {
  const date = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const composant = r.composantIdentifie || "composant";
  return `Diagnostic technique — ${composant} — ${date}`;
}

/** URL wa.me a ouvrir pour envoyer le diagnostic via WhatsApp.
 *  L'utilisateur choisit le destinataire dans WhatsApp. La photo doit etre
 *  attachee manuellement (limite WhatsApp URL scheme).
 *  Sur mobile : ouvre l'app native. Sur ordi : ouvre WhatsApp Web. */
export function buildDiagnosticWhatsAppUrl(r: DiagnosticResult, profil?: Profil): string {
  const text = formatDiagnosticForMessage(r, profil);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** URL mailto: a ouvrir pour envoyer le diagnostic par email.
 *  L'utilisateur choisit le destinataire dans son app mail. */
export function buildDiagnosticMailtoUrl(r: DiagnosticResult, profil?: Profil): string {
  const subject = buildSubject(r);
  const body = formatDiagnosticForMessage(r, profil);
  const params = new URLSearchParams();
  params.set("subject", subject);
  params.set("body", body);
  return `mailto:?${params.toString().replace(/\+/g, "%20")}`;
}

/** Declenche le telechargement de la photo dans le dossier Downloads
 *  pour que l'utilisateur puisse l'attacher facilement apres avoir clique
 *  WhatsApp ou Email (ni l'un ni l'autre ne supporte d'attachement
 *  automatique via URL scheme). Retourne true si le download a ete lance. */
export function downloadDiagnosticImage(
  imageDataUrl: string,
  filenameHint?: string
): boolean {
  if (typeof document === "undefined") return false;
  try {
    const name = filenameHint || "diagnostic";
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "diagnostic";
    const ext = imageDataUrl.startsWith("data:image/png") ? "png" : "jpg";
    const filename = `vertxia-${slug}.${ext}`;
    const a = document.createElement("a");
    a.href = imageDataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (e) {
    console.warn("[diagnostic-share] downloadImage failed:", e);
    return false;
  }
}
