/**
 * MeshGradient — fond aurora geant bleu electrique -> violet -> rose neon.
 * 4 ellipses radial-gradient avec blur volumetrique + animations CSS lentes 20-40s.
 * Server-component compatible (CSS pur, pas de hook React).
 *
 * Le composant occupe ~80vh dans la main area, centre vertical.
 * Les bords noirs sont conserves par la vignette de la main area (overflow-hidden).
 */

export function MeshGradient() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden pointer-events-none"
    >
      {/* Container central — large + haut, blur global */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[140vw] h-[110vh] vsig-mesh-wrap">
        {/* Ellipse bleu electrique — centre haut */}
        <div
          className="absolute inset-0 vsig-blob vsig-blob-blue"
          style={{
            background:
              "radial-gradient(ellipse 38% 42% at 50% 38%, #3E6BFF 0%, rgba(62,107,255,0.5) 35%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        {/* Ellipse violet — milieu gauche */}
        <div
          className="absolute inset-0 vsig-blob vsig-blob-purple"
          style={{
            background:
              "radial-gradient(ellipse 45% 35% at 42% 58%, #8A3FFF 0%, rgba(138,63,255,0.45) 40%, transparent 75%)",
            filter: "blur(80px)",
          }}
        />
        {/* Ellipse rose neon — bas centre */}
        <div
          className="absolute inset-0 vsig-blob vsig-blob-pink"
          style={{
            background:
              "radial-gradient(ellipse 55% 40% at 50% 78%, #FF3D8A 0%, rgba(255,61,138,0.55) 35%, transparent 72%)",
            filter: "blur(70px)",
          }}
        />
        {/* Touche rose vif tres saturee bas */}
        <div
          className="absolute inset-0 vsig-blob vsig-blob-pink-2"
          style={{
            background:
              "radial-gradient(ellipse 40% 25% at 55% 88%, #FF1F70 0%, rgba(255,31,112,0.6) 30%, transparent 65%)",
            filter: "blur(50px)",
          }}
        />
      </div>

      {/* Vignette top/bottom — assombrit les bords pour respecter la ref Lovable */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, #050505 0%, transparent 18%, transparent 70%, #050505 100%)",
        }}
      />

      <style>{`
        @keyframes vsig-mesh-drift-blue {
          0%, 100% { transform: translate3d(-2%, 0%, 0) scale(1); opacity: 0.95; }
          50%      { transform: translate3d(3%, -2%, 0) scale(1.06); opacity: 1; }
        }
        @keyframes vsig-mesh-drift-purple {
          0%, 100% { transform: translate3d(2%, 1%, 0) scale(1.02); opacity: 0.92; }
          50%      { transform: translate3d(-4%, -1%, 0) scale(1.08); opacity: 1; }
        }
        @keyframes vsig-mesh-drift-pink {
          0%, 100% { transform: translate3d(0%, 0%, 0) scale(1); opacity: 0.95; }
          50%      { transform: translate3d(-3%, 2%, 0) scale(1.05); opacity: 1; }
        }
        @keyframes vsig-mesh-drift-pink-2 {
          0%, 100% { transform: translate3d(1%, -1%, 0) scale(0.98); opacity: 0.9; }
          50%      { transform: translate3d(-2%, 1%, 0) scale(1.04); opacity: 1; }
        }
        .vsig-blob-blue   { animation: vsig-mesh-drift-blue   28s ease-in-out infinite; }
        .vsig-blob-purple { animation: vsig-mesh-drift-purple 34s ease-in-out infinite; }
        .vsig-blob-pink   { animation: vsig-mesh-drift-pink   30s ease-in-out infinite; }
        .vsig-blob-pink-2 { animation: vsig-mesh-drift-pink-2 26s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .vsig-blob-blue, .vsig-blob-purple, .vsig-blob-pink, .vsig-blob-pink-2 {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
