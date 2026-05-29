/**
 * Brief types et loader pour /lite/[domain].
 * Le brief est genere par brief_llm.py et stocke dans data/briefs/<domain>.json.
 */

export type PaletteEntry = {
  name: string;
  hex: string;
};

export type Brand = {
  name: string;
  domain: string;
  category: string;
  positioning_one_liner: string;
  icp: string;
  voice: string;
};

export type CreativeDirection = {
  mood: string;
  reference_style: string;
  narrative_arc: string;
};

export type VisualSystem = {
  palette: PaletteEntry[];
  fonts: { serif: string; sans: string };
  spacing_density: "spacious" | "balanced" | "dense";
  imagery_treatment: string;
};

export type SiteSection = {
  section: string;
  section_role: string;
  /** Final headline copy ready for publication. */
  headline?: string;
  /** Final body paragraphs ready for publication. */
  body_paragraphs?: string[];
  /** Optional pull quote. */
  pull_quote?: string | null;
  /** Legacy field (v1 brief schema) — kept for backward compatibility. */
  content_hint?: string;
};

export type HeroCopy = {
  kicker?: string;
  headline: string;
  subheadline: string;
  primary_cta_label?: string;
  secondary_cta_label?: string | null;
};

export type FooterCopy = {
  tagline: string;
  closing_line: string;
};

export type FeaturedProduct = {
  handle: string;
  title: string;
  video_prompt: string;
  video_engine_hint: string;
  video_duration_s: number;
  editorial_caption: string;
  hero_image_url?: string;
  price_eur?: string | number | null;
  /** Injecté coté serveur par brief-loader.ts si la vidéo existe dans public/lite/videos/<domain>/. */
  video_url?: string;
};

/**
 * Template structurel : pas juste palette/couleur — squelette du site different.
 * - editorial-magazine  : grid 2 colonnes, manifesto bloc, sections scroll vertical (DEFAULT)
 * - cinematic-narrative : scroll-snap fullscreen par produit, caption side, pas de grid
 * - documentary-story   : long-form article scroll, drop caps, reading bar, photos parallax
 * - horizontal-slider   : scroll HORIZONTAL snap-x, 1 slide = 100vw, keyboard/wheel/dots nav
 * - brutalist-tech      : neubrutalism — palette NB+accent forcee, sans-serif chunky uppercase,
 *                         bordures 2px partout, hard shadows offset zero blur, hover invert
 */
export type TemplateId =
  | "editorial-magazine"
  | "cinematic-narrative"
  | "documentary-story"
  | "horizontal-slider"
  | "brutalist-tech";

export type Brief = {
  brand: Brand;
  client_prompt_interpretation: string;
  creative_direction: CreativeDirection;
  visual_system: VisualSystem;
  hero?: HeroCopy;
  site_structure: SiteSection[];
  featured_products: FeaturedProduct[];
  footer?: FooterCopy;
  /** Squelette structurel — default "editorial-magazine" si absent. */
  template_id?: TemplateId;
  _meta?: {
    model: string;
    client_prompt: string;
    source_json: string;
    product_count_total: number;
    featured_count: number;
    generated_in_seconds: number;
  };
};

/**
 * Lookup palette color by semantic name, fallback to provided default.
 */
export function paletteColor(
  palette: PaletteEntry[],
  name: string,
  fallback: string
): string {
  const hit = palette.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  return hit?.hex || fallback;
}

/**
 * Build the video URL convention for a brief domain + product handle.
 * Returns null if video may not exist (the component should fallback to hero image).
 */
export function videoUrlFor(
  domainSlug: string,
  handle: string
): string {
  return `/lite/videos/${domainSlug}/${handle}.mp4`;
}
