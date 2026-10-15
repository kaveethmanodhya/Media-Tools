import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://mediatools.local"),
  title: {
    template: "%s | MediaTools",
    default: "MediaTools | Client-Side Media Processing Suite",
  },
  description:
    "A powerful, fully client-side suite for video extraction, sprite sheets, image conversion, and background removal. Fast, private, and runs entirely in your browser.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "MediaTools | Client-Side Media Processing Suite",
    description:
      "A powerful, fully client-side suite for video extraction, sprite sheets, image conversion, and background removal. Fast, private, and runs entirely in your browser.",
    siteName: "MediaTools",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "MediaTools Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "MediaTools | Client-Side Media Processing Suite",
    description:
      "A powerful, fully client-side suite for video extraction, sprite sheets, image conversion, and background removal. Fast, private, and runs entirely in your browser.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable} data-scroll-behavior="smooth">
      <body>
        <div className="site-wrapper">
          <Navbar />
          <div className="site-main">{children}</div>
          <Footer />
          <Analytics />
        </div>
      </body>
    </html>
  );
}
