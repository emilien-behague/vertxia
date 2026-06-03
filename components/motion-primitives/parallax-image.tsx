"use client";

/**
 * ParallaxImage — image qui defile a une vitesse differente du scroll.
 *
 * useScroll + useTransform : depuis le moment ou l'image entre dans le viewport
 * jusqu'a sa sortie, on translate Y de `-distance` (par defaut -100px).
 *
 * Pour parallax inverse, passer `distance` negatif.
 */

import { m, useScroll, useTransform } from "motion/react";
import { useRef, type CSSProperties } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  distance?: number;
  scale?: number;
  style?: CSSProperties;
  objectPosition?: string;
};

export function ParallaxImage({
  src,
  alt,
  className,
  distance = 100,
  scale = 1.15,
  style,
  objectPosition = "center",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ overflow: "hidden", ...style }}
    >
      <m.img
        src={src}
        alt={alt}
        style={{
          y,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition,
          scale,
          willChange: "transform",
        }}
        loading="lazy"
      />
    </div>
  );
}

/**
 * ParallaxBg — comme ParallaxImage mais en background div (pour quand on a deja
 * du contenu par-dessus avec position absolute).
 */
export function ParallaxBg({
  src,
  className,
  distance = 80,
  scale = 1.2,
  style,
  children,
}: {
  src: string;
  className?: string;
  distance?: number;
  scale?: number;
  style?: CSSProperties;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ overflow: "hidden", ...style }}
    >
      <m.div
        style={{
          y,
          scale,
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          willChange: "transform",
        }}
      />
      {children}
    </div>
  );
}
