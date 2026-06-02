// Proxy de téléchargement BSFF — résout le problème des URL TrackDéchets éphémères.
//
// Le lien signé que TrackDéchets renvoie via la query bsffPdf expire en ~15min.
// Si le frigoriste clique sur "Télécharger BSFF" depuis son historique 2h après
// l'avoir généré, il se prend "Token invalide ou expiré".
//
// Solution : on ne stocke plus l'URL signée. À la place, on stocke l'ID du BSFF
// et on appelle CETTE route qui regénère un lien frais via GraphQL puis redirige
// le navigateur dessus (302). Le user voit toujours une URL Vertxia stable.
//
// GET /api/bsff/download/[id] → 302 redirect vers le downloadLink TrackDéchets frais

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const API_ENDPOINT = "https://api.sandbox.trackdechets.beta.gouv.fr/";

async function gql(
  token: string,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const res = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  return await res.json();
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const token = process.env.TRACKDECHETS_SANDBOX_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        error:
          "TRACKDECHETS_SANDBOX_TOKEN manquant. Vérifie tes Environment Variables Vercel + redéploie sans cache.",
      },
      { status: 500 }
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "ID BSFF requis dans l'URL" }, { status: 400 });
  }

  // Récupère un lien de téléchargement frais (valide ~15 min) depuis TrackDéchets.
  const r = await gql(
    token,
    `query BsffPdf($id: ID!) {
       bsffPdf(id: $id) { downloadLink token }
     }`,
    { id }
  );

  if (r.errors) {
    return NextResponse.json(
      {
        error: "TrackDéchets a refusé la regénération du lien PDF",
        details: r.errors,
        bsffId: id,
      },
      { status: 502 }
    );
  }

  const downloadLink: string | undefined = r.data?.bsffPdf?.downloadLink;
  if (!downloadLink) {
    return NextResponse.json(
      { error: "Lien de téléchargement absent dans la réponse TrackDéchets", raw: r },
      { status: 502 }
    );
  }

  // Redirection 302 vers le nouveau lien signé. Le navigateur va suivre et
  // déclencher le téléchargement directement chez TrackDéchets.
  return NextResponse.redirect(downloadLink, 302);
}
