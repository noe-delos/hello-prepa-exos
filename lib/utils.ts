import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import localFont from "next/font/local";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const rouge = localFont({
  src: "../public/fonts/RougeScript-Regular.ttf", // Assuming you have this
  variable: "--font-rouge",
  display: "swap",
});

export const curly = rouge.style.fontFamily;
