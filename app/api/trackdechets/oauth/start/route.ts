import { NextResponse } from "next/server";
import crypto from "crypto";

// OAuth2 TrackDéchets — étape 1/2 : redirige le user vers la page
// d'autorisation TrackDéchets avec un state CSRF stocké en cookie httpOnly.
// Au retour (/api/trackdechets/oauth/callback), on vérifie que le state
// correspond pour bloquer les attaques CSRF.

const AUTHORIZE_URL = "https://app.trackdechets.beta.gouv.fr/oauth2/authorize/dialog";

// Cookie state — validité 10 min (assez pour cliquer "Autoriser")
const STATE_COOKIE = "td_oauth_state";
const STATE_TTL_SECONDS = 600;

function getRedirectUri(req: Request): string {
  // En prod sur Vercel, NEXT_PUBLIC_SITE_URL devrait être défini.
  // Sinon on déduit de l'origin de la requête.
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (envUrl) return `${envUrl}/api/trackdechets/oauth/callback`;
  const origin = new URL(req.url).origin;
  return `${origin}/api/trackdechets/oauth/callback`;
}

export async function GET(req: Request) {
  const clientId = process.env.TRACKDECHETS_CLIENT_ID_PROD;
  if (!clientId) {
    return NextResponse.json(
      { error: "TRACKDECHETS_CLIENT_ID_PROD manquant côté serveur." },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(32).toString("hex");
  const redirectUri = getRedirectUri(req);

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString(), { status: 302 });
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });
  return response;
}
