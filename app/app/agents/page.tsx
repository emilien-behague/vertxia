"use client";

/**
 * /app/agents — agents IA specialises (Coming soon V0.1).
 *
 * Concept : chaque agent est un module autonome qui prend une responsabilite
 * dans le pipeline Vertxia. V0.1 = teaser des 3 agents en cours de developpement,
 * pas d'execution reelle.
 *
 * Pas de "Coming soon" cliche centre — chaque agent a sa propre carte avec
 * description + status + waitlist subscribe.
 */

import { motion } from "framer-motion";
import { useState } from "react";
import {
  PageShell,
  GhostButton,
  SectionTitle,
} from "@/components/app/page-shell";
import {
  IconBot,
  IconPalette,
  IconCompass,
  IconUsers,
  IconSparkles,
  IconChevronRight,
} from "@/components/app/icons";

type AgentStatus = "preview" | "alpha" | "soon";

type Agent = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  status: AgentStatus;
  icon: React.ReactNode;
  accent: string;
  capabilities: string[];
};

const AGENTS: Agent[] = [
  {
    id: "brand-voice",
    name: "Brand Voice Agent",
    tagline: "Extracteur d'identite editoriale",
    description:
      "Scrute ta brand (site, posts, packaging) et distille ton ton, ton vocabulaire, tes reflexes. Chaque texte genere passe par ses regles — plus de copy gen 'IA generique'.",
    status: "alpha",
    icon: <IconPalette size={20} />,
    accent: "#D6B96E",
    capabilities: ["Tone matching", "Glossary builder", "Forbidden words", "Voice transfer"],
  },
  {
    id: "visual-director",
    name: "Visual Director",
    tagline: "Direction artistique cinematic",
    description:
      "Compose les shots video, choisit l'engine optimal selon le mood (Kling/Runway/Veo/Higgsfield), arbitre cadrage / focal / palette. Le co-pilote du video-engine-router.",
    status: "preview",
    icon: <IconCompass size={20} />,
    accent: "#8EA5FF",
    capabilities: ["Mood routing", "Shot composition", "Engine arbitration", "Palette lock"],
  },
  {
    id: "distribution",
    name: "Distribution Strategist",
    tagline: "Multi-canal scheduler",
    description:
      "Decoupe ton site en assets natifs par plateforme (Reels vertical, TikTok 9:16, LinkedIn 1:1, posts statiques) avec hooks adaptes a chaque canal et timing optimal.",
    status: "soon",
    icon: <IconUsers size={20} />,
    accent: "#FFA8C8",
    capabilities: ["Reels cuts", "Hook variations", "Cross-post schedule", "Performance loop"],
  },
];

const STATUS_LABELS: Record<AgentStatus, { label: string; color: string; bg: string }> = {
  alpha:   { label: "Alpha",        color: "rgb(180, 240, 200)", bg: "rgba(80, 200, 140, 0.12)" },
  preview: { label: "Preview soon", color: "rgb(255, 220, 140)", bg: "rgba(255, 196, 60, 0.10)" },
  soon:    { label: "Soon",         color: "rgb(200, 200, 220)", bg: "rgba(180, 180, 220, 0.08)" },
};

export default function AgentsPage() {
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());

  function toggleSubscribe(id: string) {
    setSubscribed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <PageShell
      eyebrow="Specialized AI"
      title="Agents"
      description="Des agents IA verticaux, chacun expert d'une dimension du pipeline. Pas de chatbot generaliste — des collaborateurs avec un metier."
      actions={
        <GhostButton>
          <IconSparkles size={14} /> Suggest an agent
        </GhostButton>
      }
    >
      <SectionTitle>En developpement actif</SectionTitle>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {AGENTS.map((a, i) => {
          const status = STATUS_LABELS[a.status];
          const isSubscribed = subscribed.has(a.id);
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.06 * i,
                ease: [0.22, 1, 0.36, 1] as const,
              }}
              className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] p-6 flex flex-col"
            >
              {/* Accent diffus en haut */}
              <div
                aria-hidden
                className="absolute -top-20 -left-10 w-48 h-48 rounded-full pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${a.accent}26 0%, transparent 65%)`,
                  filter: "blur(20px)",
                }}
              />

              <div className="relative flex items-start justify-between gap-4">
                <div
                  className="w-11 h-11 rounded-xl grid place-items-center"
                  style={{
                    background: a.accent + "18",
                    color: a.accent,
                    border: `1px solid ${a.accent}30`,
                  }}
                >
                  {a.icon}
                </div>
                <span
                  className="text-[10.5px] tracking-[0.16em] uppercase font-medium px-2 py-0.5 rounded-full border"
                  style={{
                    color: status.color,
                    background: status.bg,
                    borderColor: status.color + "30",
                  }}
                >
                  {status.label}
                </span>
              </div>

              <h3 className="relative mt-5 text-[16px] font-semibold text-white tracking-tight">
                {a.name}
              </h3>
              <p className="relative mt-0.5 text-[12.5px] text-white/55">{a.tagline}</p>

              <p className="relative mt-4 text-[13px] text-white/70 leading-relaxed">
                {a.description}
              </p>

              <ul className="relative mt-5 space-y-1.5 mb-6">
                {a.capabilities.map((c) => (
                  <li key={c} className="flex items-center gap-2 text-[12px] text-white/55">
                    <span
                      className="w-1 h-1 rounded-full"
                      style={{ background: a.accent }}
                    />
                    {c}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => toggleSubscribe(a.id)}
                className={[
                  "relative mt-auto inline-flex items-center justify-between h-9 px-4 rounded-xl text-[12.5px] font-medium transition",
                  isSubscribed
                    ? "bg-white text-black"
                    : "bg-white/[0.06] border border-white/[0.08] text-white hover:bg-white/[0.10]",
                ].join(" ")}
              >
                <span>{isSubscribed ? "Tu seras notifie" : "Me notifier au lancement"}</span>
                <IconChevronRight size={13} />
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom hint */}
      <div className="mt-12 flex items-center gap-3 text-[12.5px] text-white/40 max-w-2xl">
        <IconBot size={14} className="shrink-0" />
        <span>
          Une idee d'agent qui n'est pas dans la liste ? Vertxia construit son roadmap en
          public — les votes des utilisateurs decident des prochains agents.
        </span>
      </div>
    </PageShell>
  );
}
