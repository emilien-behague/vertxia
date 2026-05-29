/**
 * Pipeline runner Vertxia Lite.
 *
 * Chaine d'execution (etat ecrit dans data/jobs/{id}.json) :
 *   queued
 *   → scraping        : scrapeShopify -> data/scrapes/{slug}.json
 *   → briefing        : Claude LLM (stub V0.5 — passe-plat)
 *   → generating_videos : Kling via Replicate (stub V0.5 — skip)
 *   → composing       : ecrit SiteManifest -> data/sites/{slug}.json
 *   → done (redirectSlug = job.slug)
 *
 * Si une etape throw → job.status = "failed" avec job.error = message.
 *
 * Appele depuis /api/lite/generate sans await :
 *   const job = await createJob({...});
 *   runPipeline(job).catch((err) => console.error("[pipeline]", err));
 *   return NextResponse.json({ jobId: job.id, slug: job.slug });
 */

import { updateJob, type Job } from "@/lib/jobs";
import { scrapeShopify } from "./scraper";
import { runBriefer } from "./briefer";
import { runVideoGen } from "./videos";
import { saveScrape, saveBrief, saveSite, readBrief } from "./storage";
import type { CreativeBrief, ScrapeResult, SiteManifest, VideoAsset } from "./types";

export async function runPipeline(job: Job): Promise<void> {
  try {
    // Cas demo : brief existant → skip direct vers done en composing rapide
    if (job.alreadyExists) {
      await updateJob(job.id, {
        status: "composing",
        currentStep: 4,
      });
      await sleep(800);
      await updateJob(job.id, {
        status: "done",
        currentStep: 5,
        redirectSlug: job.slug,
      });
      return;
    }

    /* ---------- Etape 1 : Scraping ---------- */
    await updateJob(job.id, { status: "scraping", currentStep: 1 });
    const scrape = await scrapeShopify(job.url);
    await saveScrape(job.slug, scrape);

    if (scrape.products.length === 0) {
      await updateJob(job.id, {
        status: "failed",
        currentStep: 1,
        error: `Aucun produit trouve sur ${job.url}. Soit le store n'expose pas /products.json (non-Shopify), soit il bloque les bots. Essaie une autre URL.`,
      });
      return;
    }

    /* ---------- Etape 2 : Briefing (Claude LLM + fallback stub) ---------- */
    await updateJob(job.id, { status: "briefing", currentStep: 2 });
    let brief = await buildBrief(job, scrape);
    await saveBrief(job.slug, brief);

    /* ---------- Etape 3 : Videos (Kling v2.1 via Replicate, opt-in) ---------- */
    await updateJob(job.id, {
      status: "generating_videos",
      currentStep: 3,
      videoProgress: { current: 0, total: 0 },
    });

    let videos: VideoAsset[] = [];
    if (job.withVideos && process.env.REPLICATE_API_TOKEN && !job.alreadyExists) {
      try {
        videos = await runVideoGen(job.slug, brief, {
          maxVideos: job.maxVideos,
          onProgress: async (current, total) => {
            await updateJob(job.id, { videoProgress: { current, total } });
          },
        });

        // Inject les video_url dans le brief featured_products + re-save
        if (videos.length > 0) {
          const videoByHandle = new Map(videos.map((v) => [v.productId, v.url]));
          const enrichedBrief: CreativeBrief = {
            ...brief,
            featured_products: brief.featured_products.map((p) => ({
              ...p,
              video_url: videoByHandle.get(p.handle) || p.video_url,
            })),
          };
          await saveBrief(job.slug, enrichedBrief);
          brief = enrichedBrief;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          "[videos] Kling generation fail (non-fatal):",
          err instanceof Error ? err.message : err
        );
      }
    } else {
      // Skip rapide si pas d'opt-in
      await sleep(400);
    }

    /* ---------- Etape 4 : Composing ---------- */
    await updateJob(job.id, { status: "composing", currentStep: 4 });

    const manifest: SiteManifest = {
      slug: job.slug,
      brief,
      scrape,
      videos,
      url: `/lite/${job.slug}`,
      composedAt: Date.now(),
    };
    await saveSite(job.slug, manifest);

    /* ---------- Done ---------- */
    await updateJob(job.id, {
      status: "done",
      currentStep: 5,
      redirectSlug: job.slug,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    await updateJob(job.id, {
      status: "failed",
      error: `Pipeline crash: ${msg}`,
    }).catch(() => {
      // last resort — on ne peut meme pas update le job, log silencieux
      console.error("[pipeline] cannot update job after crash:", err);
    });
  }
}

/* =========================================================
 *  buildBrief — Claude LLM (erreur surfacee, plus de fallback silencieux)
 *
 *  Strategy :
 *    1. Si brief cure (curated:true) existe → return direct
 *    2. Si ANTHROPIC_API_KEY absent → fallback stub (cas dev sans cle)
 *    3. Sinon appel Claude → propage l'erreur si fail (job.status = failed avec
 *       message clair). Plus de fallback silencieux qui donne un brief vide.
 * ========================================================= */

async function buildBrief(
  job: Job,
  scrape: ScrapeResult
): Promise<CreativeBrief> {
  // 1. Brief CURE existant (Allbirds, Loom, etc.) — uniquement ceux avec flag curated:true
  const existing = (await readBrief(job.slug)) as
    | (CreativeBrief & { curated?: boolean })
    | null;
  if (existing && existing.curated === true) return existing;

  // 2. Pas de cle Claude (dev sans key) → stub OK
  if (!process.env.ANTHROPIC_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn("[briefer] ANTHROPIC_API_KEY absent — fallback stub brief.");
    return buildStubBrief(job, scrape);
  }

  // 3. Vrai appel Claude — propage les erreurs au lieu de stub silencieux
  try {
    return await runBriefer(scrape, job.prompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error("[briefer] Claude API error:", err);
    throw new Error(`Brief Claude impossible : ${msg}`);
  }
}

/**
 * Stub brief minimal — fallback si Claude est indisponible.
 * Format V0.1 valide pour ne pas casser le rendering des templates.
 */
function buildStubBrief(
  job: Job,
  scrape: ScrapeResult
): CreativeBrief {
  const brandName = scrape.brand.name;
  const top = scrape.products.slice(0, 4);

  return {
    template_id: "editorial-magazine",
    visual_signature: "none",
    brand: {
      name: brandName,
      domain: scrape.brand.domain,
      category: "Brand",
      positioning_one_liner: `Discover ${brandName}.`,
      icp: "Modern consumer with intentional taste.",
      voice: "minimal-luxe",
    },
    client_prompt_interpretation: job.prompt.slice(0, 280),
    creative_direction: {
      mood: "Cinematic premium. Quiet confidence. Editorial restraint.",
      reference_style: "Minimal e-commerce editorial.",
      narrative_arc: "Hero statement → manifesto → 4 featured pieces → closing.",
    },
    visual_system: {
      palette: [
        { name: "background", hex: "#0A0A0A" },
        { name: "foreground", hex: "#F5F0E8" },
        { name: "accent", hex: "#D6B96E" },
        { name: "muted", hex: "#9B9B9B" },
        { name: "surface", hex: "#1A1A1A" },
      ],
      fonts: { serif: "Cormorant Garamond", sans: "Inter" },
      spacing_density: "spacious",
      imagery_treatment: "Full-bleed product photography, minimal cropping.",
    },
    hero: {
      kicker: brandName,
      headline: `Discover\n${brandName}.`,
      subheadline: job.prompt.slice(0, 180),
      primary_cta_label: "Explorer",
      secondary_cta_label: null,
    },
    site_structure: [
      {
        section: "manifesto",
        section_role: "Pose le ton",
        headline: brandName,
        body_paragraphs: [job.prompt.slice(0, 280)],
        pull_quote: null,
      },
      {
        section: "collection",
        section_role: "Presenter les pieces",
        headline: "Pieces selectionnees",
        body_paragraphs: ["Une selection editoriale du catalogue."],
        pull_quote: null,
      },
    ],
    featured_products: top.map((p) => ({
      handle: p.handle,
      title: p.title,
      hero_image_url: p.imageUrl || "",
      price_eur: p.price ? String(p.price) : null,
      editorial_caption: p.description.slice(0, 140),
      video_prompt: `Slow cinematic dolly on ${p.title}. Soft light, premium product showcase.`,
      video_engine_hint: "kling",
      video_duration_s: 5,
    })),
    footer: {
      tagline: `${brandName} — cinematic e-commerce.`,
      closing_line: "Site genere par Vertxia.",
    },
    _meta: {
      model: "stub",
      client_prompt: job.prompt,
      source_json: `${scrape.brand.domain}_scrape.json`,
      product_count_total: scrape.products.length,
      featured_count: top.length,
      generated_in_seconds: 0,
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
