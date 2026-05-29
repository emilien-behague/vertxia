"use client";

/**
 * Sidebar Vertxia Studio — compacte icons-only.
 * Largeur 80px par defaut, hover-expand a 148px avec labels apparaissant.
 *
 * Inspirations : Linear, Arc Browser, Figma.
 * Pas de section labels, pas de bottom cards "Share/Upgrade" (kitsch SaaS).
 * Active state : background graphite + accent or subtil border-left.
 *
 * Routing : chaque item est un <Link>. Active state derive de usePathname().
 * "home" est mappee a /app (root), les autres a /app/<key>.
 */

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  href: string;
  icon: React.ReactNode;
};

const NAV: NavItem[] = [
  { key: "home",     label: "Home",     href: "/app",          icon: <IconHome size={19} /> },
  { key: "projects", label: "Projects", href: "/app/projects", icon: <IconLayoutGrid size={19} /> },
  { key: "sites",    label: "Sites",    href: "/app/sites",    icon: <IconGlobe size={19} /> },
  { key: "videos",   label: "Videos",   href: "/app/videos",   icon: <IconPlay size={19} /> },
  { key: "agents",   label: "Agents",   href: "/app/agents",   icon: <IconBot size={19} /> },
  { key: "assets",   label: "Assets",   href: "/app/assets",   icon: <IconImage size={19} /> },
];

const SETTINGS_ITEM: NavItem = {
  key: "settings",
  label: "Settings",
  href: "/app/settings",
  icon: <IconSettings size={18} />,
};

const SPRING = { type: "spring" as const, stiffness: 220, damping: 24, mass: 0.6 };

/** Determine si un item est actif. /app = exact, sinon prefix. */
function isItemActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}

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
    <Link
      href={item.href}
      prefetch
      aria-label={item.label}
      aria-current={isActive ? "page" : undefined}
      className="relative w-full h-10 flex items-center group"
    >
      {/* Indicator accent or quand actif */}
      {isActive && (
        <motion.span
          layoutId="nav-active-indicator"
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-full"
          style={{ background: "#D6B96E" }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}

      {/* Cell icon, taille fixe meme expand */}
      <span
        className={[
          "shrink-0 w-12 h-10 grid place-items-center rounded-lg transition-colors duration-150",
          isActive
            ? "bg-white/[0.06] text-white"
            : "text-white/55 group-hover:text-white group-hover:bg-white/[0.03]",
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
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
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
        <Link
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
        </Link>
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
            isActive={isItemActive(pathname, item.href)}
            expanded={expanded}
          />
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom : settings + avatar */}
      <div className="flex flex-col gap-0.5 px-2 pb-3">
        <NavButton
          item={SETTINGS_ITEM}
          isActive={isItemActive(pathname, SETTINGS_ITEM.href)}
          expanded={expanded}
        />
        <UserMenu expanded={expanded} />
      </div>
    </motion.aside>
  );
}

function UserMenu({ expanded }: { expanded: boolean }) {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.user) setUser(json.user);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const initial = user?.email?.[0]?.toUpperCase() || "?";
  const displayEmail = user?.email || "";

  return (
    <div className="relative h-12 flex items-center" ref={menuRef}>
      <button
        type="button"
        aria-label={user ? `Profil ${displayEmail}` : "Profil"}
        onClick={() => user && setOpen((v) => !v)}
        className="shrink-0 mx-2 w-8 h-8 rounded-full ring-1 ring-white/10 grid place-items-center text-white text-[12px] font-semibold cursor-pointer hover:ring-white/30 transition"
        style={{
          background:
            "linear-gradient(135deg, #4F7DFF 0%, #8A5CFF 100%)",
        }}
      >
        {initial}
      </button>
      <motion.span
        initial={false}
        animate={{ opacity: expanded ? 1 : 0 }}
        transition={{ duration: 0.14 }}
        className="text-[11.5px] text-white/45 truncate max-w-[80px] pointer-events-none"
        title={displayEmail}
      >
        {displayEmail.split("@")[0] || "..."}
      </motion.span>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] as const }}
            className="absolute bottom-12 left-2 w-[230px] rounded-xl bg-[#0f0f10] border border-white/[0.08] shadow-xl backdrop-blur-xl z-50 p-1.5"
            role="menu"
          >
            <div className="px-3 py-2.5 border-b border-white/[0.05]">
              <p className="text-[10px] tracking-[0.18em] uppercase text-white/35">
                Connecte en tant que
              </p>
              <p
                className="mt-1 text-[12.5px] text-white truncate"
                title={displayEmail}
              >
                {displayEmail}
              </p>
            </div>
            <Link
              href="/app/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] text-white/75 hover:bg-white/[0.04] hover:text-white transition"
              role="menuitem"
            >
              Parametres
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] text-white/75 hover:bg-white/[0.04] hover:text-white transition"
                role="menuitem"
              >
                Se deconnecter
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
