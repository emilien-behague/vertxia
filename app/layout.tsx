import type { Metadata } from "next";
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
    "Photo + voix → BSFF officiel signé Ministère, CERFA 15497*04, déclaration SYDEREP. Pour les frigoristes, climaticiens et installateurs PAC. Connecté à TrackDéchets, Ministère de la Transition écologique. Beta privée ouverte.",
  metadataBase: new URL("https://vertxia.com"),
  openGraph: {
    title: "Vertxia — La paperasse F-Gas finie en quelques secondes",
    description:
      "BSFF, CERFA, SYDEREP générés automatiquement depuis votre téléphone. Photo + voix → documents officiels signés Ministère. Pour frigoristes, climaticiens, installateurs PAC. Beta gratuite à vie.",
    url: "https://vertxia.com",
    siteName: "Vertxia",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vertxia — Paperasse F-Gas automatisée",
    description:
      "Photo + voix → BSFF officiel signé Ministère en quelques secondes. Pour frigoristes, climaticiens, installateurs PAC.",
  },
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
      <body className="min-h-full bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
