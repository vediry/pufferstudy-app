import type { Metadata, Viewport } from "next";
import { Manrope, Instrument_Serif } from "next/font/google";
import { ClerkThemedProvider } from "@/components/clerk-themed-provider";
import { ThemeProvider, ThemeAntiFlashScript } from "@/components/theme-provider";
import { ChromeShell } from "@/components/chrome-shell";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PufferStudy — Your study workspace",
  description:
    "Per-subject hub for notes, cheat sheets, chat, assignments, and more.",
  applicationName: "PufferStudy",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ec" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1b18" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme="atelier"
      className={`${manrope.variable} ${instrumentSerif.variable}`}
    >
      <head>
        <ThemeAntiFlashScript />
      </head>
      <body className="min-h-dvh">
        <ThemeProvider>
          <ClerkThemedProvider>
            <ChromeShell>{children}</ChromeShell>
          </ClerkThemedProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
