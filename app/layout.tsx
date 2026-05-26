import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#F5F4F0] text-[#111] selection:bg-black/10">
        {children}
      </body>
    </html>
  );
}
