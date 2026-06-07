// Endpoint streaming du chat assistant F-Gas Vertxia.
// Stack : @anthropic-ai/sdk, modèle claude-sonnet-4-6 (qualité réglementaire
// critique, Haiku hallucinerait sur les seuils tCO2eq et dates F-Gas).
//
// Stream SSE-style via ReadableStream natif Next.js 16. Le client lit en
// chunks et affiche progressivement (UX moderne).
//
// Pas d'auth requise — chat dispo pour tout user connecté au /m (Supabase auth
// déjà appliqué au layout). On ne logue rien côté serveur en V1 (pas de DB
// table), juste un POST → réponse stream.

import Anthropic from "@anthropic-ai/sdk";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chat-system-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  messages: ChatMessage[];
  /** Optionnel : contexte équipement actuel (si user est sur /eq/[id]) */
  equipementContext?: {
    modele?: string;
    fluide?: string;
    chargeKg?: number;
    detecteurFixe?: boolean;
    dernierControleISO?: string;
    clientName?: string;
    /** Resume textuel des 3 dernieres interventions liees a cet eq */
    recentInterventions?: string[];
    /** Resume des pannes connues sur ce modele dans le catalogue partage */
    pannesConnuesResume?: string;
  };
};

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

function serverError(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}

function formatContext(ctx: ChatRequest["equipementContext"]): string {
  if (!ctx) return "";
  const lines: string[] = [];
  if (ctx.modele) lines.push(`Modèle : ${ctx.modele}`);
  if (ctx.fluide) lines.push(`Fluide : ${ctx.fluide}`);
  if (typeof ctx.chargeKg === "number") lines.push(`Charge : ${ctx.chargeKg} kg`);
  if (ctx.detecteurFixe !== undefined)
    lines.push(`Détecteur fixe : ${ctx.detecteurFixe ? "oui" : "non"}`);
  if (ctx.dernierControleISO)
    lines.push(`Dernier contrôle : ${ctx.dernierControleISO}`);
  if (ctx.clientName) lines.push(`Client : ${ctx.clientName}`);

  let extra = "";
  if (ctx.recentInterventions && ctx.recentInterventions.length > 0) {
    extra += `\n\n3 dernières interventions sur cet équipement :\n${ctx.recentInterventions.map((s) => `- ${s}`).join("\n")}`;
  }
  if (ctx.pannesConnuesResume) {
    extra += `\n\nPannes connues sur ce modèle (mémoire collective Vertxia) :\n${ctx.pannesConnuesResume}`;
  }

  if (lines.length === 0 && extra.length === 0) return "";
  return `\n\n[CONTEXTE TERRAIN — le technicien est physiquement devant cet équipement et te pose une question le concernant. Tes réponses doivent être PRÉCISES pour CET équipement, pas génériques.\n${lines.join("\n")}${extra}]\n`;
}

export async function POST(req: Request) {
  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return badRequest("Corps de requête invalide");
  }

  const { messages, equipementContext } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return badRequest("messages doit être un tableau non vide");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return serverError("ANTHROPIC_API_KEY manquant côté serveur");
  }

  const client = new Anthropic({ apiKey });

  // Injecte le contexte équipement dans le 1er message user si présent
  const contextText = formatContext(equipementContext);
  const enrichedMessages: ChatMessage[] = contextText
    ? messages.map((m, i) =>
        i === 0 && m.role === "user"
          ? { ...m, content: m.content + contextText }
          : m
      )
    : messages;

  try {
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: CHAT_SYSTEM_PROMPT,
      messages: enrichedMessages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : "erreur stream";
          controller.enqueue(encoder.encode(`\n\n[Erreur : ${errMsg}]`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "erreur Anthropic";
    return serverError(`Échec appel Claude : ${errMsg}`);
  }
}
