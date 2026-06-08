import { NextResponse } from "next/server";

// Claude Vision API : extraction des infos d'une bouteille de fluide frigorigene
// a partir d'une photo. Remplace le scan code-barres JS (ZXing/html5-qrcode) qui
// echoue systematiquement sur Safari iOS avec les Code-128 GS1 industriels Linde.
//
// Pattern aligne sur /api/vision/plaque : photo data URL en input, JSON structure
// en output. Differences cles :
//  - Pas de retry "preprocess" : un code-barres est moins ambigu qu'une plaque
//    gravee, un seul pass suffit dans 95% des cas.
//  - Output contient codeBarre (focus principal) + tous les bonus textuels que
//    Claude voit autour : marque, fluide, type, capacite, numero gravé.

export const runtime = "nodejs";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-7";

const SYSTEM_PROMPT = `Tu es un assistant specialise dans la lecture d'etiquettes de bouteilles de fluide frigorigene (HFC, HFO, propane, melange) utilisees en F-Gas.

Une bouteille typique contient :
- Un CODE-BARRES (souvent Code-128 GS1 type GTIN-14, 13-14 chiffres) sur un sticker fournisseur (Linde, Climalife, Tereva, Air Liquide, Westfalen, Messer). C'est l'INFO PRINCIPALE a extraire.
- Une MARQUE / fournisseur visible (logo Linde, etiquette Climalife, etc.)
- Un FLUIDE designe : R-32, R-410A, R-134a, R-1234yf, R-407C, R-449A, R-404A, R-290, R-454B, R-22, ou "melange" pour les bouteilles deche t.
- Un NUMERO DE SERIE grave sur le col en metal (souvent different du code-barres : c'est l'identifiant ESP transportable obligatoire au registre).
- Une CAPACITE en kg (charge nominale fluide, ex: 10 kg, 12 kg, 27 kg).
- Une TARE en kg (poids a vide grave, ex: 10.5 kg).
- Un TYPE : recharge (bouteille neuve fluide) ou recuperation (bouteille vide pour recuperer fluide use).

Tu DOIS retourner UNIQUEMENT un objet JSON valide, sans markdown, sans commentaire, avec exactement ces champs (utilise null si une info n'est pas visible) :

{
  "codeBarre": "string | null",
  "marque": "string | null",
  "fluide": "R-32" | "R-410A" | "R-134a" | "R-1234yf" | "R-407C" | "R-449A" | "R-404A" | "R-290" | "R-454B" | "R-22" | "melange" | null,
  "numeroSerie": "string | null",
  "capaciteMaxKg": "number | null",
  "tareKg": "number | null",
  "type": "recharge" | "recuperation" | null,
  "confiance": "haute" | "moyenne" | "basse",
  "notes": "string | null"
}

Regles :
- codeBarre = la suite EXACTE de chiffres / chiffres-lettres lisible sous le code-barres lui-meme. Pas le numero de serie grave, c'est un autre champ.
- Si tu lis "R32" sans tiret, retourne "R-32". Idem R410A -> R-410A, etc.
- Si la bouteille est rouge / orange et porte "RECUPERATION" ou "RECOVERY" : type = "recuperation". Sinon recharge.
- Les bouteilles "melange" / "MIX" / "DECHET" : fluide = "melange".
- Si le code-barres est partiellement masque, lis ce que tu peux et indique les chars manquants avec "?" dans notes, pas dans codeBarre (qui doit etre exploitable tel quel).
- "confiance" = "haute" si le code-barres est lisible sans ambiguite ; "moyenne" si quelques chiffres incertains ; "basse" si tu devines beaucoup.

STRATEGIES POUR PHOTOS DIFFICILES :
- Si l'angle est oblique, lis les chiffres par groupes en suivant la courbure du sticker.
- Si le sticker est froisse ou raye, prefere lire les chiffres reellement visibles et explique dans "notes" lesquels sont incertains.
- Si l'eclairage est mauvais (sombre / reflet), insiste sur les zones a contraste fort.
- Si tu ne vois PAS de code-barres mais l'image est bien une bouteille, retourne codeBarre = null et remplis les autres champs visibles (numero serie grave, fluide, capacite) — c'est mieux que rien.
- Si l'image n'est pas une bouteille (autre objet, photo floue inutilisable, document) : tous champs null + confiance "basse" + explique dans "notes".`;

type RequestBody = {
  /** Image en data URL : "data:image/jpeg;base64,..." */
  imageDataUrl: string;
};

type BouteilleVisionData = {
  codeBarre: string | null;
  marque: string | null;
  fluide: string | null;
  numeroSerie: string | null;
  capaciteMaxKg: number | null;
  tareKg: number | null;
  type: "recharge" | "recuperation" | null;
  confiance: "haute" | "moyenne" | "basse";
  notes: string | null;
};

function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/);
  if (!match) return null;
  const mediaType = match[1].replace("image/jpg", "image/jpeg");
  return { mediaType, base64: match[2] };
}

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

  if (!body.imageDataUrl) {
    return NextResponse.json({ error: "imageDataUrl requis" }, { status: 400 });
  }

  const parsed = parseDataUrl(body.imageDataUrl);
  if (!parsed) {
    return NextResponse.json(
      { error: "Format image invalide (attendu data:image/jpeg|png;base64,…)" },
      { status: 400 }
    );
  }

  // Garde-fou taille : Claude Vision limite a 5 MB par image en base64.
  const sizeBytes = (parsed.base64.length * 3) / 4;
  if (sizeBytes > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Image trop grosse (>5 MB). Reduis la resolution / qualite." },
      { status: 413 }
    );
  }

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
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: parsed.mediaType,
                  data: parsed.base64,
                },
              },
              {
                type: "text",
                text: "Analyse cette photo de bouteille de fluide frigorigene et retourne le JSON structure. Focus principal : lis le code-barres du sticker fournisseur si visible.",
              },
            ],
          },
        ],
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error("[vision/bouteille] Claude API error:", apiRes.status, errText);
      return NextResponse.json(
        { error: `Claude API ${apiRes.status}`, detail: errText.slice(0, 500) },
        { status: 502 }
      );
    }

    const data = await apiRes.json();
    const textContent = data?.content?.[0]?.text;
    if (typeof textContent !== "string") {
      return NextResponse.json(
        { error: "Reponse Claude invalide", raw: data },
        { status: 502 }
      );
    }

    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Pas de JSON dans la reponse Claude", text: textContent },
        { status: 502 }
      );
    }

    let bouteille: BouteilleVisionData;
    try {
      bouteille = JSON.parse(jsonMatch[0]) as BouteilleVisionData;
    } catch {
      return NextResponse.json(
        { error: "JSON Claude invalide", text: textContent },
        { status: 502 }
      );
    }

    return NextResponse.json(bouteille, { status: 200 });
  } catch (err) {
    console.error("[vision/bouteille] exception:", err);
    return NextResponse.json(
      {
        error: "Echec analyse vision",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
