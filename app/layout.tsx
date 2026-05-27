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
  title: "Vertxia — L'IA qui transforme ton Shopify en site 3D cinéma",
  description:
    "Vertxia génère un site e-commerce 3D immersif à partir d'une simple URL. Build in public solo.",
  metadataBase: new URL("https://vertxia.com"),
  openGraph: {
    title: "Vertxia",
    description: "L'IA qui transforme ton Shopify en site 3D cinéma",
    url: "https://vertxia.com",
    siteName: "Vertxia",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vertxia",
    description: "L'IA qui transforme ton Shopify en site 3D cinéma",
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
