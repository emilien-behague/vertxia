"use client";

/**
 * Command Bar — barre de creation flottante en bas de l'ecran.
 * Inspiration : Raycast launcher, Linear command palette.
 *
 * Style :
 * - position fixed bottom 24px, centree horizontalement (calee sur le workspace centre)
 * - largeur ~640px, hauteur 52px
 * - glassmorphism dark : rgba(15,15,15,0.85) + backdrop-blur(28px) + border subtle
 * - coins arrondis 16px
 * - placeholder rotating toutes 3.5s (Create a luxury brand website... -> Build a cinematic landing page... -> Build an AI sales agent...)
 * - shortcut Cmd+K pour focus
 *
 * Submit : meme flow que command-surface (POST /api/lite/generate + portail R3F + redirect).
 */

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { extractDomainAndSlug } from "@/lib/url-to-slug";

const CosmicPortal = dynamic(() => import("./cosmic-portal"), { ssr: false });

const PORTAL_DURATION_MS = 1400;
const MAX_INPUT_CHARS = 500;

const PLACEHOLDERS = [
  "Create a luxury brand website…",
  "Build a cinematic landing page…",
  "Generate a fashion lookbook from allbirds.com…",
  "Compose a hospitality boutique site…",
  "Design an automotive launch page…",
] as const;

export function CommandBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [phIndex, setPhIndex] = useState(0);

  // Rotating placeholder toutes les 3.5s (uniquement quand input vide + pas focus)
  useEffect(() => {
    if (focused || value) return;
    const id = setInterval(() => {
      setPhIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3500);
    return () => clearInterval(id);
  }, [focused, value]);

  // Cmd+K / Ctrl+K = focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <>
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
        style={{ width: "min(640px, calc(100vw - 480px))" }}
      >
        {/* Error message above the bar */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2 px-3.5 py-2 rounded-lg pointer-events-auto"
            style={{
              background: "rgba(220, 38, 80, 0.10)",
              border: "1px solid rgba(220, 38, 80, 0.20)",
              color: "rgba(252, 180, 200, 0.95)",
              fontSize: "12px",
            }}
          >
            {error}
          </motion.div>
        )}

        <motion.div
          className="relative pointer-events-auto"
          animate={{
            scale: focused ? 1.005 : 1,
          }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }}
        >
          {/* Glow halo derriere quand focus */}
          <div
            aria-hidden
            className="absolute -inset-2 rounded-[24px] pointer-events-none transition-opacity duration-500"
            style={{
              background:
                "radial-gradient(60% 100% at 50% 100%, rgba(79,125,255,0.22) 0%, rgba(138,92,255,0.08) 50%, transparent 80%)",
              filter: "blur(16px)",
              opacity: focused ? 1 : 0.35,
            }}
          />

          <div
            className="relative flex items-center h-[52px] rounded-[16px] transition-colors duration-300"
            style={{
              background: "rgba(15, 15, 15, 0.85)",
              backdropFilter: "blur(28px) saturate(1.2)",
              WebkitBackdropFilter: "blur(28px) saturate(1.2)",
              border: focused
                ? "1px solid rgba(79,125,255,0.40)"
                : "1px solid rgba(255,255,255,0.08)",
              boxShadow:
                "0 12px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            {/* Reflet top */}
            <div
              aria-hidden
              className="absolute inset-x-4 top-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
              }}
            />

            {/* Mode dot */}
            <div className="pl-4 pr-3 flex items-center gap-2 shrink-0">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "#4F7DFF", boxShadow: "0 0 8px rgba(79,125,255,0.6)" }}
              />
              <span className="text-[11px] text-white/45 font-medium tracking-tight hidden md:inline">
                Site
              </span>
              <span className="w-px h-4 bg-white/[0.08] mx-1.5" />
            </div>

            {/* Input + animated placeholder */}
            <div className="flex-1 relative h-full">
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={handleKeyDown}
                maxLength={MAX_INPUT_CHARS}
                disabled={submitting}
                className="absolute inset-0 bg-transparent text-[14px] text-white outline-none pr-4"
                style={{ caretColor: "#4F7DFF" }}
                aria-label="Command input"
              />
              {/* Rotating placeholder visible quand vide et pas focus */}
              {!value && (
                <div className="absolute inset-0 flex items-center pointer-events-none">
                  <motion.span
                    key={phIndex}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }}
                    className="text-[14px] text-white/35 truncate pr-8"
                  >
                    {PLACEHOLDERS[phIndex]}
                  </motion.span>
                </div>
              )}
            </div>

            {/* Right : shortcut hint OR submit */}
            <div className="pr-3 flex items-center gap-2 shrink-0">
              {value.trim() ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={[
                    "h-8 px-3 rounded-md text-[12px] font-medium transition-all flex items-center gap-1.5",
                    submitting
                      ? "bg-white/[0.08] text-white/40 cursor-not-allowed"
                      : "bg-white text-black hover:scale-[1.02]",
                  ].join(" ")}
                >
                  {submitting ? (
                    <span className="flex items-center gap-1">
                      <span className="vsig-dot vsig-dot-1" />
                      <span className="vsig-dot vsig-dot-2" />
                      <span className="vsig-dot vsig-dot-3" />
                    </span>
                  ) : (
                    <>
                      Run
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </>
                  )}
                </button>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-white/35 font-mono">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">
                    ⌘
                  </kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">
                    K
                  </kbd>
                </span>
              )}
            </div>
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
      </div>

      {portalOpen && <CosmicPortal />}
    </>
  );
}
