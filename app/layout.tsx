import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { ReactQueryProvider } from "@/utils/providers";
import { musticaFont } from "@/utils/style";

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
