"use client";

/**
 * Sidebar Vertxia Studio — compacte icons-only.
 * Largeur 80px par defaut, hover-expand a 120px avec labels apparaissant.
 *
 * Inspirations : Linear, Arc Browser, Figma.
 * Pas de section labels, pas de bottom cards "Share/Upgrade" (kitsch SaaS).
 * Active state : background graphite + accent or subtil border-left.
 */

import { motion } from "framer-motion";
import { useState } from "react";
import {
  IconHome,
  IconLayoutGrid,
  IconGlobe,
  IconPlay,
  IconBot,
  IconImage,
  IconSettings,
} from "./icons";

type NavItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

const NAV: NavItem[] = [
  { key: "home",     label: "Home",     icon: <IconHome size={19} /> },
  { key: "projects", label: "Projects", icon: <IconLayoutGrid size={19} /> },
  { key: "sites",    label: "Sites",    icon: <IconGlobe size={19} /> },
  { key: "videos",   label: "Videos",   icon: <IconPlay size={19} /> },
  { key: "agents",   label: "Agents",   icon: <IconBot size={19} /> },
  { key: "assets",   label: "Assets",   icon: <IconImage size={19} /> },
];

const ACTIVE_KEY = "home"; // V0.1 statique. Plus tard via usePathname.

const SPRING = { type: "spring" as const, stiffness: 220, damping: 24, mass: 0.6 };

function NavButton({
  item,
  isActive,
  expanded,
}: {
  item: NavItem;
  isActive: boolean;
  expanded: boolean;
}) {
  return (
    <button
      type="button"
      className="relative w-full h-10 flex items-center"
      aria-label={item.label}
    >
      {/* Indicator accent or quand actif */}
      {isActive && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-full"
          style={{ background: "#D6B96E" }}
        />
      )}

      {/* Cell icon, taille fixe meme expand */}
      <span
        className={[
          "shrink-0 w-12 h-10 grid place-items-center rounded-lg transition-colors duration-150",
          isActive
            ? "bg-white/[0.06] text-white"
            : "text-white/55 hover:text-white hover:bg-white/[0.03]",
        ].join(" ")}
      >
        {item.icon}
      </span>

      {/* Label : apparait quand sidebar expanded */}
      <motion.span
        initial={false}
        animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -4 }}
        transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] as const }}
        className={[
          "ml-1 text-[13px] font-medium whitespace-nowrap pointer-events-none",
          isActive ? "text-white" : "text-white/70",
        ].join(" ")}
      >
        {item.label}
      </motion.span>
    </button>
  );
}

export function Sidebar() {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      animate={{ width: expanded ? 148 : 80 }}
      transition={SPRING}
      className="shrink-0 h-screen flex flex-col bg-[#0a0a0a] border-r border-white/[0.05] relative z-30"
      style={{ willChange: "width" }}
      aria-label="Navigation Vertxia"
    >
      {/* Logo V */}
      <div className="h-16 flex items-center">
        <a
          href="/"
          className="block ml-4 mr-2"
          aria-label="Retour landing Vertxia"
        >
          <div
            className="w-8 h-8 rounded-lg grid place-items-center text-black font-black text-[13px]"
            style={{
              background:
                "linear-gradient(135deg, #FFC533 0%, #FF7A3D 40%, #FF5A8A 100%)",
            }}
          >
            V
          </div>
        </a>
        <motion.span
          initial={false}
          animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -4 }}
          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] as const }}
          className="text-[13px] font-semibold tracking-tight text-white pointer-events-none"
        >
          Vertxia
        </motion.span>
      </div>

      {/* Nav principale */}
      <nav className="flex flex-col gap-0.5 px-2 mt-2">
        {NAV.map((item) => (
          <NavButton
            key={item.key}
            item={item}
            isActive={item.key === ACTIVE_KEY}
            expanded={expanded}
          />
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom : settings + avatar */}
      <div className="flex flex-col gap-0.5 px-2 pb-3">
        <NavButton
          item={{
            key: "settings",
            label: "Settings",
            icon: <IconSettings size={18} />,
          }}
          isActive={false}
          expanded={expanded}
        />
        <div className="h-12 flex items-center">
          <button
            type="button"
            aria-label="Profil"
            className="shrink-0 mx-2 w-8 h-8 rounded-full ring-1 ring-white/10"
            style={{
              background:
                "linear-gradient(135deg, #4F7DFF 0%, #8A5CFF 100%)",
            }}
          />
          <motion.span
            initial={false}
            animate={{ opacity: expanded ? 1 : 0 }}
            transition={{ duration: 0.14 }}
            className="text-[11.5px] text-white/45 pointer-events-none"
          >
            Emilien
          </motion.span>
        </div>
      </div>
    </motion.aside>
  );
}
