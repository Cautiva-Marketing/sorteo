import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Mismas fuentes que cautivamarketing.com: Space Grotesk para títulos e Inter para el texto.
// next/font las autoaloja (sin peticiones a Google desde el navegador) y son fuentes variables.
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Sorteo",
  description: "Regístrate para participar en el sorteo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-PE" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans bg-paper text-ink-900 min-h-dvh antialiased">{children}</body>
    </html>
  );
}
