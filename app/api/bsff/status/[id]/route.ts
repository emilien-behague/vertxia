import { NextResponse } from "next/server";

// Récupère le statut complet d'un BSFF depuis TrackDéchets : signatures
// de chacune des 4 étapes (EMISSION / TRANSPORT / RECEPTION / OPERATION).
// Utilisé pour afficher le timeline de suivi sur la page détail intervention
// dans Vertxia mobile.
//
// Statuts BSFF possibles :
//   INITIAL       — créé et publié, aucune signature
//   SIGNED_BY_EMITTER — émetteur a signé (étape 1/4)
//   SENT          — transporteur a signé (étape 2/4)
//   RECEIVED      — réception centre signée (étape 3/4)
//   ACCEPTED      — acceptation centre signée
//   PROCESSED     — opération de traitement signée (étape 4/4 — FINI)
//   REFUSED       — refusé par le centre

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
  { params }: { params: Promise<{ id: string }> }
) {
  const token = process.env.TRACKDECHETS_SANDBOX_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "TRACKDECHETS_SANDBOX_TOKEN manquant côté serveur" },
      { status: 500 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID BSFF manquant" }, { status: 400 });
  }

  const r = await gql(
    token,
    `query BsffStatus($id: ID!) {
       bsff(id: $id) {
         id
         status
         emitter {
           emission { signature { author date } }
         }
         transporter {
           transport { signature { author date } }
         }
         destination {
           reception { signature { author date } }
           operation {
             code
             description
             signature { author date }
           }
         }
       }
     }`,
    { id }
  );

  if (r.errors) {
    return NextResponse.json(
      { error: "Échec récupération statut BSFF", details: r.errors },
      { status: 400 }
    );
  }

  const bsff = r.data?.bsff;
  if (!bsff) {
    return NextResponse.json({ error: "BSFF introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    bsffId: bsff.id,
    status: bsff.status,
    emission: bsff.emitter?.emission?.signature ?? null,
    transport: bsff.transporter?.transport?.signature ?? null,
    reception: bsff.destination?.reception?.signature ?? null,
    operation: bsff.destination?.operation?.signature ?? null,
    operationCode: bsff.destination?.operation?.code ?? null,
  });
}
