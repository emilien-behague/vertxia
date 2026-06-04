"use client";

// Chat assistant F-Gas — bouton flottant + drawer fullscreen mobile.
// Pose une question terrain (réglementaire, calcul tCO2eq, diag, fluide) →
// réponse experte streamée live de Claude Sonnet 4.6.
//
// Stack : Vaul drawer (iOS-style), framer-motion micro-anims, scopedKey
// localStorage pour persister l'historique des 50 derniers messages
// par utilisateur (clé "vertxia:chat:<user-id>").

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Drawer } from "vaul";
import { scopedKey } from "@/lib/user-scope";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const STORAGE_KEY_BASE = "vertxia:chat";
const MAX_STORED_MESSAGES = 50;

const SUGGESTIONS = [
  "Mon client a un R-22 de 12 kg, je peux le recharger ?",
  "Quel délai de contrôle pour 8 tCO2eq sans détecteur fixe ?",
  "Quel substitut R-410A pour pompe à chaleur résidentielle ?",
  "Comment je calcule la charge d'un VRV multi-split ?",
];

function loadMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(scopedKey(STORAGE_KEY_BASE));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
}

function saveMessages(messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    const toStore = messages.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(scopedKey(STORAGE_KEY_BASE), JSON.stringify(toStore));
  } catch {
    // localStorage plein ou indisponible — silencieux
  }
}

type Props = {
  /** Contexte équipement optionnel passé depuis /eq/[id] pour réponses ciblées */
  equipementContext?: {
    modele?: string;
    fluide?: string;
    chargeKg?: number;
    detecteurFixe?: boolean;
    dernierControleISO?: string;
    clientName?: string;
  };
};

export function ChatAssistant({ equipementContext }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Charge l'historique au montage
  useEffect(() => {
    setMessages(loadMessages());
  }, []);

  // Auto-scroll en bas à chaque nouveau message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  // Focus l'input à l'ouverture du drawer
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy) return;

    setError(null);
    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);

    // Place un message assistant vide qu'on va remplir au fur et à mesure
    const placeholderIdx = nextMessages.length;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          equipementContext,
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[placeholderIdx] = { role: "assistant", content: accumulated };
          return next;
        });
      }

      // Persiste après stream complet
      const finalMessages: ChatMessage[] = [
        ...nextMessages,
        { role: "assistant", content: accumulated },
      ];
      saveMessages(finalMessages);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Erreur réseau";
      setError(errMsg);
      // Retire le placeholder vide en cas d'erreur
      setMessages((prev) => prev.slice(0, placeholderIdx));
    } finally {
      setBusy(false);
    }
  }

  function handleSuggestion(s: string) {
    setInput(s);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleClear() {
    if (!window.confirm("Effacer toute la conversation ?")) return;
    setMessages([]);
    setError(null);
    saveMessages([]);
  }

  return (
    <>
      {/* Bouton flottant — caché quand drawer ouvert */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir l'assistant F-Gas"
          className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-[#A16207] text-white shadow-lg shadow-[#A16207]/30 flex items-center justify-center active:scale-95 transition-transform"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
        </button>
      )}

      <Drawer.Root open={open} onOpenChange={setOpen} shouldScaleBackground>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl bg-[#F5F4F0] outline-none" style={{ height: "92vh" }}>
            <Drawer.Title className="sr-only">Assistant F-Gas Vertxia</Drawer.Title>

            {/* Handle */}
            <div className="mx-auto mt-2 mb-1 h-1.5 w-12 rounded-full bg-black/20" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#A16207] text-white flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-[#111] leading-tight">Assistant F-Gas</div>
                  <div className="text-[11px] text-black/55 leading-tight">Réglementation, fluides, diag terrain</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[12px] text-black/45 active:text-black/70 transition-colors"
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    Effacer
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                  className="w-8 h-8 rounded-full bg-black/[0.06] flex items-center justify-center active:bg-black/[0.12] transition-colors"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages list */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
              {messages.length === 0 && !busy && (
                <div className="space-y-4">
                  <div className="text-center pt-6 pb-2">
                    <div className="text-[14px] text-black/65 leading-relaxed max-w-xs mx-auto">
                      Pose-moi une question sur le froid, la clim, les PAC, ou la réglementation F-Gas.
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] uppercase tracking-wider text-black/40 font-medium px-1">
                      Exemples
                    </div>
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleSuggestion(s)}
                        className="w-full text-left px-4 py-3 rounded-2xl bg-white border border-black/[0.06] text-[13px] text-[#111] leading-snug active:bg-black/[0.03] transition-colors"
                        style={{ WebkitTapHighlightColor: "transparent" }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-[#A16207] text-white rounded-br-sm"
                        : "bg-white text-[#111] border border-black/[0.06] rounded-bl-sm"
                    }`}
                  >
                    {m.content || (
                      <span className="inline-flex items-center gap-1.5 text-black/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-black/30 animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-black/30 animate-pulse" style={{ animationDelay: "0.15s" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-black/30 animate-pulse" style={{ animationDelay: "0.3s" }} />
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {error && (
                <div className="mx-auto max-w-xs px-4 py-2.5 rounded-2xl bg-red-50 border border-red-200 text-[12px] text-red-700">
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="border-t border-black/[0.06] bg-[#F5F4F0] px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Pose ta question..."
                  rows={1}
                  className="flex-1 min-h-[44px] max-h-32 px-4 py-2.5 rounded-2xl bg-white border border-black/[0.08] text-[14px] text-[#111] placeholder:text-black/40 outline-none focus:border-[#A16207]/40 resize-none"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                  disabled={busy}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || busy}
                  aria-label="Envoyer"
                  className="w-11 h-11 rounded-full bg-[#A16207] text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform shrink-0"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  {busy ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2L11 13"/>
                      <path d="M22 2l-7 20-4-9-9-4 20-7z"/>
                    </svg>
                  )}
                </button>
              </div>
            </form>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
