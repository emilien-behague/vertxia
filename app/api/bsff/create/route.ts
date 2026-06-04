import { NextResponse } from "next/server";

// Endpoints TrackDéchets
// - Sandbox = bac à sable démo, BSFF sans valeur légale (mode démo Vertxia)
// - Production = api officielle Ministère, BSFF opposable légalement
const API_ENDPOINT_SANDBOX = "https://api.sandbox.trackdechets.beta.gouv.fr/";
const API_ENDPOINT_PRODUCTION = "https://api.trackdechets.beta.gouv.fr/";

// SIRET sandbox Vertxia TEST — utilisé en mode démo pour les 3 rôles
// (émetteur / transporteur / destination). Remplacé par le profil utilisateur
// quand il a renseigné son propre token + SIRET + destination.
const VERTXIA_SIRET = "00000091982033";

const VERTXIA_COMPANY = {
  siret: VERTXIA_SIRET,
  name: "Établissement de test - Vertxia TEST",
  address: "Adresse test, 65000 TARBES",
  contact: "Emilien Behague",
  phone: "0652099885",
  mail: "emilien@vertxia.com",
};

type CompanyOverride = {
  siret: string;
  name: string;
  address: string;
  contact?: string;
  phone?: string;
  mail?: string;
};

type RequestBody = {
  fluide: { code: string; label: string; gwp: number; wasteCode: string };
  weight: number;
  packagingNumero: string;
  clientName: string | null;
  /** Immatriculation du véhicule transporteur (depuis profil). Fallback "AB123CD" si absent. */
  immatriculation?: string;
  // ─── Mode officiel TrackDéchets (BSFF signé Ministère) ───────────────
  /** Token API personnel TrackDéchets du technicien. Si présent → mode
   *  officiel, le BSFF est signé sous le SIRET du technicien sur l'API prod. */
  userToken?: string;
  /** "sandbox" (défaut, démo Vertxia) ou "production" (officiel) */
  apiMode?: "sandbox" | "production";
  /** Entreprise émettrice + transporteur (le technicien). Si absent → Vertxia TEST. */
  emitterCompany?: CompanyOverride;
  /** Centre agréé de régénération HFC (Climalife, Arkema...). Si absent → Vertxia TEST. */
  destinationCompany?: CompanyOverride;
};

async function gql(
  endpoint: string,
  token: string,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const res = await fetch(endpoint, {
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
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return badRequest("Corps de requête invalide");
  }

  const {
    fluide,
    weight,
    packagingNumero,
    clientName,
    immatriculation,
    userToken,
    apiMode,
    emitterCompany,
    destinationCompany,
  } = body;

  if (!fluide?.code || !weight || !packagingNumero) {
    return badRequest("Champs requis manquants : fluide, weight, packagingNumero");
  }
  if (!/^[A-Za-z0-9]+$/.test(packagingNumero)) {
    return badRequest("Le numéro de contenant doit être alphanumérique (pas de tirets ni espaces)");
  }

  // ─── Résolution mode + token + endpoint ───────────────────────────────
  // Mode officiel : user a fourni son propre token + mode=production
  //   → API endpoint production, token user, SIRET user, destination user
  // Mode démo (par défaut) : sandbox Vertxia
  //   → API endpoint sandbox, token env, SIRET Vertxia TEST partout
  const isLive = apiMode === "production" && Boolean(userToken);
  const endpoint = isLive ? API_ENDPOINT_PRODUCTION : API_ENDPOINT_SANDBOX;
  const token = isLive ? userToken! : process.env.TRACKDECHETS_SANDBOX_TOKEN;
  if (!token) {
    return serverError(
      isLive
        ? "Token TrackDéchets manquant côté client (mode officiel)."
        : "TRACKDECHETS_SANDBOX_TOKEN manquant côté serveur (mode démo)."
    );
  }

  // En mode live, l'emitter est OBLIGATOIRE (sinon le BSFF serait signé
  // sous le SIRET sandbox sur l'API prod → rejet).
  if (isLive && (!emitterCompany?.siret || !emitterCompany?.name)) {
    return badRequest(
      "Mode officiel TrackDéchets : SIRET + raison sociale du technicien requis (depuis le profil)."
    );
  }
  if (isLive && (!destinationCompany?.siret || !destinationCompany?.name)) {
    return badRequest(
      "Mode officiel TrackDéchets : SIRET + nom du centre de destination requis (depuis le profil)."
    );
  }

  const emitter = emitterCompany
    ? {
        siret: emitterCompany.siret,
        name: emitterCompany.name,
        address: emitterCompany.address,
        contact: emitterCompany.contact || "Technicien Vertxia",
        phone: emitterCompany.phone || "",
        mail: emitterCompany.mail || "",
      }
    : VERTXIA_COMPANY;

  const destination = destinationCompany
    ? {
        siret: destinationCompany.siret,
        name: destinationCompany.name,
        address: destinationCompany.address,
        contact: destinationCompany.contact || "Service Réception",
        phone: destinationCompany.phone || "",
        mail: destinationCompany.mail || "",
      }
    : {
        ...VERTXIA_COMPANY,
        contact: "Service Réception",
        phone: "0562999999",
        mail: "reception@centre-test.fr",
      };

  // ÉTAPE 1 — createBsff (DRAFT)
  const description = clientName
    ? `Fluide frigorigène ${fluide.code} récupéré — Client : ${clientName}`
    : `Fluide frigorigène ${fluide.code} récupéré`;

  const authorName = emitter.contact || "Technicien Vertxia";

  const createInput = {
    type: "COLLECTE_PETITES_QUANTITES",
    emitter: { company: emitter },
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
      company: emitter, // le technicien collecte ET transporte (SCOLLAC = transporteur agréé)
      transport: {
        mode: "ROAD",
        plates: [immatriculation?.trim() || "AB123CD"],
      },
      recepisse: { isExempted: true },
    },
    destination: {
      company: destination,
      plannedOperationCode: "R5",
      cap: "",
    },
  };

  const r1 = await gql(
    endpoint,
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
    endpoint,
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
    endpoint,
    token,
    `mutation SignBsff($id: ID!, $input: BsffSignatureInput!) {
       signBsff(id: $id, input: $input) {
         id status
         emitter { emission { signature { author date } } }
       }
     }`,
    {
      id: bsff.id,
      input: { type: "EMISSION", author: authorName },
    }
  );
  if (r3.errors) {
    return badRequest("Échec signature BSFF", r3.errors);
  }
  const signedAt: string | undefined = r3.data?.signBsff?.emitter?.emission?.signature?.date;

  // ÉTAPE 4 — bsffPdf : récupération URL de téléchargement signée
  const r4 = await gql(
    endpoint,
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

  // ÉTAPE 5 — récupération de la destination (centre de traitement) pour
  // la case 13 du CERFA 15497*04 "Installation prévue de destination du
  // fluide récupéré (Nom, SIRET, adresse)".
  // Source de vérité = TrackDéchets, donc on relit le BSFF côté serveur
  // au lieu de réutiliser le payload qu'on a envoyé.
  const r5 = await gql(
    endpoint,
    token,
    `query BsffDestination($id: ID!) {
       bsff(id: $id) {
         destination {
           company { name siret address }
         }
       }
     }`,
    { id: bsff.id }
  );
  // Pas bloquant si ça échoue — le CERFA peut être généré sans la section 13.
  const destCompany = r5.data?.bsff?.destination?.company;
  const destinationOut = destCompany
    ? {
        name: destCompany.name as string,
        siret: destCompany.siret as string,
        address: destCompany.address as string,
      }
    : null;

  return NextResponse.json({
    bsffId: bsff.id,
    status: r3.data?.signBsff?.status,
    signedAt: signedAt ?? new Date().toISOString(),
    pdfUrl,
    destination: destinationOut,
    mode: isLive ? "production" : "sandbox",
  });
}
