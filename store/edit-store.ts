/**
 * Edit store — etat UI de l'iteration loop (chat-panel).
 *
 * - `isOpen`     : panel ouvert / ferme
 * - `isPending`  : edit en cours d'envoi vers /api/lite/edit
 * - `lastIntent` : badge affiche en bas du panel (palette / copy / mood / ...)
 * - `historyCount`: nombre d'edits dans l'historique (pour activer btn undo)
 */

import { create } from "zustand";
import type { EditType } from "@/lib/lite-edit/types";

type EditState = {
  isOpen: boolean;
  isPending: boolean;
  lastIntent: EditType | null;
  historyCount: number;
  open: () => void;
  close: () => void;
  setPending: (v: boolean) => void;
  setLastIntent: (intent: EditType | null) => void;
  setHistoryCount: (n: number) => void;
};

export const useEditStore = create<EditState>((set) => ({
  isOpen: false,
  isPending: false,
  lastIntent: null,
  historyCount: 0,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setPending: (v) => set({ isPending: v }),
  setLastIntent: (intent) => set({ lastIntent: intent }),
  setHistoryCount: (n) => set({ historyCount: n }),
}));
