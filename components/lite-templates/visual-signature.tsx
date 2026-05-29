/**
 * VisualSignature — overlay/filtre visuel applique par-dessus n'importe quel template Lite.
 *
 * Multiplie les variations : 5 templates × 5 signatures = 25 looks uniques.
 * Server-component compatible (pas de "use client", juste JSX + CSS scope via data-vsig).
 *
 * Usage dans le router /lite/[domain]/page.tsx :
 *   <VisualSignature signature={brief.visual_signature ?? "none"} accent={accentHex}>
 *     {templateJsx}
 *   </VisualSignature>
 */

import type { VisualSignatureId } from "@/lib/brief";

type Props = {
  signature: VisualSignatureId;
  /** Hex couleur accent du brief, utilise par neon-noir/glitch-vhs pour les glows. */
  accent: string;
  children: React.ReactNode;
};

/**
 * SVG noise inline encode (dataURI) — feTurbulence fractal noise.
 * Reutilise pour film-grain. Encodage URL-safe (# → %23).
 */
const NOISE_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>";

function generateCss(signature: VisualSignatureId, accent: string): string {
  const scope = `[data-vsig="${signature}"]`;

  switch (signature) {
    case "none":
      return "";

    case "film-grain":
      return `
        ${scope} .vsig-grain {
          position: fixed; inset: 0; z-index: 9000; pointer-events: none;
          background-image: url("${NOISE_SVG}");
          background-size: 240px 240px;
          opacity: 0.18;
          mix-blend-mode: overlay;
        }
        ${scope} .vsig-vignette {
          position: fixed; inset: 0; z-index: 8999; pointer-events: none;
          background: radial-gradient(ellipse at center,
            transparent 30%,
            rgba(0,0,0,0.18) 75%,
            rgba(0,0,0,0.42) 100%);
        }
        ${scope} img, ${scope} video {
          filter: sepia(0.12) saturate(1.05) contrast(1.04);
        }
      `;

    case "halftone-print":
      return `
        ${scope} .vsig-halftone {
          position: fixed; inset: 0; z-index: 9000; pointer-events: none;
          background-image:
            radial-gradient(circle, rgba(0,0,0,0.42) 1.1px, transparent 1.5px);
          background-size: 5px 5px;
          mix-blend-mode: multiply;
          opacity: 0.32;
        }
        ${scope} .vsig-paper {
          position: fixed; inset: 0; z-index: 8999; pointer-events: none;
          background-image: url("${NOISE_SVG}");
          background-size: 320px 320px;
          opacity: 0.08;
          mix-blend-mode: multiply;
        }
        ${scope} img, ${scope} video {
          filter: contrast(1.18) saturate(0.85);
        }
      `;

    case "glitch-vhs":
      return `
        ${scope} .vsig-scanlines {
          position: fixed; inset: 0; z-index: 9000; pointer-events: none;
          background: repeating-linear-gradient(
            0deg,
            rgba(0,0,0,0.22) 0px,
            rgba(0,0,0,0.22) 1px,
            transparent 1px,
            transparent 3px
          );
          mix-blend-mode: multiply;
          opacity: 0.7;
        }
        ${scope} .vsig-mark {
          position: fixed; top: 1rem; right: 1rem; z-index: 9001;
          pointer-events: none;
          font-family: ui-monospace, 'JetBrains Mono', monospace;
          font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase;
          color: ${accent};
          mix-blend-mode: difference;
          opacity: 0.85;
        }
        ${scope} img, ${scope} video {
          transition: filter 0.18s ease, transform 0.18s ease;
        }
        ${scope} img:hover, ${scope} video:hover {
          filter:
            drop-shadow(2px 0 0 rgba(255, 0, 80, 0.9))
            drop-shadow(-2px 0 0 rgba(0, 200, 255, 0.9));
        }
        ${scope} h1, ${scope} h2 {
          text-shadow:
            1.5px 0 0 rgba(255, 0, 80, 0.55),
            -1.5px 0 0 rgba(0, 200, 255, 0.55);
        }
      `;

    case "neon-noir":
      return `
        ${scope} .vsig-darkwash {
          position: fixed; inset: 0; z-index: 9000; pointer-events: none;
          background:
            radial-gradient(ellipse at 20% 10%,
              ${hexToRgba(accent, 0.18)} 0%,
              transparent 45%),
            radial-gradient(ellipse at 80% 90%,
              ${hexToRgba(accent, 0.12)} 0%,
              transparent 55%),
            linear-gradient(180deg, rgba(0,0,0,0.18) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.28) 100%);
          mix-blend-mode: screen;
        }
        ${scope} h1, ${scope} .vsig-glow-h {
          text-shadow:
            0 0 14px ${hexToRgba(accent, 0.55)},
            0 0 28px ${hexToRgba(accent, 0.32)};
        }
        ${scope} a[href], ${scope} button {
          transition: box-shadow 0.25s ease, text-shadow 0.25s ease, transform 0.25s ease;
        }
        ${scope} a[href]:hover, ${scope} button:hover {
          box-shadow: 0 0 18px ${hexToRgba(accent, 0.55)}, 0 0 38px ${hexToRgba(accent, 0.32)};
          text-shadow: 0 0 8px ${hexToRgba(accent, 0.55)};
        }
        ${scope} img, ${scope} video {
          filter: contrast(1.1) saturate(1.15);
        }
      `;

    default:
      return "";
  }
}

/**
 * Convertit "#RRGGBB" en "rgba(r,g,b,a)". Tolerant aux formats invalides.
 */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) {
    return `rgba(255, 90, 200, ${alpha})`;
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) {
    return `rgba(255, 90, 200, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function VisualSignature({ signature, accent, children }: Props) {
  if (signature === "none") {
    // Pass-through complet, aucun DOM ajoute, aucun CSS injecte
    return <>{children}</>;
  }

  const css = generateCss(signature, accent);

  return (
    <div data-vsig={signature} style={{ display: "contents" }}>
      {children}
      {signature === "film-grain" && (
        <>
          <div className="vsig-vignette" />
          <div className="vsig-grain" />
        </>
      )}
      {signature === "halftone-print" && (
        <>
          <div className="vsig-paper" />
          <div className="vsig-halftone" />
        </>
      )}
      {signature === "glitch-vhs" && (
        <>
          <div className="vsig-scanlines" />
          <div className="vsig-mark">VSIG / GLITCH · CH-01</div>
        </>
      )}
      {signature === "neon-noir" && (
        <>
          <div className="vsig-darkwash" />
        </>
      )}
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </div>
  );
}
