import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { ReactQueryProvider } from "@/utils/providers";

const inter = Inter({ subsets: ["latin"] });

export const musticaFont = localFont({
  src: "../public/fonts/MusticaPro-SemiBold.otf", // Assuming you have this
  variable: "--font-mustica",
  display: "swap",
});

export const mustica = musticaFont.style.fontFamily;

export const metadata: Metadata = {
  title: "Outil admin",
  description: "Outil admin Hello prepa",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={musticaFont.className}>
        <ReactQueryProvider>
          <div className="min-h-screen bg-background flex">
            <Toaster position="top-right" richColors />
            {children}
          </div>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
