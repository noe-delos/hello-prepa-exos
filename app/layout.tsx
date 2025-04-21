import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import localFont from "next/font/local";

const inter = Inter({ subsets: ["latin"] });

export const musticaFont = localFont({
  src: "../public/fonts/MusticaPro-SemiBold.otf", // Assuming you have this
  variable: "--font-mustica",
  display: "swap",
});

export const mustica = musticaFont.style.fontFamily;

export const metadata: Metadata = {
  title: "Génération d'exercises",
  description: "Génération d'exercices internes Hello Prépa",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={musticaFont.className}>
        <div className="min-h-screen bg-background flex">{children}</div>
      </body>
    </html>
  );
}
