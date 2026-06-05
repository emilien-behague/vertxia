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
    lastMidX: number;
    lastMidY: number;
    hasContent: boolean;
  }>({ isDrawing: false, lastX: 0, lastY: 0, lastMidX: 0, lastMidY: 0, hasContent: false });
  const [hasContent, setHasContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingSignature, setExistingSignature] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

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
      // Le point initial sert AUSSI de premier "midpoint" pour démarrer la chaîne
      drawingRef.current.lastMidX = x;
      drawingRef.current.lastMidY = y;
      // Dépose un petit point pour qu'un tap simple soit visible
      if (!ctx) return;
      ctx.beginPath();
      ctx.arc(x, y, ctx.lineWidth / 2.4, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle as string;
      ctx.fill();
    }

    function move(e: TouchEvent | MouseEvent) {
      if (!drawingRef.current.isDrawing) return;
      e.preventDefault();
      const { x, y } = getEventCoords(e);
      if (!ctx) return;

      // Mid-point smoothing propre :
      // - on relie le PRÉCÉDENT midpoint au NOUVEAU midpoint
      // - le point brut sert de control point (donne la courbure)
      // - aucun gap entre segments → tracé continu sans pointillés
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
      // Termine proprement le tracé jusqu'au dernier point brut
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(drawingRef.current.lastMidX, drawingRef.current.lastMidY);
      ctx.lineTo(drawingRef.current.lastX, drawingRef.current.lastY);
      ctx.stroke();
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

  /** Downscale le canvas signature dans un offscreen canvas a 600x200 max
   *  puis export en JPEG fond blanc qualite 60. Taille typique resultante :
   *  15-30KB (contre 100-300KB avec le canvas natif iPhone @ dpr=3). */
  function exportCompressedSignature(): string {
    const src = canvasRef.current;
    if (!src) throw new Error("Canvas indisponible");
    const MAX_W = 600;
    const MAX_H = 200;
    const ratio = Math.min(MAX_W / src.width, MAX_H / src.height, 1);
    const w = Math.round(src.width * ratio);
    const h = Math.round(src.height * ratio);
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d");
    if (!ctx) throw new Error("Contexte 2D indisponible");
    // Fond blanc explicite : la signature est noire sur transparent, et le
    // JPEG ne gere pas la transparence -> sans fond on aurait un fond noir.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, w, h);
    return off.toDataURL("image/jpeg", 0.6);
  }

  /** Auto-cleanup des plus vieux diagnostics si le quota explose. Libere
   *  environ 200KB par diagnostic (photo + resultat). On supprime jusqu'a
   *  N anciens — l'user ne perd qu'un historique long, pas les recents. */
  function cleanupOldDiagnostics(n: number): void {
    try {
      const STORAGE_KEY = "vertxia:diagnostics";
      // On lit toutes les clés scoped par user (vertxia:diagnostics:<uid>)
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_KEY)) keys.push(k);
      }
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as Array<{ createdAt: string }>;
          if (!Array.isArray(parsed) || parsed.length === 0) continue;
          // Tri desc par date, on garde les N plus recents, on supprime les autres
          parsed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          const keep = parsed.slice(0, Math.max(0, parsed.length - n));
          localStorage.setItem(key, JSON.stringify(keep));
        } catch {
          /* ignore parse errors */
        }
      }
    } catch (e) {
      console.warn("[signature] cleanup failed:", e);
    }
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas || saving) return;
    setError(null);
    setSaving(true);
    try {
      // Export compresse : downscale 600x200 + JPEG 60% -> typiquement <30KB
      // au lieu de 100-300KB en PNG full size, ce qui evite de saturer le
      // localStorage iPhone (5MB hard limit) deja occupe par les diagnostics.
      const dataUrl = exportCompressedSignature();
      const profil = loadProfil();
      try {
        saveProfil({ ...profil, signatureDataUrl: dataUrl });
        router.push("/m/profil");
        return;
      } catch (innerErr) {
        // Premier essai foire : si c'est QuotaExceeded, on cleanup 10 diags
        // anciens et on retry une fois. Sinon on rethrow.
        const ie = innerErr instanceof Error ? innerErr : new Error(String(innerErr));
        const isQuota =
          ie.name === "QuotaExceededError" || /quota|storage/i.test(ie.message);
        if (!isQuota) throw ie;
        cleanupOldDiagnostics(10);
        // Retry apres cleanup
        saveProfil({ ...profil, signatureDataUrl: dataUrl });
        router.push("/m/profil");
        return;
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error("[signature] save failed:", err);
      const isQuota =
        err.name === "QuotaExceededError" || /quota|storage/i.test(err.message);
      setError(
        isQuota
          ? "Espace de stockage saturé sur le téléphone. Va dans l'historique de diagnostics et supprime-en quelques-uns, puis recommence."
          : `Échec enregistrement : ${err.message}`
      );
      setSaving(false);
    }
  }

  function handleRemove() {
    // confirm() peut etre bloque en PWA standalone iOS -> fallback try direct
    let ok = true;
    try {
      ok = window.confirm("Supprimer la signature enregistrée ?");
    } catch {
      ok = true;
    }
    if (!ok) return;
    setError(null);
    try {
      const profil = loadProfil();
      saveProfil({ ...profil, signatureDataUrl: undefined });
      router.push("/m/profil");
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      console.error("[signature] remove failed:", err);
      setError(`Échec suppression : ${err.message}`);
    }
  }

  return (
    <>
      <MobileHeader title="✍️ Signature" largeTitle backHref="/m/profil" />

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

      {/* Banner erreur si save/remove a foire */}
      {error && (
        <div className="mx-4 mt-4 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-[13px] text-red-700 leading-relaxed">
          {error}
        </div>
      )}

      {/* CTA tuile XL emerald + boutons secondaires discrets */}
      <div className="px-4 mt-5 space-y-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={(!hasContent && !existingSignature) || saving}
          className="relative block w-full text-left rounded-3xl shadow-lg shadow-black/10 active:scale-[0.98] transition-transform overflow-hidden px-5 py-5 disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, #10b981 0%, #0f766e 100%)",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          }}
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl leading-none drop-shadow shrink-0">
              {saving ? "⏳" : "✅"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[17px] font-bold uppercase tracking-wide text-white leading-tight">
                {saving ? "Enregistrement…" : "Valider et enregistrer"}
              </div>
              <div className="text-[12px] text-white/85 mt-0.5">
                {saving ? "Sauvegarde en cours" : "Sauvegarder la signature"}
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={handleClear}
          disabled={!hasContent || saving}
          className="w-full px-6 py-3 rounded-2xl bg-black/[0.04] text-black/65 text-[14px] font-medium active:bg-black/[0.08] transition-colors disabled:opacity-40"
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
