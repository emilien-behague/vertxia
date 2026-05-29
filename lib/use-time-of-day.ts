"use client";

import { useEffect, useState } from "react";

/**
 * Hook qui retourne la "période" actuelle de la journée + sa palette
 * + son greeting + son label de chapitre.
 *
 * Le site Vertxia respire avec l'heure réelle de la visite — c'est la
 * mécanique signature qui rend chaque session unique. Inspiré de l'idée
 * "le site connaît l'heure" mais ici on l'applique pour qu'il CHANGE
 * visuellement (palette, accent, greeting).
 *
 * 6 chapitres :
 *   - NIGHT       (00h-05h) : noir profond + violet, indigo accent
 *   - DAWN        (05h-08h) : pêche / cuivre, ambiance levée
 *   - MORNING     (08h-12h) : crème claire, bleu profond
 *   - DAY         (12h-17h) : blanc cassé, noir net
 *   - GOLDEN      (17h-20h) : sable doré chaud, cuivre brûlé
 *   - BLUE        (20h-23h) : bleu nuit profond, or vieilli (l'heure bleue)
 *
 * Toggle utilisateur : `auto` (suit le temps), `light` (force clair), `dark` (force sombre).
 * Persisté en localStorage.
 */

export type TimePeriod = "night" | "dawn" | "morning" | "day" | "golden" | "blue";
export type ThemeMode = "auto" | "light" | "dark";

export type TimePalette = {
  bg: string;
  fg: string;
  accent: string;
  muted: string;
  border: string;
  label: string;
  chapter: string; // # de chapitre (1-6)
  greeting: string;
};

export const TIME_PALETTES: Record<TimePeriod, TimePalette> = {
  night: {
    bg: "#0A0A12",
    fg: "#E8E6E0",
    accent: "#7A6FF0",
    muted: "rgba(232, 230, 224, 0.45)",
    border: "rgba(232, 230, 224, 0.12)",
    label: "Nuit profonde",
    chapter: "01",
    greeting: "Bonne nuit.",
  },
  dawn: {
    bg: "#F2E6DA",
    fg: "#2A1F1A",
    accent: "#C97A4E",
    muted: "rgba(42, 31, 26, 0.55)",
    border: "rgba(42, 31, 26, 0.12)",
    label: "Aube",
    chapter: "02",
    greeting: "Bien réveillé ?",
  },
  morning: {
    bg: "#FAF7F0",
    fg: "#161616",
    accent: "#1F5BB3",
    muted: "rgba(22, 22, 22, 0.55)",
    border: "rgba(22, 22, 22, 0.1)",
    label: "Matin",
    chapter: "03",
    greeting: "Bonjour.",
  },
  day: {
    bg: "#FFFFFF",
    fg: "#0A0A0A",
    accent: "#0A0A0A",
    muted: "rgba(10, 10, 10, 0.55)",
    border: "rgba(10, 10, 10, 0.1)",
    label: "Plein jour",
    chapter: "04",
    greeting: "Bon après-midi.",
  },
  golden: {
    bg: "#E8D2A8",
    fg: "#2B180A",
    accent: "#C25C1F",
    muted: "rgba(43, 24, 10, 0.55)",
    border: "rgba(43, 24, 10, 0.15)",
    label: "Golden hour",
    chapter: "05",
    greeting: "Belle fin de journée.",
  },
  blue: {
    bg: "#0F1735",
    fg: "#EDE4D3",
    accent: "#C9A668",
    muted: "rgba(237, 228, 211, 0.45)",
    border: "rgba(237, 228, 211, 0.14)",
    label: "Heure bleue",
    chapter: "06",
    greeting: "Bonsoir.",
  },
};

/** Mapping heure → période. */
export function getPeriod(hour: number): TimePeriod {
  if (hour < 5) return "night";
  if (hour < 8) return "dawn";
  if (hour < 12) return "morning";
  if (hour < 17) return "day";
  if (hour < 20) return "golden";
  if (hour < 23) return "blue";
  return "night";
}

/** Palette forcée par le toggle utilisateur quand le mode n'est pas auto. */
const FORCED_PALETTES: Record<"light" | "dark", TimePalette> = {
  light: TIME_PALETTES.day,
  dark: TIME_PALETTES.blue, // dark = ambiance "heure bleue" — la signature Vertxia
};

const STORAGE_KEY = "vertxia.theme.mode";

export function useTimeOfDay() {
  const [hour, setHour] = useState(() => new Date().getHours());
  const [minute, setMinute] = useState(() => new Date().getMinutes());
  const [mode, setMode] = useState<ThemeMode>("auto");
  const [mounted, setMounted] = useState(false);

  // Charge le mode depuis localStorage au mount
  useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "auto" || saved === "light" || saved === "dark") {
        setMode(saved);
      }
    } catch {}
  }, []);

  // Update l'heure toutes les 30s pour suivre les transitions
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setHour(now.getHours());
      setMinute(now.getMinutes());
    };
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  // Persist mode change
  const setModeAndPersist = (m: ThemeMode) => {
    setMode(m);
    try {
      window.localStorage.setItem(STORAGE_KEY, m);
    } catch {}
  };

  const cycleMode = () => {
    const next: ThemeMode = mode === "auto" ? "light" : mode === "light" ? "dark" : "auto";
    setModeAndPersist(next);
  };

  const period = getPeriod(hour);
  const palette = mode === "auto" ? TIME_PALETTES[period] : FORCED_PALETTES[mode];

  // Timestamp formaté
  const timestamp = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return {
    mounted,
    hour,
    minute,
    period,
    palette,
    mode,
    setMode: setModeAndPersist,
    cycleMode,
    timestamp,
  };
}
