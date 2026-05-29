"use client";

/**
 * Context Panel droit — Vertxia Studio.
 *
 * 3 sections (refonte v2) :
 *   1. Creative DNA  : Brand / Voice / Palette / Typography
 *   2. Knowledge     : Assets / References / Documents
 *   3. Generation    : Engine / Templates / Automation
 *
 * Pas accordeon (l'ancien etait trop "control panel"). Sections plates avec
 * sub-items cliquables. Inspiration : Figma right panel, Linear settings.
 */

import {
  IconPalette,
  IconType,
  IconWaveform,
  IconImage,
  IconCompass,
  IconFile,
  IconSparkles,
  IconLayoutGrid,
  IconWand,
  IconRepeat,
  IconChevronRight,
} from "./icons";

type SubItem = {
  key: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
};

type Section = {
  key: string;
  label: string;
  items: SubItem[];
};

const SECTIONS: Section[] = [
  {
    key: "dna",
    label: "Creative DNA",
    items: [
      { key: "brand",      label: "Brand",       hint: "Identity & values",  icon: <IconSparkles size={14} /> },
      { key: "voice",      label: "Voice",       hint: "Tone of voice",      icon: <IconWaveform size={14} /> },
      { key: "palette",    label: "Palette",     hint: "Colors & moods",     icon: <IconPalette size={14} /> },
      { key: "typography", label: "Typography",  hint: "Type system",        icon: <IconType size={14} /> },
    ],
  },
  {
    key: "knowledge",
    label: "Knowledge",
    items: [
      { key: "assets",     label: "Assets",      hint: "Images, videos",     icon: <IconImage size={14} /> },
      { key: "references", label: "References",  hint: "Inspiration sites",  icon: <IconCompass size={14} /> },
      { key: "documents",  label: "Documents",   hint: "Brand docs, briefs", icon: <IconFile size={14} /> },
    ],
  },
  {
    key: "generation",
    label: "Generation",
    items: [
      { key: "engine",     label: "Engine",      hint: "Kling, Runway, Veo", icon: <IconWand size={14} /> },
      { key: "templates",  label: "Templates",   hint: "Editorial, Brutal…", icon: <IconLayoutGrid size={14} /> },
      { key: "automation", label: "Automation",  hint: "Triggers, schedules",icon: <IconRepeat size={14} /> },
    ],
  },
];

function SubItemRow({ item }: { item: SubItem }) {
  return (
    <button
      type="button"
      className="group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors text-left"
    >
      <span className="shrink-0 w-6 h-6 grid place-items-center rounded-md bg-white/[0.04] text-white/55 group-hover:text-white/85 transition-colors">
        {item.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] text-white/85 truncate font-medium">
          {item.label}
        </p>
        {item.hint && (
          <p className="text-[10.5px] text-white/35 truncate mt-0.5">
            {item.hint}
          </p>
        )}
      </div>
      <span className="text-white/25 group-hover:text-white/55 transition-colors">
        <IconChevronRight size={12} />
      </span>
    </button>
  );
}

function SectionBlock({ section }: { section: Section }) {
  return (
    <div className="px-3 py-4">
      <p className="px-3 mb-2 text-[10px] tracking-[0.22em] uppercase text-white/35 font-medium">
        {section.label}
      </p>
      <div className="space-y-0.5">
        {section.items.map((item) => (
          <SubItemRow key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}

export function ContextPanel() {
  return (
    <aside
      className="shrink-0 h-screen w-[300px] bg-[#080808] border-l border-white/[0.05] flex flex-col"
      aria-label="Context panel"
    >
      {/* Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-white/[0.05]">
        <div className="min-w-0">
          <p className="text-[10px] tracking-[0.22em] uppercase text-white/35 font-medium">
            Project
          </p>
          <p className="text-[13px] font-medium text-white mt-0.5 truncate">
            Untitled draft
          </p>
        </div>
        <button
          type="button"
          aria-label="Collapse panel"
          className="w-7 h-7 grid place-items-center rounded-md text-white/40 hover:text-white/80 hover:bg-white/[0.04] transition"
        >
          <IconChevronRight size={13} />
        </button>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
        {SECTIONS.map((s) => (
          <SectionBlock key={s.key} section={s} />
        ))}
      </div>

      {/* Footer status discret */}
      <div className="px-5 py-3 border-t border-white/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10.5px] text-white/45 font-mono">
            Studio ready
          </span>
        </div>
        <span className="text-[10px] text-white/30 font-mono">v0.2</span>
      </div>
    </aside>
  );
}
