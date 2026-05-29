"use client";

/**
 * /app/videos — bibliotheque des videos AI generees.
 *
 * Chaque video est un asset cinematic produit par les engines Kling/Runway/Veo/Higgsfield/Hailuo
 * via le video-engine-router. La page montre l'engine utilise + duration + statut.
 *
 * V0.1 : 8 mocks Picsum (thumbnails) avec engine badges. V0.2 = real DB + lecteur inline.
 */

import { motion } from "framer-motion";
import { useState } from "react";
import {
  PageShell,
  PrimaryButton,
  GhostButton,
  SectionTitle,
} from "@/components/app/page-shell";
import { IconPlay, IconPlus, IconWaveform } from "@/components/app/icons";

type EngineKey = "kling" | "runway" | "veo" | "higgsfield" | "hailuo";

type VideoAsset = {
  id: string;
  title: string;
  project: string;
  engine: EngineKey;
  durationSec: number;
  thumbnail: string;
  createdAt: string;
};

const ENGINE_BADGES: Record<EngineKey, { label: string; color: string; bg: string }> = {
  kling:      { label: "Kling 2.1",   color: "rgb(255, 220, 130)", bg: "rgba(255, 196, 60, 0.10)" },
  runway:     { label: "Runway Gen-4", color: "rgb(180, 200, 255)", bg: "rgba(120, 150, 255, 0.10)" },
  veo:        { label: "Veo 3",        color: "rgb(160, 240, 200)", bg: "rgba(80, 200, 140, 0.10)" },
  higgsfield: { label: "Higgsfield",   color: "rgb(255, 180, 230)", bg: "rgba(220, 140, 200, 0.10)" },
  hailuo:     { label: "Hailuo",       color: "rgb(220, 200, 255)", bg: "rgba(170, 140, 240, 0.10)" },
};

const MOCK_VIDEOS: VideoAsset[] = [
  { id: "v1", title: "Allbirds Sugar — hero loop",      project: "Allbirds · Sugar",    engine: "kling",      durationSec: 6,  thumbnail: "https://picsum.photos/seed/v-allbirds-1/640/360", createdAt: "il y a 12 min" },
  { id: "v2", title: "Macro stitching close-up",        project: "Margiela · Edition",  engine: "runway",     durationSec: 4,  thumbnail: "https://picsum.photos/seed/v-margiela-1/640/360", createdAt: "il y a 1h" },
  { id: "v3", title: "Loom — soft natural light",       project: "Loom · Vestiaire",    engine: "kling",      durationSec: 8,  thumbnail: "https://picsum.photos/seed/v-loom-1/640/360",     createdAt: "il y a 2h" },
  { id: "v4", title: "Porsche reveal dolly",            project: "Porsche Heritage",    engine: "veo",        durationSec: 10, thumbnail: "https://picsum.photos/seed/v-porsche-1/640/360",  createdAt: "il y a 4h" },
  { id: "v5", title: "Cartier macro spin",              project: "Cartier Tank Solo",   engine: "higgsfield", durationSec: 5,  thumbnail: "https://picsum.photos/seed/v-cartier-1/640/360",  createdAt: "il y a 6h" },
  { id: "v6", title: "Riva sunset cruise",              project: "Riva Aquariva Super", engine: "kling",      durationSec: 12, thumbnail: "https://picsum.photos/seed/v-riva-1/640/360",     createdAt: "il y a 1j" },
  { id: "v7", title: "Fenty drop teaser",               project: "Fenty · Launch",      engine: "hailuo",     durationSec: 6,  thumbnail: "https://picsum.photos/seed/v-fenty-1/640/360",    createdAt: "il y a 1j" },
  { id: "v8", title: "Aman lobby reveal",               project: "Aman Sveti Stefan",   engine: "veo",        durationSec: 9,  thumbnail: "https://picsum.photos/seed/v-aman-1/640/360",     createdAt: "il y a 2j" },
];

const FILTER_OPTIONS: Array<EngineKey | "all"> = ["all", "kling", "runway", "veo", "higgsfield", "hailuo"];

export default function VideosPage() {
  const [filter, setFilter] = useState<EngineKey | "all">("all");

  const filtered = filter === "all" ? MOCK_VIDEOS : MOCK_VIDEOS.filter((v) => v.engine === filter);

  return (
    <PageShell
      eyebrow="Media library"
      title="Videos"
      description="Videos cinematic generees par tes projets. Chaque video est routee vers l'engine optimal selon le mood et le produit."
      actions={
        <>
          <GhostButton>
            <IconWaveform size={14} /> Audio assets
          </GhostButton>
          <PrimaryButton>
            <IconPlus size={14} /> Generate video
          </PrimaryButton>
        </>
      }
    >
      {/* Filtres engine */}
      <div className="mb-8">
        <SectionTitle>Filtrer par engine</SectionTitle>
        <div className="flex items-center gap-2 flex-wrap">
          {FILTER_OPTIONS.map((opt) => {
            const isActive = filter === opt;
            const label = opt === "all" ? "Tous" : ENGINE_BADGES[opt].label;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setFilter(opt)}
                className={[
                  "h-8 px-3 rounded-lg text-[12.5px] transition",
                  isActive
                    ? "bg-white text-black font-medium"
                    : "bg-white/[0.03] border border-white/[0.08] text-white/70 hover:text-white hover:bg-white/[0.06]",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((v, i) => {
          const badge = ENGINE_BADGES[v.engine];
          return (
            <motion.button
              key={v.id}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.035 * i, ease: [0.22, 1, 0.36, 1] as const }}
              className="group text-left rounded-xl overflow-hidden bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.14] transition"
            >
              <div className="relative aspect-video bg-black overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                {/* Overlay play */}
                <div
                  aria-hidden
                  className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/30 transition-colors"
                >
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity w-11 h-11 rounded-full bg-white/95 grid place-items-center text-black">
                    <IconPlay size={18} />
                  </span>
                </div>
                {/* Duration */}
                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md text-[10.5px] font-medium text-white bg-black/65 backdrop-blur-sm">
                  {v.durationSec}s
                </span>
                {/* Engine badge */}
                <span
                  className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] tracking-[0.12em] uppercase font-medium border backdrop-blur-md"
                  style={{
                    color: badge.color,
                    background: badge.bg,
                    borderColor: badge.color + "30",
                  }}
                >
                  {badge.label}
                </span>
              </div>
              <div className="px-3 py-3">
                <p className="text-[13px] font-medium text-white truncate">
                  {v.title}
                </p>
                <p className="mt-0.5 text-[11.5px] text-white/45 truncate">
                  {v.project} · {v.createdAt}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </PageShell>
  );
}
