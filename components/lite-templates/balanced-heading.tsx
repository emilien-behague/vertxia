"use client";

/**
 * BalancedHeading — wrapper Balancer pour les titres hero/manifesto.
 *
 * Utilise react-wrap-balancer (Shu Ding / Vercel) pour eviter les veuves
 * typographiques sur les H1/H2 long-form. Signature des sites Vercel et
 * shadcn-marketing — premium polish gratuit.
 *
 * Note : Balancer doit etre dans un Client Component. Si on l'utilise dans
 * un Server Component, on importe ce wrapper.
 */

import { Balancer } from "react-wrap-balancer";

type Props = {
  children: React.ReactNode;
  /** Ratio de balance (0 = tight, 1 = lossless). Defaut 0.5 = bonne moyenne. */
  ratio?: number;
  className?: string;
};

export function BalancedHeading({ children, ratio = 0.5, className }: Props) {
  return (
    <Balancer ratio={ratio} className={className}>
      {children}
    </Balancer>
  );
}
