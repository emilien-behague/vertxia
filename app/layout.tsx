import type { Metadata, Viewport } from "next";
import { Calistoga, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

/**
 * Vertxia typography stack (design system ui-ux-pro-max recommendation) :
 *   - Calistoga : display serif chunky (hero titles, accent moments éditoriaux)
 *   - Inter : sans body (UI, paragraphes, tout le reste)
 *   - JetBrains Mono : monospace pour data / labels techniques / stats
 *
 * NB : shadcn init avait réinjecté Geist comme --font-sans — on l a retiré
 * pour conserver Inter, conformément au brand-guidelines § Typography.
 */
const calistoga = Calistoga({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vertxia — La paperasse F-Gas finie en quelques secondes",
  description:
    "Photo + voix → BSFF officiel signé Ministère, CERFA 15497*04, déclaration SYDEREP. Pour les techniciens, climaticiens et installateurs PAC. Connecté à TrackDéchets, Ministère de la Transition écologique. Beta privée ouverte.",
  metadataBase: new URL("https://vertxia.com"),
  openGraph: {
    title: "Vertxia — La paperasse F-Gas finie en quelques secondes",
    description:
      "BSFF, CERFA, SYDEREP générés automatiquement depuis votre téléphone. Photo + voix → documents officiels signés Ministère. Pour techniciens, climaticiens, installateurs PAC. Beta gratuite à vie.",
    url: "https://vertxia.com",
    siteName: "Vertxia",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vertxia — Paperasse F-Gas automatisée",
    description:
      "Photo + voix → BSFF officiel signé Ministère en quelques secondes. Pour techniciens, climaticiens, installateurs PAC.",
  },
  verification: {
    google: "e6dk6nKVPO5uBOexyYXzdxC8JZ775dLnashkXOnipss",
  },
  // PWA — comportement "vraie app" quand l'utilisateur fait "Ajouter à l'écran d'accueil".
  // appleWebApp produit les meta tags Safari iOS (statusBarStyle, capable, title).
  // manifest pointe vers app/manifest.ts (Next.js le résout en /manifest.webmanifest).
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Vertxia",
    statusBarStyle: "black-translucent",
  },
  applicationName: "Vertxia",
  formatDetection: {
    telephone: false,
  },
};

// Viewport — themeColor pour la barre de statut iOS/Android quand l'app est installée.
// viewportFit "cover" permet à l'UI de s'étendre sous le notch iPhone (env(safe-area-inset-*)).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F4F0" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={cn("h-full antialiased font-sans", calistoga.variable, inter.variable, jetbrainsMono.variable)}
    >
      {/* Body sans bg/text classes — laisse globals.css forcer #F5F4F0 light
          (résout le "tout noir sur iPhone" causé par --color-background dark) */}
      <body className="min-h-full">{children}</body>
    </html>
  );
}
