// Extraction batch d'équipements depuis une PAGE de registre papier (tableau,
// liste, fiches archivées) via Claude vision. Le technicien prend chaque page
// en photo, on extrait TOUS les équipements visibles → import bulk dans le parc.
//
// Modèle utilisé : claude-opus-4-7 (cohérent avec /api/vision/plaque, meilleur
// que Haiku/Sonnet pour les tables manuscrites / scans de qualité variable).
//
// Le frontend (app/m/import-registre/page.tsx) attend ce JSON exact :
//   { equipements: PlaqueExtraction[], pageInfo?: string, confiance: ... }

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-7";

const SYSTEM_PROMPT = `Tu es un expert technicien F-Gas qui lit les registres papier (carnets d'installations, tableaux Excel imprimés, fiches archivées) des techniciens et installateurs PAC. Ton job : extraire CHAQUE équipement visible sur la page photographiée.

Une page de registre contient typiquement plusieurs lignes/colonnes/blocs, chacun représentant un équipement chez un client. Format manuscrit, dactylographié, ou tableau imprimé.

Tu DOIS retourner UNIQUEMENT un objet JSON valide (pas de markdown, pas de commentaire, pas de \`\`\`) avec ce schéma :

{
  "equipements": [
    {
      "clientName": string | null,
      "siteAdresse": string | null,
      "marque": string | null,
      "modele": string | null,
      "numeroSerie": string | null,
      "fluide": "R-32" | "R-410A" | "R-407C" | "R-134a" | "R-404A" | "R-22" | "R-1234yf" | "R-1234ze" | "R-290" | "R-744" | "R-449A" | null,
      "chargeNominaleKg": number | null,
      "dernierControle": string | null,
      "notes": string | null
    }
  ],
  "pageInfo": string | null,
  "confiance": "haute" | "moyenne" | "basse"
}

RÈGLES STRICTES :

1. UN ÉQUIPEMENT = UNE ENTRÉE dans \`equipements\`. Si la page liste 12 installations, retourne 12 entrées. NE PAS regrouper, NE PAS dédupliquer (le frontend gérera).

2. Chaque champ → null si absent / illisible / pas sûr à ≥75%. Ne JAMAIS inventer.

3. CLIENT NAME : nom du particulier ("Martin Dupont") ou raison sociale ("Hôtel Le Provençal", "Boulangerie Martin", "Carrefour Toulon"). Garde la capitalisation du papier.

4. SITE ADRESSE : adresse complète si lisible ("14 av République, 83000 Toulon"). Si juste ville → ville seule. Si juste "chez le client X" → null.

5. MARQUE : Daikin, Mitsubishi, Mitsubishi Electric, Toshiba, Panasonic, Hitachi, Atlantic, Airwell, Carrier, Trane, Bosch, Viessmann, De Dietrich, Ariston, Thermor, Copeland, Bitzer, Danfoss, CIAT, Aermec, General, Kelvion, etc. Capitalisation propre.

6. MODELE : référence commerciale exacte (RWEYQ16T7Y1B, PUHZ-ZRP125YKA, ALFEA EXTENSA AI DUO 8). Garde formatage exact.

7. NUMERO DE SERIE : alphanumérique unique. Souvent sous "S/N", "N° série", "Fab.", "Nr". NE PAS confondre avec n° de modèle.

8. FLUIDE : mapping strict R32→R-32, R410A→R-410A, R407C→R-407C, R134A→R-134a, R404A→R-404A, R22→R-22, R1234yf→R-1234yf, R1234ze→R-1234ze, R290 ou propane→R-290, R744 ou CO2→R-744, R449A→R-449A. Sinon null.

9. CHARGE NOMINALE EN KILOGRAMMES :
   - "16 kg" ou "16 kilos" → 16
   - "850 g" ou "850 grammes" → 0.85
   - "2,5 kg" → 2.5
   - Si plage : prends la valeur nominale (souvent la plus grande)
   - NE PAS confondre avec puissance (kW), tension (V), pression (bar)

10. DERNIER CONTROLE : format YYYY-MM-DD STRICT si une date est visible (souvent colonne "Dernier contrôle", "Date contrôle étanchéité", "Visite").
    - "15/03/2025" → "2025-03-15"
    - "Mars 2025" → "2025-03-01"
    - "2025" seul → "2025-01-01"
    - Si "jamais", "neuf", absent → null

11. NOTES : info pertinente qui ne rentre dans aucun champ ("accès toit", "contrat maintenance Carrier", "n°SAV 1234"). Sinon null.

12. PAGE INFO : si la page a un titre/header ("Registre 2024", "Clients Toulon", "Page 3/8"), retourne-le. Sinon null.

13. CONFIANCE :
    - "haute" si la page est nette + tous les champs critiques (client + modèle + n°série + fluide + charge) lisibles
    - "moyenne" si 60-80% des champs critiques lisibles
    - "basse" si écriture manuscrite difficile / scan flou / colonnes pas claires

14. SI LA PHOTO N'EST PAS UN REGISTRE (photo floue, photo d'autre chose, écran noir, page blanche), retourne :
    { "equipements": [], "pageInfo": null, "confiance": "basse" }

15. INTERDICTIONS :
    - Pas de markdown, pas de \`\`\`json, pas de commentaire — JUSTE le JSON cru
    - Pas d'invention de valeurs absentes
    - Pas de dédup à ton niveau (le frontend le fait)
    - Pas plus de 30 équipements par page (si tu en vois 50+, retourne les 30 plus lisibles avec confiance="basse")`;

type RequestBody = {
  /** Data URL de l'image (data:image/jpeg;base64,...) */
  imageDataUrl: string;
};

type EquipementExtraction = {
  clientName: string | null;
  siteAdresse: string | null;
  marque: string | null;
  modele: string | null;
  numeroSerie: string | null;
  fluide: string | null;
  chargeNominaleKg: number | null;
  dernierControle: string | null;
  notes: string | null;
};

type RegistreExtraction = {
  equipements: EquipementExtraction[];
  pageInfo: string | null;
  confiance: "haute" | "moyenne" | "basse";
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB après décodage base64

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY manquante côté serveur." },
      { status: 500 }
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  if (!body.imageDataUrl || typeof body.imageDataUrl !== "string") {
    return NextResponse.json(
      { error: "imageDataUrl requis (string)" },
      { status: 400 }
    );
  }

  const match = body.imageDataUrl.match(
    /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/
  );
  if (!match) {
    return NextResponse.json(
      {
        error:
          "imageDataUrl doit être au format data:image/(jpeg|png|webp|gif);base64,...",
      },
      { status: 400 }
    );
  }
  const mediaType = match[1].replace("image/jpg", "image/jpeg");
  const base64Data = match[2];

  const decodedSize = (base64Data.length * 3) / 4;
  if (decodedSize > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      {
        error: `Image trop lourde (${Math.round(decodedSize / 1024 / 1024)}MB). Limite : 5MB par page.`,
      },
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
        // Une page peut contenir 20-30 équipements × ~200 tokens chacun
        max_tokens: 8000,
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
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: "Voici une page d'un registre papier de technicien. Extrais TOUS les équipements visibles selon le schéma. Réponds UNIQUEMENT le JSON.",
              },
            ],
          },
        ],
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error("[vision/registre] Claude API error:", apiRes.status, errText);
      return NextResponse.json(
        { error: `Claude API ${apiRes.status}`, detail: errText.slice(0, 500) },
        { status: 502 }
      );
    }

    const data = await apiRes.json();
    const textContent = data?.content?.[0]?.text;
    if (typeof textContent !== "string") {
      return NextResponse.json(
        { error: "Réponse Claude vide / invalide", raw: data },
        { status: 502 }
      );
    }

    // Claude peut préfixer/suffixer du texte malgré l'instruction.
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Pas de JSON dans la réponse Claude", text: textContent },
        { status: 502 }
      );
    }

    let extraction: RegistreExtraction;
    try {
      extraction = JSON.parse(jsonMatch[0]) as RegistreExtraction;
    } catch {
      return NextResponse.json(
        { error: "JSON Claude invalide", text: textContent },
        { status: 502 }
      );
    }

    if (!Array.isArray(extraction.equipements)) {
      return NextResponse.json(
        { error: "JSON sans champ equipements[]", text: textContent },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { ...extraction, model: MODEL },
      { status: 200 }
    );
  } catch (err) {
    console.error("[vision/registre] exception:", err);
    return NextResponse.json(
      {
        error: "Échec analyse registre",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
