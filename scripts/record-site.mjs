/**
 * record-site.mjs — capture vidéo + frames d'un site pour analyse visuelle.
 *
 * Usage:
 *   node scripts/record-site.mjs <url> [outputDir] [scrollSteps]
 *
 * Outputs:
 *   - <outputDir>/<id>.webm        : vidéo scroll complet
 *   - <outputDir>/frames/NN-*.jpg  : screenshots à intervalles (pour LLM vision)
 *   - <outputDir>/meta.json         : metadata (url, viewport, timestamps)
 */

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const url = args[0];
if (!url) {
  console.error("Usage: node scripts/record-site.mjs <url> [outputDir] [scrollSteps]");
  process.exit(1);
}
const outputDir = args[1] || path.join("output", "site-recordings", new URL(url).hostname);
const SCROLL_STEPS = parseInt(args[2] || "20", 10);
const SCROLL_PX = 600;
const PAUSE_MS = 700;
const FRAME_EVERY = 3; // 1 frame toutes les N scrolls

const framesDir = path.join(outputDir, "frames");
await mkdir(framesDir, { recursive: true });

console.log(`[record-site] cible : ${url}`);
console.log(`[record-site] output : ${outputDir}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();

console.log("[record-site] navigation...");
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
} catch (err) {
  console.error("[record-site] timeout navigation, on continue avec ce qu'on a:", err.message);
}

// Auto-dismiss cookie banners communs (best effort, pas critique)
await page.waitForTimeout(1500);
try {
  await page.evaluate(() => {
    const selectors = [
      'button[id*="accept"]', 'button[class*="accept"]',
      '[id*="cookie"] button', '[class*="cookie"] button',
      'button:has-text("Accept")', 'button:has-text("Accepter")',
      'button:has-text("Got it")', 'button:has-text("OK")',
    ];
    for (const sel of selectors) {
      try {
        const btn = document.querySelector(sel);
        if (btn) { btn.click(); break; }
      } catch {}
    }
  });
} catch {}

await page.waitForTimeout(800);

// Frame initiale (top of page)
const meta = {
  url,
  startedAt: new Date().toISOString(),
  viewport: { width: 1440, height: 900 },
  frames: [],
};
await page.screenshot({
  path: path.join(framesDir, "00-top.jpg"),
  type: "jpeg",
  quality: 75,
});
meta.frames.push({ idx: 0, name: "00-top.jpg", scrollY: 0 });

console.log(`[record-site] enregistrement (${SCROLL_STEPS} scrolls, frame toutes les ${FRAME_EVERY})...`);

for (let i = 0; i < SCROLL_STEPS; i++) {
  await page.evaluate((px) => {
    window.scrollBy({ top: px, behavior: "smooth" });
  }, SCROLL_PX);
  await page.waitForTimeout(PAUSE_MS);

  if ((i + 1) % FRAME_EVERY === 0) {
    const frameIdx = String(meta.frames.length).padStart(2, "0");
    const fname = `${frameIdx}-scroll.jpg`;
    const scrollY = await page.evaluate(() => window.scrollY);
    await page.screenshot({
      path: path.join(framesDir, fname),
      type: "jpeg",
      quality: 75,
    });
    meta.frames.push({ idx: meta.frames.length, name: fname, scrollY });
    process.stdout.write(`  frame ${frameIdx} @ scrollY=${scrollY}\n`);
  }
}

// Frame finale après dernier scroll
await page.waitForTimeout(800);
const lastIdx = String(meta.frames.length).padStart(2, "0");
const lastName = `${lastIdx}-end.jpg`;
const finalScrollY = await page.evaluate(() => window.scrollY);
await page.screenshot({
  path: path.join(framesDir, lastName),
  type: "jpeg",
  quality: 75,
});
meta.frames.push({ idx: meta.frames.length, name: lastName, scrollY: finalScrollY });

meta.endedAt = new Date().toISOString();
meta.totalFrames = meta.frames.length;

await context.close();
await browser.close();

await writeFile(path.join(outputDir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");

console.log(`[record-site] OK. ${meta.totalFrames} frames + vidéo .webm dans ${outputDir}`);
