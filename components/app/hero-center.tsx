"use client";

/**
 * HeroCenter — badge "Powered by AI" + titre + prompt box.
 * Stagger fade-up au mount via Framer Motion variants.
 * PromptBox = client (state focus + value).
 */

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import { extractDomainAndSlug } from "@/lib/url-to-slug";

// R3F bundle ~80KB : dynamic import sans SSR pour ne pas peser sur le mount /app
const CosmicPortal = dynamic(() => import("./cosmic-portal"), { ssr: false });

const PORTAL_DURATION_MS = 1400;
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
  const router = useRouter();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);

  async function handleSubmit() {
    setError(null);
    // Defense en profondeur : truncate cote handler meme si maxLength bypass par DevTools.
    // 500 chars largement assez pour URL + brief prompt court.
    const trimmed = value.trim().slice(0, 500);
    if (!trimmed) return;

    const result = extractDomainAndSlug(trimmed);
    if (!result.ok) {
      if (result.reason === "no-url") {
        setError("Colle une URL Shopify dans ton prompt (ex : allbirds.com).");
      } else {
        setError("Ce domaine n'est pas une boutique Shopify utilisable.");
      }
      return;
    }

    setSubmitting(true);

    // Respect prefers-reduced-motion : skip portail
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion) setPortalOpen(true);

    // Demarre fetch POST + attend en parallele que le portail finisse son anim
    const fetchPromise = fetch("/api/lite/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: result.raw, prompt: trimmed }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${r.status}`);
        }
        return (await r.json()) as { jobId: string; slug: string };
      });

    const minWait = reducedMotion
      ? Promise.resolve()
      : new Promise((res) => setTimeout(res, PORTAL_DURATION_MS));

    try {
      const [job] = await Promise.all([fetchPromise, minWait]);
      const params = new URLSearchParams({ job: job.jobId });
      router.push(`/lite/${job.slug}/generating?${params.toString()}`);
      // Garde portail visible un peu apres push pour couvrir la transition
      setTimeout(() => {
        setPortalOpen(false);
        setSubmitting(false);
      }, 1000);
    } catch (err) {
      setPortalOpen(false);
      setSubmitting(false);
      setError(
        "Echec creation job : " +
          (err instanceof Error ? err.message : "unknown")
      );
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl + Enter pour submit (convention chat AI)
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

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
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="Colle une URL Shopify + decris l'ambiance (ex : allbirds.com — site editorial print magazine)"
            rows={3}
            maxLength={500}
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
                disabled={!value.trim() || submitting}
                onClick={handleSubmit}
                className={[
                  "w-9 h-9 grid place-items-center rounded-full transition",
                  value.trim() && !submitting
                    ? "bg-white text-black hover:scale-105"
                    : "bg-white/[0.12] text-white/45 cursor-not-allowed",
                ].join(" ")}
              >
                {submitting ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    className="animate-spin"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeDasharray="42"
                      strokeDashoffset="14"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <IconArrowUp size={16} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Helper text + erreur */}
        <div className="mt-3 flex items-center justify-between px-2 text-[11.5px]">
          <span
            className={
              error ? "text-rose-300/90" : "text-white/35"
            }
          >
            {error ??
              "Le pipeline scrape ta boutique, ecrit le brief creatif, genere les videos AI et compose le site."}
          </span>
          {!error && (
            <span className="text-white/30 hidden md:inline">
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">
                Ctrl
              </kbd>
              <span className="mx-1">+</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">
                Enter
              </kbd>
            </span>
          )}
        </div>
      </motion.div>

      {portalOpen && <CosmicPortal />}
    </motion.div>
  );
}
