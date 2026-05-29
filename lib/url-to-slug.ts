/**
 * Helpers pour extraire une URL Shopify d'un prompt utilisateur et la slugifier
 * vers le format brief : "allbirds.com" -> "allbirds_com", "loom.fr" -> "loom_fr".
 *
 * Le slug = nom du fichier dans web/data/briefs/<slug>.json
 */

/**
 * Regex : capture domain optionnellement prefixe par http(s):// et www.
 * - Accepte TLDs courants (2-6 chars) avec optionnel ccTLD second-level (.co.uk)
 * - Tolere path/query apres (ignores)
 *
 * Exemples matches :
 *   "allbirds.com"
 *   "https://allbirds.com"
 *   "www.allbirds.com/products/sugar"
 *   "Check https://loom.fr please"
 */
const URL_REGEX =
  /\b((?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9-]*\.[a-z]{2,6}(?:\.[a-z]{2,3})?))/i;

export type ExtractResult =
  | { ok: true; domain: string; slug: string; raw: string }
  | { ok: false; reason: "no-url" | "blacklisted" };

/**
 * Domains a ignorer (utilises comme exemples / docs / pas des shops Shopify reels)
 */
const BLACKLIST = new Set([
  "example.com",
  "example.fr",
  "localhost",
  "vertxia.com",
  "lovable.dev",
]);

/**
 * Extrait la 1ere URL trouvee dans un texte libre et retourne le slug brief.
 */
export function extractDomainAndSlug(input: string): ExtractResult {
  const match = input.match(URL_REGEX);
  if (!match) return { ok: false, reason: "no-url" };

  const domain = match[2].toLowerCase().replace(/\/$/, "");

  if (BLACKLIST.has(domain)) return { ok: false, reason: "blacklisted" };

  // Slug = remplace tous les "." et "-" par "_" pour matcher la convention briefs
  const slug = domain.replace(/[.-]/g, "_");

  return { ok: true, domain, slug, raw: match[0] };
}

/**
 * Inverse : slug -> domain affichable (allbirds_com -> allbirds.com).
 * Best-effort : remet les "_" en "." (suffit pour les TLDs standards).
 */
export function slugToDomain(slug: string): string {
  return slug.replace(/_/g, ".");
}
