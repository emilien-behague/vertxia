import { NextResponse } from "next/server";

// Extraction d'une intervention F-Gas depuis une transcription vocale.
// Appelle Claude Haiku 4.5 (rapide + pas cher) avec system prompt strict
// pour renvoyer un JSON structuré qui mappe sur le state du formulaire
// /m/intervention/nouvelle.

export const runtime = "nodejs";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `Tu es un assistant spécialisé pour frigoristes F-Gas qui extrait les infos d'une intervention depuis une transcription audio en français.

Le frigoriste dicte ce qu'il vient de faire sur une PAC, climatisation ou groupe froid. Tu extrais TOUS les champs que tu peux identifier et tu retournes un JSON valide UNIQUEMENT — pas de markdown, pas de commentaire.

Schéma attendu (utilise null pour les champs non mentionnés) :

{
  "typeIntervention": "recuperation" | "demantelement" | "controle_periodique" | "controle_non_periodique" | "mise_service" | "maintenance" | "assemblage" | "modification" | null,
  "fluide": "R-32" | "R-410A" | "R-134a" | "R-1234yf" | "R-407C" | "R-449A" | "R-404A" | "R-290" | null,
  "weight": number | null,
  "packagingNumero": string | null,
  "detecteurId": string | null,
  "detecteurPermanent": "oui" | "non" | null,
  "fuiteDetectee": "oui" | "non" | null,
  "fuites": [{ "localisation": string, "reparee": "realisee" | "a_faire" | null }],
  "fluideVierge": number | null,
  "fluideRecycle": number | null,
  "fluideRegenere": number | null,
  "fluideTraitement": number | null,
  "fluideReutilisation": number | null,
  "notes": string | null,
  "clientName": string | null,
  "clientAdresse": string | null,
  "lieuIntervention": string | null,
  "confiance": "haute" | "moyenne" | "basse"
}

Mapping des termes courants vers typeIntervention :
- "récupération", "récupérer du fluide", "vider le circuit" → "recuperation"
- "démantèlement", "déposer la PAC", "fin de vie" → "demantelement"
- "contrôle d'étanchéité", "contrôle annuel", "contrôle périodique", "vérification annuelle" → "controle_periodique"
- "contrôle après fuite", "contre-visite", "vérification post-réparation" → "controle_non_periodique"
- "mise en service", "première mise en route", "MES" → "mise_service"
- "maintenance", "entretien", "nettoyage", "vérif annuelle" (sans étanchéité) → "maintenance"
- "assemblage", "montage", "installation initiale", "pose neuve" → "assemblage"
- "modification", "ajout de circuit", "modif de l'installation" → "modification"

Mapping fluide :
- "R32", "R 32", "erre trente-deux" → "R-32"
- "R410A", "R 410 A", "erre quatre-cent-dix A" → "R-410A"
- "R134A" → "R-134a"
- "propane" → "R-290"
- Sinon → null

Normalisation des poids (toujours en kilogrammes) :
- "200 grammes", "200g", "deux cents grammes" → 0.200
- "1 kilo", "un kilo et demi", "1.5 kg" → 1.5
- "500 grammes de R32" → weight=0.500 (uniquement si récupération) OU fluideVierge=0.500 (si recharge)

Décomposition fluide (section [11] CERFA) :
- "rajouté X g de fluide neuf/vierge" → fluideVierge
- "remis du fluide récupéré" → fluideRecycle
- "fluide régénéré" → fluideRegenere
- "récupéré X g pour destruction/traitement" → fluideTraitement
- "récupéré X g pour réutilisation" → fluideReutilisation
- Si seulement "rajouté X g de R32" sans précision : fluideVierge par défaut

Étanchéité :
- "RAS", "rien à signaler", "tout est bon", "pas de fuite", "étanchéité OK" → fuiteDetectee="non", fuites=[]
- "j'ai trouvé une fuite à", "fuite localisée sur" → fuiteDetectee="oui" + ajouter dans fuites[]
- "j'ai réparé la fuite" → reparee="realisee"
- "fuite à reprendre", "à réparer plus tard" → reparee="a_faire"
- "détecteur permanent installé", "système de détection fuite" → detecteurPermanent="oui"

Client / lieu :
- "le client c'est Martin Dupont" → clientName="Martin Dupont"
- "j'interviens chez M. Durand au 15 rue de la République à Toulon" → clientName="M. Durand", lieuIntervention="15 rue de la République, Toulon"
- Adresse si dictée → clientAdresse aussi (même valeur)

Notes :
- Ce qui ne rentre dans aucun champ structuré → notes (ex: "ventilateur intérieur fait du bruit, à surveiller")
- Si rien → notes=null

Confiance :
- "haute" si tous les champs critiques (typeIntervention + au moins fuiteDetectee ou weight) sont clairs
- "moyenne" si tu fais des suppositions raisonnables
- "basse" si la transcription est très ambiguë ou incomplète

Règles strictes :
- Réponds UNIQUEMENT le JSON, rien d'autre.
- Ne JAMAIS inventer une info non dictée — préfère null.
- Si un champ est partiellement clair, prends ta meilleure interprétation et baisse "confiance".`;

type RequestBody = {
  /** Transcription vocale brute (Web Speech API ou Whisper) */
  transcript: string;
  /** Contexte équipement déjà sélectionné (pré-rempli) — aide à la désambiguïsation */
  equipementContext?: {
    modele?: string;
    fluide?: string;
    chargeKg?: number;
    clientName?: string;
  };
};

type Extraction = {
  typeIntervention: string | null;
  fluide: string | null;
  weight: number | null;
  packagingNumero: string | null;
  detecteurId: string | null;
  detecteurPermanent: "oui" | "non" | null;
  fuiteDetectee: "oui" | "non" | null;
  fuites: Array<{ localisation: string; reparee: "realisee" | "a_faire" | null }>;
  fluideVierge: number | null;
  fluideRecycle: number | null;
  fluideRegenere: number | null;
  fluideTraitement: number | null;
  fluideReutilisation: number | null;
  notes: string | null;
  clientName: string | null;
  clientAdresse: string | null;
  lieuIntervention: string | null;
  confiance: "haute" | "moyenne" | "basse";
};

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY manquante dans .env.local (et Vercel env)." },
      { status: 500 }
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  if (!body.transcript || typeof body.transcript !== "string") {
    return NextResponse.json({ error: "transcript requis (string)" }, { status: 400 });
  }

  const transcript = body.transcript.trim();
  if (transcript.length < 5) {
    return NextResponse.json(
      { error: "Transcription trop courte (<5 caractères) — réessaie en parlant plus longtemps." },
      { status: 400 }
    );
  }

  if (transcript.length > 4000) {
    return NextResponse.json(
      { error: "Transcription trop longue (>4000 caractères) — dicte plus court." },
      { status: 413 }
    );
  }

  const contextLine = body.equipementContext
    ? `\n\nContexte équipement déjà sélectionné (pré-rempli, ne le recopie pas sauf si dicté différemment) :
- Modèle : ${body.equipementContext.modele ?? "n/c"}
- Fluide installé : ${body.equipementContext.fluide ?? "n/c"}
- Charge nominale : ${body.equipementContext.chargeKg ?? "n/c"} kg
- Client : ${body.equipementContext.clientName ?? "n/c"}`
    : "";

  const userMessage = `Voici la transcription de l'intervention que vient de dicter le frigoriste :

"""
${transcript}
"""${contextLine}

Extrais le JSON structuré conformément au schéma. Réponds UNIQUEMENT le JSON.`;

  try {
    const apiRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error("[voice/extract-intervention] Claude API error:", apiRes.status, errText);
      return NextResponse.json(
        { error: `Claude API ${apiRes.status}`, detail: errText.slice(0, 500) },
        { status: 502 }
      );
    }

    const data = await apiRes.json();
    const textContent = data?.content?.[0]?.text;
    if (typeof textContent !== "string") {
      return NextResponse.json({ error: "Réponse Claude invalide", raw: data }, { status: 502 });
    }

    // Extract JSON (robuste si markdown enveloppe)
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Pas de JSON dans la réponse Claude", text: textContent },
        { status: 502 }
      );
    }

    let extraction: Extraction;
    try {
      extraction = JSON.parse(jsonMatch[0]) as Extraction;
    } catch {
      return NextResponse.json(
        { error: "JSON Claude invalide", text: textContent },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { extraction, transcript, model: MODEL },
      { status: 200 }
    );
  } catch (err) {
    console.error("[voice/extract-intervention] exception:", err);
    return NextResponse.json(
      {
        error: "Échec extraction vocale",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
