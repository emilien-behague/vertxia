/**
 * Download helper partagé par tous les engines.
 *
 * Sécurité : sanitize slug + handle pour eviter path traversal.
 * Output : URL servable publiquement par Next (/lite/videos/{slug}/{handle}.mp4).
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const VIDEOS_PUBLIC_DIR = path.join(process.cwd(), "public", "lite", "videos");

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/i;
const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{0,128}$/i;

export async function downloadVideo(
  remoteUrl: string,
  slug: string,
  handle: string
): Promise<string> {
  if (!SLUG_RE.test(slug)) throw new Error(`slug invalide: "${slug}"`);
  if (!HANDLE_RE.test(handle)) throw new Error(`handle invalide: "${handle}"`);

  const dir = path.join(VIDEOS_PUBLIC_DIR, slug);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${handle}.mp4`);

  const res = await fetch(remoteUrl);
  if (!res.ok) {
    throw new Error(`Download MP4 HTTP ${res.status} from ${remoteUrl}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  return `/lite/videos/${slug}/${handle}.mp4`;
}

/**
 * Extract URL depuis output Replicate (peut être string, FileOutput, ou array).
 */
export async function extractReplicateFileUrl(output: unknown): Promise<string> {
  if (typeof output === "string") return output;

  if (
    output &&
    typeof output === "object" &&
    "url" in output &&
    typeof (output as { url: unknown }).url === "function"
  ) {
    const u = await (output as { url: () => URL | string | Promise<URL | string> }).url();
    return u instanceof URL ? u.toString() : u;
  }

  if (Array.isArray(output) && output.length > 0 && typeof output[0] === "string") {
    return output[0];
  }

  throw new Error(
    `Replicate output format inattendu: ${typeof output} (${JSON.stringify(output).slice(0, 120)})`
  );
}
