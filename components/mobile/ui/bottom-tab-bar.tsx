"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Bottom tab bar iOS-style — fixée en bas de l'écran, safe-area-inset-bottom
// pour respecter la home indicator iPhone. 5 tabs avec icône + label.
// Le tab central "Intervention" est légèrement surdimensionné (FAB-like).

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  activeMatch: (pathname: string) => boolean;
  center?: boolean;
};

const TABS: Tab[] = [
  {
    href: "/m",
    label: "Accueil",
    activeMatch: (p) => p === "/m",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V9.5z" />
      </svg>
    ),
  },
  {
    href: "/m/equipements",
    label: "Parc",
    activeMatch: (p) => p.startsWith("/m/equipements") || p.startsWith("/eq"),
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="22" x2="16" y2="22" />
        <line x1="12" y1="18" x2="12" y2="22" />
      </svg>
    ),
  },
  {
    href: "/m/intervention",
    label: "Intervention",
    center: true,
    activeMatch: (p) => p.startsWith("/m/intervention") || p === "/bsff",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    href: "/m/historique",
    label: "Historique",
    activeMatch: (p) => p.startsWith("/m/historique") || p === "/historique",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
      </svg>
    ),
  },
  {
    href: "/m/profil",
    label: "Profil",
    activeMatch: (p) => p.startsWith("/m/profil") || p === "/profil",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.5 3.5-8 8-8s8 3.5 8 8" />
      </svg>
    ),
  },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-black/[0.06]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around px-2 pt-2 pb-1.5 max-w-md mx-auto">
        {TABS.map((tab) => {
          const isActive = tab.activeMatch(pathname);
          return (
            <li key={tab.href} className="flex-1 min-w-0">
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-1.5 transition-colors ${
                  isActive ? "text-[#A16207]" : "text-black/45 active:text-black/70"
                }`}
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              >
                <span
                  className={
                    tab.center
                      ? `inline-flex items-center justify-center w-11 h-11 rounded-full transition-colors ${
                          isActive ? "bg-[#A16207] text-white" : "bg-[#111] text-white"
                        }`
                      : "inline-flex items-center justify-center h-7"
                  }
                >
                  {tab.icon}
                </span>
                <span
                  className={`text-[10px] font-medium tracking-tight ${
                    tab.center ? "mt-0.5" : ""
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
