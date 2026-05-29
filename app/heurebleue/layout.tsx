import type { Metadata } from "next";
import { Cormorant_Garamond, Italiana } from "next/font/google";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const italiana = Italiana({
  variable: "--font-italiana",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "L'Heure Bleue — Maison de parfumerie haute couture · Paris",
  description:
    "Six sillages d'exception, une commande privée. Maison parisienne d'olfaction haute couture, fondée à l'heure entre chien et loup.",
  openGraph: {
    title: "L'Heure Bleue",
    description: "Maison de parfumerie haute couture · Paris",
    type: "website",
  },
};

export default function HeureBleueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${cormorant.variable} ${italiana.variable}`}>
      {children}
    </div>
  );
}
