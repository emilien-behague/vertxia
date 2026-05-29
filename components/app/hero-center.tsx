"use client";

/**
 * HeroCenter — badge "Powered by AI" + titre + prompt box.
 * Stagger fade-up au mount via Framer Motion variants.
 * PromptBox = client (state focus + value).
 */

import { motion } from "framer-motion";
import { useState } from "react";
import {
  IconPlus,
  IconMic,
  IconArrowUp,
  IconChevronDown,
  IconSparkles,
  IconArrowRight,
} from "./icons";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function HeroCenter() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <motion.div
      className="relative z-20 flex flex-col items-center w-full max-w-[760px] px-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* BADGE */}
      <motion.button
        type="button"
        variants={itemVariants}
        className="group flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/45 backdrop-blur-md border border-white/[0.08] hover:border-white/[0.15] shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all"
      >
        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 grid place-items-center">
          <IconSparkles size={12} className="text-white drop-shadow" />
        </span>
        <span className="text-[12.5px] text-white/90 font-medium tracking-tight">
          Powered by AI
        </span>
        <IconArrowRight
          size={13}
          className="text-white/55 group-hover:translate-x-0.5 transition-transform"
        />
      </motion.button>

      {/* TITRE */}
      <motion.h1
        variants={itemVariants}
        className="mt-10 text-center font-bold text-white tracking-[-0.025em] leading-[1.05]"
        style={{
          fontSize: "clamp(36px, 5.2vw, 64px)",
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontWeight: 700,
        }}
      >
        Ready to build, Vertxia?
      </motion.h1>

      {/* PROMPT BOX */}
      <motion.div
        variants={itemVariants}
        className="relative w-full mt-10"
      >
        {/* Glow halo derrière la box */}
        <div
          aria-hidden
          className={[
            "absolute -inset-3 rounded-[36px] transition-opacity duration-500 pointer-events-none",
            focused ? "opacity-100" : "opacity-0",
          ].join(" ")}
          style={{
            background:
              "radial-gradient(60% 80% at 50% 50%, rgba(138,63,255,0.35) 0%, rgba(255,61,138,0.15) 50%, transparent 80%)",
            filter: "blur(20px)",
          }}
        />

        <div
          className={[
            "relative rounded-[28px] bg-[rgba(20,20,20,0.85)] backdrop-blur-xl border transition-all duration-300",
            focused
              ? "border-white/[0.18] shadow-[0_8px_40px_rgba(138,63,255,0.25)]"
              : "border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.5)]",
          ].join(" ")}
        >
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Describe what you want to build…"
            rows={3}
            className="w-full bg-transparent px-6 pt-5 pb-2 text-[15px] text-white placeholder:text-white/35 resize-none outline-none font-sans"
            style={{ minHeight: "84px" }}
          />

          {/* BAS DE LA BOX : + à gauche / Build + mic + send à droite */}
          <div className="flex items-center justify-between px-3 pb-3">
            <button
              type="button"
              aria-label="Ajouter contexte / fichier"
              className="w-9 h-9 grid place-items-center rounded-xl text-white/55 hover:text-white hover:bg-white/[0.06] transition"
            >
              <IconPlus size={18} />
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-[13px] text-white/75 hover:text-white hover:bg-white/[0.06] transition"
              >
                <span>Build</span>
                <IconChevronDown size={14} className="text-white/55" />
              </button>
              <button
                type="button"
                aria-label="Saisie vocale"
                className="w-9 h-9 grid place-items-center rounded-xl text-white/55 hover:text-white hover:bg-white/[0.06] transition"
              >
                <IconMic size={17} />
              </button>
              <button
                type="button"
                aria-label="Envoyer"
                disabled={!value.trim()}
                className={[
                  "w-9 h-9 grid place-items-center rounded-full transition",
                  value.trim()
                    ? "bg-white text-black hover:scale-105"
                    : "bg-white/[0.12] text-white/45 cursor-not-allowed",
                ].join(" ")}
              >
                <IconArrowUp size={16} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
