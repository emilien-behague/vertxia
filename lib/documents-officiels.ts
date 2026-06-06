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
  | "reglement_eu"
  | "decret_arrete_fr"
  | "guide_dgec"
  | "trackdechets_bsff"
  | "syderep_ademe"
  | "attestation_capacite"
  | "etiquette_tfe"
  | "fluide_specifique"
  | "fiche_fluide_specifique";

// Types d intervention de l app, alignes sur les valeurs utilisees dans
// /m/intervention/page.tsx et /m/intervention/nouvelle?type=...
export type TypeIntervention =
  | "recuperation"
  | "demantelement"
  | "controle_periodique"
  | "controle_non_periodique"
  | "mise_service"
  | "maintenance"
  | "assemblage"
  | "modification";

export const TOUS_TYPES_INTERVENTION: TypeIntervention[] = [
  "recuperation",
  "demantelement",
  "controle_periodique",
  "controle_non_periodique",
  "mise_service",
  "maintenance",
  "assemblage",
  "modification",
];

export type DocumentOfficiel = {
  id: string;
  titre: string;
  description: string;
  source: string;
  sourceUrl: string;
  /** Chemin local dans public/docs/officiels/ — vide string "" si le doc n'est
   *  pas (encore) telecharge en local. Dans ce cas le bouton ouvre sourceUrl. */
  fichierLocal: string;
  tailleKb: number;
  categorie: CategorieDocument;
  motsClefs: string[];
  dateVerification: string;
  /** True si le PDF est cache localement (PWA offline-first). False si l'app
   *  ouvre l'URL externe — donc inutilisable hors connexion. UI affiche un
   *  badge "Hors-ligne" / "En ligne uniquement" selon ce flag. */
  disponibleOffline: boolean;
  /** Priorite Vertxia : 1 = must-have V1, 5 = nice-to-have. */
  prioriteVertxia: 1 | 2 | 3 | 4 | 5;
  /** Fiabilite de la source. Affichee discretement dans la fiche document. */
  fiabilite: "source_primaire_officielle" | "source_secondaire_fiable";
  // Types d intervention pour lesquels ce document est pertinent.
  // Si le doc est transverse (utile partout) -> mettre tous les types.
  // L UI affiche ces docs sous forme de carte sur la page de saisie
  // de l intervention correspondante (raccourci offline).
  interventionsApplicables: TypeIntervention[];
};

export const CATEGORIE_LABELS: Record<CategorieDocument, string> = {
  cerfa: "CERFA & formulaires officiels",
  registre_modele: "Registres & modèles",
  reglement_eu: "Règlements européens",
  decret_arrete_fr: "Décrets & arrêtés français",
  guide_dgec: "Guides DGEC (Ministère de l'écologie)",
  trackdechets_bsff: "TrackDéchets & BSFF",
  syderep_ademe: "SYDEREP & ADEME",
  attestation_capacite: "Attestation de capacité",
  etiquette_tfe: "Étiquetage F-Gas",
  fluide_specifique: "Fluides — alternatives autorisées",
  fiche_fluide_specifique: "Fiches techniques fluides",
};

// Helper interne pour eviter de repeter les meta communs aux docs venant du
// sweep workflow du 06/06/2026 — tous sources verifiees WebFetch, fiabilite
// majoritairement primaire, pas encore telecharges en local (V1 = lien externe,
// V2 = cache PWA dans public/docs/officiels/).
const SWEEP_DATE = "2026-06-06";

export const DOCUMENTS_OFFICIELS: DocumentOfficiel[] = [
  // ── V0 : 7 documents historiques deja telecharges en local ─────────────────
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
    disponibleOffline: true,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [
      "recuperation",
      "demantelement",
      "controle_periodique",
      "controle_non_periodique",
      "maintenance",
      "modification",
    ],
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
    disponibleOffline: true,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [...TOUS_TYPES_INTERVENTION],
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
    disponibleOffline: true,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: ["recuperation", "controle_non_periodique", "controle_periodique"],
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
    motsClefs: ["f-gas", "f-gaz", "2024/573", "réglementation", "europe", "dgec", "ministère", "obligations"],
    dateVerification: "2026-06-04",
    disponibleOffline: true,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [...TOUS_TYPES_INTERVENTION],
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
    disponibleOffline: true,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [
      "recuperation",
      "demantelement",
      "controle_periodique",
      "controle_non_periodique",
      "maintenance",
    ],
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
    disponibleOffline: true,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [
      "controle_non_periodique",
      "controle_periodique",
      "recuperation",
      "demantelement",
    ],
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
    motsClefs: ["hfc", "hfo", "alternatives", "retrofit", "phase-out", "a2l", "r-454", "r-32", "naturels"],
    dateVerification: "2026-06-04",
    disponibleOffline: true,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [
      "mise_service",
      "assemblage",
      "modification",
      "recuperation",
      "demantelement",
    ],
  },

  // ── V1 : 30 documents identifies par sweep multi-agent 06/06/2026 ──────────
  // Liens externes pour le moment (badge "En ligne" cote UI). PDFs a downloader
  // progressivement dans public/docs/officiels/ pour bascule offline-first.

  // === CERFA & FORMULAIRES =================================================
  {
    id: "cerfa-15498-02-contrat-assemblage",
    titre: "CERFA 15498*02 — Contrat assemblage et mise en service",
    description:
      "Contrat obligatoire (art. R.543-84 Code env.) entre l'acheteur d'un équipement préchargé HFC et l'installateur titulaire de l'attestation de capacité. À remplir et conserver dès qu'un frigoriste met en service un split, PAC ou monobloc préchargé.",
    source: "formulaires.service-public.gouv.fr",
    sourceUrl: "https://www.formulaires.service-public.gouv.fr/gf/cerfa_15498.do",
    fichierLocal: "",
    tailleKb: 440,
    categorie: "cerfa",
    motsClefs: ["cerfa", "15498", "contrat assemblage", "mise en service", "équipement préchargé", "attestation capacité", "R.543-84"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: ["mise_service", "assemblage"],
  },
  {
    id: "cerfa-15497-04-notice",
    titre: "Notice explicative CERFA 15497*04",
    description:
      "Notice officielle 5 pages accompagnant le CERFA 15497*04. Explique le remplissage de chaque champ (catégories I-IV, BSDD, quantités). Référence pour éviter les non-conformités en contrôle DGPR.",
    source: "formulaires.service-public.gouv.fr",
    sourceUrl: "https://www.formulaires.service-public.gouv.fr/gf/getNotice.do?cerfaNotice=1&cerfaFormulaire=15497",
    fichierLocal: "",
    tailleKb: 360,
    categorie: "cerfa",
    motsClefs: ["notice", "cerfa", "15497", "fiche intervention", "BSDD", "remplissage", "guide"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [
      "recuperation",
      "demantelement",
      "controle_periodique",
      "controle_non_periodique",
      "maintenance",
      "modification",
    ],
  },

  // === RÈGLEMENTS EU =======================================================
  {
    id: "ue-2024-573-fgas3",
    titre: "Règlement (UE) 2024/573 — F-Gas III (texte FR complet)",
    description:
      "Règlement principal F-Gas III du 07/02/2024, en vigueur depuis 11/03/2024, abroge le 517/2014. Quotas HFC, interdictions progressives, certification, contrôle étanchéité, F-Gas Portal. Document de référence n°1 pour tout frigoriste.",
    source: "eur-lex.europa.eu",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/FR/TXT/PDF/?uri=OJ:L_202400573",
    fichierLocal: "",
    tailleKb: 1600,
    categorie: "reglement_eu",
    motsClefs: ["F-Gas III", "2024/573", "gaz fluorés", "HFC", "quotas", "interdictions", "contrôle étanchéité"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [...TOUS_TYPES_INTERVENTION],
  },
  {
    id: "ue-2024-2174-etiquette",
    titre: "Règlement (UE) 2024/2174 — Nouveaux modèles d'étiquetage F-Gas",
    description:
      "Texte UE en vigueur depuis 01/01/2025 fixant le format exact de l'étiquette obligatoire sur tout équipement HFC/HFO : charge kg, tCO2eq, PRP, nom chimique. Remplace le 2015/2068.",
    source: "eur-lex.europa.eu",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/FR/TXT/PDF/?uri=OJ:L_202402174",
    fichierLocal: "",
    tailleKb: 400,
    categorie: "reglement_eu",
    motsClefs: ["étiquette", "F-Gas", "2024/2174", "tCO2eq", "PRP", "marquage équipement"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: ["mise_service", "assemblage", "modification", "maintenance"],
  },
  {
    id: "ue-2015-2067-certification-personnes",
    titre: "Règlement (UE) 2015/2067 — Certification des personnes (Cat. I-IV)",
    description:
      "Prescrit les conditions de certification des personnes physiques travaillant sur équipements fixes réfrigération/clim/PAC + unités réfrigérées transport. Définit les attestations d'aptitude historiques (avant bascule 2027).",
    source: "eur-lex.europa.eu",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/FR/TXT/PDF/?uri=CELEX:32015R2067",
    fichierLocal: "",
    tailleKb: 400,
    categorie: "reglement_eu",
    motsClefs: ["2015/2067", "certification personnes", "catégorie I II III IV", "attestation aptitude", "Cemafroid"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 2,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [...TOUS_TYPES_INTERVENTION],
  },
  {
    id: "ue-2015-2068-etiquette-historique",
    titre: "Règlement (UE) 2015/2068 — Étiquette F-Gas (HISTORIQUE / parc installé)",
    description:
      "ABROGÉ le 31/12/2024 mais reste la base des étiquettes F-Gas du parc installé. Utile pour reconnaître/comprendre les étiquettes anciennes lors d'intervention sur équipement antérieur à 2025.",
    source: "eur-lex.europa.eu",
    sourceUrl: "https://eur-lex.europa.eu/legal-content/FR/TXT/PDF/?uri=CELEX:32015R2068",
    fichierLocal: "",
    tailleKb: 400,
    categorie: "reglement_eu",
    motsClefs: ["étiquette F-Gas", "2015/2068", "ancien modèle", "parc installé", "historique"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 3,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: ["maintenance", "controle_periodique", "controle_non_periodique"],
  },

  // === DÉCRETS & ARRÊTÉS FR ===============================================
  {
    id: "code-env-r543-75-123",
    titre: "Code de l'environnement — Section 6 Fluides frigorigènes (R543-75 à R543-123)",
    description:
      "Section codifiée qui régit toute l'activité frigoriste en France : mise sur le marché, manipulation, récupération, destruction. Fonde juridiquement les attestations capacité (R543-99) et aptitude (R543-106).",
    source: "legifrance.gouv.fr",
    sourceUrl: "https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006074220/LEGISCTA000006176997/",
    fichierLocal: "",
    tailleKb: 2500,
    categorie: "decret_arrete_fr",
    motsClefs: ["code environnement", "R543-75", "R543-123", "attestation capacité", "opérateur"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [...TOUS_TYPES_INTERVENTION],
  },
  {
    id: "arrete-29-02-2016",
    titre: "Arrêté du 29 février 2016 — Socle français fluides frigorigènes",
    description:
      "Socle réglementaire français. Détaille contrôles d'étanchéité, registre obligatoire, fiche d'intervention CERFA 15497, déclaration annuelle, vignette bleue/rouge. Texte que tout frigoriste doit avoir sous le coude.",
    source: "legifrance.gouv.fr (JORF n°0059 du 10/03/2016)",
    sourceUrl: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000032173989",
    fichierLocal: "",
    tailleKb: 1500,
    categorie: "decret_arrete_fr",
    motsClefs: ["arrêté 29 février 2016", "CERFA 15497", "registre intervention", "contrôle étanchéité", "déclaration annuelle"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [...TOUS_TYPES_INTERVENTION],
  },
  {
    id: "arrete-29-05-2024-transposition-fgas3",
    titre: "Arrêté du 29 mai 2024 — Modifiant l'arrêté du 29/02/2016 (transposition F-Gas III)",
    description:
      "Première étape française d'adaptation au règlement UE 2024/573. Met à jour la fiche CERFA n°15497 (v3 → v4), intègre les nouvelles règles de traçabilité HFC, fluides régénérés, CO2 et ammoniac. Indispensable pour déclarations 2025.",
    source: "legifrance.gouv.fr (JORF n°0158 du 05/07/2024)",
    sourceUrl: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049880740",
    fichierLocal: "",
    tailleKb: 1000,
    categorie: "decret_arrete_fr",
    motsClefs: ["arrêté 29 mai 2024", "F-Gas III", "transposition", "CERFA 15497 v4", "traçabilité HFC"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [...TOUS_TYPES_INTERVENTION],
  },
  {
    id: "arrete-21-11-2025-attestation-capacite",
    titre: "Arrêté du 21 novembre 2025 — Attestations de CAPACITÉ post F-Gas III",
    description:
      "Nouveau cadre des attestations de capacité entreprise post F-Gas III (R.543-99). APPLICATION OBLIGATOIRE AU 1er JANVIER 2027 — toutes les entreprises doivent migrer.",
    source: "legifrance.gouv.fr (JORF n°0286 du 06/12/2025)",
    sourceUrl: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052993429",
    fichierLocal: "",
    tailleKb: 700,
    categorie: "decret_arrete_fr",
    motsClefs: ["arrêté 21 novembre 2025", "attestation capacité entreprise", "R543-99", "F-Gas III", "1er janvier 2027"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [...TOUS_TYPES_INTERVENTION],
  },
  {
    id: "arrete-21-11-2025-attestation-aptitude",
    titre: "Arrêté du 21 novembre 2025 — Attestations d'APTITUDE post F-Gas III",
    description:
      "Nouveau cadre attestations aptitude personne (R.543-106). Crée catégories A1, A2, B, C, D, E, V qui remplacent les I/II/III/IV/V historiques. Intègre hydrocarbures, CO2, ammoniac. Bascule obligatoire avant 01/01/2027.",
    source: "legifrance.gouv.fr (JORF n°0289 du 10/12/2025)",
    sourceUrl: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053004604",
    fichierLocal: "",
    tailleKb: 700,
    categorie: "decret_arrete_fr",
    motsClefs: ["arrêté 21 novembre 2025", "attestation aptitude", "R543-106", "catégories A1 A2 B C D E V", "hydrocarbures CO2 ammoniac"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [...TOUS_TYPES_INTERVENTION],
  },
  {
    id: "decret-2015-1790",
    titre: "Décret n° 2015-1790 du 28 décembre 2015 — Décret fondateur",
    description:
      "Décret fondateur (transposition UE 517/2014) qui a modifié articles R543-75 à R543-98 du Code env. Pierre angulaire juridique du régime fluides frigorigènes en France. Indispensable pour comprendre l'origine d'une règle.",
    source: "legifrance.gouv.fr (JORF 30/12/2015)",
    sourceUrl: "https://www.legifrance.gouv.fr/loda/id/JORFTEXT000031733299",
    fichierLocal: "",
    tailleKb: 800,
    categorie: "decret_arrete_fr",
    motsClefs: ["décret 2015-1790", "F-Gas II", "transposition UE 517/2014", "R543-75 à R543-98"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 2,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [...TOUS_TYPES_INTERVENTION],
  },
  {
    id: "arrete-17-07-2019-categories-i-v",
    titre: "Arrêté du 17 juillet 2019 — Catégories aptitude I-V (HISTORIQUE jusqu'au 31/12/2026)",
    description:
      "Modification structurante qui précise les catégories I/II/III/IV/V du système historique (en vigueur jusqu'à fin 2026). Base réglementaire des attestations 'Catégorie 1' que portent la majorité des frigoristes actuels.",
    source: "legifrance.gouv.fr (JORF n°0199 du 28/08/2019)",
    sourceUrl: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000038969068",
    fichierLocal: "",
    tailleKb: 800,
    categorie: "decret_arrete_fr",
    motsClefs: ["arrêté 17 juillet 2019", "catégorie I II III IV V", "attestation aptitude", "contrôle étanchéité"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 2,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [...TOUS_TYPES_INTERVENTION],
  },
  {
    id: "arrete-26-07-2022-bsff-obligatoire",
    titre: "Arrêté du 26 juillet 2022 — BSFF TrackDéchets obligatoire",
    description:
      "Texte qui rend OBLIGATOIRE depuis le 01/01/2023 la traçabilité TrackDéchets / BSFF pour tout fluide récupéré par un frigoriste. Fixe le contenu exact des bordereaux électroniques. Sanctions en cas de non-respect.",
    source: "legifrance.gouv.fr (JORF n°0179 du 04/08/2022)",
    sourceUrl: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000046138697",
    fichierLocal: "",
    tailleKb: 500,
    categorie: "trackdechets_bsff",
    motsClefs: ["arrêté 26 juillet 2022", "BSFF", "TrackDéchets", "R541-45", "bordereau", "déchets dangereux"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: ["recuperation", "demantelement"],
  },

  // === TRACKDECHETS & BSFF =================================================
  {
    id: "trackdechets-faq-bsff-general",
    titre: "FAQ TrackDéchets — BSFF Fluides Frigorigènes (informations générales)",
    description:
      "Page racine FAQ officielle TrackDéchets dédiée aux BSFF. Point d'entrée principal des 6 sections métier : détenteurs, opérateurs, distributeurs, dépositaires, transporteurs, installations traitement.",
    source: "faq.trackdechets.fr",
    sourceUrl: "https://faq.trackdechets.fr/fluides-frigorigenes/informations-generales",
    fichierLocal: "",
    tailleKb: 500,
    categorie: "trackdechets_bsff",
    motsClefs: ["BSFF", "fluides frigorigènes", "TrackDéchets", "FAQ", "traçabilité"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 2,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: ["recuperation", "demantelement"],
  },
  {
    id: "trackdechets-faq-creer-bsff",
    titre: "FAQ TrackDéchets — Créer un BSFF (parcours initial)",
    description:
      "Tutoriel officiel pas-à-pas pour créer un BSFF initial : sélection émetteur, code déchet, contenant, fluide, signature producteur. Essentiel pour un frigoriste en intervention.",
    source: "faq.trackdechets.fr",
    sourceUrl: "https://faq.trackdechets.fr/fluides-frigorigenes/informations-generales/le-parcours-du-bsff-initial/creer-un-bsff",
    fichierLocal: "",
    tailleKb: 300,
    categorie: "trackdechets_bsff",
    motsClefs: ["BSFF", "créer BSFF", "parcours initial", "frigoriste", "signature producteur"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 2,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: ["recuperation", "demantelement"],
  },
  {
    id: "trackdechets-statuts-bsff",
    titre: "TrackDéchets Developers — Statuts BSFF (workflow)",
    description:
      "Documentation officielle du workflow BSFF : INITIAL, SIGNED_BY_PRODUCER, SENT, RECEIVED, ACCEPTED, PROCESSED, INTERMEDIATELY_PROCESSED. Critique pour comprendre les transitions et signatures par acteur.",
    source: "developers.trackdechets.beta.gouv.fr",
    sourceUrl: "https://developers.trackdechets.beta.gouv.fr/reference/statuts/bsff",
    fichierLocal: "",
    tailleKb: 300,
    categorie: "trackdechets_bsff",
    motsClefs: ["BSFF", "statuts", "workflow", "signature", "PROCESSED"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 2,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: ["recuperation", "demantelement"],
  },
  {
    id: "afce-guide-trackdechets-operateur",
    titre: "AFCE — Guide pratique TrackDéchets pour opérateur frigoriste",
    description:
      "Guide pratique 15 pages co-édité AFCE + ADC3R. Couvre création de compte, gestion établissement, création et signature d'un BSFF pour un opérateur frigoriste. Très pédagogique, orienté terrain.",
    source: "afce.asso.fr",
    sourceUrl: "https://www.afce.asso.fr/wp-content/uploads/2023/03/AFCE-trackdechets-Guide-Operateur.pdf",
    fichierLocal: "",
    tailleKb: 6800,
    categorie: "guide_dgec",
    motsClefs: ["AFCE", "ADC3R", "opérateur", "frigoriste", "guide pratique", "BSFF"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 2,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: ["recuperation", "demantelement"],
  },

  // === SYDEREP & ADEME =====================================================
  {
    id: "syderep-portail-ademe",
    titre: "Portail SYDEREP ADEME — Déclaration annuelle opérateurs F-Gas",
    description:
      "Portail officiel ADEME pour la télédéclaration annuelle obligatoire (avant 31 mars N+1) des opérateurs attestés fluides frigorigènes. Point d'entrée unique : bilans de fluides, Observatoire gaz fluorés.",
    source: "ADEME — Agence de la transition écologique",
    sourceUrl: "https://syderep.ademe.fr/",
    fichierLocal: "",
    tailleKb: 100,
    categorie: "syderep_ademe",
    motsClefs: ["syderep", "ademe", "déclaration annuelle", "F-Gas", "opérateur attesté", "bilan fluides", "31 mars"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [...TOUS_TYPES_INTERVENTION],
  },
  {
    id: "ademe-operateurs-attestes-dataset",
    titre: "Liste officielle opérateurs attestés F-Gas (data.ademe.fr)",
    description:
      "Jeu de données ouvert ADEME listant tous les opérateurs attestés pour la manipulation des fluides frigorigènes en France. Téléchargeable CSV/JSON. Utile pour vérifier la validité d'une attestation.",
    source: "data.ademe.fr / data.gouv.fr",
    sourceUrl: "https://data.ademe.fr/datasets/operateur-atteste-gf",
    fichierLocal: "",
    tailleKb: 5000,
    categorie: "syderep_ademe",
    motsClefs: ["opérateurs attestés", "data.ademe.fr", "open data", "REP-GF", "annuaire frigoristes"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 3,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [...TOUS_TYPES_INTERVENTION],
  },

  // === ATTESTATION DE CAPACITÉ =============================================
  {
    id: "dgec-organismes-evaluateurs",
    titre: "Liste DGEC des organismes évaluateurs habilités",
    description:
      "Liste à jour des organismes habilités par le Ministère pour délivrer l'attestation de capacité catégorie I à V. Document indispensable pour un pro qui cherche son organisme certificateur.",
    source: "Ministère de la Transition écologique — DGEC",
    sourceUrl: "https://www.ecologie.gouv.fr/sites/default/files/documents/Fluides%20frigorig%C3%A8nes%20-%20liste%20des%20organismes%20%C3%A9valuateurs-1.pdf",
    fichierLocal: "",
    tailleKb: 74,
    categorie: "attestation_capacite",
    motsClefs: ["organismes évaluateurs", "attestation capacité", "DGEC", "habilitation", "certificateurs"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 1,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [...TOUS_TYPES_INTERVENTION],
  },
  {
    id: "afce-organismes-agrees",
    titre: "AFCE — Liste des 7 organismes agréés ADC fluides frigorigènes",
    description:
      "Liste à jour AFCE des 7 organismes agréés pour délivrer l'attestation de capacité : Cemafroid (I-V+VHU), Bureau Veritas (I-IV), Qualiclimafroid (I-IV), SGS ICS (I-V), AFNOR (V+VHU), DEKRA (V), SOCOTEC (I-V+VHU). Plus récente que la liste DGEC 2017.",
    source: "afce.asso.fr",
    sourceUrl: "https://www.afce.asso.fr/les-organismes-agrees/",
    fichierLocal: "",
    tailleKb: 200,
    categorie: "attestation_capacite",
    motsClefs: ["AFCE", "organismes agréés", "Cemafroid", "Bureau Veritas", "AFNOR", "SOCOTEC", "DEKRA", "SGS"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 1,
    fiabilite: "source_secondaire_fiable",
    interventionsApplicables: [...TOUS_TYPES_INTERVENTION],
  },

  // === FICHES TECHNIQUES FLUIDES ===========================================
  {
    id: "climalife-r32",
    titre: "Climalife — Fiche produit R-32 (FP-FR)",
    description:
      "Fiche produit officielle Climalife en français pour le R-32 (difluorométhane CH2F2), HFC A2L massivement utilisé en splits monobloc et PAC résidentielles. Spécifications commerciales garanties.",
    source: "Climalife (Dehon)",
    sourceUrl: "https://climalife.com/wp-content/uploads/2024/11/R-32-FP-FR.pdf",
    fichierLocal: "",
    tailleKb: 200,
    categorie: "fiche_fluide_specifique",
    motsClefs: ["R-32", "difluorométhane", "A2L", "HFC", "splits", "PAC", "fiche produit", "Climalife"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 2,
    fiabilite: "source_secondaire_fiable",
    interventionsApplicables: ["mise_service", "assemblage", "modification", "maintenance", "recuperation"],
  },
  {
    id: "chemours-opteon-xl41-r454b",
    titre: "Chemours Opteon XL41 (R-454B) — Product Information Bulletin",
    description:
      "Bulletin produit Opteon XL41 (68.9% R-32 / 31.1% R-1234yf), HFO blend A2L bas GWP (467), remplaçant du R-410A en PAC résidentielles/tertiaires et chillers.",
    source: "Chemours / Opteon",
    sourceUrl: "https://www.opteon.com/en/-/media/files/opteon/o-xl41pb-opteon-xl41-push-bulletin.pdf?rev=4e30be51deac4ce2900c596177a2e59f",
    fichierLocal: "",
    tailleKb: 500,
    categorie: "fiche_fluide_specifique",
    motsClefs: ["R-454B", "Opteon XL41", "PIB", "Chemours", "A2L", "remplaçant R-410A", "PAC"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 2,
    fiabilite: "source_secondaire_fiable",
    interventionsApplicables: ["mise_service", "assemblage", "modification"],
  },
  {
    id: "climalife-r290-propane",
    titre: "Climalife — Fiche R-290 Propane (HC)",
    description:
      "Fiche produit Climalife pour le R-290 (propane), hydrocarbure A3 extrêmement inflammable utilisé en froid commercial <150g charge et PAC eau-eau. Composition ≥99,5 %. Naturel, GWP<1.",
    source: "Climalife",
    sourceUrl: "https://climalife.com/wp-content/uploads/2022/09/uploadsproductmediadocumenthc-r-290-en.pdf",
    fichierLocal: "",
    tailleKb: 400,
    categorie: "fiche_fluide_specifique",
    motsClefs: ["R-290", "propane", "A3", "HC", "hydrocarbure", "inflammable", "fluide naturel", "150g"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 2,
    fiabilite: "source_secondaire_fiable",
    interventionsApplicables: ["mise_service", "assemblage", "modification", "maintenance"],
  },
  {
    id: "climalife-r744-co2",
    titre: "Climalife — Fiche CO2 R-744 FR",
    description:
      "Fiche technique Climalife R-744 (CO2) en français. Fluide naturel pour froid commercial transcritique/subcritique, cascades et boosters. GWP=1. Indispensable transition post F-Gas.",
    source: "Climalife",
    sourceUrl: "https://climalife.com/wp-content/uploads/2022/09/uploadsproductmediadocumentco2-r-744-fr.pdf",
    fichierLocal: "",
    tailleKb: 700,
    categorie: "fiche_fluide_specifique",
    motsClefs: ["R-744", "CO2", "transcritique", "subcritique", "fluide naturel", "GWP 1", "cascade", "booster"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 2,
    fiabilite: "source_secondaire_fiable",
    interventionsApplicables: ["mise_service", "assemblage", "modification", "maintenance"],
  },

  // === DIVERS GUIDES =======================================================
  {
    id: "douanes-note-fgas-sao",
    titre: "Note Douanes — F-Gas 2024/573 + SAO 2024/590",
    description:
      "Note officielle aux opérateurs français détaillant obligations douanières, déclaratives et tarifaires liées aux imports/exports HFC (F-Gas III) et SAO. Utile pour frigoristes qui achètent ou revendent du fluide importé.",
    source: "DGDDI — Direction Générale des Douanes",
    sourceUrl: "https://www.douane.gouv.fr/sites/default/files/2024-07/12/Note_operateurs_DTP_HFC_SAO.pdf",
    fichierLocal: "",
    tailleKb: 250,
    categorie: "guide_dgec",
    motsClefs: ["F-Gas III", "2024/573", "SAO", "2024/590", "HFC", "douanes", "import export"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 3,
    fiabilite: "source_primaire_officielle",
    interventionsApplicables: [...TOUS_TYPES_INTERVENTION],
  },
  {
    id: "climeco-guide-bonnes-pratiques",
    titre: "Guide bonnes pratiques maintenance frigoristes (CLIMECO / AFCE / SNEFCCA)",
    description:
      "Guide pratique destiné aux frigoristes pour maintenance installations froid/clim : contrôles obligatoires, périodicité, checklist intervention. Édité dans le cadre du programme CLIMECO (CEE) en partenariat AFCE et SNEFCCA.",
    source: "Programme CLIMECO / AFCE / SNEFCCA",
    sourceUrl: "https://www.programme-climeco.fr/media/fee4327a-b55f-11ea-b6b8-0242ac130004/7447474a-298d-11eb-b69a-0242ac130004/0-guide-aff-bonnes-pratiques.pdf",
    fichierLocal: "",
    tailleKb: 1900,
    categorie: "guide_dgec",
    motsClefs: ["bonnes pratiques", "maintenance", "frigoriste", "contrôle", "CEE", "CLIMECO", "AFCE", "SNEFCCA"],
    dateVerification: SWEEP_DATE,
    disponibleOffline: false,
    prioriteVertxia: 3,
    fiabilite: "source_secondaire_fiable",
    interventionsApplicables: ["maintenance", "controle_periodique", "controle_non_periodique"],
  },
];

// Retourne les documents officiels pertinents pour un type d intervention donne,
// tries pour mettre en premier les docs CERFA / formulaire qui peuvent etre
// imprimes/remplis manuellement en backup si l app crash.
export const CATEGORIE_ORDRE: Record<CategorieDocument, number> = {
  cerfa: 0,
  registre_modele: 1,
  trackdechets_bsff: 2,
  syderep_ademe: 3,
  attestation_capacite: 4,
  guide_dgec: 5,
  decret_arrete_fr: 6,
  reglement_eu: 7,
  etiquette_tfe: 8,
  fluide_specifique: 9,
  fiche_fluide_specifique: 10,
};

export function getDocumentsForIntervention(type: TypeIntervention): DocumentOfficiel[] {
  return DOCUMENTS_OFFICIELS.filter((doc) =>
    doc.interventionsApplicables.includes(type)
  ).sort((a, b) => {
    // 1. priorite Vertxia croissante (1 = top)
    if (a.prioriteVertxia !== b.prioriteVertxia) {
      return a.prioriteVertxia - b.prioriteVertxia;
    }
    // 2. categorie (CERFA d'abord)
    return CATEGORIE_ORDRE[a.categorie] - CATEGORIE_ORDRE[b.categorie];
  });
}

// Compteur de documents par type, utilise pour le badge sur la page liste
// des types d intervention (ex: "+3 docs officiels").
export function countDocumentsForIntervention(type: TypeIntervention): number {
  return DOCUMENTS_OFFICIELS.filter((doc) =>
    doc.interventionsApplicables.includes(type)
  ).length;
}

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
    reglement_eu: [],
    decret_arrete_fr: [],
    guide_dgec: [],
    trackdechets_bsff: [],
    syderep_ademe: [],
    attestation_capacite: [],
    etiquette_tfe: [],
    fluide_specifique: [],
    fiche_fluide_specifique: [],
  };
  for (const doc of docs) {
    result[doc.categorie].push(doc);
  }
  return result;
}
