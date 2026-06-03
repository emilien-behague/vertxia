/**
 * Brief store — etat du brief Vertxia Lite en cours.
 *
 * Source de verite cote client pour le brief actuellement affiche.
 * Permet aux composants edit-chat-panel, signatures, etc. de reagir
 * a un brief mis a jour sans repasser par un reload de page.
 */

import { create } from "zustand";
import type { Brief } from "@/lib/brief";

type BriefState = {
  brief: Brief | null;
  slug: string | null;
  setBrief: (brief: Brief, slug: string) => void;
  clearBrief: () => void;
};

export const useBriefStore = create<BriefState>((set) => ({
  brief: null,
  slug: null,
  setBrief: (brief, slug) => set({ brief, slug }),
  clearBrief: () => set({ brief: null, slug: null }),
}));
