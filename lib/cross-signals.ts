// Moteur de croisement signal local × memoire collective Vertxia.
//
// Probleme adressee : sur la fiche /eq/[id], la maintenance predictive
// (signaux locaux) et la memoire collective (pannes connues sur le meme
// modele chez tous les techniciens Vertxia) sont silotees. Elles ne se
// parlent jamais.
//
// Objectif : generer 1-3 recommandations hybrides qui croisent les deux
// vues. Exemple : "tu interviens sur le compresseur (signal local),
// mais le detendeur est aussi un point chaud connu sur ce modele
// (15 cas confreres). Pendant que tu y es, jette-y un oeil."
//
// Differenciation pure vs concurrence F.I360° : on n'a pas de catalogue
// statique de pannes, on a une memoire collective vivante + une IA qui
// te dit ce que tes confreres ont deja vu.

import type { SignalPredictif, SignalGravite } from "@/lib/predictive-maintenance";

/** Une panne agregee venant du catalogue partage (shared_failure_catalog).
 *  Meme shape que dans PannesConnuesCard / lookup endpoint. */
export type PanneConnue = {
  typePanne: string;
  localisation: string;
  nombreOccurrences: number;
  lastSeenAt: string;
};

export type CrossSignalType =
  /** Le signal local est confirme par la memoire collective : c'est un
   *  point chaud connu, pas un cas isole. */
  | "confirmation_point_chaud"
  /** Pas de signal local sur ce composant mais des cas connus en collectif.
   *  Recommandation preventive "pendant que tu y es". */
  | "vigilance_preventive"
  /** Equipement sans signal local actif mais modele avec historique
   *  collectif fort. Verification suggeree. */
  | "modele_historique_charge";

export type CrossSignal = {
  id: string;
  type: CrossSignalType;
  titre: string;
  /** Phrase factuelle qui explique le croisement avec chiffres. */
  description: string;
  /** Action concrete a faire pendant l'intervention. */
  actionRecommandee: string;
  gravite: SignalGravite;
  /** Pour traca/explicabilite : combien de cas confreres ont contribue. */
  occurrencesCollectives: number;
};

const TYPE_PANNE_LABELS_FR: Record<string, string> = {
  fuite: "fuite",
  panne_compresseur: "panne compresseur",
  encrassement: "encrassement",
  defaut_ventilateur: "defaut ventilateur",
  givrage_excessif: "givrage excessif",
  bruit_anormal: "bruit anormal",
  autre: "panne",
};

const TYPE_PANNE_VERIFIER_ACTION: Record<string, string> = {
  fuite: "Verifier l'etancheite (azote + savon, detecteur electronique) sur ce composant pendant que tu es dessus.",
  panne_compresseur: "Controler les heures de fonctionnement et les parametres compresseur (Ronflement, conso, temperature carter).",
  encrassement: "Nettoyer condenseur + evaporateur pendant cette visite — gain de COP + previens la panne.",
  defaut_ventilateur: "Tester les ventilateurs (vitesse, vibration, bruit) — defaut commun sur ce modele.",
  givrage_excessif: "Verifier degivrage, sondes et debits d'air. Pattern commun sur ce modele.",
  bruit_anormal: "Ecouter le compresseur en regime — bruit anormal = panne en approche.",
  autre: "Faire un controle visuel complet pendant cette visite.",
};

/**
 * Determine si un signal predictif local concerne une categorie de panne
 * collective donnee. Mapping conservateur : on ne croise que ce qui est
 * vraiment evident pour eviter les faux positifs.
 */
function signalCorrespondAUneCategorie(
  signal: SignalPredictif,
  categorie: string
): boolean {
  const id = signal.id.toLowerCase();
  const titre = signal.titre.toLowerCase();

  if (categorie === "fuite") {
    return (
      id.includes("fuite") ||
      id.includes("charge-cumulee") ||
      id.includes("tendance") ||
      titre.includes("fuite")
    );
  }
  if (categorie === "panne_compresseur") {
    return titre.includes("compresseur") || titre.includes("compressor");
  }
  if (categorie === "encrassement") {
    return titre.includes("encrassement") || titre.includes("encrass");
  }
  if (categorie === "defaut_ventilateur") {
    return titre.includes("ventilateur") || titre.includes("ventilo");
  }
  if (categorie === "givrage_excessif") {
    return titre.includes("givrage") || titre.includes("givre");
  }
  if (categorie === "bruit_anormal") {
    return titre.includes("bruit");
  }
  return false;
}

/**
 * Agrege les pannes collectives par typePanne, en gardant la localisation
 * la plus frequente comme representative.
 */
function agregerParType(pannes: PanneConnue[]): Map<
  string,
  { occurrences: number; localisationPrincipale: string }
> {
  const map = new Map<string, { occurrences: number; localisations: Map<string, number> }>();
  for (const p of pannes) {
    const bucket = map.get(p.typePanne) ?? { occurrences: 0, localisations: new Map() };
    bucket.occurrences += p.nombreOccurrences;
    bucket.localisations.set(
      p.localisation,
      (bucket.localisations.get(p.localisation) ?? 0) + p.nombreOccurrences
    );
    map.set(p.typePanne, bucket);
  }
  // Replace map of localisations par la principale
  const out = new Map<string, { occurrences: number; localisationPrincipale: string }>();
  for (const [k, v] of map.entries()) {
    const principale = Array.from(v.localisations.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] ?? "";
    out.set(k, { occurrences: v.occurrences, localisationPrincipale: principale });
  }
  return out;
}

/**
 * Genere les signaux croises a afficher sur la fiche /eq/[id].
 *
 * Regles :
 * 1. Si un signal local a une correspondance collective forte (≥3 cas) →
 *    "confirmation_point_chaud" (rassure le pro : ce qu'il voit est
 *    coherent avec ce que ses confreres ont vu).
 * 2. Pour chaque categorie collective ≥3 cas qui n'a PAS de signal local
 *    correspondant → "vigilance_preventive" (suggere une verif additionnelle
 *    pendant qu'il est sur place).
 * 3. Si AUCUN signal local mais qu'il y a ≥10 cas collectifs cumules sur ce
 *    modele → "modele_historique_charge" (recommandation generale).
 *
 * Max 3 cross signals affiches (anti-bruit).
 */
export function computeCrossSignals(
  predictiveSignals: SignalPredictif[],
  pannesConnues: PanneConnue[]
): CrossSignal[] {
  if (pannesConnues.length === 0) return [];

  const agregees = agregerParType(pannesConnues);
  const totalCollectif = pannesConnues.reduce(
    (s, p) => s + p.nombreOccurrences,
    0
  );
  const out: CrossSignal[] = [];

  // Regle 1 : confirmation point chaud
  for (const sig of predictiveSignals) {
    for (const [categorie, agg] of agregees.entries()) {
      if (agg.occurrences < 3) continue;
      if (signalCorrespondAUneCategorie(sig, categorie)) {
        const labelCat = TYPE_PANNE_LABELS_FR[categorie] ?? categorie;
        out.push({
          id: `confirm-${sig.id}-${categorie}`,
          type: "confirmation_point_chaud",
          titre: `Point chaud confirme : ${labelCat}`,
          description: `Vertxia confirme : ${agg.occurrences} cas de ${labelCat} enregistres sur ce modele${agg.localisationPrincipale ? ` (souvent ${agg.localisationPrincipale})` : ""}. Ton diagnostic est coherent avec ce que les confreres ont vu.`,
          actionRecommandee: `Tu peux avancer sereinement sur la reparation. Documente ton intervention precisement : ton retour va enrichir le catalogue pour les confreres qui croiseront ce modele.`,
          gravite: sig.gravite,
          occurrencesCollectives: agg.occurrences,
        });
        break; // un seul confirm par signal
      }
    }
  }

  // Regle 2 : vigilance preventive sur categories non couvertes par les signaux locaux
  for (const [categorie, agg] of agregees.entries()) {
    if (agg.occurrences < 3) continue;
    const dejaConfirmee = predictiveSignals.some((s) =>
      signalCorrespondAUneCategorie(s, categorie)
    );
    if (dejaConfirmee) continue;

    const labelCat = TYPE_PANNE_LABELS_FR[categorie] ?? categorie;
    const action =
      TYPE_PANNE_VERIFIER_ACTION[categorie] ??
      "Faire un controle visuel ciblé sur ce composant pendant la visite.";
    const gravite: SignalGravite =
      agg.occurrences >= 10 ? "alerte" : "surveillance";

    out.push({
      id: `vigilance-${categorie}`,
      type: "vigilance_preventive",
      titre: `Verifier aussi : ${labelCat}`,
      description: `${agg.occurrences} cas confreres sur ce modele${agg.localisationPrincipale ? ` — souvent ${agg.localisationPrincipale}` : ""}. Tu n'as pas de signal actif chez toi mais c'est un point chaud connu du modele.`,
      actionRecommandee: action,
      gravite,
      occurrencesCollectives: agg.occurrences,
    });
  }

  // Regle 3 : modele a historique charge mais aucun signal local
  if (predictiveSignals.length === 0 && totalCollectif >= 10 && out.length === 0) {
    out.push({
      id: "modele-historique-charge",
      type: "modele_historique_charge",
      titre: "Modele a historique charge",
      description: `${totalCollectif} pannes confreres enregistrees sur ce modele. Equipement actuellement sans signal actif chez toi, mais surveille les points chauds (cf. carte memoire collective).`,
      actionRecommandee:
        "Profite de cette intervention pour faire un controle visuel large : compresseur, detendeur, ventilateurs, etancheite raccords.",
      gravite: "surveillance",
      occurrencesCollectives: totalCollectif,
    });
  }

  // Tri : critique > alerte > surveillance. Confirmation prime sur vigilance
  // a gravite egale.
  const gravOrder: Record<SignalGravite, number> = {
    critique: 0,
    alerte: 1,
    surveillance: 2,
  };
  const typeOrder: Record<CrossSignalType, number> = {
    confirmation_point_chaud: 0,
    vigilance_preventive: 1,
    modele_historique_charge: 2,
  };
  out.sort((a, b) => {
    const g = gravOrder[a.gravite] - gravOrder[b.gravite];
    if (g !== 0) return g;
    return typeOrder[a.type] - typeOrder[b.type];
  });

  return out.slice(0, 3);
}
