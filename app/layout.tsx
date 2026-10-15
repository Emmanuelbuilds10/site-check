import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

/**
 * Three typefaces, each with a job:
 *  - Space Grotesk: the voice. Slightly quirky, nothing like a default UI font.
 *  - JetBrains Mono: labels, numbers and machine output.
 *  - Instrument Serif: the editorial accent, used for quotes and the verdict.
 */
const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Site Check - a website audit with a Trust & Safety pass",
  description:
    "Check any website in seconds: speed, SEO, accessibility, and the warning signs worth knowing about before you trust it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
