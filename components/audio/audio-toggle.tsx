"use client";

/**
 * AudioToggle — bouton mute/unmute discret dans le coin de la page.
 *
 * Affiche une icône SVG d'ondes sonores qui s'animent quand audio actif,
 * ou une icône "silence" quand muted. Click toggle l'état.
 *
 * À placer dans la page via :
 *   <AudioToggle className="fixed bottom-6 right-6 z-50" />
 */

import { useSound } from "./audio-provider";

export function AudioToggle({ className = "" }: { className?: string }) {
  const { isMuted, toggleMute, isReady } = useSound();

  return (
    <button
      onClick={toggleMute}
      aria-label={isMuted ? "Activer le son" : "Couper le son"}
      className={`group relative flex items-center gap-2 px-3 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/15 hover:border-white/40 transition pointer-events-auto ${className}`}
    >
      {/* Icône SVG ondes sonores ou muted */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-white/80"
      >
        {/* Speaker shape (toujours visible) */}
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        {/* Sound waves : visibles seulement si NOT muted */}
        {!isMuted && (
          <>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" className="audio-wave-1" />
            <path
              d="M19.07 4.93a10 10 0 0 1 0 14.14"
              className="audio-wave-2"
            />
          </>
        )}
        {/* X croisé : visible si muted */}
        {isMuted && (
          <>
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </>
        )}
      </svg>
      <span className="font-mono text-[9px] tracking-widest text-white/60 group-hover:text-white transition">
        {isReady ? (isMuted ? "SOUND OFF" : "SOUND ON") : "AUDIO"}
      </span>

      {/* Mini pulse animation quand actif */}
      {!isMuted && isReady && (
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      )}
    </button>
  );
}
