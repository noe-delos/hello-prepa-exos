import localFont from "next/font/local";

export const musticaFont = localFont({
  src: "../public/fonts/MusticaPro-SemiBold.otf", // Assuming you have this
  variable: "--font-mustica",
  display: "swap",
});

export const mustica = musticaFont.style.fontFamily;
