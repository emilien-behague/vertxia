/**
 * Page d'attente live pendant la generation Vertxia Lite.
 * URL : /lite/[domain]/generating?job=<jobId>
 *
 * Poll GET /api/lite/status/<jobId> toutes les 2s.
 * Quand status=done -> router.push(`/lite/<slug>`).
 * Quand status=failed -> message d'erreur + retour /app.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type JobStatus =
  | "queued"
  | "scraping"
  | "briefing"
  | "generating_videos"
  | "composing"
  | "done"
  | "failed";

type Job = {
  id: string;
  slug: string;
  url: string;
  prompt: string;
  startedAt: number;
  updatedAt: number;
  status: JobStatus;
  currentStep: number;
  totalSteps: number;
  videoProgress?: { current: number; total: number };
  error: string | null;
  redirectSlug: string | null;
  alreadyExists: boolean;
};

const STEPS: { key: JobStatus; label: string; hint: string }[] = [
  { key: "scraping", label: "Scrape boutique", hint: "Recup produits + assets" },
  { key: "briefing", label: "Brief creatif", hint: "Claude genere l'editorial" },
  { key: "generating_videos", label: "Videos AI", hint: "Kling cinematic par produit" },
  { key: "composing", label: "Composition site", hint: "Layout + signature visuelle" },
  { key: "done", label: "Site pret", hint: "Redirect imminent…" },
];

const POLL_INTERVAL_MS = 2000;

export default function GeneratingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job");

  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setError("Aucun job ID dans l'URL");
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/lite/status/${jobId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 404) {
            setError("Job introuvable (id invalide ou expire)");
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data: Job = await res.json();
        if (cancelled) return;
        setJob(data);

        if (data.status === "done" && data.redirectSlug) {
          // Petit delai pour montrer "Site pret" puis redirect
          setTimeout(() => {
            if (!cancelled) router.push(`/lite/${data.redirectSlug}`);
          }, 600);
          return;
        }
        if (data.status === "failed") {
          setError(data.error || "Echec de generation");
          return;
        }

        // Re-poll
        timeoutId = setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        setError(
          "Echec polling status : " +
            (err instanceof Error ? err.message : "unknown")
        );
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [jobId, router]);

  const elapsedSeconds = useMemo(() => {
    if (!job) return 0;
    return Math.floor((Date.now() - job.startedAt) / 1000);
  }, [job]);

  return (
    <main className="min-h-screen bg-[#050505] text-white antialiased flex items-center justify-center p-8 relative overflow-hidden">
      {/* Ambient gradient (cosmic) */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 50% 35% at 50% 50%, rgba(138,63,255,0.16) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      <div className="relative max-w-2xl w-full space-y-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[12px]">
            {error ? (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-white/85">Echec</span>
              </>
            ) : job?.status === "done" ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-white/85">Site pret</span>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-fuchsia-400" />
                </span>
                <span className="text-white/85">
                  Generation en cours · {elapsedSeconds}s
                </span>
              </>
            )}
          </div>
          <h1
            className="text-3xl md:text-4xl font-bold tracking-[-0.02em]"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            {error
              ? "Quelque chose s'est casse"
              : job?.status === "done"
                ? "Ton site est pret."
                : "On compose ton site cinematic."}
          </h1>
          {job && (
            <p className="text-[13.5px] text-white/45">
              <span className="font-mono">{job.url}</span>
              {" · "}
              <span className="italic">{job.prompt}</span>
            </p>
          )}
        </div>

        {/* Timeline */}
        {!error && job && (
          <ol className="space-y-2.5">
            {STEPS.map((step, i) => {
              const stepNum = i + 1;
              const isDone = job.currentStep > stepNum;
              const isActive =
                job.currentStep === stepNum ||
                (job.status === step.key &&
                  job.currentStep === stepNum);
              const isPending = job.currentStep < stepNum;

              return (
                <li
                  key={step.key}
                  className={[
                    "flex items-center gap-4 px-4 py-3 rounded-xl border transition",
                    isDone
                      ? "border-emerald-400/15 bg-emerald-400/[0.04]"
                      : isActive
                        ? "border-fuchsia-400/25 bg-fuchsia-400/[0.06]"
                        : "border-white/[0.06] bg-white/[0.02]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "shrink-0 w-7 h-7 rounded-full grid place-items-center text-[11px] font-semibold",
                      isDone
                        ? "bg-emerald-400/20 text-emerald-300"
                        : isActive
                          ? "bg-fuchsia-400/25 text-fuchsia-200"
                          : "bg-white/[0.06] text-white/45",
                    ].join(" ")}
                  >
                    {isDone ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : isActive ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" className="animate-spin">
                        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="42" strokeDashoffset="14" strokeLinecap="round" />
                      </svg>
                    ) : (
                      stepNum
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={[
                        "text-[13.5px] font-medium",
                        isPending ? "text-white/50" : "text-white",
                      ].join(" ")}
                    >
                      {step.label}
                      {step.key === "generating_videos" &&
                        isActive &&
                        job.videoProgress && (
                          <span className="ml-2 text-fuchsia-200/90 font-mono text-[12px]">
                            {job.videoProgress.current}/{job.videoProgress.total}
                          </span>
                        )}
                    </p>
                    <p className="text-[11.5px] text-white/40 mt-0.5">
                      {step.hint}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-2xl bg-rose-500/[0.06] border border-rose-500/20 p-5 space-y-3">
            <p className="text-[13.5px] text-rose-200/95 leading-relaxed">
              {error}
            </p>
            <div className="flex items-center gap-3 pt-2">
              <Link
                href="/app"
                className="inline-flex items-center gap-2 px-4 h-9 rounded-full bg-white text-black text-[12.5px] font-medium hover:scale-[1.02] transition"
              >
                Retour a la dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Footer hint */}
        {!error && job && job.status !== "done" && (
          <p className="text-center text-[11.5px] text-white/30 leading-relaxed max-w-md mx-auto">
            Le pipeline scrape, ecrit le brief creatif avec Claude puis genere
            les videos avec Kling. Temps moyen : ~10 minutes en prod, ~18 secondes
            en mock (Phase 1).
          </p>
        )}
      </div>
    </main>
  );
}
