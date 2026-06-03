/**
 * Mood updater : modifie le mood global du site.
 *
 * UPDATE_MOOD est un edit "lourd" qui touche plusieurs champs :
 *  - creative_direction.mood (la phrase narrative)
 *  - creative_direction.reference_style (les refs visuelles)
 *  - visual_system.palette (regenere coherente avec le mood)
 *  - visual_system.imagery_treatment (style des photos/videos)
 *  - visual_system.spacing_density (peut changer si mood "minimal" vs "energetic")
 *
 * Pour eviter d'exploser le brief, on demande a Claude de TOUT recracher
 * en un seul tool_use avec un schema strict.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { EditIntent } from "./types";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 2048;

const SYSTEM_PROMPT = `Tu es VERTXIA MOOD ARCHITECT — un specialiste de direction artistique pour sites e-commerce premium.

Mission : transformer le mood d'un site en restant coherent avec la brand et la collection. Tu modifies en un coup : creative_direction (mood + refs), palette (5 hex), imagery_treatment.

Regles strictes :
- TOUJOURS coherent avec la brand voice et le positioning
- Palette : 5 hex (background, foreground, accent, muted, surface) avec contraste WCAG AA
- Mood doit etre une phrase narrative concrete (pas du marketing) — evoque un lieu, une lumiere, une heure
- Reference style : 2-3 references visuelles connues (films, photographes, marques, magazines)
- Imagery treatment : decris le rendu visuel des photos/videos (grain, lumiere, palette, mood)
- Si "luxe" : tons calmes, references Aesop/Hermes/Loewe, palette feutree, accent or/cuivre
- Si "tech" : tons froids slate/glass, references Linear/Arc/Apple Pro, accent electrique
- Si "natural" : tons terre/sauge, lumiere ambiante, references Aesop/Veja/Patagonia
- Si "brutalist" : contrastes durs, sans serif geometriques, palette saturee ou monochrome
- Si "editorial" : references magazine print, mises en page typographiques riches
- Si "minimal" : espaces vides, palette tres reduite (2-3 couleurs reelles)

Tu DOIS appeler submit_mood. N'ecris RIEN d'autre.`;

const MOOD_TOOL: Anthropic.Tool = {
  name: "submit_mood",
  description: "Submit the new mood + visual system.",
  input_schema: {
    type: "object",
    properties: {
      creative_direction: {
        type: "object",
        properties: {
          mood: {
            type: "string",
            description: "Phrase narrative 1-2 lignes evoquant le mood (lieu, lumiere, heure).",
          },
          reference_style: {
            type: "string",
            description: "2-3 references visuelles separees par virgule.",
          },
          narrative_arc: {
            type: "string",
            description: "Phrase decrivant l'arc narratif du site (optionnel).",
          },
        },
        required: ["mood", "reference_style"],
      },
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
            hex: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
          },
          required: ["name", "hex"],
        },
      },
      imagery_treatment: {
        type: "string",
        description: "Style des photos/videos (grain, lumiere, palette, mood).",
      },
      spacing_density: {
        type: "string",
        enum: ["dense", "balanced", "spacious"],
      },
      change_description: {
        type: "string",
        description: "1 phrase fr resumant le mood shift.",
      },
    },
    required: [
      "creative_direction",
      "palette",
      "imagery_treatment",
      "spacing_density",
      "change_description",
    ],
  },
};

export type MoodUpdateResult = {
  patch: Record<string, unknown>;
  changeDescription: string;
};

export async function updateMood(
  brief: Record<string, unknown>,
  intent: EditIntent,
  userMessage: string
): Promise<MoodUpdateResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY absent");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const brand = brief.brand as Record<string, unknown>;
  const direction = brief.creative_direction as Record<string, unknown>;
  const visual = brief.visual_system as Record<string, unknown>;
  const palette = visual.palette as Array<{ name: string; hex: string }>;

  const paletteBlock = palette
    .map((p) => `  ${p.name.padEnd(12)} = ${p.hex}`)
    .join("\n");

  const userContent = `# MOOD UPDATE REQUEST

## Brand
${brand.name} — ${brand.category}
Voice : ${brand.voice}
Positioning : ${brand.positioning_one_liner}
ICP : ${brand.icp}

## Mood actuel
${direction.mood}
Reference style : ${direction.reference_style}
Imagery treatment : ${visual.imagery_treatment}
Spacing : ${visual.spacing_density}

## Palette actuelle
${paletteBlock}

## Demande client
"${userMessage}"

## Mood cible extrait
${intent.extracted.mood || "(libre)"}
Direction : ${intent.extracted.direction || "(libre)"}

---
Repense le mood + palette + imagery + spacing pour matcher la demande. Garde la coherence avec la brand.
Appelle submit_mood.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [MOOD_TOOL],
    tool_choice: { type: "tool", name: "submit_mood" },
    messages: [{ role: "user", content: userContent }],
  });

  const toolUse = response.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
  );
  if (!toolUse || toolUse.name !== "submit_mood") {
    throw new Error(
      `Claude n'a pas appele submit_mood. Stop reason: ${response.stop_reason}`
    );
  }

  const result = toolUse.input as {
    creative_direction: {
      mood: string;
      reference_style: string;
      narrative_arc?: string;
    };
    palette: Array<{ name: string; hex: string }>;
    imagery_treatment: string;
    spacing_density: string;
    change_description: string;
  };

  return {
    patch: {
      creative_direction: {
        ...direction,
        mood: result.creative_direction.mood,
        reference_style: result.creative_direction.reference_style,
        narrative_arc: result.creative_direction.narrative_arc || direction.narrative_arc,
      },
      visual_system: {
        ...visual,
        palette: result.palette,
        imagery_treatment: result.imagery_treatment,
        spacing_density: result.spacing_density,
      },
    },
    changeDescription: result.change_description,
  };
}
