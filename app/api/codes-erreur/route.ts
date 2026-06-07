// API recherche dans la base de codes erreur HVAC multi-marques.
//
// GET /api/codes-erreur?q=U4
//   → recherche cascade (exact → prefix → contains → fuzzy)
//
// GET /api/codes-erreur?marque=daikin&q=U
//   → meme recherche mais filtree sur une marque
//
// GET /api/codes-erreur?marque=daikin&code=U4
//   → lookup direct precis (deep-link)
//
// GET /api/codes-erreur (sans param)
//   → renvoie les stats (total + count par marque)
//
// Pas d'auth requise — base statique cote serveur, aucun risque RGPD ni cout.

import { NextResponse } from "next/server";
import {
  findCodeErreur,
  getCodesErreurStats,
  searchCodesErreur,
} from "@/lib/codes-erreur/search";
import type { CodeErreurGravite, CodeErreurMarque } from "@/lib/codes-erreur/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_MARQUES: CodeErreurMarque[] = [
  "daikin",
  "mitsubishi",
  "carrier",
  "trane",
  "lg",
  "samsung",
  "toshiba",
  "hitachi",
  "panasonic",
  "atlantic",
  "saunier-duval",
  "vaillant",
  "de-dietrich",
  "elm-leblanc",
  "frisquet",
  "mitsubishi-heavy",
  "fujitsu",
  "bosch",
  "chaffoteaux",
  "stiebel-eltron",
  "aldes",
  "unelvent",
  "zehnder",
  "lennox",
  "york",
  "aermec",
  "haier",
  "sanyo",
];

const VALID_GRAVITES: CodeErreurGravite[] = ["info", "alerte", "critique"];

function isValidMarque(v: string | null): v is CodeErreurMarque {
  return v !== null && (VALID_MARQUES as string[]).includes(v);
}

function isValidGravite(v: string | null): v is CodeErreurGravite {
  return v !== null && (VALID_GRAVITES as string[]).includes(v);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const marqueParam = url.searchParams.get("marque");
  const graviteParam = url.searchParams.get("gravite");
  const codeParam = url.searchParams.get("code");
  const modeleParam = url.searchParams.get("modele");
  const limitParam = url.searchParams.get("limit");

  const marque = isValidMarque(marqueParam) ? marqueParam : undefined;
  const gravite = isValidGravite(graviteParam) ? graviteParam : undefined;
  const modele = modeleParam && modeleParam.trim().length > 0 ? modeleParam.trim().slice(0, 60) : undefined;
  const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 30)) : 30;

  // Cas 1 : lookup direct precis (deep-link)
  if (marque && codeParam) {
    const code = findCodeErreur(marque, codeParam);
    if (!code) {
      return NextResponse.json({ found: false, code: null }, { status: 404 });
    }
    return NextResponse.json({ found: true, code });
  }

  // Cas 2 : stats si aucun param de recherche
  if (q.length === 0 && !marque && !gravite && !modele) {
    return NextResponse.json({ stats: getCodesErreurStats() });
  }

  // Cas 3 : recherche
  const hits = searchCodesErreur(q, { marque, gravite, modele, limit });
  return NextResponse.json({ hits, count: hits.length, modele: modele ?? null });
}
