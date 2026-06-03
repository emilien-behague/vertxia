import { NextResponse } from "next/server";

// Signature de la prise en charge transport d'un BSFF existant.
// Cas d'usage : le frigoriste joue aussi le rôle de transporteur (il apporte
// lui-même les bouteilles au centre de traitement). Au lieu d'aller sur
// l'interface TrackDéchets web depuis son PC, il signe en 3 taps sur l'app
// mobile à la fin de sa tournée.
//
// Workflow officiel TrackDéchets : EMISSION (signée) → TRANSPORT (cette route)
// → RECEPTION (signée par le centre) → OPERATION (signée par le centre).

const API_ENDPOINT = "https://api.sandbox.trackdechets.beta.gouv.fr/";

type RequestBody = {
  bsffId: string;
  author: string;
  /** Date ISO de prise en charge effective de la bouteille par le transporteur.
   *  Si absent : maintenant. Format ISO 8601 (ex : 2026-06-02T23:50:00.000Z). */
  takenOverAt?: string;
};

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

export async function POST(req: Request) {
  const token = process.env.TRACKDECHETS_SANDBOX_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "TRACKDECHETS_SANDBOX_TOKEN manquant côté serveur" },
      { status: 500 }
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { bsffId, author, takenOverAt } = body;
  if (!bsffId || !author?.trim()) {
    return NextResponse.json(
      { error: "Champs requis : bsffId, author" },
      { status: 400 }
    );
  }

  // ÉTAPE 1 — updateBsff pour set la date de prise en charge sur transporter.transport.
  // Sans ça, la section 7 du PDF BSFF reste "Date de prise en charge : __/__/____"
  // même après signature transport.
  const takenOverIso = (takenOverAt && new Date(takenOverAt).toISOString()) || new Date().toISOString();
  const update = await gql(
    token,
    `mutation UpdateBsff($id: ID!, $input: BsffInput!) {
       updateBsff(id: $id, input: $input) {
         id
         transporter { transport { takenOverAt } }
       }
     }`,
    {
      id: bsffId,
      input: { transporter: { transport: { takenOverAt: takenOverIso } } },
    }
  );
  if (update.errors) {
    return NextResponse.json(
      { error: "Échec mise à jour date prise en charge", details: update.errors },
      { status: 400 }
    );
  }

  // ÉTAPE 2 — signBsff TRANSPORT (fige les données transport, BSFF passe en SENT)
  const r = await gql(
    token,
    `mutation SignBsffTransport($id: ID!, $input: BsffSignatureInput!) {
       signBsff(id: $id, input: $input) {
         id
         status
         transporter {
           transport {
             takenOverAt
             signature { author date }
           }
         }
       }
     }`,
    {
      id: bsffId,
      input: { type: "TRANSPORT", author: author.trim() },
    }
  );

  if (r.errors) {
    return NextResponse.json(
      { error: "Échec signature transport BSFF", details: r.errors },
      { status: 400 }
    );
  }

  const signedAt: string | undefined =
    r.data?.signBsff?.transporter?.transport?.signature?.date;
  const taken: string | undefined =
    r.data?.signBsff?.transporter?.transport?.takenOverAt;

  return NextResponse.json({
    bsffId: r.data?.signBsff?.id,
    status: r.data?.signBsff?.status,
    transportSignedAt: signedAt ?? new Date().toISOString(),
    takenOverAt: taken ?? takenOverIso,
  });
}
