import { NextResponse } from "next/server";

const API_ENDPOINT = "https://api.sandbox.trackdechets.beta.gouv.fr/";

// SIRET sandbox Vertxia TEST — utilisé pour les 3 rôles (émetteur / transporteur / destination)
// pendant la phase MVP démo. Sera remplacé par l'OAuth2 du frigoriste en production.
const VERTXIA_SIRET = "00000091982033";

const VERTXIA_COMPANY = {
  siret: VERTXIA_SIRET,
  name: "Établissement de test - Vertxia TEST",
  address: "Adresse test, 65000 TARBES",
  contact: "Emilien Behague",
  phone: "0652099885",
  mail: "emilien@vertxia.com",
};

type RequestBody = {
  fluide: { code: string; label: string; gwp: number; wasteCode: string };
  weight: number;
  packagingNumero: string;
  clientName: string | null;
};

async function gql(token: string, query: string, variables: Record<string, unknown> = {}) {
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

function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

function serverError(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 500 });
}

export async function POST(req: Request) {
  const token = process.env.TRACKDECHETS_SANDBOX_TOKEN;
  if (!token) {
    return serverError(
      "TRACKDECHETS_SANDBOX_TOKEN manquant. Ajoute le dans web/.env.local et redémarre le serveur dev."
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return badRequest("Corps de requête invalide");
  }

  const { fluide, weight, packagingNumero, clientName } = body;
  if (!fluide?.code || !weight || !packagingNumero) {
    return badRequest("Champs requis manquants : fluide, weight, packagingNumero");
  }
  if (!/^[A-Za-z0-9]+$/.test(packagingNumero)) {
    return badRequest("Le numéro de contenant doit être alphanumérique (pas de tirets ni espaces)");
  }

  // ÉTAPE 1 — createBsff (DRAFT)
  const description = clientName
    ? `Fluide frigorigène ${fluide.code} récupéré — Client : ${clientName}`
    : `Fluide frigorigène ${fluide.code} récupéré`;

  const createInput = {
    type: "COLLECTE_PETITES_QUANTITES",
    emitter: { company: VERTXIA_COMPANY },
    waste: {
      code: fluide.wasteCode,
      description,
      adr: "UN 1078, GAZ FRIGORIGÈNE NSA, 2.2, (E)",
    },
    weight: { value: weight, isEstimate: true },
    packagings: [
      {
        type: "BOUTEILLE",
        volume: 12,
        weight: 12,
        numero: packagingNumero,
      },
    ],
    transporter: {
      company: VERTXIA_COMPANY,
      transport: { mode: "ROAD", plates: ["AB123CD"] },
      recepisse: { isExempted: true },
    },
    destination: {
      company: {
        ...VERTXIA_COMPANY,
        contact: "Service Réception",
        phone: "0562999999",
        mail: "reception@centre-test.fr",
      },
      plannedOperationCode: "R5",
      cap: "",
    },
  };

  const r1 = await gql(
    token,
    `mutation CreateBsff($input: BsffInput!) {
       createBsff(input: $input) {
         id status isDraft type createdAt
       }
     }`,
    { input: createInput }
  );
  if (r1.errors) {
    return badRequest("Échec création BSFF", r1.errors);
  }
  const bsff = r1.data?.createBsff;
  if (!bsff?.id) {
    return serverError("Réponse TrackDéchets invalide", r1);
  }

  // ÉTAPE 2 — publishBsff (DRAFT → INITIAL)
  const r2 = await gql(
    token,
    `mutation PublishBsff($id: ID!) {
       publishBsff(id: $id) { id status isDraft }
     }`,
    { id: bsff.id }
  );
  if (r2.errors) {
    return badRequest("Échec publication BSFF", r2.errors);
  }

  // ÉTAPE 3 — signBsff(EMISSION)
  const r3 = await gql(
    token,
    `mutation SignBsff($id: ID!, $input: BsffSignatureInput!) {
       signBsff(id: $id, input: $input) {
         id status
         emitter { emission { signature { author date } } }
       }
     }`,
    {
      id: bsff.id,
      input: { type: "EMISSION", author: "Emilien Behague" },
    }
  );
  if (r3.errors) {
    return badRequest("Échec signature BSFF", r3.errors);
  }
  const signedAt: string | undefined = r3.data?.signBsff?.emitter?.emission?.signature?.date;

  // ÉTAPE 4 — bsffPdf : récupération URL de téléchargement signée
  const r4 = await gql(
    token,
    `query BsffPdf($id: ID!) {
       bsffPdf(id: $id) { downloadLink token }
     }`,
    { id: bsff.id }
  );
  if (r4.errors) {
    return badRequest("Échec récupération PDF", r4.errors);
  }
  const pdfUrl: string | undefined = r4.data?.bsffPdf?.downloadLink;
  if (!pdfUrl) {
    return serverError("URL PDF absente dans la réponse TrackDéchets", r4);
  }

  return NextResponse.json({
    bsffId: bsff.id,
    status: r3.data?.signBsff?.status,
    signedAt: signedAt ?? new Date().toISOString(),
    pdfUrl,
  });
}
