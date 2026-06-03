"use client";

/**
 * AutoAnimateGrid — wrapper FormKit auto-animate pour les containers de
 * grille / liste produits.
 *
 * Transitions layout automatiques quand des items sont ajoutes/supprimes
 * ou que la grille est re-ordonnee (hover, filter, etc.). Zero config.
 *
 * Usage :
 *   <AutoAnimateGrid className="grid grid-cols-2 gap-10">
 *     {products.map(p => <Card key={p.handle} {...p} />)}
 *   </AutoAnimateGrid>
 */

import { useAutoAnimate } from "@formkit/auto-animate/react";

type Props<T extends keyof React.JSX.IntrinsicElements = "div"> = {
  children: React.ReactNode;
  as?: T;
  className?: string;
  style?: React.CSSProperties;
  /** Duration anim en ms. Defaut 350. */
  duration?: number;
};

export function AutoAnimateGrid({
  children,
  as,
  className,
  style,
  duration = 350,
}: Props) {
  const [parent] = useAutoAnimate({ duration });
  const Tag = (as || "div") as "div";

  return (
    <Tag ref={parent} className={className} style={style}>
      {children}
    </Tag>
  );
}
