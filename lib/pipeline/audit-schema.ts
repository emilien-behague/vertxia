/**
 * Audit schema — tool definition pour le pass 2 du briefer multi-pass.
 *
 * Claude est invoque en mode REVIEWER (pas DIRECTOR) : il regarde le brief
 * V1 + le scrape original, et il NOTE chaque dimension sur 5 + propose 3
 * ameliorations prioritaires.
 *
 * Le pass 3 (improveBrief) utilise cet audit comme guide pour reecrire le brief.
 *
 * Modele : claude-sonnet-4-6 (meme que la generation pour avoir un reviewer
 * de meme niveau cognitif).
 */

export type AuditDimension =
  | "brand_voice_distinctiveness" // voix de marque distinctive (vs generique)
  | "icp_relevance"               // pertinence pour l'ICP
  | "copy_quality"                 // qualite copy (pas de buzzwords startup)
  | "palette_mood_coherence"       // coherence palette / mood / typo
  | "video_prompts_quality"        // prompts video cinematic (pas generiques)
  | "narrative_arc"                // structure narrative coherente
  | "section_length_appropriate"   // longueur sections appropriee (pas trop long ni trop court)
  | "template_choice_fit"          // template_id correspond au mood
  | "signature_choice_fit"         // visual_signature correspond au mood
  | "hero_punchline"               // headline hero punchy / memorable

export const AUDIT_DIMENSIONS: AuditDimension[] = [
  "brand_voice_distinctiveness",
  "icp_relevance",
  "copy_quality",
  "palette_mood_coherence",
  "video_prompts_quality",
  "narrative_arc",
  "section_length_appropriate",
  "template_choice_fit",
  "signature_choice_fit",
  "hero_punchline",
];

export type DimensionScore = {
  dimension: AuditDimension;
  score: 1 | 2 | 3 | 4 | 5;
  comment: string;
};

export type AuditPriority = {
  rank: 1 | 2 | 3;
  what: string;
  why: string;
  how: string;
};

export type AuditResult = {
  scores: DimensionScore[];
  overall_score: number;
  verdict: "publish-ready" | "needs-improvement" | "reject-regenerate";
  priorities: AuditPriority[];
  summary: string;
};

export const AUDIT_TOOL = {
  name: "submit_audit",
  description: "Submit a critical audit of the generated brief V1.",
  input_schema: {
    type: "object" as const,
    properties: {
      scores: {
        type: "array",
        minItems: 10,
        maxItems: 10,
        description: "One score 1-5 per dimension. Be CRITICAL — most briefs deserve 3-4, only exceptional ones get 5.",
        items: {
          type: "object",
          properties: {
            dimension: {
              type: "string",
              enum: AUDIT_DIMENSIONS,
            },
            score: { type: "integer", minimum: 1, maximum: 5 },
            comment: {
              type: "string",
              description: "1-2 sentences. Be specific. Quote the brief verbatim when relevant.",
            },
          },
          required: ["dimension", "score", "comment"],
        },
      },
      overall_score: {
        type: "number",
        minimum: 1,
        maximum: 5,
        description: "Average of all dimension scores (1 decimal).",
      },
      verdict: {
        type: "string",
        enum: ["publish-ready", "needs-improvement", "reject-regenerate"],
        description:
          "publish-ready: overall >= 4.3 AND no dimension < 3. needs-improvement: overall 3-4.3. reject-regenerate: overall < 3 OR any critical dimension < 2.",
      },
      priorities: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        description: "Top 3 specific improvements ranked. Always be actionable.",
        items: {
          type: "object",
          properties: {
            rank: { type: "integer", minimum: 1, maximum: 3 },
            what: { type: "string", description: "What to change (specific field/section)" },
            why: { type: "string", description: "Why it matters (impact on user)" },
            how: { type: "string", description: "How to fix it (concrete suggestion)" },
          },
          required: ["rank", "what", "why", "how"],
        },
      },
      summary: {
        type: "string",
        description: "1 paragraph executive summary. Forgiving briefs deserve harsh summaries.",
      },
    },
    required: ["scores", "overall_score", "verdict", "priorities", "summary"],
  },
} as const;

export const AUDIT_SYSTEM_PROMPT = `Tu es VERTXIA REVIEWER — un critique IA severe et exigeant.

Mission : analyser un brief creatif Vertxia genere par VERTXIA DIRECTOR et l'evaluer sur 10 dimensions. Tu compares aussi avec le scrape original Shopify (vrais produits, vraie brand) pour verifier la pertinence.

## Posture critique

Tu es un reviewer Awwwards-tier. Tu compares le brief a ce que produirait une AGENCE creative premium (Pentagram, Sagmeister, Buck Studio, Mother Design). Tu refuses la mediocrite.

**Standards minimums** :
- Voix de marque DISTINCTIVE : si le brief sonne "generique e-commerce IA", score <= 2
- Copy : aucun buzzword startup ("game-changer", "revolutionary", "innovative", "next-gen", "disrupt", "seamless", "best-in-class"), score severement si present
- Hero headline : doit etre MEMORABLE en moins de 8 mots. Si c'est descriptif/factuel sans hook, score <= 3
- Prompts video : doivent etre cinematic specifiques (light, mouvement, atmosphere), pas generiques ("product on white background" = score 1)
- Cohérence palette + mood + typo : le mood "dark moody industrial" + palette pastel = score 1
- Template choice : si mood "ultra-minimaliste luxe" + template "horizontal-slider" = mismatch, score 2

## Echelle des scores

- 1 = casse / inacceptable / generique
- 2 = faible / a refaire largement
- 3 = correct mais ameliorable significativement
- 4 = bien / publish-ready avec petits polish
- 5 = excellent / niveau agence premium

La plupart des briefs IA meritent 2-3 sur la moitie des dimensions. Si tu mets >= 4 sur tout, tu n'es pas assez critique.

## Output

Tu DOIS appeler submit_audit avec un JSON valide. N'ecris RIEN d'autre.`;
