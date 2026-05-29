/**
 * Env vars validation centralisee.
 *
 * appUrl() : retourne APP_URL (sans fallback host header pour eviter Host header
 *            injection - L1/L2 audit).
 *
 * assertProdEnv() : a appeler au boot en prod ; throws si une var requise manque
 *                   ou si la config est unsafe (ex: APP_URL en http en prod).
 */

const IS_PROD = process.env.NODE_ENV === "production";

/** Retourne APP_URL ou throw si absent. JAMAIS de fallback host header. */
export function appUrl(): string {
  const url = process.env.APP_URL;
  if (!url || !url.startsWith("http")) {
    throw new Error(
      "APP_URL absent ou invalide. Format attendu : http://localhost:3000 (dev) ou https://vertxia.com (prod)."
    );
  }
  if (IS_PROD && !url.startsWith("https://")) {
    throw new Error("APP_URL doit etre en https en production");
  }
  return url.replace(/\/$/, ""); // strip trailing slash
}

/** Origine attendue pour les checks CSRF / origin header. */
export function expectedOrigin(): string {
  return appUrl();
}

/**
 * Liste des origines autorisees pour les checks CSRF.
 *
 * APP_URL est toujours inclus + une liste optionnelle de domaines alias via
 * APP_URL_ALIASES (comma-separated, ex: "https://vertxia.fr,https://www.vertxia.fr").
 *
 * Utile quand le site est servi sur plusieurs domaines (vertxia.com, vertxia.fr,
 * fallback vercel.app). Sans ca, les visiteurs sur un alias seraient bloques
 * par le check Origin.
 */
export function allowedOrigins(): string[] {
  const primary = appUrl();
  const aliasesRaw = process.env.APP_URL_ALIASES || "";
  const aliases = aliasesRaw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter((s) => s.startsWith("http"));
  return Array.from(new Set([primary, ...aliases]));
}

/** Email expediteur des emails Vertxia. Defaut accepte uniquement en dev. */
export function authEmailFrom(): string {
  const v = process.env.AUTH_EMAIL_FROM;
  if (v) return v;
  if (IS_PROD) {
    throw new Error(
      "AUTH_EMAIL_FROM requis en production (format : 'Vertxia <hello@vertxia.com>')"
    );
  }
  return "Vertxia <onboarding@resend.dev>";
}

/**
 * A appeler depuis un script de boot (ou en haut de chaque route critique en prod)
 * pour valider tt l'env. Throws sur la 1ere erreur.
 */
export function assertProdEnv(): void {
  const required = [
    "DATABASE_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "RESEND_API_KEY",
    "AUTH_COOKIE_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "APP_URL",
    "AUTH_EMAIL_FROM",
  ];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Env var manquante en prod : ${key}`);
    }
  }
  // Renforce le secret cookie
  if ((process.env.AUTH_COOKIE_SECRET || "").length < 64) {
    throw new Error("AUTH_COOKIE_SECRET doit faire >= 64 chars en prod");
  }
  // Renforce les keys Stripe
  if (process.env.NODE_ENV === "production") {
    if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) {
      throw new Error("STRIPE_SECRET_KEY doit etre sk_live_* en prod");
    }
    if (!process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) {
      throw new Error("STRIPE_WEBHOOK_SECRET doit commencer par whsec_");
    }
    if (!process.env.GOOGLE_REDIRECT_URI?.startsWith("https://")) {
      throw new Error("GOOGLE_REDIRECT_URI doit etre en https en prod");
    }
  }
}
