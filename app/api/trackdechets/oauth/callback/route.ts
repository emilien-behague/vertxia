import { NextResponse } from "next/server";

// OAuth2 TrackDéchets — étape 2/2 : reçoit le code d'autorisation,
// l'échange contre un access_token via Basic Auth client_id:client_secret,
// puis renvoie une page HTML qui stocke le token dans le profil localStorage
// existant (le code BSFF existant n'a pas besoin de changer) et redirige
// vers /m/profil avec un flag de succès.

const TOKEN_URL = "https://api.trackdechets.beta.gouv.fr/oauth2/token";
const ME_URL = "https://api.trackdechets.beta.gouv.fr/";
const STATE_COOKIE = "td_oauth_state";

function getRedirectUri(req: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (envUrl) return `${envUrl}/api/trackdechets/oauth/callback`;
  const origin = new URL(req.url).origin;
  return `${origin}/api/trackdechets/oauth/callback`;
}

function htmlError(message: string): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Erreur — Vertxia</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#F5F4F0;color:#111;padding:40px 20px;max-width:520px;margin:0 auto}h1{color:#b91c1c;font-size:20px;margin-bottom:12px}p{line-height:1.5;color:rgba(0,0,0,0.7)}a{display:inline-block;margin-top:20px;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:12px;font-weight:500}</style>
</head><body>
<h1>Connexion TrackDéchets impossible</h1>
<p>${message.replace(/</g, "&lt;")}</p>
<a href="/m/profil">Retour au profil</a>
</body></html>`;
}

function htmlSuccess(token: string, company: { siret?: string; name?: string; address?: string } | null): string {
  // On injecte le token + entreprise dans une page HTML qui les écrit dans
  // le localStorage "vertxia:profil" (scope user-id, voir lib/user-scope.ts)
  // puis redirige vers /m/profil?td_connected=1. Le scope user-id est lu
  // côté client (pas dispo server-side).
  const payload = JSON.stringify({
    token,
    company,
  });
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Connexion réussie — Vertxia</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#F5F4F0;color:#111;padding:40px 20px;max-width:520px;margin:0 auto;text-align:center}h1{color:#059669;font-size:20px;margin-bottom:12px}.spinner{display:inline-block;width:24px;height:24px;border:3px solid rgba(0,0,0,0.1);border-top-color:#A16207;border-radius:50%;animation:spin 0.7s linear infinite;margin-top:20px}@keyframes spin{to{transform:rotate(360deg)}}</style>
</head><body>
<h1>✓ Connecté à TrackDéchets</h1>
<p>Configuration de votre profil…</p>
<div class="spinner"></div>
<script>
(function(){
  try {
    var payload = ${payload};
    // Lecture du scope user-id (cf. lib/user-scope.ts) pour cibler la bonne clé
    var userId = null;
    try { userId = localStorage.getItem("vertxia:user-id"); } catch (e) {}
    var key = userId ? "vertxia:profil:" + userId : "vertxia:profil";
    var raw = null;
    try { raw = localStorage.getItem(key); } catch (e) {}
    var profil = raw ? JSON.parse(raw) : {};
    profil.trackdechetsToken = payload.token;
    profil.trackdechetsMode = "production";
    // Pré-remplit l'identité légale si vide (l'API TrackDéchets fait foi)
    if (payload.company) {
      if (!profil.siret && payload.company.siret) profil.siret = payload.company.siret;
      if (!profil.raisonSociale && payload.company.name) profil.raisonSociale = payload.company.name;
      if (!profil.adresseRue && payload.company.address) {
        profil.adresseRue = payload.company.address;
      }
    }
    profil.updatedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(profil));
  } catch (e) {
    console.error("[trackdechets oauth] save failed", e);
  }
  setTimeout(function(){
    window.location.replace("/m/profil?td_connected=1");
  }, 400);
})();
</script>
</body></html>`;
}

async function fetchCompany(token: string): Promise<{ siret?: string; name?: string; address?: string } | null> {
  // Récupère la 1ère entreprise du user via GraphQL `me { companies { ... } }`
  // pour pré-remplir SIRET/raison sociale/adresse. Non bloquant.
  try {
    const res = await fetch(ME_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: `{ me { companies { siret name address } } }`,
      }),
      cache: "no-store",
    });
    const json = await res.json();
    const c = json?.data?.me?.companies?.[0];
    if (!c) return null;
    return { siret: c.siret, name: c.name, address: c.address };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    return new NextResponse(
      htmlError(`TrackDéchets a refusé la connexion : ${error}${errorDescription ? " — " + errorDescription : ""}`),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (!code || !state) {
    return new NextResponse(
      htmlError("Paramètres OAuth manquants (code ou state). Recommence la connexion depuis ton profil."),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Vérif CSRF state cookie
  const cookieHeader = req.headers.get("cookie") || "";
  const cookieMatch = cookieHeader.match(new RegExp(`(?:^|; )${STATE_COOKIE}=([^;]+)`));
  const expectedState = cookieMatch?.[1];
  if (!expectedState || expectedState !== state) {
    return new NextResponse(
      htmlError("État OAuth invalide (anti-CSRF). Recommence la connexion depuis ton profil."),
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const clientId = process.env.TRACKDECHETS_CLIENT_ID_PROD;
  const clientSecret = process.env.TRACKDECHETS_CLIENT_SECRET_PROD;
  if (!clientId || !clientSecret) {
    return new NextResponse(
      htmlError("Configuration serveur incomplète (client_id ou client_secret manquant)."),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Exchange code → access_token
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(req),
    }).toString(),
    cache: "no-store",
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => "");
    return new NextResponse(
      htmlError(`Échec d'échange du code OAuth (HTTP ${tokenRes.status}) : ${errText.slice(0, 300)}`),
      { status: 502, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const tokenJson = await tokenRes.json();
  const accessToken: string | undefined = tokenJson?.access_token;
  if (!accessToken) {
    return new NextResponse(
      htmlError("La réponse TrackDéchets ne contient pas d'access_token."),
      { status: 502, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Bonus : récupère l'entreprise du user pour pré-remplir le profil
  const company = await fetchCompany(accessToken);

  const response = new NextResponse(htmlSuccess(accessToken, company), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  // Clean le cookie state (usage unique)
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
