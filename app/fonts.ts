import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

export const doto = localFont({
  src: "../public/fonts/doto.woff2",
  variable: "--font-doto",
  display: "swap",
  weight: "100 900",
});

export const geistSans = GeistSans;
export const geistMono = GeistMono;
