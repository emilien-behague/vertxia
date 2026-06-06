/**
 * Magic link auth helpers — generation token, envoi email, verification.
 *
 * Flow :
 *   1. user POST /api/auth/login { email }
 *      -> generate random token (32 bytes), hash sha256, store en DB
 *      -> envoie email Resend avec le lien /api/auth/verify?token=<token clair>
 *   2. user clique le lien
 *      -> GET /api/auth/verify?token=xxx
 *      -> hash le token recu, lookup en DB, valide expiration + non utilise
 *      -> upsert user, mark token utilise, set session
 *      -> redirect /app
 *
 * Securite :
 *   - Token clair JAMAIS persiste — on stocke seulement le SHA-256
 *   - TTL court : 15 minutes
 *   - Single-use : used_at != null bloque la re-utilisation
 *   - Email normalise (lowercase + trim) avant lookup
 */

import { randomBytes, createHash } from "node:crypto";
import { Resend } from "resend";
import { db } from "@/lib/db";
import type { User } from "@/lib/db";
import { authEmailFrom } from "@/lib/env";

const TOKEN_TTL_MIN = 15;

let _resend: Resend | null = null;
function getResend() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY absent");
  _resend = new Resend(key);
  return _resend;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 320;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Cree un magic link en DB et retourne le token clair (a inclure dans l'URL).
 */
export async function createMagicLink(email: string): Promise<string> {
  const normalized = normalizeEmail(email);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000);

  await db`
    INSERT INTO magic_links (email, token_hash, expires_at)
    VALUES (${normalized}, ${tokenHash}, ${expiresAt})
  `;
  return token;
}

/**
 * Verifie un token clair recu via l'URL, le marque comme utilise, retourne l'email.
 * Throws si invalide / expire / deja utilise.
 */
export async function consumeMagicLink(token: string): Promise<string> {
  const tokenHash = hashToken(token);
  const rows = (await db`
    SELECT id, email, expires_at, used_at
    FROM magic_links
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `) as unknown as Array<{ id: number; email: string; expires_at: Date; used_at: Date | null }>;

  const row = rows[0];
  if (!row) throw new AuthError("INVALID");
  if (row.used_at) throw new AuthError("ALREADY_USED");
  if (new Date(row.expires_at) < new Date()) throw new AuthError("EXPIRED");

  await db`
    UPDATE magic_links SET used_at = NOW() WHERE id = ${row.id}
  `;
  return row.email;
}

/**
 * Upsert user par email — cree si inexistant, met a jour last_login_at sinon.
 */
export async function upsertUserByEmail(email: string): Promise<User> {
  const rows = (await db`
    INSERT INTO users (email, last_login_at)
    VALUES (${email}, NOW())
    ON CONFLICT (email)
    DO UPDATE SET last_login_at = NOW()
    RETURNING id, email, stripe_customer_id, created_at, last_login_at
  `) as unknown as User[];
  return rows[0];
}

/**
 * Lie un Stripe customer_id a un user. CONDITIONNEL :
 *  - n'overwrite pas un stripe_customer_id deja existant pour ce user (sauf si c'est le meme).
 *  - retourne false si le customer_id appartient deja a un autre user.
 *
 * Fix H3 : empechait privilege escalation par overwrite arbitraire.
 */
export async function linkStripeCustomerToUser(
  userId: string,
  stripeCustomerId: string
): Promise<{ ok: boolean; reason?: string }> {
  // Check si ce customer_id est deja lie a un autre user
  const existing = (await db`
    SELECT id FROM users WHERE stripe_customer_id = ${stripeCustomerId} LIMIT 1
  `) as unknown as Array<{ id: string }>;
  if (existing[0] && existing[0].id !== userId) {
    return { ok: false, reason: "stripe_customer_id already linked to another user" };
  }
  // Update seulement si NULL ou deja le meme (idempotent)
  const updated = (await db`
    UPDATE users
    SET stripe_customer_id = ${stripeCustomerId}
    WHERE id = ${userId}
      AND (stripe_customer_id IS NULL OR stripe_customer_id = ${stripeCustomerId})
    RETURNING id
  `) as unknown as Array<{ id: string }>;
  if (updated.length === 0) {
    return { ok: false, reason: "user already linked to a different stripe_customer_id" };
  }
  return { ok: true };
}

export async function findUserByStripeCustomerId(
  stripeCustomerId: string
): Promise<User | null> {
  const rows = (await db`
    SELECT id, email, stripe_customer_id, created_at, last_login_at
    FROM users
    WHERE stripe_customer_id = ${stripeCustomerId}
    LIMIT 1
  `) as unknown as User[];
  return rows[0] || null;
}

/**
 * Envoie le magic link par email via Resend.
 */
export async function sendMagicLinkEmail(opts: {
  email: string;
  token: string;
  appUrl: string;
}): Promise<void> {
  const verifyUrl = `${opts.appUrl}/api/auth/verify?token=${encodeURIComponent(
    opts.token
  )}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
      <div style="margin-bottom: 32px;">
        <div style="display: inline-block; width: 40px; height: 40px; border-radius: 8px; background: linear-gradient(135deg, #FFC533 0%, #FF7A3D 40%, #FF5A8A 100%); color: black; font-weight: 900; font-size: 16px; text-align: center; line-height: 40px;">V</div>
      </div>
      <h1 style="font-size: 22px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 12px;">
        Connexion a Vertxia
      </h1>
      <p style="font-size: 14.5px; color: #555; line-height: 1.55; margin: 0 0 28px;">
        Clique sur le bouton ci-dessous pour te connecter. Le lien est valide 15 minutes.
      </p>
      <a href="${verifyUrl}"
         style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-size: 14px; font-weight: 500;">
        Se connecter a Vertxia
      </a>
      <p style="font-size: 12px; color: #888; line-height: 1.5; margin: 32px 0 0;">
        Si tu n'as pas demande cette connexion, ignore cet email.
      </p>
      <p style="font-size: 11px; color: #aaa; word-break: break-all; margin: 16px 0 0;">
        Lien complet : ${verifyUrl}
      </p>
    </div>
  `;

  const resend = getResend();
  const from = authEmailFrom();
  const { error } = await resend.emails.send({
    from,
    to: opts.email,
    subject: "Ton lien de connexion Vertxia",
    html,
    text: `Connecte-toi a Vertxia : ${verifyUrl}\n\nLe lien expire dans 15 minutes.`,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
  }
}

export class AuthError extends Error {
  constructor(public code: "INVALID" | "EXPIRED" | "ALREADY_USED") {
    super(code);
    this.name = "AuthError";
  }
}
