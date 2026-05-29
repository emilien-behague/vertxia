/**
 * Session helpers Vertxia V0.8 — iron-session.
 *
 * Cookie httpOnly seale avec AUTH_COOKIE_SECRET. Pas de DB pour les sessions
 * (stateless via cookies seales). Adapte pour serverless / edge.
 *
 * Usage cote route handlers / pages serveur :
 *   const session = await getSession();
 *   if (!session.userId) ...
 *
 * Pour forcer l'auth :
 *   const session = await requireSession();  // throws si non authentifie
 */

import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { db } from "./db";
import type { User } from "./db";

export type SessionData = {
  userId?: string;
  email?: string;
};

const COOKIE_NAME = "vertxia_session";

function getSessionOptions(): SessionOptions {
  const password = process.env.AUTH_COOKIE_SECRET;
  // [SECURITY L5] 64+ chars (= 32 bytes raw entropy) requis
  if (!password || password.length < 64) {
    throw new Error(
      "AUTH_COOKIE_SECRET absent ou trop court (64+ chars requis)"
    );
  }
  return {
    cookieName: COOKIE_NAME,
    password,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 jours
    },
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return await getIronSession<SessionData>(cookieStore, getSessionOptions());
}

/** Retourne la session OU null si pas authentifie. */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session.userId) return null;
  const rows = (await db`
    SELECT id, email, stripe_customer_id, created_at, last_login_at
    FROM users
    WHERE id = ${session.userId}
    LIMIT 1
  `) as unknown as User[];
  return rows[0] || null;
}

/** Throws si pas authentifie — usage dans les routes protegees. */
export async function requireSession(): Promise<{ userId: string; email: string }> {
  const session = await getSession();
  if (!session.userId || !session.email) {
    throw new SessionError("UNAUTHENTICATED");
  }
  return { userId: session.userId, email: session.email };
}

export class SessionError extends Error {
  constructor(public code: "UNAUTHENTICATED" | "EXPIRED") {
    super(code);
    this.name = "SessionError";
  }
}

export async function destroySession() {
  const session = await getSession();
  session.destroy();
}
