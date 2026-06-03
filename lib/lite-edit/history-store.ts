/**
 * History store : log des edits par slug pour undo + conversation context.
 *
 * MVP : in-memory Map (perdu au redemarrage serveur).
 * V2 : Postgres pour persistance prod.
 *
 * Pattern Open-Lovable : on garde les N derniers edits par projet
 * pour permettre undo + alimenter le contexte du prompt Claude.
 */

import type { EditHistoryEntry } from "./types";

/** Nombre max d'entries gardees par slug. */
const MAX_HISTORY_PER_SLUG = 20;

/** Store global in-memory : slug -> historique chronologique. */
const store = new Map<string, EditHistoryEntry[]>();

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `edit_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export function appendEdit(entry: Omit<EditHistoryEntry, "id">): EditHistoryEntry {
  const fullEntry: EditHistoryEntry = { ...entry, id: generateId() };
  const list = store.get(entry.slug) ?? [];
  list.push(fullEntry);
  if (list.length > MAX_HISTORY_PER_SLUG) {
    list.splice(0, list.length - MAX_HISTORY_PER_SLUG);
  }
  store.set(entry.slug, list);
  return fullEntry;
}

export function getHistory(slug: string): EditHistoryEntry[] {
  return store.get(slug) ?? [];
}

export function getLastNEdits(slug: string, n: number): EditHistoryEntry[] {
  const list = store.get(slug) ?? [];
  return list.slice(-n);
}

/**
 * Undo le dernier edit : pop la derniere entree et retourne le prevBrief.
 * Retourne null si rien a undo.
 */
export function popLastEdit(slug: string): EditHistoryEntry | null {
  const list = store.get(slug) ?? [];
  if (list.length === 0) return null;
  const last = list.pop()!;
  store.set(slug, list);
  return last;
}

export function clearHistory(slug: string): void {
  store.delete(slug);
}

/**
 * Construit un bloc de contexte conversation pour les prompts Claude.
 * Inclut les N derniers edits pour que Claude soit coherent.
 */
export function buildConversationContext(slug: string, n: number = 3): string {
  const recent = getLastNEdits(slug, n);
  if (recent.length === 0) return "";

  const block = recent
    .map(
      (e, i) =>
        `${i + 1}. [${e.intent.type}] User a dit: "${e.userMessage}" => ${e.changeDescription}`
    )
    .join("\n");

  return `

## Conversation context (${recent.length} derniers edits)
${block}

Reste coherent avec ces edits precedents.`;
}
