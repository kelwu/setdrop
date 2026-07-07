import type { Metadata, Viewport } from "next";
import { Bebas_Neue, DM_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { NavWrapper } from "@/components/setdrop/NavWrapper";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { FeedbackWidget } from "@/components/setdrop/FeedbackWidget";
import { BRAND } from "@/lib/brand";

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: `${BRAND.name} — From library to setlist`,
  description: "AI-powered DJ prep. Import your library, build your set, export to Serato or Rekordbox.",
  openGraph: {
    title: `${BRAND.name} — From library to setlist`,
    description: "AI-powered DJ prep. Import your library, build your set, export to Serato or Rekordbox.",
    siteName: BRAND.name,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${dmMono.variable} ${spaceGrotesk.variable}`}>
      <body style={{ background: "#0A0A0A", margin: 0, padding: 0 }}>
        <GoogleAnalytics />
        <NavWrapper />
        {children}
        <FeedbackWidget />
      </body>
    </html>
  );
}
