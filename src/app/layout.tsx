import type { Metadata, Viewport } from "next";
import { Caveat, Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Casa Torino — Gestión",
  description: "Back-office financiero del restaurante Casa Torino",
  applicationName: "Casa Torino Gestión",
  appleWebApp: {
    capable: true,
    title: "Casa Torino",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF6F0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${montserrat.variable} ${playfair.variable} ${caveat.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
