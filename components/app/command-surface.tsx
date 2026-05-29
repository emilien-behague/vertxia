"use client";

/**
 * Command Surface — la zone de creation centrale de Vertxia Studio.
 *
 * Pas une "prompt box". Une surface flottante premium :
 * - Verre fume (rgba + backdrop-blur)
 * - Reflets dynamiques au mouse-move (radial-gradient lentille)
 * - Focus glow accent bleu electrique
 * - Bouton "Create →" avec animation fleche au hover
 * - Pas de + a gauche, pas de mic (kitsch SaaS classique)
 * - Footer hint "What do you want to create today?"
 *
 * Submit : fetch POST /api/lite/generate + portail R3F + redirect /lite/[domain]/generating.
 */

import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { extractDomainAndSlug } from "@/lib/url-to-slug";

const CosmicPortal = dynamic(() => import("./cosmic-portal"), { ssr: false });

const PORTAL_DURATION_MS = 1400;
const MAX_INPUT_CHARS = 500;

const TITLE_VARIANTS = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
} as const;

const TRANSITION = { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const };

export function CommandSurface() {
  const router = useRouter();
  const surfaceRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);

  // Reflet dynamique : suit la position de la souris sur la surface
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const reflectionBg = useMotionTemplate`radial-gradient(420px circle at ${mx}px ${my}px, rgba(79,125,255,0.10), transparent 60%)`;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
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
          : "Domaine non utilisable comme boutique Shopify."
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
        const e = await r.json().catch(() => ({}));
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
      setError(
        "Echec : " + (err instanceof Error ? err.message : "unknown")
      );
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="relative z-10 w-full max-w-[720px] px-6 flex flex-col items-center">
      {/* Titre principal */}
      <motion.h1
        initial="hidden"
        animate="visible"
        variants={TITLE_VARIANTS}
        transition={{ ...TRANSITION, delay: 0.05 }}
        className="text-center mb-3"
        style={{
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: "clamp(32px, 4.2vw, 48px)",
          fontWeight: 600,
          letterSpacing: "-0.024em",
          lineHeight: 1.05,
          color: "rgba(255,255,255,0.96)",
        }}
      >
        What do you want to create today?
      </motion.h1>

      <motion.p
        initial="hidden"
        animate="visible"
        variants={TITLE_VARIANTS}
        transition={{ ...TRANSITION, delay: 0.18 }}
        className="text-center text-[13px] text-white/40 mb-10"
      >
        Paste a Shopify URL — Vertxia composes the site, writes the brief, generates the videos.
      </motion.p>

      {/* COMMAND SURFACE */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={TITLE_VARIANTS}
        transition={{ ...TRANSITION, delay: 0.3 }}
        className="relative w-full"
      >
        {/* Glow halo derriere la surface (focus) */}
        <div
          aria-hidden
          className="absolute -inset-4 rounded-[40px] pointer-events-none transition-opacity duration-500"
          style={{
            background:
              "radial-gradient(70% 80% at 50% 50%, rgba(79,125,255,0.22) 0%, rgba(138,92,255,0.10) 50%, transparent 80%)",
            filter: "blur(28px)",
            opacity: focused ? 1 : 0,
          }}
        />

        <motion.div
          ref={surfaceRef}
          onMouseMove={handleMouseMove}
          className="relative rounded-[28px] transition-colors duration-300"
          style={{
            background: "rgba(18, 18, 18, 0.6)",
            backdropFilter: "blur(24px) saturate(1.1)",
            WebkitBackdropFilter: "blur(24px) saturate(1.1)",
            border: focused
              ? "1px solid rgba(79,125,255,0.45)"
              : "1px solid rgba(255,255,255,0.08)",
            boxShadow: focused
              ? "0 12px 60px rgba(79,125,255,0.18), inset 0 1px 0 rgba(255,255,255,0.06)"
              : "0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
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

          {/* Reflet dynamique mouse */}
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-[28px] pointer-events-none"
            style={{ background: reflectionBg }}
          />

          {/* Textarea */}
          <textarea
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="ex : allbirds.com — editorial print magazine"
            rows={3}
            maxLength={MAX_INPUT_CHARS}
            className="relative w-full bg-transparent px-6 pt-5 pb-3 text-[15px] text-white placeholder:text-white/30 resize-none outline-none"
            style={{ minHeight: "92px", fontFamily: "inherit" }}
          />

          {/* Bottom row : mode selector + Create button */}
          <div className="relative flex items-center justify-between px-3 pb-3">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-[12px] text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4F7DFF" }} />
              <span>Site Cinematic</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!value.trim() || submitting}
              className={[
                "group flex items-center gap-2 h-9 px-4 rounded-lg text-[12.5px] font-medium transition-all",
                value.trim() && !submitting
                  ? "bg-white text-black hover:scale-[1.02]"
                  : "bg-white/[0.08] text-white/40 cursor-not-allowed",
              ].join(" ")}
            >
              {submitting ? (
                <>
                  {/* Loading 3 dots breathe (no spinner classique) */}
                  <span className="flex items-center gap-1">
                    <span className="vsig-dot vsig-dot-1" />
                    <span className="vsig-dot vsig-dot-2" />
                    <span className="vsig-dot vsig-dot-3" />
                  </span>
                  <span>Creating</span>
                </>
              ) : (
                <>
                  <span>Create</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Helper / error */}
        <div className="mt-3 px-2 flex items-center justify-between text-[11.5px]">
          <span
            className={error ? "text-rose-300/90" : "text-white/30"}
          >
            {error ??
              "Cmd+Enter pour lancer. Plus tu décris l'ambiance, plus le brief est précis."}
          </span>
        </div>
      </motion.div>

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

      {portalOpen && <CosmicPortal />}
    </div>
  );
}
