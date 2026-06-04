// Diagnostic visuel IA d'un composant frigorifique via Claude vision.
// Le technicien prend une photo d'un compresseur, échangeur, raccord brasure,
// évaporateur, etc. → on retourne identification du composant + défauts
// détectés (corrosion, traces huile, givre anormal, encrassement…) + cause
// probable + action recommandée + estimation devis.
//
// Modèle : claude-opus-4-7 (cohérent avec /api/vision/plaque et /registre).
// Limite : 5 MB par image (résolution max ~2000px conseillée côté client).

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-7";
const MAX_BYTES = 5 * 1024 * 1024;

const SYSTEM_PROMPT = `Tu es un expert technicien F-Gas et thermicien avec 25 ans de terrain (résidentiel, tertiaire, commercial agroalimentaire, PAC). Le technicien te présente une photo d'un composant ou d'une zone de son installation. Ton job : identifier le composant + détecter les défauts visuels + diagnostiquer la cause + recommander une action + estimer un devis range réaliste.

Tu DOIS retourner UNIQUEMENT un objet JSON valide (pas de markdown, pas de \`\`\`, pas de commentaire) avec ce schéma EXACT :

{
  "composantIdentifie": string | null,
  "defautsDetectes": [
    {
      "nom": string,
      "description": string,
      "gravite": "info" | "surveiller" | "urgent" | "critique"
    }
  ],
  "causeProbable": string,
  "actionRecommandee": string,
  "devisEstimeMin": number | null,
  "devisEstimeMax": number | null,
  "delaiIntervention": "preventif" | "1-3 mois" | "1 mois" | "urgent",
  "confiance": "haute" | "moyenne" | "basse",
  "notesContexte": string | null
}

RÈGLES STRICTES :

1. COMPOSANT IDENTIFIÉ : sois précis. Ex : "Compresseur scroll hermétique" / "Raccord brasure cuivre côté aspiration" / "Échangeur à plaques brasées" / "Évaporateur à ailettes (split mural)" / "Détendeur thermostatique" / "Bouteille séparatrice d'huile" / "Vanne 4 voies inversion de cycle" / "Filtre déshydrateur cyclonique" / "Manomètre HP" / "Tuyauterie cuivre calorifugée". Si non identifiable avec ≥75% de certitude → null.

2. DÉFAUTS DÉTECTÉS : liste TOUS les défauts visibles, classés du plus grave au moins grave. Vide [] si aucun défaut détecté (état nominal). Pour chaque défaut :
   - nom : court (3-6 mots) ex : "Corrosion galvanique avancée", "Traces d'huile sur raccord", "Givre anormal côté aspiration", "Calorifuge décomposé", "Soudure défectueuse", "Encrassement condenseur sévère", "Fuite suspectée"
   - description : 1 phrase précise sur ce qu'on voit (où, ampleur, type)
   - gravite :
     * "info" = remarque cosmétique, pas d'impact technique
     * "surveiller" = défaut naissant, à reverify dans 3-6 mois
     * "urgent" = doit être traité dans le mois sinon risque panne / perte fluide
     * "critique" = risque immédiat (fuite active, court-circuit thermique, défaillance compresseur imminente, danger sécurité)

3. CAUSE PROBABLE : hypothèse technique la plus probable des défauts détectés. Cite la cause racine, pas juste le symptôme. Ex : "Condensats stagnants en zone froide + pile galvanique entre cuivre et aluminium" / "Fuite de fluide frigorigène par micro-fissure de brasure sous l'effet vibratoire" / "Manque de maintenance préventive : pas de nettoyage condenseur sur > 2 ans" / "Sous-dimensionnement du condenseur pour la charge thermique". Si plusieurs causes possibles équivalentes, mentionne les 2-3 principales.

4. ACTION RECOMMANDÉE : DIRECTIVE concrète et actionnable pour le technicien. Pas de "il faudrait peut-être". Format : verbe d'action + objet + spec technique. Ex : "Nettoyer chimiquement le condenseur (produit alcalin type Trex Clean) + traiter les ailettes anti-corrosion" / "Brasurer joint d'étanchéité, contrôler 24h à l'azote 25 bars, mise sous vide triple <500 microns, recharger fluide" / "Remplacer le calorifuge sur 1m + appliquer anti-condensation". Si critique → première phrase = "ARRÊTER l'installation, [action]".

5. DEVIS ESTIMÉ (en EUROS HT, fourchette terrain typique 2026 FR) :
   - Action low (juste contrôle/observation) → null pour les 2 champs
   - Petit fix (nettoyage, joint, calorifuge) → 80 à 350
   - Intervention moyenne (réparation brasure + recharge, remplacement filtre/détendeur) → 250 à 900
   - Remplacement composant lourd (compresseur, échangeur, condenseur) → 1200 à 5000+
   - Réfection majeure (retrofit fluide, refonte circuit) → 3000 à 15000
   Sois honnête : si tu ne peux pas estimer (manque d'info sur taille install/marque) → null + null.

6. DÉLAI INTERVENTION :
   - "preventif" = recommandation à programmer au prochain contrôle annuel
   - "1-3 mois" = défaut naissant, programmer dans le trimestre
   - "1 mois" = défaut sérieux, programmer dans le mois
   - "urgent" = sous 7 jours OU immédiat si critique (alors écris-le dans actionRecommandee)

7. CONFIANCE :
   - "haute" : photo nette, composant clairement identifiable, défauts non ambigus
   - "moyenne" : composant identifié mais 1-2 défauts ambigus (peut être autre chose)
   - "basse" : photo floue, mal cadrée, ou composant atypique non-identifiable

8. NOTES CONTEXTE : signale tout biais possible. Ex : "Photo prise en zone très humide, la corrosion pourrait être plus locale qu'elle ne paraît" / "Cadrage trop large pour confirmer le diagnostic, prendre une photo gros plan du raccord X". Sinon null.

CONTRAINTES :
- Ne JAMAIS recommander une opération illégale (recharge R-22 vierge, manipulation sans attestation cat appropriée, etc.).
- Ne JAMAIS sortir du JSON. Pas de texte avant/après.
- Si la photo ne montre PAS un composant frigorifique/climatique/PAC (ex : photo d'une personne, paysage, document texte) → composantIdentifie=null, defautsDetectes=[], causeProbable="Image non liée à un composant frigorifique. Reprends une photo du composant à diagnostiquer.", actionRecommandee="Reprendre la photo", confiance="basse".
- Ton diagnostic est UNE AIDE — la responsabilité reste celle du technicien qui interviendra.`;

type RequestBody = {
  /** Data URL base64 de l'image (image/jpeg ou image/png) */
  imageDataUrl: string;
  /** Note libre optionnelle du technicien pour préciser le contexte (ex: "compresseur fait du bruit depuis 2 jours") */
  contexteNote?: string;
  /** Memoire contextuelle pre-calculee cote client : interventions/diagnostics
   *  similaires deja vus par ce pro. Injecte dans le user message pour enrichir
   *  l'analyse (cite explicitement les defauts deja vus, identifie patterns
   *  recurrents). Optionnel — si absent ou vide, comportement V1 inchange. */
  historiqueContexte?: string;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
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

  const { imageDataUrl, contexteNote, historiqueContexte } = body;
  if (!imageDataUrl?.startsWith("data:image/")) {
    return badRequest("imageDataUrl manquante ou format invalide (attendu : data:image/...)");
  }

  // Parse data URL
  const match = imageDataUrl.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
  if (!match) {
    return badRequest("Format image non supporté (jpeg, png ou webp uniquement)");
  }
  const mediaType = match[1] as "image/jpeg" | "image/png" | "image/webp";
  const base64Data = match[3];

  // Vérif taille
  const sizeBytes = Math.ceil((base64Data.length * 3) / 4);
  if (sizeBytes > MAX_BYTES) {
    return badRequest(`Image trop lourde (${(sizeBytes / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return serverError("ANTHROPIC_API_KEY manquant côté serveur");
  }

  // Construction du user message en 3 blocs concatenes :
  //  1. Memoire contextuelle (interventions/diagnostics passes du pro) si presente
  //  2. Contexte note du pro sur la situation actuelle si presente
  //  3. Instruction d'analyse + format de sortie
  // L'ordre compte : le LLM commence par "lire" l'historique pour aborder la
  // photo avec ce contexte deja en tete.
  const userTextParts: string[] = [];
  if (historiqueContexte?.trim()) {
    userTextParts.push(
      `## Memoire contextuelle de ce pro (utiliser pour affiner le diagnostic)
${historiqueContexte.trim()}`
    );
  }
  if (contexteNote?.trim()) {
    userTextParts.push(`Contexte du technicien pour cette photo : "${contexteNote.trim()}".`);
  }
  userTextParts.push("Analyse cette photo prise par un technicien. Retourne le diagnostic JSON.");
  const userText = userTextParts.join("\n\n");

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
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
              { type: "text", text: userText },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return serverError(`API Anthropic HTTP ${res.status}`, errText.slice(0, 500));
    }

    const json = await res.json();
    const textBlock = json?.content?.find?.((b: { type: string }) => b.type === "text");
    const rawText: string = textBlock?.text || "";

    // Nettoie : retire éventuels ```json ``` qui pourraient s'être glissés
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return serverError("Réponse Claude non parseable en JSON", cleaned.slice(0, 500));
    }

    return NextResponse.json({
      ...(parsed as Record<string, unknown>),
      model: MODEL,
    });
  } catch (e) {
    return serverError(
      "Échec appel Claude vision",
      e instanceof Error ? e.message : String(e)
    );
  }
}
