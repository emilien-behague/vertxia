"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { loadProfil, saveProfil } from "@/lib/profil";

// Canvas signature mobile-native — capture touch events + dessin lissé (mid-point).
// Au tap "Valider" : conversion en dataURL PNG sauvegardé dans le profil entreprise.
// Sera ré-utilisé automatiquement pour signer les CERFA et les emails de relance.

export default function MobileSignaturePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<{
    isDrawing: boolean;
    lastX: number;
    lastY: number;
    hasContent: boolean;
  }>({ isDrawing: false, lastX: 0, lastY: 0, hasContent: false });
  const [hasContent, setHasContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingSignature, setExistingSignature] = useState<string | undefined>(undefined);

  useEffect(() => {
    const profil = loadProfil();
    setExistingSignature(profil.signatureDataUrl);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Setup canvas haute résolution (retina)
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

    // Si une signature existait déjà → la charger
    if (profil.signatureDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        drawingRef.current.hasContent = true;
        setHasContent(true);
      };
      img.src = profil.signatureDataUrl;
    }
  }, []);

  function getEventCoords(e: TouchEvent | MouseEvent): { x: number; y: number } {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    if ("clientX" in e) {
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    return { x: 0, y: 0 };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function start(e: TouchEvent | MouseEvent) {
      e.preventDefault();
      const { x, y } = getEventCoords(e);
      drawingRef.current.isDrawing = true;
      drawingRef.current.lastX = x;
      drawingRef.current.lastY = y;
    }

    function move(e: TouchEvent | MouseEvent) {
      if (!drawingRef.current.isDrawing) return;
      e.preventDefault();
      const { x, y } = getEventCoords(e);
      if (!ctx) return;

      // Lissage mid-point
      const midX = (drawingRef.current.lastX + x) / 2;
      const midY = (drawingRef.current.lastY + y) / 2;
      ctx.beginPath();
      ctx.moveTo(drawingRef.current.lastX, drawingRef.current.lastY);
      ctx.quadraticCurveTo(drawingRef.current.lastX, drawingRef.current.lastY, midX, midY);
      ctx.stroke();
      drawingRef.current.lastX = x;
      drawingRef.current.lastY = y;
      if (!drawingRef.current.hasContent) {
        drawingRef.current.hasContent = true;
        setHasContent(true);
      }
    }

    function end(e: TouchEvent | MouseEvent) {
      if (!drawingRef.current.isDrawing) return;
      e.preventDefault();
      drawingRef.current.isDrawing = false;
    }

    // Touch events (priorité iOS)
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end, { passive: false });
    canvas.addEventListener("touchcancel", end, { passive: false });

    // Mouse events (desktop fallback pour test)
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
  }, []);

  function handleClear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingRef.current.hasContent = false;
    setHasContent(false);
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas || saving) return;
    setSaving(true);
    try {
      // Trim transparent edges + export en PNG dataURL
      const dataUrl = canvas.toDataURL("image/png");
      const profil = loadProfil();
      saveProfil({ ...profil, signatureDataUrl: dataUrl });
      router.push("/m/profil");
    } catch (e) {
      console.error("Save signature failed:", e);
      setSaving(false);
    }
  }

  function handleRemove() {
    if (!confirm("Supprimer la signature enregistrée ?")) return;
    const profil = loadProfil();
    saveProfil({ ...profil, signatureDataUrl: undefined });
    router.push("/m/profil");
  }

  return (
    <>
      <MobileHeader title="Signature" largeTitle backHref="/m/profil" />

      <div className="px-5 mt-1 text-[14px] text-black/55 leading-relaxed">
        Signez avec le doigt. Cette signature sera utilisée pour les CERFA 15497*04 et
        les emails de relance pré-remplis.
      </div>

      {/* Zone canvas */}
      <div className="px-4 mt-5">
        <div className="relative rounded-2xl bg-white ring-1 ring-black/[0.08] overflow-hidden">
          {/* Ligne pointillée signature visuelle */}
          <div className="absolute inset-x-6 bottom-12 border-b border-dashed border-black/15 pointer-events-none" />
          <div className="absolute left-6 bottom-3 text-[10px] font-mono tracking-widest uppercase text-black/30 pointer-events-none">
            Signature gérant
          </div>

          <canvas
            ref={canvasRef}
            style={{
              width: "100%",
              height: "300px",
              touchAction: "none",
              cursor: "crosshair",
              display: "block",
            }}
          />

          {/* Hint au premier chargement vide */}
          {!hasContent && !existingSignature && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-3xl mb-1">✍️</div>
                <div className="text-[12px] text-black/35">Glisse ton doigt pour signer</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 mt-5 space-y-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasContent || saving}
          className="w-full px-6 py-4 rounded-2xl bg-[#111] text-white text-[15px] font-medium active:bg-black/90 transition-colors disabled:opacity-40"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          {saving ? "Enregistrement…" : "✓ Valider et enregistrer"}
        </button>

        <button
          type="button"
          onClick={handleClear}
          disabled={!hasContent || saving}
          className="w-full px-6 py-3 rounded-2xl bg-white border border-black/10 text-black/70 text-[14px] font-medium active:bg-black/[0.03] transition-colors disabled:opacity-40"
          style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
        >
          Effacer et recommencer
        </button>

        {existingSignature && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={saving}
            className="w-full px-6 py-3 rounded-2xl bg-white border border-red-200 text-red-600 text-[13px] font-medium active:bg-red-50 transition-colors disabled:opacity-40"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            Supprimer la signature enregistrée
          </button>
        )}
      </div>

      <div className="px-5 mt-6 text-[11px] text-black/40 leading-relaxed">
        Ta signature est enregistrée localement sur ton téléphone (jamais envoyée au serveur).
        Elle sera intégrée automatiquement aux PDF CERFA et aux emails que tu envoies via l&apos;app.
      </div>
    </>
  );
}
