// Types + helpers pour le diagnostic visuel IA (api/vision/diagnostic).

export type DefautGravite = "info" | "surveiller" | "urgent" | "critique";

export type DefautDetecte = {
  nom: string;
  description: string;
  gravite: DefautGravite;
};

export type DelaiIntervention = "preventif" | "1-3 mois" | "1 mois" | "urgent";

export type DiagnosticResult = {
  composantIdentifie: string | null;
  defautsDetectes: DefautDetecte[];
  causeProbable: string;
  actionRecommandee: string;
  devisEstimeMin: number | null;
  devisEstimeMax: number | null;
  delaiIntervention: DelaiIntervention;
  confiance: "haute" | "moyenne" | "basse";
  notesContexte: string | null;
  model?: string;
};

/** Compresse + redimensionne une image client-side avant upload.
 *  Max width = 2000px, qualité JPEG 80%. Si l'image est plus petite, on
 *  garde la résolution d'origine. Renvoie data URL.
 */
export async function compressImage(file: File, maxDim = 2000, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture fichier impossible"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image illisible"));
      img.onload = () => {
        const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
        const targetW = Math.round(img.width * ratio);
        const targetH = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D non disponible"));
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const GRAVITE_LABELS: Record<DefautGravite, string> = {
  info: "Info",
  surveiller: "À surveiller",
  urgent: "Urgent",
  critique: "Critique",
};

export const GRAVITE_STYLES: Record<DefautGravite, { bg: string; text: string; ring: string; dot: string }> = {
  info: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200", dot: "bg-blue-500" },
  surveiller: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", dot: "bg-amber-500" },
  urgent: { bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200", dot: "bg-orange-500" },
  critique: { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200", dot: "bg-red-600" },
};

export const DELAI_LABELS: Record<DelaiIntervention, string> = {
  preventif: "Préventif (prochain contrôle)",
  "1-3 mois": "Dans le trimestre",
  "1 mois": "Dans le mois",
  urgent: "Sous 7 jours",
};

/** Labels DELAI courts pour rentrer dans la case Observations du CERFA. */
const DELAI_LABELS_SHORT: Record<DelaiIntervention, string> = {
  preventif: "préventif",
  "1-3 mois": "1-3 mois",
  "1 mois": "<1 mois",
  urgent: "urgent",
};

/** Labels GRAVITE courts (une lettre) pour densifier le resume CERFA :
 *  Info / Surveiller / Urgent / Critique → I / S / U / C */
const GRAVITE_SHORT: Record<DefautGravite, string> = {
  info: "I",
  surveiller: "S",
  urgent: "U",
  critique: "C",
};

/**
 * Resume le diagnostic IA en une seule ligne dense (~200-250 chars) qui
 * rentre dans la case "Observations" du CERFA 15497*04 (zone limitee).
 *
 * Format : "Diag IA Vertxia · <composant> · <N defauts: noms (G)> · Action: <act> · Delai: <delai>"
 *
 * Exemple :
 *   "Diag IA Vertxia · Évaporateur · 2 défauts : Givrage anormal (U), Bavures cuivre (S) · Action : décompression circuit + contrôle joints · Délai : <1 mois"
 *
 * On tronque l'action a ~80 chars si elle deborde, et on coupe les noms de
 * defauts a 40 chars chacun pour garantir une longueur stable.
 */
export function summarizeDiagnosticForCerfa(result: DiagnosticResult): string {
  const truncate = (s: string, max: number): string =>
    s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";

  const parts: string[] = ["Diag IA Vertxia"];

  if (result.composantIdentifie) {
    parts.push(truncate(result.composantIdentifie, 50));
  }

  if (result.defautsDetectes.length > 0) {
    const n = result.defautsDetectes.length;
    const defautsTxt = result.defautsDetectes
      .map((d) => `${truncate(d.nom, 40)} (${GRAVITE_SHORT[d.gravite]})`)
      .join(", ");
    parts.push(`${n} défaut${n > 1 ? "s" : ""} : ${defautsTxt}`);
  }

  if (result.actionRecommandee) {
    parts.push(`Action : ${truncate(result.actionRecommandee, 90)}`);
  }

  parts.push(`Délai : ${DELAI_LABELS_SHORT[result.delaiIntervention]}`);

  let line = parts.join(" · ");

  // Garde-fou final : si on depasse 350 chars (cas defauts tres nombreux),
  // on coupe en preservant le suffixe "Délai" qui est important.
  const MAX = 350;
  if (line.length > MAX) {
    const delaiSuffix = ` · Délai : ${DELAI_LABELS_SHORT[result.delaiIntervention]}`;
    const head = line.slice(0, MAX - delaiSuffix.length - 1).trimEnd() + "…";
    line = head + delaiSuffix;
  }

  return line;
}
