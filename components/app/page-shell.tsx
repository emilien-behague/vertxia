"use client";

/**
 * PageShell — wrapper commun aux pages onglets de /app.
 *
 * Inspiration Linear / Arc : header sticky discret, contenu scrollable,
 * ambient gradient subtil pour rester coherent avec la Home (galerie 3D).
 *
 * NE PAS utiliser sur /app (Home) : la Home a sa propre composition full-bleed
 * (FloatingGallery + CentralCommand).
 */

import { motion } from "framer-motion";
import { ReactNode } from "react";

type Props = {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

const FADE = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

export function PageShell({
  title,
  eyebrow,
  description,
  actions,
  children,
}: Props) {
  return (
    <div className="absolute inset-0 overflow-y-auto">
      {/* Ambient gradient — coherent avec Home */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% -10%, rgba(138,92,255,0.06) 0%, transparent 65%), radial-gradient(ellipse 50% 30% at 100% 100%, rgba(79,125,255,0.05) 0%, transparent 60%)",
        }}
      />

      {/* Header sticky discret */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#050505]/70 border-b border-white/[0.05]">
        <div className="px-10 py-6 flex items-end justify-between gap-6">
          <div className="min-w-0">
            {eyebrow && (
              <motion.p
                {...FADE}
                className="text-[10.5px] tracking-[0.22em] uppercase font-medium text-[#D6B96E]/85"
              >
                {eyebrow}
              </motion.p>
            )}
            <motion.h1
              {...FADE}
              transition={{ ...FADE.transition, delay: 0.04 }}
              className="mt-1 text-[28px] font-semibold text-white tracking-[-0.02em] leading-tight"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {title}
            </motion.h1>
            {description && (
              <motion.p
                {...FADE}
                transition={{ ...FADE.transition, delay: 0.08 }}
                className="mt-1.5 text-[13.5px] text-white/55 max-w-2xl"
              >
                {description}
              </motion.p>
            )}
          </div>
          {actions && (
            <motion.div
              {...FADE}
              transition={{ ...FADE.transition, delay: 0.12 }}
              className="shrink-0 flex items-center gap-2"
            >
              {actions}
            </motion.div>
          )}
        </div>
      </header>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.16, ease: [0.22, 1, 0.36, 1] as const }}
        className="relative z-10 px-10 py-10"
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------
 * Sous-composants utilitaires partagés
 * ------------------------------------------------------------------ */

/** Bouton primaire blanc (CTA principal d'une page). */
export function PrimaryButton({
  children,
  onClick,
  href,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const className = [
    "inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-white text-black text-[13px] font-medium transition",
    disabled
      ? "opacity-50 cursor-not-allowed"
      : "hover:scale-[1.02] active:scale-[0.98]",
  ].join(" ");
  if (href && !disabled) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  );
}

/** Bouton secondaire ghost. */
export function GhostButton({
  children,
  onClick,
  href,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const className = [
    "inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-white/[0.10] bg-white/[0.03] text-[13px] transition",
    disabled
      ? "opacity-50 cursor-not-allowed text-white/40"
      : "text-white/80 hover:bg-white/[0.06] hover:text-white",
  ].join(" ");
  if (href && !disabled) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  );
}

/** EmptyState reutilisable — minimaliste, pas de mascotte cliche. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-white/[0.08] rounded-2xl p-16 flex flex-col items-center justify-center text-center">
      {icon && (
        <div className="mb-5 w-12 h-12 grid place-items-center rounded-xl bg-white/[0.04] text-white/55">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-medium text-white tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="mt-2 text-[13px] text-white/50 max-w-md leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Section title — separateur leger dans une page. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] tracking-[0.18em] uppercase font-semibold text-white/40 mb-4">
      {children}
    </h2>
  );
}
