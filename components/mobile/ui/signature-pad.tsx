"use client";

import { useEffect, useRef, useState } from "react";

// Canvas signature tactile réutilisable — mid-point smoothing propre, touch + mouse.
// Émet un PNG dataURL au parent dès qu'on relâche le doigt (debounced via signal
// "endStroke"). Le parent garde la dataURL en state et peut la vider via clearKey.

export type SignaturePadProps = {
  onChange: (dataUrl: string | null) => void;
  /** Incrémente cette valeur pour vider le canvas depuis le parent. */
  clearKey?: number;
  /** Hauteur du canvas en px (défaut 180) */
  height?: number;
  /** Label discret affiché en bas du canvas */
  label?: string;
  className?: string;
};

export function SignaturePad({
  onChange,
  clearKey = 0,
  height = 180,
  label = "SIGNATURE",
  className = "",
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<{
    isDrawing: boolean;
    lastX: number;
    lastY: number;
    lastMidX: number;
    lastMidY: number;
    hasContent: boolean;
  }>({ isDrawing: false, lastX: 0, lastY: 0, lastMidX: 0, lastMidY: 0, hasContent: false });
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    function getCoords(e: TouchEvent | MouseEvent) {
      if (!canvas) return { x: 0, y: 0 };
      const r = canvas.getBoundingClientRect();
      if ("touches" in e && e.touches.length > 0) {
        return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
      }
      if ("clientX" in e) {
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      }
      return { x: 0, y: 0 };
    }

    function start(e: TouchEvent | MouseEvent) {
      e.preventDefault();
      const { x, y } = getCoords(e);
      drawingRef.current.isDrawing = true;
      drawingRef.current.lastX = x;
      drawingRef.current.lastY = y;
      drawingRef.current.lastMidX = x;
      drawingRef.current.lastMidY = y;
      if (!ctx) return;
      ctx.beginPath();
      ctx.arc(x, y, ctx.lineWidth / 2.4, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle as string;
      ctx.fill();
    }

    function move(e: TouchEvent | MouseEvent) {
      if (!drawingRef.current.isDrawing) return;
      e.preventDefault();
      const { x, y } = getCoords(e);
      if (!ctx) return;
      const midX = (drawingRef.current.lastX + x) / 2;
      const midY = (drawingRef.current.lastY + y) / 2;
      ctx.beginPath();
      ctx.moveTo(drawingRef.current.lastMidX, drawingRef.current.lastMidY);
      ctx.quadraticCurveTo(drawingRef.current.lastX, drawingRef.current.lastY, midX, midY);
      ctx.stroke();
      drawingRef.current.lastX = x;
      drawingRef.current.lastY = y;
      drawingRef.current.lastMidX = midX;
      drawingRef.current.lastMidY = midY;
      if (!drawingRef.current.hasContent) {
        drawingRef.current.hasContent = true;
        setHasContent(true);
      }
    }

    function end(e: TouchEvent | MouseEvent) {
      if (!drawingRef.current.isDrawing) return;
      e.preventDefault();
      drawingRef.current.isDrawing = false;
      if (!ctx || !canvas) return;
      ctx.beginPath();
      ctx.moveTo(drawingRef.current.lastMidX, drawingRef.current.lastMidY);
      ctx.lineTo(drawingRef.current.lastX, drawingRef.current.lastY);
      ctx.stroke();
      // Émet la dataURL au parent à chaque fin de trait
      if (drawingRef.current.hasContent) {
        try {
          const dataUrl = canvas.toDataURL("image/png");
          onChange(dataUrl);
        } catch {
          // Canvas tainted (shouldn't happen ici, pas d'image externe)
        }
      }
    }

    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end, { passive: false });
    canvas.addEventListener("touchcancel", end, { passive: false });
    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);

    return () => {
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
      canvas.removeEventListener("touchcancel", end);
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("mouseleave", end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset signal depuis le parent
  useEffect(() => {
    if (clearKey === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingRef.current.hasContent = false;
    setHasContent(false);
    onChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearKey]);

  function handleClear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingRef.current.hasContent = false;
    setHasContent(false);
    onChange(null);
  }

  return (
    <div className={className}>
      <div className="relative rounded-2xl bg-white ring-1 ring-black/[0.08] overflow-hidden">
        <div
          className="absolute inset-x-6 border-b border-dashed border-black/15 pointer-events-none"
          style={{ bottom: 24 }}
        />
        <div className="absolute left-6 bottom-2 text-[10px] font-mono tracking-widest uppercase text-black/30 pointer-events-none">
          {label}
        </div>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height,
            touchAction: "none",
            WebkitTapHighlightColor: "transparent",
            display: "block",
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className={hasContent ? "text-emerald-700 font-medium" : "text-black/40"}>
          {hasContent ? "✓ Signé" : "Tendez le téléphone au client"}
        </span>
        {hasContent && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-1 rounded-full bg-black/[0.05] text-black/60 active:bg-black/[0.1]"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Effacer
          </button>
        )}
      </div>
    </div>
  );
}
