"use client";

/**
 * EditChatPanel — panneau lateral chat pour iterer sur un site Vertxia Lite.
 *
 * Port d'Open-Lovable UX adapte au cas Vertxia :
 *  - FAB en bas a droite (collapse)
 *  - Au clic : panneau slide-in droite avec input + historique + suggestions
 *  - Submit : POST /api/lite/edit
 *  - Undo : POST /api/lite/edit/undo
 *  - Affiche le type d'intent detecte (badge) sur chaque message system
 *
 * Edit types geres : UPDATE_PALETTE, UPDATE_COPY, UPDATE_SECTION,
 * UPDATE_MOOD, CHANGE_TEMPLATE.
 */

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "system";
  text: string;
  timestamp: number;
  intent?: string;
  editId?: string;
  isError?: boolean;
};

type Props = {
  slug: string;
  accent: string;
  bg: string;
  fg: string;
};

type SuggestionCategory = {
  label: string;
  items: string[];
};

const SUGGESTION_CATEGORIES: SuggestionCategory[] = [
  {
    label: "Palette",
    items: [
      "Palette plus sombre",
      "Mood luxe avec accent dore",
      "Monochrome noir et blanc",
      "Plus chaud, tons rouille",
    ],
  },
  {
    label: "Copy",
    items: [
      "Reecris le hero plus punchy",
      "Manifesto plus direct",
      "Footer plus court",
      "Tout le site plus premium",
    ],
  },
  {
    label: "Mood",
    items: [
      "Mood brutalist tech",
      "Mood editorial magazine",
      "Mood minimal calme",
      "Mood Y2K energique",
    ],
  },
  {
    label: "Template",
    items: [
      "Passe en template brutalist",
      "Layout magazine editorial",
      "Slider horizontal",
      "Recit cinematique",
    ],
  },
];

const PLACEHOLDER = "Dis ce que tu veux changer : palette, copy, mood, section, template...";

const INTENT_LABELS: Record<string, string> = {
  UPDATE_PALETTE: "Palette",
  UPDATE_COPY: "Copy",
  UPDATE_SECTION: "Section",
  UPDATE_MOOD: "Mood",
  CHANGE_TEMPLATE: "Template",
  REPLACE_VIDEO: "Video",
  UNKNOWN: "?",
};

export function EditChatPanel({ slug, accent, bg, fg }: Props) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const [hasHistory, setHasHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Init : check si l'history serveur a deja des entries (apres reload)
  useEffect(() => {
    fetch(`/api/lite/edit/history?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.count && data.count > 0) {
          setHasHistory(true);
        }
      })
      .catch(() => {
        // silently ignore - user not authed or history not available
      });
  }, [slug]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, submitting]);

  async function handleSubmit(message: string) {
    const trimmed = message.trim();
    if (!trimmed || submitting) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", text: trimmed, timestamp: Date.now() },
    ]);
    setInput("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/lite/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, message: trimmed }),
      });

      const data = (await res.json()) as {
        success: boolean;
        intent?: { type: string; description: string };
        changeDescription?: string;
        editId?: string;
        error?: string;
      };

      if (data.success && data.changeDescription) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: data.changeDescription!,
            timestamp: Date.now(),
            intent: data.intent?.type,
            editId: data.editId,
          },
        ]);
        setHasHistory(true);
        setTimeout(() => {
          window.location.reload();
        }, 1400);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text:
              data.error ||
              "Echec inconnu. Reformule plus precisement (palette, copy, mood, section, template).",
            timestamp: Date.now(),
            intent: data.intent?.type,
            isError: true,
          },
        ]);
        setSubmitting(false);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: `Erreur reseau : ${err instanceof Error ? err.message : "unknown"}`,
          timestamp: Date.now(),
          isError: true,
        },
      ]);
      setSubmitting(false);
    }
  }

  async function handleUndo() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/lite/edit/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = (await res.json()) as {
        success: boolean;
        undoneEdit?: { userMessage: string; changeDescription: string; intentType: string };
        error?: string;
      };
      if (data.success && data.undoneEdit) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: `Annule : ${data.undoneEdit!.changeDescription}`,
            timestamp: Date.now(),
            intent: "UNDO",
          },
        ]);
        setHasHistory(false); // approximation, server may still have more
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            text: data.error || "Rien a annuler.",
            timestamp: Date.now(),
            isError: true,
          },
        ]);
        setSubmitting(false);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          text: `Erreur reseau (undo) : ${err instanceof Error ? err.message : "unknown"}`,
          timestamp: Date.now(),
          isError: true,
        },
      ]);
      setSubmitting(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  }

  const currentSuggestions = SUGGESTION_CATEGORIES[activeCategory];

  return (
    <>
      {/* FAB toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-[9999] flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
        style={{ background: accent, color: bg }}
        aria-label={open ? "Fermer le chat" : "Ouvrir le chat d'edition"}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Panel slide-in */}
      <aside
        className="fixed bottom-24 right-6 z-[9998] w-[400px] max-w-[calc(100vw-3rem)] rounded-lg shadow-2xl transition-all duration-300"
        style={{
          background: bg,
          color: fg,
          border: `1px solid ${fg}20`,
          transform: open ? "translateY(0)" : "translateY(20px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {/* Header */}
        <div className="border-b px-5 py-4 flex items-center justify-between" style={{ borderColor: `${fg}14` }}>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] mb-1" style={{ color: `${fg}70` }}>
              Edit avec Vertxia
            </p>
            <p className="text-sm font-medium">Dis-moi ce que tu veux changer</p>
          </div>
          {hasHistory && (
            <button
              type="button"
              onClick={handleUndo}
              disabled={submitting}
              className="text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 rounded transition-opacity disabled:opacity-30"
              style={{
                background: `${fg}08`,
                color: `${fg}b0`,
                border: `1px solid ${fg}20`,
              }}
              aria-label="Annuler le dernier changement"
            >
              ↶ Undo
            </button>
          )}
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="max-h-[260px] overflow-y-auto px-5 py-4 space-y-3"
        >
          {messages.length === 0 && (
            <p className="text-xs leading-relaxed" style={{ color: `${fg}80` }}>
              Je sais modifier&nbsp;: la <em>palette</em>, le <em>copy</em> (hero, manifesto, footer, ou tout
              le site), le <em>mood</em>, et le <em>template</em>. Pose-moi une demande en francais.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-xs leading-relaxed ${m.role === "user" ? "text-right" : ""}`}
            >
              <span
                className="inline-block max-w-[88%] rounded-lg px-3 py-2"
                style={{
                  background: m.isError
                    ? "#9c2c2c20"
                    : m.role === "user"
                    ? `${accent}20`
                    : `${fg}08`,
                  color: m.isError
                    ? "#e88080"
                    : m.role === "user"
                    ? accent
                    : fg,
                  border: m.role === "user" ? `1px solid ${accent}30` : "none",
                }}
              >
                {m.intent && m.role === "system" && (
                  <span
                    className="inline-block text-[9px] uppercase tracking-[0.2em] mr-2 px-1.5 py-0.5 rounded"
                    style={{
                      background: m.intent === "UNDO" ? `${fg}14` : `${accent}15`,
                      color: m.intent === "UNDO" ? `${fg}80` : accent,
                    }}
                  >
                    {INTENT_LABELS[m.intent] || m.intent}
                  </span>
                )}
                {m.text}
              </span>
            </div>
          ))}
          {submitting && (
            <div className="text-xs" style={{ color: `${fg}70` }}>
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: accent }}
                />
                Application du changement...
              </span>
            </div>
          )}
        </div>

        {/* Categories tabs */}
        {messages.length === 0 && !submitting && (
          <>
            <div className="px-5 pb-2 flex gap-1">
              {SUGGESTION_CATEGORIES.map((cat, i) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => setActiveCategory(i)}
                  className="text-[9px] uppercase tracking-[0.2em] px-2 py-1 rounded-full transition-colors"
                  style={{
                    background: activeCategory === i ? accent : `${fg}08`,
                    color: activeCategory === i ? bg : `${fg}b0`,
                    border: activeCategory === i ? "none" : `1px solid ${fg}14`,
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Suggestions */}
            <div className="px-5 pb-3 flex flex-wrap gap-1.5">
              {currentSuggestions.items.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSubmit(s)}
                  className="text-[10px] px-2.5 py-1 rounded-full transition-colors"
                  style={{
                    background: `${fg}06`,
                    color: `${fg}b0`,
                    border: `1px solid ${fg}14`,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(input);
          }}
          className="border-t flex items-center gap-2 px-3 py-3"
          style={{ borderColor: `${fg}14` }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={PLACEHOLDER}
            disabled={submitting}
            maxLength={500}
            className="flex-1 bg-transparent text-xs outline-none px-2"
            style={{ color: fg }}
          />
          <button
            type="submit"
            disabled={submitting || !input.trim()}
            className="text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 rounded transition-opacity disabled:opacity-30"
            style={{ background: accent, color: bg }}
          >
            {submitting ? "..." : "Send"}
          </button>
        </form>
      </aside>
    </>
  );
}
