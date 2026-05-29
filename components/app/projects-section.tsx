/**
 * ProjectsSection — tabs + grille de cartes projet (preview live des sites Lite generes).
 * Sous le hero, scroll naturel. Server-component (pas d'etat — tabs visuels seulement).
 */

import { IconArrowRight } from "./icons";

type ProjectCard = {
  domain: string;
  name: string;
  hint: string;
  poster: string;
};

const projects: ProjectCard[] = [
  {
    domain: "allbirds_com",
    name: "Allbirds",
    hint: "Editorial · Halftone print",
    poster: "/lite/videos/allbirds_com/sugar-zeffers-lux-beige.mp4",
  },
  {
    domain: "loom_fr",
    name: "Loom",
    hint: "Cinematic · Film grain",
    poster: "/lite/videos/loom_fr/la-veste.mp4",
  },
];

const tabs = ["My projects", "Recently viewed", "Vertxia templates"];

export function ProjectsSection() {
  return (
    <section className="relative px-8 pt-8 pb-16 bg-[#050505]">
      {/* TABS */}
      <div className="flex items-end justify-between mb-7 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/[0.06] p-1">
          {tabs.map((t, i) => (
            <button
              key={t}
              type="button"
              className={[
                "px-4 py-1.5 rounded-full text-[13px] transition",
                i === 0
                  ? "bg-white/[0.08] text-white"
                  : "text-white/55 hover:text-white/85",
              ].join(" ")}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 text-[13px] text-white/65 hover:text-white transition"
        >
          Browse all
          <IconArrowRight size={14} className="text-white/70" />
        </button>
      </div>

      {/* CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-[1400px] mx-auto">
        {projects.map((p) => (
          <a
            key={p.domain}
            href={`/lite/${p.domain}`}
            className="group rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.14] hover:bg-white/[0.05] transition overflow-hidden"
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-black">
              <video
                src={p.poster}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover scale-105 group-hover:scale-110 transition-transform duration-700"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.55) 100%)",
                }}
              />
            </div>
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div>
                <p className="text-[14px] font-medium text-white">{p.name}</p>
                <p className="text-[11.5px] text-white/45 mt-0.5">{p.hint}</p>
              </div>
              <span className="text-white/30 group-hover:text-white/70 transition">
                <IconArrowRight size={14} />
              </span>
            </div>
          </a>
        ))}

        {/* New project placeholder card */}
        <button
          type="button"
          className="group rounded-2xl bg-white/[0.02] border border-dashed border-white/[0.12] hover:border-white/[0.25] hover:bg-white/[0.04] transition aspect-[16/10] md:aspect-auto md:min-h-[230px] flex flex-col items-center justify-center text-center px-6"
        >
          <span className="w-10 h-10 rounded-full bg-white/[0.06] grid place-items-center text-white/65 group-hover:text-white group-hover:bg-white/[0.1] transition mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <p className="text-[13.5px] font-medium text-white/85">
            Nouveau site
          </p>
          <p className="text-[11.5px] text-white/45 mt-1">
            Colle une URL Shopify ci-dessus
          </p>
        </button>
      </div>
    </section>
  );
}
