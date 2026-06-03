import type { MetadataRoute } from "next";

// PWA manifest — Vertxia se comporte comme une vraie app native quand l'utilisateur
// fait "Ajouter à l'écran d'accueil" depuis Safari iOS ou Chrome Android.
//
// Icônes :
//   - SVG mark (scalable) pour Chrome/Edge/Firefox (toutes tailles)
//   - apple-icon.tsx (Next.js convention) pour Safari iOS 180x180 PNG natif
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vertxia — F-Gas en quelques secondes",
    short_name: "Vertxia",
    description:
      "BSFF, CERFA 15497*04, SYDEREP — photo + voix → documents officiels signés Ministère. Pour frigoristes, climaticiens, installateurs PAC.",
    start_url: "/m",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F4F0",
    theme_color: "#111111",
    lang: "fr-FR",
    dir: "ltr",
    categories: ["business", "productivity", "utilities"],
    icons: [
      {
        src: "/logo/vertxia-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/logo/vertxia-mark.svg",
        sizes: "192x192 512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Nouvelle intervention",
        short_name: "Intervention",
        description: "Démarrer une intervention F-Gas",
        url: "/m/intervention",
      },
      {
        name: "Parc équipements",
        short_name: "Équipements",
        description: "Voir le parc et les contrôles à programmer",
        url: "/m/equipements",
      },
      {
        name: "Accueil",
        short_name: "Accueil",
        description: "Tableau de bord",
        url: "/m",
      },
    ],
  };
}
