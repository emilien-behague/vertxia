/**
 * Types pour l'iteration loop Vertxia Lite.
 *
 * Port de Open-Lovable (Firecrawl) — adapte au cas Vertxia :
 * on edite un BRIEF JSON, pas du code arbitraire. Donc pas de sandbox,
 * pas de file system manifest.
 *
 * V0.5 : UPDATE_PALETTE
 * V1   : + UPDATE_COPY + UPDATE_MOOD + UPDATE_SECTION + CHANGE_TEMPLATE
 * V2   : + REPLACE_VIDEO + multi-intent batching
 */

export type EditType =
  | "UPDATE_PALETTE"
  | "UPDATE_COPY"
  | "UPDATE_MOOD"
  | "UPDATE_SECTION"
  | "CHANGE_TEMPLATE"
  | "REPLACE_VIDEO"
  | "UNKNOWN";

/**
 * Sections du brief que l'user peut cibler.
 * Mappe sur les structures connues du brief.
 */
export type BriefSection =
  | "hero"
  | "manifesto"
  | "collection"
  | "process"
  | "editorial-close"
  | "footer"
  | "products"
  | "global";

export type EditIntent = {
  type: EditType;
  /** Description en langage naturel de ce que l'user veut. */
  description: string;
  /** Confidence 0-1 sur la classification de l'intent. */
  confidence: number;
  /** Contexte extrait du message user. */
  extracted: {
    direction?: string;       // "darker", "lighter", "warmer", "cooler"
    color?: string;           // "rouge", "blue", "noir"
    saturation?: string;      // "vif", "desature", "muted"
    mood?: string;            // "luxe", "tech", "rustique", "minimal", "premium"
    section?: BriefSection;   // quelle section l'user vise
    template_hint?: string;   // "magazine", "brutalist", "minimal" — pour CHANGE_TEMPLATE
    tone_shift?: string;      // "plus direct", "plus poetique" — pour UPDATE_COPY
  };
};

export type EditResult = {
  success: boolean;
  intent: EditIntent;
  /** Brief patche apres l'edit. Null si l'edit a echoue. */
  newBrief?: Record<string, unknown>;
  /** Diff humain readable de ce qui a change. */
  changeDescription?: string;
  /** Message d'erreur si l'edit a echoue. */
  error?: string;
  /** ID de l'edit pour undo. */
  editId?: string;
};

export type EditRequest = {
  /** Slug du brief a editer (ex: "allbirds_com"). */
  slug: string;
  /** Message naturel de l'user. */
  message: string;
};

/**
 * Entree dans l'historique d'edits pour undo + context.
 */
export type EditHistoryEntry = {
  id: string;
  slug: string;
  timestamp: number;
  userMessage: string;
  intent: EditIntent;
  changeDescription: string;
  /** Brief AVANT l'edit (pour undo). */
  prevBrief: Record<string, unknown>;
};

/**
 * Multi-intent : un message peut declencher plusieurs edits.
 * Ex: "palette plus sombre ET refais le hero" => [PALETTE, COPY(hero)]
 */
export type MultiIntent = {
  intents: EditIntent[];
  /** Si true, on enchaine sequentiel. Si false, on fait juste le premier. */
  shouldChain: boolean;
};
