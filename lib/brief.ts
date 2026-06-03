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
 * - museum-curated      : luxe ultra-minimal — fond blanc OFF force, photos modestes 55vw centrees,
 *                         typo serif weight 200-300, captions Geist Mono grises, espace vertical
 *                         enorme (py-48), 1 produit par "salle". Mood Maison Margiela/Lemaire/Aesop.
 * - kinetic-typography  : typographie monumentale en mouvement — photo brutaliste full-bleed,
 *                         enorme typo sans-serif Archivo Black overlay 14rem, marquees horizontales
 *                         entre sections, numeros geants overlay produits, palette B+N+1 accent
 *                         sature. Mood MINIMAL ARCHITECTURE / Wodniack / Yota.aagency.
 * - noir-magazine       : magazine luxe noir — fond noir total, enorme wordmark serif Fraunces 22vw,
 *                         3 teasers photos couleur saturee, article format magazine avec drop cap,
 *                         spread photo pleine largeur, index produits style "Featured in this issue".
 *                         Mood Voyager Press / Wallpaper / Mr Porter Journal / Cabana. ZERO glitch.
 * - cyberpunk-noir      : tech cinematic moody — vidéo dark fullscreen brightness 55%, serif italique
 *                         centré Fraunces, scanlines CSS overlay constant, accent NEON vif (cyan/
 *                         magenta/lime), marquee top "SYSTEM ONLINE", glitch hover chromatic
 *                         aberration, footer terminal-style avec status indicators ◢.
 *                         Mood Sarah Mitchell / Triage / Blade Runner / Cyberpunk 2077.
 * - agentic-hero        : OVERRIDE explicite regle 22 — esthétique cliché IA générique Runable /
 *                         Lovable / Bolt / v0 : fond off-white, gros titre centré "Qu'est-ce qui doit
 *                         être fait ?", énorme prompt box, badge orange social proof "1M+ clients",
 *                         6 connecteurs logos, 5 boutons catégories. + Showcase vidéos AI Vertxia
 *                         en dessous (= différenciation). Pour pages produit Vertxia agentic.
 */
export type TemplateId =
  | "editorial-magazine"
  | "cinematic-narrative"
  | "documentary-story"
  | "horizontal-slider"
  | "brutalist-tech"
  | "museum-curated"
  | "kinetic-typography"
  | "noir-magazine"
  | "cyberpunk-noir"
  | "agentic-hero";

/**
 * Signature visuelle : overlay/filtre applique PAR-DESSUS n'importe quel template.
 * Multiplie les variations : 5 templates × 5 signatures = 25 looks uniques.
 * - none           : pass-through, render pur (DEFAULT)
 * - film-grain     : SVG noise + warm grade + vignette (cinematic, vieux film)
 * - halftone-print : dots overlay + grain papier (print magazine, riso)
 * - glitch-vhs     : scanlines + chromatic aberration + RGB split sur img:hover (90s/Y2K)
 * - neon-noir      : dark gradient overlay + accent glow sur CTAs + text-shadow h1
 */
export type VisualSignatureId =
  | "none"
  | "film-grain"
  | "halftone-print"
  | "glitch-vhs"
  | "neon-noir";

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
  /** Overlay visuel injecte par-dessus le template — default "none" si absent. */
  visual_signature?: VisualSignatureId;
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
