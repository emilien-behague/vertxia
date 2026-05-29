/**
 * Sidebar Vertxia /app — fixed 280px, fond noir profond, glassmorphism subtil.
 * Replique l'archi Lovable (Home/Search/Resources/Connectors + Projects + Recents + bottom cards).
 */

import {
  IconHome,
  IconSearch,
  IconCompass,
  IconCable,
  IconLayoutGrid,
  IconStar,
  IconUser,
  IconUsers,
  IconGift,
  IconZap,
  IconChevronDown,
  IconInbox,
} from "./icons";

type NavItem = {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  shortcut?: string;
};

const mainNav: NavItem[] = [
  { label: "Home", icon: <IconHome />, active: true },
  { label: "Search", icon: <IconSearch />, shortcut: "Ctrl K" },
  { label: "Resources", icon: <IconCompass /> },
  { label: "Connectors", icon: <IconCable /> },
];

const projectsNav: NavItem[] = [
  { label: "All projects", icon: <IconLayoutGrid /> },
  { label: "Starred", icon: <IconStar /> },
  { label: "Created by me", icon: <IconUser /> },
  { label: "Shared with me", icon: <IconUsers /> },
];

const recents = ["Cosmic Unfolding", "Vertxia Cinema"];

function SidebarNavRow({ item }: { item: NavItem }) {
  const active = item.active;
  return (
    <button
      type="button"
      className={[
        "group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] transition-all duration-150",
        active
          ? "bg-white/[0.08] text-white"
          : "text-white/65 hover:bg-white/[0.04] hover:text-white",
      ].join(" ")}
    >
      <span className="shrink-0 text-white/80">{item.icon}</span>
      <span className="flex-1 text-left">{item.label}</span>
      {item.shortcut && (
        <span className="flex items-center gap-1 text-[10px] tracking-wider text-white/40">
          {item.shortcut.split(" ").map((k) => (
            <kbd
              key={k}
              className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/55 font-sans"
            >
              {k}
            </kbd>
          ))}
        </span>
      )}
    </button>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-3 mt-6 mb-1.5 text-[10.5px] tracking-[0.12em] uppercase text-white/35 font-medium">
      {children}
    </p>
  );
}

export function Sidebar() {
  return (
    <aside
      className="w-[280px] shrink-0 h-screen sticky top-0 bg-[#0a0a0a] border-r border-white/[0.06] flex flex-col"
      aria-label="Sidebar principale"
    >
      {/* TOP : Logo + collapse */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <a href="/" className="block" aria-label="Retour landing Vertxia">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF5A8A] via-[#FF7A3D] to-[#FFC533] grid place-items-center text-black font-black text-sm">
            V
          </div>
        </a>
        <button
          type="button"
          aria-label="Collapse sidebar"
          className="w-7 h-7 grid place-items-center rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
          </svg>
        </button>
      </div>

      {/* PROJECT DROPDOWN */}
      <button
        type="button"
        className="mx-3 mb-2 flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition group"
      >
        <span className="w-7 h-7 rounded-md bg-gradient-to-br from-fuchsia-500 to-purple-600 grid place-items-center text-white font-bold text-[13px]">
          V
        </span>
        <span className="flex-1 text-left text-[13.5px] text-white/90 font-medium">
          Vertxia
        </span>
        <IconChevronDown className="text-white/50 group-hover:text-white/80 transition" />
      </button>

      {/* MAIN NAV */}
      <nav className="px-3 mt-2 space-y-0.5">
        {mainNav.map((item) => (
          <SidebarNavRow key={item.label} item={item} />
        ))}
      </nav>

      {/* PROJECTS */}
      <SectionLabel>Projects</SectionLabel>
      <nav className="px-3 space-y-0.5">
        {projectsNav.map((item) => (
          <SidebarNavRow key={item.label} item={item} />
        ))}
      </nav>

      {/* RECENTS */}
      <SectionLabel>Recents</SectionLabel>
      <nav className="px-3 space-y-0.5">
        {recents.map((label) => (
          <button
            key={label}
            type="button"
            className="w-full text-left px-3 py-2 rounded-lg text-[13.5px] text-white/65 hover:bg-white/[0.04] hover:text-white transition"
          >
            {label}
          </button>
        ))}
      </nav>

      {/* SPACER */}
      <div className="flex-1" />

      {/* BOTTOM CARDS */}
      <div className="px-3 pb-3 space-y-2">
        {/* Share Vertxia */}
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.06] transition text-left"
        >
          <div>
            <p className="text-[13px] font-semibold text-white leading-tight">
              Share Vertxia
            </p>
            <p className="text-[11px] text-white/50 mt-0.5">
              100 credits per paid referral
            </p>
          </div>
          <IconGift size={20} className="text-white/70 shrink-0" />
        </button>

        {/* Upgrade Pro */}
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl bg-gradient-to-br from-white/[0.07] to-white/[0.03] hover:from-white/[0.09] hover:to-white/[0.04] border border-white/[0.08] transition text-left"
        >
          <div>
            <p className="text-[13px] font-semibold text-white leading-tight">
              Upgrade to Pro
            </p>
            <p className="text-[11px] text-white/50 mt-0.5">
              Unlock more features
            </p>
          </div>
          <span className="shrink-0 w-7 h-7 rounded-full bg-white/[0.08] grid place-items-center">
            <IconZap size={14} className="text-white" />
          </span>
        </button>
      </div>

      {/* FOOTER ROW */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.05]">
        <button
          type="button"
          aria-label="Profil utilisateur"
          className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-300 to-teal-500 ring-1 ring-white/10"
        />
        <button
          type="button"
          aria-label="Inbox"
          className="relative w-8 h-8 grid place-items-center rounded-md text-white/55 hover:text-white hover:bg-white/[0.05] transition"
        >
          <IconInbox size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
        </button>
      </div>
    </aside>
  );
}
