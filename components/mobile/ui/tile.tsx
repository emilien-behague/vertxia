"use client";

import Link from "next/link";

// Tuile partagee — l'unite visuelle de la refonte mobile post-feedback SIDV
// (05/06/2026). Inspiree des tuiles plates style Fluid 360, mais identite
// Vertxia : gradient diagonal CSS inline, rounded-3xl, typo bold uppercase
// white, emoji XL en coin, badge chiffre rouge optionnel.
//
// IMPORTANT : les gradients sont en STYLE INLINE pas en classes Tailwind —
// sinon le tree-shaker ne genere pas le CSS et le fond reste invisible.

export type TileVariant =
  | "emerald"
  | "bronze"
  | "sky"
  | "slate"
  | "rose"
  | "violet"
  | "teal"
  | "amber"
  | "indigo"
  | "zinc"
  | "red"
  | "blue"
  | "pink"
  | "cyan"
  | "lime";

export const TILE_GRADIENTS: Record<TileVariant, string> = {
  emerald: "linear-gradient(135deg, #10b981 0%, #0f766e 100%)",
  bronze: "linear-gradient(135deg, #A16207 0%, #7A4A05 100%)",
  sky: "linear-gradient(135deg, #0ea5e9 0%, #1d4ed8 100%)",
  slate: "linear-gradient(135deg, #334155 0%, #0f172a 100%)",
  rose: "linear-gradient(135deg, #f43f5e 0%, #db2777 100%)",
  violet: "linear-gradient(135deg, #7c3aed 0%, #6b21a8 100%)",
  teal: "linear-gradient(135deg, #14b8a6 0%, #0891b2 100%)",
  amber: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
  indigo: "linear-gradient(135deg, #6366f1 0%, #1d4ed8 100%)",
  zinc: "linear-gradient(135deg, #52525b 0%, #27272a 100%)",
  red: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
  blue: "linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)",
  pink: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
  cyan: "linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)",
  lime: "linear-gradient(135deg, #84cc16 0%, #4d7c0f 100%)",
};

type CommonProps = {
  variant: TileVariant;
  emoji: string;
  label: string;
  sublabel?: string;
  size?: "xl" | "regular";
  badge?: number;
};

type WithHref = CommonProps & { href: string; onClick?: never };
type WithClick = CommonProps & { onClick: () => void; href?: never };

export function Tile(props: WithHref | WithClick) {
  const { variant, emoji, label, sublabel, size = "regular", badge } = props;
  const isXl = size === "xl";

  const content = (
    <>
      {typeof badge === "number" && badge > 0 && (
        <span className="absolute top-3 right-3 min-w-[26px] h-[26px] px-1.5 rounded-full bg-red-500 text-white text-[12px] font-bold flex items-center justify-center shadow-md ring-2 ring-white/80">
          {badge > 99 ? "99+" : badge}
        </span>
      )}

      {isXl ? (
        <div className="flex items-center gap-4">
          <div className="text-5xl leading-none drop-shadow">{emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[18px] font-bold uppercase tracking-wide text-white leading-tight">
              {label}
            </div>
            {sublabel && (
              <div className="text-[12.5px] text-white/80 mt-1 leading-snug">
                {sublabel}
              </div>
            )}
          </div>
          <svg
            className="shrink-0 text-white/70"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="text-[34px] leading-none drop-shadow mb-2">{emoji}</div>
          <div className="text-[14px] font-bold uppercase tracking-wide text-white leading-tight">
            {label}
          </div>
          {sublabel && (
            <div className="text-[11px] text-white/75 mt-0.5 leading-snug">
              {sublabel}
            </div>
          )}
        </div>
      )}
    </>
  );

  const style = {
    background: TILE_GRADIENTS[variant],
    WebkitTapHighlightColor: "transparent" as const,
    touchAction: "manipulation" as const,
  };

  const className = `relative block rounded-3xl shadow-lg shadow-black/10 active:scale-[0.98] transition-transform overflow-hidden ${
    isXl ? "px-5 py-6" : "px-4 py-5 min-h-[120px]"
  }`;

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={className} style={style}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={"onClick" in props ? props.onClick : undefined}
      className={`${className} w-full text-left`}
      style={style}
    >
      {content}
    </button>
  );
}

// Variante compacte horizontale pour les sections actions footer.
export function ActionTile(props: WithHref | WithClick) {
  const { variant, emoji, label, sublabel } = props;
  const content = (
    <div className="flex items-center gap-3">
      <div className="text-[28px] leading-none drop-shadow">{emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-bold uppercase tracking-wide text-white leading-tight">
          {label}
        </div>
        {sublabel && (
          <div className="text-[10.5px] text-white/80 mt-0.5 leading-snug">
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
  const style = {
    background: TILE_GRADIENTS[variant],
    WebkitTapHighlightColor: "transparent" as const,
    touchAction: "manipulation" as const,
  };
  const className =
    "block rounded-2xl shadow-md shadow-black/10 px-4 py-3.5 active:scale-[0.98] transition-transform";
  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={className} style={style}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={"onClick" in props ? props.onClick : undefined}
      className={`${className} w-full text-left`}
      style={style}
    >
      {content}
    </button>
  );
}
