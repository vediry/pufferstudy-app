import type { Metadata, Viewport } from "next";
import { Manrope, Instrument_Serif } from "next/font/google";
import { ClerkThemedProvider } from "@/components/clerk-themed-provider";
import { ThemeProvider, ThemeAntiFlashScript } from "@/components/theme-provider";
import { AppBar } from "@/components/app-bar";
import { Sidebar } from "@/components/sidebar";
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
            <div className="flex min-h-dvh flex-col">
              <AppBar />
              <div className="flex flex-1">
                <Sidebar />
                <div className="flex min-w-0 flex-1 flex-col">
                  <main className="flex-1">{children}</main>
                  <footer className="no-print mt-auto border-t border-default py-6 text-center text-sm text-ink-faint">
                    <span className="mx-auto">PufferStudy · Your study workspace.</span>
                  </footer>
                </div>
              </div>
            </div>
          </ClerkThemedProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
