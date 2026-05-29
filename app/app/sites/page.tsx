"use client";

/**
 * /app/sites — sites cinematic publies / partageables.
 *
 * Difference avec /projects : /sites montre uniquement les CREATIONS DEPLOYEES
 * (avec un slug live actif), avec leurs metrics de partage et le statut deploy.
 *
 * V0.1 : extrait les MOCK_PROJECTS avec liveSlug + ajoute allbirds-sugar (vraie demo statique).
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
import {
  IconGlobe,
  IconArrowRight,
  IconPlus,
  IconRepeat,
} from "@/components/app/icons";

type LiveSite = {
  id: string;
  label: string;
  category: string;
  imageUrl: string;
  slug: string;
  domain: string;
  publishedAt: string;
  views: number;
};

// V0.1 : liste durcie. V0.2 = derive de la DB user.
function buildLiveSites(): LiveSite[] {
  const base = MOCK_PROJECTS.filter((p) => p.liveSlug).map((p) => ({
    id: p.id,
    label: p.label,
    category: p.category,
    imageUrl: p.imageUrl,
    slug: p.liveSlug!,
    domain: `vertxia.com/lite/${p.liveSlug}`,
    publishedAt: "2026-05-29",
    views: Math.floor(80 + (p.id.length * 47) % 240),
  }));

  // Demo statique "allbirds-sugar" (vraie page existante sous /app/lite/allbirds-sugar)
  base.unshift({
    id: "allbirds-sugar-demo",
    label: "Allbirds · Sugar",
    category: "Editorial · Halftone",
    imageUrl: "https://picsum.photos/seed/allbirds-sugar-demo/640/400",
    slug: "allbirds-sugar",
    domain: "vertxia.com/lite/allbirds-sugar",
    publishedAt: "2026-05-28",
    views: 412,
  });

  return base;
}

export default function SitesPage() {
  const router = useRouter();
  const sites = buildLiveSites();

  return (
    <PageShell
      eyebrow="Deployed"
      title="Sites"
      description="Tes sites cinematic publies, prets a partager. URL unique, mises a jour en un clic."
      actions={
        <>
          <GhostButton onClick={() => router.push("/app/projects")}>
            All projects
          </GhostButton>
          <PrimaryButton onClick={() => router.push("/app")}>
            <IconPlus size={14} /> New site
          </PrimaryButton>
        </>
      }
    >
      {sites.length === 0 ? (
        <EmptyState
          icon={<IconGlobe size={20} />}
          title="Aucun site publie"
          description="Genere ton premier site depuis la home — il sera live en moins de 60 secondes."
          action={
            <PrimaryButton onClick={() => router.push("/app")}>
              <IconPlus size={14} /> Creer un site
            </PrimaryButton>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sites.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.05 * i,
                ease: [0.22, 1, 0.36, 1] as const,
              }}
              className="rounded-2xl overflow-hidden bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.14] transition-colors flex"
            >
              {/* Thumbnail */}
              <div className="relative w-[42%] shrink-0 overflow-hidden bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.imageUrl}
                  alt={s.label}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(135deg, transparent 0%, rgba(0,0,0,0.35) 100%)",
                  }}
                />
              </div>

              {/* Meta */}
              <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10.5px] tracking-[0.18em] uppercase font-medium text-emerald-300/90">
                      Live
                    </span>
                  </div>
                  <p className="mt-2 text-[15px] font-medium text-white truncate">
                    {s.label}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-white/45 truncate">
                    {s.category}
                  </p>
                  <p className="mt-3 text-[12px] text-white/55 truncate font-mono">
                    {s.domain}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[11.5px] text-white/40">
                    {s.views.toLocaleString("fr-FR")} vues · {s.publishedAt}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Re-generer"
                      className="w-8 h-8 grid place-items-center rounded-lg text-white/55 hover:text-white hover:bg-white/[0.06] transition"
                    >
                      <IconRepeat size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/lite/${s.slug}`)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-white text-[12px] font-medium transition"
                    >
                      Open <IconArrowRight size={11} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
