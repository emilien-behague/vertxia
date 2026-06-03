/**
 * Copy updater : reecrit headlines, manifesto, footer ou une section
 * specifique du brief via Claude Haiku.
 *
 * Strategie :
 *  - UPDATE_COPY (global) : remplace toutes les headlines de site_structure +
 *    hero.headline + footer.tagline en gardant le sens mais avec un nouveau tone.
 *  - UPDATE_SECTION : ne reecrit qu'UNE section ciblee (hero, manifesto, etc.)
 *
 * On force tool_use avec un schema strict par type d'edit.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { EditIntent, BriefSection } from "./types";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 2048;

const SYSTEM_PROMPT = `Tu es VERTXIA COPY EDITOR — un copywriter premium pour sites e-commerce editorial.

Mission : reecrire des copy d'un site cinematic en respectant la voice de la marque, le mood et le tone shift demande par le client.

Regles strictes :
- TOUJOURS en francais (sauf si le brand parle anglais explicitement)
- Headlines : 6-12 mots max, percutantes, evocatrices
- Body paragraphs : 2-3 phrases max, prose editoriale, pas du marketing
- JAMAIS d'emojis ni de buzzword startup ("revolutionnaire", "innovant", "disruptif", "game-changer")
- Garder le sens du contenu existant — ne pas inventer des features
- Si tone "plus court" : reduire de 30-50%
- Si tone "plus poetique" : ajouter une image sensorielle (texture, lumiere, geste)
- Si tone "plus direct" : verbes d'action, phrases courtes, zero adjectif superflu
- Si tone "plus premium" : ralentir le rythme, mots rares, references culturelles subtiles

Tu DOIS appeler le tool fourni. N'ecris RIEN d'autre.`;

const SECTION_COPY_TOOL: Anthropic.Tool = {
  name: "submit_section_copy",
  description: "Submit rewritten copy for ONE section.",
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string", description: "Nouveau headline (peut contenir \\n pour line breaks)." },
      body_paragraphs: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 4,
        description: "Nouveaux paragraphes (1-3 phrases chacun).",
      },
      pull_quote: { type: "string", description: "Quote eventuelle (peut etre null/empty)." },
      change_description: {
        type: "string",
        description: "1 phrase fr resumant ce qui a change. Pour UI.",
      },
    },
    required: ["headline", "body_paragraphs", "change_description"],
  },
};

const HERO_COPY_TOOL: Anthropic.Tool = {
  name: "submit_hero_copy",
  description: "Submit rewritten hero copy.",
  input_schema: {
    type: "object",
    properties: {
      kicker: { type: "string", description: "Kicker au-dessus du headline (ex: 'Collection X · Ete 2025')." },
      headline: { type: "string", description: "Headline principal (peut contenir \\n)." },
      subheadline: { type: "string", description: "Sous-titre (1-2 phrases)." },
      primary_cta_label: { type: "string", description: "CTA principal (2-4 mots)." },
      secondary_cta_label: { type: "string", description: "CTA secondaire (2-4 mots)." },
      change_description: { type: "string", description: "1 phrase fr resumant le changement." },
    },
    required: ["headline", "subheadline", "primary_cta_label", "secondary_cta_label", "change_description"],
  },
};

const FOOTER_COPY_TOOL: Anthropic.Tool = {
  name: "submit_footer_copy",
  description: "Submit rewritten footer copy.",
  input_schema: {
    type: "object",
    properties: {
      tagline: { type: "string", description: "Tagline du footer (5-12 mots)." },
      closing_line: { type: "string", description: "Phrase de cloture (10-20 mots)." },
      change_description: { type: "string", description: "1 phrase fr resumant le changement." },
    },
    required: ["tagline", "closing_line", "change_description"],
  },
};

const GLOBAL_COPY_TOOL: Anthropic.Tool = {
  name: "submit_global_copy",
  description: "Submit a re-toned version of ALL site copy.",
  input_schema: {
    type: "object",
    properties: {
      hero: {
        type: "object",
        properties: {
          kicker: { type: "string" },
          headline: { type: "string" },
          subheadline: { type: "string" },
          primary_cta_label: { type: "string" },
          secondary_cta_label: { type: "string" },
        },
        required: ["headline", "subheadline", "primary_cta_label", "secondary_cta_label"],
      },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            section: { type: "string" },
            headline: { type: "string" },
            body_paragraphs: { type: "array", items: { type: "string" } },
            pull_quote: { type: "string" },
          },
          required: ["section", "headline", "body_paragraphs"],
        },
      },
      footer: {
        type: "object",
        properties: {
          tagline: { type: "string" },
          closing_line: { type: "string" },
        },
        required: ["tagline", "closing_line"],
      },
      change_description: { type: "string" },
    },
    required: ["hero", "sections", "footer", "change_description"],
  },
};

export type CopyUpdateResult = {
  patch: Record<string, unknown>;
  changeDescription: string;
};

/**
 * UPDATE_SECTION : reecrit UNE section ciblee.
 */
export async function updateSection(
  brief: Record<string, unknown>,
  section: BriefSection,
  intent: EditIntent,
  userMessage: string
): Promise<CopyUpdateResult> {
  ensureApiKey();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  if (section === "hero") {
    return updateHero(brief, intent, userMessage, client);
  }
  if (section === "footer") {
    return updateFooter(brief, intent, userMessage, client);
  }

  // Sections du site_structure (manifesto, collection, process, editorial-close)
  const siteStructure = (brief.site_structure as Array<Record<string, unknown>>) || [];
  const sectionIdx = siteStructure.findIndex((s) => s.section === section);
  if (sectionIdx === -1) {
    throw new Error(`Section "${section}" non trouvee dans le brief`);
  }
  const current = siteStructure[sectionIdx];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [SECTION_COPY_TOOL],
    tool_choice: { type: "tool", name: "submit_section_copy" },
    messages: [{
      role: "user",
      content: buildSectionPrompt(brief, current, intent, userMessage, section),
    }],
  });

  const toolUse = extractToolUse(response, "submit_section_copy");
  const result = toolUse.input as {
    headline: string;
    body_paragraphs: string[];
    pull_quote?: string;
    change_description: string;
  };

  const newStructure = [...siteStructure];
  newStructure[sectionIdx] = {
    ...current,
    headline: result.headline,
    body_paragraphs: result.body_paragraphs,
    pull_quote: result.pull_quote || null,
  };

  return {
    patch: { site_structure: newStructure },
    changeDescription: result.change_description,
  };
}

/**
 * UPDATE_COPY (global) : retonne TOUT le site.
 */
export async function updateGlobalCopy(
  brief: Record<string, unknown>,
  intent: EditIntent,
  userMessage: string
): Promise<CopyUpdateResult> {
  ensureApiKey();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [GLOBAL_COPY_TOOL],
    tool_choice: { type: "tool", name: "submit_global_copy" },
    messages: [{
      role: "user",
      content: buildGlobalPrompt(brief, intent, userMessage),
    }],
  });

  const toolUse = extractToolUse(response, "submit_global_copy");
  const result = toolUse.input as {
    hero: Record<string, string>;
    sections: Array<{ section: string; headline: string; body_paragraphs: string[]; pull_quote?: string }>;
    footer: { tagline: string; closing_line: string };
    change_description: string;
  };

  // Re-map sections en gardant l'ordre + section_role d'origine
  const currentSections = (brief.site_structure as Array<Record<string, unknown>>) || [];
  const newSections = currentSections.map((cur) => {
    const updated = result.sections.find((s) => s.section === cur.section);
    if (!updated) return cur;
    return {
      ...cur,
      headline: updated.headline,
      body_paragraphs: updated.body_paragraphs,
      pull_quote: updated.pull_quote || null,
    };
  });

  return {
    patch: {
      hero: { ...(brief.hero as Record<string, unknown>), ...result.hero },
      site_structure: newSections,
      footer: { ...(brief.footer as Record<string, unknown>), ...result.footer },
    },
    changeDescription: result.change_description,
  };
}

async function updateHero(
  brief: Record<string, unknown>,
  intent: EditIntent,
  userMessage: string,
  client: Anthropic
): Promise<CopyUpdateResult> {
  const hero = brief.hero as Record<string, unknown>;
  const brand = brief.brand as Record<string, unknown>;
  const direction = brief.creative_direction as Record<string, unknown>;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [HERO_COPY_TOOL],
    tool_choice: { type: "tool", name: "submit_hero_copy" },
    messages: [{
      role: "user",
      content: `# HERO REWRITE

## Brand
Nom : ${brand.name}
Voice : ${brand.voice}
Positioning : ${brand.positioning_one_liner}

## Mood
${direction.mood}

## Hero actuel
Kicker : ${hero.kicker}
Headline : ${hero.headline}
Subheadline : ${hero.subheadline}
Primary CTA : ${hero.primary_cta_label}
Secondary CTA : ${hero.secondary_cta_label}

## Demande client
"${userMessage}"

## Tone shift
${intent.extracted.tone_shift || "(par defaut, garder le tone)"}

---
Reecris le hero en respectant la voice + le tone shift. Appelle submit_hero_copy.`,
    }],
  });

  const toolUse = extractToolUse(response, "submit_hero_copy");
  const result = toolUse.input as {
    kicker?: string;
    headline: string;
    subheadline: string;
    primary_cta_label: string;
    secondary_cta_label: string;
    change_description: string;
  };

  return {
    patch: {
      hero: {
        ...hero,
        kicker: result.kicker ?? hero.kicker,
        headline: result.headline,
        subheadline: result.subheadline,
        primary_cta_label: result.primary_cta_label,
        secondary_cta_label: result.secondary_cta_label,
      },
    },
    changeDescription: result.change_description,
  };
}

async function updateFooter(
  brief: Record<string, unknown>,
  intent: EditIntent,
  userMessage: string,
  client: Anthropic
): Promise<CopyUpdateResult> {
  const footer = (brief.footer as Record<string, unknown>) || {};
  const brand = brief.brand as Record<string, unknown>;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    tools: [FOOTER_COPY_TOOL],
    tool_choice: { type: "tool", name: "submit_footer_copy" },
    messages: [{
      role: "user",
      content: `# FOOTER REWRITE

Brand : ${brand.name} — voice : ${brand.voice}
Positioning : ${brand.positioning_one_liner}

Footer actuel :
- Tagline : ${footer.tagline ?? "(vide)"}
- Closing : ${footer.closing_line ?? "(vide)"}

Demande client : "${userMessage}"
Tone shift : ${intent.extracted.tone_shift || "(par defaut)"}

---
Reecris le footer. Appelle submit_footer_copy.`,
    }],
  });

  const toolUse = extractToolUse(response, "submit_footer_copy");
  const result = toolUse.input as {
    tagline: string;
    closing_line: string;
    change_description: string;
  };

  return {
    patch: {
      footer: {
        ...footer,
        tagline: result.tagline,
        closing_line: result.closing_line,
      },
    },
    changeDescription: result.change_description,
  };
}

// === Builders ===

function buildSectionPrompt(
  brief: Record<string, unknown>,
  current: Record<string, unknown>,
  intent: EditIntent,
  userMessage: string,
  section: BriefSection
): string {
  const brand = brief.brand as Record<string, unknown>;
  const direction = brief.creative_direction as Record<string, unknown>;

  return `# SECTION REWRITE: ${section}

## Brand
Nom : ${brand.name}
Voice : ${brand.voice}
Positioning : ${brand.positioning_one_liner}

## Mood global
${direction.mood}

## Section actuelle
Role : ${current.section_role}
Headline : ${current.headline}
Body :
${(current.body_paragraphs as string[]).map((p, i) => `${i + 1}. ${p}`).join("\n\n")}
Pull quote : ${current.pull_quote || "(aucune)"}

## Demande client
"${userMessage}"

## Tone shift
${intent.extracted.tone_shift || "(par defaut)"}

## Mood shift
${intent.extracted.mood || "(par defaut)"}

---
Reecris la section EN GARDANT son role narratif. Headline + body_paragraphs + pull_quote (optionnel).
Appelle submit_section_copy.`;
}

function buildGlobalPrompt(
  brief: Record<string, unknown>,
  intent: EditIntent,
  userMessage: string
): string {
  const brand = brief.brand as Record<string, unknown>;
  const direction = brief.creative_direction as Record<string, unknown>;
  const hero = brief.hero as Record<string, unknown>;
  const sections = (brief.site_structure as Array<Record<string, unknown>>) || [];
  const footer = (brief.footer as Record<string, unknown>) || {};

  const sectionsBlock = sections
    .map(
      (s, i) => `### Section ${i + 1}: ${s.section}
Role : ${s.section_role}
Headline : ${s.headline}
Body :
${(s.body_paragraphs as string[]).map((p) => `- ${p}`).join("\n")}
Pull quote : ${s.pull_quote || "(aucune)"}`
    )
    .join("\n\n");

  return `# GLOBAL COPY RETONE

## Brand
${brand.name} — Voice : ${brand.voice}
Positioning : ${brand.positioning_one_liner}

## Mood actuel
${direction.mood}

## Demande client
"${userMessage}"

## Tone shift
${intent.extracted.tone_shift || "(par defaut)"}

## Mood shift
${intent.extracted.mood || "(par defaut)"}

---

# Copy actuel

## Hero
Kicker : ${hero.kicker}
Headline : ${hero.headline}
Subheadline : ${hero.subheadline}
Primary CTA : ${hero.primary_cta_label}
Secondary CTA : ${hero.secondary_cta_label}

## Sections
${sectionsBlock}

## Footer
Tagline : ${footer.tagline ?? "(vide)"}
Closing : ${footer.closing_line ?? "(vide)"}

---
Retonne TOUT le site (hero + sections + footer) selon la demande client. GARDE les section IDs et le role narratif.
Appelle submit_global_copy.`;
}

function ensureApiKey() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY absent");
  }
}

function extractToolUse(
  response: Anthropic.Messages.Message,
  toolName: string
): Anthropic.ToolUseBlock {
  const toolUse = response.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
  );
  if (!toolUse || toolUse.name !== toolName) {
    throw new Error(
      `Claude n'a pas appele ${toolName}. Stop reason: ${response.stop_reason}`
    );
  }
  return toolUse;
}
