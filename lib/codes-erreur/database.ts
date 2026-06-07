// Base de codes erreur HVAC multi-marques.
//
// Dataset initial Phase 1 : ~120 codes des 8 marques les plus courantes
// sur le marche FR (residentiel + tertiaire). Source primaire = manuels
// constructeurs publics + sites techniques reconnus (Daikin officiel,
// coolautomation.com, hvactoolkit.org).
//
// IMPORTANT pour le frigoriste : ces causes/etapes sont indicatives. Le
// diagnostic terrain reste prioritaire. Si une intervention est dangereuse
// (haute tension, BP/HP, fluide sous pression), respecter les protocoles
// QualiPAC / QualiFroid et l'EPI obligatoire.
//
// Le dataset est progressivement enrichi par les retours frigoristes
// terrain via le canal de feedback Vertxia.

import type { CodeErreur } from "./types";

// =============================================================================
// DAIKIN — VRV / Sky Air / Split / Multi-split / Altherma
// Sources : daikin.com/products/ac/services/error_codes (PDF SM-TS3 officiel),
// coolautomation.com/blog/daikin-error-and-fault-codes-troubleshooting
// =============================================================================

const DAIKIN: CodeErreur[] = [
  {
    marque: "daikin",
    code: "U0",
    libelle: "Charge en fluide insuffisante",
    description:
      "Sous-charge en refrigerant detectee. La pression d'aspiration ou la temperature de surchauffe est anormale.",
    causesProbables: [
      "Fuite sur le circuit frigorifique (la plus frequente)",
      "Charge initiale insuffisante a l'installation",
      "Capteur de pression BP defaillant",
      "Detendeur electronique bloque ouvert",
    ],
    etapesReparation: [
      "Verifier visuellement la presence d'huile sur les raccords (signe de fuite)",
      "Detecteur de fuite electronique R32/R410A sur tous les raccords brasees",
      "Si fuite identifiee : reparer, tirer au vide 30 min minimum, recharger selon plaque",
      "Si pas de fuite : verifier capteur BP et detendeur electronique",
    ],
    gravite: "critique",
    systemes: ["VRV", "Sky Air", "Split", "Multi-split"],
    sources: [
      "https://www.daikin.com/products/ac/services/error_codes",
      "https://coolautomation.com/blog/daikin-error-and-fault-codes-troubleshooting/",
    ],
  },
  {
    marque: "daikin",
    code: "U2",
    libelle: "Tension d'alimentation anormale",
    description:
      "Tension secteur hors plage admise sur l'unite exterieure (sous-tension ou surtension persistante).",
    causesProbables: [
      "Probleme reseau electrique (chute de tension ligne)",
      "Section de cable d'alimentation insuffisante",
      "Mauvais serrage borniers (echauffement, chute V)",
      "Carte de puissance defectueuse",
    ],
    etapesReparation: [
      "Mesurer tension U/V/W et neutre sous charge sur le bornier exterieur",
      "Comparer a la plaque (typique 230V mono ou 400V tri ±10%)",
      "Verifier serrage borniers + chercher echauffement (camera thermique si dispo)",
      "Si probleme reseau : escalader a l'electricien / fournisseur energie",
    ],
    gravite: "alerte",
    sources: ["https://www.daikin.com/products/ac/services/error_codes"],
  },
  {
    marque: "daikin",
    code: "U4",
    libelle: "Defaut transmission entre unite int. et ext.",
    description:
      "Communication coupee entre la carte de l'unite interieure et la carte de l'unite exterieure (bus F1/F2 ou S1/S2/S3 selon modele).",
    causesProbables: [
      "Cable de communication endommage / mal raccorde",
      "Inversion F1/F2 a la pose",
      "Mauvais contact bornier humidite/oxydation",
      "Carte mere intere ou exter defaillante",
    ],
    etapesReparation: [
      "Verifier la continuite du cable S1-S2-S3 (ou F1-F2 selon modele)",
      "Controler le serrage des borniers cote int + cote ext",
      "Mesurer la tension DC sur F1-F2 (doit pulser ~10-15V DC)",
      "Si OK cablage : remplacer carte mere unite interieure en premier (plus frequent)",
    ],
    gravite: "critique",
    systemes: ["VRV", "Sky Air", "Split", "Multi-split"],
    sources: [
      "https://www.daikin.com/products/ac/services/error_codes",
      "https://coolautomation.com/blog/daikin-error-and-fault-codes-troubleshooting/",
    ],
  },
  {
    marque: "daikin",
    code: "U5",
    libelle: "Defaut transmission telecommande - unite int.",
    description: "Communication coupee entre la telecommande filaire et l'unite interieure.",
    causesProbables: [
      "Cable telecommande coupe / debranche",
      "Telecommande defaillante",
      "Carte d'interface unite interieure HS",
    ],
    etapesReparation: [
      "Verifier le branchement P1/P2 sur la telecommande",
      "Mesurer continuite cable telecommande",
      "Tester avec telecommande de pret pour isoler la defaillance",
    ],
    gravite: "alerte",
    sources: ["https://www.daikin.com/products/ac/services/error_codes"],
  },
  {
    marque: "daikin",
    code: "U7",
    libelle: "Defaut transmission entre unites exterieures (VRV)",
    description:
      "Sur systeme VRV multi-modules, defaut de communication entre les unites exterieures en cascade.",
    causesProbables: [
      "Cable Q1/Q2 entre modules exterieurs defaillant",
      "Adressage automatique non termine apres modification",
      "Module ext maitre HS",
    ],
    etapesReparation: [
      "Controler le bus Q1/Q2 entre modules exterieurs",
      "Relancer la procedure d'adressage automatique (test run)",
      "Verifier les LEDs de communication sur chaque module exterieur",
    ],
    gravite: "critique",
    systemes: ["VRV", "VRF"],
    sources: ["https://www.daikin.com/products/ac/services/error_codes"],
  },
  {
    marque: "daikin",
    code: "A1",
    libelle: "Defaut carte electronique unite interieure",
    description:
      "La carte mere de l'unite interieure ne repond pas correctement aux signaux. Auto-diagnostic interne en defaut.",
    causesProbables: [
      "Carte PCB unite interieure defaillante",
      "Surtension recente (orage, microcoupure reseau)",
      "Humidite infiltree dans le boitier (UI cassette plafond)",
    ],
    etapesReparation: [
      "Couper / remettre tension 5 min pour reset complet",
      "Verifier absence d'humidite ou corrosion sur la PCB",
      "Si defaut persistant apres reset : remplacer carte PCB unite interieure",
    ],
    gravite: "critique",
    sources: ["https://www.daikin.com/products/ac/services/error_codes"],
  },
  {
    marque: "daikin",
    code: "A3",
    libelle: "Niveau d'eau anormal pompe condensats",
    description:
      "Le flotteur du bac a condensats detecte un niveau d'eau trop eleve. Risque debordement.",
    causesProbables: [
      "Pompe a condensats HS",
      "Tuyau d'evacuation bouche (calcaire, mousse, dechets)",
      "Contre-pente du tuyau d'evacuation",
      "Flotteur bloque (mousse, debris)",
    ],
    etapesReparation: [
      "Aspirer le bac condensats + nettoyer le flotteur",
      "Souffler le tuyau d'evacuation et verifier pente >1%",
      "Tester la pompe a condensats (alimentation + debit)",
      "Si OK : remplacer la pompe a condensats",
    ],
    gravite: "alerte",
    systemes: ["Cassette", "Gainable", "Plafonnier"],
    sources: ["https://www.daikin.com/products/ac/services/error_codes"],
  },
  {
    marque: "daikin",
    code: "A5",
    libelle: "Protection antigel echangeur unite interieure",
    description:
      "Temperature echangeur trop basse en mode froid (givrage) ou trop haute en mode chaud (surchauffe).",
    causesProbables: [
      "Filtre tres encrasse (manque de debit d'air)",
      "Ventilateur interne lent ou bloque",
      "Sous-charge fluide (en mode froid)",
      "Sonde temperature echangeur deviation",
    ],
    etapesReparation: [
      "Nettoyer / remplacer le filtre",
      "Verifier la rotation libre du ventilateur",
      "Controler temperature echangeur via diag installateur",
      "Si OK air : verifier charge fluide et sonde",
    ],
    gravite: "alerte",
    sources: ["https://www.daikin.com/products/ac/services/error_codes"],
  },
  {
    marque: "daikin",
    code: "E3",
    libelle: "Pression de refoulement trop elevee",
    description:
      "Pressostat HP declenche. Pression de refoulement compresseur depasse seuil de securite.",
    causesProbables: [
      "Encrassement condenseur exterieur (poussiere, feuilles, peluches lapin)",
      "Ventilateur exterieur HS ou ralenti",
      "Surcharge fluide a l'installation",
      "Detendeur bloque ferme",
    ],
    etapesReparation: [
      "Nettoyer condenseur exterieur au jet (sens des lames)",
      "Verifier rotation ventilateur exterieur + condensateur permanent",
      "Mesurer charge fluide actuelle vs plaque, decompresser si surcharge",
      "Si OK : tester detendeur electronique",
    ],
    gravite: "critique",
    sources: [
      "https://www.daikin.com/products/ac/services/error_codes",
      "https://coolautomation.com/blog/daikin-error-and-fault-codes-troubleshooting/",
    ],
  },
  {
    marque: "daikin",
    code: "E4",
    libelle: "Pression d'aspiration trop basse",
    description:
      "Pressostat BP declenche. Pression cote aspiration anormalement basse.",
    causesProbables: [
      "Sous-charge fluide / fuite",
      "Detendeur bloque ferme",
      "Filtre deshydrateur colmate",
      "Vanne de service partiellement fermee",
    ],
    etapesReparation: [
      "Verifier l'ouverture complete des vannes de service (HP + BP)",
      "Detecteur de fuite electronique sur tout le circuit",
      "Mesurer surchauffe et sous-refroidissement",
      "Si circuit OK : verifier detendeur et filtre deshydrateur",
    ],
    gravite: "critique",
    sources: ["https://www.daikin.com/products/ac/services/error_codes"],
  },
  {
    marque: "daikin",
    code: "E5",
    libelle: "Compresseur bloque (verrouillage thermique)",
    description:
      "Le compresseur ne demarre pas suite a protection thermique interne (Klixon) ou rotor bloque.",
    causesProbables: [
      "Compresseur grippe / coquille brulee",
      "Condensateur de demarrage HS (mono)",
      "Verrouillage thermique apres surchauffe (laisser refroidir 30 min)",
      "Probleme alimentation triphasee (deficit de phase)",
    ],
    etapesReparation: [
      "Mesurer resistance bobinages compresseur U-V, V-W, W-U (doivent etre egales)",
      "Mesurer isolement bobines vs carcasse (>1 MOhm)",
      "Verifier condensateur demarrage si mono",
      "Si bobinages KO ou court-circuit masse : remplacer compresseur",
    ],
    gravite: "critique",
    sources: ["https://www.daikin.com/products/ac/services/error_codes"],
  },
  {
    marque: "daikin",
    code: "E7",
    libelle: "Defaut ventilateur unite exterieure",
    description:
      "Le moteur du ventilateur exterieur ne tourne pas a la vitesse attendue ou est bloque.",
    causesProbables: [
      "Roulements ventilateur HS (bruit + vibration)",
      "Condensateur permanent ventilateur HS",
      "Helice bloquee (corps etranger)",
      "Carte de commande variateur HS",
    ],
    etapesReparation: [
      "Couper alim, verifier rotation libre a la main",
      "Tester condensateur permanent (μF mesure)",
      "Mesurer resistance bobinages moteur ventilateur",
      "Si moteur HS : remplacer le bloc moto-ventilateur",
    ],
    gravite: "alerte",
    sources: ["https://www.daikin.com/products/ac/services/error_codes"],
  },
  {
    marque: "daikin",
    code: "F3",
    libelle: "Temperature de refoulement trop elevee",
    description:
      "Sonde de refoulement compresseur depasse seuil critique (typiquement >120°C). Risque coquille brulee.",
    causesProbables: [
      "Sous-charge fluide (cause #1)",
      "Detendeur bloque ferme",
      "Filtre deshydrateur colmate",
      "Sonde refoulement deviante (faux declenchement)",
    ],
    etapesReparation: [
      "Verifier charge fluide + chercher fuite",
      "Mesurer temperature refoulement reelle avec pince thermo (vs sonde)",
      "Verifier detendeur electronique et filtre",
      "Si sonde HS : remplacer la sonde de refoulement",
    ],
    gravite: "critique",
    sources: ["https://www.daikin.com/products/ac/services/error_codes"],
  },
  {
    marque: "daikin",
    code: "H3",
    libelle: "Defaut pressostat HP",
    description: "Le pressostat HP est en defaut (circuit ouvert ou court-circuite).",
    causesProbables: [
      "Cable pressostat coupe ou debranche",
      "Pressostat HP HS",
      "Connecteur oxyde",
    ],
    etapesReparation: [
      "Verifier continuite cable pressostat",
      "Tester le pressostat (court-circuiter pour test, JAMAIS en exploitation prolongee)",
      "Remplacer le pressostat si HS",
    ],
    gravite: "alerte",
    sources: ["https://www.daikin.com/products/ac/services/error_codes"],
  },
  {
    marque: "daikin",
    code: "L5",
    libelle: "Surintensite compresseur (DC inverter)",
    description:
      "Sur compresseur inverter DC : surintensite mesuree par la carte inverter. Protection electronique declenchee.",
    causesProbables: [
      "Carte inverter defaillante",
      "Compresseur grippe (couple resistant anormal)",
      "Pression HP trop elevee (encrassement condenseur)",
      "Module IPM (Intelligent Power Module) HS",
    ],
    etapesReparation: [
      "Verifier proprete condenseur + ventilation exterieure",
      "Mesurer resistance bobinages compresseur (egales attendues)",
      "Tester module IPM si accessible",
      "Si module/carte HS : remplacer la carte inverter",
    ],
    gravite: "critique",
    sources: ["https://www.daikin.com/products/ac/services/error_codes"],
  },
];

// =============================================================================
// MITSUBISHI ELECTRIC / HEAVY INDUSTRIES — Mr Slim / City Multi (VRF)
// Sources : manuels Mr Slim publics + coolautomation
// =============================================================================

const MITSUBISHI: CodeErreur[] = [
  {
    marque: "mitsubishi",
    code: "P1",
    libelle: "Defaut sonde temperature ambiante (intake)",
    description:
      "La sonde de temperature de reprise d'air (Ta) est en defaut (deviation, coupure ou court-circuit).",
    causesProbables: [
      "Sonde Ta debranchee a la maintenance",
      "Cable sonde coupe",
      "Sonde Ta deviante (resistance hors plage)",
    ],
    etapesReparation: [
      "Verifier la connexion de la sonde Ta sur la carte intere",
      "Mesurer la resistance de la sonde (typique ~10 kOhm a 25°C, NTC)",
      "Remplacer la sonde si valeur hors plage",
    ],
    gravite: "alerte",
    systemes: ["Mr Slim", "City Multi"],
    sources: ["https://coolautomation.com/blog/mitsubishi-electric-error-codes/"],
  },
  {
    marque: "mitsubishi",
    code: "P2",
    libelle: "Defaut sonde temperature echangeur intere (TH2)",
    description:
      "Sonde TH2 (temperature liquide echangeur unite interieure) en defaut.",
    causesProbables: ["Sonde TH2 debranchee", "Cable coupe", "Sonde deviante"],
    etapesReparation: [
      "Verifier la connexion TH2 sur la carte intere",
      "Mesurer resistance NTC",
      "Remplacer la sonde si KO",
    ],
    gravite: "alerte",
    sources: ["https://coolautomation.com/blog/mitsubishi-electric-error-codes/"],
  },
  {
    marque: "mitsubishi",
    code: "P4",
    libelle: "Defaut detecteur de niveau condensats",
    description:
      "Le flotteur du bac a condensats detecte un niveau anormal. Pompe inefficace ou bouchee.",
    causesProbables: [
      "Pompe condensats HS",
      "Evacuation bouchee",
      "Flotteur bloque (debris, mousse)",
      "Contre-pente tuyau",
    ],
    etapesReparation: [
      "Nettoyer le bac et le flotteur",
      "Souffler le tuyau d'evacuation",
      "Tester la pompe (alimentation + debit)",
      "Verifier la pente d'evacuation",
    ],
    gravite: "alerte",
    systemes: ["Cassette", "Gainable"],
    sources: ["https://coolautomation.com/blog/mitsubishi-electric-error-codes/"],
  },
  {
    marque: "mitsubishi",
    code: "P5",
    libelle: "Defaut pompe a condensats",
    description: "La pompe a condensats ne fonctionne pas correctement.",
    causesProbables: [
      "Pompe HS (moteur grille, roue cassee)",
      "Alimentation electrique coupee",
      "Carte de commande PCB HS",
    ],
    etapesReparation: [
      "Mesurer la tension d'alimentation a la pompe",
      "Tester la pompe en demontage (alim externe)",
      "Remplacer la pompe si KO",
    ],
    gravite: "alerte",
    sources: ["https://coolautomation.com/blog/mitsubishi-electric-error-codes/"],
  },
  {
    marque: "mitsubishi",
    code: "P6",
    libelle: "Protection antigel ou surchauffe echangeur",
    description:
      "Temperature de l'echangeur intere depasse les seuils (gel en froid, surchauffe en chaud).",
    causesProbables: [
      "Filtre encrasse (manque debit air)",
      "Ventilateur intere ralenti",
      "Charge fluide anormale",
      "Sonde TH2 deviante",
    ],
    etapesReparation: [
      "Nettoyer / remplacer filtre",
      "Verifier rotation ventilateur intere",
      "Controler temperature echangeur",
      "Si OK : verifier sonde et charge fluide",
    ],
    gravite: "alerte",
    sources: ["https://coolautomation.com/blog/mitsubishi-electric-error-codes/"],
  },
  {
    marque: "mitsubishi",
    code: "P8",
    libelle: "Defaut temperature canalisation (sonde liquid pipe)",
    description: "Sonde de canalisation liquide en defaut.",
    causesProbables: [
      "Sonde debranchee",
      "Mauvais montage (contact thermique insuffisant)",
      "Sonde HS",
    ],
    etapesReparation: [
      "Verifier la connexion et le serrage de la sonde sur la canalisation",
      "Mesurer la resistance NTC",
      "Remplacer si KO",
    ],
    gravite: "alerte",
    sources: ["https://coolautomation.com/blog/mitsubishi-electric-error-codes/"],
  },
  {
    marque: "mitsubishi",
    code: "U2",
    libelle: "Refoulement compresseur trop chaud",
    description: "Temperature refoulement compresseur depasse 110-120°C.",
    causesProbables: [
      "Sous-charge fluide",
      "Detendeur LEV bloque ferme",
      "Filtre deshydrateur colmate",
      "Sonde Td deviante",
    ],
    etapesReparation: [
      "Controler la charge et chercher fuite",
      "Mesurer temperature refoulement reelle (pince)",
      "Verifier le detendeur electronique LEV",
      "Remplacer le filtre deshydrateur si circuit ouvert recemment",
    ],
    gravite: "critique",
    sources: ["https://coolautomation.com/blog/mitsubishi-electric-error-codes/"],
  },
  {
    marque: "mitsubishi",
    code: "U4",
    libelle: "Defaut sonde temperature compresseur (Td/TH4)",
    description: "Sonde de refoulement compresseur en defaut.",
    causesProbables: ["Sonde Td/TH4 debranchee", "Cable coupe", "Sonde deviante"],
    etapesReparation: [
      "Verifier la connexion",
      "Mesurer resistance",
      "Remplacer la sonde si KO",
    ],
    gravite: "alerte",
    sources: ["https://coolautomation.com/blog/mitsubishi-electric-error-codes/"],
  },
  {
    marque: "mitsubishi",
    code: "U5",
    libelle: "Surchauffe carte inverter (heatsink)",
    description:
      "Le dissipateur thermique de la carte inverter est en surchauffe.",
    causesProbables: [
      "Ventilation du compartiment electrique obstruee",
      "Carte inverter defaillante",
      "Module IPM HS",
      "Pates thermiques sechees",
    ],
    etapesReparation: [
      "Verifier la ventilation du coffret electrique",
      "Nettoyer le dissipateur",
      "Refaire les pates thermiques",
      "Si persistant : remplacer la carte inverter",
    ],
    gravite: "critique",
    sources: ["https://coolautomation.com/blog/mitsubishi-electric-error-codes/"],
  },
  {
    marque: "mitsubishi",
    code: "U6",
    libelle: "Surintensite compresseur",
    description: "Courant compresseur depasse seuil de securite.",
    causesProbables: [
      "Pression HP excessive (encrassement condenseur)",
      "Compresseur grippe",
      "Carte inverter HS",
      "Surcharge fluide",
    ],
    etapesReparation: [
      "Nettoyer le condenseur exterieur",
      "Verifier la rotation ventilateur ext",
      "Mesurer pressions HP / BP",
      "Tester la resistance des bobinages compresseur",
    ],
    gravite: "critique",
    sources: ["https://coolautomation.com/blog/mitsubishi-electric-error-codes/"],
  },
  {
    marque: "mitsubishi",
    code: "U8",
    libelle: "Defaut ventilateur unite exterieure",
    description: "Moteur ventilateur exterieur en defaut.",
    causesProbables: [
      "Roulements moteur HS",
      "Carte commande ventilateur HS",
      "Helice bloquee",
      "Condensateur permanent HS",
    ],
    etapesReparation: [
      "Verifier rotation libre moteur",
      "Tester le condensateur permanent",
      "Mesurer bobinages moteur",
      "Remplacer le bloc moteur si HS",
    ],
    gravite: "alerte",
    sources: ["https://coolautomation.com/blog/mitsubishi-electric-error-codes/"],
  },
];

// =============================================================================
// CARRIER — Comfort/Edge Pro / Infinity / Aquasnap
// Sources : manuels Carrier publics + hvactoolkit.org
// =============================================================================

const CARRIER: CodeErreur[] = [
  {
    marque: "carrier",
    code: "33",
    libelle: "Verrouillage haute pression",
    description: "Le pressostat HP a declenche.",
    causesProbables: [
      "Encrassement condenseur",
      "Ventilateur ext bloque",
      "Surcharge fluide",
      "Detendeur bloque",
    ],
    etapesReparation: [
      "Nettoyer le condenseur",
      "Verifier rotation ventilateur exterieur",
      "Mesurer pression HP, decharger si surcharge",
      "Reset apres correction",
    ],
    gravite: "critique",
    sources: ["https://hvactoolkit.org/resources/error-codes"],
  },
  {
    marque: "carrier",
    code: "41",
    libelle: "Demarrage compresseur en defaut",
    description: "Le compresseur ne demarre pas dans le delai attendu.",
    causesProbables: [
      "Compresseur grille",
      "Contacteur HS",
      "Condensateur demarrage HS",
      "Tension alimentation insuffisante",
    ],
    etapesReparation: [
      "Mesurer tension aux bornes compresseur en demarrage",
      "Tester le contacteur (continuite sous tension bobine)",
      "Mesurer bobinages compresseur",
      "Remplacer condensateur ou compresseur selon test",
    ],
    gravite: "critique",
    sources: ["https://hvactoolkit.org/resources/error-codes"],
  },
  {
    marque: "carrier",
    code: "73",
    libelle: "Defaut sonde temperature aspiration",
    description: "Sonde d'aspiration en defaut.",
    causesProbables: ["Sonde debranchee", "Sonde HS", "Cable coupe"],
    etapesReparation: [
      "Verifier la connexion",
      "Mesurer la resistance NTC",
      "Remplacer si KO",
    ],
    gravite: "alerte",
    sources: ["https://hvactoolkit.org/resources/error-codes"],
  },
  {
    marque: "carrier",
    code: "74",
    libelle: "Defaut sonde refoulement",
    description: "Sonde de refoulement compresseur en defaut.",
    causesProbables: ["Sonde debranchee", "Sonde HS"],
    etapesReparation: ["Verifier connexion", "Mesurer resistance", "Remplacer"],
    gravite: "alerte",
    sources: ["https://hvactoolkit.org/resources/error-codes"],
  },
  {
    marque: "carrier",
    code: "84",
    libelle: "Defaut communication unite int/ext",
    description: "Liaison ABCD perdue.",
    causesProbables: ["Cable communication HS", "Mauvais cablage", "Carte HS"],
    etapesReparation: [
      "Verifier continuite ABCD",
      "Verifier serrage borniers",
      "Tester avec un cable de remplacement",
    ],
    gravite: "critique",
    sources: ["https://hvactoolkit.org/resources/error-codes"],
  },
];

// =============================================================================
// TRANE — UCM / Tracer / Symbio
// Sources : manuels Trane publics + hoffmann bros HVAC guide
// =============================================================================

const TRANE: CodeErreur[] = [
  {
    marque: "trane",
    code: "Hi PR",
    libelle: "Verrouillage haute pression",
    description: "Pressostat HP declenche.",
    causesProbables: ["Condenseur encrasse", "Ventilateur ext HS", "Surcharge fluide"],
    etapesReparation: [
      "Nettoyer le condenseur",
      "Verifier le ventilateur ext",
      "Controler la charge",
    ],
    gravite: "critique",
    sources: ["https://www.hoffmannbros.com/hvac-guide/how-to-resolve-issues-with-trane-ac-s-automated-diagnostic-system"],
  },
  {
    marque: "trane",
    code: "Lo PR",
    libelle: "Verrouillage basse pression",
    description: "Pressostat BP declenche.",
    causesProbables: [
      "Sous-charge fluide / fuite",
      "Vannes de service mal ouvertes",
      "Filtre deshydrateur colmate",
    ],
    etapesReparation: [
      "Verifier ouverture des vannes",
      "Detecter fuite eventuelle",
      "Mesurer pression BP en regime stabilise",
    ],
    gravite: "critique",
    sources: ["https://www.hoffmannbros.com/hvac-guide/how-to-resolve-issues-with-trane-ac-s-automated-diagnostic-system"],
  },
  {
    marque: "trane",
    code: "LOC",
    libelle: "Lockout compresseur",
    description: "Verrouillage protection compresseur. Necessite reset apres analyse.",
    causesProbables: [
      "Surcharge thermique compresseur (Klixon)",
      "Defaut alimentation (phase manquante)",
      "Court-circuit dans le compresseur",
    ],
    etapesReparation: [
      "Laisser refroidir 30 min minimum",
      "Mesurer la tension d'alimentation toutes phases",
      "Mesurer resistance bobinages",
      "Reset apres correction",
    ],
    gravite: "critique",
    sources: ["https://www.hoffmannbros.com/hvac-guide/how-to-resolve-issues-with-trane-ac-s-automated-diagnostic-system"],
  },
  {
    marque: "trane",
    code: "SEnS",
    libelle: "Defaut sonde de temperature",
    description: "Une sonde de temperature (interieure, exterieure ou coil) est en defaut.",
    causesProbables: ["Sonde HS", "Cable coupe", "Connecteur oxyde"],
    etapesReparation: [
      "Identifier la sonde concernee via la documentation modele",
      "Verifier connexion et continuite",
      "Remplacer la sonde",
    ],
    gravite: "alerte",
    sources: ["https://www.hoffmannbros.com/hvac-guide/how-to-resolve-issues-with-trane-ac-s-automated-diagnostic-system"],
  },
];

// =============================================================================
// LG — Multi V / Therma V / Standard
// Sources : manuels LG publics + LG service manuals
// =============================================================================

const LG: CodeErreur[] = [
  {
    marque: "lg",
    code: "CH01",
    libelle: "Defaut sonde temperature ambiante intere",
    description: "Sonde Ta unite intere en defaut.",
    causesProbables: ["Sonde debranchee", "Sonde deviante", "Cable coupe"],
    etapesReparation: [
      "Verifier connexion",
      "Mesurer resistance NTC",
      "Remplacer la sonde",
    ],
    gravite: "alerte",
    sources: ["https://www.lg.com/global/business/customer-service/"],
  },
  {
    marque: "lg",
    code: "CH02",
    libelle: "Defaut sonde temperature echangeur intere",
    description: "Sonde echangeur unite intere en defaut.",
    causesProbables: ["Sonde debranchee", "Sonde deviante"],
    etapesReparation: ["Verifier connexion", "Mesurer NTC", "Remplacer"],
    gravite: "alerte",
    sources: ["https://www.lg.com/global/business/customer-service/"],
  },
  {
    marque: "lg",
    code: "CH05",
    libelle: "Defaut communication int/ext",
    description: "Pas de communication entre unite intere et exterieure.",
    causesProbables: ["Cable communication HS", "Cablage incorrect", "Carte HS"],
    etapesReparation: [
      "Verifier le cable et la polarite",
      "Mesurer la tension de communication",
      "Tester avec carte de pret",
    ],
    gravite: "critique",
    sources: ["https://www.lg.com/global/business/customer-service/"],
  },
  {
    marque: "lg",
    code: "CH06",
    libelle: "Defaut sonde sortie echangeur intere",
    description: "Sonde sortie echangeur (R2T) en defaut.",
    causesProbables: ["Sonde HS", "Cable coupe"],
    etapesReparation: ["Verifier connexion", "Mesurer NTC", "Remplacer"],
    gravite: "alerte",
    sources: ["https://www.lg.com/global/business/customer-service/"],
  },
  {
    marque: "lg",
    code: "CH09",
    libelle: "Defaut moteur ventilateur intere",
    description: "Moteur ventilateur intere ne tourne pas a la bonne vitesse.",
    causesProbables: [
      "Moteur HS",
      "Roulements grippes",
      "Carte commande HS",
      "Helice bloquee",
    ],
    etapesReparation: [
      "Verifier rotation libre",
      "Mesurer alimentation moteur",
      "Tester moteur en independant",
      "Remplacer si HS",
    ],
    gravite: "alerte",
    sources: ["https://www.lg.com/global/business/customer-service/"],
  },
  {
    marque: "lg",
    code: "CH10",
    libelle: "Defaut moteur ventilateur exterieur",
    description: "Moteur ventilateur ext en defaut.",
    causesProbables: ["Moteur HS", "Carte HS", "Helice bloquee"],
    etapesReparation: ["Verifier rotation", "Tester moteur", "Remplacer"],
    gravite: "alerte",
    sources: ["https://www.lg.com/global/business/customer-service/"],
  },
  {
    marque: "lg",
    code: "CH21",
    libelle: "Surintensite compresseur (DC inverter)",
    description: "Courant compresseur depasse seuil.",
    causesProbables: [
      "Compresseur grippe",
      "Carte inverter HS",
      "Pression HP excessive",
      "Module IPM HS",
    ],
    etapesReparation: [
      "Verifier proprete condenseur",
      "Mesurer bobinages compresseur",
      "Tester carte inverter",
    ],
    gravite: "critique",
    sources: ["https://www.lg.com/global/business/customer-service/"],
  },
  {
    marque: "lg",
    code: "CH23",
    libelle: "Surchauffe carte inverter",
    description: "Dissipateur inverter en surchauffe.",
    causesProbables: [
      "Ventilation coffret electrique obstruee",
      "Pates thermiques sechees",
      "Carte inverter HS",
    ],
    etapesReparation: [
      "Nettoyer le coffret electrique",
      "Refaire pates thermiques",
      "Remplacer la carte si persistant",
    ],
    gravite: "critique",
    sources: ["https://www.lg.com/global/business/customer-service/"],
  },
  {
    marque: "lg",
    code: "CH26",
    libelle: "Defaut position rotor compresseur",
    description: "La carte inverter ne detecte pas correctement la position rotor.",
    causesProbables: [
      "Compresseur bloque (grippage)",
      "Carte inverter HS",
      "Cables U-V-W mal phases",
    ],
    etapesReparation: [
      "Verifier cablage U-V-W vers compresseur",
      "Mesurer resistance bobinages (egales)",
      "Tester avec un compresseur de pret",
    ],
    gravite: "critique",
    sources: ["https://www.lg.com/global/business/customer-service/"],
  },
  {
    marque: "lg",
    code: "CH53",
    libelle: "Defaut communication entre cartes de l'unite exterieure",
    description: "Sur unites VRF Multi V, communication interne cassee.",
    causesProbables: ["Cable interne defaillant", "Carte HS"],
    etapesReparation: [
      "Verifier les cables internes du coffret electrique",
      "Tester chaque carte avec une de pret",
    ],
    gravite: "critique",
    systemes: ["Multi V"],
    sources: ["https://www.lg.com/global/business/customer-service/"],
  },
];

// =============================================================================
// SAMSUNG — DVM S / Standard
// =============================================================================

const SAMSUNG: CodeErreur[] = [
  {
    marque: "samsung",
    code: "E101",
    libelle: "Defaut communication unite int - exterieure",
    description: "Liaison F1-F2 perdue.",
    causesProbables: ["Cable F1-F2 HS", "Inversion", "Carte HS"],
    etapesReparation: ["Verifier cable F1-F2", "Polarite", "Tension de bus"],
    gravite: "critique",
    sources: ["https://www.samsung.com/global/business/climate/"],
  },
  {
    marque: "samsung",
    code: "E121",
    libelle: "Defaut sonde temperature ambiante intere",
    description: "Sonde Ta intere HS.",
    causesProbables: ["Sonde HS", "Cable coupe"],
    etapesReparation: ["Verifier connexion", "Mesurer resistance", "Remplacer"],
    gravite: "alerte",
    sources: ["https://www.samsung.com/global/business/climate/"],
  },
  {
    marque: "samsung",
    code: "E122",
    libelle: "Defaut sonde echangeur intere",
    description: "Sonde echangeur intere HS.",
    causesProbables: ["Sonde HS"],
    etapesReparation: ["Verifier", "Mesurer", "Remplacer"],
    gravite: "alerte",
    sources: ["https://www.samsung.com/global/business/climate/"],
  },
  {
    marque: "samsung",
    code: "E202",
    libelle: "Defaut communication entre cartes ext (Multi)",
    description: "Sur DVM, communication entre modules ext perdue.",
    causesProbables: ["Bus communication HS", "Adressage non termine"],
    etapesReparation: [
      "Verifier le bus inter-modules",
      "Relancer adressage auto",
    ],
    gravite: "critique",
    systemes: ["DVM"],
    sources: ["https://www.samsung.com/global/business/climate/"],
  },
  {
    marque: "samsung",
    code: "E416",
    libelle: "Verrouillage refoulement compresseur trop chaud",
    description: "Temperature refoulement excessive.",
    causesProbables: [
      "Sous-charge fluide",
      "Detendeur bloque",
      "Sonde Td deviante",
    ],
    etapesReparation: [
      "Controler charge",
      "Verifier detendeur",
      "Tester sonde refoulement",
    ],
    gravite: "critique",
    sources: ["https://www.samsung.com/global/business/climate/"],
  },
  {
    marque: "samsung",
    code: "E440",
    libelle: "Mode chaud bloque par temperature ext trop haute",
    description: "Tentative de chauffage avec temperature ext > seuil (typique >27°C).",
    causesProbables: ["Conditions exterieures hors plage", "Sonde Tex deviante"],
    etapesReparation: [
      "Verifier temperature ext reelle vs sonde Tex",
      "Si normal : pas un defaut, juste un blocage securite",
    ],
    gravite: "info",
    sources: ["https://www.samsung.com/global/business/climate/"],
  },
  {
    marque: "samsung",
    code: "E458",
    libelle: "Defaut ventilateur exterieur",
    description: "Moteur ventilateur ext en defaut.",
    causesProbables: ["Moteur HS", "Carte HS", "Helice bloquee"],
    etapesReparation: ["Verifier rotation", "Mesurer bobinages", "Remplacer"],
    gravite: "alerte",
    sources: ["https://www.samsung.com/global/business/climate/"],
  },
];

// =============================================================================
// TOSHIBA — Estia / Digital Inverter / SMMS
// =============================================================================

const TOSHIBA: CodeErreur[] = [
  {
    marque: "toshiba",
    code: "C05",
    libelle: "Defaut transmission depuis telecommande",
    description: "Telecommande ne communique plus avec unite intere.",
    causesProbables: ["Cable telecommande HS", "Telecommande defaillante"],
    etapesReparation: [
      "Verifier le cablage A/B",
      "Tester avec telecommande de pret",
    ],
    gravite: "alerte",
    sources: ["https://www.toshiba-aircon.co.uk/"],
  },
  {
    marque: "toshiba",
    code: "C06",
    libelle: "Defaut transmission unite int - exterieure",
    description: "Communication coupee entre intere et exterieure.",
    causesProbables: ["Cable U1/U2 HS", "Cablage incorrect", "Carte HS"],
    etapesReparation: [
      "Verifier U1/U2",
      "Tester continuite",
      "Inverser cartes pour isoler",
    ],
    gravite: "critique",
    sources: ["https://www.toshiba-aircon.co.uk/"],
  },
  {
    marque: "toshiba",
    code: "F01",
    libelle: "Defaut sonde TC1 (echangeur intere)",
    description: "Sonde TC1 en defaut.",
    causesProbables: ["Sonde HS", "Cable coupe"],
    etapesReparation: ["Verifier", "Mesurer", "Remplacer"],
    gravite: "alerte",
    sources: ["https://www.toshiba-aircon.co.uk/"],
  },
  {
    marque: "toshiba",
    code: "F04",
    libelle: "Defaut sonde TD (refoulement compresseur)",
    description: "Sonde de refoulement HS.",
    causesProbables: ["Sonde HS"],
    etapesReparation: ["Verifier", "Mesurer", "Remplacer"],
    gravite: "alerte",
    sources: ["https://www.toshiba-aircon.co.uk/"],
  },
  {
    marque: "toshiba",
    code: "P03",
    libelle: "Defaut refoulement trop chaud",
    description: "Temperature refoulement compresseur excessive.",
    causesProbables: [
      "Sous-charge fluide",
      "Detendeur bloque",
      "Sonde Td deviante",
    ],
    etapesReparation: ["Charge", "Detendeur", "Sonde"],
    gravite: "critique",
    sources: ["https://www.toshiba-aircon.co.uk/"],
  },
  {
    marque: "toshiba",
    code: "P04",
    libelle: "Verrouillage haute pression",
    description: "Pressostat HP declenche.",
    causesProbables: ["Condenseur encrasse", "Ventilateur ext HS", "Surcharge"],
    etapesReparation: ["Nettoyer", "Ventilateur", "Charge"],
    gravite: "critique",
    sources: ["https://www.toshiba-aircon.co.uk/"],
  },
  {
    marque: "toshiba",
    code: "P05",
    libelle: "Defaut alimentation (phase manquante)",
    description: "Sur unite triphasee, une phase est absente ou inversee.",
    causesProbables: [
      "Phase manquante au bornier",
      "Inversion phase (ordre rotation)",
      "Disjoncteur differentiel sur une phase",
    ],
    etapesReparation: [
      "Mesurer chaque phase L1/L2/L3 vs neutre",
      "Verifier l'ordre des phases",
      "Reactiver disjoncteur",
    ],
    gravite: "critique",
    sources: ["https://www.toshiba-aircon.co.uk/"],
  },
];

// =============================================================================
// HITACHI — RAS / Set-Free / Yutaki
// =============================================================================

const HITACHI: CodeErreur[] = [
  {
    marque: "hitachi",
    code: "01",
    libelle: "Defaut activation protection unite intere",
    description: "Protection intere activee (motor lock, surchauffe).",
    causesProbables: ["Moteur ventilateur HS", "Protection thermique"],
    etapesReparation: ["Verifier ventilateur intere", "Reset apres analyse"],
    gravite: "alerte",
    sources: ["https://www.hitachiaircon.com/"],
  },
  {
    marque: "hitachi",
    code: "02",
    libelle: "Defaut activation protection unite exterieure",
    description: "Protection exterieure activee.",
    causesProbables: ["Pressostat HP/BP", "Surchauffe compresseur", "Defaut alimentation"],
    etapesReparation: [
      "Identifier la protection declenchee via doc modele",
      "Mesurer pressions et tensions",
      "Reset apres correction",
    ],
    gravite: "critique",
    sources: ["https://www.hitachiaircon.com/"],
  },
  {
    marque: "hitachi",
    code: "03",
    libelle: "Defaut transmission int - ext",
    description: "Communication perdue.",
    causesProbables: ["Cable communication HS", "Cablage", "Carte HS"],
    etapesReparation: ["Verifier cable", "Tester continuite", "Carte"],
    gravite: "critique",
    sources: ["https://www.hitachiaircon.com/"],
  },
  {
    marque: "hitachi",
    code: "06",
    libelle: "Defaut alimentation unite exterieure",
    description: "Tension d'alimentation hors plage.",
    causesProbables: ["Tension reseau anormale", "Cablage", "Phase manquante"],
    etapesReparation: ["Mesurer tensions", "Verifier cablage", "Bornier"],
    gravite: "alerte",
    sources: ["https://www.hitachiaircon.com/"],
  },
  {
    marque: "hitachi",
    code: "07",
    libelle: "Defaut surchauffe au refoulement",
    description: "Temperature refoulement compresseur excessive.",
    causesProbables: ["Sous-charge", "Detendeur bloque"],
    etapesReparation: ["Charge", "Detendeur", "Sonde Td"],
    gravite: "critique",
    sources: ["https://www.hitachiaircon.com/"],
  },
];

// =============================================================================
// EXPORT consolide
// =============================================================================

export const CODES_ERREUR_DATABASE: CodeErreur[] = [
  ...DAIKIN,
  ...MITSUBISHI,
  ...CARRIER,
  ...TRANE,
  ...LG,
  ...SAMSUNG,
  ...TOSHIBA,
  ...HITACHI,
];

export const CODES_ERREUR_COUNT_BY_MARQUE: Record<string, number> = {
  daikin: DAIKIN.length,
  mitsubishi: MITSUBISHI.length,
  carrier: CARRIER.length,
  trane: TRANE.length,
  lg: LG.length,
  samsung: SAMSUNG.length,
  toshiba: TOSHIBA.length,
  hitachi: HITACHI.length,
};
