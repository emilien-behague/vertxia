"use client";

/**
 * Context Panel droit — Brand identity / Assets / Style refs / Inspirations / AI settings.
 * V0.1 squelette : structure de base, sections vides avec empty states elegants.
 * Sera enrichi quand on aura les data models brand/assets etc.
 */

import { motion } from "framer-motion";
import { useState } from "react";
import {
  IconPalette,
  IconImage,
  IconSparkles,
  IconCompass,
  IconSettings,
  IconChevronRight,
} from "./icons";

type Section = {
  key: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
};

const SECTIONS: Section[] = [
  { key: "brand",       label: "Brand identity",     hint: "Logo, palette, typography",   icon: <IconPalette size={16} /> },
  { key: "assets",      label: "Assets",             hint: "Images, vidéos uploaded",     icon: <IconImage size={16} /> },
  { key: "references",  label: "Style references",   hint: "Sites + moodboards refs",     icon: <IconCompass size={16} /> },
  { key: "inspirations",label: "Inspirations",       hint: "Idées + briefs sauvés",       icon: <IconSparkles size={16} /> },
  { key: "ai",          label: "AI settings",        hint: "Template, signature, engine", icon: <IconSettings size={16} /> },
];

function SectionAccordion({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
      >
        <span className="shrink-0 w-7 h-7 grid place-items-center rounded-md bg-white/[0.04] text-white/70">
          {section.icon}
        </span>
        <div className="flex-1 text-left min-w-0">
          <p className="text-[12.5px] font-medium text-white truncate">
            {section.label}
          </p>
          <p className="text-[10.5px] text-white/40 truncate">{section.hint}</p>
        </div>
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] as const }}
          className="text-white/40"
        >
          <IconChevronRight size={14} />
        </motion.span>
      </button>

      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }}
        className="overflow-hidden"
      >
        <div className="px-4 pb-4 pt-1">
          <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-4 text-center">
            <p className="text-[11px] text-white/40">
              Rien encore — bientôt disponible.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function ContextPanel() {
  return (
    <aside
      className="shrink-0 h-screen w-[320px] bg-[#080808] border-l border-white/[0.05] flex flex-col"
      aria-label="Panneau de contexte projet"
    >
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/[0.05]">
        <div>
          <p className="text-[10.5px] tracking-[0.18em] uppercase text-white/35 font-medium">
            Project
          </p>
          <p className="text-[13px] font-medium text-white mt-0.5">
            Untitled draft
          </p>
        </div>
        <button
          type="button"
          aria-label="Collapse panel"
          className="w-7 h-7 grid place-items-center rounded-md text-white/40 hover:text-white/80 hover:bg-white/[0.04] transition"
        >
          <IconChevronRight size={14} />
        </button>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
        {SECTIONS.map((s) => (
          <SectionAccordion key={s.key} section={s} />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/[0.05]">
        <p className="text-[10.5px] text-white/35 leading-relaxed">
          Le context panel garde le contexte de ta marque pour chaque création — brand, assets, références, settings IA.
        </p>
      </div>
    </aside>
  );
}
