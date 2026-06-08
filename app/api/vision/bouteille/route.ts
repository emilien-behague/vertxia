import { NextResponse } from "next/server";
import { parseGS1Barcode, type ParsedBarcodeResult } from "@/lib/equipement/gs1-parser";

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
//  - Post-traitement parser GS1 : si le codeBarre est un GTIN-14 valide MOD10,
//    on extrait lot/serial/date/poids automatiquement (gain 20-30% scans).
//    Si c'est un code proprietaire (Linde Sentry, SERVITRAX), on tente une
//    extraction heuristique date YYMMDD + serial.

export const runtime = "nodejs";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-7";

const SYSTEM_PROMPT = `Tu es un assistant specialise dans la lecture d'etiquettes de bouteilles de fluide frigorigene (HFC, HFO, propane, melange) utilisees en F-Gas.

Une bouteille typique contient PLUSIEURS sources d'info a exploiter SIMULTANEMENT :
1. Un CODE-BARRES (souvent Code-128 GS1 type GTIN-14, 13-14 chiffres) sur un sticker fournisseur (Linde, Climalife, Tereva, Air Liquide, Westfalen, Messer).
2. La COULEUR de la bouteille elle-meme (= code couleur ISO 32 / norme metier) :
   - Bouteille VERTE Linde (Refrigerants) = recharge fluide neuf (R-32 souvent, parfois R-410A / R-454B selon etiquette)
   - Bouteille ROUGE / ORANGE Linde = recuperation (bouteille pour recuperer fluide use)
   - Bouteille GRISE / NOIRE = melange ou dechet
   - Bouteille ROSE Linde = R-410A (code couleur specifique)
   - Code couleur fluide AHRI : R-32 = bleu ciel, R-410A = rose, R-134a = bleu fonce, R-290 = orange (mais variable selon fabricant)
3. La marque / FOURNISSEUR visible (logo Linde, etiquette Climalife, sticker Tereva…)
4. Le FLUIDE imprime en gros sur l'etiquette principale (R-32, R-410A, R-134a, R-1234yf, R-407C, R-449A, R-404A, R-290, R-454B, R-22, ou "melange").
5. Le NUMERO DE SERIE grave en relief sur le col en metal acier (often 8-12 chars alphanumeriques, different du code-barres : c'est l'ID ESP transportable obligatoire au registre).
6. Une CAPACITE en kg (charge nominale fluide, ex: 10 kg, 12 kg, 27 kg) — souvent imprimee sur l'etiquette laterale.
7. Une TARE en kg (poids a vide) — gravee sur le col ou imprimee sur l'etiquette (label "T" ou "TARE" en gros).
8. Un TYPE : recharge (bouteille neuve fluide) ou recuperation (couleur rouge + mention "RECOVERY" ou "RECUPERATION").

Tu DOIS retourner UNIQUEMENT un objet JSON valide, sans markdown, sans commentaire, avec exactement ces champs (utilise null si une info n'est PAS visible OU PAS deductible) :

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

Regles d'extraction :
- codeBarre = la suite EXACTE de chiffres / chiffres-lettres lisible sous le code-barres lui-meme. Pas le numero de serie grave.
- Si tu lis "R32" sans tiret, retourne "R-32". Idem R410A -> R-410A, R134A -> R-134a, etc.
- Si la bouteille est rouge / orange et porte "RECUPERATION" / "RECOVERY" / "Retour" : type = "recuperation". Sinon recharge.
- Les bouteilles "melange" / "MIX" / "DECHET" / "WASTE" : fluide = "melange".
- "confiance" = "haute" si tous les champs critiques (codeBarre + fluide + capacite) sont lisibles ; "moyenne" si certains incertains ou inferes par couleur ; "basse" si tu devines beaucoup.

INFERENCE INTELLIGENTE QUAND TEXTE PARTIEL :
- Si tu vois une bouteille Linde verte SANS texte fluide visible : retourne fluide = null SAUF si autres indices visuels (etiquette adhesive couleur, marquage frontale) — ne devine pas R-32 juste parce que la majorite des Linde vertes le sont.
- Si tu vois une bouteille avec sticker rouge / orange mais sans texte "RECUPERATION" : type = "recuperation" probable (note "infere par couleur").
- Si tu vois le code-barres + une zone "kg" non lisible : retourne capaciteMaxKg = null, NE devine PAS la valeur.
- Si la photo est UN GROS PLAN sur le sticker code-barres uniquement (etiquette principale + col de bouteille pas visibles) : retourne fluide / capacite / tare / numeroSerie = null ET ECRIT EXPLICITEMENT dans "notes" : "Photo trop centree sur le sticker code-barres. Pour pre-remplir fluide / capacite / tare, prends une photo qui montre toute la bouteille (corps + etiquette principale + col)."

STRATEGIES POUR PHOTOS DIFFICILES :
- Lis chaque ZONE de l'image (sticker code-barres, etiquette principale, col metal grave, base) independamment puis croise les indices.
- Si l'angle est oblique, lis les chiffres par groupes en suivant la courbure.
- Si l'eclairage est mauvais (sombre / reflet), insiste sur les zones a contraste fort.
- Si tu ne vois PAS de code-barres mais l'image est bien une bouteille : codeBarre = null, remplis les autres champs visibles.
- Si l'image n'est pas une bouteille : tous champs null + confiance "basse" + explique dans "notes".`;

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

/** Reponse enrichie envoyee au client :
 *   - data Vision Claude
 *   - gs1Decoded : parser GS1 applique sur codeBarre (si present)
 *   - nombreScansPartage : nb de pros qui ont deja scanne cette bouteille
 *     (effet reseau memoire collective). 0 = premiere fois vue dans Vertxia. */
type BouteilleVisionResponse = BouteilleVisionData & {
  gs1Decoded: ParsedBarcodeResult | null;
  nombreScansPartage: number;
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

    // Post-traitement parser GS1 : si Claude a detecte un codeBarre, on tente
    // de le decoder selon les standards GS1. 3 cas :
    //  - gs1-standard (GTIN-14 valide MOD10) : on extrait lot, serial, poids,
    //    date d'expiration AUTO. C'est ~20-30% des bouteilles industrielles.
    //  - gs1-sscc : container shipping code (rare sur bouteilles unitaires)
    //  - proprietary : code Linde Sentry / Air Liquide SERVITRAX. On tente
    //    une heuristique date YYMMDD pour deduire la date d'embouteillage.
    //    Si succes -> dateProbableISO peut servir comme dateAchat fallback.
    let gs1Decoded: ParsedBarcodeResult | null = null;
    if (bouteille.codeBarre) {
      try {
        gs1Decoded = parseGS1Barcode(bouteille.codeBarre);
      } catch (e) {
        console.warn("[vision/bouteille] GS1 parser threw:", e);
      }
    }

    // Mémoire collective : si on a un codeBarre, on cherche dans le catalogue
    // partagé. Si trouvé, on enrichit/complète les champs Claude avec les
    // valeurs validées par d'autres pros Vertxia. Effet réseau Bluon-style.
    let bouteilleEnriched = bouteille;
    let nombreScansPartage = 0;
    if (bouteille.codeBarre) {
      try {
        const proto = req.headers.get("x-forwarded-proto") || "https";
        const host = req.headers.get("host");
        const cookie = req.headers.get("cookie") || "";
        if (host) {
          const lookupRes = await fetch(
            `${proto}://${host}/api/catalog/bouteille/lookup?code=${encodeURIComponent(bouteille.codeBarre)}`,
            { method: "GET", headers: { cookie } }
          );
          if (lookupRes.ok) {
            const lookup = await lookupRes.json();
            if (lookup.found && lookup.fiche) {
              nombreScansPartage = lookup.fiche.nombreScans || 0;
              // Merge intelligent : Claude OCR live PRIME sur la base partagée
              // (chaque scan peut révéler des évolutions), MAIS la base partagée
              // COMPLÈTE les champs Claude null/manquants.
              bouteilleEnriched = {
                ...bouteille,
                marque: bouteille.marque ?? lookup.fiche.marque ?? null,
                fluide: bouteille.fluide ?? lookup.fiche.fluideCode ?? null,
                capaciteMaxKg:
                  bouteille.capaciteMaxKg ?? lookup.fiche.capaciteMaxKg ?? null,
                tareKg: bouteille.tareKg ?? lookup.fiche.tareKg ?? null,
                type: bouteille.type ?? lookup.fiche.typeBouteille ?? null,
              };
            }
          }
        }
      } catch (e) {
        // Lookup échoué → on continue avec les données Claude seules.
        // Pas critique : la base partagée est un BONUS, pas obligatoire.
        console.warn("[vision/bouteille] catalog lookup failed:", e);
      }
    }

    const response: BouteilleVisionResponse = {
      ...bouteilleEnriched,
      gs1Decoded,
      nombreScansPartage,
    };
    return NextResponse.json(response, { status: 200 });
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
