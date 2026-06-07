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
// PANASONIC — Aquarea PAC air-eau (WH-ADC/MDC H-series), Etherea split, VRF
// Sources : Logicool-AC PDF officiel + manuels Panasonic Aquarea
// =============================================================================

const PANASONIC: CodeErreur[] = [
  {
    marque: "panasonic",
    code: "H62",
    libelle: "Defaut debit d'eau (water flow error)",
    description:
      "Detecteur de debit signale une circulation d'eau insuffisante dans le circuit primaire de la PAC air-eau.",
    causesProbables: [
      "Filtre du circuit primaire colmate",
      "Air dans le circuit (purge a faire)",
      "Pompe circulation interne HS",
      "Vanne 3 voies bloquee",
    ],
    etapesReparation: [
      "Nettoyer le filtre en ligne du circuit",
      "Purger soigneusement le circuit primaire",
      "Verifier rotation pompe circulation",
      "Reset apres correction (si fault >4 fois en 24h : appeler Panasonic)",
    ],
    gravite: "alerte",
    systemes: ["Aquarea PAC air-eau"],
    sources: [
      "https://www.logicool-ac.com/wp-content/uploads/2014/05/Aquarea-Fault-Codes.pdf",
      "https://www.manualslib.com/manual/3196704/Panasonic-Aquarea-Wh-Adc-H-Series.html",
    ],
  },
  {
    marque: "panasonic",
    code: "H75",
    libelle: "Protection temperature d'eau trop basse",
    description:
      "Protection antigel : temperature retour d'eau trop basse en mode chauffage.",
    causesProbables: [
      "T° exterieure tres basse + chauffage faible",
      "Circulation trop lente",
      "Sonde Tret deviante",
    ],
    etapesReparation: [
      "Verifier la circulation et la pompe",
      "Controler reglage consigne chauffage",
      "Tester la sonde Tret (NTC)",
    ],
    gravite: "alerte",
    systemes: ["Aquarea PAC air-eau"],
    sources: ["https://www.manualslib.com/manual/3196704/Panasonic-Aquarea-Wh-Adc-H-Series.html"],
  },
  {
    marque: "panasonic",
    code: "H76",
    libelle: "Defaut communication telecommande - unite interieure",
    description: "Liaison perdue entre la telecommande RC et l'unite interieure.",
    causesProbables: ["Cable RC defaillant", "Telecommande HS", "Carte RC HS"],
    etapesReparation: [
      "Verifier le cable telecommande",
      "Tester avec une telecommande de pret",
      "Mesurer la tension d'alim au connecteur RC",
    ],
    gravite: "alerte",
    sources: ["https://www.manualslib.com/manual/3196704/Panasonic-Aquarea-Wh-Adc-H-Series.html"],
  },
  {
    marque: "panasonic",
    code: "H90",
    libelle: "Defaut communication interieur - exterieur",
    description:
      "Liaison perdue entre l'hydromodule interieur et l'unite exterieure.",
    causesProbables: [
      "Cable de liaison int/ext defaillant",
      "Cablage incorrect aux borniers",
      "Carte mere interieure ou exterieure HS",
    ],
    etapesReparation: [
      "Verifier la continuite et la polarite du cable de liaison",
      "Controler le serrage des borniers cote int + cote ext",
      "Mesurer la tension DC du bus de communication",
    ],
    gravite: "critique",
    systemes: ["Aquarea PAC air-eau", "Etherea split"],
    sources: ["https://www.manualslib.com/manual/3196704/Panasonic-Aquarea-Wh-Adc-H-Series.html"],
  },
  {
    marque: "panasonic",
    code: "H98",
    libelle: "Protection haute pression refrigerant",
    description:
      "Pressostat HP declenche. Pression refoulement compresseur trop elevee.",
    causesProbables: [
      "Condenseur exterieur encrasse",
      "Ventilateur exterieur HS",
      "Surcharge fluide",
      "Detendeur bloque ferme",
    ],
    etapesReparation: [
      "Nettoyer le condenseur ext au jet basse pression",
      "Verifier rotation ventilateur ext",
      "Mesurer pression HP en regime stabilise",
      "Decompresser si surcharge fluide",
    ],
    gravite: "critique",
    sources: ["https://www.manualslib.com/manual/3196704/Panasonic-Aquarea-Wh-Adc-H-Series.html"],
  },
  {
    marque: "panasonic",
    code: "H99",
    libelle: "Antigel echangeur interieur",
    description:
      "Echangeur interieur en mode froid en cours de givrage. Coupure de securite.",
    causesProbables: [
      "Filtre encrasse (manque debit air)",
      "Sous-charge fluide",
      "Ventilateur interne lent",
    ],
    etapesReparation: [
      "Nettoyer le filtre interieur",
      "Verifier la rotation ventilateur interne",
      "Controler la charge fluide",
    ],
    gravite: "alerte",
    sources: ["https://www.manualslib.com/manual/3196704/Panasonic-Aquarea-Wh-Adc-H-Series.html"],
  },
  {
    marque: "panasonic",
    code: "H42",
    libelle: "Protection basse pression refrigerant",
    description: "Pressostat BP declenche. Pression aspiration trop basse.",
    causesProbables: [
      "Sous-charge fluide / fuite",
      "Vannes de service mal ouvertes",
      "Filtre deshydrateur colmate",
    ],
    etapesReparation: [
      "Verifier ouverture complete des vannes HP+BP",
      "Detecteur de fuite electronique sur le circuit",
      "Mesurer la charge actuelle vs plaque",
    ],
    gravite: "critique",
    sources: ["https://www.manualslib.com/manual/3196704/Panasonic-Aquarea-Wh-Adc-H-Series.html"],
  },
  {
    marque: "panasonic",
    code: "H91",
    libelle: "Defaut resistance ballon ECS (tank heater OLP)",
    description:
      "Protection thermique de la resistance electrique du ballon ECS Aquarea.",
    causesProbables: [
      "Resistance ECS HS",
      "Klixon resistance declenche",
      "Cablage resistance defaillant",
    ],
    etapesReparation: [
      "Mesurer continuite resistance ECS",
      "Tester le klixon (continuite a froid)",
      "Remplacer la resistance si KO",
    ],
    gravite: "alerte",
    systemes: ["Aquarea All-In-One avec ballon"],
    sources: ["https://www.manualslib.com/manual/3196704/Panasonic-Aquarea-Wh-Adc-H-Series.html"],
  },
  {
    marque: "panasonic",
    code: "H95",
    libelle: "Erreur tension d'alimentation (voltage connection)",
    description:
      "Tension secteur hors plage admise ou erreur de cablage (mono vs tri).",
    causesProbables: [
      "Mauvais cablage L1/L2/L3/N",
      "Tension reseau anormale",
      "Cable d'alim sous-dimensionne",
    ],
    etapesReparation: [
      "Mesurer tension entre L et N (typique 230V mono ou 400V tri)",
      "Verifier l'ordre des phases (rotomatre)",
      "Controler section cable vs charge nominale",
    ],
    gravite: "alerte",
    sources: ["https://www.manualslib.com/manual/3196704/Panasonic-Aquarea-Wh-Adc-H-Series.html"],
  },
  {
    marque: "panasonic",
    code: "F12",
    libelle: "Pressostat declenche (pressure switch activate)",
    description: "Un des pressostats s'est declenche en exploitation.",
    causesProbables: [
      "Pression HP ou BP hors plage",
      "Pressostat HS",
      "Encrassement condenseur",
    ],
    etapesReparation: [
      "Identifier quel pressostat (HP ou BP) via doc",
      "Mesurer la pression reelle",
      "Tester le pressostat (continuite)",
    ],
    gravite: "critique",
    sources: ["https://www.manualslib.com/manual/3196704/Panasonic-Aquarea-Wh-Adc-H-Series.html"],
  },
  {
    marque: "panasonic",
    code: "F15",
    libelle: "Verrouillage moteur ventilateur (fan motor lock)",
    description: "Le moteur du ventilateur exterieur est bloque ou ne tourne pas.",
    causesProbables: [
      "Helice bloquee (corps etranger)",
      "Roulements grippes",
      "Carte commande ventilateur HS",
      "Condensateur permanent HS",
    ],
    etapesReparation: [
      "Verifier rotation libre helice",
      "Tester le condensateur permanent (uF)",
      "Mesurer bobinages moteur",
      "Remplacer le bloc moto-ventilateur si HS",
    ],
    gravite: "alerte",
    sources: ["https://www.manualslib.com/manual/3196704/Panasonic-Aquarea-Wh-Adc-H-Series.html"],
  },
  {
    marque: "panasonic",
    code: "F16",
    libelle: "Protection surintensite (current protection)",
    description: "Courant absorbe depasse seuil de securite carte inverter.",
    causesProbables: [
      "Compresseur grippe (couple resistant)",
      "Pression HP excessive",
      "Carte inverter HS",
    ],
    etapesReparation: [
      "Mesurer le courant moteur compresseur",
      "Verifier pression HP",
      "Mesurer bobinages compresseur (egales)",
    ],
    gravite: "critique",
    sources: ["https://www.manualslib.com/manual/3196704/Panasonic-Aquarea-Wh-Adc-H-Series.html"],
  },
  {
    marque: "panasonic",
    code: "F25",
    libelle: "Erreur cycle froid / chaud (cool/heat cycle error)",
    description:
      "Inversion mode froid/chaud impossible. Vanne 4 voies bloquee ou cablee incorrectement.",
    causesProbables: [
      "Vanne 4 voies bloquee mecaniquement",
      "Bobine vanne 4 voies HS",
      "Cablage vanne 4 voies inverse",
    ],
    etapesReparation: [
      "Tester la bobine vanne 4 voies (resistance)",
      "Verifier cablage vanne",
      "Remplacer vanne 4 voies si bloquee",
    ],
    gravite: "alerte",
    sources: ["https://www.manualslib.com/manual/3196704/Panasonic-Aquarea-Wh-Adc-H-Series.html"],
  },
  {
    marque: "panasonic",
    code: "F95",
    libelle: "Surpression en mode froid (cooling high pressure)",
    description:
      "Pression HP excessive specifiquement en mode froid (typique haute T° ext + condenseur encrasse).",
    causesProbables: [
      "Condenseur tres encrasse",
      "Ventilateur ext faible debit",
      "T° ext extreme (>40°C)",
      "Surcharge fluide",
    ],
    etapesReparation: [
      "Nettoyer le condenseur",
      "Tester debit ventilateur ext",
      "Verifier charge",
      "En cas T° ext extreme : limitation normale, attendre creneau plus frais",
    ],
    gravite: "critique",
    sources: ["https://www.manualslib.com/manual/3196704/Panasonic-Aquarea-Wh-Adc-H-Series.html"],
  },
];

// =============================================================================
// ATLANTIC — Alfea Excellia / Extensa / Hybride Duo / Alfea AI (PAC air-eau)
// Sources : Téréva PDF officiel + EDR SAV + Habitat Presto
// =============================================================================

const ATLANTIC: CodeErreur[] = [
  {
    marque: "atlantic",
    code: "10",
    libelle: "Defaut sonde exterieure",
    description:
      "Sonde de temperature exterieure HS ou cable rompu. Mode chauffage en degraded.",
    causesProbables: [
      "Cable sonde ext rompu (rongeurs, intemperies)",
      "Sonde NTC deviante",
      "Connecteur oxyde au bornier",
    ],
    etapesReparation: [
      "Mesurer continuite cable sonde ext (NTC)",
      "Mesurer resistance NTC a temperature ambiante (~10 kOhm a 25°C)",
      "Remplacer sonde si KO",
    ],
    gravite: "alerte",
    systemes: ["Alfea Excellia", "Alfea Extensa", "Alfea Hybride"],
    sources: [
      "https://edrsav.fr/codes-erreurs-pompes-a-chaleur-atlantic/",
      "https://www.habitatpresto.com/mag/pompe-a-chaleur/code-erreur-pac-atlantic",
    ],
  },
  {
    marque: "atlantic",
    code: "15",
    libelle: "Cycles de degivrage anormaux (trop longs)",
    description:
      "Le degivrage prend plus longtemps que prevu. Indicateur d'encrassement evaporateur ou ventilateur faible.",
    causesProbables: [
      "Evaporateur exterieur encrasse / givre persistant",
      "Ventilateur exterieur ralenti",
      "Sonde degivrage deviante",
    ],
    etapesReparation: [
      "Nettoyer l'evaporateur exterieur",
      "Verifier rotation ventilateur ext",
      "Tester sonde degivrage",
    ],
    gravite: "alerte",
    systemes: ["Alfea"],
    sources: ["https://edrsav.fr/codes-erreurs-pompes-a-chaleur-atlantic/"],
  },
  {
    marque: "atlantic",
    code: "30",
    libelle: "Manque d'eau dans le circuit (pression <1 bar)",
    description:
      "Pressostat eau detecte un manque d'eau dans le circuit hydraulique primaire. LE CODE LE PLUS FREQUENT sur Alfea.",
    causesProbables: [
      "Fuite dans le circuit chauffage / radiateur / plancher",
      "Vase d'expansion HS (pression preliminaire perdue)",
      "Purge a faire (air = baisse pression apparente)",
    ],
    etapesReparation: [
      "Verifier la pression au manometre (cible 1.5-2 bars a froid)",
      "Si <1 bar : faire l'appoint d'eau via robinet de remplissage",
      "Chercher la fuite (radiateurs, raccords, soupape de securite)",
      "Tester pression d'air du vase d'expansion (gonfler a 1 bar si necessaire)",
    ],
    gravite: "alerte",
    systemes: ["Alfea Excellia", "Alfea Extensa", "Alfea Hybride"],
    sources: [
      "https://edrsav.fr/codes-erreurs-pompes-a-chaleur-atlantic/",
      "https://www.habitatpresto.com/mag/pompe-a-chaleur/code-erreur-pac-atlantic",
    ],
  },
  {
    marque: "atlantic",
    code: "50",
    libelle: "Defaut sonde temperature ECS (eau chaude sanitaire)",
    description: "Sonde de temperature du ballon ECS en defaut.",
    causesProbables: ["Sonde ECS debranchee", "NTC ECS deviante", "Cable coupe"],
    etapesReparation: [
      "Verifier la connexion de la sonde ECS au bornier",
      "Mesurer la resistance NTC",
      "Remplacer la sonde si KO",
    ],
    gravite: "alerte",
    systemes: ["Alfea avec ballon ECS"],
    sources: ["https://edrsav.fr/codes-erreurs-pompes-a-chaleur-atlantic/"],
  },
  {
    marque: "atlantic",
    code: "60",
    libelle: "Defaut sonde ambiante 1",
    description:
      "Sonde ambiante du thermostat ou de la zone 1 en defaut (communication ou rupture).",
    causesProbables: [
      "Rupture de communication thermostat",
      "Pile thermostat sans-fil epuisee",
      "Sonde ambiante HS",
    ],
    etapesReparation: [
      "Changer la pile du thermostat sans-fil",
      "Verifier la portee radio entre thermostat et module",
      "Remettre la communication par appairage si necessaire",
    ],
    gravite: "alerte",
    sources: ["https://edrsav.fr/codes-erreurs-pompes-a-chaleur-atlantic/"],
  },
  {
    marque: "atlantic",
    code: "121",
    libelle: "Temperature de depart non atteinte",
    description:
      "La PAC n'arrive pas a atteindre la consigne de depart. Souvent : sous-dimensionnement ou probleme hydraulique.",
    causesProbables: [
      "Sous-charge fluide",
      "Probleme circulation (pompe, debit)",
      "Sondes deviantes (depart / retour)",
      "PAC sous-dimensionnee vs deperditions",
    ],
    etapesReparation: [
      "Verifier la circulation hydraulique et le debit",
      "Controler la charge fluide",
      "Comparer T° depart mesuree pince vs sonde",
    ],
    gravite: "alerte",
    sources: ["https://www.habitatpresto.com/mag/pompe-a-chaleur/code-erreur-pac-atlantic"],
  },
  {
    marque: "atlantic",
    code: "356",
    libelle: "Debit primaire insuffisant",
    description: "Debit de circulation primaire insuffisant detecte.",
    causesProbables: [
      "Pression eau basse",
      "Air dans le circuit",
      "Filtre primaire colmate",
      "Pompe circulation HS",
    ],
    etapesReparation: [
      "Faire l'appoint eau si pression basse",
      "Purger soigneusement le circuit",
      "Nettoyer le filtre primaire (Y-strainer)",
      "Tester la pompe circulation",
    ],
    gravite: "alerte",
    sources: ["https://www.habitatpresto.com/mag/pompe-a-chaleur/code-erreur-pac-atlantic"],
  },
  {
    marque: "atlantic",
    code: "369",
    libelle: "Defaut securite externe (organe plancher chauffant)",
    description:
      "Securite externe declenchee, souvent securite haute temperature du plancher chauffant.",
    causesProbables: [
      "Securite haute T° plancher chauffant declenchee",
      "Cable de securite coupe",
      "Capteur defaut externe HS",
    ],
    etapesReparation: [
      "Verifier la securite plancher chauffant (T° depart trop haute ?)",
      "Reset la securite externe apres analyse",
      "Verifier le contact NF sur la borne d'entree securite",
    ],
    gravite: "alerte",
    sources: ["https://www.habitatpresto.com/mag/pompe-a-chaleur/code-erreur-pac-atlantic"],
  },
  {
    marque: "atlantic",
    code: "370",
    libelle: "Unite exterieure en defaut",
    description:
      "L'unite exterieure remonte une erreur generique. CRITIQUE — la PAC est arretee.",
    causesProbables: [
      "Defaut compresseur (grippe, klixon)",
      "Defaut alimentation triphasee (phase manquante)",
      "Carte inverter HS",
      "Communication interrompue avec interieur",
    ],
    etapesReparation: [
      "Lire le code interne sur la carte exterieure (LEDs ou afficheur)",
      "Mesurer toutes les phases d'alimentation",
      "Mesurer bobinages compresseur (egales attendues)",
      "Verifier le bus communication int/ext",
    ],
    gravite: "critique",
    systemes: ["Alfea Excellia", "Alfea Extensa"],
    sources: [
      "https://edrsav.fr/codes-erreurs-pompes-a-chaleur-atlantic/",
      "https://www.habitatpresto.com/mag/pompe-a-chaleur/code-erreur-pac-atlantic",
    ],
  },
  {
    marque: "atlantic",
    code: "516",
    libelle: "PAC absent / perte communication",
    description:
      "Le module interieur ne detecte plus la presence de la carte exterieure.",
    causesProbables: [
      "Cable communication interne defaillant",
      "Carte interne HS",
      "Carte exterieure HS",
    ],
    etapesReparation: [
      "Verifier le cable communication int/ext",
      "Mesurer la tension du bus",
      "Tester avec une carte de pret",
    ],
    gravite: "critique",
    sources: ["https://www.habitatpresto.com/mag/pompe-a-chaleur/code-erreur-pac-atlantic"],
  },
];

// =============================================================================
// SAUNIER DUVAL — Genia Air / Genia Hybrid / chaudieres ThemaPlus / Isofast
// Sources : Saunier Duval France PDF officiel + EasySAV + Geoplanete
// =============================================================================

const SAUNIER_DUVAL: CodeErreur[] = [
  {
    marque: "saunier-duval",
    code: "F.0",
    libelle: "Defaut sonde depart chauffage",
    description:
      "Sonde de temperature de depart (NTC) coupee ou en court-circuit.",
    causesProbables: [
      "Sonde NTC depart deviante / HS",
      "Cable sonde coupe",
      "Connecteur sonde mal serti",
    ],
    etapesReparation: [
      "Mesurer la resistance de la sonde NTC depart (~10 kOhm a 25°C)",
      "Verifier la continuite du cable",
      "Remplacer la sonde si KO",
    ],
    gravite: "alerte",
    systemes: ["ThemaPlus", "Isofast", "Genia Air"],
    sources: [
      "https://www.saunierduval.fr/france/download/code-default/codes-defauts-pac-404962.pdf",
      "https://www.habitatpresto.com/mag/chauffage/code-erreur-chaudiere-saunier-duval",
    ],
  },
  {
    marque: "saunier-duval",
    code: "F.1",
    libelle: "Defaut sonde retour chauffage",
    description: "Sonde NTC retour coupee ou en court-circuit.",
    causesProbables: ["Sonde NTC retour HS", "Cable coupe"],
    etapesReparation: [
      "Mesurer NTC retour",
      "Verifier continuite",
      "Remplacer la sonde",
    ],
    gravite: "alerte",
    systemes: ["ThemaPlus", "Isofast", "Genia Air"],
    sources: ["https://www.saunierduval.fr/france/download/code-default/codes-defauts-pac-404962.pdf"],
  },
  {
    marque: "saunier-duval",
    code: "F.22",
    libelle: "Manque d'eau dans l'installation (<0.3 bar)",
    description:
      "Pression d'eau primaire en-dessous du seuil de securite. La chaudiere/PAC se met en defaut.",
    causesProbables: [
      "Fuite dans le circuit chauffage (radiateurs, raccords, plancher)",
      "Vase d'expansion HS (pression pre-charge perdue)",
      "Soupape de securite qui fuit",
      "Vidange recente sans remise en pression",
    ],
    etapesReparation: [
      "Verifier la pression au manometre (cible 1-1.5 bar a froid)",
      "Faire l'appoint via robinet de remplissage si <1 bar",
      "Chercher la fuite (radiateurs, raccords)",
      "Verifier la soupape de securite (joint, fuite)",
      "Tester pression d'air du vase d'expansion (cible 0.8-1 bar a vide)",
    ],
    gravite: "alerte",
    systemes: ["ThemaPlus", "Isofast", "Genia Air"],
    sources: [
      "https://www.saunierduval.fr/france/download/code-default/codes-defauts-pac-404962.pdf",
      "https://easysav.com/marques/saunier-duval/themaplus-condens-f25-a-1/codes-defauts/f22",
    ],
  },
  {
    marque: "saunier-duval",
    code: "F.23",
    libelle: "Probleme circulation eau (delta T trop grand)",
    description:
      "Difference de temperature trop grande entre depart et retour, signal d'une circulation insuffisante.",
    causesProbables: [
      "Pompe circulation HS / bloquee",
      "Air dans le circuit (purge a faire)",
      "Vanne thermostatique fermee / circuit isole",
      "Filtre encrasse",
    ],
    etapesReparation: [
      "Purger le circuit chauffage soigneusement",
      "Verifier que les vannes thermostatiques radiateur sont ouvertes",
      "Tester la pompe circulation (alim + rotation)",
      "Nettoyer le filtre",
    ],
    gravite: "alerte",
    sources: ["https://www.saunierduval.fr/france/download/code-default/codes-defauts-pac-404962.pdf"],
  },
  {
    marque: "saunier-duval",
    code: "F.27",
    libelle: "Detection flamme inattendue (vanne gaz fermee)",
    description:
      "La carte detecte une flamme alors que la vanne gaz est censee etre fermee. Securite gaz.",
    causesProbables: [
      "Vanne gaz qui fuit (gaz residuel)",
      "Sonde de flamme defaillante",
      "Carte electronique defectueuse",
    ],
    etapesReparation: [
      "Tester l'etancheite de la vanne gaz",
      "Mesurer la sonde d'ionisation (resistance + signal)",
      "Couper le gaz et reset",
      "Si persistant : remplacer la vanne gaz",
    ],
    gravite: "critique",
    systemes: ["ThemaPlus", "Isofast"],
    sources: ["https://www.saunierduval.fr/france/download/code-default/codes-defauts-pac-404962.pdf"],
  },
  {
    marque: "saunier-duval",
    code: "F.28",
    libelle: "Defaut d'allumage (pas de flamme)",
    description:
      "La chaudiere n'arrive pas a allumer apres plusieurs tentatives. Pas d'arrivee gaz ou debit insuffisant.",
    causesProbables: [
      "Coupure d'alimentation gaz (vanne fermee, compteur)",
      "Electrode d'allumage encrassee / cassee",
      "Vanne gaz HS",
      "Pression gaz insuffisante",
      "Arrivee d'air / evacuation fumee bouchee",
    ],
    etapesReparation: [
      "Verifier l'ouverture de la vanne gaz amont",
      "Nettoyer l'electrode d'allumage et controler l'etincelle",
      "Mesurer la pression gaz au compteur",
      "Verifier que ventouse / conduit fumee n'est pas bouche",
    ],
    gravite: "critique",
    systemes: ["ThemaPlus", "Isofast"],
    sources: [
      "https://www.saunierduval.fr/france/download/code-default/codes-defauts-pac-404962.pdf",
      "https://www.habitatpresto.com/mag/chauffage/code-erreur-chaudiere-saunier-duval",
    ],
  },
  {
    marque: "saunier-duval",
    code: "F.29",
    libelle: "Perte de flamme en cours de fonctionnement",
    description:
      "La flamme s'est eteinte pendant le fonctionnement. Tentative de re-allumage automatique.",
    causesProbables: [
      "Pression gaz fluctuante",
      "Electrode d'ionisation encrassee",
      "Vanne gaz vieillissante",
      "Recyclage des fumees (defaut ventouse)",
    ],
    etapesReparation: [
      "Nettoyer l'electrode d'ionisation",
      "Verifier la pression gaz en service (pas que statique)",
      "Controler la ventouse pour recyclage fumees",
    ],
    gravite: "alerte",
    systemes: ["ThemaPlus", "Isofast"],
    sources: ["https://www.saunierduval.fr/france/download/code-default/codes-defauts-pac-404962.pdf"],
  },
  {
    marque: "saunier-duval",
    code: "F.62",
    libelle: "Vanne gaz : signal de coupure non confirme",
    description: "La carte ne recoit pas la confirmation que la vanne gaz est fermee.",
    causesProbables: [
      "Vanne gaz mecaniquement defaillante",
      "Probleme electrique cable vanne",
      "Carte electronique HS",
    ],
    etapesReparation: [
      "Tester la commande electrique vanne",
      "Verifier le cablage vanne gaz",
      "Remplacer la vanne si confirmation impossible",
    ],
    gravite: "critique",
    sources: ["https://www.saunierduval.fr/france/download/code-default/codes-defauts-pac-404962.pdf"],
  },
  {
    marque: "saunier-duval",
    code: "F.65",
    libelle: "Temperature electronique trop haute",
    description:
      "Surchauffe du compartiment electronique de la chaudiere/PAC.",
    causesProbables: [
      "Ventilation compartiment electrique obstruee",
      "Carte electronique HS (composant qui chauffe)",
      "Temperature locale anormalement haute",
    ],
    etapesReparation: [
      "Verifier ventilation du coffret electrique",
      "Mesurer T° locale carte",
      "Si persistant : remplacer la carte",
    ],
    gravite: "alerte",
    sources: ["https://www.saunierduval.fr/france/download/code-default/codes-defauts-pac-404962.pdf"],
  },
  {
    marque: "saunier-duval",
    code: "F.75",
    libelle: "Defaut pression d'eau / pompe (cycle pompage non detecte)",
    description:
      "La pompe demarre mais la carte ne detecte pas de variation de pression coherente.",
    causesProbables: [
      "Pompe circulation HS",
      "Capteur de pression d'eau defaillant",
      "Air dans le circuit",
    ],
    etapesReparation: [
      "Purger le circuit",
      "Tester la pompe circulation",
      "Verifier le capteur de pression d'eau",
    ],
    gravite: "alerte",
    sources: ["https://www.saunierduval.fr/france/download/code-default/codes-defauts-pac-404962.pdf"],
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
  ...PANASONIC,
  ...ATLANTIC,
  ...SAUNIER_DUVAL,
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
  panasonic: PANASONIC.length,
  atlantic: ATLANTIC.length,
  "saunier-duval": SAUNIER_DUVAL.length,
};
