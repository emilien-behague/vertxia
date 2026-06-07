import { NextResponse } from "next/server";

// Claude Vision API : extraction des infos d'une plaque signalétique
// d'équipement frigorifique (clim split, PAC, froid commercial, etc.).
// Retourne JSON structuré pour pré-remplir le formulaire /bsff.

export const runtime = "nodejs";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-7";

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans la lecture de plaques signalétiques d'équipements de réfrigération, climatisation et pompes à chaleur (F-Gas).

Une plaque signalétique contient typiquement :
- Marque / fabricant (Daikin, Mitsubishi, Atlantic, Toshiba, LG, Samsung, Carrier, Trane, Hitachi…)
- Modèle (référence du produit, ex: FTXM35M, PUHZ-ZRP125YKA, R32-PAC8)
- Numéro de série (chaîne alphanumérique unique de l'équipement)
- Fluide frigorigène utilisé (R-32, R-410A, R-134a, R-1234yf, R-407C, R-449A, R-290, R-22…)
- Charge nominale en fluide (en kg ou g, ex: "0.85 kg" ou "850 g")
- Type d'équipement (climatiseur split, PAC air-air, PAC air-eau, groupe froid, etc.)

Tu DOIS retourner UNIQUEMENT un objet JSON valide, sans markdown, sans commentaire, avec exactement ces champs (utilise null si une info n'est pas visible ou illisible) :

{
  "marque": "string | null",
  "modele": "string | null",
  "numeroSerie": "string | null",
  "fluide": "R-32" | "R-410A" | "R-134a" | "R-1234yf" | "R-407C" | "R-449A" | "R-290" | "R-22" | null,
  "chargeNominaleKg": "number | null",
  "typeEquipement": "string | null",
  "confiance": "haute" | "moyenne" | "basse",
  "notes": "string | null"
}

Règles :
- Si la charge est en grammes, convertis en kg (ex: "850 g" → 0.85).
- Si tu lis "R32" sans tiret, retourne "R-32".
- Si l'image n'est pas une plaque signalétique ou est totalement illisible, retourne tous les champs à null avec confiance: "basse" et explique dans "notes".
- "confiance" = "haute" si tous les champs critiques (modèle, fluide, charge) sont clairement lisibles ; "moyenne" si certains sont incertains ; "basse" si tu fais beaucoup de devinettes.

STRATEGIES POUR PLAQUES DIFFICILES (rayees, sales, gravees, reflets, faible contraste) :
- Lis caractère par caractère plutôt que mot par mot. Les plaques alu gravées au laser ont souvent un seul trait fin par caractère.
- Si tu hésites entre 0 et O, B et 8, S et 5, I et 1, Z et 2 : choisis selon le CONTEXTE (les modèles Daikin commencent par R/F/P/U + chiffres ; les Mitsubishi par PUHZ/PUMY/MSZ ; les fluides commencent toujours par R suivi de chiffres).
- Pour le numéro de série partiellement masqué : indique ce que tu lis avec "?" pour les caractères incertains (ex: "300?12345?").
- Si la marque est invisible mais le format du modèle est typique d'un fabricant connu, infère la marque avec une confiance "moyenne" et explique dans "notes".
- Sur les plaques avec gravure embossée sans encre : la lecture vient des ombres + reflets, regarde attentivement les variations de luminosité, pas les couleurs.
- Si la plaque est PARTIELLEMENT illisible mais la marque + fluide sont sûrs (champs critiques pour la conformité F-Gas), retourne ces champs avec confiance "moyenne" plutôt que tout à null.
- Si une zone est totalement illisible, ne devine pas — retourne null pour ce champ ET explique précisément dans "notes" ce qui était masqué (rayure, salissure, reflet, gravure trop fine).`;

type RequestBody = {
  /** Image en data URL : "data:image/jpeg;base64,..." ou "data:image/png;base64,..." */
  imageDataUrl: string;
  /** Image pre-traitee (grayscale + stretch contraste) en data URL.
   *  Optionnelle. Si fournie, sera utilisee pour un 2e pass de fallback
   *  si le 1er pass renvoie confiance "basse". */
  imagePreprocessedDataUrl?: string;
};

type PlaqueData = {
  marque: string | null;
  modele: string | null;
  numeroSerie: string | null;
  fluide: string | null;
  chargeNominaleKg: number | null;
  typeEquipement: string | null;
  confiance: "haute" | "moyenne" | "basse";
  notes: string | null;
};

/** Compte les champs critiques renseignes (marque, modele, fluide, charge). */
function countCriticalFields(p: PlaqueData): number {
  let n = 0;
  if (p.marque) n++;
  if (p.modele) n++;
  if (p.fluide) n++;
  if (p.chargeNominaleKg !== null && p.chargeNominaleKg !== undefined) n++;
  return n;
}

/** Renvoie le meilleur des 2 resultats : plus de champs critiques ET meilleure
 *  confiance. Si egalite : on prefere le 1er pass (plus fidele aux couleurs). */
function pickBestResult(a: PlaqueData, b: PlaqueData): PlaqueData {
  const aScore = countCriticalFields(a);
  const bScore = countCriticalFields(b);
  if (bScore > aScore) return b;
  if (bScore < aScore) return a;
  // Egalite sur champs critiques : on compare la confiance
  const order = { haute: 3, moyenne: 2, basse: 1 } as const;
  if (order[b.confiance] > order[a.confiance]) return b;
  return a;
}

function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/);
  if (!match) return null;
  // Normalise jpg → jpeg
  const mediaType = match[1].replace("image/jpg", "image/jpeg");
  return { mediaType, base64: match[2] };
}

type ClaudeCallResult =
  | { data: PlaqueData }
  | { error: { error: string; detail?: string; raw?: unknown; text?: string }; status: number };

async function callClaudeVision(
  apiKey: string,
  mediaType: string,
  base64: string,
  promptText: string
): Promise<ClaudeCallResult> {
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
                media_type: mediaType,
                data: base64,
              },
            },
            { type: "text", text: promptText },
          ],
        },
      ],
    }),
  });

  if (!apiRes.ok) {
    const errText = await apiRes.text();
    console.error("[vision/plaque] Claude API error:", apiRes.status, errText);
    return {
      error: { error: `Claude API ${apiRes.status}`, detail: errText.slice(0, 500) },
      status: 502,
    };
  }

  const data = await apiRes.json();
  const textContent = data?.content?.[0]?.text;
  if (typeof textContent !== "string") {
    return {
      error: { error: "Réponse Claude invalide", raw: data },
      status: 502,
    };
  }

  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      error: { error: "Pas de JSON dans la réponse Claude", text: textContent },
      status: 502,
    };
  }

  let plaque: PlaqueData;
  try {
    plaque = JSON.parse(jsonMatch[0]) as PlaqueData;
  } catch {
    return {
      error: { error: "JSON Claude invalide", text: textContent },
      status: 502,
    };
  }

  return { data: plaque };
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

  // Garde-fou taille : Claude Vision limite à 5 MB par image en base64.
  const sizeBytes = (parsed.base64.length * 3) / 4;
  if (sizeBytes > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Image trop grosse (>5 MB). Réduis la résolution / qualité." },
      { status: 413 }
    );
  }

  try {
    // 1er pass sur l'image originale
    const firstPass = await callClaudeVision(apiKey, parsed.mediaType, parsed.base64,
      "Analyse cette plaque signalétique et retourne le JSON structuré.");

    if ("error" in firstPass) {
      return NextResponse.json(firstPass.error, { status: firstPass.status });
    }

    let plaque = firstPass.data;

    // Retry conditionnel : si confiance basse OU moins de 2 champs critiques
    // ET qu'on a une image pre-traitee, on fait un 2e pass.
    const isWeak =
      plaque.confiance === "basse" || countCriticalFields(plaque) < 2;
    if (isWeak && body.imagePreprocessedDataUrl) {
      const preParsed = parseDataUrl(body.imagePreprocessedDataUrl);
      if (preParsed) {
        const preSizeBytes = (preParsed.base64.length * 3) / 4;
        if (preSizeBytes <= 5 * 1024 * 1024) {
          const secondPass = await callClaudeVision(
            apiKey,
            preParsed.mediaType,
            preParsed.base64,
            "Cette plaque est difficile à lire (rayée, sale ou faible contraste). L'image a été pré-traitée en niveaux de gris avec contraste augmenté. Lis caractère par caractère, utilise le contexte pour résoudre les ambiguïtés, et retourne le JSON structuré."
          );
          if (!("error" in secondPass)) {
            plaque = pickBestResult(plaque, secondPass.data);
          }
        }
      }
    }

    // Enrichissement du catalogue partagé en background (silent fail).
    // Conditions : on a au moins marque + modèle (sinon la clé naturelle
    // est impossible à construire), et la confiance n'est pas "basse"
    // (évite la pollution du catalogue avec des extractions douteuses).
    if (plaque.marque && plaque.modele && plaque.confiance !== "basse") {
      // Fire-and-forget : pas de await pour ne pas ralentir la réponse au
      // client. Si l'upsert échoue (RLS, réseau), on log juste côté serveur.
      const proto = req.headers.get("x-forwarded-proto") || "https";
      const host = req.headers.get("host");
      const cookie = req.headers.get("cookie") || "";
      if (host) {
        fetch(`${proto}://${host}/api/catalog/upsert`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            // Propage les cookies pour que l'auth Supabase fonctionne
            // côté upsert (qui exige un user authentifié).
            cookie,
          },
          body: JSON.stringify({
            marque: plaque.marque,
            modele: plaque.modele,
            fluideCode: plaque.fluide,
            fluideLabel: plaque.fluide,
            fluideGwp: null,
            chargeNominaleKg: plaque.chargeNominaleKg,
            typeEquipement: plaque.typeEquipement,
          }),
        }).catch((e) => {
          console.warn("[vision/plaque] catalog upsert failed:", e);
        });
      }
    }

    return NextResponse.json(plaque, { status: 200 });
  } catch (err) {
    console.error("[vision/plaque] exception:", err);
    return NextResponse.json(
      {
        error: "Échec analyse vision",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
