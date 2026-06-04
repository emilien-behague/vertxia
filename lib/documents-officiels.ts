// Bibliothèque de documents officiels téléchargeables (CERFA, modèles, guides
// DGEC, modèles AFCE) embarqués dans Vertxia pour usage offline-first.
//
// Tous les PDF stockés dans public/docs/officiels/ ont été téléchargés depuis
// leur source primaire officielle vérifiée via WebFetch le 04/06/2026.
//
// Quand un document est mis à jour par l'autorité émettrice (ex: nouvelle
// version CERFA, MAJ FAQ DGPR), il faut :
//   1) WebFetch la nouvelle URL pour confirmer la version en vigueur
//   2) Re-télécharger le PDF dans public/docs/officiels/
//   3) Bumper le champ dateVerification ici
// Cette discipline évite de servir des versions périmées aux utilisateurs.

export type CategorieDocument =
  | "cerfa"
  | "registre_modele"
  | "guide_dgec"
  | "fluide_specifique";

export type DocumentOfficiel = {
  id: string;
  titre: string;
  description: string;
  source: string;
  sourceUrl: string;
  fichierLocal: string;
  tailleKb: number;
  categorie: CategorieDocument;
  motsClefs: string[];
  dateVerification: string;
};

export const CATEGORIE_LABELS: Record<CategorieDocument, string> = {
  cerfa: "CERFA & formulaires officiels",
  registre_modele: "Registres & modèles",
  guide_dgec: "Guides DGEC (Ministère de l'écologie)",
  fluide_specifique: "Fluides spécifiques",
};

export const DOCUMENTS_OFFICIELS: DocumentOfficiel[] = [
  {
    id: "cerfa-15497-04",
    titre: "CERFA 15497*04 — Fiche d'intervention F-Gas",
    description:
      "Formulaire officiel de fiche d'intervention pour manipulation de fluides frigorigènes. Version *04 seule conforme depuis le 01/01/2025. Signature opérateur + détenteur obligatoire.",
    source: "service-public.gouv.fr",
    sourceUrl: "https://www.formulaires.service-public.gouv.fr/gf/cerfa_15497.do",
    fichierLocal: "/docs/officiels/cerfa_15497_04_formulaire.pdf",
    tailleKb: 118,
    categorie: "cerfa",
    motsClefs: ["cerfa", "15497", "fiche intervention", "f-gas", "fluide", "manipulation"],
    dateVerification: "2026-06-04",
  },
  {
    id: "afce-registre-equipement",
    titre: "Modèle de registre d'équipement (AFCE)",
    description:
      "Modèle officiel de registre détenteur tenu pour chaque équipement >5 tCO2eq (article 7 Règl. UE 2024/573). Édité par l'Association Française du Froid. À conserver 5 ans minimum.",
    source: "afce.asso.fr",
    sourceUrl: "https://www.afce.asso.fr/wp-content/uploads/2010/08/registre_quipement.pdf",
    fichierLocal: "/docs/officiels/afce_modele_registre_equipement.pdf",
    tailleKb: 1056,
    categorie: "registre_modele",
    motsClefs: ["registre", "détenteur", "équipement", "afce", "modèle", "carnet de suivi"],
    dateVerification: "2026-06-04",
  },
  {
    id: "afce-declaration-fuite-degazage",
    titre: "Modèle de déclaration de fuite ou dégazage (AFCE)",
    description:
      "Exemple de déclaration à transmettre au préfet en cas de dégazage > 20 kg en une opération ou > 100 kg cumulés sur l'année (R543-87 Code env. modifié par décret 2024-1194).",
    source: "afce.asso.fr",
    sourceUrl: "http://www.afce.asso.fr/wp-content/uploads/2015/02/decl_degazage_fuite.pdf",
    fichierLocal: "/docs/officiels/afce_modele_declaration_fuite_degazage.pdf",
    tailleKb: 62,
    categorie: "registre_modele",
    motsClefs: ["déclaration", "fuite", "dégazage", "préfet", "afce", "modèle"],
    dateVerification: "2026-06-04",
  },
  {
    id: "dgec-note-pedagogique-f-gas-iii",
    titre: "Note pédagogique F-Gas III (Règl. UE 2024/573)",
    description:
      "Note officielle DGEC expliquant les nouvelles obligations introduites par le Règlement européen 2024/573 (F-Gas III) en vigueur depuis le 11/03/2024. Remplace le 517/2014.",
    source: "ecologie.gouv.fr (DGEC)",
    sourceUrl:
      "https://www.ecologie.gouv.fr/sites/default/files/documents/Note_pedagogique_Evolution_FGAZ_2024_573.pdf",
    fichierLocal: "/docs/officiels/dgec_note_pedagogique_f_gas_iii_2024_573.pdf",
    tailleKb: 7783,
    categorie: "guide_dgec",
    motsClefs: [
      "f-gas",
      "f-gaz",
      "2024/573",
      "réglementation",
      "europe",
      "dgec",
      "ministère",
      "obligations",
    ],
    dateVerification: "2026-06-04",
  },
  {
    id: "dgec-faq-fluides-frigorigenes",
    titre: "FAQ fluides frigorigènes (DGEC)",
    description:
      "Foire aux questions officielle du Ministère de l'écologie sur les obligations frigoriste : contrôles d'étanchéité, attestation de capacité, BSFF, retrofit, registres.",
    source: "ecologie.gouv.fr (DGEC)",
    sourceUrl: "https://www.ecologie.gouv.fr/sites/default/files/documents/FAQ%20%20vf.pdf",
    fichierLocal: "/docs/officiels/dgec_faq_fluides_frigorigenes.pdf",
    tailleKb: 577,
    categorie: "guide_dgec",
    motsClefs: ["faq", "questions", "réponses", "dgec", "ministère", "obligations", "contrôle"],
    dateVerification: "2026-06-04",
  },
  {
    id: "dgec-faq-webinaire-application-fluides",
    titre: "FAQ application fluides frigorigènes (webinaire DGEC)",
    description:
      "Compilation des questions-réponses du webinaire DGEC sur l'application réglementaire fluides frigorigènes. Couvre les cas pratiques terrain les plus fréquents.",
    source: "ecologie.gouv.fr (DGEC)",
    sourceUrl:
      "https://www.ecologie.gouv.fr/sites/default/files/documents/Questions_reponses_webinaire_application_fluides_frigorigenes.pdf",
    fichierLocal: "/docs/officiels/dgec_faq_webinaire_application_fluides.pdf",
    tailleKb: 3978,
    categorie: "guide_dgec",
    motsClefs: ["faq", "webinaire", "dgec", "application", "réglementation", "cas pratiques"],
    dateVerification: "2026-06-04",
  },
  {
    id: "dgec-recap-usages-alternatives-hfc",
    titre: "Récapitulatif des usages autorisés (alternatives aux HFC)",
    description:
      "Tableau officiel DGEC des usages autorisés pour chaque fluide alternatif aux HFC (HFO, A2L, naturels). Référence pour orienter le client lors d'un retrofit ou remplacement.",
    source: "ecologie.gouv.fr (DGEC)",
    sourceUrl:
      "https://www.ecologie.gouv.fr/sites/default/files/documents/Récapitulatif%20des%20usages%20autorisés%20pour%20les%20alternatives%20aux%20HFC.pdf",
    fichierLocal: "/docs/officiels/dgec_recap_usages_alternatives_hfc.pdf",
    tailleKb: 60,
    categorie: "fluide_specifique",
    motsClefs: [
      "hfc",
      "hfo",
      "alternatives",
      "retrofit",
      "phase-out",
      "a2l",
      "r-454",
      "r-32",
      "naturels",
    ],
    dateVerification: "2026-06-04",
  },
];

export function formatTailleFichier(tailleKb: number): string {
  if (tailleKb < 1024) return `${Math.round(tailleKb)} Ko`;
  return `${(tailleKb / 1024).toFixed(1)} Mo`;
}

export function rechercheDocuments(query: string): DocumentOfficiel[] {
  const q = query.trim().toLowerCase();
  if (!q) return DOCUMENTS_OFFICIELS;
  return DOCUMENTS_OFFICIELS.filter((doc) => {
    return (
      doc.titre.toLowerCase().includes(q) ||
      doc.description.toLowerCase().includes(q) ||
      doc.source.toLowerCase().includes(q) ||
      doc.motsClefs.some((k) => k.toLowerCase().includes(q))
    );
  });
}

export function groupByCategorie(
  docs: DocumentOfficiel[]
): Record<CategorieDocument, DocumentOfficiel[]> {
  const result: Record<CategorieDocument, DocumentOfficiel[]> = {
    cerfa: [],
    registre_modele: [],
    guide_dgec: [],
    fluide_specifique: [],
  };
  for (const doc of docs) {
    result[doc.categorie].push(doc);
  }
  return result;
}
