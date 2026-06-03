#!/usr/bin/env node
/**
 * Vertxia Lite — Trailer Composer V1.
 *
 * Compile les vidéos AI déjà générées d'un site en 1 trailer 60s 9:16 (TikTok).
 *
 * Structure :
 *  0-3s    Intro : brand name overlay (texte centré sur 1ere vidéo en bg dim)
 *  3-48s   5 produits × 9s : vidéo resize 1080x1920 + drawtext product title
 *  48-60s  Outro : tagline + domain overlay (fond noir + texte centré)
 *
 * Usage :
 *   node scripts/make-trailer.mjs <slug>
 *   ex: node scripts/make-trailer.mjs gymshark_com
 *
 * Output : public/lite/trailers/<slug>/trailer-vertical.mp4
 *
 * Dépendances : ffmpeg 4+ avec libfreetype (drawtext). Font Segoe UI Windows.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { resolve, join, basename } from "node:path";

/* =========================================================
 *  Config
 * ========================================================= */

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const FONT_REGULAR = "C\\:/Windows/Fonts/segoeui.ttf";
const FONT_BOLD = "C\\:/Windows/Fonts/segoeuib.ttf";

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const INTRO_DURATION = 3;
const CLIP_DURATION = 9;
const OUTRO_DURATION = 12;
const MAX_PRODUCT_CLIPS = 5;

/* =========================================================
 *  Args
 * ========================================================= */

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/make-trailer.mjs <slug>");
  process.exit(1);
}

const briefPath = join(PROJECT_ROOT, "data", "briefs", `${slug}.json`);
const videosDir = join(PROJECT_ROOT, "public", "lite", "videos", slug);
const outputDir = join(PROJECT_ROOT, "public", "lite", "trailers", slug);
const tmpDir = join(outputDir, "_tmp");

if (!existsSync(briefPath)) {
  console.error(`Brief not found: ${briefPath}`);
  process.exit(1);
}
if (!existsSync(videosDir)) {
  console.error(`Videos directory not found: ${videosDir}`);
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

/* =========================================================
 *  Load brief
 * ========================================================= */

const brief = JSON.parse(readFileSync(briefPath, "utf-8"));
const brand = brief.brand || {};
const featured = brief.featured_products || [];
const hero = brief.hero || {};
const footer = brief.footer || {};
const palette = brief.visual_system?.palette || [];

const accentHex = palette.find((p) => p.name === "accent")?.hex || "#FFFFFF";
const bgHex = palette.find((p) => p.name === "background")?.hex || "#000000";

console.log(`\n┌─────────────────────────────────────────────────────`);
console.log(`│ Vertxia Trailer Composer V1`);
console.log(`├─────────────────────────────────────────────────────`);
console.log(`│ Slug    : ${slug}`);
console.log(`│ Brand   : ${brand.name}`);
console.log(`│ Accent  : ${accentHex}`);
console.log(`│ BG      : ${bgHex}`);
console.log(`│ Videos  : ${videosDir}`);
console.log(`└─────────────────────────────────────────────────────\n`);

/* =========================================================
 *  Resolve product → video file mapping
 * ========================================================= */

const availableVideos = readdirSync(videosDir).filter((f) => f.endsWith(".mp4"));

const productClips = featured
  .map((p, i) => {
    const match = availableVideos.find((f) => f.includes(p.handle));
    if (!match) {
      console.warn(`[skip] no video for product ${p.handle}`);
      return null;
    }
    return {
      idx: i,
      handle: p.handle,
      title: p.title,
      file: join(videosDir, match),
    };
  })
  .filter(Boolean)
  .slice(0, MAX_PRODUCT_CLIPS);

if (productClips.length === 0) {
  console.error("No matching product videos found. Aborting.");
  process.exit(1);
}

console.log(`✓ Matched ${productClips.length} product clip(s)`);
productClips.forEach((c) => console.log(`   ${c.idx + 1}. ${c.title}`));

/* =========================================================
 *  Helpers
 * ========================================================= */

const accentRgb = hexToRgb(accentHex);
const bgRgb = hexToRgb(bgHex);

function hexToRgb(hex) {
  const c = hex.replace("#", "");
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16),
  };
}

/**
 * Escape text for ffmpeg drawtext (single quotes around value, escape special chars).
 */
function escapeDrawtext(s) {
  return s
    .replace(/\\/g, "\\\\\\\\")
    .replace(/'/g, "\\\\\\'")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%");
}

function runFfmpeg(args, label) {
  console.log(`\n[ffmpeg] ${label}`);
  const start = Date.now();
  const res = spawnSync("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
  const ms = Date.now() - start;
  if (res.status !== 0) {
    console.error(`  ✗ FAIL after ${ms}ms`);
    console.error(res.stderr?.toString().slice(-1500));
    process.exit(1);
  }
  console.log(`  ✓ done in ${(ms / 1000).toFixed(1)}s`);
}

/* =========================================================
 *  Pass 1 : Build product clips (resize 9:16 + drawtext title)
 * ========================================================= */

console.log("\n━━━ Pass 1 : Product clips ━━━");

const productOutFiles = [];

productClips.forEach((clip, i) => {
  const outFile = join(tmpDir, `product_${String(i).padStart(2, "0")}.mp4`);
  const title = escapeDrawtext(clip.title.toUpperCase());
  const number = `N° ${String(i + 1).padStart(2, "0")}`;

  // Filter complex :
  // 1. Resize+crop to 1080x1920 center
  // 2. Loop+trim to exact CLIP_DURATION seconds
  // 3. Bottom-left text overlay : number (small accent) + title (big white)
  const filter = [
    // resize+crop center to 1080x1920
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT}`,
    // light vignette + dim bottom 30% for text readability
    `drawbox=x=0:y=ih*0.62:w=iw:h=ih*0.38:color=black@0.55:t=fill`,
    // number kicker
    `drawtext=fontfile='${FONT_BOLD}':text='${escapeDrawtext(number)}':fontsize=42:fontcolor=0x${accentHex.slice(1)}:x=80:y=h-380:borderw=0`,
    // title
    `drawtext=fontfile='${FONT_BOLD}':text='${title}':fontsize=92:fontcolor=white:x=80:y=h-290:line_spacing=12`,
    // brand watermark top-right small
    `drawtext=fontfile='${FONT_BOLD}':text='${escapeDrawtext(brand.name.toUpperCase())}':fontsize=28:fontcolor=white@0.7:x=w-tw-50:y=50`,
    // setpts to ensure smooth timeline
    `setpts=PTS-STARTPTS`,
  ].join(",");

  runFfmpeg(
    [
      "-y",
      "-stream_loop", "-1", // loop video if shorter than CLIP_DURATION
      "-i", clip.file,
      "-t", String(CLIP_DURATION),
      "-vf", filter,
      "-r", String(FPS),
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "22",
      "-pix_fmt", "yuv420p",
      "-an", // pas d'audio pour V1
      outFile,
    ],
    `clip ${i + 1}/${productClips.length} : ${clip.title}`
  );

  productOutFiles.push(outFile);
});

/* =========================================================
 *  Pass 2 : Build intro (brand name on dim 1st video) + outro (tagline on black)
 * ========================================================= */

console.log("\n━━━ Pass 2 : Intro + Outro ━━━");

// Intro : 1st product video looped+dimmed + big centered brand name
const introFile = join(tmpDir, "intro.mp4");
const brandText = escapeDrawtext(brand.name.toUpperCase());
const heroKicker = escapeDrawtext((hero.kicker || brand.category || "").toUpperCase());

const introFilter = [
  `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT}`,
  // dim + slight blur
  `eq=brightness=-0.35:saturation=0.7`,
  `boxblur=4:1`,
  // kicker top
  `drawtext=fontfile='${FONT_BOLD}':text='${heroKicker}':fontsize=36:fontcolor=0x${accentHex.slice(1)}:x=(w-tw)/2:y=h*0.30`,
  // brand name HUGE centered
  `drawtext=fontfile='${FONT_BOLD}':text='${brandText}':fontsize=200:fontcolor=white:x=(w-tw)/2:y=(h-th)/2`,
  // small bottom "by Vertxia"
  `drawtext=fontfile='${FONT_BOLD}':text='CRAFTED BY VERTXIA':fontsize=26:fontcolor=white@0.6:x=(w-tw)/2:y=h*0.72`,
  `setpts=PTS-STARTPTS`,
].join(",");

runFfmpeg(
  [
    "-y",
    "-stream_loop", "-1",
    "-i", productClips[0].file,
    "-t", String(INTRO_DURATION),
    "-vf", introFilter,
    "-r", String(FPS),
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "22",
    "-pix_fmt", "yuv420p",
    "-an",
    introFile,
  ],
  "intro 3s"
);

// Outro : fond noir + tagline + domain
const outroFile = join(tmpDir, "outro.mp4");
const taglineRaw = (footer.tagline || hero.headline || brand.positioning_one_liner || "").trim();
// Si tagline trop longue, garder 100 premiers chars
const tagline = escapeDrawtext(taglineRaw.length > 80 ? taglineRaw.slice(0, 77) + "..." : taglineRaw);
const domainText = escapeDrawtext(brand.domain || "");
const r = bgRgb.r.toString(16).padStart(2, "0");
const g = bgRgb.g.toString(16).padStart(2, "0");
const b = bgRgb.b.toString(16).padStart(2, "0");

runFfmpeg(
  [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=0x${r}${g}${b}:s=${WIDTH}x${HEIGHT}:r=${FPS}:d=${OUTRO_DURATION}`,
    "-vf", [
      // brand name top
      `drawtext=fontfile='${FONT_BOLD}':text='${brandText}':fontsize=72:fontcolor=white:x=(w-tw)/2:y=h*0.22`,
      // tagline center (italic-ish via regular instead of bold)
      `drawtext=fontfile='${FONT_REGULAR}':text='${tagline}':fontsize=46:fontcolor=white@0.92:x=(w-text_w)/2:y=(h-text_h)/2:line_spacing=14`,
      // accent separator
      `drawbox=x=(w-200)/2:y=h*0.68:w=200:h=3:color=0x${accentHex.slice(1)}:t=fill`,
      // domain
      `drawtext=fontfile='${FONT_BOLD}':text='${domainText}':fontsize=42:fontcolor=0x${accentHex.slice(1)}:x=(w-tw)/2:y=h*0.74`,
      // cta arrow
      `drawtext=fontfile='${FONT_BOLD}':text='→':fontsize=64:fontcolor=white:x=(w-tw)/2:y=h*0.80`,
      // vertxia signature bottom
      `drawtext=fontfile='${FONT_BOLD}':text='CRAFTED BY VERTXIA':fontsize=24:fontcolor=white@0.5:x=(w-tw)/2:y=h*0.92`,
    ].join(","),
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "22",
    "-pix_fmt", "yuv420p",
    "-an",
    outroFile,
  ],
  "outro 12s"
);

/* =========================================================
 *  Pass 3 : Concat all segments via demuxer
 * ========================================================= */

console.log("\n━━━ Pass 3 : Concat final ━━━");

const concatList = join(tmpDir, "concat.txt");
const segments = [introFile, ...productOutFiles, outroFile];
const concatContent = segments
  .map((f) => `file '${f.replace(/\\/g, "/")}'`)
  .join("\n");

import { writeFileSync, statSync } from "node:fs";
writeFileSync(concatList, concatContent);

const finalOut = join(outputDir, "trailer-vertical.mp4");

runFfmpeg(
  [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concatList,
    "-c", "copy",
    finalOut,
  ],
  `final concat → ${basename(finalOut)}`
);

/* =========================================================
 *  Cleanup tmp + report
 * ========================================================= */

const finalStat = statSync(finalOut);

console.log("\n┌─────────────────────────────────────────────────────");
console.log("│ ✓ TRAILER GENERATED");
console.log("├─────────────────────────────────────────────────────");
console.log(`│ Output  : ${finalOut.replace(PROJECT_ROOT, ".")}`);
console.log(`│ Size    : ${(finalStat.size / 1024 / 1024).toFixed(2)} MB`);
console.log(`│ Format  : ${WIDTH}x${HEIGHT} @ ${FPS}fps (9:16 TikTok)`);
console.log(`│ Duration: ${INTRO_DURATION + CLIP_DURATION * productClips.length + OUTRO_DURATION}s`);
console.log("└─────────────────────────────────────────────────────");

// Keep tmp/ for debug — uncomment to clean :
// rmSync(tmpDir, { recursive: true, force: true });
console.log(`\n(debug tmp: ${tmpDir})`);
