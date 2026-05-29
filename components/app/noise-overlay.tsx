/**
 * NoiseOverlay — grain SVG fixe par-dessus toute la main area.
 * Tres subtil (opacity 0.04), donne du grain analogique premium.
 */

const NOISE_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.7 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>";

export function NoiseOverlay() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none z-[2]"
      style={{
        backgroundImage: `url("${NOISE_SVG}")`,
        backgroundSize: "240px 240px",
        opacity: 0.045,
        mixBlendMode: "overlay",
      }}
    />
  );
}
