"use client";

import { useEffect, useState, useRef } from "react";

const PRODUCTS = [
  "Wool Runner — Tuke River",
  "Sugar Zeffer 2 — Natural Black",
  "Loom Sweat-shirt Léonard",
  "Aime Curcuma Bio",
  "Patine Veste workwear",
  "Respire Déodorant Coco",
  "Bonsoirs Drap Lin Sable",
  "1083 Jean droit raw",
];

const STAGES = [
  { label: "scraping", color: "#facc15" },
  { label: "analyzing", color: "#60a5fa" },
  { label: "3D gen", color: "#a78bfa" },
  { label: "rendering", color: "#4ade80" },
];

type Row = {
  id: string;
  product: string;
  brand: string;
  template: string;
  stage: typeof STAGES[number];
  progress: number;
  cost: string;
  key: number;
};

const BRANDS = ["allbirds", "loom.fr", "aime.co", "patine.fr", "respire.co", "bonsoirs.com"];
const TEMPLATES = ["T1 Hero 3D", "T5 Digital Mix", "T2 Full-Bleed", "T3 Immersive"];

function randomRow(key: number): Row {
  return {
    id: Math.random().toString(36).slice(2, 8).toUpperCase(),
    product: PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)],
    brand: BRANDS[Math.floor(Math.random() * BRANDS.length)],
    template: TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)],
    stage: STAGES[Math.floor(Math.random() * STAGES.length)],
    progress: Math.floor(Math.random() * 85 + 10),
    cost: `$0.${Math.floor(Math.random() * 30 + 5).toString().padStart(2, "0")}`,
    key,
  };
}

function ProgressBar({ initial }: { initial: number }) {
  const [pct, setPct] = useState(initial);
  const rafRef = useRef<number>(0);
  const pctRef = useRef(initial);

  useEffect(() => {
    const tick = () => {
      pctRef.current = Math.min(99, pctRef.current + 0.02);
      setPct(Math.round(pctRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div style={{ width: "100%", height: 2, background: "rgba(0,0,0,0.08)", borderRadius: 9 }}>
      <div
        style={{
          height: "100%",
          borderRadius: 9,
          width: `${pct}%`,
          background: "rgba(0,0,0,0.35)",
          transition: "width 0.5s linear",
        }}
      />
    </div>
  );
}

const SEED_ROWS: Row[] = [
  { id: "A1B2C3", product: "Wool Runner — Tuke River", brand: "allbirds", template: "T1 Hero 3D", stage: STAGES[1], progress: 42, cost: "$0.12", key: 0 },
  { id: "D4E5F6", product: "Loom Sweat-shirt Léonard", brand: "loom.fr", template: "T1 Hero 3D", stage: STAGES[2], progress: 67, cost: "$0.18", key: 1 },
  { id: "G7H8I9", product: "Aime Curcuma Bio", brand: "aime.co", template: "T1 Hero 3D", stage: STAGES[0], progress: 18, cost: "$0.05", key: 2 },
  { id: "J0K1L2", product: "Patine Veste workwear", brand: "patine.fr", template: "T2 Full-Bleed", stage: STAGES[3], progress: 88, cost: "$0.22", key: 3 },
  { id: "M3N4O5", product: "Respire Déodorant Coco", brand: "respire.co", template: "T1 Hero 3D", stage: STAGES[1], progress: 55, cost: "$0.14", key: 4 },
];

export function LivePipelineFeed() {
  const [rows, setRows] = useState<Row[]>(SEED_ROWS);
  const keyRef = useRef(100);

  useEffect(() => {
    setRows(Array.from({ length: 5 }, (_, i) => randomRow(i)));
    const t = setInterval(() => {
      keyRef.current++;
      setRows((prev) => [...prev.slice(1), randomRow(keyRef.current)]);
    }, 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 16,
        overflow: "hidden",
        background: "rgba(255,255,255,0.7)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 80px 80px 90px",
          padding: "8px 16px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          background: "rgba(0,0,0,0.03)",
        }}
      >
        {["PRODUIT / MARQUE", "TEMPLATE", "COÛT IA", "STATUS"].map((h) => (
          <span
            key={h}
            style={{
              fontSize: 8,
              letterSpacing: "0.16em",
              color: "rgba(0,0,0,0.30)",
              fontFamily: "monospace",
            }}
          >
            {h}
          </span>
        ))}
      </div>

      <div style={{ overflow: "hidden" }}>
        {rows.map((row, i) => (
          <div
            key={row.key}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 80px 90px",
              padding: "10px 16px",
              borderBottom: "1px solid rgba(0,0,0,0.04)",
              gap: 8,
              alignItems: "center",
              animation: i === rows.length - 1 ? "rowSlideIn 0.4s cubic-bezier(0.16,1,0.3,1) both" : "none",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 9.5,
                  color: "rgba(0,0,0,0.65)",
                  marginBottom: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {row.product}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 7.5, fontFamily: "monospace", color: "rgba(0,0,0,0.30)" }}>
                  {row.brand} · #{row.id}
                </span>
              </div>
              <div style={{ marginTop: 5 }}>
                <ProgressBar initial={row.progress} />
              </div>
            </div>

            <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(0,0,0,0.45)" }}>
              {row.template}
            </div>

            <div style={{ fontSize: 9, fontFamily: "monospace", color: "rgba(0,0,0,0.55)" }}>
              {row.cost}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: row.stage.color,
                  boxShadow: `0 0 6px ${row.stage.color}`,
                  animation: "statusPulse 2s ease-in-out infinite",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 8, fontFamily: "monospace", color: "rgba(0,0,0,0.50)" }}>
                {row.stage.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LiveCounter() {
  const count = 1432;

  return (
    <span
      style={{
        fontFamily: "monospace",
        fontSize: "clamp(3rem, 6vw, 5rem)",
        fontWeight: 300,
        color: "rgba(0,0,0,0.85)",
        lineHeight: 1,
        letterSpacing: "-0.02em",
      }}
    >
      {count.toLocaleString("fr-FR")}
    </span>
  );
}
