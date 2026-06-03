/**
 * Template switcher : change le template_id du brief en respectant la coherence
 * brand/mood.
 *
 * 2 modes :
 *  - Direct : l'user a un hint precis ("passe en brutalist") => switch direct
 *  - Indirect : l'user dit "autre structure" => Claude choisit selon brand+mood
 *
 * Pas de Claude call si direct ; un Haiku call si indirect.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { EditIntent } from "./types";

const MODEL = "claude-haiku-4-5-20251001";

/**
 * Templates disponibles dans /app/lite/[domain]/page.tsx.
 * IMPORTANT : matcher exactement les `template_id` route es par le router.
 */
export const AVAILABLE_TEMPLATES = [
  {
    id: "editorial-magazine",
    label: "Magazine editorial",
    description: "Layout magazine print, palette riche, typo serif premium, manifesto + collection ouverte.",
    best_for: ["luxe", "natural", "editorial", "premium", "feminin"],
  },
  {
    id: "cinematic-narrative",
    label: "Recit cinematique",
    description: "Sections plein ecran scroll-driven, focus narratif fort, mood film documentaire.",
    best_for: ["narratif", "luxe", "premium", "energique", "tech"],
  },
  {
    id: "documentary-story",
    label: "Style documentaire",
    description: "Mise en page reportage, photos pleines, texte secondaire, vibe National Geographic.",
    best_for: ["natural", "editorial", "rustique"],
  },
  {
    id: "horizontal-slider",
    label: "Slider horizontal",
    description: "Navigation laterale type slideshow, focus produit par produit, mood gallery.",
    best_for: ["minimal", "premium", "luxe", "art"],
  },
  {
    id: "brutalist-tech",
    label: "Brutalist tech",
    description: "Contrastes durs, typo sans serif geometrique, palette saturee, mood Linear/Arc.",
    best_for: ["tech", "brutalist", "futuriste", "sportif", "y2k"],
  },
  {
    id: "museum-curated",
    label: "Museum curated",
    description: "Fond blanc, photos petites centrees, vide vertical enorme, typo serif legere. Mood Maison Margiela / Lemaire / Aesop.",
    best_for: ["luxe", "minimal", "epure", "musee", "slow", "discret", "feminin", "premium"],
  },
  {
    id: "kinetic-typography",
    label: "Kinetic typography",
    description: "Photo brutaliste full-bleed + ENORME typo Archivo Black overlay, marquees horizontales, numeros geants. Mood Lululemon / Off-White / Wodniack.",
    best_for: ["mode", "streetwear", "sport", "tech", "agency", "bold", "loud", "monumental", "underground"],
  },
  {
    id: "noir-magazine",
    label: "Noir magazine",
    description: "Fond noir total + enorme wordmark serif Fraunces 22vw + 3 teasers couleur + article drop cap + index. Mood Voyager Press / Wallpaper / Mr Porter Journal.",
    best_for: ["luxe noir", "spirits", "single malt", "niche perfume", "travel premium", "editorial underground", "magazine"],
  },
  {
    id: "cyberpunk-noir",
    label: "Cyberpunk noir",
    description: "Video dark fullscreen + serif italique centre + scanlines + accent neon vif + glitch hover + terminal footer. Mood Sarah Mitchell / Blade Runner / Cyberpunk 2077.",
    best_for: ["cyberpunk", "neon", "tech moody", "blade runner", "dark glitch", "underground tech", "techwear", "gaming", "vape", "spirits dark"],
  },
  {
    id: "agentic-hero",
    label: "Agentic hero",
    description: "Hero cliche IA (Runable/Lovable/Bolt) : prompt box centre + badge orange social proof + 5 boutons categories + connecteurs. Showcase videos AI dessous.",
    best_for: ["agentic", "ai product", "saas", "tool launch", "prompt-driven", "general purpose"],
  },
] as const;

export type TemplateId = (typeof AVAILABLE_TEMPLATES)[number]["id"];

const TEMPLATE_TOOL: Anthropic.Tool = {
  name: "submit_template_choice",
  description: "Pick the template_id that best matches the user's request and the brand.",
  input_schema: {
    type: "object",
    properties: {
      template_id: {
        type: "string",
        enum: AVAILABLE_TEMPLATES.map((t) => t.id),
      },
      reason: {
        type: "string",
        description: "1 phrase fr expliquant pourquoi ce template fit.",
      },
      change_description: {
        type: "string",
        description: "1 phrase fr resumant le switch.",
      },
    },
    required: ["template_id", "reason", "change_description"],
  },
};

export type TemplateSwitchResult = {
  patch: Record<string, unknown>;
  changeDescription: string;
};

export async function switchTemplate(
  brief: Record<string, unknown>,
  intent: EditIntent,
  userMessage: string
): Promise<TemplateSwitchResult> {
  const currentTemplate = brief.template_id as string;
  const hint = intent.extracted.template_hint;

  // Direct : hint match l'un des templates connus
  if (hint && AVAILABLE_TEMPLATES.some((t) => t.id === hint)) {
    if (hint === currentTemplate) {
      return {
        patch: {},
        changeDescription: `Le template ${hint} est deja actif.`,
      };
    }
    const tpl = AVAILABLE_TEMPLATES.find((t) => t.id === hint)!;
    return {
      patch: { template_id: hint },
      changeDescription: `Switch vers le template ${tpl.label}.`,
    };
  }

  // Indirect : Haiku choisit le mieux adapte
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY absent");
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const brand = brief.brand as Record<string, unknown>;
  const direction = brief.creative_direction as Record<string, unknown>;

  const tplBlock = AVAILABLE_TEMPLATES.map(
    (t) =>
      `- ${t.id} (${t.label}) : ${t.description}\n  Best for: ${t.best_for.join(", ")}`
  ).join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `Tu es VERTXIA TEMPLATE PICKER — tu choisis le template (parmi 5) qui colle le mieux a la demande client et a la brand. Reponds STRICTEMENT via submit_template_choice.`,
    tools: [TEMPLATE_TOOL],
    tool_choice: { type: "tool", name: "submit_template_choice" },
    messages: [{
      role: "user",
      content: `# TEMPLATE SWITCH

## Brand
${brand.name} — ${brand.category}
Voice : ${brand.voice}
Positioning : ${brand.positioning_one_liner}

## Mood actuel
${direction.mood}

## Template actuel
${currentTemplate}

## Templates dispo
${tplBlock}

## Demande client
"${userMessage}"

## Mood hint
${intent.extracted.mood || "(libre)"}

---
Choisis le template_id qui fit le mieux. Si le template actuel est deja le bon, garde-le et explique.
Appelle submit_template_choice.`,
    }],
  });

  const toolUse = response.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
  );
  if (!toolUse || toolUse.name !== "submit_template_choice") {
    throw new Error(
      `Claude n'a pas appele submit_template_choice. Stop reason: ${response.stop_reason}`
    );
  }

  const result = toolUse.input as {
    template_id: TemplateId;
    reason: string;
    change_description: string;
  };

  if (result.template_id === currentTemplate) {
    return {
      patch: {},
      changeDescription: `Le template ${currentTemplate} est garde : ${result.reason}`,
    };
  }

  return {
    patch: { template_id: result.template_id },
    changeDescription: result.change_description,
  };
}
