// Marketplace de pieces detachees frigoristes — catalogue + matching pieces
// pour la feature Vertxia Marketplace.
//
// Modele economique : Vertxia touche une commission (5% HT par defaut) sur
// chaque piece achetee via la plateforme. Le frigoriste gagne du temps
// (pas de recherche fournisseur), trouve le bon prix (compare 3+ fournisseurs),
// le client paie au frigoriste (qui refacture la piece).
//
// IMPORTANT regle #26 CLAUDE.md : les prix listes ci-dessous sont des
// ESTIMATIONS MARCHE FR 2026 calees sur des fourchettes connues du secteur.
// PAS des prix verifies pieces-par-pieces sur APIs fournisseurs. Le champ
// prixEstimeHt + prixSource le precise. La V2 marketplace devra brancher
// les vraies APIs des distributeurs (Climalife, Bitzer, Danfoss, etc.).
//
// Fournisseurs et constructeurs verifies via WebFetch le 04/06/2026
// sur leur site officiel (regle #25). Ceux marques "URL a confirmer"
// sont des acteurs connus du marche FR mais dont le site officiel
// n'a pas pu etre verifie dans la session courante.

export type CategoriePiece =
  | "compresseur"
  | "echangeur"
  | "detendeur"
  | "vanne"
  | "filtre"
  | "pressostat_controleur"
  | "capteur_sonde"
  | "regulateur_electronique"
  | "consommable"
  | "detection_fuite";

export type TypeFournisseur = "distributeur" | "constructeur";

export type Fournisseur = {
  id: string;
  nom: string;
  type: TypeFournisseur;
  specialite: string;
  // URL officielle si verifiee via WebFetch en source primaire,
  // sinon null + flag urlConfirmee = false.
  urlOfficielle: string | null;
  urlConfirmee: boolean;
  delaiLivraisonJoursEstimes: { min: number; max: number };
  zonesLivraisonFr: string;
  // Commission Vertxia negociee (par defaut 5% HT, varie selon volume).
  tauxCommission: number;
};

export type PieceDetachee = {
  id: string;
  reference: string;
  designation: string;
  marque: string;
  categorie: CategoriePiece;
  // Compatibilites equipements : marques + gammes ciblees pour le matching IA.
  // Ex: ["Daikin VRV IV", "Daikin VRV V"]. Plus c'est specifique mieux c'est.
  compatibilitesEquipements: string[];
  // Fluides compatibles (pour filtrer selon le fluide de l'equipement).
  fluidesCompatibles: string[];
  prixEstimeHt: number;
  prixSource: string;
  fournisseurIds: string[];
  uniteVente: string;
  enStock: boolean;
  delaiSpecifiqueJours?: { min: number; max: number };
};

// ----------------------------------------------------------------------------
// FOURNISSEURS ET CONSTRUCTEURS
// ----------------------------------------------------------------------------

// Catalogue de 25 fournisseurs/constructeurs FR verifies via WebFetch sur
// sources primaires lors du workflow 10 agents du 04/06/2026 (cf. transcript
// workflows/wf_2baf2329-a2c). 102 acteurs cartographies au total, classes
// en 4 niveaux (immediate / phase_2 / phase_3 / a_ecarter). Ici on garde
// les "immediate" + quelques "phase_2" pertinents segment Sud-Est PACA
// (base Emilien Toulon).
export const FOURNISSEURS: Fournisseur[] = [
  // === DISTRIBUTEURS FLUIDES (top 4 marche FR) ===
  {
    id: "climalife",
    nom: "Climalife (Groupe Dehon)",
    type: "distributeur",
    specialite:
      "Leader FR fluides (HFO Honeywell Solstice, HFC, naturels) + outillage multi-marques (Refco/Wigam/Testo/Inficon) + détection EN 14624. 14 sites, 12 000+ clients, 300+ refs",
    urlOfficielle: "https://climalife.com/fr",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 1, max: 2 },
    zonesLivraisonFr: "France entière via 14 sites + DOM-TOM",
    tauxCommission: 0.05,
  },
  {
    id: "gazechim-froid",
    nom: "Gazechim Froid",
    type: "distributeur",
    specialite:
      "Distributeur fluides #2 FR multimarques. Distribue Honeywell/Solstice + Chemours/Opteon + Arkema/Forane + Daikin. Services transfert/récup/retrofit/formation pro",
    urlOfficielle: "https://www.gazechim-froid.fr",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 1, max: 3 },
    zonesLivraisonFr: "France entière (réseau dépôts territoriaux)",
    tauxCommission: 0.05,
  },
  {
    id: "framacold",
    nom: "Framacold",
    type: "distributeur",
    specialite:
      "Spécialiste retrofit FR (R-442A, R-470B, R-448A, R-449A, R-452A, R-513A). Stock complet HFC + HFO + naturels. Réseau dépositaires régions. Siège Castelnaudary",
    urlOfficielle: "https://www.framacold.com",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 1, max: 3 },
    zonesLivraisonFr: "France entière via dépositaires",
    tauxCommission: 0.06,
  },
  {
    id: "westfalen-france",
    nom: "Westfalen France",
    type: "distributeur",
    specialite:
      "Filiale FR groupe Westfalen (DE). Spécialiste naturels (CO2/R-744, NH3, R-290 propane, R-600a) + synthétiques low-GWP. Pertinent transition F-Gas III",
    urlOfficielle: "https://westfalen.com/fr/fr/fluides-frigorigenes",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 2, max: 5 },
    zonesLivraisonFr: "France entière (siège Metz)",
    tauxCommission: 0.05,
  },
  {
    id: "tron-roger",
    nom: "Tron Roger (PACA)",
    type: "distributeur",
    specialite:
      "Distributeur régional PACA (Aubagne 13). HFC + HFO. Cible clim pro + PAC air-eau + froid industriel. Plateforme commande online via eho-energies.fr",
    urlOfficielle: "https://www.tronroger.com/gaz-refrigerant",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 1, max: 2 },
    zonesLivraisonFr: "PACA + Marseille + Aubagne",
    tauxCommission: 0.06,
  },

  // === CONSTRUCTEURS COMPRESSEURS (top 5 mondial-FR) ===
  {
    id: "bitzer-france",
    nom: "Bitzer France",
    type: "constructeur",
    specialite:
      "LE compresseur premium commercial/industriel FR. ECOLINE pistons (2/4/6FES-Y), ORBIT scroll, CSH/CSW vis, CO2 transcritique, NHR ammoniac. Filiale FR Cergy-Pontoise",
    urlOfficielle: "https://www.bitzer.de/fr/fr/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 1, max: 5 },
    zonesLivraisonFr: "France entière via Bitzer France SAS + distributeurs",
    tauxCommission: 0.04,
  },
  {
    id: "copeland",
    nom: "Copeland (ex-Emerson Climate)",
    type: "constructeur",
    specialite:
      "Inventeur historique du scroll. Domine ~50% installations commerciales FR. Scroll ZR/ZB/ZP/ZF/ZH/ZX + Stream Discus semi-hermétique + Dixell contrôleurs",
    urlOfficielle: "https://www.copeland.com/fr-fr",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 1, max: 5 },
    zonesLivraisonFr: "France via wholesalers (Profroid, Climalife, Carly, Eurochill)",
    tauxCommission: 0.04,
  },
  {
    id: "danfoss-france",
    nom: "Danfoss France",
    type: "constructeur",
    specialite:
      "Leader FR composants + compresseurs. Production locale FR (Reyrieux + Anse). Maneurop MTZ + Performer scroll + Turbocor + détendeurs (T2/TE/TGE/ETS) + vannes (EVR, STF) + pressostats (KP) + régulateurs (AK-RC/CC55)",
    urlOfficielle: "https://www.danfoss.com/fr-fr/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 1, max: 2 },
    zonesLivraisonFr: "France entière via 2 usines + Danfoss France + distributeurs",
    tauxCommission: 0.05,
  },
  {
    id: "tecumseh-france",
    nom: "Tecumseh Europe / L'Unité Hermétique",
    type: "constructeur",
    specialite:
      "Production FR La Verpillière (38). Spécialiste hermétiques pistons + groupes condensation Silensys silencieux. AE2/AJ2/FH2 A2L-ready (R290/R454C/R1234yf). Omniprésent boulangerie/resto/cuisine pro",
    urlOfficielle: "https://www.tecumseh.com/en/europe",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 1, max: 3 },
    zonesLivraisonFr: "France entière via Tecumseh Europe SAS",
    tauxCommission: 0.05,
  },
  {
    id: "frascold-france",
    nom: "Frascold France",
    type: "constructeur",
    specialite:
      "Constructeur italien (1936). Semi-hermétiques pistons + vis pour froid commercial/industriel. ATEX zones explosives, CO2 transcritique TK/TKHD, R290 dédiés. Filiale FR Tours",
    urlOfficielle: "https://www.frascold.it/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 14, max: 28 },
    zonesLivraisonFr: "France via Frascold France SARL + distributeurs",
    tauxCommission: 0.04,
  },

  // === CONSTRUCTEURS COMPOSANTS / RÉGULATION ===
  {
    id: "carel-france",
    nom: "Carel France",
    type: "constructeur",
    specialite:
      "Régulateurs électroniques (Easy Y, pCOcompact) + détendeurs électroniques EEV + humidificateurs adiabatiques. Cible installations commerciales modernes",
    urlOfficielle: "https://www.carel.com/fr/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 2, max: 7 },
    zonesLivraisonFr: "France via distributeurs (Distrifroid, Cedeo)",
    tauxCommission: 0.05,
  },
  {
    id: "eliwell-france",
    nom: "Eliwell (groupe Schneider Electric)",
    type: "constructeur",
    specialite:
      "Régulateurs électroniques froid commercial (IDPlus 961, ID 974, EWNext). Cible vitrines, chambres froides, meubles commerciaux. Standard de marché supermarché",
    urlOfficielle: "https://www.eliwell.com/fr_fr/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 2, max: 7 },
    zonesLivraisonFr: "France via Distrifroid + Schneider France",
    tauxCommission: 0.05,
  },
  {
    id: "castel-france",
    nom: "Castel (Italie)",
    type: "constructeur",
    specialite:
      "Composants froid italiens (1961). Filtres déshydrateurs (4308/4316), vannes solénoïdes, vannes à bille (6590/5), voyants liquide. Très présent installations FR PME",
    urlOfficielle: "https://www.castel.it/en/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 3, max: 10 },
    zonesLivraisonFr: "France via Climalife + Gazechim + distributeurs régionaux",
    tauxCommission: 0.05,
  },
  {
    id: "honeywell-sporlan",
    nom: "Honeywell Sporlan",
    type: "constructeur",
    specialite:
      "Détendeurs thermostatiques pro (TMX, S, R), vannes solénoïdes industrielles, contrôleurs Discharge Bypass. Marché froid industriel + commercial premium",
    urlOfficielle: "https://www.parker.com/us/en/divisions/sporlan-division.html",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 5, max: 14 },
    zonesLivraisonFr: "France via wholesalers spécialisés",
    tauxCommission: 0.05,
  },

  // === CONSTRUCTEURS ÉCHANGEURS ===
  {
    id: "lu-ve-france",
    nom: "Lu-Ve France",
    type: "constructeur",
    specialite:
      "Échangeurs italiens (1928). Condenseurs air STMC/SAV, évaporateurs SHVN, aérothermes. Très présent chambres froides + supermarchés FR",
    urlOfficielle: "https://www.luvegroup.com/fr/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 7, max: 21 },
    zonesLivraisonFr: "France via Lu-Ve France",
    tauxCommission: 0.04,
  },
  {
    id: "guntner-france",
    nom: "Güntner France",
    type: "constructeur",
    specialite:
      "Échangeurs allemands premium. Condenseurs AGHN, évaporateurs GVH, refroidisseurs sec dry coolers. Cible industriel lourd + datacenters",
    urlOfficielle: "https://www.guentner.com/fr/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 14, max: 35 },
    zonesLivraisonFr: "France via Güntner France + intégrateurs",
    tauxCommission: 0.04,
  },
  {
    id: "friga-bohn",
    nom: "Friga-Bohn (groupe Lennox EMEA)",
    type: "constructeur",
    specialite:
      "Constructeur FR Genas (69). Groupes condensation + échangeurs + chambres froides. Forte pénétration PME (boucheries, fromagers, restaurateurs)",
    urlOfficielle: "https://www.friga-bohn.com/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 3, max: 10 },
    zonesLivraisonFr: "France entière via Friga-Bohn + distributeurs",
    tauxCommission: 0.05,
  },
  {
    id: "carrier-profroid",
    nom: "Carrier Profroid",
    type: "constructeur",
    specialite:
      "Constructeur FR Aubagne (13). Centrales froid commercial multi-compresseurs, transcritique CO2 supermarché. Acteur majeur grande distribution FR",
    urlOfficielle: "https://www.profroid.com/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 5, max: 21 },
    zonesLivraisonFr: "France entière (siège PACA)",
    tauxCommission: 0.04,
  },

  // === GROSSISTES HVAC GÉNÉRALISTES ===
  {
    id: "sonepar-climate",
    nom: "Sonepar Climate Solutions",
    type: "distributeur",
    specialite:
      "Grossiste HVAC pro #1 FR (60+ agences). Distribue Mitsubishi Electric, Daikin, Heiwa, Panasonic, Toshiba, Atlantic. Webshop pro + hotline technique + formations",
    urlOfficielle: "https://climate.sonepar.fr",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 1, max: 3 },
    zonesLivraisonFr: "France entière (60+ agences physiques)",
    tauxCommission: 0.04,
  },
  {
    id: "cedeo",
    nom: "Cedeo (Saint-Gobain)",
    type: "distributeur",
    specialite:
      "Grossiste sanitaire-chauffage-clim généraliste (350+ agences). Couvre besoins quotidiens frigoriste (raccords, isolation, consommables) + accès gammes constructeurs",
    urlOfficielle: "https://www.cedeo.fr/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 1, max: 2 },
    zonesLivraisonFr: "France entière (350+ agences Saint-Gobain Distribution)",
    tauxCommission: 0.04,
  },
  {
    id: "wurth-france",
    nom: "Würth France",
    type: "distributeur",
    specialite:
      "Consommables pros HVAC : brasure, joints, raccords flares, fluide nettoyant, fixations, vis. 200+ agences France. Catalogue B2B online",
    urlOfficielle: "https://www.wurth.fr/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 1, max: 2 },
    zonesLivraisonFr: "France entière (200+ agences)",
    tauxCommission: 0.05,
  },

  // === CONSTRUCTEURS ÉQUIPEMENTS FINIS (clim/PAC/froid) ===
  {
    id: "daikin-france",
    nom: "Daikin France",
    type: "constructeur",
    specialite:
      "Leader mondial clim/PAC. Splits, VRV, chillers, PAC air-eau. Pièces détachées via réseau pro Daikin Professional. Accès via login installateur agréé",
    urlOfficielle: "https://www.daikin.fr/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 3, max: 14 },
    zonesLivraisonFr: "France via Daikin France + agents agréés",
    tauxCommission: 0.03,
  },
  {
    id: "mitsubishi-electric-france",
    nom: "Mitsubishi Electric France",
    type: "constructeur",
    specialite:
      "Splits, City Multi VRF, PAC. Pièces détachées via portail MELCloud Pro + réseau distributeurs agréés. Accès login installateur",
    urlOfficielle: "https://les.mitsubishielectric.fr/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 3, max: 14 },
    zonesLivraisonFr: "France via Mitsubishi Electric France + agents",
    tauxCommission: 0.03,
  },
  {
    id: "toshiba-confort",
    nom: "Toshiba Carrier France",
    type: "constructeur",
    specialite:
      "PAC + clim Toshiba. Portail pièces détachées pieces.toshiba-confort.fr ACCESSIBLE SANS LOGIN (rare). Modèle d'ouverture catalogue pieces",
    urlOfficielle: "https://pieces.toshiba-confort.fr/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 2, max: 7 },
    zonesLivraisonFr: "France via Toshiba Carrier France",
    tauxCommission: 0.05,
  },
  {
    id: "atlantic-france",
    nom: "Atlantic",
    type: "constructeur",
    specialite:
      "PAC air-eau Alféa + chauffe-eau thermodynamiques. Plateforme pièces détachées Atlantic Pro structurée. Constructeur FR Vendée. Forte présence résidentiel/tertiaire",
    urlOfficielle: "https://professionnels.atlantic.fr/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 2, max: 7 },
    zonesLivraisonFr: "France entière (siège Vendée)",
    tauxCommission: 0.04,
  },

  // === MARKETPLACE PURE-PLAY (e-commerce frigoristes) ===
  {
    id: "fastcooling",
    nom: "FastCooling Solution",
    type: "distributeur",
    specialite:
      "Marketplace e-commerce pure-play frigoristes itinérants. Stock Bitzer, Copeland, Danfoss, Lu-Ve. Modèle B2B online accessible, livraison express. Concurrent direct potentiel Vertxia si dérive vers vente",
    urlOfficielle: "https://www.fastcooling-solution.com/",
    urlConfirmee: true,
    delaiLivraisonJoursEstimes: { min: 1, max: 3 },
    zonesLivraisonFr: "France entière",
    tauxCommission: 0.06,
  },
];

// ----------------------------------------------------------------------------
// CATALOGUE PIECES — fourchettes prix marche FR 2026 estimees (non verifiees
// piece-par-piece sur APIs fournisseurs, cf. regle #26 CLAUDE.md)
// ----------------------------------------------------------------------------

const PRIX_SOURCE_MARCHE = "Estimation fourchette marché FR 2026 — à reconfirmer sur API fournisseur en V2";

export const PIECES_CATALOGUE: PieceDetachee[] = [
  // ========== COMPRESSEURS ==========
  {
    id: "comp-bitzer-4fes-5y",
    reference: "4FES-5Y-40S",
    designation: "Compresseur semi-hermétique Bitzer 4FES-5Y — 5cv R-410A/R-32",
    marque: "Bitzer",
    categorie: "compresseur",
    compatibilitesEquipements: ["Daikin VRV", "Mitsubishi City Multi", "Hitachi Set Free", "Carrier 30RB"],
    fluidesCompatibles: ["R-410A", "R-32", "R-454B"],
    prixEstimeHt: 1450,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["bitzer-france", "climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "comp-bitzer-4nes-12y",
    reference: "4NES-12Y-40S",
    designation: "Compresseur semi-hermétique Bitzer 4NES-12Y — 12cv R-404A/R-448A",
    marque: "Bitzer",
    categorie: "compresseur",
    compatibilitesEquipements: ["Groupe froid commercial", "Chambre froide négative", "Carrier Profroid"],
    fluidesCompatibles: ["R-404A", "R-448A", "R-449A", "R-452A"],
    prixEstimeHt: 3850,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["bitzer-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "comp-copeland-zr-72",
    reference: "ZR72KCE-TFD-522",
    designation: "Compresseur scroll Copeland ZR72 — 6cv R-407C/R-410A",
    marque: "Copeland",
    categorie: "compresseur",
    compatibilitesEquipements: ["Carrier 30RB", "York YCAS", "Trane RTAC", "Mitsubishi PUHZ"],
    fluidesCompatibles: ["R-407C", "R-410A", "R-32"],
    prixEstimeHt: 1180,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["copeland-emerson", "climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "comp-copeland-zb-95",
    reference: "ZB95KCE-TFD-557",
    designation: "Compresseur scroll Copeland ZB95 — 8cv basse température R-448A",
    marque: "Copeland",
    categorie: "compresseur",
    compatibilitesEquipements: ["Groupe froid commercial négatif", "Vitrines réfrigérées"],
    fluidesCompatibles: ["R-448A", "R-449A", "R-452A", "R-407F"],
    prixEstimeHt: 1620,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["copeland-emerson"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "comp-bitzer-2dc-2-2y",
    reference: "2DC-2.2Y-40S",
    designation: "Compresseur Bitzer 2DC piston — 2.2cv R-134a/R-1234yf",
    marque: "Bitzer",
    categorie: "compresseur",
    compatibilitesEquipements: ["Climatiseur split", "PAC air/eau résidentiel", "Climatisation tertiaire"],
    fluidesCompatibles: ["R-134a", "R-1234yf", "R-513A"],
    prixEstimeHt: 720,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["bitzer-france"],
    uniteVente: "pièce",
    enStock: true,
  },

  // ========== ECHANGEURS ==========
  {
    id: "ech-cond-microcanaux-30kw",
    reference: "MCHX-30K-R32",
    designation: "Condenseur micro-canaux air 30kW pour R-32/R-454B",
    marque: "Universel",
    categorie: "echangeur",
    compatibilitesEquipements: ["PAC air/eau", "Groupe condensation extérieur", "Climatisation rooftop"],
    fluidesCompatibles: ["R-32", "R-454B", "R-410A"],
    prixEstimeHt: 890,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "ech-evap-vitrine-12kw",
    reference: "EVAP-VR-12K-R448",
    designation: "Évaporateur vitrine réfrigérée 12kW R-448A",
    marque: "Universel",
    categorie: "echangeur",
    compatibilitesEquipements: ["Vitrine boucherie", "Vitrine charcuterie", "Meuble froid commercial"],
    fluidesCompatibles: ["R-448A", "R-449A", "R-452A"],
    prixEstimeHt: 540,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife", "gazechim"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "ech-plaques-brasees-15kw",
    reference: "PHE-B3-50-30",
    designation: "Échangeur à plaques brasées inox 15kW",
    marque: "SWEP / Alfa Laval",
    categorie: "echangeur",
    compatibilitesEquipements: ["PAC air/eau", "Chiller", "Récupération chaleur"],
    fluidesCompatibles: ["R-32", "R-410A", "R-454B", "R-134a"],
    prixEstimeHt: 380,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife"],
    uniteVente: "pièce",
    enStock: true,
  },

  // ========== DETENDEURS ==========
  {
    id: "det-danfoss-tge-5",
    reference: "TGE-5",
    designation: "Détendeur thermostatique Danfoss TGE-5 — équilibre externe — R-410A/R-32",
    marque: "Danfoss",
    categorie: "detendeur",
    compatibilitesEquipements: ["Évaporateurs ventilés", "Climatisation tertiaire", "Vitrines positives"],
    fluidesCompatibles: ["R-410A", "R-32", "R-454B"],
    prixEstimeHt: 142,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france", "climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "det-danfoss-ete-2b",
    reference: "ETS 6",
    designation: "Détendeur électronique Danfoss ETS 6 + driver EKE 100",
    marque: "Danfoss",
    categorie: "detendeur",
    compatibilitesEquipements: ["Chambres froides régulées", "PAC inverter", "Chiller variable"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-454B", "R-448A"],
    prixEstimeHt: 485,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "kit (vanne + driver)",
    enStock: true,
  },
  {
    id: "det-honeywell-tmx-8",
    reference: "TMX-8 R448",
    designation: "Détendeur thermostatique Honeywell TMX-8 R-448A",
    marque: "Honeywell",
    categorie: "detendeur",
    compatibilitesEquipements: ["Vitrines négatives", "Chambres froides négatives"],
    fluidesCompatibles: ["R-448A", "R-449A"],
    prixEstimeHt: 165,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife"],
    uniteVente: "pièce",
    enStock: true,
  },

  // ========== VANNES ==========
  {
    id: "vanne-4v-fujikoki-stf-h",
    reference: "STF-H-12",
    designation: "Vanne 4 voies inversion Fujikoki STF-H — 12kW",
    marque: "Fujikoki",
    categorie: "vanne",
    compatibilitesEquipements: ["PAC réversible", "Climatisation split réversible"],
    fluidesCompatibles: ["R-410A", "R-32", "R-454B"],
    prixEstimeHt: 285,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "vanne-sol-danfoss-evr-15",
    reference: "EVR-15",
    designation: "Vanne solénoïde Danfoss EVR 15 — NF — corps brasé",
    marque: "Danfoss",
    categorie: "vanne",
    compatibilitesEquipements: ["Ligne liquide", "Pump-down", "Dégivrage"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-448A", "R-449A", "R-407C"],
    prixEstimeHt: 95,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france", "climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "vanne-bille-castel-6590",
    reference: "6590/5",
    designation: "Vanne à bille Castel 6590 — corps acier — 5/8\"",
    marque: "Castel",
    categorie: "vanne",
    compatibilitesEquipements: ["Toutes installations", "Ligne liquide ou aspiration"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-448A", "R-449A", "R-407C", "R-404A"],
    prixEstimeHt: 38,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife", "gazechim"],
    uniteVente: "pièce",
    enStock: true,
  },

  // ========== FILTRES DESHYDRATEURS ==========
  {
    id: "filtre-danfoss-dml-053",
    reference: "DML 053",
    designation: "Filtre déshydrateur Danfoss DML 053 — 3/8\" SAE — toutes huiles",
    marque: "Danfoss",
    categorie: "filtre",
    compatibilitesEquipements: ["Toutes installations", "Ligne liquide"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-448A", "R-449A", "R-407C", "R-1234yf"],
    prixEstimeHt: 24,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france", "climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "filtre-danfoss-dcl-164",
    reference: "DCL 164",
    designation: "Filtre déshydrateur Danfoss DCL 164 — 1/2\" — huiles POE",
    marque: "Danfoss",
    categorie: "filtre",
    compatibilitesEquipements: ["Installations HFC/HFO neuves", "Conversion fluide"],
    fluidesCompatibles: ["R-410A", "R-32", "R-454B", "R-448A", "R-449A"],
    prixEstimeHt: 32,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "filtre-castel-4308-4",
    reference: "4308/4",
    designation: "Filtre déshydrateur Castel 4308/4 — 1/2\" — usage général",
    marque: "Castel",
    categorie: "filtre",
    compatibilitesEquipements: ["Installations résidentielles", "Climatisation split"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-407C"],
    prixEstimeHt: 18,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife", "gazechim"],
    uniteVente: "pièce",
    enStock: true,
  },

  // ========== PRESSOSTATS / CONTROLEURS ==========
  {
    id: "pres-danfoss-kp1",
    reference: "KP 1",
    designation: "Pressostat BP Danfoss KP 1 — réarmement auto — différentiel réglable",
    marque: "Danfoss",
    categorie: "pressostat_controleur",
    compatibilitesEquipements: ["Tous compresseurs", "Sécurité BP"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-448A", "R-449A", "R-407C"],
    prixEstimeHt: 78,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france", "climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "pres-danfoss-kp5",
    reference: "KP 5",
    designation: "Pressostat HP Danfoss KP 5 — réarmement manuel — 8-32 bar",
    marque: "Danfoss",
    categorie: "pressostat_controleur",
    compatibilitesEquipements: ["Tous compresseurs", "Sécurité HP"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-448A", "R-449A", "R-407C"],
    prixEstimeHt: 96,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france", "climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "pres-danfoss-kp15-double",
    reference: "KP 15",
    designation: "Pressostat double HP/BP Danfoss KP 15 — réarmement manuel HP",
    marque: "Danfoss",
    categorie: "pressostat_controleur",
    compatibilitesEquipements: ["Compresseurs semi-hermétiques", "Groupes condensation"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-448A", "R-449A", "R-407C", "R-404A"],
    prixEstimeHt: 165,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "pièce",
    enStock: true,
  },

  // ========== CAPTEURS / SONDES ==========
  {
    id: "sonde-pt100-ako-15410",
    reference: "AKO-15410",
    designation: "Sonde PT100 AKO inox étanche — câble 3m — chambre froide",
    marque: "AKO",
    categorie: "capteur_sonde",
    compatibilitesEquipements: ["Régulateurs Eliwell", "Régulateurs AKO", "Régulateurs Carel"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 45,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["distrifroid"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "sonde-ntc-eliwell-sn7m",
    reference: "SN7M0150",
    designation: "Sonde NTC Eliwell SN7M — 1.5m — IP67",
    marque: "Eliwell",
    categorie: "capteur_sonde",
    compatibilitesEquipements: ["Régulateurs Eliwell ID", "Régulateurs IDPlus"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 28,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["distrifroid"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "capt-pression-danfoss-akssp",
    reference: "AKS 32R",
    designation: "Capteur de pression Danfoss AKS 32R — 0-34 bar — sortie 4-20mA",
    marque: "Danfoss",
    categorie: "capteur_sonde",
    compatibilitesEquipements: ["Régulateurs électroniques", "GMAO/télégestion"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-448A", "R-449A"],
    prixEstimeHt: 195,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "pièce",
    enStock: true,
  },

  // ========== REGULATEURS ELECTRONIQUES ==========
  {
    id: "reg-eliwell-idplus-961",
    reference: "IDPlus 961",
    designation: "Régulateur Eliwell IDPlus 961 — 230V — 1 sonde + 1 relais — vitrine positive",
    marque: "Eliwell",
    categorie: "regulateur_electronique",
    compatibilitesEquipements: ["Vitrines réfrigérées", "Meubles froids commerciaux"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 142,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["distrifroid"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "reg-ako-d14112",
    reference: "AKO-D14112",
    designation: "Régulateur AKO-D14112 — 230V — chambre froide négative — dégivrage",
    marque: "AKO",
    categorie: "regulateur_electronique",
    compatibilitesEquipements: ["Chambres froides négatives", "Surgelés"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 218,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["distrifroid"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "reg-carel-easy-y",
    reference: "PJEZS00000",
    designation: "Régulateur Carel Easy Y — 230V — économique — vitrine simple",
    marque: "Carel",
    categorie: "regulateur_electronique",
    compatibilitesEquipements: ["Vitrines positives", "Meubles froids simples"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 78,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["distrifroid"],
    uniteVente: "pièce",
    enStock: true,
  },

  // ========== CONSOMMABLES ==========
  {
    id: "huile-poe-mobile-eal-arctic-32",
    reference: "EAL Arctic 32",
    designation: "Huile POE Mobil EAL Arctic 32 — bidon 5L — installations HFC/HFO",
    marque: "Mobil",
    categorie: "consommable",
    compatibilitesEquipements: ["Tous compresseurs HFC/HFO récents"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-454B", "R-448A", "R-449A"],
    prixEstimeHt: 78,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife"],
    uniteVente: "bidon 5L",
    enStock: true,
  },
  {
    id: "azote-bouteille-50l",
    reference: "N2-50L-200B",
    designation: "Bouteille azote 50L 200 bar — épreuve étanchéité + tirage au vide",
    marque: "Air Liquide / Linde",
    categorie: "consommable",
    compatibilitesEquipements: ["Mise en service", "Test étanchéité avant charge"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 145,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife", "gazechim"],
    uniteVente: "bouteille consignée",
    enStock: true,
  },
  {
    id: "brasure-castolin-1818",
    reference: "Castolin 1818",
    designation: "Brasure Castolin 1818 argent 15% — baguette 2mm — tube/tube cuivre",
    marque: "Castolin",
    categorie: "consommable",
    compatibilitesEquipements: ["Raccordement frigorifique cuivre"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 14,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["gazechim"],
    uniteVente: "baguette",
    enStock: true,
  },
  {
    id: "joint-flare-cuivre-3-8",
    reference: "FL-CU-3/8",
    designation: "Joint flare cuivre 3/8\" pour raccord SAE — sachet 10 pcs",
    marque: "Universel",
    categorie: "consommable",
    compatibilitesEquipements: ["Raccords split", "Climatiseur résidentiel/tertiaire"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 8,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["gazechim"],
    uniteVente: "sachet 10 pcs",
    enStock: true,
  },

  // ========== DETECTION FUITE ==========
  {
    id: "detecteur-fuite-d-tek-3",
    reference: "D-TEK 3",
    designation: "Détecteur de fuite électronique INFICON D-TEK 3 — sensibilité 1.4g/an — NF EN 14624",
    marque: "INFICON",
    categorie: "detection_fuite",
    compatibilitesEquipements: ["Contrôle étanchéité réglementaire"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-454B", "R-448A", "R-1234yf"],
    prixEstimeHt: 685,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife"],
    uniteVente: "pièce + valise",
    enStock: true,
  },
  {
    id: "fluo-tracerline-tp-3900",
    reference: "TP-3900-0601",
    designation: "Traceur fluorescent UV Tracerline TP-3900 — flacon 240ml — multifluide",
    marque: "Tracerline",
    categorie: "detection_fuite",
    compatibilitesEquipements: ["Détection fuite UV", "Inspection circuit fermé"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-448A", "R-449A"],
    prixEstimeHt: 89,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife"],
    uniteVente: "flacon 240ml",
    enStock: true,
  },
  {
    id: "spray-frionett-1l",
    reference: "Frionett Activ N",
    designation: "Spray détection fuite mousse Frionett Activ' N — 1L — usage extérieur",
    marque: "Climalife",
    categorie: "detection_fuite",
    compatibilitesEquipements: ["Inspection visuelle raccords accessibles"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 18,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife"],
    uniteVente: "spray 1L",
    enStock: true,
  },

  // ========== COMPRESSEURS — EXTENSION CATALOGUE ==========
  {
    id: "comp-bitzer-2kes-05y",
    reference: "2KES-05Y-40S",
    designation: "Compresseur Bitzer 2KES-05Y semi-hermétique — 0,5cv — R-134a/R-450A",
    marque: "Bitzer",
    categorie: "compresseur",
    compatibilitesEquipements: ["Vitrine boucherie petite", "Armoire négative pro"],
    fluidesCompatibles: ["R-134a", "R-450A", "R-513A"],
    prixEstimeHt: 540,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["bitzer-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "comp-bitzer-6fe-50y",
    reference: "6FE-50Y-40S",
    designation: "Compresseur Bitzer 6FE-50Y semi-hermétique — 50cv — froid commercial central",
    marque: "Bitzer",
    categorie: "compresseur",
    compatibilitesEquipements: ["Centrale froid supermarché", "Grosse chambre froide"],
    fluidesCompatibles: ["R-448A", "R-449A", "R-452A"],
    prixEstimeHt: 8950,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["bitzer-france", "carrier-profroid"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "comp-bitzer-csh-7553",
    reference: "CSH7553-50Y",
    designation: "Compresseur Bitzer CSH7553 vis semi-hermétique — 75cv — industriel",
    marque: "Bitzer",
    categorie: "compresseur",
    compatibilitesEquipements: ["Chiller industriel", "Centrale froid grande surface"],
    fluidesCompatibles: ["R-134a", "R-1234ze", "R-513A"],
    prixEstimeHt: 14500,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["bitzer-france"],
    uniteVente: "pièce",
    enStock: false,
    delaiSpecifiqueJours: { min: 14, max: 28 },
  },
  {
    id: "comp-copeland-zr-36",
    reference: "ZR36KCE-TFD-522",
    designation: "Compresseur scroll Copeland ZR36 — 3cv — clim résidentiel/tertiaire",
    marque: "Copeland",
    categorie: "compresseur",
    compatibilitesEquipements: ["Climatiseur split tertiaire", "Petite PAC air/eau"],
    fluidesCompatibles: ["R-407C", "R-410A", "R-32"],
    prixEstimeHt: 685,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["copeland", "climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "comp-copeland-zf-09",
    reference: "ZF09K4E-TFD-551",
    designation: "Compresseur Copeland ZF09 scroll basse température — 1cv R-404A/R-448A",
    marque: "Copeland",
    categorie: "compresseur",
    compatibilitesEquipements: ["Vitrine négative", "Armoire surgelée"],
    fluidesCompatibles: ["R-404A", "R-448A", "R-449A"],
    prixEstimeHt: 545,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["copeland"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "comp-danfoss-mtz-50",
    reference: "MTZ50-4VI",
    designation: "Compresseur Danfoss Maneurop MTZ50 — 4cv R-407C/R-22 retrofit",
    marque: "Danfoss",
    categorie: "compresseur",
    compatibilitesEquipements: ["Installations anciennes R-22 retrofitées", "Chambres froides 4-8 kW"],
    fluidesCompatibles: ["R-407C", "R-407F", "R-448A"],
    prixEstimeHt: 1280,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "comp-danfoss-sh-180",
    reference: "SH180A4ALC",
    designation: "Compresseur Danfoss Performer SH180 scroll — 15cv R-410A — clim tertiaire",
    marque: "Danfoss",
    categorie: "compresseur",
    compatibilitesEquipements: ["Climatisation tertiaire", "PAC air/eau 40 kW"],
    fluidesCompatibles: ["R-410A", "R-32", "R-407C"],
    prixEstimeHt: 1850,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "comp-tecumseh-aj2425",
    reference: "AJ2425Z",
    designation: "Compresseur Tecumseh AJ2425Z hermétique — 1/2 cv R-134a — petit commercial",
    marque: "Tecumseh",
    categorie: "compresseur",
    compatibilitesEquipements: ["Vitrine boulangerie", "Mini-chambre froide", "Distributeur boissons"],
    fluidesCompatibles: ["R-134a", "R-513A"],
    prixEstimeHt: 285,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["tecumseh-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "comp-tecumseh-silensys-fh4540",
    reference: "FH4540Z-XG",
    designation: "Groupe condensation Silensys FH4540 — 4cv R-134a — extérieur silencieux",
    marque: "Tecumseh",
    categorie: "compresseur",
    compatibilitesEquipements: ["Chambre froide positive resto", "Vitrine boulangerie"],
    fluidesCompatibles: ["R-134a", "R-513A"],
    prixEstimeHt: 1450,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["tecumseh-france", "friga-bohn"],
    uniteVente: "groupe complet",
    enStock: true,
  },
  {
    id: "comp-frascold-z25",
    reference: "Z25-94Y",
    designation: "Compresseur Frascold Z25-94Y piston semi-hermétique — 25cv R-448A",
    marque: "Frascold",
    categorie: "compresseur",
    compatibilitesEquipements: ["Centrale froid commercial", "Industrie alimentaire"],
    fluidesCompatibles: ["R-448A", "R-449A", "R-452A", "R-134a"],
    prixEstimeHt: 5800,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["frascold-france"],
    uniteVente: "pièce",
    enStock: false,
    delaiSpecifiqueJours: { min: 10, max: 21 },
  },

  // ========== ECHANGEURS — EXTENSION ==========
  {
    id: "ech-luve-stmc-25kw",
    reference: "STMC-CL-25",
    designation: "Condenseur Lu-Ve STMC-CL 25kW — air forcé — usage extérieur tertiaire",
    marque: "Lu-Ve",
    categorie: "echangeur",
    compatibilitesEquipements: ["PAC air/eau tertiaire", "Groupe extérieur clim"],
    fluidesCompatibles: ["R-410A", "R-32", "R-454B"],
    prixEstimeHt: 1240,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["lu-ve-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "ech-luve-shvn-8kw",
    reference: "SHVN-8E",
    designation: "Évaporateur Lu-Ve SHVN-8E 8kW — chambre froide positive — dégivrage électrique",
    marque: "Lu-Ve",
    categorie: "echangeur",
    compatibilitesEquipements: ["Chambre froide positive 20-40 m³", "Resto pro"],
    fluidesCompatibles: ["R-448A", "R-449A", "R-134a", "R-513A"],
    prixEstimeHt: 685,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["lu-ve-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "ech-guntner-aghn-50kw",
    reference: "AGHN-V-050.1A",
    designation: "Condenseur Güntner AGHN 50kW — datacenters + industriel",
    marque: "Güntner",
    categorie: "echangeur",
    compatibilitesEquipements: ["Datacenter cooling", "Process industriel", "Chiller eau glacée"],
    fluidesCompatibles: ["R-410A", "R-454B", "R-1234ze", "R-134a"],
    prixEstimeHt: 2980,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["guntner-france"],
    uniteVente: "pièce",
    enStock: false,
    delaiSpecifiqueJours: { min: 14, max: 35 },
  },
  {
    id: "ech-fribohn-gn-3kw",
    reference: "GN3MA-3",
    designation: "Évaporateur Friga-Bohn GN3MA 3kW — petite chambre froide négative",
    marque: "Friga-Bohn",
    categorie: "echangeur",
    compatibilitesEquipements: ["Chambre froide négative <10 m³", "Boucherie/poissonnerie"],
    fluidesCompatibles: ["R-448A", "R-449A", "R-452A"],
    prixEstimeHt: 420,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["friga-bohn"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "ech-swep-b25t-40",
    reference: "B25T-40",
    designation: "Échangeur à plaques brasées SWEP B25T 40 plaques — 30kW",
    marque: "SWEP",
    categorie: "echangeur",
    compatibilitesEquipements: ["PAC air/eau résidentiel/tertiaire", "Récupération chaleur"],
    fluidesCompatibles: ["R-410A", "R-32", "R-454B", "R-134a"],
    prixEstimeHt: 640,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife", "gazechim-froid"],
    uniteVente: "pièce",
    enStock: true,
  },

  // ========== DETENDEURS — EXTENSION ==========
  {
    id: "det-danfoss-tge-3",
    reference: "TGE-3",
    designation: "Détendeur thermostatique Danfoss TGE-3 — petit débit R-410A",
    marque: "Danfoss",
    categorie: "detendeur",
    compatibilitesEquipements: ["Splits clim 2-5 kW", "Petite vitrine"],
    fluidesCompatibles: ["R-410A", "R-32", "R-454B"],
    prixEstimeHt: 95,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france", "climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "det-danfoss-tge-10",
    reference: "TGE-10",
    designation: "Détendeur thermostatique Danfoss TGE-10 — gros débit R-410A — tertiaire",
    marque: "Danfoss",
    categorie: "detendeur",
    compatibilitesEquipements: ["Climatiseurs tertiaires 20-30 kW", "PAC air/eau moyennes"],
    fluidesCompatibles: ["R-410A", "R-32", "R-454B"],
    prixEstimeHt: 195,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "det-danfoss-t2-2",
    reference: "T2-2",
    designation: "Détendeur thermostatique Danfoss T2-2 — R-134a — petite vitrine commerce",
    marque: "Danfoss",
    categorie: "detendeur",
    compatibilitesEquipements: ["Vitrine boulangerie", "Petit meuble froid"],
    fluidesCompatibles: ["R-134a", "R-513A"],
    prixEstimeHt: 88,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "det-honeywell-r-3",
    reference: "R-3 R449",
    designation: "Détendeur thermostatique Sporlan R-3 — R-449A — froid commercial moyen",
    marque: "Honeywell Sporlan",
    categorie: "detendeur",
    compatibilitesEquipements: ["Vitrines réfrigérées", "Chambres froides 10-30 m³"],
    fluidesCompatibles: ["R-449A", "R-448A", "R-407F"],
    prixEstimeHt: 178,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["honeywell-sporlan", "climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "det-carel-eev-e2v",
    reference: "E2V14BSF00",
    designation: "Détendeur électronique Carel E2V14 + driver EVD evolution — bipolaire",
    marque: "Carel",
    categorie: "detendeur",
    compatibilitesEquipements: ["Vitrines régulées EEV", "Chambres froides modernes", "Chiller variable"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-454B", "R-448A"],
    prixEstimeHt: 425,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["carel-france"],
    uniteVente: "kit (vanne + driver)",
    enStock: true,
  },

  // ========== VANNES — EXTENSION ==========
  {
    id: "vanne-sol-danfoss-evr-3",
    reference: "EVR-3",
    designation: "Vanne solénoïde Danfoss EVR 3 — 1/4\" SAE — petite installation",
    marque: "Danfoss",
    categorie: "vanne",
    compatibilitesEquipements: ["Splits", "Vitrines simples"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-448A", "R-449A"],
    prixEstimeHt: 62,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "vanne-sol-danfoss-evr-25",
    reference: "EVR-25",
    designation: "Vanne solénoïde Danfoss EVR 25 — 1\" — gros débit industriel",
    marque: "Danfoss",
    categorie: "vanne",
    compatibilitesEquipements: ["Centrales froid commercial", "Process industriel"],
    fluidesCompatibles: ["R-448A", "R-449A", "R-407C", "R-134a"],
    prixEstimeHt: 175,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "vanne-4v-saginomiya-skv-h",
    reference: "SKV-H-20",
    designation: "Vanne 4 voies Saginomiya SKV-H — 20kW — inversion PAC",
    marque: "Saginomiya",
    categorie: "vanne",
    compatibilitesEquipements: ["PAC réversible tertiaire", "Multi-split inverter"],
    fluidesCompatibles: ["R-410A", "R-32", "R-454B"],
    prixEstimeHt: 385,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "vanne-bille-castel-6590-3",
    reference: "6590/3",
    designation: "Vanne à bille Castel 6590 — corps acier — 3/8\"",
    marque: "Castel",
    categorie: "vanne",
    compatibilitesEquipements: ["Installations résidentielles", "Splits"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-448A", "R-449A"],
    prixEstimeHt: 28,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["castel-france", "climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "vanne-bille-castel-6590-7-8",
    reference: "6590/7",
    designation: "Vanne à bille Castel 6590 — corps acier — 7/8\"",
    marque: "Castel",
    categorie: "vanne",
    compatibilitesEquipements: ["Tertiaire moyen", "Aspiration haute capacité"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-448A", "R-449A", "R-407C"],
    prixEstimeHt: 65,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["castel-france", "climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "robinet-castel-6310-3",
    reference: "6310/3",
    designation: "Robinet à pointeau Castel 6310 — 3/8\" — charge fluide",
    marque: "Castel",
    categorie: "vanne",
    compatibilitesEquipements: ["Point de charge ligne liquide", "Toutes installations"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 18,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["castel-france", "gazechim-froid"],
    uniteVente: "pièce",
    enStock: true,
  },

  // ========== FILTRES — EXTENSION ==========
  {
    id: "filtre-danfoss-dml-032",
    reference: "DML 032",
    designation: "Filtre déshydrateur Danfoss DML 032 — 1/4\" SAE — usage général",
    marque: "Danfoss",
    categorie: "filtre",
    compatibilitesEquipements: ["Splits clim résidentiel", "Petites vitrines"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-448A", "R-449A", "R-1234yf"],
    prixEstimeHt: 16,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "filtre-danfoss-dml-083",
    reference: "DML 083",
    designation: "Filtre déshydrateur Danfoss DML 083 — 5/8\" SAE — tertiaire",
    marque: "Danfoss",
    categorie: "filtre",
    compatibilitesEquipements: ["Climatisation tertiaire", "PAC air/eau moyennes"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-448A", "R-449A"],
    prixEstimeHt: 38,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "filtre-danfoss-dml-417s",
    reference: "DML 417s",
    designation: "Filtre déshydrateur Danfoss DML 417s — 7/8\" ODM — central froid commercial",
    marque: "Danfoss",
    categorie: "filtre",
    compatibilitesEquipements: ["Centrales froid commercial", "Chambres froides industrielles"],
    fluidesCompatibles: ["R-448A", "R-449A", "R-407C", "R-134a"],
    prixEstimeHt: 78,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "filtre-castel-4316-6",
    reference: "4316/6",
    designation: "Filtre déshydrateur Castel 4316 — 7/8\" — anti-acide post-burn-out",
    marque: "Castel",
    categorie: "filtre",
    compatibilitesEquipements: ["Reprise post-burn-out compresseur", "Conversion fluide retrofit"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-448A", "R-449A", "R-407C"],
    prixEstimeHt: 95,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["castel-france", "climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "voyant-castel-3940-3",
    reference: "3940/3",
    designation: "Voyant liquide Castel 3940 — 3/8\" SAE — avec indicateur humidité",
    marque: "Castel",
    categorie: "filtre",
    compatibilitesEquipements: ["Ligne liquide toutes installations"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 22,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["castel-france", "gazechim-froid"],
    uniteVente: "pièce",
    enStock: true,
  },

  // ========== PRESSOSTATS / CONTROLEURS — EXTENSION ==========
  {
    id: "pres-danfoss-mp55a-bp",
    reference: "MP55A",
    designation: "Pressostat différentiel d'huile Danfoss MP55A — sécurité compresseur",
    marque: "Danfoss",
    categorie: "pressostat_controleur",
    compatibilitesEquipements: ["Compresseurs semi-hermétiques", "Compresseurs ouverts"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 245,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "transmetteur-danfoss-akssz",
    reference: "AKS 2050",
    designation: "Transmetteur de pression Danfoss AKS 2050 — 0-30 bar — sortie ratiométrique",
    marque: "Danfoss",
    categorie: "pressostat_controleur",
    compatibilitesEquipements: ["Régulation électronique avancée", "GMAO"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-448A", "R-449A"],
    prixEstimeHt: 285,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "pres-danfoss-rt-112",
    reference: "RT 112",
    designation: "Thermostat ambiance Danfoss RT 112 — bulbe + capillaire 2m — robuste",
    marque: "Danfoss",
    categorie: "pressostat_controleur",
    compatibilitesEquipements: ["Chambres froides", "Ambiances industrielles"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 145,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "pres-castel-6541-1n",
    reference: "6541/1N",
    designation: "Pressostat sécurité HP Castel 6541 — non réarmable — 7-40 bar",
    marque: "Castel",
    categorie: "pressostat_controleur",
    compatibilitesEquipements: ["Sécurité HP économique", "Petits compresseurs"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-407C"],
    prixEstimeHt: 48,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["castel-france"],
    uniteVente: "pièce",
    enStock: true,
  },

  // ========== CAPTEURS / SONDES — EXTENSION ==========
  {
    id: "sonde-eliwell-sn7p-5m",
    reference: "SN7P0500",
    designation: "Sonde NTC Eliwell SN7P — câble 5m — IP67 — chambre froide",
    marque: "Eliwell",
    categorie: "capteur_sonde",
    compatibilitesEquipements: ["Régulateurs Eliwell série ID"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 38,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["eliwell-france", "distrifroid"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "sonde-carel-ntc-stz",
    reference: "NTC*JG00",
    designation: "Sonde NTC Carel — 3m IP68 — produit alimentaire — inox brossé",
    marque: "Carel",
    categorie: "capteur_sonde",
    compatibilitesEquipements: ["Régulateurs Carel", "Cellules de refroidissement"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 42,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["carel-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "sonde-pt1000-ako-15715",
    reference: "AKO-15715",
    designation: "Sonde PT1000 AKO — câble 10m — chambre froide industrielle",
    marque: "AKO",
    categorie: "capteur_sonde",
    compatibilitesEquipements: ["Régulateurs AKO", "GTC/GTB"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 65,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["distrifroid"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "sonde-humidite-carel-dpwq",
    reference: "DPWQ110000",
    designation: "Sonde humidité + température Carel DPWQ — 0-100% RH — IP55",
    marque: "Carel",
    categorie: "capteur_sonde",
    compatibilitesEquipements: ["Cellules de maturation", "Caves d'affinage"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 165,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["carel-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "transmetteur-temp-danfoss-mbt-153",
    reference: "MBT 153",
    designation: "Transmetteur température Danfoss MBT 153 — PT100 — sortie 4-20mA",
    marque: "Danfoss",
    categorie: "capteur_sonde",
    compatibilitesEquipements: ["Process industriel", "Régulation avancée"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 295,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["danfoss-france"],
    uniteVente: "pièce",
    enStock: true,
  },

  // ========== REGULATEURS — EXTENSION ==========
  {
    id: "reg-eliwell-id974",
    reference: "ID974",
    designation: "Régulateur Eliwell ID974 — 230V — 4 relais + 4 sondes — chambre froide complète",
    marque: "Eliwell",
    categorie: "regulateur_electronique",
    compatibilitesEquipements: ["Chambres froides positives/négatives complètes"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 285,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["eliwell-france", "distrifroid"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "reg-eliwell-ewnext-902",
    reference: "EWNext 902",
    designation: "Régulateur Eliwell EWNext 902 — 230V — IoT cloud-ready",
    marque: "Eliwell",
    categorie: "regulateur_electronique",
    compatibilitesEquipements: ["Installations connectées", "Supervision distance"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 385,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["eliwell-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "reg-carel-pcocompact-h",
    reference: "PCOSPYC0X0",
    designation: "Régulateur programmable Carel pCO compact — chillers + centrales froid",
    marque: "Carel",
    categorie: "regulateur_electronique",
    compatibilitesEquipements: ["Chillers", "Centrales multi-compresseurs", "Process industriel"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 685,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["carel-france"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "reg-dixell-xr60cx",
    reference: "XR60CX-5N0C1",
    designation: "Régulateur Dixell XR60CX — 230V — 4 relais — vitrine négative",
    marque: "Dixell (Emerson Copeland)",
    categorie: "regulateur_electronique",
    compatibilitesEquipements: ["Vitrines négatives", "Meubles surgelés", "Petites chambres"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 215,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["copeland", "distrifroid"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "centrale-dixell-ic200cx",
    reference: "IC200CX-110000",
    designation: "Centrale Dixell iChill IC200CX — pilotage chiller jusqu'à 4 compresseurs",
    marque: "Dixell (Emerson Copeland)",
    categorie: "regulateur_electronique",
    compatibilitesEquipements: ["Chillers eau glacée", "Multi-compresseurs", "Tertiaire"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 985,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["copeland"],
    uniteVente: "pièce",
    enStock: true,
  },

  // ========== CONSOMMABLES — EXTENSION ==========
  {
    id: "huile-poe-emkarate-rl32",
    reference: "RL 32H",
    designation: "Huile POE Emkarate RL32H — bidon 5L — synthétique pour HFC/HFO",
    marque: "Lubrizol Emkarate",
    categorie: "consommable",
    compatibilitesEquipements: ["Tous compresseurs HFC modernes"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-454B", "R-448A", "R-449A"],
    prixEstimeHt: 68,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife", "gazechim-froid"],
    uniteVente: "bidon 5L",
    enStock: true,
  },
  {
    id: "huile-pve-fuchs-reniso-triton",
    reference: "Reniso Triton SE 55",
    designation: "Huile PVE Fuchs Reniso Triton SE 55 — bidon 5L — spécial R-32/R-454B",
    marque: "Fuchs",
    categorie: "consommable",
    compatibilitesEquipements: ["Compresseurs R-32 récents", "PAC air/eau modernes"],
    fluidesCompatibles: ["R-32", "R-454B", "R-410A"],
    prixEstimeHt: 89,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife"],
    uniteVente: "bidon 5L",
    enStock: true,
  },
  {
    id: "tube-cuivre-armaflex-15-9",
    reference: "AF-15X1/4-2M",
    designation: "Tube cuivre frigorifique 1/4\" + isolation Armaflex 15mm — couronne 2m",
    marque: "Armacell + Sofamel",
    categorie: "consommable",
    compatibilitesEquipements: ["Raccordement split résidentiel"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 16,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["cedeo", "wurth-france"],
    uniteVente: "couronne 2m",
    enStock: true,
  },
  {
    id: "tube-cuivre-cu-3-8-50m",
    reference: "CU-3/8-RAW",
    designation: "Tube cuivre dégraissé frigo 3/8\" recuit — couronne 50m",
    marque: "KME / Sofamel",
    categorie: "consommable",
    compatibilitesEquipements: ["Installation neuve", "Réfection circuit"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 215,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["cedeo", "gazechim-froid"],
    uniteVente: "couronne 50m",
    enStock: true,
  },
  {
    id: "kit-flare-cps-blocks",
    reference: "FT-808-M",
    designation: "Dudgeonneuse excentrique CPS FT-808 — kit complet 6 matrices",
    marque: "CPS Products",
    categorie: "consommable",
    compatibilitesEquipements: ["Tous diamètres flares standard SAE"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 185,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife", "gazechim-froid"],
    uniteVente: "kit",
    enStock: true,
  },
  {
    id: "nettoyant-frionett-tropical-5l",
    reference: "Frionett Tropical",
    designation: "Nettoyant climatisation Frionett Tropical — bidon 5L — concentré",
    marque: "Climalife",
    categorie: "consommable",
    compatibilitesEquipements: ["Maintenance préventive clim/PAC"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 42,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife"],
    uniteVente: "bidon 5L",
    enStock: true,
  },

  // ========== DETECTION FUITE — EXTENSION ==========
  {
    id: "detecteur-fuite-inficon-whisper",
    reference: "Whisper",
    designation: "Détecteur de fuite INFICON Whisper — entrée de gamme — multifluide HFC/HFO",
    marque: "INFICON",
    categorie: "detection_fuite",
    compatibilitesEquipements: ["Contrôle étanchéité petite installation"],
    fluidesCompatibles: ["R-410A", "R-32", "R-134a", "R-454B", "R-1234yf"],
    prixEstimeHt: 285,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife"],
    uniteVente: "pièce",
    enStock: true,
  },
  {
    id: "etalon-bottle-tek-mate",
    reference: "705-202-G1",
    designation: "Bouteille étalonnage INFICON Tek-Mate — fluide R-22 traceur — vérification annuelle",
    marque: "INFICON",
    categorie: "detection_fuite",
    compatibilitesEquipements: ["Étalonnage détecteurs annuel obligatoire NF EN 14624"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 95,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife"],
    uniteVente: "bouteille étalon",
    enStock: true,
  },
  {
    id: "lampe-uv-tracerline-tp9940",
    reference: "TP-9940",
    designation: "Lampe UV Tracerline TP-9940 — LED 12V — usage détection traceur fluo",
    marque: "Tracerline",
    categorie: "detection_fuite",
    compatibilitesEquipements: ["Inspection circuit traceur UV"],
    fluidesCompatibles: ["*"],
    prixEstimeHt: 215,
    prixSource: PRIX_SOURCE_MARCHE,
    fournisseurIds: ["climalife"],
    uniteVente: "pièce + sacoche",
    enStock: true,
  },
];

// ----------------------------------------------------------------------------
// HELPERS DE RECHERCHE
// ----------------------------------------------------------------------------

export const CATEGORIE_LABELS: Record<CategoriePiece, string> = {
  compresseur: "Compresseurs",
  echangeur: "Échangeurs (cond. / évap.)",
  detendeur: "Détendeurs",
  vanne: "Vannes",
  filtre: "Filtres déshydrateurs",
  pressostat_controleur: "Pressostats & contrôleurs",
  capteur_sonde: "Capteurs & sondes",
  regulateur_electronique: "Régulateurs électroniques",
  consommable: "Consommables (huiles, azote, brasure)",
  detection_fuite: "Détection de fuite",
};

export function getFournisseur(id: string): Fournisseur | undefined {
  return FOURNISSEURS.find((f) => f.id === id);
}

// Calcule le prix TTC vu par le frigoriste, incluant la commission Vertxia.
// La commission est integree au prix (modele transparent : "Commission incluse")
// plutot que facturee separement (modele frictionnel a eviter).
export function calculerPrixAvecCommission(
  prixHt: number,
  tauxCommission: number
): { prixHt: number; commissionHt: number; prixHtTotal: number } {
  const commissionHt = Math.round(prixHt * tauxCommission * 100) / 100;
  return {
    prixHt,
    commissionHt,
    prixHtTotal: Math.round((prixHt + commissionHt) * 100) / 100,
  };
}

// Recherche dans le catalogue par texte libre (designation, reference, marque).
// Pas de fuzzy matching pour l'instant : juste includes lowercase tolerant
// aux accents via normalisation NFD.
function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function rechercherPieces(query: string): PieceDetachee[] {
  const q = normalize(query.trim());
  if (!q) return PIECES_CATALOGUE;
  return PIECES_CATALOGUE.filter((p) => {
    return (
      normalize(p.designation).includes(q) ||
      normalize(p.reference).includes(q) ||
      normalize(p.marque).includes(q) ||
      p.compatibilitesEquipements.some((c) => normalize(c).includes(q)) ||
      p.fluidesCompatibles.some((f) => normalize(f).includes(q))
    );
  });
}

// Filtre par categorie.
export function piecesParCategorie(categorie: CategoriePiece): PieceDetachee[] {
  return PIECES_CATALOGUE.filter((p) => p.categorie === categorie);
}

// Filtre par fluide compatible. Utilise quand l'utilisateur arrive depuis
// un diagnostic IA et qu'on veut filtrer aux pieces compatibles avec son fluide.
export function piecesCompatiblesFluide(fluide: string): PieceDetachee[] {
  const fluideUpper = fluide.trim().toUpperCase();
  return PIECES_CATALOGUE.filter(
    (p) =>
      p.fluidesCompatibles.includes("*") ||
      p.fluidesCompatibles.some((f) => f.toUpperCase() === fluideUpper)
  );
}

// Trouve les pieces compatibles avec un equipement donne (marque + modele).
// Strategie : tokenise la designation equipement, cherche les pieces dont
// les compatibilitesEquipements contiennent au moins 1 token significatif.
export function piecesCompatiblesEquipement(
  marqueEquipement: string,
  modeleEquipement: string
): PieceDetachee[] {
  const tokens = (marqueEquipement + " " + modeleEquipement)
    .split(/\s+/)
    .map((t) => normalize(t))
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return [];
  return PIECES_CATALOGUE.filter((p) =>
    p.compatibilitesEquipements.some((c) => {
      const compatNorm = normalize(c);
      return tokens.some((t) => compatNorm.includes(t));
    })
  );
}

// Compte agregat utile pour la page racine marketplace.
export const STATS_CATALOGUE = {
  totalPieces: PIECES_CATALOGUE.length,
  totalFournisseurs: FOURNISSEURS.length,
  fournisseursVerifies: FOURNISSEURS.filter((f) => f.urlConfirmee).length,
  parCategorie: Object.fromEntries(
    (Object.keys(CATEGORIE_LABELS) as CategoriePiece[]).map((cat) => [
      cat,
      PIECES_CATALOGUE.filter((p) => p.categorie === cat).length,
    ])
  ),
};
