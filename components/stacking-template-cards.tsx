"use client";

import { useEffect, useRef, useState } from "react";

const TEMPLATES = [
  {
    label: "T1 — HERO 3D",
    title: "Hero 3D Produit",
    desc: "Fond sombre, spotlight cinéma, objet 3D centré qui orbite. Pour sneakers, parfums, bijoux, montres. Le plus universel.",
    stats: [
      { v: "25-30s", l: "durée scène" },
      { v: "60fps", l: "mobile-ready" },
    ],
  },
  {
    label: "T2 — FULL-BLEED",
    title: "Cinéma full-bleed + typo",
    desc: "Photo plein écran avec typographie éditoriale animée et scroll-driven. Idéal pour la mode, le voyage, le lifestyle.",
    stats: [
      { v: "Editorial", l: "style" },
      { v: "Texte 3D", l: "feature" },
    ],
  },
  {
    label: "T3 — IMMERSIVE",
    title: "Monde immersif scroll",
    desc: "Scène 3D complète. Le scroll devient la caméra cinéma. Pour outdoor, hospitality, expérientiel premium.",
    stats: [
      { v: "Full 3D", l: "scène" },
      { v: "Scroll = caméra", l: "interaction" },
    ],
  },
  {
    label: "T5 — DIGITAL MIX",
    title: "Digital + Analog mix",
    desc: "Mix photos physiques + objets 3D. Contraste sensoriel premium. Parfait pour food, luxe, art de vivre.",
    stats: [
      { v: "Hybride", l: "approche" },
      { v: "Contraste", l: "feel" },
    ],
  },
];

const STICKY_TOP = 80;
const STICKY_STEP = 16;
const SCALE_STEP = 0.04;
const OFFSET_STEP = 8;

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] tracking-widest font-mono text-black/40 bg-black/[0.04]">
      {children}
    </span>
  );
}

export function StackingTemplateCards() {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [depth, setDepth] = useState<number[]>(TEMPLATES.map(() => 0));

  useEffect(() => {
    function onScroll() {
      const nextDepth = TEMPLATES.map((_, i) => {
        let count = 0;
        for (let j = i + 1; j < TEMPLATES.length; j++) {
          const el = cardRefs.current[j];
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          const stickyTopJ = STICKY_TOP + j * STICKY_STEP;
          if (rect.top <= stickyTopJ + 2) count++;
        }
        return count;
      });
      setDepth(nextDepth);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex flex-col" style={{ perspective: "1400px", perspectiveOrigin: "50% 0%" }}>
      {TEMPLATES.map((tpl, i) => {
        const d = depth[i];
        const scale = 1 - d * SCALE_STEP;
        const translateY = d * OFFSET_STEP;

        return (
          <div
            key={tpl.label}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="sticky mb-4"
            style={{ top: `${STICKY_TOP + i * STICKY_STEP}px`, zIndex: 10 + i }}
          >
            <div
              style={{
                transform: `scale(${scale}) translateY(${translateY}px)`,
                transformOrigin: "top center",
                transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
                willChange: "transform",
              }}
            >
              <div className="group relative bg-[#faf9f7] rounded-2xl border border-black/[0.07] overflow-hidden">
                <div className="relative z-10 p-8 md:p-10">
                  <div className="md:max-w-[60%]">
                    <Tag>{tpl.label}</Tag>
                    <h3 className="mt-6 text-2xl md:text-3xl font-light mb-3">{tpl.title}</h3>
                    <p className="text-sm text-black/45 leading-relaxed mb-8">{tpl.desc}</p>
                  </div>
                  <div className="flex gap-8 pt-6 border-t border-black/[0.06]">
                    {tpl.stats.map((s) => (
                      <div key={s.l}>
                        <div className="text-2xl font-light">{s.v}</div>
                        <div className="text-[11px] text-black/35 tracking-widest mt-0.5">{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Visuel décoratif droit — formes géométriques */}
                <div className="hidden md:block absolute inset-y-0 right-0 w-1/2 pointer-events-none overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="w-48 h-48 rounded-2xl border border-black/10 bg-gradient-to-br from-white/40 to-transparent"
                      style={{
                        transform: `rotate(${i * 12}deg)`,
                        boxShadow: "0 20px 60px -20px rgba(0,0,0,0.15)",
                      }}
                    />
                  </div>
                  <div
                    className="absolute inset-0"
                    style={{
                      background: "linear-gradient(to right, #faf9f7 0%, transparent 60%)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
