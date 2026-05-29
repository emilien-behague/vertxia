/**
 * ShowcaseBento — grille magazine asymetrique des categories d'inspiration.
 *
 * Pas une grille SaaS uniforme. Bento layout :
 * - 1 carte hero (col-span-2 row-span-2)
 * - 2 cartes moyennes (col-span-2 row-span-1)
 * - 3 cartes petites (col-span-1 row-span-1)
 *
 * Inspirations : Apple product grids, Spline templates, Framer marketplace.
 * Empty state propre — pas de SVG cliche, juste gradients + ombres profondes + typo.
 *
 * V0.1 : pas de vraies images upload. Gradients + label flottant + meta info.
 * V0.2 : remplacera gradients par previews videos auto-generees Kling.
 */

import { IconArrowRight } from "./icons";

type Category = {
  key: string;
  label: string;
  hint: string;
  count: string;
  gradient: string;
  span: string;
  accentColor: string;
};

const CATEGORIES: Category[] = [
  {
    key: "luxury",
    label: "Luxury Brand",
    hint: "Editorial · Cinematic videos · Brand storytelling",
    count: "12 templates",
    gradient:
      "radial-gradient(ellipse at 30% 20%, #1a1410 0%, #050505 70%), linear-gradient(135deg, #2a1f15 0%, #0a0a0a 100%)",
    span: "col-span-2 row-span-2",
    accentColor: "#D6B96E",
  },
  {
    key: "fashion",
    label: "Fashion",
    hint: "Lookbook · Drop culture · Editorial",
    count: "8 templates",
    gradient:
      "radial-gradient(ellipse at 70% 30%, #1a0f1f 0%, #050505 70%), linear-gradient(135deg, #1f0a2a 0%, #0a0a0a 100%)",
    span: "col-span-2 row-span-1",
    accentColor: "#C77DFF",
  },
  {
    key: "automotive",
    label: "Automotive",
    hint: "Cinematic launch · Performance specs",
    count: "5 templates",
    gradient:
      "radial-gradient(ellipse at 50% 50%, #0a141a 0%, #050505 70%), linear-gradient(135deg, #102030 0%, #0a0a0a 100%)",
    span: "col-span-2 row-span-1",
    accentColor: "#4F7DFF",
  },
  {
    key: "architecture",
    label: "Architecture",
    hint: "Studio portfolio · Project archive",
    count: "6 templates",
    gradient:
      "radial-gradient(ellipse at 80% 80%, #1a1a14 0%, #050505 70%), linear-gradient(135deg, #1f1f15 0%, #0a0a0a 100%)",
    span: "col-span-1 row-span-1",
    accentColor: "#D6B96E",
  },
  {
    key: "hospitality",
    label: "Hospitality",
    hint: "Boutique hotel · Resort",
    count: "4 templates",
    gradient:
      "radial-gradient(ellipse at 20% 70%, #141a14 0%, #050505 70%), linear-gradient(135deg, #1a2a1f 0%, #0a0a0a 100%)",
    span: "col-span-1 row-span-1",
    accentColor: "#7DD66E",
  },
  {
    key: "tech",
    label: "Tech",
    hint: "SaaS · Product launch",
    count: "9 templates",
    gradient:
      "radial-gradient(ellipse at 50% 30%, #0f141a 0%, #050505 70%), linear-gradient(135deg, #15202a 0%, #0a0a0a 100%)",
    span: "col-span-2 row-span-1",
    accentColor: "#4F7DFF",
  },
];

function CategoryCard({ cat }: { cat: Category }) {
  return (
    <button
      type="button"
      className={[
        "group relative rounded-2xl overflow-hidden border border-white/[0.05] text-left transition-all duration-300",
        "hover:border-white/[0.12] hover:-translate-y-0.5",
        cat.span,
      ].join(" ")}
      style={{
        background: cat.gradient,
        minHeight: cat.span.includes("row-span-2") ? "100%" : "180px",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* Reflet top discret */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)",
        }}
      />

      {/* Accent dot top-left */}
      <span
        className="absolute top-5 left-5 w-1.5 h-1.5 rounded-full"
        style={{ background: cat.accentColor, boxShadow: `0 0 12px ${cat.accentColor}80` }}
      />

      {/* Content bottom */}
      <div className="absolute inset-x-0 bottom-0 p-5">
        <p
          className="text-[10.5px] tracking-[0.18em] uppercase mb-1.5 font-medium"
          style={{ color: `${cat.accentColor}cc` }}
        >
          {cat.count}
        </p>
        <h3
          className="text-white font-medium tracking-tight"
          style={{
            fontSize: cat.span.includes("row-span-2") ? "26px" : "18px",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {cat.label}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <p className="text-[11.5px] text-white/45 leading-relaxed pr-3">
            {cat.hint}
          </p>
          <span
            className="shrink-0 w-7 h-7 rounded-full grid place-items-center text-white/40 group-hover:text-white group-hover:bg-white/[0.08] transition-all duration-300"
          >
            <IconArrowRight size={13} />
          </span>
        </div>
      </div>
    </button>
  );
}

export function ShowcaseBento() {
  return (
    <div className="w-full max-w-[1100px] mx-auto px-8 pt-10 pb-32">
      {/* Header discret */}
      <div className="mb-7 flex items-end justify-between">
        <div>
          <p className="text-[10.5px] tracking-[0.22em] uppercase text-white/35 font-medium mb-1.5">
            Start from inspiration
          </p>
          <h2
            className="text-white font-medium tracking-[-0.02em]"
            style={{ fontFamily: "Inter, sans-serif", fontSize: "22px" }}
          >
            Curated templates for premium brands
          </h2>
        </div>
        <button
          type="button"
          className="text-[12px] text-white/55 hover:text-white transition-colors flex items-center gap-1.5"
        >
          Browse all
          <IconArrowRight size={12} />
        </button>
      </div>

      {/* Bento grid 4 colonnes, rows auto */}
      <div className="grid grid-cols-4 gap-3 auto-rows-[180px]">
        {CATEGORIES.map((cat) => (
          <CategoryCard key={cat.key} cat={cat} />
        ))}
      </div>
    </div>
  );
}
