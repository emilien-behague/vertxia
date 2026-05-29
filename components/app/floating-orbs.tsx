/**
 * FloatingOrbs — 5 spheres lumineuses (bleues/violettes/roses) en deplacement lent.
 * CSS pur, animations infinite, server-component compatible.
 * Disposees aux peripheries pour ajouter de la profondeur sans recouvrir le hero center.
 */

const orbs = [
  { color: "#3E6BFF", size: 380, top: "8%",  left: "12%",  blur: 90,  duration: 32, delay: 0 },
  { color: "#8A3FFF", size: 320, top: "22%", right: "10%", blur: 80,  duration: 38, delay: 4 },
  { color: "#FF3D8A", size: 420, top: "72%", left: "20%",  blur: 100, duration: 30, delay: 2 },
  { color: "#FF1F70", size: 280, top: "62%", right: "8%",  blur: 70,  duration: 36, delay: 7 },
  { color: "#5A3FFF", size: 220, top: "45%", left: "5%",   blur: 60,  duration: 28, delay: 1 },
] as const;

export function FloatingOrbs() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden pointer-events-none z-[1]"
    >
      {orbs.map((orb, i) => (
        <div
          key={i}
          className={`vsig-orb vsig-orb-${i}`}
          style={{
            position: "absolute",
            width: orb.size,
            height: orb.size,
            top: orb.top,
            ...("left" in orb ? { left: orb.left } : {}),
            ...("right" in orb ? { right: orb.right } : {}),
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 65%)`,
            opacity: 0.35,
            filter: `blur(${orb.blur}px)`,
            animation: `vsig-orb-drift-${i} ${orb.duration}s ease-in-out ${orb.delay}s infinite`,
            willChange: "transform",
          }}
        />
      ))}

      <style>{`
        @keyframes vsig-orb-drift-0 {
          0%,100% { transform: translate3d(0,0,0) scale(1); }
          50%     { transform: translate3d(40px, -30px, 0) scale(1.08); }
        }
        @keyframes vsig-orb-drift-1 {
          0%,100% { transform: translate3d(0,0,0) scale(1); }
          50%     { transform: translate3d(-50px, 20px, 0) scale(1.1); }
        }
        @keyframes vsig-orb-drift-2 {
          0%,100% { transform: translate3d(0,0,0) scale(1); }
          50%     { transform: translate3d(30px, 40px, 0) scale(1.06); }
        }
        @keyframes vsig-orb-drift-3 {
          0%,100% { transform: translate3d(0,0,0) scale(1); }
          50%     { transform: translate3d(-30px, -40px, 0) scale(1.12); }
        }
        @keyframes vsig-orb-drift-4 {
          0%,100% { transform: translate3d(0,0,0) scale(1); }
          50%     { transform: translate3d(20px, 50px, 0) scale(1.05); }
        }
        @media (prefers-reduced-motion: reduce) {
          .vsig-orb { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
