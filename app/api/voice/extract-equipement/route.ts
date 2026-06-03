import { NextResponse } from "next/server";

// Extraction d'une fiche équipement F-Gas depuis une transcription vocale.
// Appelle Claude Haiku 4.5 (rapide + pas cher) avec system prompt strict
// pour renvoyer un JSON structuré qui mappe sur le state du formulaire
// /m/equipements/nouveau.

export const runtime = "nodejs";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `Tu es un assistant spécialisé pour frigoristes F-Gas qui extrait les infos d'un nouvel équipement (PAC, climatisation, groupe froid) depuis une transcription audio en français.

Le frigoriste dicte les caractéristiques d'un équipement qu'il vient d'installer ou qu'il ajoute à son parc. Tu extrais TOUS les champs que tu peux identifier et tu retournes un JSON valide UNIQUEMENT — pas de markdown, pas de commentaire.

Schéma attendu (utilise null pour les champs non mentionnés) :

{
  "clientName": string | null,
  "clientEmail": string | null,
  "clientTelephone": string | null,
  "siteAdresse": string | null,
  "modele": string | null,
  "numeroSerie": string | null,
  "fluideCode": "R-32" | "R-410A" | "R-407C" | "R-134a" | "R-404A" | "R-22" | "R-1234yf" | "R-1234ze" | "R-290" | "R-744" | "R-449A" | null,
  "chargeKg": number | null,
  "detecteurFixe": boolean | null,
  "dernierControle": string | null,
  "notes": string | null,
  "unitesInterieures": [
    {
      "type": "cassette_plafond" | "cassette_4_voies" | "cassette_1_voie" | "murale" | "gainable" | "plafonnier" | "console" | "vitrine_murale" | "chambre_froide_positive" | "chambre_froide_negative",
      "modele": string | null,
      "numeroSerie": string | null,
      "emplacement": string | null
    }
  ],
  "confiance": "haute" | "moyenne" | "basse"
}

Mapping client / lieu :
- "le client c'est l'hôtel Le Provençal" → clientName="Hôtel Le Provençal"
- "Martin Dupont" → clientName="Martin Dupont"
- "à l'adresse 14 avenue de la République à Toulon" → siteAdresse="14 avenue de la République, Toulon"
- Numéros de téléphone FR : extraire au format brut dicté (ex: "04 94 41 23 45")
- Email si dicté : extraire au format minuscule

Mapping fluide :
- "R32", "R 32", "erre trente-deux" → "R-32"
- "R410A", "R 410 A", "erre quatre-cent-dix A" → "R-410A"
- "R407C" → "R-407C"
- "R134A" → "R-134a"
- "R404A" → "R-404A"
- "R22" → "R-22"
- "R1234yf" → "R-1234yf"
- "propane" → "R-290"
- "CO2" → "R-744"
- Sinon → null

Normalisation de la charge (toujours en kilogrammes) :
- "16 kilos" → 16
- "5 kg et demi" → 5.5
- "800 grammes" → 0.800
- "2,5 kg" → 2.5

Modèle / N° de série :
- "modèle Daikin VRV cinq RWEYQ16T7Y1B" → modele="Daikin VRV V RWEYQ16T7Y1B"
- "numéro de série DK24VRV16001" → numeroSerie="DK24VRV16001"
- "S/N : DK24..." → numeroSerie="DK24..."
- ATTENTION : ne JAMAIS confondre modèle (texte commercial) et n°série (alphanumérique unique)

Détecteur fixe :
- "détecteur permanent installé", "système de détection fixe", "il y a un détecteur de fuites" → detecteurFixe=true
- "pas de détecteur" → detecteurFixe=false
- Non mentionné → null

Dernier contrôle (date format YYYY-MM-DD) :
- "dernier contrôle en mars 2025" → "2025-03-01"
- "contrôlé le 15 janvier" + année courante → "2026-01-15"
- "jamais contrôlé", "neuf" → null
- Non mentionné → null

Unités intérieures :
- "4 cassettes plafonnières dans les chambres" → 4 entrées de type "cassette_plafond" avec emplacement="chambre 1", "chambre 2"... SI ET SEULEMENT SI le frigoriste a précisé chambre 1, chambre 2, etc.
- Sinon 4 entrées avec emplacement="Chambre" (générique) ou null
- "une vitrine murale en salle" → 1 entrée type "vitrine_murale", emplacement="Salle"
- "chambre froide négative en réserve" → 1 entrée type "chambre_froide_negative", emplacement="Réserve"
- Si le frigoriste ne précise PAS modèle/n°série pour chaque unité, mettre null pour ces champs (l'utilisateur les complétera après)
- Si AUCUNE unité intérieure mentionnée → unitesInterieures=[]
- ATTENTION : ne génère JAMAIS plus d'unités que ce qui est dicté

Mapping types unités intérieures :
- "cassette plafonnière", "cassette plafond" → "cassette_plafond"
- "cassette 4 voies" → "cassette_4_voies"
- "cassette 1 voie" → "cassette_1_voie"
- "murale", "split mural" → "murale"
- "gainable" → "gainable"
- "plafonnier" → "plafonnier"
- "console" → "console"
- "vitrine murale", "vitrine réfrigérée" → "vitrine_murale"
- "chambre froide positive", "CF positive", "frigo positif" → "chambre_froide_positive"
- "chambre froide négative", "CF négative", "frigo négatif", "congélateur" → "chambre_froide_negative"

Notes :
- Ce qui ne rentre dans aucun champ structuré → notes (ex: "accès toit par échelle côté nord", "salle de réunion 1er étage")
- Si rien → notes=null

Confiance :
- "haute" si au moins clientName + modele + numeroSerie + fluideCode + chargeKg sont clairs
- "moyenne" si quelques suppositions raisonnables
- "basse" si la transcription est très ambiguë

Règles strictes :
- Réponds UNIQUEMENT le JSON, rien d'autre.
- Ne JAMAIS inventer une info non dictée — préfère null.
- Ne JAMAIS générer plus d'unités intérieures que ce qui est dicté.
- Si "X unités intérieures" mais types/emplacements pas précisés, génère X entrées avec valeurs null.`;

type RequestBody = {
  /** Transcription vocale brute (Web Speech API) */
  transcript: string;
};

type UniteExtraction = {
  type: string;
  modele: string | null;
  numeroSerie: string | null;
  emplacement: string | null;
};

type Extraction = {
  clientName: string | null;
  clientEmail: string | null;
  clientTelephone: string | null;
  siteAdresse: string | null;
  modele: string | null;
  numeroSerie: string | null;
  fluideCode: string | null;
  chargeKg: number | null;
  detecteurFixe: boolean | null;
  dernierControle: string | null;
  notes: string | null;
  unitesInterieures: UniteExtraction[];
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

  const userMessage = `Voici la transcription du nouvel équipement que vient de dicter le frigoriste :

"""
${transcript}
"""

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
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error("[voice/extract-equipement] Claude API error:", apiRes.status, errText);
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
    console.error("[voice/extract-equipement] exception:", err);
    return NextResponse.json(
      {
        error: "Échec extraction vocale",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
