"use client";

import Link from "next/link";
import type { ReactNode } from "react";

// Inset list iOS-style — sections groupées avec cards arrondies blanches,
// divider lines entre items, chevron right pour navigation. Style Settings iOS.

type InsetListSectionProps = {
  title?: string;
  footer?: string;
  children: ReactNode;
};

export function InsetListSection({ title, footer, children }: InsetListSectionProps) {
  return (
    <section className="mt-6 first:mt-2">
      {title && (
        <div className="px-5 pb-1.5 text-[13px] font-medium text-black/45 uppercase tracking-wide">
          {title}
        </div>
      )}
      <div className="mx-4 rounded-2xl bg-white overflow-hidden ring-1 ring-black/[0.04] shadow-sm shadow-black/[0.02]">
        <div className="divide-y divide-black/[0.06]">{children}</div>
      </div>
      {footer && <div className="px-5 pt-2 text-[12px] text-black/45 leading-relaxed">{footer}</div>}
    </section>
  );
}

type InsetRowProps = {
  href?: string;
  onClick?: () => void;
  leading?: ReactNode;
  label: string;
  sublabel?: string;
  trailing?: ReactNode;
  trailingValue?: string;
  showChevron?: boolean;
  destructive?: boolean;
};

export function InsetRow({
  href,
  onClick,
  leading,
  label,
  sublabel,
  trailing,
  trailingValue,
  showChevron,
  destructive,
}: InsetRowProps) {
  const content = (
    <div className="flex items-center gap-3 px-4 py-3 min-h-[44px] active:bg-black/[0.04] transition-colors">
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="flex-1 min-w-0">
        <div className={`text-[15px] truncate ${destructive ? "text-red-600" : "text-[#111]"}`}>
          {label}
        </div>
        {sublabel && (
          <div className="text-[13px] text-black/50 truncate mt-0.5">{sublabel}</div>
        )}
      </div>
      {trailingValue && <div className="text-[15px] text-black/50 shrink-0">{trailingValue}</div>}
      {trailing && <div className="shrink-0">{trailing}</div>}
      {showChevron && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(0,0,0,0.25)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block"
        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
      >
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left"
        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
      >
        {content}
      </button>
    );
  }
  return <div>{content}</div>;
}
