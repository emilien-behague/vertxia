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
  title: "Vertxia — Conformité électrique IA avant Consuel",
  description:
    "Photographie ton tableau. L'IA détecte les non-conformités NF C 15-100 en 5 min. Rapport PDF auto. Pour les 80 000 électriciens artisans FR. 63 % des dossiers Consuel ont des lacunes — Vertxia les évite avant le contrôle.",
  metadataBase: new URL("https://vertxia.com"),
  openGraph: {
    title: "Vertxia — Conformité électrique IA avant Consuel",
    description:
      "63 % des dossiers Consuel ont des lacunes. Vertxia détecte les non-conformités NF C 15-100 sur photo, avant le contrôle Consuel. Beta privée ouverte.",
    url: "https://vertxia.com",
    siteName: "Vertxia",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vertxia — Conformité électrique IA",
    description:
      "Photographie ton tableau, l'IA détecte les défauts NF C 15-100 avant Consuel. Rapport PDF en 5 min. Pour électriciens FR.",
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
