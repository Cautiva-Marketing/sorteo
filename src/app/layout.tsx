import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Montserrat (variable): títulos pesados y texto limpio. next/font la autoaloja, sin peticiones a
// Google desde el navegador.
const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-montserrat",
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
    <html lang="es-PE" className={montserrat.variable}>
      <body className="font-sans bg-paper text-ink-900 min-h-dvh antialiased">{children}</body>
    </html>
  );
}
