/**
 * EmptyStateCanvas — scene elegante en arriere-plan du workspace Vertxia Studio.
 *
 * Pas de 3D lourde (pas R3F). Juste :
 * - Grille perspective vue de dessous (SVG + perspective CSS)
 * - 3 lignes lumineuses bleu electrique animees lentement
 * - ~30 particules blanches lentes (CSS keyframes infinite)
 * - Lueurs diffuses subtiles (radial-gradient blur)
 *
 * Server-component, pas de hook, pas de JS run-time.
 */

const PARTICLE_COUNT = 32;

export function EmptyStateCanvas() {
  // Genere des particules deterministes (server-side, pas Math.random utilisable)
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    // Hash deterministe pour seed pseudo-random
    const seed = (i * 9301 + 49297) % 233280;
    const x = (seed % 100) / 100;
    const y = ((seed * 1.3) % 100) / 100;
    const size = 1 + ((seed % 7) / 10);
    const duration = 18 + ((seed * 0.7) % 14);
    const delay = (seed * 0.3) % 12;
    const opacity = 0.25 + ((seed % 30) / 100);
    return { i, x, y, size, duration, delay, opacity };
  });

  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden pointer-events-none"
    >
      {/* Lueurs diffuses subtiles (2 grandes ellipses) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 45% 35% at 50% 35%, rgba(79,125,255,0.06) 0%, transparent 70%), radial-gradient(ellipse 40% 30% at 50% 75%, rgba(138,92,255,0.05) 0%, transparent 70%)",
        }}
      />

      {/* Grille perspective vue de dessous — SVG avec gradient mask */}
      <svg
        className="absolute inset-x-0 bottom-0 w-full h-[70vh] opacity-[0.18]"
        viewBox="0 0 1200 600"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="gridFade" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#4F7DFF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#4F7DFF" stopOpacity="0" />
          </linearGradient>
          <mask id="gridMask">
            <rect width="1200" height="600" fill="url(#gridFade)" />
          </mask>
        </defs>

        {/* Lignes horizontales (perspective lines) */}
        <g mask="url(#gridMask)" stroke="#4F7DFF" strokeWidth="0.5" fill="none">
          {Array.from({ length: 14 }, (_, i) => {
            const y = 600 - Math.pow(i / 13, 1.8) * 600;
            return <line key={`h${i}`} x1="0" y1={y} x2="1200" y2={y} />;
          })}

          {/* Lignes verticales convergentes vers le point central */}
          {Array.from({ length: 21 }, (_, i) => {
            const x = (i / 20) * 1200;
            const vanishX = 600;
            return (
              <line
                key={`v${i}`}
                x1={x}
                y1="600"
                x2={vanishX}
                y2="0"
              />
            );
          })}
        </g>
      </svg>

      {/* 3 lignes lumineuses discretes (SVG animees) */}
      <svg
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <defs>
          <linearGradient id="lumLine1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4F7DFF" stopOpacity="0" />
            <stop offset="50%" stopColor="#4F7DFF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#4F7DFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lumLine2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8A5CFF" stopOpacity="0" />
            <stop offset="50%" stopColor="#8A5CFF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8A5CFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1="0" y1="22" x2="100" y2="22"
          stroke="url(#lumLine1)" strokeWidth="0.06"
          className="vsig-lum-1"
        />
        <line
          x1="0" y1="78" x2="100" y2="78"
          stroke="url(#lumLine2)" strokeWidth="0.06"
          className="vsig-lum-2"
        />
        <line
          x1="0" y1="48" x2="100" y2="48"
          stroke="url(#lumLine1)" strokeWidth="0.04"
          className="vsig-lum-3"
        />
      </svg>

      {/* Particules lentes */}
      <div className="absolute inset-0">
        {particles.map((p) => (
          <span
            key={p.i}
            className="vsig-particle"
            style={{
              position: "absolute",
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              borderRadius: "9999px",
              background: "white",
              opacity: p.opacity,
              animation: `vsig-particle-float ${p.duration}s ease-in-out ${p.delay}s infinite`,
              willChange: "transform, opacity",
              boxShadow: "0 0 6px rgba(255,255,255,0.5)",
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes vsig-particle-float {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50%      { transform: translate3d(8px, -20px, 0) scale(1.15); }
        }
        @keyframes vsig-lum-drift {
          0%, 100% { opacity: 0.6; transform: translateX(-10%); }
          50%      { opacity: 1;   transform: translateX(10%); }
        }
        .vsig-lum-1 { animation: vsig-lum-drift 16s ease-in-out infinite; }
        .vsig-lum-2 { animation: vsig-lum-drift 22s ease-in-out 4s infinite; }
        .vsig-lum-3 { animation: vsig-lum-drift 19s ease-in-out 2s infinite; }

        @media (prefers-reduced-motion: reduce) {
          .vsig-particle, .vsig-lum-1, .vsig-lum-2, .vsig-lum-3 {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
