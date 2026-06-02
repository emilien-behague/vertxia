"use client";

import Link from "next/link";

// Header iOS-style — back chevron si pas root, titre centré, action right optionnelle.
// Safe-area-inset-top pour respecter le notch iPhone.

type MobileHeaderProps = {
  title: string;
  backHref?: string;
  rightAction?: {
    label: string;
    href: string;
  };
  largeTitle?: boolean;
};

export function MobileHeader({ title, backHref, rightAction, largeTitle }: MobileHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 bg-[#F5F4F0]/85 backdrop-blur-xl border-b border-black/[0.04]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="relative flex items-center justify-between h-11 px-2 max-w-md mx-auto">
        <div className="w-16 flex items-center justify-start">
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center text-[#A16207] active:opacity-60 transition-opacity px-2 py-1.5"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span className="text-base font-normal -ml-0.5">Retour</span>
            </Link>
          )}
        </div>

        {/* Titre dans la nav bar compacte — masqué si largeTitle (pattern iOS) */}
        {!largeTitle && (
          <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-[#111] truncate max-w-[55%] text-center">
            {title}
          </h1>
        )}

        <div className="w-16 flex items-center justify-end">
          {rightAction && (
            <Link
              href={rightAction.href}
              className="text-[#A16207] active:opacity-60 transition-opacity px-2 py-1.5 text-base font-normal"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            >
              {rightAction.label}
            </Link>
          )}
        </div>
      </div>

      {largeTitle && (
        <div className="max-w-md mx-auto px-5 pb-3 pt-1">
          <h2 className="text-[34px] font-bold tracking-tight text-[#111] leading-none">
            {title}
          </h2>
        </div>
      )}
    </header>
  );
}
