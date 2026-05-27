"use client";

/**
 * AudioProvider — wrap les pages qui veulent avoir du sound design.
 *
 * Responsabilités :
 *   1. Restaurer le state muted depuis localStorage au mount
 *   2. Attendre le 1er user gesture pour init l'AudioContext (autoplay policy)
 *   3. Démarrer le drone ambient automatiquement (sauf si muted)
 *   4. Exposer un Context React pour que les composants enfants puissent
 *      jouer des sons (click, hover, reveal, whoosh) via useSound()
 *   5. Cleanup proprement au unmount (stop drone, suspend context)
 *
 * Usage :
 *   <AudioProvider>
 *     <MyImmersivePage />
 *   </AudioProvider>
 *
 *   // Dans un enfant :
 *   const { play, isMuted, toggleMute } = useSound();
 *   play("click");
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { SoundEngine } from "./sound-engine";

type SoundName = "click" | "hover" | "reveal" | "whoosh";

type AudioContextValue = {
  isReady: boolean;
  isMuted: boolean;
  toggleMute: () => void;
  play: (name: SoundName) => void;
};

const Ctx = createContext<AudioContextValue>({
  isReady: false,
  isMuted: false,
  toggleMute: () => {},
  play: () => {},
});

export function AudioProvider({
  children,
  enableDrone = true,
}: {
  children: ReactNode;
  enableDrone?: boolean;
}) {
  const [isReady, setIsReady] = useState(false);
  const [isMuted, setIsMutedState] = useState(false);
  const droneStartedRef = useRef(false);

  // Au mount, restaurer le state muted depuis localStorage
  useEffect(() => {
    SoundEngine.restoreMutedState();
    setIsMutedState(SoundEngine.isMuted());
  }, []);

  // Premier user gesture → init AudioContext + démarrer drone
  useEffect(() => {
    if (typeof window === "undefined") return;

    const init = () => {
      const ctx = SoundEngine.init();
      if (ctx) {
        setIsReady(true);
        if (enableDrone && !droneStartedRef.current && !SoundEngine.isMuted()) {
          SoundEngine.startDrone();
          droneStartedRef.current = true;
        }
      }
      // Cleanup les listeners après le 1er gesture
      window.removeEventListener("click", init);
      window.removeEventListener("touchstart", init);
      window.removeEventListener("keydown", init);
      window.removeEventListener("scroll", init);
    };

    window.addEventListener("click", init, { passive: true });
    window.addEventListener("touchstart", init, { passive: true });
    window.addEventListener("keydown", init);
    window.addEventListener("scroll", init, { passive: true });

    return () => {
      window.removeEventListener("click", init);
      window.removeEventListener("touchstart", init);
      window.removeEventListener("keydown", init);
      window.removeEventListener("scroll", init);
    };
  }, [enableDrone]);

  // Cleanup drone au unmount du provider
  useEffect(() => {
    return () => {
      SoundEngine.stopDrone();
      droneStartedRef.current = false;
    };
  }, []);

  const toggleMute = () => {
    const next = !SoundEngine.isMuted();
    SoundEngine.setMuted(next);
    setIsMutedState(next);

    // Si on unmute et drone pas encore lancé, on le lance
    if (!next && enableDrone && isReady && !droneStartedRef.current) {
      SoundEngine.startDrone();
      droneStartedRef.current = true;
    }
  };

  const play = (name: SoundName) => {
    if (SoundEngine.isMuted()) return;
    switch (name) {
      case "click":
        SoundEngine.click();
        break;
      case "hover":
        SoundEngine.hover();
        break;
      case "reveal":
        SoundEngine.reveal();
        break;
      case "whoosh":
        SoundEngine.whoosh();
        break;
    }
  };

  return (
    <Ctx.Provider value={{ isReady, isMuted, toggleMute, play }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSound() {
  return useContext(Ctx);
}
