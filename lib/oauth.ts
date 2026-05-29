/**
 * OAuth providers Vertxia V0.8 — Google sign-in via Arctic + JWKS verify.
 *
 * Flow Google :
 *  1. GET /api/auth/google              -> redirect Google + state cookie (CSRF)
 *  2. user authorize sur Google
 *  3. Google redirect -> GET /api/auth/google/callback?code=xxx&state=yyy
 *  4. server verifie state, echange code -> tokens, verifie SIGNATURE id_token
 *     via Google JWKS (fix H1 audit), extrait email
 *  5. upsert user, set session, redirect /app
 */

import { Google } from "arctic";
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";

let _google: Google | null = null;

export function getGoogleProvider(): Google {
  if (_google) return _google;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth env vars manquantes : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI"
    );
  }
  _google = new Google(clientId, clientSecret, redirectUri);
  return _google;
}

/**
 * Google JWKS endpoint pour verifier la signature des id_token.
 * createRemoteJWKSet cache les cles publiques (jose gere refresh).
 */
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

/**
 * Verifie la signature d'un id_token Google avec JWKS + valide issuer + audience.
 *
 * [SECURITY H1] Remplace l'ancien decode base64 unsigned, qui acceptait n'importe
 * quel JWT valide structurellement. Maintenant on s'assure que :
 *  - le JWT est signe par une cle Google
 *  - l'issuer est accounts.google.com
 *  - l'audience est notre client_id (nous, pas une autre app Google)
 *  - l'expiration n'est pas depassee
 */
export async function verifyGoogleIdToken(idToken: string): Promise<{
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  sub: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID absent");

  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });

  const p = payload as JWTPayload & {
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!p.email || typeof p.email !== "string") {
    throw new Error("email absent du id_token Google verifie");
  }
  if (!p.sub) {
    throw new Error("sub absent du id_token Google verifie");
  }

  return {
    email: p.email,
    email_verified: p.email_verified !== false,
    name: p.name,
    picture: p.picture,
    sub: String(p.sub),
  };
}
