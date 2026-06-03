/**
 * Palette updater : appelle Claude pour generer une nouvelle palette
 * en fonction de l'intent de l'user.
 *
 * Strategie :
 *  1. Prend la palette actuelle + le contexte extrait (direction, color, mood)
 *  2. Construit un prompt structure pour Claude Haiku (fast model, two-stage)
 *  3. Force un tool_use avec un schema strict { palette: 5 hex }
 *  4. Retourne la nouvelle palette + une description du changement
 */

import Anthropic from "@anthropic-ai/sdk";
import type { EditIntent } from "./types";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;

type Palette = Array<{ name: string; hex: string }>;

const SYSTEM_PROMPT = `Tu es VERTXIA PALETTE EDITOR — un specialiste de design system applique aux sites e-commerce premium.

Mission : modifier une palette de 5 couleurs (background/foreground/accent/muted/surface) en fonction des indications d'un client.

Regles strictes :
- TOUJOURS 5 couleurs avec les memes noms semantiques : background, foreground, accent, muted, surface
- Hex 6 caracteres uniquement (ex: #1A2C3D)
- Contraste WCAG AA minimum entre background et foreground (luminance ratio >= 4.5:1)
- Si l'user dit "plus sombre" : background devient plus sombre, foreground reste lisible (souvent plus clair)
- Si l'user dit "rouge" : accent devient rouge (saturation moyenne), pas tout
- Si l'user dit "monochrome" : tons gris uniquement, accent = gris fonce
- Si l'user dit "luxe" : tons calmes, accent dore/cuivre/champagne
- Si l'user dit "tech" : tons froids slate, accent electrique
- Si l'user demande quelque chose d'absurde (ex: "fais arc-en-ciel") : reste raisonnable, applique l'esprit en restant premium

Tu DOIS appeler submit_palette avec un JSON valide. N'ecris RIEN d'autre.`;

const PALETTE_TOOL: Anthropic.Tool = {
  name: "submit_palette",
  description: "Submit the updated palette.",
  input_schema: {
    type: "object",
    properties: {
      palette: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              enum: ["background", "foreground", "accent", "muted", "surface"],
            },
            hex: {
              type: "string",
              pattern: "^#[0-9A-Fa-f]{6}$",
            },
          },
          required: ["name", "hex"],
        },
      },
      change_description: {
        type: "string",
        description:
          "1 phrase en francais qui resume le changement effectue (ex: 'Palette assombrie avec accent rouge carmin'). Pour affichage UI.",
      },
    },
    required: ["palette", "change_description"],
  },
};

export type PaletteUpdateResult = {
  palette: Palette;
  changeDescription: string;
};

export async function updatePalette(
  currentPalette: Palette,
  intent: EditIntent,
  userMessage: string
): Promise<PaletteUpdateResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY absent");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userContent = buildUserPrompt(currentPalette, intent, userMessage);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [PALETTE_TOOL],
    tool_choice: { type: "tool", name: "submit_palette" },
    messages: [{ role: "user", content: userContent }],
  });

  const toolUse = response.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
  );
  if (!toolUse || toolUse.name !== "submit_palette") {
    throw new Error(
      `Claude n'a pas appele submit_palette. Stop reason: ${response.stop_reason}`
    );
  }

  const result = toolUse.input as {
    palette: Palette;
    change_description: string;
  };

  return {
    palette: result.palette,
    changeDescription: result.change_description,
  };
}

function buildUserPrompt(
  currentPalette: Palette,
  intent: EditIntent,
  userMessage: string
): string {
  const paletteBlock = currentPalette
    .map((p) => `  ${p.name.padEnd(12)} = ${p.hex}`)
    .join("\n");

  const ctxBlock = Object.entries(intent.extracted)
    .filter(([, v]) => v)
    .map(([k, v]) => `  ${k} = ${v}`)
    .join("\n");

  return `# PALETTE UPDATE REQUEST

## Palette actuelle
${paletteBlock}

## Message du client
"${userMessage}"

## Contexte extrait
${ctxBlock || "  (rien d'extrait)"}

---

Genere une nouvelle palette de 5 couleurs qui repond a la demande du client, en respectant les contraintes (5 noms semantiques, 6 hex, contraste WCAG AA).
Appelle submit_palette avec la nouvelle palette + une description en francais.`;
}
