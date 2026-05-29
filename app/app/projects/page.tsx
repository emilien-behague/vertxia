"use client";

/**
 * /app/projects — bibliotheque des projets utilisateur.
 *
 * V0.1 : utilise MOCK_PROJECTS comme placeholders premium (8 projets fictifs).
 * Hover hover-lift, click -> /lite/<slug> si liveSlug, sinon no-op (V0.2 page projet).
 *
 * Pas de grille perspective au sol, pas de particules, pas de gros titre centre.
 * Linear/Notion style : grille reguliere 3 colonnes, cards sobres.
 */

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  PageShell,
  PrimaryButton,
  GhostButton,
  EmptyState,
} from "@/components/app/page-shell";
import { MOCK_PROJECTS } from "@/lib/mock-projects";
import { IconPlus, IconLayoutGrid, IconArrowRight } from "@/components/app/icons";

export default function ProjectsPage() {
  const router = useRouter();
  const projects = MOCK_PROJECTS;

  return (
    <PageShell
      eyebrow="Workspace"
      title="Projects"
      description="Toutes tes creations Vertxia — sites cinematic, campagnes, lookbooks. Ouvre, edite, re-genere."
      actions={
        <>
          <GhostButton onClick={() => router.push("/app")}>
            <IconLayoutGrid size={14} /> Gallery view
          </GhostButton>
          <PrimaryButton onClick={() => router.push("/app")}>
            <IconPlus size={14} /> New project
          </PrimaryButton>
        </>
      }
    >
      {projects.length === 0 ? (
        <EmptyState
          icon={<IconLayoutGrid size={20} />}
          title="Aucun projet pour l'instant"
          description="Cree ton premier site cinematic en collant une URL Shopify depuis la home."
          action={
            <PrimaryButton onClick={() => router.push("/app")}>
              <IconPlus size={14} /> Creer un projet
            </PrimaryButton>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p, i) => (
            <motion.button
              key={p.id}
              type="button"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.04 * i,
                ease: [0.22, 1, 0.36, 1] as const,
              }}
              onClick={() => p.liveSlug && router.push(`/lite/${p.liveSlug}`)}
              className="group text-left rounded-2xl overflow-hidden bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.14] transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative aspect-[4/3] overflow-hidden bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageUrl}
                  alt={p.label}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.45) 100%)",
                  }}
                />
                {p.liveSlug && (
                  <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] tracking-[0.14em] uppercase font-medium bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 backdrop-blur-sm">
                    Live
                  </span>
                )}
              </div>

              {/* Meta */}
              <div className="px-5 py-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10.5px] tracking-[0.18em] uppercase font-medium text-[#D6B96E]/85">
                    {p.category}
                  </p>
                  <p className="mt-0.5 text-[14px] font-medium text-white truncate">
                    {p.label}
                  </p>
                  <p className="mt-1 text-[12px] text-white/45 truncate">
                    {p.hint}
                  </p>
                </div>
                <IconArrowRight
                  size={14}
                  className="shrink-0 mt-1 text-white/30 group-hover:text-white group-hover:translate-x-0.5 transition"
                />
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </PageShell>
  );
}
