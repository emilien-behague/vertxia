/**
 * Canvas store — etat du Canvas R3F global.
 *
 * Pattern basement : 1 store par feature, pas un mega-store. Re-renders cibles.
 *
 * `isHidden` : permet de cacher le Canvas global sur certaines routes
 * (ex : page d'auth qui ne veut pas de 3D en arriere-plan).
 *
 * `canvasReady` : signale que le <Canvas> est monte (utile pour les pages
 * qui veulent attendre avant d'injecter via WebGlTunnelIn).
 */

import { create } from "zustand";

type CanvasState = {
  canvasReady: boolean;
  isHidden: boolean;
  setCanvasReady: (v: boolean) => void;
  hideCanvas: () => void;
  showCanvas: () => void;
};

export const useCanvasStore = create<CanvasState>((set) => ({
  canvasReady: false,
  isHidden: false,
  setCanvasReady: (v) => set({ canvasReady: v }),
  hideCanvas: () => set({ isHidden: true }),
  showCanvas: () => set({ isHidden: false }),
}));
