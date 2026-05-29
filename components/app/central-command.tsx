"use client";

/**
 * Central Command — hero overlay Lovable-style au centre de la Floating Gallery.
 *
 * Affiche :
 * - Badge pill "Power your app with connectors →"
 * - Titre "Ready to build, Vertxia?" (font Inter 600+ tres gros)
 * - Prompt box noire arrondie 28px : + a gauche, textarea, Build dropdown / mic / send circulaire
 *
 * Pointer-events sur les elements seuls — la galerie 3D reste interactive autour.
 */

import { AnimatePresence, motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { extractDomainAndSlug } from "@/lib/url-to-slug";
import {
  IconPlus,
  IconMic,
  IconArrowUp,
  IconChevronDown,
  IconArrowRight,
} from "./icons";

const CosmicPortal = dynamic(() => import("./cosmic-portal"), { ssr: false });

const PORTAL_DURATION_MS = 1400;
const MAX_INPUT_CHARS = 500;

/** Titre central FIXE. */
const HEADLINE = "Compose your next world.";

/** Placeholders cyclees dans la prompt box — exemples de prompts qui inspirent. */
const PROMPT_PLACEHOLDERS = [
  "Ask Vertxia to build a luxury brand site from allbirds.com…",
  "Compose a dark, jewel-light cinematic site from cartier.com…",
  "Direct a Margiela editorial — film grain, slow cuts, drop culture…",
  "Heritage story for riva-yacht.com — Italian summer, sea breeze…",
  "Reveal fenty.com — neon glow, sensual rhythm, beauty drop…",
  "Lookbook for loom.fr — natural light, soft jersey, no music…",
  "Aman resort site — boutique hospitality, silence, slow camera…",
];

const PLACEHOLDER_INTERVAL_MS = 5500;

const TITLE_VARIANTS = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
} as const;

const TRANSITION = { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const };

export function CentralCommand() {
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  // Cycle des placeholders — pause quand l'utilisateur a commence a taper ou focused
  useEffect(() => {
    if (value.trim() || focused) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const id = setInterval(() => {
      setPlaceholderIdx((p) => (p + 1) % PROMPT_PLACEHOLDERS.length);
    }, PLACEHOLDER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [value, focused]);

  const showPlaceholderOverlay = !value.trim();

  // Reflet mouse-tracking subtil sur la box
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const reflectionBg = useMotionTemplate`radial-gradient(420px circle at ${mx}px ${my}px, rgba(255,255,255,0.06), transparent 65%)`;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  }

  async function handleSubmit() {
    setError(null);
    const trimmed = value.trim().slice(0, MAX_INPUT_CHARS);
    if (!trimmed) return;

    const result = extractDomainAndSlug(trimmed);
    if (!result.ok) {
      setError(
        result.reason === "no-url"
          ? "Inclus une URL Shopify (ex : allbirds.com)."
          : "Domaine non utilisable."
      );
      return;
    }

    setSubmitting(true);
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion) setPortalOpen(true);

    const fetchPromise = fetch("/api/lite/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: result.raw, prompt: trimmed }),
    }).then(async (r) => {
      if (!r.ok) {
        const e = (await r.json().catch(() => ({}))) as {
          error?: string;
          redirectTo?: string;
        };
        // Redirige automatiquement vers /pricing si l'API le demande
        // (cas 401 pas-loggé, 402 pas-abonné)
        if (e.redirectTo) {
          window.location.href = e.redirectTo;
          throw new Error(e.error || "Redirecting...");
        }
        throw new Error(e.error || `HTTP ${r.status}`);
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
      setTimeout(() => {
        setPortalOpen(false);
        setSubmitting(false);
      }, 1000);
    } catch (err) {
      setPortalOpen(false);
      setSubmitting(false);
      setError("Echec : " + (err instanceof Error ? err.message : "unknown"));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <>
      {/* Wrapper centre, pointer-events none -> seul les elements actifs reprennent les events */}
      <motion.div
        className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.14, delayChildren: 0.15 },
          },
        }}
      >
        <div className="w-full max-w-[680px] px-6 flex flex-col items-center">
          {/* BADGE PILL */}
          <motion.button
            variants={TITLE_VARIANTS}
            transition={TRANSITION}
            type="button"
            className="group pointer-events-auto flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full bg-black/55 backdrop-blur-xl border border-white/[0.08] hover:border-white/[0.16] transition-all"
            style={{
              boxShadow:
                "0 6px 28px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            {/* Mini-icones connecteurs (style Lovable) */}
            <span className="flex items-center -space-x-1.5">
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 to-orange-400 ring-2 ring-black/60" />
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 ring-2 ring-black/60" />
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-rose-500 ring-2 ring-black/60" />
            </span>
            <span className="text-[12.5px] font-medium text-white/95 tracking-tight">
              Power your app with connectors
            </span>
            <IconArrowRight
              size={12}
              className="text-white/65 group-hover:translate-x-0.5 transition-transform"
            />
          </motion.button>

          {/* TITRE — fixe */}
          <motion.h1
            variants={TITLE_VARIANTS}
            transition={TRANSITION}
            className="mt-7 text-center font-bold text-white tracking-[-0.025em] leading-[1.05] pointer-events-none"
            style={{
              fontFamily:
                "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              fontSize: "clamp(36px, 4.8vw, 56px)",
              fontWeight: 700,
              textShadow: "0 4px 32px rgba(0,0,0,0.5)",
            }}
          >
            {HEADLINE}
          </motion.h1>

          {/* PROMPT BOX */}
          <motion.div
            variants={TITLE_VARIANTS}
            transition={TRANSITION}
            className="relative w-full mt-9 pointer-events-auto"
          >
            {/* Glow halo focus */}
            <div
              aria-hidden
              className="absolute -inset-3 rounded-[36px] pointer-events-none transition-opacity duration-500"
              style={{
                background:
                  "radial-gradient(70% 80% at 50% 50%, rgba(79,125,255,0.25) 0%, rgba(138,92,255,0.12) 50%, transparent 80%)",
                filter: "blur(24px)",
                opacity: focused ? 1 : 0,
              }}
            />

            <div
              ref={boxRef}
              onMouseMove={handleMouseMove}
              className="relative rounded-[28px] transition-colors duration-300"
              style={{
                background: "rgba(18, 18, 18, 0.78)",
                backdropFilter: "blur(28px) saturate(1.15)",
                WebkitBackdropFilter: "blur(28px) saturate(1.15)",
                border: focused
                  ? "1px solid rgba(255,255,255,0.18)"
                  : "1px solid rgba(255,255,255,0.10)",
                boxShadow:
                  "0 16px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              {/* Reflet top */}
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
                }}
              />
              {/* Reflet mouse */}
              <motion.div
                aria-hidden
                className="absolute inset-0 rounded-[28px] pointer-events-none"
                style={{ background: reflectionBg }}
              />

              {/* Placeholder cycling overlay (cross-fade). Hidden when user starts typing. */}
              {showPlaceholderOverlay && (
                <div
                  className="absolute inset-x-0 top-0 px-6 pt-5 pb-3 pointer-events-none overflow-hidden"
                  aria-hidden
                  style={{ minHeight: "92px" }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={placeholderIdx}
                      initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
                      transition={{
                        duration: 0.55,
                        ease: [0.22, 1, 0.36, 1] as const,
                      }}
                      className="block text-[15px] text-white/40 leading-snug"
                      style={{ fontFamily: "inherit" }}
                    >
                      {PROMPT_PLACEHOLDERS[placeholderIdx]}
                    </motion.span>
                  </AnimatePresence>
                </div>
              )}

              <textarea
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder=""
                rows={3}
                maxLength={MAX_INPUT_CHARS}
                disabled={submitting}
                className="relative w-full bg-transparent px-6 pt-5 pb-3 text-[15px] text-white placeholder:text-white/40 resize-none outline-none"
                style={{ minHeight: "92px", fontFamily: "inherit" }}
              />

              {/* Bottom row : + gauche, Build/mic/send droite */}
              <div className="relative flex items-center justify-between px-3 pb-3">
                <button
                  type="button"
                  aria-label="Add context"
                  className="w-9 h-9 grid place-items-center rounded-xl text-white/55 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <IconPlus size={18} />
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-[13px] text-white/75 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <span>Build</span>
                    <IconChevronDown size={14} className="text-white/55" />
                  </button>
                  <button
                    type="button"
                    aria-label="Voice input"
                    className="w-9 h-9 grid place-items-center rounded-xl text-white/55 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <IconMic size={17} />
                  </button>
                  <button
                    type="button"
                    aria-label="Send"
                    disabled={!value.trim() || submitting}
                    onClick={handleSubmit}
                    className={[
                      "w-9 h-9 grid place-items-center rounded-full transition",
                      value.trim() && !submitting
                        ? "bg-white text-black hover:scale-105"
                        : "bg-white/[0.14] text-white/45 cursor-not-allowed",
                    ].join(" ")}
                  >
                    {submitting ? (
                      <span className="flex items-center gap-1">
                        <span className="vsig-dot vsig-dot-1" />
                        <span className="vsig-dot vsig-dot-2" />
                        <span className="vsig-dot vsig-dot-3" />
                      </span>
                    ) : (
                      <IconArrowUp size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Helper / error */}
            <div className="mt-3 px-2 text-center">
              <span
                className={[
                  "text-[11.5px]",
                  error ? "text-rose-300/90" : "text-white/40",
                ].join(" ")}
              >
                {error ??
                  "Cmd+Enter to launch — paste a Shopify URL + describe the mood."}
              </span>
            </div>
          </motion.div>
        </div>

        <style>{`
          @keyframes vsig-dot-pulse {
            0%, 100% { opacity: 0.25; transform: scale(0.8); }
            50%      { opacity: 1;    transform: scale(1.1); }
          }
          .vsig-dot {
            width: 4px; height: 4px; border-radius: 9999px;
            background: currentColor;
            display: inline-block;
          }
          .vsig-dot-1 { animation: vsig-dot-pulse 1.1s ease-in-out infinite; }
          .vsig-dot-2 { animation: vsig-dot-pulse 1.1s ease-in-out 0.15s infinite; }
          .vsig-dot-3 { animation: vsig-dot-pulse 1.1s ease-in-out 0.30s infinite; }
        `}</style>
      </motion.div>

      {portalOpen && <CosmicPortal />}
    </>
  );
}
